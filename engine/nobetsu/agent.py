"""NöbetSu district agent: a local LLM reads the pipeline's results with tools and writes a farmer-facing,
source-bound explanation for one district (build time, no server, no API key).

    ollama pull qwen2.5:14b                 # once (free, local)
    python -m nobetsu.agent                 # all districts → web/public/data/agent/{id}.json
    python -m nobetsu.agent --only develi --model qwen2.5:14b

How it works
1. Tool loop: the model calls read-only tools (nobetsu.agent_tools: district, rotations, scenarios,
   soil, satellites, checks) until it has what it needs (at most MAX_STEPS calls).
2. Report: one more call with a JSON schema (Ollama structured output) produces the report.
3. Guards, then up to MAX_FIXES rewrites with the problems listed:
   - every number in the report must be one a tool returned (Registry; small years/months exempt),
   - no "recommended / best / banned / profit guaranteed" wording (AGENTS.md honest-language rule),
   - every rotation id present.
   A report that still fails is written with `guards.passed: false` and the UI must not show it.
The agent explains trade-offs under the farmer's priorities; it never picks a rotation for them.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone

import requests

from nobetsu import config
from nobetsu.agent_tools import ROTATIONS, TOOL_SPECS, Registry, Tools, numbers_in

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen2.5:14b"
MAX_STEPS = 10
MAX_FIXES = 2
EXEMPT_NUMBERS = {float(x) for x in range(0, 13)} | {24.0, 100.0}   # counts, months, "24 years", "%100"
BANNED = ("önerilen", "öneririm", "tavsiye", "en iyi", "en iyisi", "yasak", "kâr garantili", "kar garantili",
          "recommended", "recommend", "best choice", "the best", "banned", "profit guaranteed")

SYSTEM = """You are NöbetSu's district analyst for Central Anatolian dryland farmers.
You explain, with numbers from the tools only, how three two-year rotations compare in ONE district:
fallow → wheat (current practice), chickpea → wheat, lentil → wheat.
Rules:
- Call the tools first. Use every tool at least once (district, rotations, scenarios, soil, satellites, checks).
- Every number you write must come from a tool result. Never estimate, round differently or invent numbers,
  yields in kg/da, prices or money. If something is not in the tools, say it is not known.
- Do not choose for the farmer. Never write "recommended", "best", "banned", "profit guaranteed"
  (Turkish: "önerilen", "en iyi", "yasak", "kâr garantili"). Describe trade-offs: water vs bare soil vs wheat.
- Results are for a typical field in the district under 24 past climates, not the farmer's own field.
- Satellites cannot tell phosphorus, potassium, micronutrients or compaction: say a soil test is needed.
- MERRA-2 is a NASA model, not a measurement; scenarios are sensitivity steps, not forecasts.
- Plain words a farmer understands. Turkish first; the English text says the same thing."""

LT = {"type": "object", "properties": {"tr": {"type": "string"}, "en": {"type": "string"}}, "required": ["tr", "en"]}
REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": LT,
        "rotations": {"type": "array", "items": {"type": "object", "properties": {
            "rotation_id": {"type": "string", "enum": list(ROTATIONS)},
            "strengths": {"type": "array", "items": LT}, "risks": {"type": "array", "items": LT}},
            "required": ["rotation_id", "strengths", "risks"]}},
        "soil_health": {"type": "array", "items": LT},
        "satellites": {"type": "array", "items": LT},
        "climate_scenarios": {"type": "array", "items": LT},
        "uncertainties": {"type": "array", "items": LT},
        "ask_local_expert": {"type": "array", "items": LT},
    },
    "required": ["headline", "rotations", "soil_health", "satellites", "climate_scenarios", "uncertainties",
                 "ask_local_expert"],
}


def ollama_chat(model: str, messages: list[dict], tools: list[dict] | None = None, fmt: dict | None = None,
                timeout: int = 900) -> dict:
    body = {"model": model, "messages": messages, "stream": False, "options": {"temperature": 0.2, "num_ctx": 16384}}
    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
    if fmt:
        body["format"] = fmt
    r = requests.post(OLLAMA_URL, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()["message"]


def _texts(report: dict) -> list[str]:
    out = []
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("tr", "en") and isinstance(v, str):
                    out.append(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(report)
    return out


def check_report(report: dict, registry: Registry) -> list[str]:
    """Problems that make a report unusable (empty list = passes)."""
    problems = []
    known = registry.numbers | EXEMPT_NUMBERS
    unknown = sorted({x for t in _texts(report) for x in numbers_in(t)
                      if not any(abs(x - k) <= max(0.011, 0.005 * abs(k)) for k in known)})
    if unknown:
        problems.append(f"Numbers not returned by any tool: {unknown}. Use only tool numbers, or remove them.")
    low = " ".join(_texts(report)).lower()
    bad = [w for w in BANNED if re.search(rf"(?<!\w){re.escape(w)}(?!\w)", low)]
    if bad:
        problems.append(f"Forbidden wording: {bad}. Describe trade-offs; do not choose for the farmer.")
    ids = {r.get("rotation_id") for r in report.get("rotations", [])}
    if ids != set(ROTATIONS):
        problems.append(f"rotations must cover exactly {list(ROTATIONS)}; got {sorted(i for i in ids if i)}.")
    return problems


def run_district(location_id: str, model: str = DEFAULT_MODEL, depth_id: str = "medium", chat=ollama_chat) -> dict:
    reg = Registry()
    tools = Tools(location_id, depth_id, reg)
    msgs = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"District id: {location_id}. Depth class: {depth_id}. "
                                        "Gather the facts with the tools, then say you are ready."}]
    used = []
    for _ in range(MAX_STEPS):
        m = chat(model, msgs, tools=TOOL_SPECS)
        msgs.append({"role": "assistant", "content": m.get("content", ""), "tool_calls": m.get("tool_calls") or []})
        calls = m.get("tool_calls") or []
        if not calls:
            break
        for c in calls:
            fn = c["function"]["name"]
            args = c["function"].get("arguments") or {}
            if isinstance(args, str):
                args = json.loads(args or "{}")
            try:
                result = getattr(tools, fn)(**args) if fn in {t["name"] for t in TOOL_SPECS} else {"error": f"unknown tool {fn}"}
            except Exception as e:  # noqa: BLE001 — tool errors go back to the model
                result = {"error": str(e)}
            used.append({"tool": fn, "args": args})
            msgs.append({"role": "tool", "content": json.dumps(result, ensure_ascii=False), "tool_name": fn})
    # make sure every source was read even if the model skipped one
    for t in TOOL_SPECS:
        if t["name"] not in {u["tool"] for u in used}:
            result = getattr(tools, t["name"])()
            used.append({"tool": t["name"], "args": {}, "forced": True})
            msgs.append({"role": "user", "content": f"Result of {t['name']} (you did not call it): "
                                                    + json.dumps(result, ensure_ascii=False)})

    msgs.append({"role": "user", "content": "Write the report now as JSON matching the schema. Every number from the tool "
                                            "results above; Turkish and English; trade-offs, no choice for the farmer."})
    report, problems = None, ["not generated"]
    for attempt in range(MAX_FIXES + 1):
        m = chat(model, msgs, fmt=REPORT_SCHEMA)
        try:
            report = json.loads(m.get("content") or "{}")
        except json.JSONDecodeError as e:
            report, problems = None, [f"Invalid JSON: {e}"]
        else:
            problems = check_report(report, reg)
        if not problems:
            break
        msgs.append({"role": "assistant", "content": m.get("content", "")})
        msgs.append({"role": "user", "content": "Fix these problems and return the whole JSON again:\n- " + "\n- ".join(problems)})

    return {
        "schema_version": "1.0", "mock": False,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "location_id": location_id, "depth_id": depth_id,
        "model": f"{model} (Ollama, local)", "type": "model",
        "report": report,
        "tools_used": used,
        "guards": {"passed": not problems, "problems": problems, "rewrites": attempt},
        "disclaimer": {"tr": "Yapay zekâ yorumu: yalnızca bu sitedeki verilerden üretildi; çiftçinin ve yerel uzmanın kararının yerine geçmez.",
                       "en": "AI commentary generated only from this site's data; it does not replace the farmer's and local experts' judgment."},
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--depth", default="medium")
    a = ap.parse_args()
    out_dir = config.WEB_DATA_DIR / "agent"
    out_dir.mkdir(parents=True, exist_ok=True)
    for loc in config.location_ids():
        if a.only and loc not in a.only:
            continue
        rec = run_district(loc, a.model, a.depth)
        (out_dir / f"{loc}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        g = rec["guards"]
        print(f"{loc}: guards {'ok' if g['passed'] else 'FAILED'} (rewrites {g['rewrites']}, tools {len(rec['tools_used'])})"
              + ("" if g["passed"] else f" — {g['problems']}"), flush=True)


if __name__ == "__main__":
    main()

"""Write the contract JSON for the site (ARAYUZLER §7–§8, PLAN_MVP §4). Owner: Gümüş."""

from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path

from . import SCHEMA_VERSION, config, mock as mockmod

START_YEARS = [2001, 2024]
NOT_AVAILABLE_REMOTELY = ["phosphorus", "potassium", "micronutrients", "compaction"]

# Used only while Ömer's soil.yaml has no depth_classes yet (values from PLAN_MVP §4.1).
_FALLBACK_DEPTH_CLASSES = [
    {"id": "shallow", "depth_m": 0.6, "label": {"en": "Shallow (<60 cm)", "tr": "Sığ (<60 cm)"}},
    {"id": "medium", "depth_m": 0.9, "label": {"en": "Medium (60–90 cm)", "tr": "Orta (60–90 cm)"}},
    {"id": "deep", "depth_m": 1.2, "label": {"en": "Deep (>90 cm)", "tr": "Derin (>90 cm)"}},
]

_MM_KEYS = {"pre_sowing_precip_mm", "water_at_wheat_sowing_mm", "eta_mm", "etc_mm", "p_mm", "dp_mm", "aw_mm"}
_RATIO_KEYS = {"fallow_storage_efficiency", "yield_ratio"}
_INT_KEYS = {"bare_days", "wind_exposed_bare_days", "stress_days", "heat_days_flowering", "start_year"}
_INT_LIST_KEYS = {"bare_by_month", "stress_by_month"}


def _round(obj, key: str | None = None):
    """Rounding rules from ARAYUZLER §10."""
    if isinstance(obj, dict):
        return {k: _round(v, k) for k, v in obj.items()}
    if isinstance(obj, list):
        if key in _INT_LIST_KEYS:
            return [int(round(x)) for x in obj]
        if key == "fullness_by_month":
            return [round(float(x), 1) for x in obj]
        return [_round(x) for x in obj]
    if obj is None or isinstance(obj, (bool, str)):
        return obj
    if isinstance(obj, (int, float)):
        if key in _INT_KEYS:
            return int(round(obj))
        if key in _MM_KEYS:
            return round(float(obj), 1)
        if key in _RATIO_KEYS:
            return round(float(obj), 3)
        return obj
    return obj


def _header(mock: bool, generated_at: str) -> dict:
    return {"schema_version": SCHEMA_VERSION, "mock": mock, "generated_at": generated_at}


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def _depth_classes() -> list[dict]:
    if config.exists("soil"):
        classes = config.load("soil").get("depth_classes")
        if classes:
            out = []
            for c in classes:
                d = c["depth_m"]
                out.append({"id": c["id"], "depth_m": d["value"] if isinstance(d, dict) else d, "label": c["label"]})
            return out
    return copy.deepcopy(_FALLBACK_DEPTH_CLASSES)


BASELINE_SCENARIO = "baseline"


def _scenarios(scenario_ids: list[str]) -> list[dict]:
    """site_index.scenarios (E2): id, label, precip_factor, temp_shift_c; baseline first. Only the written ones."""
    defined = {s["id"]: s for s in config.load("scenarios")["scenarios"]} if config.exists("scenarios") else {}
    out = []
    for sid in [BASELINE_SCENARIO] + [i for i in scenario_ids if i != BASELINE_SCENARIO]:
        sc = defined.get(sid, {})
        out.append({
            "id": sid,
            "label": sc.get("label", {"en": "Past climate", "tr": "Geçmiş iklim"}),
            "precip_factor": float(sc.get("precip_factor", {}).get("value", 1.0)),
            "temp_shift_c": float(sc.get("temp_shift_c", {}).get("value", 0.0)),
        })
    return out


def _site_index(mock: bool, ts: str, weather_meta: dict[str, dict], scenario_ids: list[str] | None = None) -> dict:
    locs = []
    for loc in config.load("locations")["locations"]:
        meta = weather_meta.get(loc["id"], {})
        locs.append({
            "id": loc["id"], "name": loc["name"], "district": loc["district"], "province": loc["province"],
            "lat": loc["lat"], "lon": loc["lon"], "elevation_m": meta.get("elevation_m", 0), "note": loc["note"],
        })
    rotations = sorted(config.load("rotations")["rotations"], key=lambda r: not r["is_baseline"])
    firsts = [m["first_date"] for m in weather_meta.values() if m.get("first_date")]
    lasts = [m["last_date"] for m in weather_meta.values() if m.get("last_date")]
    return {
        **_header(mock, ts),
        "power_range": {"start": max(firsts) if firsts else "", "end": min(lasts) if lasts else ""},
        "locations": locs,
        "rotations": rotations,
        "depth_classes": _depth_classes(),
        "start_years": list(START_YEARS),
        "scenarios": _scenarios(scenario_ids or []),
    }


def _soil_properties(location_id: str, mock: bool) -> list[dict]:
    path = config.DATA_DIR / "soilgrids" / f"{location_id}.json"
    if path.exists():
        with path.open(encoding="utf-8") as f:
            return json.load(f).get("properties", [])
    return mockmod.fake_soil_properties() if mock else []


def _soil_extras(location_id: str) -> dict:
    """Optional soil-card transparency (15 Nov): AWC estimates the engine did NOT use, and the texture class.
    Lets the card say "SoilGrids' own estimate: 58.6 mm/m (not used, see note)"."""
    path = config.DATA_DIR / "soilgrids" / f"{location_id}.json"
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        rec = json.load(f)
    extras = {}
    alts = rec.get("awc_alternatives")
    if alts:
        extras["awc_alternatives"] = {
            k: {"value": round(float(v["value"]), 1), "unit": v.get("unit", "mm/m"), "source": v["source"],
                "type": v.get("type", "model"), "verified": bool(v.get("verified", False)),
                **({"range_q05_q95": v["range_q05_q95"]} if "range_q05_q95" in v else {})}
            for k, v in alts.items()
        }
    tex = rec.get("texture_0_100cm")
    if tex and tex.get("usda_class"):
        extras["texture_class"] = tex["usda_class"]
    return extras


def _awc(node: dict) -> dict:
    """AWC is mm per m of soil: 1 decimal, like other mm values (ARAYUZLER §10)."""
    node = dict(node)
    if isinstance(node.get("value"), (int, float)) and not isinstance(node["value"], bool):
        node["value"] = round(float(node["value"]), 1)
    return node


def _results(out: dict, mock: bool, ts: str, scenario_id: str = BASELINE_SCENARIO) -> dict:
    return {
        **_header(mock, ts),
        "location_id": out["location_id"],
        "scenario_id": scenario_id,
        "soil": {
            "awc_mm_per_m": _awc(out["awc_used"]),
            "properties": _soil_properties(out["location_id"], mock),
            "not_available_remotely": list(NOT_AVAILABLE_REMOTELY),
            **_soil_extras(out["location_id"]),
        },
        "sequences": _round(out["sequences"]),
    }


def _ledger(out: dict, mock: bool, ts: str) -> dict:
    return {**_header(mock, ts), "location_id": out["location_id"], "series": _round(out["ledger"])}


def _defaults(mock: bool, ts: str) -> dict:
    """Decision parameters (ARAYUZLER §4.4): crops (reference yield, price, support) + decision (weights, guardrails).
    Prices are internal parameters; the site never shows money."""
    cfg = copy.deepcopy(config.load("defaults"))
    return {**_header(mock, ts), "crops": cfg["crops"], "decision": cfg["decision"]}


def _smap(location_id: str, mock: bool, ts: str) -> dict:
    base = {**_header(mock, ts), "location_id": location_id, "available": False,
            "product": "SMAP L4 SPL4SMGP v8", "cell_km": 9,
            "latest": None, "monthly_climatology": [], "monthly_series": []}
    path = config.DATA_DIR / "smap" / f"{location_id}.json"
    if path.exists():
        with path.open(encoding="utf-8") as f:
            base.update(json.load(f))
    elif mock:
        base.update(mockmod.fake_smap(location_id))
    base.update(_header(mock, ts), location_id=location_id)  # header always wins over cached file
    return base


def write_all(outputs: dict[str, dict], checks: list[dict], mock: bool, out_dir: str = "web/public/data",
              weather_meta: dict[str, dict] | None = None,
              scenario_outputs: dict[str, dict[str, dict]] | None = None) -> None:
    """Write site_index, defaults, validation, results/*, ledger/*, smap/* under out_dir.

    weather_meta: optional {location_id: weather.attrs} for elevation_m and power_range.
    scenario_outputs: optional {location_id: {scenario_id: EngineOutput}} (E2) -> results/{loc}__{scenario}.json;
    the baseline stays in results/{loc}.json. Ledger and validation come from the baseline only.
    """
    # The default means the repo's web/public/data from any cwd; any other relative path is relative to cwd.
    out = config.WEB_DATA_DIR if out_dir == "web/public/data" else Path(out_dir).resolve()
    ts = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    meta = weather_meta or {}
    scen = scenario_outputs or {}
    scenario_ids = sorted({sid for per in scen.values() for sid in per if sid != BASELINE_SCENARIO},
                          key=lambda sid: _scenario_order(sid))
    _write(out / "site_index.json", _site_index(mock, ts, meta, scenario_ids))
    _write(out / "defaults.json", _defaults(mock, ts))
    _write(out / "validation.json", {**_header(mock, ts), "checks": checks})
    for loc_id, o in outputs.items():
        _write(out / "results" / f"{loc_id}.json", _results(o, mock, ts))
        _write(out / "ledger" / f"{loc_id}.json", _ledger(o, mock, ts))
        _write(out / "smap" / f"{loc_id}.json", _smap(loc_id, mock, ts))
        for sid in scenario_ids:
            so = scen.get(loc_id, {}).get(sid)
            if so is None:
                raise ValueError(f"scenario {sid} missing for {loc_id}: every location needs every scenario")
            _write(out / "results" / f"{loc_id}__{sid}.json", _results(so, mock, ts, scenario_id=sid))


def _scenario_order(sid: str) -> int:
    ids = [s["id"] for s in config.load("scenarios")["scenarios"]] if config.exists("scenarios") else []
    return ids.index(sid) if sid in ids else len(ids)

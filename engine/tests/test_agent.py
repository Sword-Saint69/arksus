"""District agent: tool loop, guards and output shape, with a scripted fake model (no LLM, no network).
Reads the committed web/public/data, like the agent does."""

import json

import pytest

from nobetsu import agent
from nobetsu.agent_tools import Registry, Tools, numbers_in

LOC = "develi"


def _lt(tr, en=None):
    return {"tr": tr, "en": en or tr}


def _report(water_fallow: str, extra: str = "") -> dict:
    return {
        "headline": _lt(f"Nadasta buğday ekiminde ortanca {water_fallow} mm su kalıyor.{extra}"),
        "rotations": [{"rotation_id": r, "strengths": [_lt("Toprakta su.")], "risks": [_lt("Çıplak gün.")]}
                      for r in ("fallow_wheat", "chickpea_wheat", "lentil_wheat")],
        "soil_health": [_lt("Fosfor ve potasyum için toprak analizi gerekir.")],
        "satellites": [_lt("MERRA-2 bir modeldir.")],
        "climate_scenarios": [_lt("Senaryolar tahmin değildir.")],
        "uncertainties": [_lt("Tarlanız değil.")],
        "ask_local_expert": [_lt("Toprak işleme sayısı.")],
    }


class FakeModel:
    """Calls every tool in the first turn, then answers with the queued report texts."""

    def __init__(self, reports):
        self.reports = list(reports)
        self.calls = []

    def __call__(self, model, messages, tools=None, fmt=None):
        self.calls.append({"tools": bool(tools), "fmt": bool(fmt)})
        if tools and not any(m["role"] == "tool" for m in messages):
            return {"content": "", "tool_calls": [{"function": {"name": t["name"], "arguments": {}}} for t in tools]}
        if tools:
            return {"content": "ready"}
        return {"content": json.dumps(self.reports.pop(0), ensure_ascii=False)}


@pytest.fixture(scope="module")
def fallow_water():
    r = Tools(LOC).rotations()["rotations"]["fallow_wheat"]["water_at_wheat_sowing_mm"]["p50"]
    return str(r)


def test_numbers_in_reads_turkish_and_english_decimals():
    assert numbers_in("ortanca 0,57 oran, 72 mm, %10") == [0.57, 72.0, 10.0]
    assert numbers_in("ratio 0.85; −7 %") == [0.85, -7.0]


def test_tools_register_their_numbers():
    reg = Registry()
    t = Tools(LOC, registry=reg)
    w = t.rotations()["rotations"]["fallow_wheat"]["water_at_wheat_sowing_mm"]["p50"]
    assert round(float(w), 2) in reg.numbers
    t.checks()
    assert any(abs(x - 3.88) < 1e-9 for x in reg.numbers)      # number inside a check text


def test_guard_flags_invented_numbers_and_wording(fallow_water):
    reg = Registry(); Tools(LOC, registry=reg).rotations()
    assert agent.check_report(_report(fallow_water), reg) == []
    p = agent.check_report(_report("987654"), reg)
    assert any("987654" in x for x in p)
    p = agent.check_report(_report(fallow_water, " En iyi seçim nadastır."), reg)
    assert any("Forbidden" in x for x in p)


def test_guard_requires_all_three_rotations(fallow_water):
    reg = Registry(); Tools(LOC, registry=reg).rotations()
    r = _report(fallow_water); r["rotations"] = r["rotations"][:2]
    assert any("rotations must cover" in x for x in agent.check_report(r, reg))


def test_run_uses_every_tool_and_rewrites_until_guards_pass(fallow_water):
    fake = FakeModel([_report("987654"), _report(fallow_water)])
    rec = agent.run_district(LOC, chat=fake)
    assert {u["tool"] for u in rec["tools_used"]} == {"district", "rotations", "scenarios", "soil", "satellites", "checks"}
    assert rec["guards"] == {"passed": True, "problems": [], "rewrites": 1}
    assert rec["report"]["headline"]["tr"].startswith("Nadasta")
    assert rec["mock"] is False and rec["type"] == "model" and "Ollama" in rec["model"]


def test_run_marks_failure_when_model_keeps_inventing(fallow_water):
    fake = FakeModel([_report("987654")] * (agent.MAX_FIXES + 1))
    rec = agent.run_district(LOC, chat=fake)
    assert rec["guards"]["passed"] is False and rec["guards"]["problems"]


def test_forced_tools_when_model_skips_them(fallow_water):
    class Lazy(FakeModel):
        def __call__(self, model, messages, tools=None, fmt=None):
            if tools:
                return {"content": "ready"}            # never calls a tool
            return super().__call__(model, messages, tools, fmt)
    rec = agent.run_district(LOC, chat=Lazy([_report(fallow_water)]))
    assert all(u.get("forced") for u in rec["tools_used"]) and len(rec["tools_used"]) == 6

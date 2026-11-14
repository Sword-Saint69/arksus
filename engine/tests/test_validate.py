"""validate.run_checks tests (PLAN_MVP §5.7, ARAYUZLER §6)."""

import copy

import pytest

from nobetsu import validate
from nobetsu.runner import run_location
from tests.fixtures import load_config, synthetic_weather

ORDER = ["mass_balance", "et0_fao56_ex18", "pse_literature", "trial_ratio", "precip_vs_mgm"]
YEARS = [2005, 2010, 2015]


@pytest.fixture(autouse=True)
def _no_real_imerg_cache(monkeypatch):
    """Keep these tests independent of data/imerg/*.json (IMERG is tested in test_imerg.py)."""
    from nobetsu import imerg
    monkeypatch.setattr(imerg, "load_cached", lambda ids: {})


@pytest.fixture(scope="module")
def weathers():
    return {loc: synthetic_weather("2000-01-01", "2026-07-31", location_id=loc, seed=i,
                                   annual_precip_mm=300.0 + 40 * i)
            for i, loc in enumerate(["karapinar", "develi"])}


@pytest.fixture(scope="module")
def outputs(weathers):
    return {loc: run_location(loc, w, None, start_years=YEARS) for loc, w in weathers.items()}


@pytest.fixture()
def refs():
    return load_config("references")


def _by_id(checks):
    return {c["id"]: c for c in checks}


def test_five_checks_in_fixed_order_with_contract_fields(outputs, weathers, refs):
    checks = validate.run_checks(outputs, weathers, refs)
    assert [c["id"] for c in checks] == ORDER
    for c in checks:
        assert list(c.keys()) == ["id", "status", "value", "reference", "note"]
        assert c["status"] in {"pass", "fail", "info", "pending"}
        assert isinstance(c["value"], str) and isinstance(c["reference"], str)
        assert set(c["note"].keys()) == {"en", "tr"}
        assert c["note"]["en"] and c["note"]["tr"]


def test_mass_balance_passes_and_fails_on_threshold(outputs, weathers, refs):
    assert _by_id(validate.run_checks(outputs, weathers, refs))["mass_balance"]["status"] == "pass"
    broken = copy.deepcopy(outputs)
    broken["develi"]["diagnostics"]["max_mass_balance_error_mm"] = 0.5
    c = _by_id(validate.run_checks(broken, weathers, refs))["mass_balance"]
    assert c["status"] == "fail" and "0.5" in c["value"]


def test_et0_example18_passes(outputs, weathers, refs):
    c = _by_id(validate.run_checks(outputs, weathers, refs))["et0_fao56_ex18"]
    assert c["status"] == "pass"
    assert "3.88" in c["value"] and "3.9" in c["reference"]


def test_pse_is_info_with_model_value_and_literature_range(outputs, weathers, refs):
    refs["pse_range"]["low"]["value"], refs["pse_range"]["high"]["value"] = 0.08, 0.30
    c = _by_id(validate.run_checks(outputs, weathers, refs))["pse_literature"]
    assert c["status"] == "info"
    assert "%" in c["value"] and "8" in c["reference"] and "30" in c["reference"]


def test_pse_pending_without_reference(outputs, weathers, refs):
    refs["pse_range"]["low"]["value"] = None
    assert _by_id(validate.run_checks(outputs, weathers, refs))["pse_literature"]["status"] == "pending"


def test_trial_ratio_is_info_and_shows_both_sides(outputs, weathers, refs):
    c = _by_id(validate.run_checks(outputs, weathers, refs))["trial_ratio"]
    assert c["status"] == "info"
    # trial: 228 / 286 = 0.80, 249 / 286 = 0.87
    assert "0.80" in c["reference"] and "0.87" in c["reference"]
    assert "chickpea" in c["value"] and "lentil" in c["value"]


def test_trial_ratio_pending_without_reference(outputs, weathers, refs):
    refs["trial_yields_kg_per_da"]["after_fallow"]["value"] = None
    assert _by_id(validate.run_checks(outputs, weathers, refs))["trial_ratio"]["status"] == "pending"


def test_precip_vs_mgm_pending_when_normals_missing(outputs, weathers, refs):
    for loc in ("karapinar", "develi"):
        refs["mgm_annual_precip_mm"][loc]["value"] = None
    c = _by_id(validate.run_checks(outputs, weathers, refs))["precip_vs_mgm"]
    assert c["status"] == "pending"


def test_precip_vs_mgm_reports_percent_difference(outputs, weathers, refs):
    refs["mgm_annual_precip_mm"]["karapinar"].update(value=300.0, station="Test station")
    refs["mgm_annual_precip_mm"]["develi"]["value"] = None
    c = _by_id(validate.run_checks(outputs, weathers, refs))["precip_vs_mgm"]
    assert c["status"] == "info"
    assert "Karapınar" in c["value"] and "%" in c["value"]
    assert "Develi" not in c["value"]          # no normal for Develi yet
    expected = validate.power_annual_mean_mm(weathers["karapinar"])
    assert f"{(expected - 300.0) / 300.0 * 100:+.0f} %" in c["value"]


def test_power_annual_mean_uses_complete_years_only(weathers):
    w = weathers["karapinar"]
    full = w.loc["2000-01-01":"2025-12-31", "precip_mm"]
    assert validate.power_annual_mean_mm(w) == pytest.approx(full.sum() / 26)


def test_trial_ratio_mentions_awc_used(outputs, weathers, refs):
    c = _by_id(validate.run_checks(outputs, weathers, refs))["trial_ratio"]
    assert "mm/m" in c["value"]


def test_location_names_come_from_locations_yaml():
    names = validate.location_names()
    assert names["polatli"] == "Polatlı" and names["bogazliyan"] == "Boğazlıyan"
    assert validate._name("cankiri") == "Çankırı"
    assert validate._name("not_a_district") == "not_a_district"

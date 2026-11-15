"""POWER precipitation correction with MGM station normals (runner.precip_correction_factor /
apply_precip_correction) and its note in precip_vs_mgm. No network; synthetic weather."""

import pandas as pd
import pytest

from nobetsu import runner, validate
from tests.fixtures import load_config, synthetic_weather


@pytest.fixture()
def refs():
    r = load_config("references")
    r["mgm_annual_precip_mm"]["karapinar"].update(value=300.0, station="Test station")
    return r


def _w(annual=400.0):
    return synthetic_weather("2000-01-01", "2026-07-31", location_id="karapinar", seed=3, annual_precip_mm=annual)


def test_factor_is_station_normal_over_power_mean(refs):
    w = _w()
    f = runner.precip_correction_factor("karapinar", w, refs)
    assert f["factor"] == pytest.approx(300.0 / validate.power_annual_mean_mm(w))
    assert f["mgm_mm"] == 300.0 and f["station"] == "Test station"


def test_no_factor_without_station_normal(refs):
    refs["mgm_annual_precip_mm"]["karapinar"]["value"] = None
    assert runner.precip_correction_factor("karapinar", _w(), refs) is None
    assert runner.precip_correction_factor("not_a_district", _w(), refs) is None


def test_apply_scales_daily_rain_and_keeps_wet_days(refs):
    w = _w()
    c = runner.apply_precip_correction(w, "karapinar", refs)
    f = c.attrs["precip_correction"]["factor"]
    assert c["precip_mm"].to_numpy() == pytest.approx((w["precip_mm"] * f).to_numpy())
    assert ((c["precip_mm"] > 0) == (w["precip_mm"] > 0)).all()          # same wet days
    assert validate.power_annual_mean_mm(c) == pytest.approx(300.0)       # annual mean now matches the station
    assert (c["tmax_c"] == w["tmax_c"]).all()                             # nothing else changes
    assert "precip_correction" not in w.attrs                             # input not modified


def test_apply_is_idempotent(refs):
    c1 = runner.apply_precip_correction(_w(), "karapinar", refs)
    c2 = runner.apply_precip_correction(c1, "karapinar", refs)
    assert (c2["precip_mm"] == c1["precip_mm"]).all()


def test_run_location_uses_corrected_rain_when_enabled(refs, monkeypatch):
    monkeypatch.setattr(runner, "_references", lambda: refs)
    w = _w()
    on = runner.run_location("karapinar", w, None, start_years=[2010], precip_correction=True)
    off = runner.run_location("karapinar", w, None, start_years=[2010], precip_correction=False)
    p_on = on["sequences"][0]["pre_sowing_precip_mm"]
    p_off = off["sequences"][0]["pre_sowing_precip_mm"]
    assert p_on == pytest.approx(p_off * 300.0 / validate.power_annual_mean_mm(w), rel=1e-9)
    assert on["precip_correction"]["factor"] < 1.0 and off["precip_correction"] is None


def test_config_switch_exists_and_is_labelled():
    cfg = load_config("scenarios")["precip_correction"]
    assert {"value", "unit", "source", "type", "verified"} <= set(cfg["enabled"])
    assert cfg["enabled"]["type"] == "assumption" and cfg["enabled"]["verified"] is False


def test_precip_check_mentions_engine_factor(refs):
    w = {"karapinar": _w()}
    factors = {"karapinar": runner.precip_correction_factor("karapinar", w["karapinar"], refs)}
    c = validate.check_precip(w, refs, {}, factors)
    assert "× " in c["value"] and "engine" in c["value"]
    assert "station" in c["note"]["en"].lower()


def test_scenarios_correct_before_the_dry_step(refs, monkeypatch):
    monkeypatch.setattr(runner, "_references", lambda: refs)
    w = _w()
    out = runner.run_scenarios("karapinar", w, None, scenario_ids=["baseline", "dry20"], start_years=[2010],
                               precip_correction=True)
    base = out["baseline"]["sequences"][0]["pre_sowing_precip_mm"]
    dry = out["dry20"]["sequences"][0]["pre_sowing_precip_mm"]
    assert dry == pytest.approx(0.8 * base, rel=1e-9)        # the dry step survives the correction
    assert out["dry20"]["precip_correction"]["factor"] == pytest.approx(out["baseline"]["precip_correction"]["factor"])

"""E2: drier / warmer delta-change scenarios (PLAN_EXPANSION E2)."""

import statistics

import numpy as np
import pytest

from nobetsu import et0, runner
from tests.fixtures import load_config, synthetic_weather

IDS = ["baseline", "dry10", "dry20", "warm1", "warm2", "dry10_warm1"]


@pytest.fixture(scope="module")
def weather():
    return synthetic_weather("2000-01-01", "2026-07-31", location_id="karapinar")


@pytest.fixture(scope="module")
def scenarios():
    return {s["id"]: s for s in load_config("scenarios")["scenarios"]}


def test_scenario_ids_and_value_objects(scenarios):
    assert list(scenarios) == IDS
    for s in scenarios.values():
        for key in ("precip_factor", "temp_shift_c"):
            v = s[key]
            assert {"value", "unit", "source", "type", "verified"} <= set(v)
        assert s["label"]["en"] and s["label"]["tr"]


def test_baseline_leaves_weather_unchanged(weather, scenarios):
    w = runner.apply_scenario(weather, scenarios["baseline"])
    assert w.equals(weather)
    assert w.attrs["scenario_id"] == "baseline"


def test_dry_scales_precip_only(weather, scenarios):
    w = runner.apply_scenario(weather, scenarios["dry20"])
    assert np.allclose(w["precip_mm"], weather["precip_mm"] * 0.8)
    for col in ("tmax_c", "tmin_c", "tdew_c", "u2_ms", "rs_mj_m2"):
        assert w[col].equals(weather[col])
    assert weather["precip_mm"].sum() > w["precip_mm"].sum()   # input not modified


def test_warm_shifts_temperatures_together_and_raises_et0(weather, scenarios):
    w = runner.apply_scenario(weather, scenarios["warm2"])
    for col in ("tmax_c", "tmin_c", "tdew_c"):
        assert np.allclose(w[col], weather[col] + 2.0)
    assert w["precip_mm"].equals(weather["precip_mm"])
    assert et0.et0_from_weather(w).sum() > et0.et0_from_weather(weather).sum()
    for key in ("lat", "elevation_m", "location_id"):
        assert w.attrs[key] == weather.attrs[key]


def test_unknown_scenario_id_raises(weather):
    with pytest.raises(KeyError):
        runner.run_scenarios("karapinar", weather, None, scenario_ids=["wet50"], start_years=[2010])


@pytest.fixture(scope="module")
def runs(weather):
    return runner.run_scenarios("karapinar", weather, None, scenario_ids=["baseline", "dry20", "warm2"],
                                start_years=[2005, 2010, 2015])


def _median(out, key, rotation="fallow_wheat", depth="medium"):
    rows = [r for r in out["sequences"] if r["rotation_id"] == rotation and r["depth_id"] == depth]
    return statistics.median(key(r) for r in rows)


def test_run_scenarios_returns_engine_outputs(runs):
    assert list(runs) == ["baseline", "dry20", "warm2"]
    for out in runs.values():
        assert out["diagnostics"]["max_mass_balance_error_mm"] < 0.01
        assert len(out["sequences"]) == 3 * 3 * 3


def test_drier_and_warmer_reduce_water_and_yield(runs):
    water = lambda o: _median(o, lambda r: r["water_at_wheat_sowing_mm"])
    yield_ = lambda o: _median(o, lambda r: r["wheat"]["yield_ratio"])
    precip = lambda o: _median(o, lambda r: r["pre_sowing_precip_mm"])
    assert precip(runs["dry20"]) == pytest.approx(0.8 * precip(runs["baseline"]))
    assert water(runs["dry20"]) <= water(runs["baseline"])
    assert yield_(runs["dry20"]) <= yield_(runs["baseline"])
    assert yield_(runs["warm2"]) <= yield_(runs["baseline"])

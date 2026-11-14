"""Water balance engine tests (PLAN_MVP §5.3, ROL_A_MOTOR "Motor testleri")."""

import numpy as np
import pytest

from nobetsu import et0, rotations, waterbalance as wb
from tests.fixtures import constant_daily, load_config, synthetic_weather

EPS = 1e-9
SOIL = wb.SoilProfile(awc_mm_per_m=150.0, depth_m=0.9, ze_m=0.10, tew_mm=20.0, rew_mm=9.0)
# capacities for SOIL: slab TEW = 20 (of which 15 plant-available), rest of profile 0.8 m × 150 = 120


def _assert_bounds(out, soil):
    cap1 = soil.awc_mm_per_m * (out["z1_m"] - soil.ze_m)
    cap2 = soil.awc_mm_per_m * (soil.depth_m - out["z1_m"])
    assert (out["slab_mm"] >= -EPS).all() and (out["slab_mm"] <= soil.tew_mm + EPS).all()
    assert (out["s1_mm"] >= -EPS).all() and (out["s1_mm"] <= cap1 + 1e-6).all()
    assert (out["s2_mm"] >= -EPS).all() and (out["s2_mm"] <= cap2 + 1e-6).all()
    assert (out["aw_mm"] >= -EPS).all()
    assert (out["aw_mm"] <= soil.awc_mm_per_m * soil.depth_m + 1e-6).all()
    for col in ("e_mm", "t_mm", "dp_mm"):
        assert (out[col] >= -EPS).all()


# --- single-day hand calculations ------------------------------------------------------

def test_wet_bare_soil_evaporates_at_stage1_rate():
    # full profile, bare: Kr = 1, Kc_max = 1.2, few = 1 → E = 1.2 × ET0
    out = wb.simulate(constant_daily(1, et0_mm=5.0), SOIL, init_fraction=1.0)
    assert out["e_mm"].iloc[0] == pytest.approx(6.0)
    assert out["t_mm"].iloc[0] == 0.0
    assert out["storage_mm"].iloc[0] == pytest.approx(out.attrs["initial_storage_mm"] - 6.0)


def test_stage2_reduction_coefficient():
    # start with the slab depleted by De = 14.5 mm: Kr = (20 − 14.5) / (20 − 9) = 0.5
    out = wb.simulate(constant_daily(1, et0_mm=5.0), SOIL, init_fraction=1.0, initial_de_mm=14.5)
    assert out["de_mm"].iloc[0] == pytest.approx(14.5)
    assert bool(out["stage2"].iloc[0]) is True
    assert out["e_mm"].iloc[0] == pytest.approx(0.5 * 1.2 * 5.0)


def test_bare_soil_cumulative_evaporation_limited_by_tew():
    out = wb.simulate(constant_daily(200, et0_mm=6.0), SOIL, init_fraction=1.0)
    assert out["e_mm"].sum() <= SOIL.tew_mm + EPS
    assert out["e_mm"].sum() == pytest.approx(SOIL.tew_mm, abs=0.01)
    # water below the evaporation layer is untouched on bare soil
    assert out["s2_mm"].iloc[-1] == pytest.approx(120.0)
    assert wb.mass_balance_error(out) < 1e-9


def test_full_canopy_transpires_at_kcb_et0_without_stress():
    daily = constant_daily(1, et0_mm=5.0, kcb=1.10, zr_m=0.9, h_m=1.0, p=0.55)
    out = wb.simulate(daily, SOIL, init_fraction=1.0)
    assert out["ks"].iloc[0] == 1.0
    assert out["t_mm"].iloc[0] == pytest.approx(1.10 * 5.0)
    assert out["eta_mm"].iloc[0] == pytest.approx(out["etc_mm"].iloc[0])


def test_rain_cascade_and_deep_percolation():
    # empty profile: slab needs 20, rest needs 120 → 150 mm rain leaves 10 mm deep percolation
    daily = constant_daily(1, et0_mm=0.0, precip_mm=150.0)
    out = wb.simulate(daily, SOIL, init_fraction=0.0, initial_de_mm=SOIL.tew_mm)
    assert out["dp_mm"].iloc[0] == pytest.approx(10.0)
    assert out["aw_mm"].iloc[0] == pytest.approx(135.0)
    # small rain on a dry profile stays in the evaporation layer
    out = wb.simulate(constant_daily(1, et0_mm=0.0, precip_mm=5.0), SOIL, init_fraction=0.0, initial_de_mm=SOIL.tew_mm)
    assert out["dp_mm"].iloc[0] == 0.0
    assert out["slab_mm"].iloc[0] == pytest.approx(5.0)
    assert out["s2_mm"].iloc[0] == 0.0


def test_root_growth_moves_layer2_water_into_root_zone():
    # no fluxes; roots go 0.1 → 0.5 m on day 2: half of layer 2 (0.4 of 0.8 m) becomes root-zone water
    daily = constant_daily(2, et0_mm=0.0, zr_m=[0.10, 0.50])
    out = wb.simulate(daily, SOIL, init_fraction=1.0)
    assert out["s1_mm"].iloc[0] == pytest.approx(0.0)
    assert out["s2_mm"].iloc[0] == pytest.approx(120.0)
    assert out["s1_mm"].iloc[1] == pytest.approx(60.0)
    assert out["s2_mm"].iloc[1] == pytest.approx(60.0)
    assert out["storage_mm"].iloc[1] == pytest.approx(out["storage_mm"].iloc[0])


def test_root_zone_shrinks_after_harvest_without_losing_water():
    daily = constant_daily(2, et0_mm=0.0, zr_m=[0.90, 0.0])
    out = wb.simulate(daily, SOIL, init_fraction=0.5)
    assert out["storage_mm"].iloc[1] == pytest.approx(out["storage_mm"].iloc[0])
    assert out["s1_mm"].iloc[1] == pytest.approx(0.0)
    assert wb.mass_balance_error(out) < 1e-9


# --- stress ------------------------------------------------------------------------------

def test_ks_is_one_whenever_depletion_is_within_raw_and_below_one_otherwise():
    daily = constant_daily(120, et0_mm=6.0, kcb=1.10, zr_m=0.9, h_m=1.0, p=0.55)
    out = wb.simulate(daily, SOIL, init_fraction=1.0)
    within = out["dr_mm"] <= out["raw_mm"]
    assert (out.loc[within, "ks"] == 1.0).all()
    assert (out.loc[~within, "ks"] < 1.0).all()
    assert (~within).any(), "a 120-day drought must reach stress"
    assert (out["ks"] >= 0).all()
    assert (out["eta_mm"] <= out["etc_mm"] + EPS).all()
    _assert_bounds(out, SOIL)
    assert wb.mass_balance_error(out) < 1e-9


# --- bare soil in a wet winter -----------------------------------------------------------

def test_wet_winter_on_bare_soil_stores_water():
    n = 120
    precip = np.zeros(n)
    precip[::4] = 12.0  # 360 mm in 120 days
    daily = constant_daily(n, start="2010-11-01", et0_mm=0.8, precip_mm=precip)
    out = wb.simulate(daily, SOIL, init_fraction=0.2)
    assert out["storage_mm"].iloc[-1] - out.attrs["initial_storage_mm"] >= 0
    assert out["aw_mm"].iloc[-1] > out.attrs["initial_aw_mm"]
    _assert_bounds(out, SOIL)
    assert wb.mass_balance_error(out) < 1e-9


# --- soil profile validation -------------------------------------------------------------

def test_soil_profile_rejects_impossible_values():
    with pytest.raises(ValueError):
        wb.SoilProfile(awc_mm_per_m=150.0, depth_m=0.05, ze_m=0.10, tew_mm=20.0, rew_mm=9.0)
    with pytest.raises(ValueError):
        wb.SoilProfile(awc_mm_per_m=150.0, depth_m=0.9, ze_m=0.10, tew_mm=20.0, rew_mm=25.0)
    with pytest.raises(ValueError):
        wb.SoilProfile(awc_mm_per_m=-1.0, depth_m=0.9, ze_m=0.10, tew_mm=20.0, rew_mm=9.0)


def test_simulate_rejects_nan_inputs():
    daily = constant_daily(3)
    daily.iloc[1, daily.columns.get_loc("et0_mm")] = np.nan
    with pytest.raises(ValueError):
        wb.simulate(daily, SOIL)


# --- full sequences on synthetic weather -------------------------------------------------

@pytest.fixture(scope="module")
def weather():
    return synthetic_weather("2008-01-01", "2013-12-31")


@pytest.mark.parametrize("first_crop", ["fallow", "chickpea", "lentil"])
@pytest.mark.parametrize("depth_m", [0.6, 0.9, 1.2])
def test_full_sequence_closes_mass_balance_and_respects_bounds(weather, first_crop, depth_m):
    crops = load_config("crops")
    soil = wb.SoilProfile.from_config(load_config("soil"), awc_mm_per_m=150.0, depth_m=depth_m)
    schedule = rotations.build_schedule(2010, [first_crop, "wheat"], crops, depth_m, weather)
    out = wb.simulate(wb.daily_inputs(weather, schedule), soil)

    assert wb.mass_balance_error(out) < 0.01
    _assert_bounds(out, soil)
    assert (out["z1_m"] <= depth_m + EPS).all()
    within = out["dr_mm"] <= out["raw_mm"]
    assert (out.loc[within, "ks"] == 1.0).all()
    assert not out.isna().any().any()


def test_daily_inputs_uses_fao56_et0_and_rhmin(weather):
    crops = load_config("crops")
    schedule = rotations.build_schedule(2010, ["fallow", "wheat"], crops, 0.9, weather)
    daily = wb.daily_inputs(weather, schedule)
    assert daily.index.equals(schedule.index)
    expected = et0.et0_from_weather(weather).reindex(schedule.index)
    assert np.allclose(daily["et0_mm"], expected)
    assert ((daily["rhmin_pct"] > 0) & (daily["rhmin_pct"] <= 100)).all()


def test_daily_inputs_fails_when_weather_does_not_cover_schedule():
    crops = load_config("crops")
    short = synthetic_weather("2010-01-01", "2011-12-31")
    full = synthetic_weather("2008-01-01", "2013-12-31")
    schedule = rotations.build_schedule(2010, ["fallow", "wheat"], crops, 0.9, full)
    with pytest.raises(ValueError):
        wb.daily_inputs(short, schedule)

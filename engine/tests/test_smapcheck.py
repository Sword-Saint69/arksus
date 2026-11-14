"""E1: SMAP L4 root-zone anomaly comparison (PLAN_EXPANSION E1)."""

import numpy as np
import pandas as pd
import pytest

from nobetsu import runner, validate
from tests.fixtures import load_config, synthetic_weather


@pytest.fixture(scope="module")
def weather():
    return synthetic_weather("2012-01-01", "2026-07-31", location_id="karapinar")


@pytest.fixture(scope="module")
def landscape(weather):
    return runner.run_landscape("karapinar", weather, None, start="2013-10-01")


def _smap_from(series: pd.Series, noise=0.0, seed=0, available=True):
    """Contract-shaped smap file built from a monthly series (0–1)."""
    rng = np.random.default_rng(seed)
    vals = np.clip(series.to_numpy() + rng.normal(0, noise, len(series)), 0, 1)
    return {"schema_version": "1.0", "mock": False, "location_id": "karapinar", "available": available,
            "product": "SMAP L4 SPL4SMGP v8", "cell_km": 9, "latest": None, "monthly_climatology": [],
            "monthly_series": [{"month_start": d.date().isoformat(), "rootzone_wetness": float(v), "surface_wetness": float(v)}
                               for d, v in zip(series.index, vals)]}


def test_landscape_run_shape_and_mass_balance(landscape, weather):
    assert landscape.index[0] == pd.Timestamp("2013-10-01")
    assert landscape.index[-1] == weather.index[-1]
    assert {"aw_mm", "fullness_pct", "aw_mm_a", "aw_mm_b"} <= set(landscape.columns)
    assert landscape.attrs["max_mass_balance_error_mm"] < 0.01
    assert ((landscape["fullness_pct"] >= 0) & (landscape["fullness_pct"] <= 100)).all()
    # the two parcels are out of phase: one is in wheat while the other is fallow
    assert landscape.attrs["cycle"] == ["fallow", "wheat"]
    may = landscape.loc["2016-05-15"]
    assert may["crop_a"] != may["crop_b"]


def test_landscape_is_the_mean_of_the_two_parcels(landscape):
    assert np.allclose(landscape["aw_mm"], (landscape["aw_mm_a"] + landscape["aw_mm_b"]) / 2)


def test_monthly_anomalies_have_zero_mean_per_calendar_month():
    idx = pd.date_range("2015-01-01", periods=60, freq="MS")
    x = pd.Series(np.sin(np.arange(60) * 2 * np.pi / 12) + np.arange(60) * 0.01, index=idx)
    z = validate.monthly_anomalies(x)
    assert np.allclose(z.groupby(z.index.month).mean(), 0, atol=1e-12)


def test_spearman_matches_known_values():
    assert validate.spearman([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert validate.spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)
    assert validate.spearman([1, 2, 2, 3], [1, 2, 3, 4]) == pytest.approx(0.9486833, abs=1e-6)


def test_smap_check_high_when_smap_follows_the_model(landscape):
    model_monthly = landscape["fullness_pct"].resample("MS").mean() / 100
    smap = _smap_from(model_monthly.loc["2015-04-01":], noise=0.01)
    c = validate.check_smap_anomaly({"karapinar": landscape}, {"karapinar": smap})
    assert list(c.keys()) == ["id", "status", "value", "reference", "note"]
    assert c["id"] == "smap_anomaly" and c["status"] == "info"
    stats = validate.smap_comparison(landscape, smap)
    assert stats["spearman_anomaly"] > 0.8
    assert stats["n_months"] >= 100
    assert "Karapınar" in c["value"] and "ρ" in c["value"]


def test_smap_check_low_for_unrelated_series(landscape):
    model_monthly = landscape["fullness_pct"].resample("MS").mean() / 100
    sl = model_monthly.loc["2015-04-01":]
    shuffled = pd.Series(np.random.default_rng(1).permutation(sl.to_numpy()), index=sl.index)
    stats = validate.smap_comparison(landscape, _smap_from(shuffled))
    assert abs(stats["spearman_anomaly"]) < 0.4


def test_smap_check_pending_when_not_available(landscape):
    c = validate.check_smap_anomaly({"karapinar": landscape}, {"karapinar": {"available": False, "monthly_series": []}})
    assert c["status"] == "pending"
    c = validate.check_smap_anomaly({"karapinar": landscape}, {})
    assert c["status"] == "pending"


def test_smap_check_pending_with_too_few_overlapping_months(landscape):
    model_monthly = landscape["fullness_pct"].resample("MS").mean() / 100
    smap = _smap_from(model_monthly.loc["2015-04-01":"2016-03-01"])
    c = validate.check_smap_anomaly({"karapinar": landscape}, {"karapinar": smap})
    assert c["status"] == "pending"


def test_seasonal_timing_reports_wettest_and_driest_month(landscape):
    model_monthly = landscape["fullness_pct"].resample("MS").mean() / 100
    stats = validate.smap_comparison(landscape, _smap_from(model_monthly.loc["2015-04-01":]))
    for k in ("model_wettest_month", "model_driest_month", "smap_wettest_month", "smap_driest_month"):
        assert 1 <= stats[k] <= 12
    assert stats["model_wettest_month"] == stats["smap_wettest_month"]

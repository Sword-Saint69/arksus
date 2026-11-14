"""Soil-health and vulnerability indicator tests (PLAN_MVP §5.8, §5.10)."""

import numpy as np
import pandas as pd
import pytest

from nobetsu import indicators as ind

WINDOW_START = pd.Timestamp("2010-07-01")


def _window_index():
    return pd.date_range("2010-07-01", "2012-06-30", freq="D", name="date")


def test_monthly_counts_has_24_elements_and_month0_is_july():
    idx = _window_index()
    mask = pd.Series(True, index=idx)
    counts = ind.monthly_counts(mask, WINDOW_START)
    assert len(counts) == 24
    assert counts[0] == 31 and counts[1] == 31 and counts[2] == 30     # Jul, Aug, Sep 2010
    assert counts[19] == 29                                            # Feb 2012 (leap year)
    assert sum(counts) == len(idx)
    assert all(isinstance(c, int) for c in counts)


def test_monthly_counts_ignores_days_outside_the_window():
    idx = pd.date_range("2009-10-01", "2012-07-12", freq="D")
    counts = ind.monthly_counts(pd.Series(True, index=idx), WINDOW_START)
    assert sum(counts) == len(_window_index())


def test_wind_exposed_needs_bare_and_dry_and_windy():
    idx = pd.date_range("2010-07-01", periods=4, freq="D")
    bare = pd.Series([True, True, True, False], index=idx)
    stage2 = pd.Series([True, True, False, True], index=idx)
    u2max = pd.Series([9.0, 3.0, 9.0, 9.0], index=idx)
    mask = ind.wind_exposed_mask(bare, stage2, u2max, threshold_ms=6.0)
    assert mask.tolist() == [True, False, False, False]


def test_wind_threshold_is_the_percentile_of_the_full_record():
    w = pd.DataFrame({"u2max_ms": np.arange(1.0, 102.0)})
    assert ind.wind_threshold(w, 75) == pytest.approx(76.0)


def test_fullness_by_month_reads_month_end_and_is_percent_of_capacity():
    idx = _window_index()
    aw = pd.Series(30.0, index=idx)
    aw[pd.Timestamp("2010-07-31")] = 60.0
    full = ind.fullness_by_month(aw, capacity_mm=120.0, window_start=WINDOW_START)
    assert len(full) == 24
    assert full[0] == pytest.approx(50.0)
    assert full[1] == pytest.approx(25.0)
    assert all(0.0 <= f <= 100.0 for f in full)


def test_heat_days_counts_days_above_threshold_inside_the_window_only():
    idx = pd.date_range("2012-05-20", periods=10, freq="D")
    tmax = pd.Series([31, 29, 30, 32, 35, 20, 31, 31, 31, 31], index=idx, dtype=float)
    n = ind.heat_days(tmax, "2012-05-20", "2012-05-24", threshold_c=30.0)
    assert n == 3   # 31, 32, 35; exactly 30 does not count


def test_storage_efficiency():
    idx = pd.date_range("2010-07-10", periods=5, freq="D")
    storage = pd.Series([10.0, 12.0, 15.0, 15.0, 18.0], index=idx)
    precip = pd.Series([99.0, 10.0, 10.0, 0.0, 20.0], index=idx)
    # from the end of 10 Jul to the end of 14 Jul: ΔS = 8, P (11–14 Jul) = 40
    assert ind.storage_efficiency(storage, precip, "2010-07-10", "2010-07-14") == pytest.approx(0.2)
    assert ind.storage_efficiency(storage, precip * 0, "2010-07-10", "2010-07-14") is None


def test_season_totals():
    idx = pd.date_range("2011-10-15", periods=4, freq="D")
    out = pd.DataFrame({"eta_mm": [1.0, 2.0, 3.0, 4.0], "etc_mm": [2.0, 2.0, 4.0, 4.0], "ks": [1.0, 0.9, 0.5, 1.0]}, index=idx)
    mask = pd.Series([True, True, True, False], index=idx)
    assert ind.season_totals(out, mask) == {"eta_mm": 6.0, "etc_mm": 8.0, "stress_days": 2}

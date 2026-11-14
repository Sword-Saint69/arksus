"""Soil-health and vulnerability indicators from the daily water balance
(PLAN_MVP §5.8 and §5.10). Pure functions on pandas objects; runner.py assembles them.

Wording reminders for whoever displays these:
- the wind-exposure count is an exposure count, NOT an erosion measurement;
- fullness is % of available-water capacity (100 % = field capacity), NOT saturation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

WINDOW_MONTHS = 24


def _month_index(index: pd.DatetimeIndex, window_start: pd.Timestamp) -> np.ndarray:
    """0 for the month of window_start, 1 for the next month, …"""
    ws = pd.Timestamp(window_start)
    return (index.year - ws.year) * 12 + (index.month - ws.month)


def monthly_counts(mask: pd.Series, window_start, months: int = WINDOW_MONTHS) -> list[int]:
    """Number of True days in each month of the window; days outside it are ignored."""
    m = _month_index(mask.index, window_start)
    values = mask.to_numpy(dtype=bool)
    inside = (m >= 0) & (m < months) & (mask.index >= pd.Timestamp(window_start))
    counts = np.bincount(m[inside & values], minlength=months)[:months]
    return [int(c) for c in counts]


def wind_threshold(weather: pd.DataFrame, percentile: float) -> float:
    """The location's own percentile of daily maximum 2 m wind over the full record."""
    return float(np.percentile(weather["u2max_ms"].to_numpy(dtype=float), percentile))


def wind_exposed_mask(bare: pd.Series, stage2: pd.Series, u2max_ms: pd.Series, threshold_ms: float) -> pd.Series:
    """Bare AND surface in stage-2 drying (De > REW) AND daily max wind above the threshold."""
    return bare.astype(bool) & stage2.astype(bool) & (u2max_ms > threshold_ms)


def fullness_by_month(aw_mm: pd.Series, capacity_mm: float, window_start, months: int = WINDOW_MONTHS) -> list[float]:
    """Available water at each month end as % of the profile's available-water capacity."""
    m = _month_index(aw_mm.index, window_start)
    out = []
    for k in range(months):
        in_month = aw_mm[(m == k) & (aw_mm.index >= pd.Timestamp(window_start))]
        if len(in_month) == 0:
            raise ValueError(f"no simulated days in window month {k}")
        out.append(float(min(max(in_month.iloc[-1] / capacity_mm * 100.0, 0.0), 100.0)))
    return out


def heat_days(tmax_c: pd.Series, start, end, threshold_c: float) -> int:
    """Days with Tmax strictly above the threshold between start and end (inclusive)."""
    return int((tmax_c.loc[pd.Timestamp(start):pd.Timestamp(end)] > threshold_c).sum())


def storage_efficiency(storage_mm: pd.Series, precip_mm: pd.Series, start_day, end_day) -> float | None:
    """ΔS / P between the end of start_day and the end of end_day (None if P = 0)."""
    start_day, end_day = pd.Timestamp(start_day), pd.Timestamp(end_day)
    p = float(precip_mm.loc[start_day + pd.Timedelta(days=1):end_day].sum())
    if p <= 0:
        return None
    return float((storage_mm.loc[end_day] - storage_mm.loc[start_day]) / p)


def season_totals(out: pd.DataFrame, mask: pd.Series) -> dict:
    """ΣETa, ΣETc and the number of stress days (Ks < 1) over the masked days."""
    sel = out.loc[mask.to_numpy(dtype=bool)]
    return {
        "eta_mm": float(sel["eta_mm"].sum()),
        "etc_mm": float(sel["etc_mm"].sum()),
        "stress_days": int((sel["ks"] < 1.0).sum()),
    }

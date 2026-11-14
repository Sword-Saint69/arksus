"""power.py: parsing rules (synthetic) + cached real data (ARAYUZLER §2). Owner: Gümüş."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nobetsu import config, power

UNITS = {"PRECTOTCORR": "mm/day", "T2M_MAX": "C", "T2M_MIN": "C", "T2MDEW": "C", "RH2M": "%",
         "WS2M": "m/s", "WS2M_MAX": "m/s", "ALLSKY_SFC_SW_DWN": "MJ/m^2/day"}


def fake_raw(n_days=20, gaps=(), trailing_missing=0, units=None, fill=-999.0):
    dates = pd.date_range("2000-01-01", periods=n_days, freq="D").strftime("%Y%m%d")
    params = {}
    for i, p in enumerate(UNITS):
        vals = {d: float(i + k) for k, d in enumerate(dates)}
        for g in gaps:
            vals[dates[g]] = fill
        for k in range(trailing_missing):
            vals[dates[n_days - 1 - k]] = fill
        params[p] = vals
    return {
        "geometry": {"coordinates": [33.48, 37.72, 1001.5]},
        "header": {"fill_value": fill, "start": dates[0], "end": dates[-1]},
        "parameters": {p: {"units": u} for p, u in (units or UNITS).items()},
        "properties": {"parameter": params},
    }


def test_columns_index_and_attrs():
    df = power.parse(fake_raw(), "karapinar")
    assert list(df.columns) == list(power.COLUMNS)
    assert df.index.name == "date" and isinstance(df.index, pd.DatetimeIndex)
    assert df.index.to_series().diff().dropna().eq(pd.Timedelta(days=1)).all()
    a = df.attrs
    assert a["location_id"] == "karapinar" and a["elevation_m"] == 1001.5
    assert (a["lat"], a["lon"]) == (37.72, 33.48)
    assert a["first_date"] == "2000-01-01" and a["last_date"] == "2000-01-20"
    assert a["gaps_filled"] == 0 and a["source"] == power.SOURCE


def test_short_gaps_are_interpolated_and_counted():
    df = power.parse(fake_raw(gaps=(5, 6, 7, 12)), "karapinar")
    assert not df.isna().any().any()
    assert df["precip_mm"].iloc[6] == pytest.approx(6.0)  # linear between day 4 (4.0) and day 8 (8.0)
    assert df.attrs["gaps_filled"] == 4


def test_long_gap_raises():
    with pytest.raises(ValueError, match="gap"):
        power.parse(fake_raw(gaps=(5, 6, 7, 8)), "karapinar")


def test_trailing_missing_days_are_trimmed():
    df = power.parse(fake_raw(trailing_missing=3), "karapinar")
    assert df.attrs["last_date"] == "2000-01-17"
    assert len(df) == 17


def test_radiation_kwh_is_converted_to_mj():
    units = {**UNITS, "ALLSKY_SFC_SW_DWN": "kW-hr/m^2/day"}
    df = power.parse(fake_raw(units=units), "karapinar")
    assert df["rs_mj_m2"].iloc[0] == pytest.approx(7 * 3.6)


def test_unknown_unit_raises():
    with pytest.raises(ValueError, match="unit"):
        power.parse(fake_raw(units={**UNITS, "T2M_MAX": "K"}), "karapinar")


@pytest.mark.parametrize("loc", config.location_ids())
def test_cached_power_data(loc):
    if not power.cache_path(loc).exists():
        pytest.skip(f"no cache for {loc}: run python -m nobetsu.power")
    df = power.load_weather(loc)
    assert list(df.columns) == list(power.COLUMNS)
    assert df.index[0] == pd.Timestamp("2000-01-01")
    assert df.index[-1] >= pd.Timestamp("2026-01-01")
    assert not df.isna().any().any()
    assert df["tmax_c"].between(-40, 50).all() and (df["tmax_c"] >= df["tmin_c"] - 1e-6).all()
    assert df["precip_mm"].ge(0).all() and df["rh_pct"].between(0, 100).all()
    assert df["rs_mj_m2"].between(0, 40).all() and df["u2max_ms"].ge(df["u2_ms"] - 1e-6).mean() > 0.99
    assert 100 < df["precip_mm"].resample("YE").sum().iloc[:-1].mean() < 800

"""Synthetic weather for engine tests (ARAYUZLER §2 column names and attrs).

These numbers are NOT data. They are smooth seasonal curves shaped loosely like a
semi-arid mid-latitude climate so the engine can be tested before the NASA POWER cache
exists. Never use them for results.
"""

import numpy as np
import pandas as pd

WEATHER_COLUMNS = [
    "precip_mm", "tmax_c", "tmin_c", "tdew_c", "rh_pct", "u2_ms", "u2max_ms", "rs_mj_m2",
]


def synthetic_weather(
    start: str = "2000-01-01",
    end: str = "2026-07-31",
    *,
    lat: float = 37.7,
    lon: float = 33.5,
    elevation_m: float = 1000.0,
    location_id: str = "synthetic",
    annual_precip_mm: float = 300.0,
    seed: int = 0,
) -> pd.DataFrame:
    """Daily synthetic weather with the exact columns and attrs of power.load_weather()."""
    idx = pd.date_range(start, end, freq="D", name="date")
    n = len(idx)
    rng = np.random.default_rng(seed)
    doy = idx.day_of_year.to_numpy()
    # phase: coldest around mid-January, warmest around mid-July
    season = -np.cos(2 * np.pi * (doy - 15) / 365.25)  # -1 winter … +1 summer

    tmax = 17.0 + 15.0 * season + rng.normal(0, 2.0, n)
    tmin = tmax - (11.0 + 3.0 * season)
    tdew = np.minimum(tmin - 1.0, 2.0 - 4.0 * season + rng.normal(0, 1.5, n))
    tmean = (tmax + tmin) / 2
    es = 0.6108 * np.exp(17.27 * tmean / (tmean + 237.3))
    ea = 0.6108 * np.exp(17.27 * tdew / (tdew + 237.3))
    rh = np.clip(100 * ea / es, 5, 100)
    u2 = np.clip(2.5 + 0.5 * season + rng.normal(0, 0.6, n), 0.3, None)
    u2max = u2 * 2.0 + np.abs(rng.normal(0, 0.8, n))
    rs = np.clip(17.0 + 10.0 * season + rng.normal(0, 2.0, n), 2.0, None)

    # wet winters, dry summers; rain on ~25 % of days
    wet_weight = 1.0 - 0.85 * (season + 1) / 2
    rain_day = rng.random(n) < 0.25
    amount = rng.exponential(1.0, n) * wet_weight * rain_day
    precip = amount / amount.sum() * annual_precip_mm * (n / 365.25) if amount.sum() > 0 else amount

    df = pd.DataFrame(
        {
            "precip_mm": precip,
            "tmax_c": tmax,
            "tmin_c": tmin,
            "tdew_c": tdew,
            "rh_pct": rh,
            "u2_ms": u2,
            "u2max_ms": u2max,
            "rs_mj_m2": rs,
        },
        index=idx,
    )[WEATHER_COLUMNS]
    df.attrs.update(
        location_id=location_id,
        lat=lat,
        lon=lon,
        elevation_m=elevation_m,
        first_date=idx[0].date().isoformat(),
        last_date=idx[-1].date().isoformat(),
        gaps_filled=0,
        source="synthetic test weather (not data)",
    )
    return df


def load_config(name: str) -> dict:
    """Read engine/config/{name}.yaml as a plain dict (same result as nobetsu.config.load)."""
    from pathlib import Path

    import yaml

    path = Path(__file__).resolve().parents[1] / "config" / f"{name}.yaml"
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def constant_daily(n: int, *, start: str = "2010-01-01", **overrides) -> pd.DataFrame:
    """Constant daily engine inputs (waterbalance.simulate format); override any column."""
    base = {
        "precip_mm": 0.0, "et0_mm": 5.0, "u2_ms": 2.0, "rhmin_pct": 45.0,
        "kcb": 0.0, "zr_m": 0.0, "h_m": 0.0, "p": 0.5,
    }
    base.update(overrides)
    idx = pd.date_range(start, periods=n, freq="D", name="date")
    return pd.DataFrame({k: np.broadcast_to(np.asarray(v, dtype=float), (n,)).copy() for k, v in base.items()}, index=idx)

"""NASA POWER daily weather (ARAYUZLER §2, PLAN_MVP §5.1). Owner: Gümüş.

    python -m nobetsu.power            # fetch and cache every location that has no cache yet
    python -m nobetsu.power --refresh  # re-download (overwrites data/raw/power_*.json)
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from . import config

API_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
START = "20000101"
SOURCE = "NASA POWER daily, community=AG"
MAX_GAP_DAYS = 3

# Contract column names (ARAYUZLER §2) -> POWER parameter
COLUMNS = {
    "precip_mm": "PRECTOTCORR",
    "tmax_c": "T2M_MAX",
    "tmin_c": "T2M_MIN",
    "tdew_c": "T2MDEW",
    "rh_pct": "RH2M",
    "u2_ms": "WS2M",
    "u2max_ms": "WS2M_MAX",
    "rs_mj_m2": "ALLSKY_SFC_SW_DWN",
}

# Accepted header units per parameter -> multiplier to the contract unit.
_UNITS = {
    "PRECTOTCORR": {"mm/day": 1.0, "mm day-1": 1.0},
    "T2M_MAX": {"c": 1.0, "°c": 1.0, "degc": 1.0},
    "T2M_MIN": {"c": 1.0, "°c": 1.0, "degc": 1.0},
    "T2MDEW": {"c": 1.0, "°c": 1.0, "degc": 1.0},
    "RH2M": {"%": 1.0},
    "WS2M": {"m/s": 1.0, "m s-1": 1.0},
    "WS2M_MAX": {"m/s": 1.0, "m s-1": 1.0},
    "ALLSKY_SFC_SW_DWN": {"mj/m^2/day": 1.0, "mj/m2/day": 1.0, "kw-hr/m^2/day": 3.6, "kwh/m^2/day": 3.6},
}


def cache_path(location_id: str) -> Path:
    return config.DATA_DIR / "raw" / f"power_{location_id}.json"


def _location(location_id: str) -> dict:
    for loc in config.load("locations")["locations"]:
        if loc["id"] == location_id:
            return loc
    raise KeyError(f"unknown location_id: {location_id}")


def fetch(location_id: str, end: date | None = None, retries: int = 3) -> dict:
    """One request for 2000-01-01 → end (default: yesterday). Returns the raw POWER JSON."""
    loc = _location(location_id)
    end = end or (date.today() - timedelta(days=1))
    params = {
        "parameters": ",".join(COLUMNS.values()),
        "community": "AG",
        "longitude": loc["lon"],
        "latitude": loc["lat"],
        "start": START,
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "LST",
    }
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            r = requests.get(API_URL, params=params, timeout=180)
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            last_err = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"NASA POWER request failed for {location_id}: {last_err}")


def _factor(param: str, unit: str) -> float:
    key = unit.strip().lower().replace(" ", "") if "/" in unit else unit.strip().lower()
    accepted = {k.replace(" ", "") if "/" in k else k: v for k, v in _UNITS[param].items()}
    if key not in accepted:
        raise ValueError(f"unexpected unit for {param}: {unit!r} (expected one of {list(_UNITS[param])})")
    return accepted[key]


def _fill_short_gaps(s: pd.Series) -> tuple[pd.Series, int]:
    """Linear fill of interior NaN runs of length ≤ MAX_GAP_DAYS; raise if a longer run remains."""
    na = s.isna()
    if not na.any():
        return s, 0
    run_id = (na != na.shift()).cumsum()
    run_len = na.groupby(run_id).transform("sum")
    interp = s.interpolate(method="linear", limit_area="inside")
    fillable = na & (run_len <= MAX_GAP_DAYS) & interp.notna()
    out = s.where(~fillable, interp)
    if out.isna().any():
        first = out[out.isna()].index[0].date()
        raise ValueError(f"{s.name}: gap longer than {MAX_GAP_DAYS} days (or at start) near {first}")
    return out, int(fillable.sum())


def parse(raw: dict, location_id: str) -> pd.DataFrame:
    """Raw POWER JSON -> contract DataFrame (ARAYUZLER §2)."""
    fill = raw.get("header", {}).get("fill_value", -999.0)
    series = {}
    for col, param in COLUMNS.items():
        unit = raw["parameters"][param]["units"]
        s = pd.Series(raw["properties"]["parameter"][param], dtype="float64")
        s.index = pd.to_datetime(s.index, format="%Y%m%d")
        s = s.mask(np.isclose(s, fill) | (s <= -998)) * _factor(param, unit)
        series[col] = s
    df = pd.DataFrame(series).sort_index()
    df = df.reindex(pd.date_range(df.index[0], df.index[-1], freq="D"))

    # Most recent days are often not yet processed: cut back to the last complete day.
    complete = df.notna().all(axis=1)
    if not complete.any():
        raise ValueError(f"{location_id}: no complete day in POWER response")
    df = df.loc[: complete[complete].index[-1]]

    gap_days = df.isna().any(axis=1)
    for col in df.columns:
        df[col], _ = _fill_short_gaps(df[col].rename(col))
    filled = int(gap_days.sum())  # days on which at least one variable was filled
    df.index.name = "date"

    lon, lat, elev = raw["geometry"]["coordinates"][:3]
    df.attrs = {
        "location_id": location_id,
        "lat": float(lat),
        "lon": float(lon),
        "elevation_m": float(elev),
        "first_date": df.index[0].date().isoformat(),
        "last_date": df.index[-1].date().isoformat(),
        "gaps_filled": filled,
        "source": SOURCE,
    }
    return df


def load_weather(location_id: str) -> pd.DataFrame:
    """Daily, gap-free DataFrame for the location. Calls the API only if the cache is missing."""
    path = cache_path(location_id)
    if not path.exists():
        save_cache(location_id, fetch(location_id))
    with path.open(encoding="utf-8") as f:
        return parse(json.load(f), location_id)


def save_cache(location_id: str, raw: dict) -> Path:
    path = cache_path(location_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(raw, f, separators=(",", ":"))
    return path


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--refresh", action="store_true")
    a = p.parse_args()
    for loc in config.location_ids():
        if a.refresh or not cache_path(loc).exists():
            save_cache(loc, fetch(loc))
        df = load_weather(loc)
        at = df.attrs
        print(f"{loc}: {at['first_date']} .. {at['last_date']}, {len(df)} days, "
              f"elev {at['elevation_m']} m, gaps filled {at['gaps_filled']}")


if __name__ == "__main__":
    main()

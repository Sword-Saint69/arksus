"""NASA SMAP L4 (SPL4SMGP.008) from an AppEEARS point-sample CSV -> data/smap/{location_id}.json. Owner: Gümüş.

    python -m nobetsu.smap path/to/<request>-SPL4SMGP-008-results.csv

The output file holds the smap/{loc}.json fields of the contract (PLAN_MVP §4.3b, ARAYUZLER §8);
export.write_all and build (E1 check) read it. Without it, smap/{loc}.json stays `available: false`.

- AppEEARS returns one row per point and time step (3-hourly for SMAP L4); layer columns are named
  `<PRODUCT>_<VERSION>_<LAYER>`, e.g. `SPL4SMGP_008_Geophysical_Data_sm_rootzone_wetness`.
- Daily means -> monthly means (months with < 20 days of data are dropped).
- monthly_climatology: P10 / P50 / P90 of the monthly mean root-zone wetness for each calendar month.
- latest: last day with data; `percentile_for_month` = SMAP's own root-zone percentile layer when present
  (sm_rootzone_pctl), else the rank of that day among all days of the same calendar month.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import config

PRODUCT = "SMAP L4 SPL4SMGP v8"
CELL_KM = 9
FILL_MAX = -9000          # AppEEARS / SMAP fill values are -9999 or similar
MIN_DAYS_PER_MONTH = 20
LAYERS = {                # contract name -> AppEEARS layer suffix
    "rootzone_m3m3": "Geophysical_Data_sm_rootzone",
    "rootzone_wetness": "Geophysical_Data_sm_rootzone_wetness",
    "surface_wetness": "Geophysical_Data_sm_surface_wetness",
    "rootzone_pctl": "Geophysical_Data_sm_rootzone_pctl",
}


def _layer_column(columns: list[str], suffix: str) -> str | None:
    """Exact suffix match, so `sm_rootzone` does not pick `sm_rootzone_wetness`."""
    hits = [c for c in columns if c.endswith("_" + suffix) or c == suffix]
    return hits[0] if hits else None


def read_appeears_csv(path: str | Path) -> pd.DataFrame:
    """Long table: id, date (daily), rootzone_m3m3, rootzone_wetness, surface_wetness[, rootzone_pctl]."""
    raw = pd.read_csv(path)
    id_col = next(c for c in raw.columns if c.lower() == "id")
    date_col = next(c for c in raw.columns if c.lower() == "date")
    df = pd.DataFrame({"id": raw[id_col].astype(str).str.strip(),
                       "time": pd.to_datetime(raw[date_col], utc=False, errors="coerce")})
    for name, suffix in LAYERS.items():
        col = _layer_column(list(raw.columns), suffix)
        if col is None:
            if name == "rootzone_pctl":
                continue
            raise ValueError(f"layer {suffix} not found in {path}")
        v = pd.to_numeric(raw[col], errors="coerce")
        df[name] = v.where(v > FILL_MAX)
    df = df.dropna(subset=["time"])
    df["date"] = df["time"].dt.tz_localize(None).dt.normalize() if df["time"].dt.tz is not None else df["time"].dt.normalize()
    value_cols = [c for c in LAYERS if c in df.columns]
    return df.groupby(["id", "date"], as_index=False)[value_cols].mean()


def summarize_location(daily: pd.DataFrame) -> dict:
    """Contract fields for one location from its daily table."""
    d = daily.sort_values("date").set_index("date")
    d = d.dropna(subset=["rootzone_wetness"])
    if d.empty:
        return {"available": False}
    counts = d["rootzone_wetness"].resample("MS").count()
    monthly = d.resample("MS").mean(numeric_only=True)[counts >= MIN_DAYS_PER_MONTH]
    clim = []
    for m in range(1, 13):
        vals = monthly.loc[monthly.index.month == m, "rootzone_wetness"].dropna().to_numpy()
        if len(vals):
            clim.append({"month": m,
                         "p10": round(float(np.percentile(vals, 10)), 3),
                         "p50": round(float(np.percentile(vals, 50)), 3),
                         "p90": round(float(np.percentile(vals, 90)), 3)})
    series = [{"month_start": ts.date().isoformat(),
               "rootzone_wetness": round(float(r["rootzone_wetness"]), 3),
               "surface_wetness": round(float(r["surface_wetness"]), 3)}
              for ts, r in monthly.iterrows() if pd.notna(r["rootzone_wetness"]) and pd.notna(r["surface_wetness"])]
    last_day = d.index.max()
    last = d.loc[last_day]
    if "rootzone_pctl" in d.columns and pd.notna(last.get("rootzone_pctl")):
        pct = float(last["rootzone_pctl"])
    else:
        same = d.loc[d.index.month == last_day.month, "rootzone_wetness"].to_numpy()
        pct = 100.0 * float((same <= last["rootzone_wetness"]).mean())
    return {
        "available": True,
        "product": PRODUCT,
        "cell_km": CELL_KM,
        "latest": {"date": last_day.date().isoformat(),
                   "rootzone_wetness": round(float(last["rootzone_wetness"]), 3),
                   "rootzone_m3m3": round(float(last["rootzone_m3m3"]), 3),
                   "percentile_for_month": round(min(100.0, max(0.0, pct)), 1)},
        "monthly_climatology": clim,
        "monthly_series": series,
    }


def build_all(csv_path: str | Path, out_dir: Path | None = None) -> dict[str, dict]:
    out_dir = out_dir or (config.DATA_DIR / "smap")
    daily = read_appeears_csv(csv_path)
    known = set(config.location_ids())
    written = {}
    for loc, part in daily.groupby("id"):
        if loc not in known:
            continue
        rec = summarize_location(part)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{loc}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        written[loc] = rec
    return written


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("csv", help="AppEEARS point-sample results CSV for SPL4SMGP.008")
    a = p.parse_args()
    res = build_all(a.csv)
    for loc, rec in res.items():
        if rec.get("available"):
            print(f"{loc}: {len(rec['monthly_series'])} months, latest {rec['latest']['date']} "
                  f"wetness {rec['latest']['rootzone_wetness']} (p{rec['latest']['percentile_for_month']:.0f})")
        else:
            print(f"{loc}: no usable data")
    missing = sorted(set(config.location_ids()) - set(res))
    if missing:
        print("not in CSV:", ", ".join(missing))


if __name__ == "__main__":
    main()

"""Daily crop calendars for one two-year sequence (PLAN_MVP §5.3 "Sequence design").

For start year y and a rotation [first, main] (e.g. ["fallow", "wheat"]):
  1. spin-up: the main crop is grown from its sowing date in y−1 to its harvest in y;
     the simulation starts on 1 Oct y−1 (or at that sowing, if earlier);
  2. year 1: the first entry. An entry with a `sowing` key is a crop (bare → crop → bare);
     an entry without one keeps the land bare for the whole period;
  3. the main crop again, sown in y+1 and harvested in y+2.
The schedule runs until the main harvest or 30 June y+2 (end of the 24-month reporting
window that starts on 1 July y), whichever is later.

There are no crop-specific branches: everything comes from engine/config/crops.yaml.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from nobetsu import et0 as et0_mod
from nobetsu.waterbalance import climate_adjustment

STAGES = ("ini", "dev", "mid", "late")
SIM_START_MONTH_DAY = (10, 1)     # 1 Oct y−1
WINDOW_START_MONTH_DAY = (7, 1)   # month 0 of the contract = July y
WINDOW_MONTHS = 24
KCB_ADJUST_MIN = 0.45             # Eq. 70 applies to Kcb values of at least 0.45
BARE_LABEL = "bare"


def _v(node):
    return node["value"]


def _sowing_date(crop_cfg: dict, year: int) -> pd.Timestamp:
    month, day = (int(x) for x in str(_v(crop_cfg["sowing"])).split("-"))
    return pd.Timestamp(year=year, month=month, day=day)


def season_length(crop_cfg: dict) -> int:
    return int(sum(int(_v(crop_cfg["stage_days"][s])) for s in STAGES))


def _stage_climate_adjustment(weather: pd.DataFrame, days: pd.DatetimeIndex, h_max: float) -> float:
    w = weather.reindex(days)
    if len(days) == 0:
        return 0.0
    if w[["u2_ms", "tdew_c", "tmax_c"]].isna().any().any():
        raise ValueError(f"weather does not cover the crop stage {days[0].date()} → {days[-1].date()}")
    rhmin = 100.0 * et0_mod.sat_vapour_pressure(w["tdew_c"]) / et0_mod.sat_vapour_pressure(w["tmax_c"])
    return float(climate_adjustment(w["u2_ms"].mean(), np.clip(rhmin, 0, 100).mean(), h_max))


def season_curve(crop_cfg: dict, sowing: pd.Timestamp, depth_m: float, weather: pd.DataFrame) -> pd.DataFrame:
    """Daily kcb, zr_m, h_m, p and stage from sowing to the last day before harvest.

    Kcb: FAO-56 four-stage curve; Kcb_mid and Kcb_end get the Eq. 70 climate adjustment
    from the mean wind and RHmin of their own stage. Roots and height grow linearly from
    sowing to the start of mid-season; roots stop at min(Zr_max, depth class).
    """
    l_ini, l_dev, l_mid, l_late = (int(_v(crop_cfg["stage_days"][s])) for s in STAGES)
    n = l_ini + l_dev + l_mid + l_late
    idx = pd.date_range(sowing, periods=n, freq="D", name="date")
    d = np.arange(n)
    mid_start, late_start = l_ini + l_dev, l_ini + l_dev + l_mid

    h_max = float(_v(crop_cfg["h_max_m"]))
    kcb_ini = float(_v(crop_cfg["kcb_ini"]))
    kcb_mid = float(_v(crop_cfg["kcb_mid"]))
    kcb_end = float(_v(crop_cfg["kcb_end"]))
    if kcb_mid >= KCB_ADJUST_MIN:
        kcb_mid += _stage_climate_adjustment(weather, idx[mid_start:late_start], h_max)
    if kcb_end >= KCB_ADJUST_MIN:
        kcb_end += _stage_climate_adjustment(weather, idx[late_start:], h_max)

    kcb = np.full(n, kcb_ini)
    dev = (d >= l_ini) & (d < mid_start)
    kcb[dev] = kcb_ini + (kcb_mid - kcb_ini) * (d[dev] - l_ini) / max(l_dev, 1)
    kcb[(d >= mid_start) & (d < late_start)] = kcb_mid
    late = d >= late_start
    kcb[late] = kcb_mid + (kcb_end - kcb_mid) * (d[late] - late_start) / max(l_late, 1)

    growth = np.minimum(d / max(mid_start, 1), 1.0)
    zr_top = min(float(_v(crop_cfg["zr_max_m"])), depth_m)
    zr_min = min(float(_v(crop_cfg["zr_min_m"])), zr_top)

    stage = np.empty(n, dtype=object)
    stage[d < l_ini] = "ini"
    stage[dev] = "dev"
    stage[(d >= mid_start) & (d < late_start)] = "mid"
    stage[late] = "late"

    return pd.DataFrame(
        {
            "kcb": kcb,
            "zr_m": zr_min + (zr_top - zr_min) * growth,
            "h_m": h_max * growth,
            "p": float(_v(crop_cfg["p"])),
            "stage": stage,
        },
        index=idx,
    )


def build_schedule(start_year: int, crop_ids: list[str], crops_cfg: dict, depth_m: float,
                   weather: pd.DataFrame) -> pd.DataFrame:
    """Daily schedule for one sequence.

    Columns: kcb, zr_m, h_m, p, crop (ledger label), phase ("spinup" | "first" | "main" |
    "bare"), stage ("ini" | "dev" | "mid" | "late" | ""), is_crop.
    attrs: start_year, window_start, window_end, spinup_sowing, spinup_harvest,
    first_crop_id, first_crop_sowing, first_crop_harvest, main_crop_id, main_sowing,
    main_harvest (ISO dates; "harvest" = last day the crop is on the field).
    """
    if len(crop_ids) != 2:
        raise ValueError("a rotation is [first, main]")
    first_id, main_id = crop_ids
    first_cfg, main_cfg = crops_cfg[first_id] or {}, crops_cfg[main_id]
    if "sowing" not in main_cfg:
        raise ValueError(f"main crop '{main_id}' needs a sowing date")
    y = int(start_year)

    seasons = []  # (phase, crop_id, cfg, sowing)
    spin_sow = _sowing_date(main_cfg, y - 1)
    main_sow = _sowing_date(main_cfg, y + 1)
    spin_end = spin_sow + pd.Timedelta(days=season_length(main_cfg) - 1)
    main_end = main_sow + pd.Timedelta(days=season_length(main_cfg) - 1)
    seasons.append(("spinup", main_id, main_cfg, spin_sow))

    first_sow = first_end = None
    if "sowing" in first_cfg:
        first_sow = _sowing_date(first_cfg, y + 1)
        if first_sow >= main_sow:
            first_sow = _sowing_date(first_cfg, y)
        first_end = first_sow + pd.Timedelta(days=season_length(first_cfg) - 1)
        if first_sow <= spin_end or first_end >= main_sow:
            raise ValueError(
                f"'{first_id}' season {first_sow.date()} → {first_end.date()} does not fit between "
                f"the {main_id} harvest ({spin_end.date()}) and sowing ({main_sow.date()})"
            )
        seasons.append(("first", first_id, first_cfg, first_sow))
    seasons.append(("main", main_id, main_cfg, main_sow))

    window_start = pd.Timestamp(year=y, month=WINDOW_START_MONTH_DAY[0], day=WINDOW_START_MONTH_DAY[1])
    window_end = window_start + pd.DateOffset(months=WINDOW_MONTHS) - pd.Timedelta(days=1)
    sim_start = min(pd.Timestamp(year=y - 1, month=SIM_START_MONTH_DAY[0], day=SIM_START_MONTH_DAY[1]), spin_sow)
    idx = pd.date_range(sim_start, max(main_end, window_end), freq="D", name="date")

    bare_label = BARE_LABEL if "sowing" in first_cfg else first_id
    s = pd.DataFrame(
        {"kcb": 0.0, "zr_m": 0.0, "h_m": 0.0, "p": 0.0, "crop": bare_label, "phase": "bare", "stage": "",
         "is_crop": False},
        index=idx,
    )
    for phase, crop_id, cfg, sowing in seasons:
        curve = season_curve(cfg, sowing, depth_m, weather)
        for col in ("kcb", "zr_m", "h_m", "p", "stage"):
            s.loc[curve.index, col] = curve[col]
        s.loc[curve.index, ["crop", "phase", "is_crop"]] = [crop_id, phase, True]

    iso = lambda t: None if t is None else t.date().isoformat()  # noqa: E731
    s.attrs.update(
        start_year=y, window_start=iso(window_start), window_end=iso(window_end),
        spinup_sowing=iso(spin_sow), spinup_harvest=iso(spin_end),
        first_crop_id=first_id, first_crop_sowing=iso(first_sow), first_crop_harvest=iso(first_end),
        main_crop_id=main_id, main_sowing=iso(main_sow), main_harvest=iso(main_end),
    )
    return s

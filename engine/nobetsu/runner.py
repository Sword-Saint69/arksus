"""Run every rotation × depth class × start year for one location (ARAYUZLER §5).

run_location() returns the EngineOutput dict: physics and ratios only, raw floats/ints,
no rounding (export.py rounds), no money.
"""

from __future__ import annotations

import warnings
from collections import Counter
from pathlib import Path

import pandas as pd
import yaml

from nobetsu import indicators as ind
from nobetsu import rotations, waterbalance as wb
from nobetsu.yieldmodel import yield_ratio

START_YEARS = tuple(range(2001, 2025))   # contract: site_index.start_years = [2001, 2024]
LEDGER_WEEKS = 104                       # full 7-day blocks inside the 24-month window
# Used only while Gümüş's config files do not exist yet. Ids are frozen in ARAYUZLER §4.
_FALLBACK_ROTATIONS = (
    {"id": "fallow_wheat", "crops": ["fallow", "wheat"]},
    {"id": "chickpea_wheat", "crops": ["chickpea", "wheat"]},
    {"id": "lentil_wheat", "crops": ["lentil", "wheat"]},
)
_PLAN_SEED_HEAT_THRESHOLD_C = 30.0       # PLAN_MVP §5.8 seed ("literature value, VERIFY")
_CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


def _load_config(name: str) -> dict | list | None:
    """nobetsu.config.load(name) when it exists, else the YAML file, else None."""
    try:
        from nobetsu import config  # Gümüş's module
        return config.load(name)
    except (ImportError, AttributeError, FileNotFoundError):
        path = _CONFIG_DIR / f"{name}.yaml"
        if not path.exists():
            return None
        with open(path, encoding="utf-8") as f:
            return yaml.safe_load(f)


def _rotation_list() -> list[dict]:
    cfg = _load_config("rotations")
    if cfg is None:
        warnings.warn("rotations.yaml not found; using the three contract rotation ids", stacklevel=2)
        return [dict(r) for r in _FALLBACK_ROTATIONS]
    items = cfg["rotations"] if isinstance(cfg, dict) and "rotations" in cfg else cfg
    if isinstance(items, dict):
        items = [{"id": k, **v} for k, v in items.items()]
    return [{"id": r["id"], "crops": list(r["crops"])} for r in items]


def _heat_threshold_c() -> float:
    refs = _load_config("references") or {}
    node = refs.get("heat_threshold_flowering_c") if isinstance(refs, dict) else None
    if isinstance(node, dict) and node.get("value") is not None:
        return float(node["value"])
    warnings.warn(
        "references.yaml has no heat_threshold_flowering_c; using the PLAN_MVP §5.8 seed of 30 °C (unverified)",
        stacklevel=2,
    )
    return _PLAN_SEED_HEAT_THRESHOLD_C


def _awc_used(location_id: str, soilgrids: dict | None, soil_cfg: dict) -> dict:
    node = (soilgrids or {}).get("awc_mm_per_m")
    if isinstance(node, dict) and node.get("value"):
        return {
            "value": float(node["value"]),
            "unit": node.get("unit", "mm/m"),
            "source": node.get("source", "SoilGrids 2.0"),
            "type": node.get("type", "model"),
            "verified": bool(node.get("verified", False)),
        }
    fb = soil_cfg["fallback_awc_mm_per_m"][location_id]   # KeyError for an unknown location
    return {"value": float(fb["value"]), "unit": fb["unit"], "source": fb["source"],
            "type": "assumption", "verified": False}


def _ledger_weeks(out: pd.DataFrame, labels: pd.Series, window_start: pd.Timestamp) -> list[dict]:
    weeks = []
    for k in range(LEDGER_WEEKS):
        a = window_start + pd.Timedelta(days=7 * k)
        b = a + pd.Timedelta(days=6)
        chunk = out.loc[a:b]
        if len(chunk) != 7:
            raise ValueError(f"simulation does not cover ledger week {a.date()}")
        weeks.append({
            "week_start": a.date().isoformat(),
            "p_mm": float(chunk["precip_mm"].sum()),
            "eta_mm": float(chunk["eta_mm"].sum()),
            "dp_mm": float(chunk["dp_mm"].sum()),
            "aw_mm": float(chunk["aw_mm"].iloc[-1]),
            "crop": Counter(labels.loc[a:b]).most_common(1)[0][0],
        })
    return weeks


def run_sequence(weather: pd.DataFrame, start_year: int, rotation: dict, depth: dict, *,
                 crops_cfg: dict, soil_cfg: dict, awc_mm_per_m: float,
                 wind_threshold_ms: float, heat_threshold_c: float) -> tuple[dict, dict, float]:
    """One sequence → (sequences row, ledger series, mass-balance error in mm)."""
    first_id, main_id = rotation["crops"]
    soil = wb.SoilProfile.from_config(soil_cfg, awc_mm_per_m=awc_mm_per_m, depth_m=depth["depth_m"])
    sched = rotations.build_schedule(start_year, rotation["crops"], crops_cfg, depth["depth_m"], weather)
    out = wb.simulate(wb.daily_inputs(weather, sched), soil,
                      init_fraction=float(soil_cfg["initial_fill_fraction"]["value"]))
    a = sched.attrs
    window_start, window_end = pd.Timestamp(a["window_start"]), pd.Timestamp(a["window_end"])
    main_sowing = pd.Timestamp(a["main_sowing"])
    day_before_sowing = main_sowing - pd.Timedelta(days=1)
    in_window = (sched.index >= window_start) & (sched.index <= window_end)

    bare = ~sched["is_crop"] & in_window
    exposed = ind.wind_exposed_mask(bare, out["stage2"], weather["u2max_ms"].reindex(sched.index), wind_threshold_ms)
    stress = sched["is_crop"] & (out["ks"] < 1.0) & in_window

    main_totals = ind.season_totals(out, sched["phase"] == "main")
    if a["main_flowering_start"] is None:
        raise ValueError(f"crops.yaml: '{main_id}' needs a flowering window for heat_days_flowering")
    main_block = {
        "eta_mm": main_totals["eta_mm"],
        "etc_mm": main_totals["etc_mm"],
        "stress_days": main_totals["stress_days"],
        "heat_days_flowering": ind.heat_days(weather["tmax_c"], a["main_flowering_start"],
                                             a["main_flowering_end"], heat_threshold_c),
        "yield_ratio": yield_ratio(main_totals["eta_mm"], main_totals["etc_mm"], float(crops_cfg[main_id]["ky"]["value"])),
    }

    if a["first_crop_sowing"] is None:
        first_block = None
        efficiency = ind.storage_efficiency(out["storage_mm"], out["precip_mm"], a["spinup_harvest"], day_before_sowing)
        if efficiency is None:
            efficiency = 0.0
    else:
        t = ind.season_totals(out, sched["phase"] == "first")
        first_block = {
            "crop_id": first_id,
            "eta_mm": t["eta_mm"],
            "etc_mm": t["etc_mm"],
            "stress_days": t["stress_days"],
            "yield_ratio": yield_ratio(t["eta_mm"], t["etc_mm"], float(crops_cfg[first_id]["ky"]["value"])),
        }
        efficiency = None

    bare_by_month = ind.monthly_counts(bare, window_start)
    row = {
        "start_year": int(start_year),
        "rotation_id": rotation["id"],
        "depth_id": depth["id"],
        "pre_sowing_precip_mm": float(out.loc[window_start:day_before_sowing, "precip_mm"].sum()),
        "water_at_wheat_sowing_mm": float(out.loc[day_before_sowing, "aw_mm"]),
        "fallow_storage_efficiency": efficiency,
        "bare_days": int(sum(bare_by_month)),
        "wind_exposed_bare_days": int(exposed.sum()),
        "bare_by_month": bare_by_month,
        "stress_by_month": ind.monthly_counts(stress, window_start),
        "fullness_by_month": ind.fullness_by_month(out["aw_mm"], soil.capacity_mm, window_start),
        "first_crop": first_block,
        "wheat": main_block,
    }
    series = {
        "start_year": int(start_year),
        "rotation_id": rotation["id"],
        "depth_id": depth["id"],
        "weeks": _ledger_weeks(out, sched["crop"], window_start),
    }
    return row, series, wb.mass_balance_error(out)


def run_location(location_id: str, weather: pd.DataFrame, soilgrids: dict | None,
                 start_years=None) -> dict:
    """EngineOutput for one location (ARAYUZLER §5).

    `start_years` is for tests and partial runs only; the default is the contract's
    2001…2024 (216 sequences with three rotations and three depth classes).
    """
    crops_cfg = _load_config("crops")
    soil_cfg = _load_config("soil")
    rotation_list = _rotation_list()
    awc = _awc_used(location_id, soilgrids, soil_cfg)
    wind_thr = ind.wind_threshold(weather, float(soil_cfg["wind_exposure_percentile"]["value"]))
    heat_thr = _heat_threshold_c()
    years = list(START_YEARS if start_years is None else start_years)

    sequences, ledger, max_err = [], [], 0.0
    for year in years:
        for rotation in rotation_list:
            for depth in soil_cfg["depth_classes"]:
                row, series, err = run_sequence(
                    weather, year, rotation, depth, crops_cfg=crops_cfg, soil_cfg=soil_cfg,
                    awc_mm_per_m=awc["value"], wind_threshold_ms=wind_thr, heat_threshold_c=heat_thr,
                )
                sequences.append(row)
                ledger.append(series)
                max_err = max(max_err, err)

    return {
        "location_id": location_id,
        "awc_used": awc,
        "sequences": sequences,
        "ledger": ledger,
        "diagnostics": {"max_mass_balance_error_mm": float(max_err), "n_sequences": len(sequences)},
    }

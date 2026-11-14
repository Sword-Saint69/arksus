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
    node = refs.get("heat_threshold_c") if isinstance(refs, dict) else None
    if isinstance(node, dict) and node.get("value") is not None:
        return float(node["value"])
    warnings.warn(
        "references.yaml has no heat_threshold_c; using the PLAN_MVP §5.8 seed of 30 °C (unverified)",
        stacklevel=2,
    )
    return _PLAN_SEED_HEAT_THRESHOLD_C


def usda_texture_class(clay_pct: float, sand_pct: float, silt_pct: float) -> str:
    """USDA soil texture triangle. Fractions are normalised to sum to 100 % first."""
    total = clay_pct + sand_pct + silt_pct
    if total <= 0:
        raise ValueError("clay + sand + silt must be positive")
    clay, sand, silt = (100.0 * x / total for x in (clay_pct, sand_pct, silt_pct))
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 2 * clay < 30:
        return "loamy_sand"
    if clay >= 40 and silt >= 40:
        return "silty_clay"
    if clay >= 35 and sand > 45:
        return "sandy_clay"
    if clay >= 40:
        return "clay"
    if clay >= 27:
        return "silty_clay_loam" if sand <= 20 else ("clay_loam" if sand <= 45 else "sandy_clay_loam")
    if clay >= 20 and silt < 28 and sand > 45:
        return "sandy_clay_loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if silt >= 50:
        return "silt_loam"
    if clay >= 7 and silt >= 28 and sand <= 52:
        return "loam"
    return "sandy_loam"


def _soilgrids_texture(soilgrids: dict | None) -> tuple[dict, str | None, str] | None:
    """(clay/sand/silt %, USDA class from the file or None, depth label).

    Prefers `texture_0_100cm` (whole profile, the roots reach 1 m); falls back to the Q50
    0–30 cm soil-card properties. None if neither is complete.
    """
    t = (soilgrids or {}).get("texture_0_100cm")
    if isinstance(t, dict):
        try:
            frac = {k: float(t[k]) for k in ("clay", "sand", "silt")}
            cls = t.get("usda_class")
            return frac, (str(cls).strip().lower().replace(" ", "_") if cls else None), "0–100 cm"
        except (KeyError, TypeError, ValueError):
            pass
    props = {p.get("id"): p for p in (soilgrids or {}).get("properties", [])}
    try:
        return {k: float(props[k]["q50"]) for k in ("clay", "sand", "silt")}, None, "Q50 0–30 cm"
    except (KeyError, TypeError, ValueError):
        return None


def soil_setup(location_id: str, soilgrids: dict | None, soil_cfg: dict) -> tuple[dict, dict]:
    """Which available water capacity the engine uses, and any evaporation-layer overrides.

    soil.yaml `awc_method`:
      texture_table — texture class from SoilGrids Q50 clay/sand/silt, AWC / θFC / θWP / REW
                      from FAO-56 Table 19 for that class (TEW from Eq. 73);
      soilgrids     — SoilGrids wv0033 − wv1500 as delivered in data/soilgrids/{loc}.json.
    Either way: without a SoilGrids file → soil.yaml fallback for the location (assumption);
    texture_table without texture in the file → SoilGrids AWC.
    Returns (awc_used V object, {"tew_mm", "rew_mm"} or {}).
    """
    method = str((soil_cfg.get("awc_method") or {}).get("value", "soilgrids"))
    if method not in ("texture_table", "soilgrids"):
        raise ValueError(f"soil.yaml awc_method must be texture_table or soilgrids, not {method!r}")

    sg_awc = (soilgrids or {}).get("awc_mm_per_m")
    texture = _soilgrids_texture(soilgrids)

    if method == "texture_table" and texture is not None:
        frac_pct, file_cls, depth_label = texture
        cls = file_cls or usda_texture_class(frac_pct["clay"], frac_pct["sand"], frac_pct["silt"])
        table_cls = cls
        if cls not in soil_cfg["texture_table"]:
            alias = (soil_cfg.get("texture_table_aliases") or {}).get(cls)
            if alias is None:
                raise KeyError(f"soil.yaml texture_table has no row or alias for {cls}")
            table_cls = alias["value"]
        row = soil_cfg["texture_table"][table_cls]
        ze = float(soil_cfg["evaporation"]["ze_m"]["value"])
        fc, wp = float(row["theta_fc"]["value"]), float(row["theta_wp"]["value"])
        value = float(row["awc_mm_per_m"]["value"])

        stones = ""
        cfvo = (soilgrids or {}).get("cfvo_0_100cm_fraction")
        if bool((soil_cfg.get("awc_cfvo_correction") or {}).get("value", False)) and isinstance(cfvo, dict) \
                and cfvo.get("value") is not None:
            value *= 1.0 - float(cfvo["value"])
            stones = f" × (1 − coarse fragments {float(cfvo['value']):g}, SoilGrids cfvo 0–100 cm)"

        total = sum(frac_pct.values())
        frac = ", ".join(f"{k} {100 * v / total:.0f} %" for k, v in frac_pct.items())
        note = "" if table_cls == cls else f" ({cls.replace('_', ' ')} is not in Table 19; used {table_cls.replace('_', ' ')})"
        alts = []
        if isinstance(sg_awc, dict) and sg_awc.get("value") is not None:
            alts.append(f"SoilGrids wv0033−wv1500 {sg_awc['value']:g}")
        sr = ((soilgrids or {}).get("awc_alternatives") or {}).get("saxton_rawls_2006")
        if isinstance(sr, dict) and sr.get("value") is not None:
            alts.append(f"Saxton–Rawls 2006 {sr['value']:g}")
        alt_text = f". Not used (mm/m): {', '.join(alts)}" if alts else ""
        awc = {
            "value": value,
            "unit": "mm/m",
            "source": (f"FAO-56 Table 19, {cls.replace('_', ' ')}{note}: θFC − θWP range midpoint {row['awc_mm_per_m']['value']:g} mm/m"
                       f"{stones}; texture class from SoilGrids 2.0 {depth_label} ({frac}){alt_text}"),
            "type": "assumption",
            "verified": False,
        }
        return awc, {"tew_mm": 1000.0 * (fc - 0.5 * wp) * ze, "rew_mm": float(row["rew_mm"]["value"])}

    if isinstance(sg_awc, dict) and sg_awc.get("value"):
        return {
            "value": float(sg_awc["value"]),
            "unit": sg_awc.get("unit", "mm/m"),
            "source": sg_awc.get("source", "SoilGrids 2.0"),
            "type": sg_awc.get("type", "model"),
            "verified": bool(sg_awc.get("verified", False)),
        }, {}
    fb_cfg = soil_cfg["fallback_awc_mm_per_m"]
    fb = (fb_cfg.get("overrides") or {}).get(location_id) or fb_cfg["default"]
    return {"value": float(fb["value"]), "unit": fb["unit"], "source": fb["source"],
            "type": "assumption", "verified": False}, {}


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
                 wind_threshold_ms: float, heat_threshold_c: float,
                 soil_overrides: dict | None = None) -> tuple[dict, dict, float]:
    """One sequence → (sequences row, ledger series, mass-balance error in mm)."""
    first_id, main_id = rotation["crops"]
    soil = wb.SoilProfile.from_config(soil_cfg, awc_mm_per_m=awc_mm_per_m, depth_m=depth["depth_m"],
                                      **(soil_overrides or {}))
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


def _references() -> dict:
    return _load_config("references") or {}


def _precip_correction_enabled() -> bool:
    cfg = (_load_config("scenarios") or {}).get("precip_correction") or {}
    return bool((cfg.get("enabled") or {}).get("value", False))


def precip_correction_factor(location_id: str, weather: pd.DataFrame, refs: dict | None = None) -> dict | None:
    """Station factor for POWER precipitation: MGM/WMO 1991–2020 annual normal ÷ POWER mean annual
    precipitation over complete calendar years (scenarios.yaml precip_correction). None without a normal."""
    from nobetsu.validate import power_annual_mean_mm
    node = ((refs if refs is not None else _references()).get("mgm_annual_precip_mm") or {}).get(location_id)
    normal = node.get("value") if isinstance(node, dict) else None
    if not normal:
        return None
    power = power_annual_mean_mm(weather)
    if power <= 0:
        return None
    return {"factor": float(normal) / power, "mgm_mm": float(normal), "power_mm": power,
            "station": node.get("station") or "nearest MGM station"}


def apply_precip_correction(weather: pd.DataFrame, location_id: str, refs: dict | None = None) -> pd.DataFrame:
    """Daily precipitation × station factor; wet days unchanged; input not modified. Idempotent:
    weather already carrying attrs['precip_correction'] is returned as is."""
    if weather.attrs.get("precip_correction"):
        return weather
    f = precip_correction_factor(location_id, weather, refs)
    if f is None:
        return weather
    w = weather.copy()
    w.attrs = dict(weather.attrs)
    w["precip_mm"] = weather["precip_mm"] * f["factor"]
    w.attrs["precip_correction"] = f
    return w


def _maybe_correct(location_id: str, weather: pd.DataFrame, precip_correction: bool | None) -> pd.DataFrame:
    use = _precip_correction_enabled() if precip_correction is None else bool(precip_correction)
    return apply_precip_correction(weather, location_id, _references()) if use else weather


def run_location(location_id: str, weather: pd.DataFrame, soilgrids: dict | None,
                 start_years=None, precip_correction: bool | None = None) -> dict:
    """EngineOutput for one location (ARAYUZLER §5).

    `start_years` is for tests and partial runs only; the default is the contract's
    2001…2024 (216 sequences with three rotations and three depth classes).
    `precip_correction`: None = scenarios.yaml switch; True/False forces it (station-scaled POWER rain).
    """
    weather = _maybe_correct(location_id, weather, precip_correction)
    crops_cfg = _load_config("crops")
    soil_cfg = _load_config("soil")
    rotation_list = _rotation_list()
    awc, soil_overrides = soil_setup(location_id, soilgrids, soil_cfg)
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
                    soil_overrides=soil_overrides,
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
        "precip_correction": weather.attrs.get("precip_correction"),   # None when POWER rain is used as is
    }


# --- E1: continuous "landscape" run for the SMAP comparison --------------------------------

def _continuous_schedule(cycle: list[str], phase: int, index: pd.DatetimeIndex, crops_cfg: dict,
                         depth_m: float, weather: pd.DataFrame) -> pd.DataFrame:
    """Repeat a rotation on one parcel: in calendar year y the parcel follows
    cycle[(y − first year + phase) % len(cycle)]; a crop with a `sowing` date is sown that
    year, an entry without one leaves the land bare. A season that would run past the end
    of the weather record is left out (the parcel stays bare for those last weeks).
    """
    sched = pd.DataFrame({"kcb": 0.0, "zr_m": 0.0, "h_m": 0.0, "p": 0.0, "crop": "bare"}, index=index)
    y0 = index[0].year
    for y in range(y0, index[-1].year + 1):
        crop_id = cycle[(y - y0 + phase) % len(cycle)]
        cfg = crops_cfg[crop_id] or {}
        if "sowing" not in cfg:
            continue
        sow = rotations._sowing_date(cfg, y)
        end = sow + pd.Timedelta(days=rotations.season_length(cfg) - 1)
        if sow < index[0] or end > index[-1]:
            continue
        curve = rotations.season_curve(cfg, sow, depth_m, weather)
        sched.loc[curve.index, ["kcb", "zr_m", "h_m", "p"]] = curve[["kcb", "zr_m", "h_m", "p"]].to_numpy()
        sched.loc[curve.index, "crop"] = crop_id
    return sched


def run_landscape(location_id: str, weather: pd.DataFrame, soilgrids: dict | None, *,
                  start: str = "2013-10-01", depth_id: str = "medium", cycle: list[str] | None = None,
                  precip_correction: bool | None = None) -> pd.DataFrame:
    """Daily available water of a landscape made of two parcels running the baseline
    rotation one year apart (in any year half the land is fallow, half is wheat), averaged.

    This is the engine-side series compared with SMAP L4 root-zone wetness in E1: a 9 km
    SMAP cell mixes fields in both phases. Returns daily aw_mm / fullness_pct (landscape),
    the two parcels (aw_mm_a/b, crop_a/b); attrs: cycle, capacity_mm, awc_used,
    max_mass_balance_error_mm.
    """
    weather = _maybe_correct(location_id, weather, precip_correction)
    crops_cfg = _load_config("crops")
    soil_cfg = _load_config("soil")
    cycle = list(cycle or _rotation_list()[0]["crops"])
    depth = next(d for d in soil_cfg["depth_classes"] if d["id"] == depth_id)
    awc, overrides = soil_setup(location_id, soilgrids, soil_cfg)
    soil = wb.SoilProfile.from_config(soil_cfg, awc_mm_per_m=awc["value"], depth_m=depth["depth_m"], **overrides)
    index = pd.date_range(pd.Timestamp(start), weather.index[-1], freq="D", name="date")

    cols, errors = {}, []
    for phase, tag in ((0, "a"), (1, "b")):
        sched = _continuous_schedule(cycle, phase, index, crops_cfg, depth["depth_m"], weather)
        out = wb.simulate(wb.daily_inputs(weather, sched), soil,
                          init_fraction=float(soil_cfg["initial_fill_fraction"]["value"]))
        cols[f"aw_mm_{tag}"] = out["aw_mm"]
        cols[f"crop_{tag}"] = sched["crop"]
        cols[f"kcb_{tag}"] = sched["kcb"]
        errors.append(wb.mass_balance_error(out))

    land = pd.DataFrame(cols, index=index)
    land["aw_mm"] = (land["aw_mm_a"] + land["aw_mm_b"]) / 2.0
    land["kcb"] = (land["kcb_a"] + land["kcb_b"]) / 2.0   # landscape crop cover proxy (NDVI check)
    land["fullness_pct"] = (land["aw_mm"] / soil.capacity_mm * 100.0).clip(0.0, 100.0)
    land.attrs.update(cycle=cycle, capacity_mm=soil.capacity_mm, awc_used=awc,
                      max_mass_balance_error_mm=float(max(errors)), location_id=location_id)
    return land


# --- E2: drier / warmer delta-change scenarios ----------------------------------------------

SCENARIO_TEMP_COLUMNS = ("tmax_c", "tmin_c", "tdew_c")


def apply_scenario(weather: pd.DataFrame, scenario: dict) -> pd.DataFrame:
    """Weather for one scenario (config/scenarios.yaml): daily precipitation × factor,
    Tmax/Tmin/Tdew + shift (relative humidity stays roughly constant; ET0 follows because it
    is recomputed from the shifted weather). The input frame is not modified."""
    w = weather.copy()
    w.attrs = dict(weather.attrs)
    factor = float(scenario["precip_factor"]["value"])
    shift = float(scenario["temp_shift_c"]["value"])
    if factor < 0:
        raise ValueError("precip_factor must be non-negative")
    if factor != 1.0:
        w["precip_mm"] = weather["precip_mm"] * factor
    if shift != 0.0:
        for col in SCENARIO_TEMP_COLUMNS:
            w[col] = weather[col] + shift
    w.attrs["scenario_id"] = scenario["id"]
    return w


def run_scenarios(location_id: str, weather: pd.DataFrame, soilgrids: dict | None,
                  scenario_ids: list[str] | None = None, start_years=None,
                  precip_correction: bool | None = None) -> dict[str, dict]:
    """{scenario_id: EngineOutput} — run_location() on each scenario's weather.

    The wind-exposure threshold is recomputed per run from the scenario weather, but wind is
    never changed by a scenario, so it is the same as in the baseline.
    """
    defined = {s["id"]: s for s in _load_config("scenarios")["scenarios"]}
    ids = list(defined) if scenario_ids is None else list(scenario_ids)
    unknown = [i for i in ids if i not in defined]
    if unknown:
        raise KeyError(f"unknown scenario ids: {unknown}")
    # Station correction first, on the unscaled record: correcting after a "dry" step would undo it
    # (the factor is computed from the record's own mean). apply_scenario keeps the attrs, so
    # run_location sees the weather as already corrected and does not scale it again.
    base = _maybe_correct(location_id, weather, precip_correction)
    return {sid: run_location(location_id, apply_scenario(base, defined[sid]), soilgrids, start_years=start_years,
                              precip_correction=bool(base.attrs.get("precip_correction")))
            for sid in ids}

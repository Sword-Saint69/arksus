"""MVP consistency checks → validation.json `checks` (PLAN_MVP §5.7, ARAYUZLER §6).

These are consistency checks, not field validation. Only mass_balance and
et0_fao56_ex18 can pass or fail; the other three are `info` (shown side by side with
their reference) or `pending` when the reference value has not been sourced yet.
"""

from __future__ import annotations

import statistics

import pandas as pd

from nobetsu import et0 as et0_mod

CHECK_IDS = ("mass_balance", "et0_fao56_ex18", "pse_literature", "trial_ratio", "precip_vs_mgm")
MASS_BALANCE_LIMIT_MM = 0.01           # PLAN_MVP §5.7 pass rule
ET0_TOLERANCE_MM = 0.1                 # PLAN_MVP §5.2 / §5.7 pass rule
REFERENCE_DEPTH_ID = "medium"          # info checks are reported for the medium depth class
TRIAL_LOCATION_ID = "karapinar"        # the previous-crop trial is in Konya

# FAO-56 (Allen et al. 1998) Chapter 4, Example 18: Brussels, 6 July. Same values as
# engine/tests/test_et0.py; checked against https://www.fao.org/4/x0490e/x0490e08.htm.
EX18 = dict(lat_deg=50.0 + 48.0 / 60.0, elevation_m=100.0, doy=187, tmax_c=21.5, tmin_c=12.3,
            rh_max=84.0, rh_min=63.0, u10_ms=10.0 / 3.6, sun_hours=9.25, expected_mm=3.9)

LOCATION_NAMES = {"karapinar": "Karapınar", "develi": "Develi"}


def _v(node):
    return node.get("value") if isinstance(node, dict) else None


def _check(check_id, status, value, reference, en, tr):
    return {"id": check_id, "status": status, "value": value, "reference": reference,
            "note": {"en": en, "tr": tr}}


def _name(loc):
    return LOCATION_NAMES.get(loc, loc)


def _rows(outputs, location_id=None, depth_id=REFERENCE_DEPTH_ID, rotation_id=None):
    for loc, out in outputs.items():
        if location_id is not None and loc != location_id:
            continue
        for r in out["sequences"]:
            if r["depth_id"] == depth_id and (rotation_id is None or r["rotation_id"] == rotation_id):
                yield r


# --- 1. mass balance -----------------------------------------------------------------

def check_mass_balance(outputs):
    worst = max(o["diagnostics"]["max_mass_balance_error_mm"] for o in outputs.values())
    n = sum(o["diagnostics"]["n_sequences"] for o in outputs.values())
    ok = worst < MASS_BALANCE_LIMIT_MM
    return _check(
        "mass_balance", "pass" if ok else "fail",
        f"max |P − ETa − DP − ΔS| = {worst:.2g} mm over {n} sequences",
        f"< {MASS_BALANCE_LIMIT_MM} mm",
        "Every simulated day keeps water in = water out + change in storage.",
        "Simüle edilen her gün giren su = çıkan su + depodaki değişim.",
    )


# --- 2. ET0 against FAO-56 Example 18 ------------------------------------------------

def example18_et0() -> float:
    e = EX18
    return float(et0_mod.et0_daily(
        tmax_c=e["tmax_c"], tmin_c=e["tmin_c"],
        ea_kpa=et0_mod.ea_from_rh_minmax(e["tmax_c"], e["tmin_c"], e["rh_max"], e["rh_min"]),
        rs_mj_m2=et0_mod.rs_from_sunshine(e["sun_hours"], e["lat_deg"], e["doy"]),
        u2_ms=et0_mod.wind_at_2m(e["u10_ms"], 10.0),
        lat_deg=e["lat_deg"], elevation_m=e["elevation_m"], doy=e["doy"],
    ))


def check_et0():
    value = example18_et0()
    ok = abs(value - EX18["expected_mm"]) <= ET0_TOLERANCE_MM
    return _check(
        "et0_fao56_ex18", "pass" if ok else "fail",
        f"{value:.2f} mm/day",
        f"FAO-56 Example 18: {EX18['expected_mm']} mm/day (± {ET0_TOLERANCE_MM})",
        "Our reference evapotranspiration code reproduces the FAO-56 worked example.",
        "Referans buharlaşma-terleme kodumuz FAO-56'daki çözümlü örneği tekrar üretiyor.",
    )


# --- 3. fallow storage efficiency vs literature --------------------------------------

def check_pse(outputs, refs):
    rng = refs.get("pse_range", {})
    low, high = _v(rng.get("low")), _v(rng.get("high"))
    parts = []
    for loc in outputs:
        vals = [r["fallow_storage_efficiency"] for r in _rows(outputs, loc, rotation_id="fallow_wheat")
                if r["fallow_storage_efficiency"] is not None]
        if vals:
            parts.append(f"{_name(loc)} {statistics.median(vals) * 100:.0f} %")
    value = "model median, medium soil: " + ", ".join(parts) if parts else ""
    if low is None or high is None:
        return _check("pse_literature", "pending", value, "",
                      "Waiting for the literature range for Central Anatolia.",
                      "Orta Anadolu için literatür aralığı bekleniyor.")
    return _check(
        "pse_literature", "info", value,
        f"Central Anatolia literature: {low * 100:.0f}–{high * 100:.0f} %",
        "Share of rain during the fallow period that is still stored in the soil at wheat sowing. "
        "No snow and no stubble in the model, which tends to lower this value.",
        "Nadas dönemindeki yağışın buğday ekiminde hâlâ toprakta duran payı. "
        "Modelde kar ve anız yok; bu, değeri düşürme eğilimindedir.",
    )


# --- 4. wheat yield after legumes vs after fallow, against the Konya trial ------------

def check_trial(outputs, refs):
    t = refs.get("trial_yields_kg_per_da", {})
    fallow, lentil, chickpea = (_v(t.get(k)) for k in ("after_fallow", "after_lentil", "after_chickpea"))
    loc = TRIAL_LOCATION_ID if TRIAL_LOCATION_ID in outputs else next(iter(outputs))

    def med(rot):
        vals = [r["wheat"]["yield_ratio"] for r in _rows(outputs, loc, rotation_id=rot)]
        return statistics.median(vals) if vals else None

    base = med("fallow_wheat")
    parts = []
    for rot, label in (("chickpea_wheat", "after chickpea"), ("lentil_wheat", "after lentil")):
        m = med(rot)
        parts.append(f"{label} {m / base:.2f}" if base and m is not None else f"{label} n/a")
    value = f"model ({_name(loc)}, medium soil, median wheat yield ÷ after fallow): " + ", ".join(parts)

    if not fallow or chickpea is None or lentil is None:
        return _check("trial_ratio", "pending", value, "",
                      "Waiting for the verified trial yields.",
                      "Doğrulanmış deneme verimleri bekleniyor.")
    years = t.get("years", "")
    return _check(
        "trial_ratio", "info", value,
        f"Konya dryland trial{' ' + years if years else ''}: after chickpea {chickpea / fallow:.2f}, "
        f"after lentil {lentil / fallow:.2f} ({chickpea:g} / {lentil:g} / {fallow:g} kg/da)",
        "The model knows only water. The trial also includes nitrogen, disease and weed effects, "
        "so the two are shown side by side, not as a pass/fail test.",
        "Model sadece suyu bilir. Denemede azot, hastalık ve yabancı ot etkileri de var; "
        "bu yüzden ikisi yan yana gösterilir, geçti/kaldı testi değildir.",
    )


# --- 5. POWER precipitation vs MGM normals --------------------------------------------

def power_annual_mean_mm(weather: pd.DataFrame) -> float:
    """Mean annual POWER precipitation over the complete calendar years in the record."""
    p = weather["precip_mm"]
    counts = p.groupby(p.index.year).size()
    expected = pd.Series(
        [366 if pd.Timestamp(year=y, month=12, day=31).is_leap_year else 365 for y in counts.index],
        index=counts.index,
    )
    full_years = counts.index[counts.to_numpy() == expected.to_numpy()]
    if len(full_years) == 0:
        raise ValueError("weather has no complete calendar year")
    annual = p.groupby(p.index.year).sum()
    return float(annual.loc[full_years].mean())


def check_precip(weathers, refs):
    mgm = refs.get("mgm_annual_precip_mm", {})
    parts, ref_parts = [], []
    for loc, w in weathers.items():
        node = mgm.get(loc)
        normal = _v(node)
        if not normal:
            continue
        power = power_annual_mean_mm(w)
        station = node.get("station") or "nearest MGM station"
        parts.append(f"{_name(loc)}: POWER {power:.0f} mm/yr vs MGM {normal:g} mm/yr ({(power - normal) / normal * 100:+.0f} %)")
        ref_parts.append(f"{_name(loc)}: {station}, 1991–2020 normal")
    if not parts:
        return _check("precip_vs_mgm", "pending", "", "",
                      "Waiting for the MGM 1991–2020 precipitation normals.",
                      "MGM 1991–2020 yağış normalleri bekleniyor.")
    return _check(
        "precip_vs_mgm", "info", "; ".join(parts), "; ".join(ref_parts),
        "NASA POWER is satellite- and model-derived (~50 km); MGM stations measure one point on the ground. "
        "The two cover different years. This shows how far apart they are; correcting POWER with station data "
        "is on the post-event list.",
        "NASA POWER uydu ve model kaynaklıdır (~50 km); MGM istasyonu yerde tek bir noktayı ölçer. "
        "İkisi farklı yılları kapsar. Bu kontrol aradaki farkı gösterir; POWER'ı istasyon verisiyle düzeltmek "
        "etkinlik sonrası listesinde.",
    )


def run_checks(outputs: dict[str, dict], weather: dict[str, pd.DataFrame], refs: dict) -> list[dict]:
    """The five MVP checks in the fixed contract order (PLAN_MVP §4.5)."""
    refs = refs or {}
    checks = [
        check_mass_balance(outputs),
        check_et0(),
        check_pse(outputs, refs),
        check_trial(outputs, refs),
        check_precip(weather, refs),
    ]
    assert [c["id"] for c in checks] == list(CHECK_IDS)
    return checks

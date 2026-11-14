"""MVP consistency checks → validation.json `checks` (PLAN_MVP §5.7, ARAYUZLER §6).

These are consistency checks, not field validation. Only mass_balance and
et0_fao56_ex18 can pass or fail; the other three are `info` (shown side by side with
their reference) or `pending` when the reference value has not been sourced yet.
"""

from __future__ import annotations

import statistics

import numpy as np

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
    awc = outputs[loc].get("awc_used") or {}
    if awc.get("value") is not None:
        value += f"; soil available water used: {awc['value']:.0f} mm/m"

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
        "so the two are shown side by side, not as a pass/fail test. The result depends strongly on the "
        "soil's available water; the soil card lists the alternative estimates.",
        "Model sadece suyu bilir. Denemede azot, hastalık ve yabancı ot etkileri de var; "
        "bu yüzden ikisi yan yana gösterilir, geçti/kaldı testi değildir. Sonuç toprağın kullanılabilir "
        "su kapasitesine çok bağlıdır; diğer tahminler toprak kartında.",
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


def precip_common_years(weather: pd.DataFrame, imerg_monthly: pd.Series) -> tuple[list[int], float, float]:
    """Calendar years complete in both POWER (every day) and IMERG (12 non-missing months),
    and the mean annual total of each over exactly those years."""
    p = weather["precip_mm"]
    days = p.groupby(p.index.year).size()
    power_years = {int(y) for y, n in days.items() if n == (366 if pd.Timestamp(year=int(y), month=1, day=1).is_leap_year else 365)}
    s = imerg_monthly.dropna()
    months = s.groupby(s.index.year).size()
    imerg_years = {int(y) for y, n in months.items() if n == 12}
    years = sorted(power_years & imerg_years)
    if not years:
        raise ValueError("no calendar year complete in both POWER and IMERG")
    power_mm = float(p[p.index.year.isin(years)].groupby(p.index.year[p.index.year.isin(years)]).sum().mean())
    imerg_mm = float(s[s.index.year.isin(years)].groupby(s.index.year[s.index.year.isin(years)]).sum().mean())
    return years, power_mm, imerg_mm


def check_precip(weathers, refs, imerg=None):
    """POWER (and, when cached, NASA GPM IMERG) annual precipitation vs MGM station normals."""
    mgm = refs.get("mgm_annual_precip_mm", {})
    imerg = imerg or {}
    parts, ref_parts = [], []
    for loc, w in weathers.items():
        node = mgm.get(loc)
        normal = _v(node)
        if not normal:
            continue
        power = power_annual_mean_mm(w)
        station = node.get("station") or "nearest MGM station"
        text = f"{_name(loc)}: POWER {power:.0f} mm/yr vs MGM {normal:g} mm/yr ({(power - normal) / normal * 100:+.0f} %)"
        if loc in imerg:
            try:
                years, power_c, imerg_c = precip_common_years(w, imerg[loc])
            except ValueError:
                years = []
            if years:
                text += (f"; IMERG {imerg_c:.0f} mm/yr ({(imerg_c - normal) / normal * 100:+.0f} %), "
                         f"POWER {power_c:.0f} mm/yr over the same {years[0]}–{years[-1]} ({len(years)} yr)")
        parts.append(text)
        ref_parts.append(f"{_name(loc)}: {station}, 1991–2020 normal")
    if not parts:
        return _check("precip_vs_mgm", "pending", "", "",
                      "Waiting for the MGM 1991–2020 precipitation normals.",
                      "MGM 1991–2020 yağış normalleri bekleniyor.")
    has_imerg = any("IMERG" in p for p in parts)
    if has_imerg:
        from . import imerg as imerg_mod
        ref_parts.append(f"IMERG: {imerg_mod.SOURCE}, cell containing each point")
    en = ("NASA POWER is satellite- and model-derived (~50 km); MGM stations measure one point on the ground. "
          "The two cover different years. This shows how far apart they are; correcting POWER with station data "
          "is on the post-event list.")
    tr = ("NASA POWER uydu ve model kaynaklıdır (~50 km); MGM istasyonu yerde tek bir noktayı ölçer. "
          "İkisi farklı yılları kapsar. Bu kontrol aradaki farkı gösterir; POWER'ı istasyon verisiyle düzeltmek "
          "etkinlik sonrası listesinde.")
    if has_imerg:
        en += (" NASA GPM IMERG (~10 km) is a second satellite estimate. Its monthly product is adjusted with rain "
               "gauges, so it is not fully independent of station data. The engine still uses POWER.")
        tr += (" NASA GPM IMERG (~10 km) ikinci bir uydu tahminidir. Aylık ürünü yağış ölçerlerle düzeltildiği için "
               "istasyon verisinden tam bağımsız değildir. Motor hâlâ POWER kullanır.")
    return _check("precip_vs_mgm", "info", "; ".join(parts), "; ".join(ref_parts), en, tr)


def run_checks(outputs: dict[str, dict], weather: dict[str, pd.DataFrame], refs: dict,
               imerg: dict[str, pd.Series] | None = None) -> list[dict]:
    """The five MVP checks in the fixed contract order (PLAN_MVP §4.5).

    imerg: monthly GPM IMERG series per location; None reads data/imerg/{id}.json where present.
    """
    refs = refs or {}
    if imerg is None:
        from . import imerg as imerg_mod
        imerg = imerg_mod.load_cached(weather.keys())
    checks = [
        check_mass_balance(outputs),
        check_et0(),
        check_pse(outputs, refs),
        check_trial(outputs, refs),
        check_precip(weather, refs, imerg),
    ]
    assert [c["id"] for c in checks] == list(CHECK_IDS)
    return checks


# --- E1: SMAP L4 root-zone anomaly comparison (PLAN_EXPANSION E1) ---------------------------
# Not yet part of run_checks(): the contract has exactly five checks. A sixth id
# (`smap_anomaly`) needs Gümüş to extend validation.schema.json first.

SMAP_MIN_MONTHS = 24


def monthly_anomalies(series: pd.Series) -> pd.Series:
    """Standardised anomaly per calendar month: (x − mean_month) / std_month."""
    g = series.groupby(series.index.month)
    std = g.transform("std", ddof=0).replace(0.0, float("nan"))
    return ((series - g.transform("mean")) / std).fillna(0.0)


def spearman(x, y) -> float:
    """Spearman rank correlation (average ranks for ties)."""
    rx = pd.Series(list(x), dtype=float).rank(method="average").to_numpy()
    ry = pd.Series(list(y), dtype=float).rank(method="average").to_numpy()
    if len(rx) < 3 or rx.std() == 0 or ry.std() == 0:
        return float("nan")
    return float(np.corrcoef(rx, ry)[0, 1])


def _smap_monthly(smap: dict) -> pd.Series:
    rows = [r for r in smap.get("monthly_series", []) if r.get("rootzone_wetness") is not None]
    if not rows:
        return pd.Series(dtype=float)
    return pd.Series([float(r["rootzone_wetness"]) for r in rows],
                     index=pd.DatetimeIndex([pd.Timestamp(r["month_start"]) for r in rows])).sort_index()


def smap_comparison(landscape: pd.DataFrame, smap: dict) -> dict:
    """Compare monthly model fullness (landscape run) with SMAP root-zone wetness.

    Both are reduced to standardised monthly anomalies over the overlapping months, so the
    different definitions (fullness = share of available water capacity; SMAP wetness =
    degree of saturation of a 9 km model cell) do not matter for the correlation.
    """
    days = landscape["fullness_pct"].groupby(landscape.index.to_period("M")).size()
    model = landscape["fullness_pct"].resample("MS").mean() / 100.0
    full_months = days[days == days.index.days_in_month].index.to_timestamp()
    model = model.loc[model.index.isin(full_months)]
    sm = _smap_monthly(smap)
    both = pd.concat({"model": model, "smap": sm}, axis=1, join="inner").dropna()
    out = {"n_months": int(len(both))}
    if len(both) < 3:
        return out
    za, zb = monthly_anomalies(both["model"]), monthly_anomalies(both["smap"])
    clim_m = both["model"].groupby(both.index.month).mean()
    clim_s = both["smap"].groupby(both.index.month).mean()
    out.update(
        first_month=both.index[0].date().isoformat(),
        last_month=both.index[-1].date().isoformat(),
        spearman_anomaly=spearman(za, zb),
        spearman_seasonal=spearman(clim_m, clim_s),
        model_wettest_month=int(clim_m.idxmax()), model_driest_month=int(clim_m.idxmin()),
        smap_wettest_month=int(clim_s.idxmax()), smap_driest_month=int(clim_s.idxmin()),
    )
    return out


def check_smap_anomaly(landscapes: dict[str, pd.DataFrame], smaps: dict[str, dict]) -> dict:
    """Sixth check (E1) in the validation.json item format; `info` or `pending`."""
    parts = []
    for loc, land in landscapes.items():
        smap = smaps.get(loc) or {}
        if not smap.get("available"):
            continue
        s = smap_comparison(land, smap)
        if s["n_months"] < SMAP_MIN_MONTHS:
            continue
        parts.append(
            f"{_name(loc)}: ρ = {s['spearman_anomaly']:.2f} for monthly anomalies "
            f"({s['n_months']} months, {s['first_month'][:7]} → {s['last_month'][:7]}); "
            f"wettest month model {s['model_wettest_month']} / SMAP {s['smap_wettest_month']}, "
            f"driest model {s['model_driest_month']} / SMAP {s['smap_driest_month']}"
        )
    if not parts:
        return _check("smap_anomaly", "pending", "", "",
                      "Waiting for NASA SMAP L4 root-zone data for the two points.",
                      "İki nokta için NASA SMAP L4 kök bölgesi verisi bekleniyor.")
    return _check(
        "smap_anomaly", "info", "; ".join(parts),
        "NASA SMAP L4 SPL4SMGP v8 root-zone wetness, 9 km cell, monthly means",
        "Spearman correlation of month-by-month anomalies between the model's soil-water fullness "
        "(a landscape where half the land is fallow and half is wheat each year, medium soil) and SMAP. "
        "It checks timing of wet and dry spells, not absolute agreement: SMAP is a satellite-assisted "
        "model of a 9 km mixed cell and knows nothing about our rotations.",
        "Modelin toprak suyu doluluğu (her yıl arazinin yarısı nadas, yarısı buğday; orta derinlik) ile "
        "SMAP'in aylık anomalileri arasındaki Spearman korelasyonu. Islak ve kuru dönemlerin zamanlamasını "
        "kontrol eder, mutlak uyumu değil: SMAP 9 km'lik karışık bir hücrenin uydu destekli modelidir ve "
        "bizim rotasyonlarımızı bilmez.",
    )

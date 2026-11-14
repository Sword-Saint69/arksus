"""Fake engine output in the exact ARAYUZLER §5 shape (owner: Gümüş).

Numbers are plausible but obviously fake (smooth curves over the years). Every file written
from this has "mock": true and the site shows a banner. Calendars here are mock-only and do
NOT come from crops.yaml; the real engine (Ömer) replaces all of it.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

from .soilgrids import MEANING

START_YEARS = list(range(2001, 2025))  # 2001..2024 inclusive
ROTATIONS = {
    "fallow_wheat": None,
    "chickpea_wheat": "chickpea",
    "lentil_wheat": "lentil",
}
DEPTHS = {"shallow": 0.6, "medium": 0.9, "deep": 1.2}

# Mock-only calendars (month, day). Not real parameters.
_WHEAT_SOW = (10, 15)
_LEGUME = {"chickpea": ((4, 1), (7, 15)), "lentil": ((3, 15), (7, 1))}

MOCK_SOURCE = "MOCK — fake value for development, not a result"


def _wave(year: int, period: float = 7.0, phase: float = 0.0) -> float:
    """Smooth 0..1 curve over start years."""
    return 0.5 + 0.45 * math.sin(2 * math.pi * (year - 2001) / period + phase)


def _daily_labels(y: int, rotation_id: str) -> list[tuple[date, str]]:
    """Label each day of the 24-month window (1 Jul y .. 30 Jun y+2)."""
    legume = ROTATIONS[rotation_id]
    empty = "fallow" if legume is None else "bare"
    sow = date(y + 1, *_WHEAT_SOW)
    if legume:
        l_start, l_end = date(y + 1, *_LEGUME[legume][0]), date(y + 1, *_LEGUME[legume][1])
    out = []
    d, end = date(y, 7, 1), date(y + 2, 7, 1)
    while d < end:
        if d >= sow:
            lab = "wheat"
        elif legume and l_start <= d < l_end:
            lab = legume
        else:
            lab = empty
        out.append((d, lab))
        d += timedelta(days=1)
    return out


def _month_index(y: int, d: date) -> int:
    return (d.year - y) * 12 + d.month - 7


def _sequence(location_id: str, y: int, rotation_id: str, depth_id: str) -> tuple[dict, dict]:
    legume = ROTATIONS[rotation_id]
    depth = DEPTHS[depth_id]
    w = _wave(y)
    loc_shift = 0.0 if location_id == "karapinar" else 40.0
    labels = _daily_labels(y, rotation_id)

    bare_by_month = [0] * 24
    crop_by_month = [0] * 24
    for d, lab in labels:
        m = _month_index(y, d)
        if lab in ("fallow", "bare"):
            bare_by_month[m] += 1
        else:
            crop_by_month[m] += 1
    wind_by_month = [int(b * (0.20 + 0.10 * w)) for b in bare_by_month]
    # stress only in late spring / early summer crop months (Apr..Jun of y+1 and y+2)
    stress_by_month = [
        int(c * (0.3 + 0.4 * (1 - w))) if (m % 12) in (9, 10, 11) else 0
        for m, c in enumerate(crop_by_month)
    ]
    pre_sowing = 380 + loc_shift + 180 * w
    water_gain = 1.0 if legume is None else 0.7 if legume == "lentil" else 0.6
    water_at_sowing = (40 + 110 * w) * water_gain * depth / 0.9
    fullness = [
        max(0.0, min(100.0, 30 + 45 * math.sin(math.pi * ((m + 4) % 12) / 12) * (0.6 + 0.4 * w) * (1.1 if legume is None else 1.0)))
        for m in range(24)
    ]
    wheat_ratio = min(1.0, 0.45 + 0.45 * w * (1.0 if legume is None else 0.85))
    wheat_stress = sum(stress_by_month[12:])
    row = {
        "start_year": y,
        "rotation_id": rotation_id,
        "depth_id": depth_id,
        "pre_sowing_precip_mm": pre_sowing,
        "water_at_wheat_sowing_mm": water_at_sowing,
        "fallow_storage_efficiency": (0.10 + 0.15 * w) if legume is None else None,
        "bare_days": sum(bare_by_month),
        "wind_exposed_bare_days": sum(wind_by_month),
        "bare_by_month": bare_by_month,
        "stress_by_month": stress_by_month,
        "fullness_by_month": fullness,
        "first_crop": None if legume is None else {
            "crop_id": legume,
            "eta_mm": 150 + 80 * w,
            "etc_mm": 260 + 20 * w,
            "stress_days": sum(stress_by_month[:12]),
            "yield_ratio": 0.35 + 0.5 * w,
        },
        "wheat": {
            "eta_mm": 220 + 120 * w,
            "etc_mm": 420 + 15 * w,
            "stress_days": wheat_stress,
            "heat_days_flowering": int(6 * (1 - w)),
            "yield_ratio": wheat_ratio,
        },
    }

    weeks = []
    for i in range(0, (len(labels) // 7) * 7, 7):  # 104 full weeks, as the real engine
        chunk = labels[i:i + 7]
        counts: dict[str, int] = {}
        for _, lab in chunk:
            counts[lab] = counts.get(lab, 0) + 1
        crop = max(counts, key=counts.get)
        t = i / len(labels)
        weeks.append({
            "week_start": chunk[0][0].isoformat(),
            "p_mm": max(0.0, 6 + 6 * math.sin(2 * math.pi * (t * 2 + 0.25)) * (0.5 + w)),
            "eta_mm": max(0.0, 4 + 4 * math.sin(2 * math.pi * (t * 2 - 0.1))),
            "dp_mm": 0.0,
            "aw_mm": max(0.0, (60 + 50 * math.sin(2 * math.pi * (t * 2 + 0.5))) * depth),
            "crop": crop,
        })
    series = {"start_year": y, "rotation_id": rotation_id, "depth_id": depth_id, "weeks": weeks}
    return row, series


def fake_run_location(location_id: str, weather=None, soilgrids: dict | None = None) -> dict:
    """Same signature and output shape as runner.run_location (ARAYUZLER §5)."""
    sequences, ledger = [], []
    for rotation_id in ROTATIONS:
        for depth_id in DEPTHS:
            for y in START_YEARS:
                row, series = _sequence(location_id, y, rotation_id, depth_id)
                sequences.append(row)
                ledger.append(series)
    return {
        "location_id": location_id,
        "awc_used": {"value": 140.0, "unit": "mm/m", "source": MOCK_SOURCE, "type": "assumption", "verified": False},
        "sequences": sequences,
        "ledger": ledger,
        "diagnostics": {"max_mass_balance_error_mm": 0.0, "n_sequences": len(sequences)},
    }


def fake_weather_meta(location_id: str) -> dict:
    return {"elevation_m": 0, "first_date": "2000-01-01", "last_date": "2026-11-10"}


_SOIL_PROPS = [
    # id, label en, label tr, unit, q05, q50, q95
    ("clay", "Clay", "Kil", "%", 20, 30, 40),
    ("sand", "Sand", "Kum", "%", 25, 35, 45),
    ("silt", "Silt", "Silt", "%", 25, 35, 45),
    ("phh2o", "pH (water)", "pH (su)", "pH", 7.5, 8.0, 8.5),
    ("soc", "Organic carbon", "Organik karbon", "g/kg", 5, 10, 15),
    ("nitrogen", "Total nitrogen", "Toplam azot", "g/kg", 0.5, 1.0, 1.5),
    ("cec", "Cation exchange capacity", "Katyon değişim kapasitesi", "cmol(c)/kg", 15, 25, 35),
    ("bdod", "Bulk density", "Hacim ağırlığı", "g/cm³", 1.2, 1.35, 1.5),
    ("cfvo", "Coarse fragments", "Kaba parçalar", "%", 2, 8, 15),
]


def fake_soil_properties() -> list[dict]:
    return [
        {
            "id": pid, "label": {"en": en, "tr": tr}, "depth": "0-30 cm",
            "q05": q05, "q50": q50, "q95": q95, "unit": unit,
            "source": MOCK_SOURCE, "type": "model", "how_obtained": "manual_viewer",
            "meaning": dict(MEANING[pid]),
        }
        for pid, en, tr, unit, q05, q50, q95 in _SOIL_PROPS
    ]


def fake_smap(location_id: str) -> dict:
    """Karapınar: available with fake data (to build the panel); Develi: not available."""
    if location_id != "karapinar":
        return {"available": False}
    clim = [{"month": m, "p10": 0.25 + 0.15 * _wave(m, 12, 1.2) - 0.08,
             "p50": 0.25 + 0.15 * _wave(m, 12, 1.2), "p90": 0.25 + 0.15 * _wave(m, 12, 1.2) + 0.08}
            for m in range(1, 13)]
    series = []
    for i in range(0, 12 * 11 + 8):  # 2015-04 .. 2026-11
        yy, mm = 2015 + (3 + i) // 12, (3 + i) % 12 + 1
        series.append({"month_start": f"{yy:04d}-{mm:02d}-01",
                       "rootzone_wetness": 0.25 + 0.15 * _wave(mm, 12, 1.2),
                       "surface_wetness": 0.20 + 0.20 * _wave(mm, 12, 1.0)})
    return {
        "available": True,
        "latest": {"date": "2026-11-10", "rootzone_wetness": 0.31, "rootzone_m3m3": 0.18, "percentile_for_month": 40},
        "monthly_climatology": clim,
        "monthly_series": series,
    }


def fake_checks() -> list[dict]:
    ids = ["mass_balance", "et0_fao56_ex18", "pse_literature", "trial_ratio", "precip_vs_mgm", "smap_anomaly"]
    return [
        {"id": i, "status": "pending", "value": "", "reference": "",
         "note": {"en": "Mock: check not run yet.", "tr": "Mock: kontrol henüz çalıştırılmadı."}}
        for i in ids
    ]

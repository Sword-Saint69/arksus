"""SoilGrids 2.0 point pull via WCS (ARAYUZLER §3, PLAN_MVP §5.10). Owner: Gümüş.

    python -m nobetsu.soilgrids            # writes data/soilgrids/{location_id}.json for every location

Each value = median of the 250 m pixels in a ~1 km window around the point (regional estimate, not a field value).
Unit conversion factors: SoilGrids 2.0 documentation ("mapped unit / conversion factor / conventional unit").
"""

from __future__ import annotations

import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests

from . import config

WCS_URL = "https://maps.isric.org/mapserv"
SOURCE = "SoilGrids 2.0 (ISRIC), WCS"
HALF_WINDOW_DEG = 0.005          # ±0.005° ≈ ±0.5 km
NODATA = -32768
QUANTILES = {"q05": "Q0.05", "q50": "Q0.5", "q95": "Q0.95"}
COVERAGE_SUFFIX = {**QUANTILES, "mean": "mean"}
TEXTURE = ["clay", "sand", "silt"]
CARD_DEPTHS = ["0-5cm", "5-15cm", "15-30cm"]                     # card: 0–30 cm
AWC_DEPTHS = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm"]  # engine AWC: 0–100 cm
THICKNESS_CM = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15, "30-60cm": 30, "60-100cm": 40}

# id -> (divide mapped value by, conventional unit, label en, label tr)
CARD_PROPERTIES = {
    "clay": (10, "%", "Clay", "Kil"),
    "sand": (10, "%", "Sand", "Kum"),
    "silt": (10, "%", "Silt", "Silt"),
    "phh2o": (10, "pH", "pH (water)", "pH (su)"),
    "soc": (10, "g/kg", "Soil organic carbon", "Toprak organik karbonu"),
    "nitrogen": (100, "g/kg", "Total nitrogen", "Toplam azot"),
    "cec": (10, "cmol(c)/kg", "Cation exchange capacity", "Katyon değişim kapasitesi"),
    "bdod": (100, "g/cm³", "Bulk density", "Hacim ağırlığı"),
    "cfvo": (10, "vol %", "Coarse fragments", "Kaba parçalar"),
}
# wv0033 / wv1500 mapped unit is 10^-3 cm³/cm³ = 1 mm water per m of soil -> used as mm/m directly.
WATER_PROPERTIES = ["wv0033", "wv1500"]


def convert(prop: str, mapped: float) -> float:
    if prop in WATER_PROPERTIES:
        return float(mapped)  # mm/m
    return float(mapped) / CARD_PROPERTIES[prop][0]


def fetch_tile(prop: str, depth: str, quantile: str, lat: float, lon: float, retries: int = 3) -> float:
    """Median mapped value (raw integer units) of the window around (lat, lon)."""
    from PIL import Image

    params = [
        ("map", f"/map/{prop}.map"), ("SERVICE", "WCS"), ("VERSION", "2.0.1"), ("REQUEST", "GetCoverage"),
        ("COVERAGEID", f"{prop}_{depth}_{quantile}"), ("FORMAT", "image/tiff"),
        ("SUBSET", f"long({lon - HALF_WINDOW_DEG},{lon + HALF_WINDOW_DEG})"),
        ("SUBSET", f"lat({lat - HALF_WINDOW_DEG},{lat + HALF_WINDOW_DEG})"),
        ("SUBSETTINGCRS", "http://www.opengis.net/def/crs/EPSG/0/4326"),
        ("OUTPUTCRS", "http://www.opengis.net/def/crs/EPSG/0/4326"),
    ]
    err: Exception | None = None
    for _ in range(retries):
        try:
            r = requests.get(WCS_URL, params=params, timeout=90)
            r.raise_for_status()
            if "tiff" not in r.headers.get("content-type", ""):
                raise ValueError(f"not a tiff: {r.text[:200]}")
            a = np.array(Image.open(io.BytesIO(r.content)), dtype="float64")
            a = a[a != NODATA]
            if a.size == 0:
                raise ValueError("only nodata pixels")
            return float(np.median(a))
        except (requests.RequestException, ValueError, OSError) as e:
            err = e
    raise RuntimeError(f"SoilGrids {prop}_{depth}_{quantile} failed: {err}")


def depth_weighted(values: dict[str, float], depths: list[str]) -> float:
    total = sum(THICKNESS_CM[d] for d in depths)
    return sum(values[d] * THICKNESS_CM[d] for d in depths) / total


def awc_mm_per_m(fc: dict[str, float], wp: dict[str, float], cfvo_mapped: dict[str, float]) -> float:
    """Σ (wv0033 − wv1500) × (1 − cfvo) weighted by layer thickness over 0–100 cm. cfvo in mapped units (‰)."""
    per_layer = {d: max(0.0, fc[d] - wp[d]) * (1 - cfvo_mapped[d] / 1000.0) for d in AWC_DEPTHS}
    return depth_weighted(per_layer, AWC_DEPTHS)


def build_record(location_id: str, raw: dict) -> dict:
    """raw[prop][depth][quantile_key] = mapped value  ->  data/soilgrids/{loc}.json content."""
    properties = []
    for prop, (_, unit, en, tr) in CARD_PROPERTIES.items():
        item = {"id": prop, "label": {"en": en, "tr": tr}, "depth": "0-30 cm"}
        for qk in QUANTILES:
            mapped = depth_weighted({d: raw[prop][d][qk] for d in CARD_DEPTHS}, CARD_DEPTHS)
            item[qk] = round(convert(prop, mapped), 2)
        item.update({"unit": unit, "source": SOURCE, "type": "model", "how_obtained": "wcs",
                     "meaning": {"en": "[text pending]", "tr": "[metin bekleniyor]"}})
        properties.append(item)

    awc = {qk: awc_mm_per_m({d: raw["wv0033"][d][qk] for d in AWC_DEPTHS},
                            {d: raw["wv1500"][d][qk] for d in AWC_DEPTHS},
                            {d: raw["cfvo"][d]["q50"] for d in AWC_DEPTHS})
           for qk in QUANTILES}
    return {
        "location_id": location_id,
        "how_obtained": "wcs",
        "window": f"median of 250 m pixels within ±{HALF_WINDOW_DEG}° of the point",
        "properties": properties,
        "awc_mm_per_m": {
            "value": round(awc["q50"], 1), "unit": "mm/m",
            "source": "SoilGrids 2.0 wv0033−wv1500, cfvo düzeltmeli, 0–100 cm ağırlıklı",
            "type": "model", "verified": False,
            "range_q05_q95": [round(awc["q05"], 1), round(awc["q95"], 1)],
        },
        "raw_mapped": raw,
    }


def _requests_for() -> list[tuple[str, str, str]]:
    jobs = [(p, d, qk) for p in CARD_PROPERTIES for d in CARD_DEPTHS for qk in QUANTILES]
    jobs += [(p, d, qk) for p in WATER_PROPERTIES for d in AWC_DEPTHS for qk in QUANTILES]
    jobs += [("cfvo", d, "q50") for d in AWC_DEPTHS if d not in CARD_DEPTHS]
    # Quantile maps are predicted independently, so texture Q0.5s need not sum to 100 %;
    # the mean maps do. Kept in raw_mapped for the physical-bounds test.
    jobs += [(p, d, "mean") for p in TEXTURE for d in CARD_DEPTHS]
    return jobs


def pull(location_id: str) -> dict:
    loc = next(l for l in config.load("locations")["locations"] if l["id"] == location_id)
    jobs = _requests_for()
    with ThreadPoolExecutor(max_workers=6) as ex:
        vals = list(ex.map(lambda j: fetch_tile(j[0], j[1], COVERAGE_SUFFIX[j[2]], loc["lat"], loc["lon"]), jobs))
    raw: dict = {}
    for (p, d, qk), v in zip(jobs, vals):
        raw.setdefault(p, {}).setdefault(d, {})[qk] = v
    return build_record(location_id, raw)


def out_path(location_id: str) -> Path:
    return config.DATA_DIR / "soilgrids" / f"{location_id}.json"


def main() -> None:
    for loc in config.location_ids():
        rec = pull(loc)
        path = out_path(loc)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        q50 = {p["id"]: p["q50"] for p in rec["properties"]}
        print(f"{loc}: AWC {rec['awc_mm_per_m']['value']} mm/m {rec['awc_mm_per_m']['range_q05_q95']} | {q50}")


if __name__ == "__main__":
    main()

"""SoilGrids conversions, AWC and physical bounds (PLAN_MVP §5.10 tests). Owner: Gümüş."""

from __future__ import annotations

import json

import pytest

from nobetsu import config, soilgrids as sg


def test_conversions():
    assert sg.convert("phh2o", 76) == pytest.approx(7.6)
    assert sg.convert("clay", 300) == pytest.approx(30.0)
    assert sg.convert("bdod", 135) == pytest.approx(1.35)
    assert sg.convert("nitrogen", 120) == pytest.approx(1.2)
    assert sg.convert("wv0033", 280) == pytest.approx(280.0)  # mm/m


def test_awc_depth_weighting_and_cfvo():
    fc = {d: 300.0 for d in sg.AWC_DEPTHS}
    wp = {d: 150.0 for d in sg.AWC_DEPTHS}
    assert sg.awc_mm_per_m(fc, wp, {d: 0.0 for d in sg.AWC_DEPTHS}) == pytest.approx(150.0)
    assert sg.awc_mm_per_m(fc, wp, {d: 100.0 for d in sg.AWC_DEPTHS}) == pytest.approx(135.0)  # 10 % stones
    fc2 = {**fc, "60-100cm": 150.0}  # deepest 40 cm holds nothing
    assert sg.awc_mm_per_m(fc2, wp, {d: 0.0 for d in sg.AWC_DEPTHS}) == pytest.approx(90.0)


def test_build_record_shape():
    raw = {p: {d: {q: 100.0 for q in sg.QUANTILES} for d in sg.AWC_DEPTHS} for p in [*sg.CARD_PROPERTIES, *sg.WATER_PROPERTIES]}
    rec = sg.build_record("karapinar", raw)
    assert [p["id"] for p in rec["properties"]] == list(sg.CARD_PROPERTIES)
    assert all(p["how_obtained"] == "wcs" and p["depth"] == "0-30 cm" for p in rec["properties"])
    assert rec["awc_mm_per_m"]["value"] == 0.0 and rec["awc_mm_per_m"]["unit"] == "mm/m"


@pytest.mark.parametrize("clay,sand,silt,expected", [
    (5, 92, 3, "sand"), (5, 82, 13, "loamy sand"), (10, 65, 25, "sandy loam"), (20, 40, 40, "loam"),
    (15, 20, 65, "silt loam"), (5, 7, 88, "silt"), (25, 60, 15, "sandy clay loam"), (33, 33, 34, "clay loam"),
    (33, 10, 57, "silty clay loam"), (40, 50, 10, "sandy clay"), (45, 10, 45, "silty clay"), (60, 20, 20, "clay"),
])
def test_usda_texture_class(clay, sand, silt, expected):
    assert sg.usda_texture_class(clay, sand, silt) == expected


def test_saxton_rawls_behaves_physically():
    fc_loam, wp_loam = sg.saxton_rawls_2006(0.40, 0.20, 2.5)
    fc_clay, wp_clay = sg.saxton_rawls_2006(0.15, 0.45, 2.5)
    fc_sand, wp_sand = sg.saxton_rawls_2006(0.88, 0.05, 1.0)
    for fc, wp in [(fc_loam, wp_loam), (fc_clay, wp_clay), (fc_sand, wp_sand)]:
        assert 0 < wp < fc < 0.6
    assert wp_sand < wp_loam < wp_clay and fc_sand < fc_loam < fc_clay
    assert 0.10 <= fc_loam - wp_loam <= 0.20          # loam AWC in the usual 100–200 mm/m band
    assert (fc_sand - wp_sand) < (fc_loam - wp_loam)


@pytest.mark.parametrize("loc", config.location_ids())
def test_pulled_values_within_physical_bounds(loc):
    path = sg.out_path(loc)
    if not path.exists():
        pytest.skip("no SoilGrids pull yet: python -m nobetsu.soilgrids")
    rec = json.loads(path.read_text(encoding="utf-8"))
    p = {x["id"]: x for x in rec["properties"]}
    for x in rec["properties"]:
        assert x["q05"] <= x["q50"] <= x["q95"], x["id"]
    assert 3 <= p["phh2o"]["q50"] <= 10
    raw = rec["raw_mapped"]
    mean_sum = sum(sg.depth_weighted({d: raw[t][d]["mean"] for d in sg.CARD_DEPTHS}, sg.CARD_DEPTHS) for t in sg.TEXTURE) / 10
    assert abs(mean_sum - 100) <= 3                                                    # mean maps: compositional
    # Q0.5 maps are predicted independently, so their sum drifts (87–92 % seen across the 13 points); loose sanity bound only
    assert abs(p["clay"]["q50"] + p["sand"]["q50"] + p["silt"]["q50"] - 100) <= 15
    assert 0.5 <= p["bdod"]["q50"] <= 2.2
    assert 0 <= p["cfvo"]["q50"] <= 100
    assert 20 <= rec["awc_mm_per_m"]["value"] <= 300
    tex = rec["texture_0_100cm"]
    assert abs(tex["clay"] + tex["sand"] + tex["silt"] - 100) <= 0.2
    assert tex["usda_class"] == sg.usda_texture_class(tex["clay"], tex["sand"], tex["silt"])
    assert 0 <= rec["cfvo_0_100cm_fraction"]["value"] < 1
    assert 50 <= rec["awc_alternatives"]["saxton_rawls_2006"]["value"] <= 250

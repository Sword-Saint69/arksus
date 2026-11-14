"""run_location() output tests: contract shape (PLAN_MVP §4.2, §4.3; ARAYUZLER §5) and physics."""

import pandas as pd
import pytest

from nobetsu import runner
from tests.fixtures import load_config, synthetic_weather

SEQUENCE_KEYS = [
    "start_year", "rotation_id", "depth_id", "pre_sowing_precip_mm", "water_at_wheat_sowing_mm",
    "fallow_storage_efficiency", "bare_days", "wind_exposed_bare_days", "bare_by_month",
    "stress_by_month", "fullness_by_month", "first_crop", "wheat",
]
FIRST_CROP_KEYS = ["crop_id", "eta_mm", "etc_mm", "stress_days", "yield_ratio"]
WHEAT_KEYS = ["eta_mm", "etc_mm", "stress_days", "heat_days_flowering", "yield_ratio"]
WEEK_KEYS = ["week_start", "p_mm", "eta_mm", "dp_mm", "aw_mm", "crop"]
ROTATIONS = ["fallow_wheat", "chickpea_wheat", "lentil_wheat"]
DEPTHS = ["shallow", "medium", "deep"]


@pytest.fixture(scope="module")
def weather():
    return synthetic_weather("2000-01-01", "2026-07-31", location_id="karapinar")


@pytest.fixture(scope="module")
def output(weather):
    return runner.run_location("karapinar", weather, None)


def _rows(output, **where):
    return [r for r in output["sequences"] if all(r[k] == v for k, v in where.items())]


def test_top_level_shape(output):
    assert list(output.keys()) == ["location_id", "awc_used", "sequences", "ledger", "diagnostics"]
    assert output["location_id"] == "karapinar"
    assert len(output["sequences"]) == 216
    assert len(output["ledger"]) == 216
    assert output["diagnostics"]["n_sequences"] == 216
    assert output["diagnostics"]["max_mass_balance_error_mm"] < 0.01


def test_every_combination_appears_once(output):
    seen = {(r["start_year"], r["rotation_id"], r["depth_id"]) for r in output["sequences"]}
    expected = {(y, r, d) for y in range(2001, 2025) for r in ROTATIONS for d in DEPTHS}
    assert seen == expected
    led = {(s["start_year"], s["rotation_id"], s["depth_id"]) for s in output["ledger"]}
    assert led == expected


def test_sequence_rows_match_contract_keys_and_types(output):
    for r in output["sequences"]:
        assert list(r.keys()) == SEQUENCE_KEYS
        assert list(r["wheat"].keys()) == WHEAT_KEYS
        for key in ("bare_by_month", "stress_by_month", "fullness_by_month"):
            assert len(r[key]) == 24
        assert all(type(v) is int for v in r["bare_by_month"] + r["stress_by_month"])
        assert all(type(v) is float for v in r["fullness_by_month"])
        for key in ("bare_days", "wind_exposed_bare_days"):
            assert type(r[key]) is int
        assert type(r["wheat"]["stress_days"]) is int and type(r["wheat"]["heat_days_flowering"]) is int
        for key in ("pre_sowing_precip_mm", "water_at_wheat_sowing_mm"):
            assert type(r[key]) is float
        if r["rotation_id"] == "fallow_wheat":
            assert r["first_crop"] is None
            assert type(r["fallow_storage_efficiency"]) is float
        else:
            assert r["fallow_storage_efficiency"] is None
            assert list(r["first_crop"].keys()) == FIRST_CROP_KEYS
            assert r["first_crop"]["crop_id"] == r["rotation_id"].split("_")[0]


def test_physical_invariants(output):
    for r in output["sequences"]:
        assert sum(r["bare_by_month"]) == r["bare_days"]
        assert 0 <= r["wind_exposed_bare_days"] <= r["bare_days"]
        assert all(0.0 <= f <= 100.0 for f in r["fullness_by_month"])
        assert 0.0 <= r["wheat"]["yield_ratio"] <= 1.0
        assert r["wheat"]["eta_mm"] <= r["wheat"]["etc_mm"] + 1e-9
        assert r["water_at_wheat_sowing_mm"] >= 0.0
        assert r["pre_sowing_precip_mm"] > 0.0
        if r["first_crop"] is not None:
            assert 0.0 <= r["first_crop"]["yield_ratio"] <= 1.0
            assert r["first_crop"]["eta_mm"] <= r["first_crop"]["etc_mm"] + 1e-9


def test_fallow_is_bare_longer_and_precip_does_not_depend_on_rotation_or_depth(output):
    for y in (2001, 2012, 2024):
        rows = _rows(output, start_year=y)
        assert len({r["pre_sowing_precip_mm"] for r in rows}) == 1
        for d in DEPTHS:
            fallow = _rows(output, start_year=y, depth_id=d, rotation_id="fallow_wheat")[0]
            for rot in ("chickpea_wheat", "lentil_wheat"):
                other = _rows(output, start_year=y, depth_id=d, rotation_id=rot)[0]
                assert fallow["bare_days"] > other["bare_days"]


def test_fallow_leaves_at_least_as_much_water_as_legumes_on_median(output):
    import statistics
    for d in DEPTHS:
        med = {
            rot: statistics.median(r["water_at_wheat_sowing_mm"] for r in _rows(output, depth_id=d, rotation_id=rot))
            for rot in ROTATIONS
        }
        assert med["fallow_wheat"] >= med["chickpea_wheat"]
        assert med["fallow_wheat"] >= med["lentil_wheat"]


def test_ledger_series_shape(output):
    for s in output["ledger"]:
        assert list(s.keys()) == ["start_year", "rotation_id", "depth_id", "weeks"]
        weeks = s["weeks"]
        assert len(weeks) == runner.LEDGER_WEEKS
        assert weeks[0]["week_start"] == f"{s['start_year']}-07-01"
        starts = pd.to_datetime([w["week_start"] for w in weeks])
        assert ((starts[1:] - starts[:-1]).days == 7).all()
        allowed = {"fallow", "wheat"} if s["rotation_id"] == "fallow_wheat" else {"bare", "wheat", s["rotation_id"].split("_")[0]}
        for w in weeks:
            assert list(w.keys()) == WEEK_KEYS
            assert w["crop"] in allowed
            assert w["p_mm"] >= 0 and w["eta_mm"] >= 0 and w["dp_mm"] >= 0 and w["aw_mm"] >= 0


def test_ledger_precip_matches_weather(output, weather):
    s = [x for x in output["ledger"] if x["start_year"] == 2010 and x["rotation_id"] == "fallow_wheat" and x["depth_id"] == "medium"][0]
    w0 = s["weeks"][0]
    assert w0["p_mm"] == pytest.approx(weather.loc["2010-07-01":"2010-07-07", "precip_mm"].sum())


def test_awc_fallback_is_marked_assumption(output):
    awc = output["awc_used"]
    assert list(awc.keys()) == ["value", "unit", "source", "type", "verified"]
    assert awc["type"] == "assumption" and awc["verified"] is False and awc["unit"] == "mm/m"


def test_awc_from_soilgrids_is_used_and_changes_results(weather, output):
    sg = {"location_id": "karapinar", "how_obtained": "wcs", "properties": [],
          "awc_mm_per_m": {"value": 90.0, "unit": "mm/m", "source": "SoilGrids 2.0 test", "type": "model", "verified": False}}
    out = runner.run_location("karapinar", weather, sg, start_years=[2010])
    assert out["awc_used"]["value"] == 90.0 and out["awc_used"]["type"] == "model"
    assert len(out["sequences"]) == 9
    a = _rows(out, start_year=2010, rotation_id="fallow_wheat", depth_id="deep")[0]
    b = _rows(output, start_year=2010, rotation_id="fallow_wheat", depth_id="deep")[0]
    assert a["fullness_by_month"] != b["fullness_by_month"]


def test_unknown_location_without_soilgrids_raises(weather):
    with pytest.raises(KeyError):
        runner.run_location("atlantis", weather, None, start_years=[2010])


def test_short_weather_raises(weather):
    with pytest.raises(ValueError):
        runner.run_location("karapinar", weather.loc["2005-01-01":], None, start_years=[2001])


# --- AWC from soil texture (soil.yaml awc_method) -----------------------------------------

def _sg(clay, sand, silt, awc=58.6):
    props = [{"id": k, "depth": "0-30 cm", "q05": 0.0, "q50": v, "q95": 100.0, "unit": "%"}
             for k, v in (("clay", clay), ("sand", sand), ("silt", silt))]
    return {"location_id": "karapinar", "how_obtained": "wcs", "properties": props,
            "awc_mm_per_m": {"value": awc, "unit": "mm/m", "source": "SoilGrids 2.0 test", "type": "model",
                             "verified": False}}


@pytest.mark.parametrize("clay, sand, silt, expected", [
    (5, 92, 3, "sand"),
    (5, 82, 13, "loamy_sand"),
    (10, 65, 25, "sandy_loam"),
    (20, 40, 40, "loam"),
    (15, 20, 65, "silt_loam"),
    (5, 5, 90, "silt"),
    (30, 35, 35, "clay_loam"),
    (33, 10, 57, "silty_clay_loam"),
    (25, 60, 15, "sandy_clay_loam"),
    (40, 50, 10, "sandy_clay"),
    (45, 10, 45, "silty_clay"),
    (60, 20, 20, "clay"),
])
def test_usda_texture_class(clay, sand, silt, expected):
    assert runner.usda_texture_class(clay, sand, silt) == expected


def test_texture_class_normalises_fractions_that_do_not_sum_to_100():
    # SoilGrids Q50 at Karapınar: 43.75 / 11.03 / 41.27 % (sum 96 %) → silty clay
    assert runner.usda_texture_class(43.75, 11.03, 41.27) == "silty_clay"
    # Develi: 36.2 / 26.9 / 29.12 % (sum 92 %) → clay loam
    assert runner.usda_texture_class(36.2, 26.9, 29.12) == "clay_loam"


def test_texture_table_awc_replaces_soilgrids_awc():
    soil_cfg = load_config("soil")
    awc, overrides = runner.soil_setup("karapinar", _sg(43.75, 11.03, 41.27), soil_cfg)
    row = soil_cfg["texture_table"]["silty_clay"]
    assert awc["value"] == row["awc_mm_per_m"]["value"]
    assert awc["type"] == "assumption" and awc["verified"] is False
    assert "silty clay" in awc["source"] and "58.6" in awc["source"]
    ze = soil_cfg["evaporation"]["ze_m"]["value"]
    assert overrides["tew_mm"] == pytest.approx(1000 * (row["theta_fc"]["value"] - 0.5 * row["theta_wp"]["value"]) * ze)
    assert overrides["rew_mm"] == row["rew_mm"]["value"]


def test_texture_alias_for_classes_missing_from_fao_table():
    soil_cfg = load_config("soil")
    awc, _ = runner.soil_setup("develi", _sg(36.2, 26.9, 29.12, awc=67.4), soil_cfg)
    assert awc["value"] == soil_cfg["texture_table"]["silty_clay_loam"]["awc_mm_per_m"]["value"]
    assert "clay loam" in awc["source"]


def test_soilgrids_method_uses_soilgrids_awc():
    soil_cfg = load_config("soil")
    soil_cfg["awc_method"]["value"] = "soilgrids"
    awc, overrides = runner.soil_setup("karapinar", _sg(43.75, 11.03, 41.27), soil_cfg)
    assert awc["value"] == 58.6 and awc["type"] == "model"
    assert overrides == {}


def test_no_soilgrids_file_uses_location_fallback():
    soil_cfg = load_config("soil")
    awc, overrides = runner.soil_setup("karapinar", None, soil_cfg)
    assert awc["value"] == soil_cfg["fallback_awc_mm_per_m"]["karapinar"]["value"]
    assert awc["type"] == "assumption" and overrides == {}


def test_unknown_awc_method_raises():
    soil_cfg = load_config("soil")
    soil_cfg["awc_method"]["value"] = "guess"
    with pytest.raises(ValueError):
        runner.soil_setup("karapinar", _sg(43.75, 11.03, 41.27), soil_cfg)


def test_run_location_with_texture_uses_table_awc(weather):
    out = runner.run_location("karapinar", weather, _sg(43.75, 11.03, 41.27), start_years=[2010])
    assert out["awc_used"]["value"] == load_config("soil")["texture_table"]["silty_clay"]["awc_mm_per_m"]["value"]
    assert out["diagnostics"]["max_mass_balance_error_mm"] < 0.01

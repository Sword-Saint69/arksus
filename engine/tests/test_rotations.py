"""Crop calendar tests (PLAN_MVP §5.3 sequence design)."""

import pandas as pd
import pytest

from nobetsu import rotations
from tests.fixtures import load_config, synthetic_weather


@pytest.fixture(scope="module")
def weather():
    return synthetic_weather("2008-01-01", "2013-12-31")


@pytest.fixture(scope="module")
def crops():
    return load_config("crops")


def _is_value_object(node):
    return isinstance(node, dict) and "value" in node


def _walk_values(node, path=""):
    if _is_value_object(node):
        yield path, node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from _walk_values(v, f"{path}.{k}" if path else str(k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk_values(v, f"{path}[{i}]")


@pytest.mark.parametrize("name", ["crops", "soil"])
def test_every_config_value_has_source_type_and_verified(name):
    found = list(_walk_values(load_config(name)))
    assert found, f"{name}.yaml has no value objects"
    for path, v in found:
        for key in ("value", "unit", "source", "type", "verified"):
            assert key in v, f"{name}.yaml {path} is missing '{key}'"
        assert str(v["source"]).strip(), f"{name}.yaml {path} has an empty source"
        assert v["type"] in {"measured", "model", "official", "statistic", "literature", "assumption"}
        assert isinstance(v["verified"], bool)


def test_season_curve_shape(crops, weather):
    c = crops["wheat"]
    curve = rotations.season_curve(c, pd.Timestamp("2010-10-15"), 0.9, weather)
    n = sum(c["stage_days"][s]["value"] for s in ("ini", "dev", "mid", "late"))
    assert len(curve) == n
    assert curve.index[0] == pd.Timestamp("2010-10-15")
    assert curve["kcb"].iloc[0] == pytest.approx(c["kcb_ini"]["value"])
    assert curve["kcb"].max() >= c["kcb_ini"]["value"]
    assert (curve["kcb"] > 0).all()
    # roots: start at zr_min, never shrink, never deeper than the depth class
    assert curve["zr_m"].iloc[0] == pytest.approx(c["zr_min_m"]["value"])
    assert (curve["zr_m"].diff().dropna() >= -1e-12).all()
    assert curve["zr_m"].max() == pytest.approx(min(c["zr_max_m"]["value"], 0.9))
    mid_start = c["stage_days"]["ini"]["value"] + c["stage_days"]["dev"]["value"]
    assert curve["zr_m"].iloc[mid_start] == pytest.approx(curve["zr_m"].max())
    assert (curve["h_m"] <= c["h_max_m"]["value"] + 1e-12).all()


@pytest.mark.parametrize("depth_m", [0.6, 0.9, 1.2])
@pytest.mark.parametrize("crop_id", ["wheat", "chickpea", "lentil"])
def test_roots_never_exceed_depth_class(crops, weather, crop_id, depth_m):
    sow = pd.Timestamp(f"2011-{crops[crop_id]['sowing']['value']}")
    curve = rotations.season_curve(crops[crop_id], sow, depth_m, weather)
    assert curve["zr_m"].max() <= depth_m + 1e-12


def test_fallow_wheat_schedule_layout(crops, weather):
    s = rotations.build_schedule(2010, ["fallow", "wheat"], crops, 0.9, weather)
    assert s.index[0] == pd.Timestamp("2009-10-01")           # spin-up start, 1 Oct y−1
    assert len(s) == (s.index[-1] - s.index[0]).days + 1          # continuous daily index
    assert s.index[-1] >= pd.Timestamp("2012-06-30")          # covers the 24-month window
    # spin-up wheat on the field in spring 2010, fallow through 2011, wheat again in spring 2012
    assert s.loc["2010-05-01", "crop"] == "wheat" and s.loc["2010-05-01", "phase"] == "spinup"
    assert s.loc["2010-09-01", "crop"] == "fallow"
    assert s.loc["2011-05-01", "crop"] == "fallow" and s.loc["2011-05-01", "kcb"] == 0.0
    assert s.loc["2011-10-15", "crop"] == "wheat" and s.loc["2011-10-15", "phase"] == "main"
    assert s.loc["2012-05-01", "crop"] == "wheat"
    assert not s.loc["2011-05-01", "is_crop"] and s.loc["2012-05-01", "is_crop"]
    assert s.attrs["main_sowing"] == "2011-10-15"
    assert s.attrs["first_crop_sowing"] is None


def test_legume_schedule_is_bare_crop_bare(crops, weather):
    s = rotations.build_schedule(2010, ["chickpea", "wheat"], crops, 0.9, weather)
    assert s.loc["2010-09-01", "crop"] == "bare"
    assert s.loc["2011-05-15", "crop"] == "chickpea" and s.loc["2011-05-15", "phase"] == "first"
    assert s.loc["2011-09-01", "crop"] == "bare"
    assert s.loc["2012-05-01", "crop"] == "wheat"
    assert s.attrs["first_crop_sowing"] == "2011-04-01"
    first = s[s["phase"] == "first"]
    assert first.index[-1] < pd.Timestamp(s.attrs["main_sowing"])


def test_all_rotations_share_spinup_and_window(crops, weather):
    a = rotations.build_schedule(2010, ["fallow", "wheat"], crops, 0.9, weather)
    b = rotations.build_schedule(2010, ["lentil", "wheat"], crops, 0.9, weather)
    assert a.index.equals(b.index)
    spin = a["phase"] == "spinup"
    assert (a.loc[spin, "kcb"] == b.loc[spin, "kcb"]).all()
    main = a["phase"] == "main"
    assert (a.loc[main, "kcb"] == b.loc[main, "kcb"]).all()
    # fallow leaves more bare days than a legume year
    assert (~a["is_crop"]).sum() > (~b["is_crop"]).sum()


def test_first_crop_must_fit_before_main_sowing(crops, weather):
    import copy
    bad = copy.deepcopy(crops)
    bad["chickpea"]["stage_days"]["mid"]["value"] = 300
    with pytest.raises(ValueError):
        rotations.build_schedule(2010, ["chickpea", "wheat"], bad, 0.9, weather)

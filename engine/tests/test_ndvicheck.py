"""MODIS NDVI vs model crop calendar (validate.ndvi_comparison) and the MODIS reader. No network."""

import numpy as np
import pandas as pd
import pytest

from nobetsu import modis, runner, validate
from tests.fixtures import synthetic_weather


def _land(peak_month: int, start="2013-01-01", end="2018-12-31") -> pd.DataFrame:
    idx = pd.date_range(start, end, freq="D")
    phase = 2 * np.pi * (idx.month - peak_month) / 12.0
    return pd.DataFrame({"kcb": np.clip(np.cos(phase), 0, None) * 1.0}, index=idx)


def _ndvi(peak_month: int, start="2013-01-01", end="2018-12-31") -> pd.Series:
    idx = pd.date_range(start, end, freq="16D")
    phase = 2 * np.pi * (idx.month - peak_month) / 12.0
    return pd.Series(0.15 + 0.25 * np.clip(np.cos(phase), 0, None), index=idx)


def test_matching_calendar_gives_same_peak_and_high_rho():
    s = validate.ndvi_comparison(_land(5), _ndvi(5))
    assert s["n_months"] >= 60
    assert s["model_peak_month"] == 5 and s["ndvi_peak_month"] == 5
    assert s["peak_offset_months"] == 0
    assert s["spearman_seasonal"] > 0.9
    assert s["ndvi_summer_peak"] is False


def test_summer_ndvi_peak_is_flagged_and_offset_is_circular():
    s = validate.ndvi_comparison(_land(5), _ndvi(8))
    assert s["ndvi_peak_month"] == 8 and s["peak_offset_months"] == 3
    assert s["ndvi_summer_peak"] is True
    s2 = validate.ndvi_comparison(_land(12), _ndvi(1))
    assert s2["peak_offset_months"] == 1          # December → January is one month, not eleven


def test_check_pending_without_enough_months():
    land = _land(5)
    short = _ndvi(5, "2013-01-01", "2013-12-31")
    c = validate.check_ndvi_calendar({"karapinar": land}, {"karapinar": short})
    assert c["id"] == "ndvi_calendar" and c["status"] == "pending"


def test_check_info_text_mentions_peaks():
    c = validate.check_ndvi_calendar({"karapinar": _land(5)}, {"karapinar": _ndvi(5)})
    assert c["status"] == "info"
    assert "Karapınar" in c["value"] and "peak" in c["value"]
    assert list(c.keys()) == ["id", "status", "value", "reference", "note"]


def test_landscape_has_kcb_cover_proxy():
    w = synthetic_weather("2012-01-01", "2016-12-31", location_id="karapinar", seed=1)
    land = runner.run_landscape("karapinar", w, None, start="2013-10-01")
    assert {"kcb", "kcb_a", "kcb_b"} <= set(land.columns)
    assert (land["kcb"] >= 0).all() and (land["kcb"] <= 1.5).all()
    both_bare = (land["crop_a"] == "bare") & (land["crop_b"] == "bare")
    assert (land.loc[both_bare, "kcb"] == 0).all()


def test_modis_scaling_and_series():
    assert modis.scale_ndvi(5040) == pytest.approx(0.504)
    assert modis.scale_ndvi(-3000) is None
    s = modis.ndvi_series({"composites": [{"date": "2019-01-01", "ndvi": 0.05},
                                          {"date": "2019-01-17", "ndvi": None}]})
    assert s.iloc[0] == pytest.approx(0.05) and np.isnan(s.iloc[1])

"""MERRA-2 soil wetness (via POWER) as the SMAP stand-in in the E1 check. No network."""

import pandas as pd
import pytest

from nobetsu import merra2, runner, validate
from tests.fixtures import synthetic_weather


def _raw(months, root, top=None, sources=("MERRA2",)):
    keys = [f"{m.year}{m.month:02d}" for m in months]
    r = dict(zip(keys, root)); r[f"{months[0].year}13"] = 0.5          # POWER's annual row
    t = dict(zip(keys, top or root))
    return {"header": {"sources": list(sources)}, "properties": {"parameter": {"GWETROOT": r, "GWETTOP": t}}}


def test_parse_drops_annual_row_and_fills():
    months = pd.date_range("2015-01-01", periods=3, freq="MS")
    d = merra2.parse(_raw(months, [0.6, -999.0, 0.4]), "karapinar")
    assert [r["month_start"] for r in d["monthly_series"]] == ["2015-01-01", "2015-02-01", "2015-03-01"]
    assert d["monthly_series"][1]["rootzone_wetness"] is None
    assert d["available"] is True and d["header_sources"] == ["MERRA2"] and "MERRA-2" in d["product"]


@pytest.fixture(scope="module")
def landscape():
    w = synthetic_weather("2012-01-01", "2026-07-31", location_id="karapinar")
    return runner.run_landscape("karapinar", w, None, start="2013-10-01", precip_correction=False)


def _merra_from(land):
    m = (land["fullness_pct"].resample("MS").mean() / 100.0).iloc[1:-1]
    return {"available": True, "monthly_series": [{"month_start": d.date().isoformat(), "rootzone_wetness": float(v),
                                                   "surface_wetness": None} for d, v in m.items()]}


def test_check_reads_the_soil_wetness_slot_and_names_merra2(landscape):
    c = validate.check_smap_anomaly({"karapinar": landscape}, {"karapinar": _merra_from(landscape)})
    assert c["status"] == "info" and "MERRA-2" in c["value"]
    assert "MERRA-2" in c["reference"] and "not independent" in c["note"]["en"]
    assert "SMAP" not in c["value"] + c["reference"] + c["note"]["en"] + c["note"]["tr"]


def test_check_pending_without_data(landscape):
    c = validate.check_smap_anomaly({"karapinar": landscape}, {})
    assert c["status"] == "pending" and "SMAP" not in c["note"]["en"]


def test_to_contract_shape():
    months = pd.date_range("2013-01-01", "2016-12-01", freq="MS")
    vals = [0.3 + 0.2 * ((m.month in (1, 2, 3)) - (m.month in (7, 8, 9))) for m in months]
    d = merra2.to_contract(merra2.parse(_raw(months, vals), "karapinar"))
    assert d["available"] is True and "MERRA-2" in d["product"] and d["cell_km"] == 55.0
    assert [c["month"] for c in d["monthly_climatology"]] == list(range(1, 13))
    assert all(0 <= c["p10"] <= c["p50"] <= c["p90"] <= 1 for c in d["monthly_climatology"])
    assert d["latest"]["date"] == "2016-12-01" and d["latest"]["rootzone_m3m3"] is None
    assert 0 <= d["latest"]["percentile_for_month"] <= 100
    assert set(d["monthly_series"][0]) == {"month_start", "rootzone_wetness", "surface_wetness"}


def test_to_contract_unavailable_without_rows():
    assert merra2.to_contract({"monthly_series": []})["available"] is False

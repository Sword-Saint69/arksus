"""GPM IMERG monthly reader (nobetsu.imerg) and its use in the precip_vs_mgm check. No network."""

import zlib

import numpy as np
import pandas as pd
import pytest

from nobetsu import imerg, validate
from tests.fixtures import load_config, synthetic_weather


# --- grid, units, decoding -----------------------------------------------------------------

def test_grid_index_cell_contains_point():
    i, j = imerg.grid_index(37.72, 33.48)
    lat_c, lon_c = imerg.cell_centre(i, j)
    assert abs(lat_c - 37.72) <= 0.05 + 1e-9 and abs(lon_c - 33.48) <= 0.05 + 1e-9


def test_grid_index_edges_and_range():
    assert imerg.grid_index(-90.0, -180.0) == (0, 0)
    assert imerg.grid_index(90.0, 180.0) == (imerg.N_LON - 1, imerg.N_LAT - 1)
    with pytest.raises(ValueError):
        imerg.grid_index(91.0, 0.0)


def test_month_total_uses_hours_in_month():
    assert imerg.month_total_mm(0.1, 2024, 2) == pytest.approx(0.1 * 24 * 29)   # leap February
    assert imerg.month_total_mm(0.1, 2023, 2) == pytest.approx(0.1 * 24 * 28)
    assert imerg.month_total_mm(0.0, 2023, 7) == 0.0


def test_decode_chunk_layout_and_fill():
    a = np.zeros((imerg.CHUNK_LON, imerg.N_LAT), dtype="<f4")
    a[3, 1277] = 0.25
    a[4, 10] = -9999.9
    out = imerg.decode_chunk(zlib.compress(a.tobytes()))
    assert out.shape == (imerg.CHUNK_LON, imerg.N_LAT)
    assert out[3, 1277] == pytest.approx(0.25)
    assert np.isnan(out[4, 10])


def test_month_of_file_name():
    p = "https://x/d736000/gpm_3imergm_v07/2008/3B-MO.MS.MRG.3IMERG.20080901-S000000-E235959.09.V07B.HDF5"
    assert imerg.month_of(p) == "2008-09"


def test_chunk_refs_maps_glade_paths_to_https():
    refs = {"refs": {"precipitation/.zarray": "{}",
                     "precipitation/5.14.0": ["/glade/campaign/collections/rda/data/d736000/f.HDF5", 10, 20],
                     "time/0": ["x", 0, 1]}}
    assert imerg.chunk_refs(refs) == {(5, 14): ("https://data.gdex.ucar.edu/d736000/f.HDF5", 10, 20)}


def test_monthly_series_keeps_missing_as_nan():
    s = imerg.monthly_series({"months": [{"month": "2001-01", "precip_mm": 30.0},
                                         {"month": "2001-02", "precip_mm": None}]})
    assert s.index[0] == pd.Timestamp("2001-01-01")
    assert s.iloc[0] == 30.0 and np.isnan(s.iloc[1])


# --- precip_vs_mgm with IMERG ---------------------------------------------------------------

def _imerg_series(annual_mm: float, years=range(2001, 2025)) -> pd.Series:
    idx = pd.date_range(f"{min(years)}-01-01", f"{max(years)}-12-01", freq="MS")
    return pd.Series(annual_mm / 12.0, index=idx)


def test_common_years_drop_incomplete_imerg_year():
    w = synthetic_weather("2000-01-01", "2026-07-31", location_id="karapinar", seed=0, annual_precip_mm=400.0)
    s = _imerg_series(300.0)
    s.loc["2010-05-01"] = np.nan
    years, power_mm, imerg_mm = validate.precip_common_years(w, s)
    assert 2010 not in years and years[0] == 2001 and years[-1] == 2024
    assert imerg_mm == pytest.approx(300.0)
    p = w["precip_mm"]
    assert power_mm == pytest.approx(p[p.index.year.isin(years)].groupby(p.index.year[p.index.year.isin(years)]).sum().mean())


def test_precip_check_adds_imerg_next_to_power():
    w = {"karapinar": synthetic_weather("2000-01-01", "2026-07-31", location_id="karapinar", seed=0,
                                        annual_precip_mm=400.0)}
    refs = load_config("references")
    refs["mgm_annual_precip_mm"]["karapinar"].update(value=300.0, station="Test station")
    c = validate.check_precip(w, refs, {"karapinar": _imerg_series(330.0)})
    assert c["status"] == "info"
    assert "IMERG 330 mm/yr" in c["value"] and "+10 %" in c["value"]
    assert "2001–2024" in c["value"]
    assert "IMERG" in c["reference"] and "IMERG" in c["note"]["tr"]


def test_precip_check_without_imerg_is_unchanged():
    w = {"karapinar": synthetic_weather("2000-01-01", "2026-07-31", location_id="karapinar", seed=0,
                                        annual_precip_mm=400.0)}
    refs = load_config("references")
    refs["mgm_annual_precip_mm"]["karapinar"].update(value=300.0, station="Test station")
    c = validate.check_precip(w, refs, {})
    assert "IMERG" not in c["value"] and "IMERG" not in c["reference"]

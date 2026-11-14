"""FAO-56 ET0 tests.

Reference: Allen, Pereira, Raes & Smith (1998), FAO Irrigation and Drainage Paper 56,
Chapter 4, Example 18 ("Determination of ETo with daily data", Brussels, 6 July).
Inputs and expected values below are copied from that example.
Checked 14 Nov against https://www.fao.org/4/x0490e/x0490e08.htm (all inputs and printed
intermediates match; the page prints Rns = 17.00 and N both as 16.1 and 16.3).

Tolerances: the book rounds intermediates to 2–4 significant digits, so intermediate
checks use a tolerance of about one unit in the last printed digit. The final ET0 must
match within ±0.1 mm/day (PLAN_MVP §5.2).
"""

import numpy as np
import pandas as pd
import pytest

from nobetsu import et0
from tests.fixtures import synthetic_weather

# --- Example 18 inputs ---------------------------------------------------------------
LAT_DEG = 50.0 + 48.0 / 60.0  # 50°48' N
ELEV_M = 100.0
DOY = 187  # 6 July
TMAX = 21.5
TMIN = 12.3
RH_MAX = 84.0
RH_MIN = 63.0
U10_KMH = 10.0  # wind speed measured at 10 m
SUN_HOURS = 9.25

# --- Example 18 printed results ------------------------------------------------------
EX18 = {
    "pressure_kpa": 100.1,
    "gamma": 0.0666,
    "tmean": 16.9,
    "delta": 0.122,
    "es_tmax": 2.564,
    "es_tmin": 1.431,
    "es": 1.997,
    "ea": 1.409,
    "u2": 2.078,
    "ra": 41.09,
    "rs": 22.07,
    "rso": 30.90,
    "rns": 17.00,
    "rnl": 3.71,
    "rn": 13.28,
    "et0": 3.9,
}


def _u2():
    return et0.wind_at_2m(U10_KMH / 3.6, 10.0)


def _rs():
    return et0.rs_from_sunshine(SUN_HOURS, LAT_DEG, DOY)


def test_pressure_and_gamma():
    p = et0.atmospheric_pressure(ELEV_M)
    assert p == pytest.approx(EX18["pressure_kpa"], abs=0.05)
    assert et0.psychrometric_constant(p) == pytest.approx(EX18["gamma"], abs=0.0001)


def test_saturation_vapour_pressure():
    assert et0.sat_vapour_pressure(TMAX) == pytest.approx(EX18["es_tmax"], abs=0.001)
    assert et0.sat_vapour_pressure(TMIN) == pytest.approx(EX18["es_tmin"], abs=0.001)
    assert et0.mean_sat_vapour_pressure(TMAX, TMIN) == pytest.approx(EX18["es"], abs=0.001)


def test_slope_of_vapour_pressure_curve():
    tmean = (TMAX + TMIN) / 2
    assert tmean == pytest.approx(EX18["tmean"], abs=0.05)
    assert et0.slope_vapour_pressure_curve(tmean) == pytest.approx(EX18["delta"], abs=0.001)


def test_actual_vapour_pressure_from_rh_minmax():
    ea = et0.ea_from_rh_minmax(TMAX, TMIN, RH_MAX, RH_MIN)
    assert ea == pytest.approx(EX18["ea"], abs=0.001)


def test_actual_vapour_pressure_from_dewpoint_equals_es_at_tdew():
    # FAO-56 Eq. 14: ea = e°(Tdew)
    for t in (-5.0, 0.0, 10.0, 20.0):
        assert et0.ea_from_tdew(t) == pytest.approx(et0.sat_vapour_pressure(t))


def test_wind_at_2m():
    assert _u2() == pytest.approx(EX18["u2"], abs=0.002)


def test_extraterrestrial_radiation():
    assert et0.extraterrestrial_radiation(LAT_DEG, DOY) == pytest.approx(EX18["ra"], abs=0.02)


def test_solar_radiation_terms():
    ra = et0.extraterrestrial_radiation(LAT_DEG, DOY)
    rs = _rs()
    assert rs == pytest.approx(EX18["rs"], abs=0.05)
    assert et0.clear_sky_radiation(ra, ELEV_M) == pytest.approx(EX18["rso"], abs=0.02)
    assert et0.net_shortwave(rs) == pytest.approx(EX18["rns"], abs=0.02)


def test_net_longwave_and_net_radiation():
    ra = et0.extraterrestrial_radiation(LAT_DEG, DOY)
    rso = et0.clear_sky_radiation(ra, ELEV_M)
    ea = et0.ea_from_rh_minmax(TMAX, TMIN, RH_MAX, RH_MIN)
    rs = _rs()
    rnl = et0.net_longwave(TMAX, TMIN, ea, rs, rso)
    assert rnl == pytest.approx(EX18["rnl"], abs=0.02)
    assert et0.net_shortwave(rs) - rnl == pytest.approx(EX18["rn"], abs=0.03)


def test_example18_et0_within_tolerance():
    ea = et0.ea_from_rh_minmax(TMAX, TMIN, RH_MAX, RH_MIN)
    value = et0.et0_daily(
        tmax_c=TMAX, tmin_c=TMIN, ea_kpa=ea, rs_mj_m2=_rs(), u2_ms=_u2(),
        lat_deg=LAT_DEG, elevation_m=ELEV_M, doy=DOY,
    )
    assert abs(value - EX18["et0"]) <= 0.1


def test_et0_daily_is_vectorised():
    ea = et0.ea_from_rh_minmax(TMAX, TMIN, RH_MAX, RH_MIN)
    out = et0.et0_daily(
        tmax_c=np.array([TMAX, TMAX]), tmin_c=np.array([TMIN, TMIN]), ea_kpa=np.array([ea, ea]),
        rs_mj_m2=np.array([_rs(), _rs()]), u2_ms=np.array([_u2(), _u2()]),
        lat_deg=LAT_DEG, elevation_m=ELEV_M, doy=np.array([DOY, DOY]),
    )
    assert out.shape == (2,)
    assert out[0] == pytest.approx(out[1])


def test_et0_from_weather_dataframe():
    w = synthetic_weather("2010-01-01", "2011-12-31")
    s = et0.et0_from_weather(w)
    assert isinstance(s, pd.Series)
    assert s.index.equals(w.index)
    assert s.name == "et0_mm"
    assert not s.isna().any()
    assert (s >= 0).all()
    # summer demand exceeds winter demand in the mid-latitude synthetic climate
    assert s[s.index.month == 7].mean() > s[s.index.month == 1].mean()


def test_et0_from_weather_requires_attrs():
    w = synthetic_weather("2010-01-01", "2010-01-31")
    del w.attrs["elevation_m"]
    with pytest.raises(KeyError):
        et0.et0_from_weather(w)


def test_et0_from_weather_rejects_nan():
    w = synthetic_weather("2010-01-01", "2010-01-31")
    w.iloc[3, w.columns.get_loc("tmax_c")] = np.nan
    with pytest.raises(ValueError):
        et0.et0_from_weather(w)

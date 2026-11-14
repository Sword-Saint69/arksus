"""Reference evapotranspiration, FAO-56 Penman–Monteith (daily).

Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration.
FAO Irrigation and Drainage Paper 56, Chapter 3 (equations cited below) and Eq. 6.

The constants in this module are part of the FAO-56 method itself (grass reference
surface, Stefan–Boltzmann constant, Ångström defaults), not site or crop parameters,
so they live here rather than in engine/config/*.yaml.

All functions accept scalars or numpy arrays. Temperatures in °C, pressures in kPa,
radiation in MJ m-2 day-1, wind in m s-1, ET in mm day-1.

Note: NASA POWER `EVPTRNS` is NOT ET0 and is never used (PLAN_MVP §5.2).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

SOLAR_CONSTANT = 0.0820          # Gsc, MJ m-2 min-1 (Eq. 21)
STEFAN_BOLTZMANN = 4.903e-9      # σ, MJ K-4 m-2 day-1 (Eq. 39)
ALBEDO_GRASS = 0.23              # α for the hypothetical grass reference (Eq. 38)
CN_DAILY = 900.0                 # numerator constant, daily step (Eq. 6)
CD_DAILY = 0.34                  # denominator constant, daily step (Eq. 6)
ANGSTROM_AS = 0.25               # default a_s (Eq. 35)
ANGSTROM_BS = 0.50               # default b_s (Eq. 35)

REQUIRED_COLUMNS = ("tmax_c", "tmin_c", "tdew_c", "u2_ms", "rs_mj_m2")


# --- Atmospheric parameters ----------------------------------------------------------

def atmospheric_pressure(elevation_m):
    """P (kPa) from elevation (Eq. 7)."""
    return 101.3 * ((293.0 - 0.0065 * np.asarray(elevation_m, dtype=float)) / 293.0) ** 5.26


def psychrometric_constant(pressure_kpa):
    """γ (kPa °C-1) (Eq. 8)."""
    return 0.665e-3 * np.asarray(pressure_kpa, dtype=float)


# --- Humidity ------------------------------------------------------------------------

def sat_vapour_pressure(t_c):
    """e°(T) (kPa) (Eq. 11)."""
    t = np.asarray(t_c, dtype=float)
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def mean_sat_vapour_pressure(tmax_c, tmin_c):
    """es = (e°(Tmax) + e°(Tmin)) / 2 (Eq. 12)."""
    return (sat_vapour_pressure(tmax_c) + sat_vapour_pressure(tmin_c)) / 2.0


def slope_vapour_pressure_curve(tmean_c):
    """Δ (kPa °C-1) at Tmean (Eq. 13)."""
    t = np.asarray(tmean_c, dtype=float)
    return 4098.0 * sat_vapour_pressure(t) / (t + 237.3) ** 2


def ea_from_tdew(tdew_c):
    """ea (kPa) from dewpoint (Eq. 14). Preferred path for NASA POWER (T2MDEW)."""
    return sat_vapour_pressure(tdew_c)


def ea_from_rh_minmax(tmax_c, tmin_c, rh_max_pct, rh_min_pct):
    """ea (kPa) from RHmax and RHmin (Eq. 17)."""
    return (
        sat_vapour_pressure(tmin_c) * np.asarray(rh_max_pct, dtype=float) / 100.0
        + sat_vapour_pressure(tmax_c) * np.asarray(rh_min_pct, dtype=float) / 100.0
    ) / 2.0


# --- Wind ----------------------------------------------------------------------------

def wind_at_2m(uz_ms, z_m):
    """u2 (m s-1) from wind measured at height z (Eq. 47)."""
    return np.asarray(uz_ms, dtype=float) * 4.87 / np.log(67.8 * np.asarray(z_m, dtype=float) - 5.42)


# --- Radiation -----------------------------------------------------------------------

def _solar_geometry(lat_deg, doy):
    phi = np.deg2rad(np.asarray(lat_deg, dtype=float))
    j = np.asarray(doy, dtype=float)
    dr = 1.0 + 0.033 * np.cos(2.0 * np.pi * j / 365.0)            # Eq. 23
    decl = 0.409 * np.sin(2.0 * np.pi * j / 365.0 - 1.39)          # Eq. 24
    x = np.clip(-np.tan(phi) * np.tan(decl), -1.0, 1.0)
    ws = np.arccos(x)                                             # Eq. 25
    return phi, dr, decl, ws


def extraterrestrial_radiation(lat_deg, doy):
    """Ra (MJ m-2 day-1) (Eq. 21)."""
    phi, dr, decl, ws = _solar_geometry(lat_deg, doy)
    return (24.0 * 60.0 / np.pi) * SOLAR_CONSTANT * dr * (
        ws * np.sin(phi) * np.sin(decl) + np.cos(phi) * np.cos(decl) * np.sin(ws)
    )


def daylight_hours(lat_deg, doy):
    """N (hours) (Eq. 34)."""
    _, _, _, ws = _solar_geometry(lat_deg, doy)
    return 24.0 / np.pi * ws


def rs_from_sunshine(sun_hours, lat_deg, doy, a_s=ANGSTROM_AS, b_s=ANGSTROM_BS):
    """Rs (MJ m-2 day-1) from sunshine duration, Ångström (Eq. 35).

    Only used for the Example 18 test; NASA POWER provides Rs directly.
    """
    ra = extraterrestrial_radiation(lat_deg, doy)
    n_max = daylight_hours(lat_deg, doy)
    return (a_s + b_s * np.asarray(sun_hours, dtype=float) / n_max) * ra


def clear_sky_radiation(ra, elevation_m):
    """Rso (MJ m-2 day-1) (Eq. 37)."""
    return (0.75 + 2e-5 * np.asarray(elevation_m, dtype=float)) * np.asarray(ra, dtype=float)


def net_shortwave(rs, albedo=ALBEDO_GRASS):
    """Rns (MJ m-2 day-1) (Eq. 38)."""
    return (1.0 - albedo) * np.asarray(rs, dtype=float)


def net_longwave(tmax_c, tmin_c, ea_kpa, rs, rso):
    """Rnl (MJ m-2 day-1) (Eq. 39). Rs/Rso is limited to ≤ 1.0 as FAO-56 requires."""
    tmax_k4 = (np.asarray(tmax_c, dtype=float) + 273.16) ** 4
    tmin_k4 = (np.asarray(tmin_c, dtype=float) + 273.16) ** 4
    rs_rso = np.clip(np.asarray(rs, dtype=float) / np.asarray(rso, dtype=float), 0.0, 1.0)
    return (
        STEFAN_BOLTZMANN * (tmax_k4 + tmin_k4) / 2.0
        * (0.34 - 0.14 * np.sqrt(np.asarray(ea_kpa, dtype=float)))
        * (1.35 * rs_rso - 0.35)
    )


# --- Penman–Monteith -----------------------------------------------------------------

def et0_daily(*, tmax_c, tmin_c, ea_kpa, rs_mj_m2, u2_ms, lat_deg, elevation_m, doy, g_mj_m2=0.0):
    """Daily grass-reference ET0 (mm day-1), FAO-56 Eq. 6.

    Soil heat flux G is ~0 for daily steps (Eq. 42). Negative results are clipped to 0.
    """
    tmax = np.asarray(tmax_c, dtype=float)
    tmin = np.asarray(tmin_c, dtype=float)
    ea = np.asarray(ea_kpa, dtype=float)
    rs = np.asarray(rs_mj_m2, dtype=float)
    u2 = np.asarray(u2_ms, dtype=float)

    tmean = (tmax + tmin) / 2.0
    gamma = psychrometric_constant(atmospheric_pressure(elevation_m))
    delta = slope_vapour_pressure_curve(tmean)
    es = mean_sat_vapour_pressure(tmax, tmin)
    # Tdew can exceed Tmin slightly in reanalysis; ea above es would make VPD negative.
    vpd = np.maximum(es - ea, 0.0)

    ra = extraterrestrial_radiation(lat_deg, doy)
    rso = clear_sky_radiation(ra, elevation_m)
    rn = net_shortwave(rs) - net_longwave(tmax, tmin, ea, rs, rso)

    num = 0.408 * delta * (rn - g_mj_m2) + gamma * (CN_DAILY / (tmean + 273.0)) * u2 * vpd
    den = delta + gamma * (1.0 + CD_DAILY * u2)
    return np.maximum(num / den, 0.0)


def et0_from_weather(weather: pd.DataFrame) -> pd.Series:
    """ET0 series for a weather frame in the ARAYUZLER §2 format.

    Uses tdew_c for ea (Eq. 14), rs_mj_m2 from POWER, u2_ms already at 2 m,
    attrs["lat"] and attrs["elevation_m"]. Raises on missing attrs/columns or NaN.
    """
    lat = weather.attrs["lat"]
    elev = weather.attrs["elevation_m"]
    missing = [c for c in REQUIRED_COLUMNS if c not in weather.columns]
    if missing:
        raise KeyError(f"weather is missing columns: {missing}")
    if weather[list(REQUIRED_COLUMNS)].isna().any().any():
        raise ValueError("weather contains NaN; load_weather() must fill or fail before the engine")

    values = et0_daily(
        tmax_c=weather["tmax_c"].to_numpy(),
        tmin_c=weather["tmin_c"].to_numpy(),
        ea_kpa=ea_from_tdew(weather["tdew_c"].to_numpy()),
        rs_mj_m2=weather["rs_mj_m2"].to_numpy(),
        u2_ms=weather["u2_ms"].to_numpy(),
        lat_deg=lat,
        elevation_m=elev,
        doy=weather.index.day_of_year.to_numpy(),
    )
    return pd.Series(values, index=weather.index, name="et0_mm")

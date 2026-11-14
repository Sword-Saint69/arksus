"""Daily two-layer soil water balance with the FAO-56 dual crop coefficient.

Method: Allen et al. (1998), FAO Irrigation and Drainage Paper 56, Chapter 7
(ETc = (Kcb·Ks + Ke)·ET0, Eq. 69–82) and Chapter 8 (Ks, Eq. 84). Structure: PLAN_MVP §5.3.

Stores (all in mm of water)
---------------------------
The profile of depth D is split into the current root zone (layer 1, thickness
Z1 = max(Zr, Ze)) and the soil below it (layer 2, thickness D − Z1). The top Ze of
layer 1 is the FAO-56 surface evaporation layer ("slab"), tracked as its own store so
that evaporation and the root-zone balance use ONE water account and mass closes exactly:

  slab  0 … TEW          water in the top Ze above half of wilting point.
                         De (FAO-56 depletion of the evaporation layer) = TEW − slab.
                         Only the part above wilting point, slab − (TEW − AWC·Ze), is
                         plant-available.
  s1    0 … AWC·(Z1−Ze)  plant-available water in the rest of the root zone.
  s2    0 … AWC·(D−Z1)   plant-available water below the roots.

Daily order: (1) root zone moves to today's depth, water follows the boundary;
(2) rain fills slab → s1 → s2, the rest is deep percolation; (3) evaporation and
transpiration are computed from that state and withdrawn.

Stated assumptions (shown in the UI): no runoff, no snow, no capillary rise, no stubble
mulch, no irrigation. Two simplifications relative to FAO-56 Chapter 7, both needed for
exact mass closure: the evaporation layer is depleted by E averaged over the whole
surface (FAO-56 uses E/few for the exposed fraction), and transpiration takes water from
the evaporation layer in proportion to the available water there. Neither affects bare
soil or fallow (few = 1, Kcb = 0).

The constants below belong to the FAO-56 method, not to a site or a crop.
There are no crop-specific branches: crops enter only through the daily kcb, zr_m, h_m
and p columns built by rotations.py from engine/config/crops.yaml.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from nobetsu import et0 as et0_mod

KC_MIN = 0.15          # Kc of dry bare soil, lower limit for the cover fraction (Eq. 76)
KC_MAX_BASE = 1.2      # upper limit on evaporation + transpiration after wetting (Eq. 72)
FEW_MIN = 0.01         # numerical floor for the exposed and wetted soil fraction
P_ETC_SLOPE = 0.04     # p = p_table + 0.04·(5 − ETc), limited to 0.1–0.8 (Table 22 footnote)
P_MIN, P_MAX = 0.1, 0.8
_TINY = 1e-12

INPUT_COLUMNS = ("precip_mm", "et0_mm", "u2_ms", "rhmin_pct", "kcb", "zr_m", "h_m", "p")


@dataclass(frozen=True)
class SoilProfile:
    awc_mm_per_m: float   # available water capacity (θFC − θWP) × 1000
    depth_m: float        # depth class D
    ze_m: float           # thickness of the surface evaporation layer
    tew_mm: float         # total evaporable water of that layer
    rew_mm: float         # readily evaporable water (stage 1)

    def __post_init__(self):
        if self.awc_mm_per_m <= 0:
            raise ValueError("awc_mm_per_m must be positive")
        if self.ze_m <= 0 or self.depth_m <= self.ze_m:
            raise ValueError("depth_m must be greater than ze_m > 0")
        if not (0 <= self.rew_mm <= self.tew_mm) or self.tew_mm <= 0:
            raise ValueError("need 0 <= rew_mm <= tew_mm and tew_mm > 0")
        # The evaporation layer holds at least its own plant-available water.
        if self.tew_mm < self.awc_mm_per_m * self.ze_m:
            object.__setattr__(self, "tew_mm", self.awc_mm_per_m * self.ze_m)

    @classmethod
    def from_config(cls, soil_cfg: dict, *, awc_mm_per_m: float, depth_m: float,
                    tew_mm: float | None = None, rew_mm: float | None = None) -> "SoilProfile":
        """TEW / REW from soil.yaml `evaporation` unless given (texture-based values)."""
        ev = soil_cfg["evaporation"]
        return cls(
            awc_mm_per_m=float(awc_mm_per_m),
            depth_m=float(depth_m),
            ze_m=float(ev["ze_m"]["value"]),
            tew_mm=float(ev["tew_mm"]["value"] if tew_mm is None else tew_mm),
            rew_mm=float(ev["rew_mm"]["value"] if rew_mm is None else rew_mm),
        )

    @property
    def slab_available_mm(self) -> float:
        """Plant-available capacity of the evaporation layer."""
        return self.awc_mm_per_m * self.ze_m

    @property
    def slab_dead_mm(self) -> float:
        """Evaporable water below wilting point (TEW − AWC·Ze)."""
        return self.tew_mm - self.slab_available_mm

    @property
    def capacity_mm(self) -> float:
        """Plant-available water capacity of the whole profile."""
        return self.awc_mm_per_m * self.depth_m


def daily_inputs(weather: pd.DataFrame, schedule: pd.DataFrame) -> pd.DataFrame:
    """Join weather (ARAYUZLER §2) and a crop schedule (rotations.py) into engine inputs.

    RHmin is estimated as 100·e°(Tdew)/e°(Tmax) (FAO-56 Eq. 64 with measured dewpoint).
    """
    if schedule.index[0] < weather.index[0] or schedule.index[-1] > weather.index[-1]:
        raise ValueError(
            f"weather ({weather.index[0].date()} → {weather.index[-1].date()}) does not cover "
            f"the schedule ({schedule.index[0].date()} → {schedule.index[-1].date()})"
        )
    w = weather.loc[schedule.index[0]:schedule.index[-1]]
    if not w.index.equals(schedule.index):
        raise ValueError("weather index is not a continuous daily index over the schedule")
    rhmin = 100.0 * et0_mod.sat_vapour_pressure(w["tdew_c"]) / et0_mod.sat_vapour_pressure(w["tmax_c"])
    return pd.DataFrame(
        {
            "precip_mm": w["precip_mm"].to_numpy(dtype=float),
            "et0_mm": et0_mod.et0_from_weather(weather).loc[schedule.index].to_numpy(),
            "u2_ms": w["u2_ms"].to_numpy(dtype=float),
            "rhmin_pct": np.clip(np.asarray(rhmin, dtype=float), 0.0, 100.0),
            "kcb": schedule["kcb"].to_numpy(dtype=float),
            "zr_m": schedule["zr_m"].to_numpy(dtype=float),
            "h_m": schedule["h_m"].to_numpy(dtype=float),
            "p": schedule["p"].to_numpy(dtype=float),
        },
        index=schedule.index,
    )


def climate_adjustment(u2_ms, rhmin_pct, h_m):
    """[0.04(u2 − 2) − 0.004(RHmin − 45)]·(h/3)^0.3, the climate term of Eq. 70 and 72.

    FAO-56 limits: u2 1–6 m/s, RHmin 20–80 %, h 0.1–10 m (0 for bare soil).
    """
    u2 = np.clip(u2_ms, 1.0, 6.0)
    rh = np.clip(rhmin_pct, 20.0, 80.0)
    h = np.clip(h_m, 0.0, 10.0)
    return (0.04 * (u2 - 2.0) - 0.004 * (rh - 45.0)) * (h / 3.0) ** 0.3


def simulate(
    daily: pd.DataFrame,
    soil: SoilProfile,
    init_fraction: float = 0.5,
    initial_de_mm: float | None = None,
) -> pd.DataFrame:
    """Run the daily balance over `daily` (columns INPUT_COLUMNS, continuous daily index).

    init_fraction: share of the plant-available capacity filled in every store on day 0.
    initial_de_mm: optional starting depletion of the evaporation layer (0 … TEW);
                   overrides init_fraction for the slab (used in tests).

    Returns a frame on the same index. Fluxes are daily totals, states are end-of-day
    except dr_mm / raw_mm / taw_mm / de_mm / stage2, which are the values after rain and
    before evapotranspiration (the state Ks and Kr were computed from).
    attrs: initial_storage_mm, initial_aw_mm, capacity_mm.
    """
    missing = [c for c in INPUT_COLUMNS if c not in daily.columns]
    if missing:
        raise KeyError(f"daily inputs are missing columns: {missing}")
    if daily[list(INPUT_COLUMNS)].isna().any().any():
        raise ValueError("daily inputs contain NaN")
    if not 0.0 <= init_fraction <= 1.0:
        raise ValueError("init_fraction must be within 0–1")

    awc, depth, ze = soil.awc_mm_per_m, soil.depth_m, soil.ze_m
    tew, rew, dead = soil.tew_mm, soil.rew_mm, soil.slab_dead_mm

    precip = daily["precip_mm"].to_numpy(dtype=float)
    et0 = daily["et0_mm"].to_numpy(dtype=float)
    kcb_a = daily["kcb"].to_numpy(dtype=float)
    p_a = daily["p"].to_numpy(dtype=float)
    z_a = np.clip(daily["zr_m"].to_numpy(dtype=float), ze, depth)
    adj_a = climate_adjustment(
        daily["u2_ms"].to_numpy(dtype=float),
        daily["rhmin_pct"].to_numpy(dtype=float),
        daily["h_m"].to_numpy(dtype=float),
    )
    h_a = daily["h_m"].to_numpy(dtype=float)
    if (precip < 0).any() or (et0 < 0).any() or (kcb_a < 0).any():
        raise ValueError("precip_mm, et0_mm and kcb must be non-negative")

    n = len(daily)
    cols = (
        "e_mm", "t_mm", "eta_mm", "etc_mm", "dp_mm", "ks", "ke", "z1_m", "de_mm",
        "dr_mm", "raw_mm", "taw_mm", "slab_mm", "s1_mm", "s2_mm", "aw_mm", "storage_mm",
    )
    o = {c: np.zeros(n) for c in cols}
    stage2 = np.zeros(n, dtype=bool)

    # --- initial state -------------------------------------------------------------------
    z1 = z_a[0] if n else ze
    slab = dead + init_fraction * soil.slab_available_mm
    if initial_de_mm is not None:
        if not 0.0 <= initial_de_mm <= tew:
            raise ValueError("initial_de_mm must be within 0 … TEW")
        slab = tew - initial_de_mm
    s1 = init_fraction * awc * (z1 - ze)
    s2 = init_fraction * awc * (depth - z1)
    initial_storage = slab + s1 + s2
    initial_aw = max(slab - dead, 0.0) + s1 + s2

    for i in range(n):
        # (1) root-zone boundary moves; water follows it (uniform within each layer) -------
        z_new = z_a[i]
        if z_new > z1:
            thick2 = depth - z1
            moved = s2 * (z_new - z1) / thick2 if thick2 > _TINY else 0.0
            s1 += moved
            s2 -= moved
        elif z_new < z1:
            thick1 = z1 - ze
            moved = s1 * (z1 - z_new) / thick1 if thick1 > _TINY else 0.0
            s1 -= moved
            s2 += moved
        z1 = z_new
        cap1 = awc * (z1 - ze)
        cap2 = awc * (depth - z1)
        s1 = min(max(s1, 0.0), cap1)
        s2 = min(max(s2, 0.0), cap2)

        # (2) rain: slab → rest of root zone → below roots → deep percolation -------------
        water = precip[i]
        add = min(water, tew - slab)
        slab += add
        water -= add
        add = min(water, cap1 - s1)
        s1 += add
        water -= add
        add = min(water, cap2 - s2)
        s2 += add
        dp = water - add

        # (3) coefficients from the state after rain --------------------------------------
        kcb = kcb_a[i]
        kc_max = max(KC_MAX_BASE + adj_a[i], kcb + 0.05)                    # Eq. 72
        if kcb > KC_MIN:
            fc = ((kcb - KC_MIN) / (kc_max - KC_MIN)) ** (1.0 + 0.5 * h_a[i])  # Eq. 76
            fc = min(max(fc, 0.0), 0.99)
        else:
            fc = 0.0
        few = max(1.0 - fc, FEW_MIN)                                         # Eq. 75, fw = 1 (rain)

        de = tew - slab
        if de <= rew:
            kr = 1.0                                                         # stage 1
        else:
            kr = (tew - de) / (tew - rew) if tew > rew else 0.0              # Eq. 74
        ke = max(min(kr * (kc_max - kcb), few * kc_max), 0.0)                # Eq. 71
        e = min(ke * et0[i], slab)

        taw = awc * z1                                                       # Eq. 82
        dr = taw - (max(slab - dead, 0.0) + s1)
        etc = kcb * et0[i] + e
        if kcb > 0.0:
            p = min(max(p_a[i] + P_ETC_SLOPE * (5.0 - etc), P_MIN), P_MAX)
            raw = p * taw                                                    # Eq. 83
            ks = 1.0 if dr <= raw else max((taw - dr) / ((1.0 - p) * taw), 0.0)  # Eq. 84
        else:
            raw = 0.0
            ks = 1.0

        # (4) withdraw evaporation, then transpiration ------------------------------------
        slab -= e
        slab_av = max(slab - dead, 0.0)
        avail = slab_av + s1
        t = min(ks * kcb * et0[i], avail)
        if t > 0.0:
            frac = t / avail
            slab -= slab_av * frac
            s1 -= s1 * frac
        slab = max(slab, 0.0)
        s1 = max(s1, 0.0)

        o["e_mm"][i] = e
        o["t_mm"][i] = t
        o["eta_mm"][i] = e + t
        o["etc_mm"][i] = etc
        o["dp_mm"][i] = dp
        o["ks"][i] = ks
        o["ke"][i] = ke
        o["z1_m"][i] = z1
        o["de_mm"][i] = de
        stage2[i] = de > rew
        o["dr_mm"][i] = dr
        o["raw_mm"][i] = raw
        o["taw_mm"][i] = taw
        o["slab_mm"][i] = slab
        o["s1_mm"][i] = s1
        o["s2_mm"][i] = s2
        o["aw_mm"][i] = max(slab - dead, 0.0) + s1 + s2
        o["storage_mm"][i] = slab + s1 + s2

    out = pd.DataFrame(
        {"precip_mm": precip, "et0_mm": et0, "kcb": kcb_a, **o, "stage2": stage2},
        index=daily.index,
    )
    out.attrs.update(
        initial_storage_mm=initial_storage,
        initial_aw_mm=initial_aw,
        capacity_mm=soil.capacity_mm,
    )
    return out


def mass_balance_error(out: pd.DataFrame) -> float:
    """|ΣP − ΣETa − ΣDP − ΔS| in mm over a simulate() result (0 for an empty frame)."""
    if len(out) == 0:
        return 0.0
    delta_s = out["storage_mm"].iloc[-1] - out.attrs["initial_storage_mm"]
    return float(abs(out["precip_mm"].sum() - out["eta_mm"].sum() - out["dp_mm"].sum() - delta_s))


def mass_balance_summary(out: pd.DataFrame) -> dict:
    """Totals for a printed mass-balance report."""
    return {
        "days": int(len(out)),
        "precip_mm": float(out["precip_mm"].sum()),
        "evaporation_mm": float(out["e_mm"].sum()),
        "transpiration_mm": float(out["t_mm"].sum()),
        "eta_mm": float(out["eta_mm"].sum()),
        "deep_percolation_mm": float(out["dp_mm"].sum()),
        "storage_start_mm": float(out.attrs["initial_storage_mm"]),
        "storage_end_mm": float(out["storage_mm"].iloc[-1]),
        "delta_storage_mm": float(out["storage_mm"].iloc[-1] - out.attrs["initial_storage_mm"]),
        "error_mm": mass_balance_error(out),
    }

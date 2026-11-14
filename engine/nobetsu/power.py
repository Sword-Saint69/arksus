"""NASA POWER daily weather (ARAYUZLER §2). Owner: Gümüş.

M0 skeleton: signature and column contract are frozen; implementation is the next task (T+1–2).
"""

from __future__ import annotations

import pandas as pd

# Contract column names (ARAYUZLER §2) -> POWER parameter
COLUMNS = {
    "precip_mm": "PRECTOTCORR",
    "tmax_c": "T2M_MAX",
    "tmin_c": "T2M_MIN",
    "tdew_c": "T2MDEW",
    "rh_pct": "RH2M",
    "u2_ms": "WS2M",
    "u2max_ms": "WS2M_MAX",
    "rs_mj_m2": "ALLSKY_SFC_SW_DWN",
}
SOURCE = "NASA POWER daily, community=AG"


def load_weather(location_id: str) -> pd.DataFrame:
    """Daily, gap-free DataFrame indexed by `date`, columns = COLUMNS keys, attrs per ARAYUZLER §2."""
    raise NotImplementedError("power.load_weather: T+1–2 task (Gümüş)")

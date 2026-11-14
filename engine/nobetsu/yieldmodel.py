"""Water-limited yield ratio Ya/Ym (PLAN_MVP §5.4).

FAO Irrigation and Drainage Paper 33 (Doorenbos & Kassam, 1979), seasonal form:
    1 − Ya/Ym = Ky · (1 − ΣETa/ΣETc)

The engine outputs only this ratio (0–1); kg/da and TL are computed in the browser.
No "previous crop" multiplier is applied: the fallow advantage in field trials is mostly
water, which the water balance already accounts for (trial numbers are used for
validation only).
"""

from __future__ import annotations


def yield_ratio(eta_mm: float, etc_mm: float, ky: float) -> float:
    """max(0, 1 − Ky·(1 − ΣETa/ΣETc)), capped at 1, over one crop season."""
    if etc_mm <= 0:
        raise ValueError("seasonal ETc must be positive")
    if eta_mm < 0:
        raise ValueError("seasonal ETa must be non-negative")
    if ky <= 0:
        raise ValueError("Ky must be positive")
    relative_et = min(eta_mm / etc_mm, 1.0)
    return float(min(max(1.0 - ky * (1.0 - relative_et), 0.0), 1.0))

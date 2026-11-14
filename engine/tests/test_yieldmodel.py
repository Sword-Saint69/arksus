"""Yield ratio tests (PLAN_MVP §5.4, FAO-33)."""

import pytest

from nobetsu.yieldmodel import yield_ratio


def test_no_stress_gives_full_yield():
    assert yield_ratio(400.0, 400.0, 1.05) == pytest.approx(1.0)


def test_hand_computed_example():
    # ETa/ETc = 0.8, Ky = 1.05 → 1 − 1.05 × 0.2 = 0.79
    assert yield_ratio(320.0, 400.0, 1.05) == pytest.approx(0.79)


def test_ratio_is_floored_at_zero():
    assert yield_ratio(10.0, 400.0, 1.15) == 0.0


@pytest.mark.parametrize("eta", [0.0, 50.0, 200.0, 399.0, 400.0])
@pytest.mark.parametrize("ky", [0.8, 1.05, 1.15])
def test_ratio_stays_within_0_1(eta, ky):
    assert 0.0 <= yield_ratio(eta, 400.0, ky) <= 1.0


def test_invalid_inputs_raise():
    with pytest.raises(ValueError):
        yield_ratio(100.0, 0.0, 1.05)
    with pytest.raises(ValueError):
        yield_ratio(-1.0, 400.0, 1.05)
    with pytest.raises(ValueError):
        yield_ratio(100.0, 400.0, 0.0)

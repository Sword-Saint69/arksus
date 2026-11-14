"""Shared pytest settings for the engine tests."""

import pytest


@pytest.fixture(autouse=True, scope="session")
def _no_precip_correction_by_default():
    """Most tests use synthetic weather with real location ids; keep the station correction
    (scenarios.yaml precip_correction) off unless a test asks for it explicitly. Session scope so
    that module-scoped fixtures (which run before function-scoped ones) also see it off."""
    from nobetsu import runner
    mp = pytest.MonkeyPatch()
    mp.setattr(runner, "_precip_correction_enabled", lambda: False)
    yield
    mp.undo()

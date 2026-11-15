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


@pytest.fixture(autouse=True, scope="session")
def _no_real_merra2_cache():
    """E1 tests build their own SMAP/MERRA-2 series; do not read data/merra2/*.json implicitly."""
    from nobetsu import merra2
    mp = pytest.MonkeyPatch()
    mp.setattr(merra2, "load_cached", lambda ids: {})
    yield
    mp.undo()

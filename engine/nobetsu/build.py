"""Build all site JSON (ARAYUZLER §7). Owner: Gümüş.

    python -m nobetsu.build           # real: POWER + Ömer's engine   (make data)
    python -m nobetsu.build --mock    # fake runner, same code path   (make mock)
"""

from __future__ import annotations

import argparse
import json

from . import config, export, mock as mockmod


def _soilgrids(location_id: str) -> dict | None:
    path = config.DATA_DIR / "soilgrids" / f"{location_id}.json"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build(mock: bool, out_dir: str = "web/public/data", scenarios: bool = True) -> None:
    """mock: fake runner, baseline only. Real: engine + checks (+ E1 SMAP check) + E2 scenarios unless scenarios=False."""
    locations = config.location_ids()
    if mock:
        outputs = {loc: mockmod.fake_run_location(loc, None, _soilgrids(loc)) for loc in locations}
        meta = {loc: mockmod.fake_weather_meta(loc) for loc in locations}
        export.write_all(outputs, mockmod.fake_checks(), mock=True, out_dir=out_dir, weather_meta=meta)
        return

    from .power import load_weather
    from .runner import run_landscape, run_location, run_scenarios  # Ömer (Rol A)
    from .validate import check_smap_anomaly, run_checks             # Ömer (Rol A)

    weathers = {loc: load_weather(loc) for loc in locations}
    outputs = {loc: run_location(loc, weathers[loc], _soilgrids(loc)) for loc in locations}
    checks = run_checks(outputs, weathers, config.load("references"))
    # E1: sixth check, `pending` until SMAP data is in data/smap/{loc}.json with available: true
    lands = {loc: run_landscape(loc, weathers[loc], _soilgrids(loc)) for loc in locations}
    checks.append(check_smap_anomaly(lands, {loc: _smap_cache(loc) for loc in locations}))

    scen = None
    if scenarios and config.exists("scenarios"):
        ids = [s["id"] for s in config.load("scenarios")["scenarios"] if s["id"] != export.BASELINE_SCENARIO]
        scen = {loc: run_scenarios(loc, weathers[loc], _soilgrids(loc), scenario_ids=ids) for loc in locations}
    meta = {loc: dict(w.attrs) for loc, w in weathers.items()}
    export.write_all(outputs, checks, mock=False, out_dir=out_dir, weather_meta=meta, scenario_outputs=scen)


def _smap_cache(location_id: str) -> dict:
    path = config.DATA_DIR / "smap" / f"{location_id}.json"
    if not path.exists():
        return {"available": False}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mock", action="store_true", help="use mock.fake_run_location instead of the engine")
    p.add_argument("--out", default="web/public/data")
    p.add_argument("--no-scenarios", action="store_true", help="skip E2 scenarios (faster, ~1 min instead of ~10)")
    a = p.parse_args()
    build(a.mock, a.out, scenarios=not a.no_scenarios)
    print(f"wrote {'mock' if a.mock else 'real'} data to {a.out}")


if __name__ == "__main__":
    main()

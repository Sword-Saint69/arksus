"""Build all site JSON (ARAYUZLER §7). Owner: Gümüş.

    python -m nobetsu.build           # real: POWER + Ömer's engine   (make data)
    python -m nobetsu.build --mock    # fake runner, same code path   (make mock)
"""

from __future__ import annotations

import argparse
import json
import os
from concurrent.futures import ProcessPoolExecutor

from . import config, export, mock as mockmod


def _soilgrids(location_id: str) -> dict | None:
    path = config.DATA_DIR / "soilgrids" / f"{location_id}.json"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build(mock: bool, out_dir: str = "web/public/data", scenarios: bool = True, jobs: int | None = None) -> None:
    """mock: fake runner, baseline only. Real: engine + checks (+ E1 soil-wetness check) + E2 scenarios unless
    scenarios=False. jobs: worker processes (default: one per district up to the CPU count; 1 = sequential)."""
    locations = config.location_ids()
    if mock:
        outputs = {loc: mockmod.fake_run_location(loc, None, _soilgrids(loc)) for loc in locations}
        meta = {loc: mockmod.fake_weather_meta(loc) for loc in locations}
        export.write_all(outputs, mockmod.fake_checks(), mock=True, out_dir=out_dir, weather_meta=meta)
        return

    from .power import load_weather
    from .validate import check_smap_anomaly, run_checks             # Ömer (Rol A)

    weathers = {loc: load_weather(loc) for loc in locations}
    scen_ids = None
    if scenarios and config.exists("scenarios"):
        scen_ids = [s["id"] for s in config.load("scenarios")["scenarios"] if s["id"] != export.BASELINE_SCENARIO]
    # One process per district (15 Nov): the runs are independent and deterministic, so the output is
    # identical to the sequential build; ~11 min → a few minutes on a multi-core machine.
    jobs = jobs or min(len(locations), os.cpu_count() or 1)
    if jobs > 1:
        with ProcessPoolExecutor(max_workers=jobs) as pool:
            done = dict(zip(locations, pool.map(_run_district, locations, [scen_ids] * len(locations))))
    else:
        done = {loc: _run_district(loc, scen_ids) for loc in locations}
    outputs = {loc: done[loc][0] for loc in locations}
    lands = {loc: done[loc][1] for loc in locations}
    scen = {loc: done[loc][2] for loc in locations} if scen_ids is not None else None

    checks = run_checks(outputs, weathers, config.load("references"))
    # E1: sixth check — model soil water vs NASA MERRA-2 root-zone wetness (soil-wetness slot data/smap/{loc}.json;
    # SMAP L4 was dropped on 15 Nov, the slot keeps its contract name). `pending` without data.
    checks.append(check_smap_anomaly(lands, {loc: _smap_cache(loc) for loc in locations}))
    meta = {loc: dict(w.attrs) for loc, w in weathers.items()}
    export.write_all(outputs, checks, mock=False, out_dir=out_dir, weather_meta=meta, scenario_outputs=scen)


def _run_district(loc: str, scen_ids: list[str] | None):
    """Engine runs for one district (picklable, used by the process pool)."""
    from .power import load_weather
    from .runner import run_landscape, run_location, run_scenarios  # Ömer (Rol A)
    w, sg = load_weather(loc), _soilgrids(loc)
    out = run_location(loc, w, sg)
    land = run_landscape(loc, w, sg)
    scen = run_scenarios(loc, w, sg, scenario_ids=scen_ids) if scen_ids is not None else None
    return out, land, scen


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
    p.add_argument("--no-scenarios", action="store_true", help="skip E2 scenarios (faster)")
    p.add_argument("--jobs", type=int, default=None, help="worker processes (default: one per district up to CPU count; 1 = sequential)")
    a = p.parse_args()
    build(a.mock, a.out, scenarios=not a.no_scenarios, jobs=a.jobs)
    print(f"wrote {'mock' if a.mock else 'real'} data to {a.out}")


if __name__ == "__main__":
    main()

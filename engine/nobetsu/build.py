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


def build(mock: bool, out_dir: str = "web/public/data") -> None:
    locations = config.location_ids()
    if mock:
        outputs = {loc: mockmod.fake_run_location(loc, None, _soilgrids(loc)) for loc in locations}
        meta = {loc: mockmod.fake_weather_meta(loc) for loc in locations}
        export.write_all(outputs, mockmod.fake_checks(), mock=True, out_dir=out_dir, weather_meta=meta)
        return

    from .power import load_weather
    from .runner import run_location  # Ömer (Rol A)
    from .validate import run_checks  # Ömer (Rol A)

    weathers = {loc: load_weather(loc) for loc in locations}
    outputs = {loc: run_location(loc, weathers[loc], _soilgrids(loc)) for loc in locations}
    checks = run_checks(outputs, weathers, config.load("references"))
    meta = {loc: dict(w.attrs) for loc, w in weathers.items()}
    export.write_all(outputs, checks, mock=False, out_dir=out_dir, weather_meta=meta)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mock", action="store_true", help="use mock.fake_run_location instead of the engine")
    p.add_argument("--out", default="web/public/data")
    a = p.parse_args()
    build(a.mock, a.out)
    print(f"wrote {'mock' if a.mock else 'real'} data to {a.out}")


if __name__ == "__main__":
    main()

"""YAML config loader (ARAYUZLER §4)."""

from __future__ import annotations

from pathlib import Path

import yaml

ENGINE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = ENGINE_DIR.parent
CONFIG_DIR = ENGINE_DIR / "config"
DATA_DIR = REPO_ROOT / "data"
WEB_DATA_DIR = REPO_ROOT / "web" / "public" / "data"


def load(name: str) -> dict:
    """Load engine/config/{name}.yaml as a dict. Raises FileNotFoundError if missing."""
    path = CONFIG_DIR / f"{name}.yaml"
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data or {}


def exists(name: str) -> bool:
    return (CONFIG_DIR / f"{name}.yaml").exists()


def location_ids() -> list[str]:
    return [loc["id"] for loc in load("locations")["locations"]]

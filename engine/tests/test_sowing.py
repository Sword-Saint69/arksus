"""sowing.yaml integrity ("nasıl ekilir", docs/GUBRE.md §9). Owner: Gümüş.

The browser does the arithmetic (web/src/lib/sowing.ts); here we check that the rules it reads are complete,
sourced, internally consistent and free of money and forbidden wording.
"""

from __future__ import annotations

import json
import re
from datetime import date

import pytest
from jsonschema import Draft202012Validator

from nobetsu import config, export

CROPS = ["wheat", "barley", "lentil", "chickpea"]
COND_KEYS = {"water", "late", "seedbed", "soil", "drill", "season", "type", "crop", "annual_precip_mm"}


@pytest.fixture(scope="module")
def sow() -> dict:
    return export._sowing(mock=False, ts="t")


def _walk(node, path=""):
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")


def test_matches_contract_schema(sow):
    schema = json.loads((config.REPO_ROOT / "docs" / "contract" / "sowing.schema.json").read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema).iter_errors(sow))
    assert not errors, "; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5])


def test_ranges_are_ordered_and_sourced(sow):
    for path, node in _walk(sow):
        if "min" in node and "max" in node:
            assert node["min"] <= node["max"], path
            assert node["source"].strip() and node["type"], path
            if node["verified"]:
                assert node.get("source_url"), f"{path}: verified without source_url"


def test_windows_are_real_dates_and_types_have_a_window(sow):
    for cid in CROPS:
        for ty in sow["crops"][cid]["types"]:
            assert ("window" in ty) != ("window_text" in ty), f"{cid}/{ty['id']}: exactly one of window / window_text"
            for regime, w in ty.get("window", {}).items():
                a = date(2026, *map(int, w["from"].split("-")))
                b = date(2026, *map(int, w["to"].split("-")))
                assert a <= b, f"{cid}/{ty['id']}/{regime}"


def test_seed_basis_and_depth(sow):
    for cid in CROPS:
        for ty in sow["crops"][cid]["types"]:
            assert any(k in ty for k in ("seeds_per_m2", "plants_per_m2", "guide_kg_per_da")), f"{cid}/{ty['id']}"
            assert 2 <= ty["depth_cm"]["min"] <= ty["depth_cm"]["max"] <= 8, f"{cid}/{ty['id']}: depth"


def test_values_typed_from_sources(sow):
    """Spot values from TİGEM Bölüm 4 and the GKGM booklet."""
    w = {t["id"]: t for t in sow["crops"]["wheat"]["types"]}
    assert (w["bread_high_tiller"]["seeds_per_m2"]["min"], w["bread_high_tiller"]["seeds_per_m2"]["max"]) == (500, 550)
    assert (w["durum"]["guide_kg_per_da"]["min"], w["durum"]["guide_kg_per_da"]["max"]) == (20, 21)
    assert w["bread_normal"]["window"]["rainfed"]["from"] == "09-15" and w["bread_normal"]["window"]["rainfed"]["to"] == "10-10"
    b = sow["crops"]["barley"]["types"][0]
    assert b["window"]["rainfed"]["from"] == "09-21" and b["window"]["rainfed"]["to"] == "10-19"
    assert sow["crops"]["chickpea"]["types"][0]["plants_per_m2"]["min"] == 100
    assert [r["min"] for r in sow["crops"]["lentil"]["rows"]][:2] == [30, 15]


def test_every_district_has_an_annual_precipitation_normal(sow):
    assert set(config.location_ids()) <= set(sow["annual_precip_mm"])
    for loc, v in sow["annual_precip_mm"].items():
        assert v["type"] == "official" and v["value"] > 0, loc


def test_conditions_use_known_keys(sow):
    for path, node in _walk(sow):
        if "when" in node and isinstance(node["when"], dict):
            assert set(node["when"]) <= COND_KEYS, f"{path}: {set(node['when']) - COND_KEYS}"


def test_district_lists_are_real_ids(sow):
    ids = set(config.location_ids())
    assert set(sow["nearest_window_note"]["districts"]) <= ids
    assert set(sow["cold_districts"]["ids"]) <= ids


MONEY = re.compile(r"\bTL\b|₺|fiyat|maliyet|gelir|\bkâr\b|\bkar\b|tasarruf|price|cost|income|profit|saving", re.I)
FORBIDDEN = re.compile(r"\bkesin|mutlaka|yasak|garanti|guarantee|banned|\bcertain\b", re.I)


def test_no_money_and_no_forbidden_words(sow):
    for path, node in _walk(sow):
        if set(node) >= {"en", "tr"}:
            for lang in ("en", "tr"):
                assert not MONEY.search(node[lang]), f"{path}.{lang}: {node[lang]}"
                assert not FORBIDDEN.search(node[lang]), f"{path}.{lang}: {node[lang]}"

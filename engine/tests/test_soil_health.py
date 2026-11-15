"""soil_health.yaml integrity (docs/GUBRE.md §10). Owner: Gümüş."""

from __future__ import annotations

import json
import re

import pytest
from jsonschema import Draft202012Validator

from nobetsu import config, export


@pytest.fixture(scope="module")
def sh() -> dict:
    return export._soil_health(mock=False, ts="t")


def _walk(node, path=""):
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")


def test_matches_contract_schema(sh):
    schema = json.loads((config.REPO_ROOT / "docs" / "contract" / "soil_health.schema.json").read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema).iter_errors(sh))
    assert not errors, "; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5])


def test_practice_ids_unique_and_every_evidence_sourced(sh):
    ids = [p["id"] for p in sh["practices"]]
    assert len(ids) == len(set(ids))
    for p in sh["practices"]:
        for e in p["evidence"]:
            assert e["source"].strip()
            if e["verified"]:
                assert e.get("source_url"), f"{p['id']}: verified evidence without URL"


def test_om_classes_rise_and_end_open(sh):
    bounds = [r["max"] for r in sh["om_classes"]["rows"]]
    assert bounds[-1] is None and bounds[:-1] == sorted(bounds[:-1])


def test_district_conditions_name_real_districts(sh):
    ids = set(config.location_ids())
    for path, node in _walk(sh):
        if "location_id" in node and isinstance(node["location_id"], dict) and "eq" in node["location_id"]:
            assert node["location_id"]["eq"] in ids, path


def test_depth_variants_cover_every_depth(sh):
    """Exactly one fallow practice applies to each depth class."""
    for depth in ("shallow", "medium", "deep"):
        hits = [p["id"] for p in sh["practices"] if p["id"].startswith("fallow_")
                and (p["when"]["depth"].get("eq") == depth or depth in p["when"]["depth"].get("in", []))]
        assert len(hits) == 1, (depth, hits)


MONEY = re.compile(r"\bTL\b|₺|fiyat|maliyet|gelir|\bkâr\b|\bkar\b|tasarruf|price|cost|income|profit|saving|\d+[.,]?\d*\s*lira", re.I)
FORBIDDEN = re.compile(r"\bkesin|mutlaka|yasak|garanti|guarantee|banned|\bcertain\b", re.I)


def test_no_money_and_no_forbidden_words(sh):
    for path, node in _walk(sh):
        if set(node) >= {"en", "tr"}:
            for lang in ("en", "tr"):
                assert not MONEY.search(node[lang]), f"{path}.{lang}: {node[lang]}"
                assert not FORBIDDEN.search(node[lang]), f"{path}.{lang}: {node[lang]}"

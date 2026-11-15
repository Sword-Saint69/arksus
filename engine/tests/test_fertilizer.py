"""fertilizer.yaml integrity (docs/GUBRE.md, ARAYUZLER §13). Owner: Gümüş.

The browser does the arithmetic (web/src/lib/fertilizer.ts); here we check that the rules it reads are complete,
consistent, sourced and free of money and forbidden wording.
"""

from __future__ import annotations

import json
import re

import pytest
from jsonschema import Draft202012Validator

from nobetsu import config, export

CROPS = ["wheat", "barley", "chickpea", "lentil", "sugar_beet", "potato", "onion"]
REGIMES = ["rainfed", "limited", "irrigated"]
SOIL_KEYS = {"om_pct", "p2o5_kg_per_da", "k2o_kg_per_da", "olsen_p_ppm", "k_ppm", "total_n_pct", "ph", "lime_pct",
             "ec_ds_m", "zn_ppm"}
REQUEST_KEYS = {"water", "inoculated", "drip", "banding", "crop"}
FLAG_KEYS = {"flags_any", "flags_all"}
V_KEYS = {"value", "unit", "source", "type", "verified"}
BADGES = {"measured", "model", "official", "statistic", "literature", "assumption", "user"}


@pytest.fixture(scope="module")
def fert() -> dict:
    return export._fertilizer(mock=False, ts="t")


def _walk(node, path=""):
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")


def test_matches_contract_schema(fert):
    schema = json.loads((config.REPO_ROOT / "docs" / "contract" / "fertilizer.schema.json").read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema).iter_errors(fert))
    assert not errors, "; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5])
    assert "_sources" not in fert


def test_every_value_object_is_complete(fert):
    for path, node in _walk(fert):
        if "value" in node and "unit" in node:
            assert V_KEYS <= set(node), f"{path}: missing {V_KEYS - set(node)}"
            assert node["type"] in BADGES, path
            assert node["source"].strip(), f"{path}: empty source"
            if node["value"] is not None:
                assert isinstance(node["value"], (int, float)) and not isinstance(node["value"], bool), path


def test_unsourced_numbers_are_not_marked_verified(fert):
    """A verified number needs a URL, unless it is pure chemistry (molar mass ratios) or a project limit."""
    for path, node in _walk(fert):
        if "value" in node and "unit" in node and node["verified"] and node["value"] is not None:
            chemistry = path.startswith(".conversions.p_to_p2o5") or path.startswith(".conversions.k_to_k2o")
            assert chemistry or node.get("source_url"), f"{path}: verified without source_url"


def test_all_referenced_products_exist(fert):
    products = set(fert["products"])
    for cid in CROPS:
        c = fert["crops"][cid]
        refs = [x["product"] for x in c["base_products"] + c["top_products"]] + [c["k_product"]]
        refs += [d["product"] for row in c.get("guide_table", {}).get("rows", []) for d in row["doses"]]
        refs += [d["product"] for d in c.get("farmer_practice", {}).get("doses", [])]
        assert set(refs) <= products, f"{cid}: unknown {set(refs) - products}"
        assert c["base_products"] and c["top_products"]
        assert "when" not in c["base_products"][-1] and "when" not in c["top_products"][-1], \
            f"{cid}: the last product choice must have no condition (always a fallback)"
        for p in {x["product"] for x in c["base_products"]}:
            assert fert["products"][p]["p2o5"] > 0, f"{cid}: base product {p} has no P2O5"
        for p in {x["product"] for x in c["top_products"]}:
            assert fert["products"][p]["n"] > 0, f"{cid}: top product {p} has no N"
        assert fert["products"][c["k_product"]]["k2o"] > 0


def test_n_split_fractions_sum_to_one(fert):
    for cid in CROPS:
        for r in REGIMES:
            parts = fert["crops"][cid]["n_split"][r]
            assert abs(sum(p["fraction"] for p in parts) - 1) < 1e-9, f"{cid}/{r}"


def test_conditions_use_known_keys(fert):
    allowed = SOIL_KEYS | REQUEST_KEYS | FLAG_KEYS
    for path, node in _walk(fert):
        if "when" in node:
            unknown = set(node["when"]) - allowed
            assert not unknown, f"{path}: unknown condition keys {unknown}"


def test_response_curve_has_a_top(fert):
    for cid in CROPS:
        r = fert["crops"][cid].get("n_response")
        if r and r["c"]["value"] is not None:
            assert r["c"]["value"] < 0 < r["b"]["value"], cid


def test_legumes_use_starter_n_not_a_balance(fert):
    for cid in ("chickpea", "lentil"):
        assert "fixed_n_kg_per_da" in fert["crops"][cid]


def test_soil_tables_are_ordered_and_closed(fert):
    """Class bounds rise strictly; the last row is open (max null); doses never rise as the soil gets richer."""
    for cid in CROPS:
        for nu, per_regime in fert["crops"][cid]["soil_tables"].items():
            for regime, table in per_regime.items():
                assert regime in REGIMES, f"{cid}/{nu}: {regime}"
                rows = table["rows"]
                bounds = [r["max"] for r in rows[:-1]]
                assert rows[-1]["max"] is None and None not in bounds, f"{cid}/{nu}/{regime}: last row must be open"
                assert bounds == sorted(bounds) and len(set(bounds)) == len(bounds), f"{cid}/{nu}/{regime}"
                doses = [r["kg_per_da"] for r in rows]
                assert doses == sorted(doses, reverse=True), f"{cid}/{nu}/{regime}: dose rises with richer soil"


def test_wheat_and_legumes_follow_tagem_central_anatolia(fert):
    """Spot values typed from the TAGEM PDF (Çizelge 1, 22, 13)."""
    t = fert["crops"]["wheat"]["soil_tables"]
    assert [r["kg_per_da"] for r in t["n"]["rainfed"]["rows"]] == [9, 8, 7, 5]
    assert [r["kg_per_da"] for r in t["n"]["irrigated"]["rows"]] == [16, 15, 14, 12]
    assert [r["kg_per_da"] for r in t["p2o5"]["rainfed"]["rows"]] == [9, 8, 7, 6, 5, 4, 3, 2, 0]
    assert [r["kg_per_da"] for r in t["k2o"]["rainfed"]["rows"]] == [8, 6, 4, 0]
    c = fert["crops"]["chickpea"]["soil_tables"]
    assert [r["kg_per_da"] for r in c["p2o5"]["rainfed"]["rows"]] == [8, 7, 5, 4, 4, 3, 2, 0]
    for cid in ("chickpea", "lentil"):
        assert fert["crops"][cid]["soil_tables"]["n"]["rainfed"]["type"] == "official"


def test_rotation_crops_have_rainfed_tables(fert):
    """The three engine crops are rainfed: they need TAGEM Kuru rows for N and P."""
    for cid in ("wheat", "chickpea", "lentil"):
        for nu in ("n", "p2o5"):
            assert "rainfed" in fert["crops"][cid]["soil_tables"][nu], f"{cid}/{nu}"


def test_rotation_crops_match_engine_crops(fert):
    in_rot = {c for c in CROPS if fert["crops"][c]["in_rotations"]}
    engine_crops = {k for k in config.load("crops") if k != "fallow"}
    assert in_rot == engine_crops


MONEY = re.compile(r"\bTL\b|₺|fiyat|maliyet|gelir|\bkâr\b|\bkar\b|tasarruf|price|cost|income|profit|saving", re.I)
FORBIDDEN = re.compile(r"kesin|mutlaka|yasak|garanti|guarantee|banned|certain", re.I)


def test_no_money_and_no_forbidden_words_in_texts(fert):
    for path, node in _walk(fert):
        for lang in ("en", "tr"):
            if set(node) >= {"en", "tr"} and isinstance(node.get(lang), str):
                assert not MONEY.search(node[lang]), f"{path}.{lang}: money word in '{node[lang]}'"
                assert not FORBIDDEN.search(node[lang]), f"{path}.{lang}: forbidden word in '{node[lang]}'"

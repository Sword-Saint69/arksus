"""Mock runner -> export -> every file passes the contract. Owner: Gümüş."""

from __future__ import annotations

import json

from nobetsu import build, config, export
from tests.test_contract import check_invariants, validate_dir


def test_mock_build_writes_valid_contract(tmp_path):
    build.build(mock=True, out_dir=str(tmp_path))
    files = validate_dir(tmp_path)
    assert len(files) == 3 + 3 * len(config.location_ids())
    check_invariants(tmp_path)
    site = json.loads((tmp_path / "site_index.json").read_text(encoding="utf-8"))
    assert site["mock"] is True


def test_rounding_rules():
    r = export._round({"water_at_wheat_sowing_mm": 12.345, "yield_ratio": 0.123456, "bare_days": 10.6,
                       "fullness_by_month": [33.333], "bare_by_month": [1.2], "first_crop": None})
    assert r == {"water_at_wheat_sowing_mm": 12.3, "yield_ratio": 0.123, "bare_days": 11,
                 "fullness_by_month": [33.3], "bare_by_month": [1], "first_crop": None}


def test_defaults_are_decision_parameters_without_nulls():
    d = export._defaults(mock=False, ts="t")
    assert set(d["crops"]) == {"wheat", "chickpea", "lentil", "fallow"}
    assert set(d["decision"]["weights"]) == {"value", "yield", "soil", "water"}
    assert abs(sum(v["value"] for v in d["decision"]["weights"].values()) - 1) < 1e-9
    for crop in ("wheat", "chickpea", "lentil"):
        for k in ("ref_yield_kg_per_da", "price_tl_per_kg", "support_tl_per_da"):
            assert isinstance(d["crops"][crop][k]["value"], (int, float))
    assert "cost_tl_per_da" not in str(d)  # costs removed (14 Nov decision)


def test_awc_value_rounded_to_one_decimal():
    out = {"location_id": "develi", "sequences": [], "ledger": [],
           "awc_used": {"value": 121.36500000000001, "unit": "mm/m", "source": "s", "type": "assumption", "verified": False}}
    r = export._results(out, mock=False, ts="t")
    assert r["soil"]["awc_mm_per_m"]["value"] == 121.4
    assert out["awc_used"]["value"] == 121.36500000000001  # input not mutated

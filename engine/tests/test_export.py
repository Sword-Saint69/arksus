"""Mock runner -> export -> every file passes the contract. Owner: Gümüş."""

from __future__ import annotations

import json

from nobetsu import build, export
from test_contract import check_invariants, validate_dir


def test_mock_build_writes_valid_contract(tmp_path):
    build.build(mock=True, out_dir=str(tmp_path))
    files = validate_dir(tmp_path)
    assert len(files) == 3 + 3 * 2
    check_invariants(tmp_path)
    site = json.loads((tmp_path / "site_index.json").read_text(encoding="utf-8"))
    assert site["mock"] is True


def test_rounding_rules():
    r = export._round({"water_at_wheat_sowing_mm": 12.345, "yield_ratio": 0.123456, "bare_days": 10.6,
                       "fullness_by_month": [33.333], "bare_by_month": [1.2], "first_crop": None})
    assert r == {"water_at_wheat_sowing_mm": 12.3, "yield_ratio": 0.123, "bare_days": 11,
                 "fullness_by_month": [33.3], "bare_by_month": [1], "first_crop": None}


def test_real_defaults_keep_pending_as_null():
    d = export._defaults(mock=False, ts="t")
    assert d["values"]["karapinar"]["wheat"]["ym_kg_per_da"]["value"] is None
    m = export._defaults(mock=True, ts="t")
    assert m["values"]["karapinar"]["wheat"]["ym_kg_per_da"]["value"] is not None

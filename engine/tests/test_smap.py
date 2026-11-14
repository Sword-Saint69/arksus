"""smap.py: AppEEARS SPL4SMGP CSV -> smap/{loc}.json fields (PLAN_MVP §4.3b). Owner: Gümüş."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
from jsonschema import Draft202012Validator

from nobetsu import config, smap

P = "SPL4SMGP_008_Geophysical_Data_"


def fake_csv(path, locs=("karapinar", "develi"), start="2015-04-01", end="2018-03-31", with_pctl=True):
    times = pd.date_range(f"{start} 01:30", f"{end} 22:30", freq="3h")
    rows = []
    for k, loc in enumerate(locs):
        for t in times:
            phase = 2 * math.pi * (t.dayofyear / 365.25)
            wet = 0.30 + 0.15 * math.cos(phase) + 0.02 * k          # wettest in winter, driest in summer
            row = {"ID": loc, "Category": "nobetsu", "Latitude": 38.0, "Longitude": 34.0,
                   "Date": t.strftime("%Y-%m-%dT%H:%M:%S"),
                   P + "sm_rootzone": wet * 0.45, P + "sm_rootzone_wetness": wet,
                   P + "sm_surface_wetness": wet * 0.9}
            if with_pctl:
                row[P + "sm_rootzone_pctl"] = 50.0
            rows.append(row)
    df = pd.DataFrame(rows)
    df.loc[5, P + "sm_rootzone_wetness"] = -9999.0                   # fill value must be ignored
    df.to_csv(path, index=False)
    return df


def test_reads_layers_without_mixing_rootzone_columns(tmp_path):
    fake_csv(tmp_path / "r.csv")
    daily = smap.read_appeears_csv(tmp_path / "r.csv")
    assert set(daily["id"]) == {"karapinar", "develi"}
    assert daily["rootzone_wetness"].between(0, 1).all()            # -9999 dropped
    assert (daily["rootzone_m3m3"] < daily["rootzone_wetness"]).all()  # sm_rootzone did not pick the wetness column
    assert daily.groupby("id")["date"].nunique().min() == 1096       # 3-hourly -> daily


def test_summary_matches_contract_and_season(tmp_path):
    fake_csv(tmp_path / "r.csv")
    out = smap.build_all(tmp_path / "r.csv", out_dir=tmp_path)
    rec = out["karapinar"]
    assert rec["available"] is True and rec["product"] == smap.PRODUCT
    assert [c["month"] for c in rec["monthly_climatology"]] == list(range(1, 13))
    by = {c["month"]: c for c in rec["monthly_climatology"]}
    assert by[1]["p50"] > by[7]["p50"]                              # winter wetter than summer
    assert all(c["p10"] <= c["p50"] <= c["p90"] for c in rec["monthly_climatology"])
    assert len(rec["monthly_series"]) == 36
    assert rec["latest"]["date"] == "2018-03-31" and rec["latest"]["percentile_for_month"] == 50.0
    schema = json.loads((config.REPO_ROOT / "docs" / "contract" / "smap.schema.json").read_text(encoding="utf-8"))
    full = {"schema_version": "1.0", "mock": False, "generated_at": "t", "location_id": "karapinar", **rec}
    errors = list(Draft202012Validator(schema).iter_errors(full))
    assert not errors, errors[0].message
    assert (tmp_path / "karapinar.json").exists() and (tmp_path / "develi.json").exists()


def test_percentile_without_pctl_layer(tmp_path):
    fake_csv(tmp_path / "r.csv", with_pctl=False)
    rec = smap.build_all(tmp_path / "r.csv", out_dir=tmp_path)["develi"]
    assert 0 <= rec["latest"]["percentile_for_month"] <= 100


def test_unknown_ids_are_skipped(tmp_path):
    fake_csv(tmp_path / "r.csv", locs=("karapinar", "not_a_place"))
    assert set(smap.build_all(tmp_path / "r.csv", out_dir=tmp_path)) == {"karapinar"}


def test_output_feeds_the_e1_check(tmp_path):
    """smap.py output -> validate.check_smap_anomaly gives `info` (needs the cached POWER weather)."""
    import pytest
    from nobetsu import power
    if not power.cache_path("karapinar").exists():
        pytest.skip("no POWER cache")
    from nobetsu.runner import run_landscape
    from nobetsu.validate import check_smap_anomaly
    fake_csv(tmp_path / "r.csv", locs=("karapinar",), start="2015-04-01", end="2018-03-31")
    rec = smap.build_all(tmp_path / "r.csv", out_dir=tmp_path)["karapinar"]
    w = power.load_weather("karapinar")
    sg = json.loads((config.DATA_DIR / "soilgrids" / "karapinar.json").read_text(encoding="utf-8"))
    check = check_smap_anomaly({"karapinar": run_landscape("karapinar", w, sg)}, {"karapinar": rec})
    assert check["id"] == "smap_anomaly" and check["status"] == "info", check

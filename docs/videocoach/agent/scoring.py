"""ENTROPI-SCORE v1 + baselines. Se FRAMEWORK.md sektion 3 (spec er lov).
Stille kalibrering (Marcs B1): beregnes KUN til rapporter/DB - ingen
atlet ser scoren foer K-protokollen (FRAMEWORK 3.5) er bestaaet.
Selvtest uden netvaerk:  python -m entropi_agent.scoring --selftest
"""
from __future__ import annotations
import statistics as st

SCORE_VERSION = "v1"
WEIGHTS = {"C1": 0.30, "C2": 0.20, "C3": 0.25, "C4": 0.25}  # Marcs B2
MIN_BASELINE_N = 5
LOWCONF_MAX = 15.0

# Befolknings-ankre (fra FUND-graenserne) - (vaerdi@50p, vaerdi@85p)
ANCHORS = {
    "eff_pct":  (90.0, 96.0),    # hoejere = bedre
    "hyst_norm": (0.08, 0.03),   # hyst_cm/rom_cm - lavere = bedre
    "dip_pct":  (55.0, 35.0),    # lavere = bedre
    "cv":       (0.08, 0.04),    # lavere = bedre
}


def _cv(vals):
    vals = [v for v in vals if v is not None]
    if len(vals) < 3:
        return None
    m = st.mean(vals)
    return (st.pstdev(vals) / m) if m else None


def components(analysis: dict) -> dict | None:
    """Raa komponent-VAERDIER (ikke point) fra en gemt analyse."""
    if (analysis.get("low_conf_pct") or 0) > LOWCONF_MAX:
        return None
    ex = analysis.get("extra") or {}
    comps = {}
    if ex.get("eff_pct") is not None:
        comps["eff_pct"] = float(ex["eff_pct"])
    if ex.get("hyst_cm") is not None and analysis.get("rom_cm"):
        comps["hyst_norm"] = float(ex["hyst_cm"]) / float(analysis["rom_cm"])
    if analysis.get("dip_pct") is not None:
        comps["dip_pct"] = float(analysis["dip_pct"])
    reps = analysis.get("reps") or []
    tempo = ex.get("tempo") or []
    if len(reps) >= 3:
        cv_parts = [c for c in (_cv(reps), _cv([t.get("con") for t in tempo]))
                    if c is not None]
        if cv_parts:
            comps["cv"] = sum(cv_parts) / len(cv_parts)
    return comps or None


HIGHER_BETTER = {"eff_pct": True, "hyst_norm": False, "dip_pct": False, "cv": False}
COMP_KEY = {"eff_pct": "C1", "hyst_norm": "C2", "dip_pct": "C3", "cv": "C4"}


def _points_from_anchor(metric: str, value: float) -> float:
    a50, a85 = ANCHORS[metric]
    if a85 == a50:
        return 50.0
    p = 50.0 + (value - a50) * (85.0 - 50.0) / (a85 - a50)
    return max(0.0, min(100.0, p))


def _points_from_baseline(metric: str, value: float, base: dict) -> float:
    med, mad = base["median"], base["mad"]
    if not mad:
        return 50.0
    z = (value - med) / mad
    if not HIGHER_BETTER[metric]:
        z = -z
    z = max(-2.5, min(2.5, z))
    return 50.0 + 20.0 * z


def score_v1(analysis: dict, baselines: dict | None = None):
    """-> (score:int, komponent_point:dict, brugte_baseline:bool) eller None.
    baselines: {metric: {"median":..,"mad":..,"n":..}} for atlet+loeft."""
    comps = components(analysis)
    if not comps:
        return None
    pts, used_base = {}, False
    for metric, value in comps.items():
        b = (baselines or {}).get(metric)
        if b and b.get("n", 0) >= MIN_BASELINE_N and b.get("mad"):
            pts[COMP_KEY[metric]] = _points_from_baseline(metric, value, b)
            used_base = True
        else:
            pts[COMP_KEY[metric]] = _points_from_anchor(metric, value)
    wsum = sum(WEIGHTS[k] for k in pts)
    score = round(sum(WEIGHTS[k] * pts[k] for k in pts) / wsum)
    return score, {k: round(v, 1) for k, v in pts.items()}, used_base


def compute_baselines(analyses: list[dict]) -> dict:
    """Median/MAD pr. metric over en atlets analyser for ET loeft."""
    series: dict[str, list[float]] = {}
    for a in analyses:
        comps = components(a)
        if not comps:
            continue
        for m, v in comps.items():
            series.setdefault(m, []).append(v)
    out = {}
    for m, vals in series.items():
        if len(vals) < 2:
            continue
        med = st.median(vals)
        mad = st.median([abs(v - med) for v in vals]) or None
        out[m] = {"median": med, "mad": mad, "n": len(vals)}
    return out


# ---------------------- netvaerk (kraever config/db) ----------------------
def refresh_all():
    """Hent alle analyser, beregn baselines pr. atlet+loeft, upsert til
    athlete_baselines, og skriv score paa analyser der mangler den."""
    import requests
    from . import config, db
    url = f"{config.SUPABASE_URL}/rest/v1"
    rows = requests.get(f"{url}/video_analyses?select=*&athlete_id=not.is.null",
                        headers=db.HEADERS, timeout=30).json()
    by = {}
    for r in rows:
        by.setdefault((r["athlete_id"], r["lift"]), []).append(r)
    for (aid, lift), items in by.items():
        base = compute_baselines(items)
        for metric, b in base.items():
            requests.post(
                f"{url}/athlete_baselines",
                headers={**db.HEADERS,
                         "Prefer": "resolution=merge-duplicates,return=minimal"},
                json={"athlete_id": aid, "lift": lift, "metric": metric,
                      "median": b["median"], "mad": b["mad"], "n": b["n"],
                      "version": SCORE_VERSION}, timeout=30).raise_for_status()
        for r in items:
            res = score_v1(r, base)
            if res and r.get("score") != res[0]:
                requests.patch(
                    f"{url}/video_analyses?id=eq.{r['id']}",
                    headers={**db.HEADERS, "Prefer": "return=minimal"},
                    json={"score": res[0], "score_components": res[1],
                          "score_version": SCORE_VERSION},
                    timeout=30).raise_for_status()
    return len(rows)


# ------------------------------ selvtest ---------------------------------
def _selftest():
    perfect = {"low_conf_pct": 0, "rom_cm": 50, "dip_pct": 30,
               "reps": [0.50, 0.50, 0.50],
               "extra": {"eff_pct": 97, "hyst_cm": 1.0,
                         "tempo": [{"con": 1.0}] * 3}}
    messy = {"low_conf_pct": 0, "rom_cm": 50, "dip_pct": 70,
             "reps": [0.55, 0.40, 0.30],
             "extra": {"eff_pct": 84, "hyst_cm": 6.0,
                       "tempo": [{"con": 0.8}, {"con": 1.4}, {"con": 2.0}]}}
    bad_track = {"low_conf_pct": 40, "rom_cm": 50, "dip_pct": 30,
                 "reps": [0.5], "extra": {"eff_pct": 95}}
    s_p = score_v1(perfect)
    s_m = score_v1(messy)
    assert s_p and s_m, "score skal kunne beregnes"
    assert s_p[0] > s_m[0] + 20, f"rent saet skal slaa rodet klart: {s_p[0]} vs {s_m[0]}"
    assert score_v1(bad_track) is None, "lowConf>15 -> ingen score"
    base = compute_baselines([perfect, messy, perfect])
    assert "eff_pct" in base and base["eff_pct"]["n"] == 3
    s_b = score_v1(messy, {m: {**b} for m, b in base.items()})
    assert s_b is not None
    print(f"SELVTEST OK  rent={s_p[0]}  rodet={s_m[0]}  "
          f"m/baseline={s_b[0]}  komponenter={s_p[1]}")


if __name__ == "__main__":
    import sys
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(f"Opdaterede baselines/score for {refresh_all()} analyser.")

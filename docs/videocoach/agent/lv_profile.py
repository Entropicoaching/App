"""LOAD-VELOCITY-PROFIL v1 (VBT). Se FRAMEWORK.md sektion 4 (spec er lov).
MVT er ALTID pr. atlet PR. LOEFT (Marcs B3-krav). Dagsform-taerskler
4%/8% er HYPOTESE (Marcs B4) - markeres beta, kalibreres via feltlog.
Selvtest uden netvaerk:  python -m entropi_agent.lv_profile --selftest
"""
from __future__ import annotations
import math
import statistics as st
from datetime import datetime, timezone

LV_VERSION = "v1"
HALF_LIFE_DAYS = 60.0
MIN_POINTS = 6
MIN_KG_SPAN_PCT = 15.0
MIN_R2 = 0.80
LOWCONF_MAX = 15.0
MCV_SANE = (0.05, 2.0)
RPE_FOR_MVT = 9.5
MVT_ANCHORS = {"Squat": 0.27, "Bænkpres": 0.17,
               "Dødløft": 0.22, "Sumo dødløft": 0.22}
DAGSFORM_NOTE_PCT = 4.0    # |afvigelse| under dette: vis intet
DAGSFORM_FLAG_PCT = 8.0    # under -dette: flag til coach


def _age_days(iso: str) -> float:
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return max(0.0, (datetime.now(timezone.utc) - t).total_seconds() / 86400)
    except Exception:
        return 0.0


def datapoints(analyses: list[dict]) -> list[tuple[float, float, float]]:
    """-> [(kg, bedste_mcv, vaegt)] efter FRAMEWORK-filtrene."""
    pts = []
    for a in analyses:
        kg = a.get("load_kg")
        reps = a.get("reps") or []
        if kg is None or not reps:
            continue
        if (a.get("low_conf_pct") or 0) > LOWCONF_MAX:
            continue
        mcv = max(reps)
        if not (MCV_SANE[0] <= mcv <= MCV_SANE[1]):
            continue
        w = 0.5 ** (_age_days(a.get("analyzed_at", "")) / HALF_LIFE_DAYS)
        pts.append((float(kg), float(mcv), w))
    return pts


def fit(points) -> dict | None:
    """Vaegtet lineaer regression mcv = intercept - slope*kg.
    -> dict m. maturity-vurdering, eller None ved <2 punkter."""
    if len(points) < 2:
        return None
    W = sum(w for _, _, w in points)
    mx = sum(k * w for k, _, w in points) / W
    my = sum(v * w for _, v, w in points) / W
    sxx = sum(w * (k - mx) ** 2 for k, _, w in points)
    sxy = sum(w * (k - mx) * (v - my) for k, v, w in points)
    if sxx == 0:
        return None
    b = sxy / sxx                     # haeldning (negativ forventet)
    a = my - b * mx                   # intercept
    ss_res = sum(w * (v - (a + b * k)) ** 2 for k, v, w in points)
    ss_tot = sum(w * (v - my) ** 2 for _, v, w in points)
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    kgs = [k for k, _, _ in points]
    span_pct = (max(kgs) - min(kgs)) / max(kgs) * 100 if max(kgs) else 0
    # groft standardfejls-interval paa forudsagt kg ved given fart
    n = len(points)
    se = math.sqrt(ss_res / max(1e-9, (W * (n - 2) / n))) if n > 2 else None
    mature = (n >= MIN_POINTS and span_pct >= MIN_KG_SPAN_PCT and r2 >= MIN_R2
              and b < 0)
    return {"slope": -b, "intercept": a, "r2": r2, "n_points": n,
            "kg_span_pct": span_pct, "se": se, "mature": mature}


def personal_mvt(analyses: list[dict], lift: str) -> tuple[float, str]:
    """MVT for DETTE loeft: median mcv paa RPE>=9.5-saet (n>=2), ellers anker."""
    grinders = [max(a["reps"]) for a in analyses
                if a.get("rpe") and a["rpe"] >= RPE_FOR_MVT
                and a.get("reps") and (a.get("low_conf_pct") or 0) <= LOWCONF_MAX]
    if len(grinders) >= 2:
        return st.median(grinders), "personlig"
    return MVT_ANCHORS.get(lift, 0.22), "anker"


def e1rm(profile: dict, mvt: float) -> tuple[float, float, float] | None:
    """-> (estimat, lo, hi) i kg. Kun for MODNE profiler."""
    if not profile or not profile["mature"] or profile["slope"] <= 0:
        return None
    est = (profile["intercept"] - mvt) / profile["slope"]
    spread = (profile["se"] / profile["slope"]) if profile.get("se") else est * 0.03
    return est, est - spread, est + spread


def dagsform(profile: dict, kg: float, mcv: float) -> dict | None:
    """Afvigelse mod forventet fart ved kg. None hvis profil umoden."""
    if not profile or not profile["mature"]:
        return None
    expected = profile["intercept"] - profile["slope"] * kg
    if expected <= 0:
        return None
    dev = (mcv - expected) / expected * 100
    status = ("normal" if abs(dev) <= DAGSFORM_NOTE_PCT
              else "over" if dev > 0
              else "under" if dev > -DAGSFORM_FLAG_PCT else "flag")
    return {"deviation_pct": round(dev, 1), "expected_mcv": round(expected, 3),
            "status": status, "beta": True}


# ---------------------- netvaerk (kraever config/db) ----------------------
def refresh_all():
    import requests
    from . import config, db
    url = f"{config.SUPABASE_URL}/rest/v1"
    rows = requests.get(f"{url}/video_analyses?select=*&athlete_id=not.is.null",
                        headers=db.HEADERS, timeout=30).json()
    by = {}
    for r in rows:
        by.setdefault((r["athlete_id"], r["lift"]), []).append(r)
    written = 0
    for (aid, lift), items in by.items():
        prof = fit(datapoints(items))
        if not prof:
            continue
        mvt, mvt_src = personal_mvt(items, lift)
        est = e1rm(prof, mvt)
        payload = {"athlete_id": aid, "lift": lift, "version": LV_VERSION,
                   "slope": prof["slope"], "intercept": prof["intercept"],
                   "r2": round(prof["r2"], 3), "n_points": prof["n_points"],
                   "kg_span_pct": round(prof["kg_span_pct"], 1), "mvt": mvt,
                   "e1rm_est": round(est[0], 1) if est else None,
                   "e1rm_lo": round(est[1], 1) if est else None,
                   "e1rm_hi": round(est[2], 1) if est else None}
        requests.post(f"{url}/athlete_lv_profiles",
                      headers={**db.HEADERS,
                               "Prefer": "resolution=merge-duplicates,return=minimal"},
                      json=payload, timeout=30).raise_for_status()
        written += 1
    return written


# ------------------------------ selvtest ---------------------------------
def _selftest():
    now = datetime.now(timezone.utc).isoformat()
    mk = lambda kg, mcv, rpe=None: {"load_kg": kg, "reps": [mcv], "rpe": rpe,
                                    "low_conf_pct": 0, "analyzed_at": now}
    # syntetisk atlet: mcv = 1.5 - 0.006*kg (=> e1RM v. MVT .27 = 205 kg)
    xs = [100, 120, 140, 155, 170, 185]
    analyses = [mk(k, 1.5 - 0.006 * k + eps)
                for k, eps in zip(xs, [0.01, -0.01, 0.005, -0.005, 0.01, -0.01])]
    prof = fit(datapoints(analyses))
    assert prof and prof["mature"], f"profil skal vaere moden: {prof}"
    mvt, src = personal_mvt(analyses, "Squat")
    assert src == "anker" and mvt == 0.27
    est = e1rm(prof, mvt)
    assert est and abs(est[0] - 205) < 8, f"e1RM ~205 forventet, fik {est}"
    # personlig MVT fra to grinder-saet
    analyses += [mk(190, 0.30, rpe=9.5), mk(192.5, 0.28, rpe=10)]
    mvt2, src2 = personal_mvt(analyses, "Squat")
    assert src2 == "personlig" and abs(mvt2 - 0.29) < 0.02
    # dagsform: maalt praecis som forventet -> normal; -10% -> flag
    df_ok = dagsform(prof, 150, prof["intercept"] - prof["slope"] * 150)
    df_bad = dagsform(prof, 150, (prof["intercept"] - prof["slope"] * 150) * 0.90)
    assert df_ok["status"] == "normal" and df_bad["status"] == "flag"
    # umoden profil afvises
    assert fit(datapoints(analyses[:3]))["mature"] is False
    print(f"SELVTEST OK  e1RM={est[0]:.0f} ({est[1]:.0f}-{est[2]:.0f})  "
          f"r2={prof['r2']:.3f}  MVT personlig={mvt2:.2f}  "
          f"dagsform flag ved {df_bad['deviation_pct']}%")


if __name__ == "__main__":
    import sys
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(f"Opdaterede {refresh_all()} LV-profiler.")

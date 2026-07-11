# Entropi VideoCoach — roadmap & brainstorm
_Skrevet 8/7-2026. Blanding af Marcs punkter + supplementer. Ikke en spec — et arbejdsgrundlag._

## Status lige nu
- **Lokal version:** Marc er tilfreds. Squat-keyframe-skelet virker. Bar-tracker frys-vagt inde (rig-valideret).
- **Kendt rest:** én video frøs midt i bunden på et 5-reps sæt (edge-case). Ellers fin — analyserede Regitzes highbar godt.
- **App-version:** halter bagefter — især bar-tracker på ældre Android.

---

## 1. Bar-tracker
- **[P0] APP-BUG (ældre Samsung):** trackerne flyver rundt kort efter sættet starter. Løsning ligger sandsynligvis i at **portere den lokale v3-tracker** (kontinuitetsregel + patchVar-gulve + den nye frys-vagt) til app'ens tracker. Test på en rigtig low-end Android.
- **[P1] Lokal edge-case:** frøs midt i bunden på 5-reps. Undersøg i frys-riggen (måske strip-x-range eller lost-tærskel ved lange sæt/lav kontrast i bunden).
- **Beslutning:** hvor aggressiv skal frys-vagten være på mobil (CPU-budget)?

## 2. Skelet for ALLE løft (ikke kun squat)
Vi skal blive enige om **hvilke vinkler der er mest givende** + hvordan man sætter op. Mit forslag pr. løft:

| Løft | Klik-kæde | Nøglevinkler | Top / Bund (keyframe) |
|---|---|---|---|
| **Squat** | skulder·hofte·knæ·ankel | knæ, hofte, torso vs lodret | stående / dybest |
| **Konv. dødløft** | skulder·hofte·knæ·ankel | rygvinkel (torso vs gulv), hofte, knæ, skulder foran stang | lockout / gulv |
| **Sumo dødløft** | skulder·hofte·knæ·ankel | mere oprejst torso, hofte, skinnevinkel, skuldre OVER stang | lockout / gulv |
| **Bænkpres** | skulder·albue·håndled (ARM) | albuevinkel, underarm lodret i bund, bar-J-kurve, touch-punkt | lockout / bryst |

- **Vigtigt:** bænk kræver en **anden klik-kæde** (arm i stedet for ben). Skelet-flowet skal kunne vælge kæde ud fra øvelse.
- **[P1] Opgradér FILMGUIDEN pr. løft:** kamerahøjde/afstand/hvad-der-skal-ses (squat: hoftehøjde · DL: knæhøjde · bænk: bar/bryst fra siden).

## 3. AI-strategi (genovervej lokal Llama)
Marcs spørgsmål: Llama koster reelt (compute/tid), gør dig ikke uafhængig, og hvad er fordelen vs Claude?
- **Lokal Llama:** offline, privat, ingen per-kald-pris — men lavere biomekanik-ræsonnement + binder til din maskine.
- **Claude API:** klart bedre til biomekanik/kinesiologi — men per-kald-pris + online + data forlader maskinen.
- **Din egen linje (fra stemme-noten):** AI **kun til data**, mennesket coacher. → AI-rollen er MINIMAL (formulér de deterministiske fund pænt).
- **Mit forslag til beslutning:**
  1. **Kernen = deterministiske FUND** (regelbaseret, altid, offline, gratis, uafhængig). Det er allerede det stærkeste.
  2. **Valgfri "dyb-analyse"** via Claude API — kun coach-facing, kun når online, til de svære cases. Betal per brug, ikke fast.
  3. Overvej at **droppe den lokale Llama** helt hvis fund + din stemme dækker — så er du reelt mere uafhængig (ingen model at vedligeholde).
- Afklar hvad "uafhængighed" betyder for dig: uafhængig af internet? af API-pris? af Anthropic? Det styrer valget.

## 4. App-integration
- **[P0]** Fix Android-tracker (se pkt. 1).
- **[P2]** Port lokal → **coachview i app'en**, i mobil-format, så du nemt kan bruge den på telefonen.
- **Beslutning:** hvad skal ATLETEN kunne i app-trackeren (hold det simpelt) vs hvad er coach-only (avanceret)? Alt for meget værktøj = forvirring for atleten.
- **[HOLD] Bro/del-link (portal):** sat på hold ("kravle før løbe"). Backend (Supabase-tabel + storage + RLS) + coach-upload kan jeg bygge; selve portal-skærmen kræver app-repo'en.

## 5. Brainstorm — kreative måder at forstå/formidle kroppen (supplementer)
Ud over vinkler-i-bunden, her er innovative visualiseringer der gør biomekanik **synlig og forståelig**:
- **Vinkel-kurver** (som fartkurven, men led-vinkler over dybde/tid): man SER formen — fx hoften der åbner for tidligt = good morning bliver en kurve, ikke en fornemmelse.
- **Moment-arm-visualisering:** vandret afstand bar→hofte/knæ tegnet som en skygget trekant = proxy for ledbelastning. "Se hvor langt vægten er fra hoften her."
- **Bar-over-midtfod-linje:** lodret referencelinje gennem midtfod — den klassiske cue gjort visuel (balance-indikator live).
- **Stroboskop-billede:** hele rep'ens bane + ghost-skelet ved start/sticking/lockout på ÉT billede — bevægelsens "aftryk".
- **Rep-fingeraftryk:** alle reps' baner svagt oven på hinanden — stramt bundt = konsistent, spredt = nedbrud under træthed.
- **Tempo-bjælker pr. rep:** excentrisk / pause / koncentrisk som farvede bjælker — timing og kontrol synligt.
- **VBT-fart-zoner + RPE/RIR-estimat** ud fra fart vs atletens profil (kræver historik-baseline).
- **Kraft-tid-proxy:** bar-acceleration (2. afledte af position) → "hvor i løftet ligger kraften".
- **Cue-bibliotek:** mønster → standard coaching-cue ("bryst op", "knæ ud", "hofte igennem") — automatisk foreslået, du vælger.
- **(senere) Symmetri venstre/højre** — kræver front-view; nyt kamera-setup.

---

## Konkret TODO (prioriteret)
1. **[P0]** App bar-tracker fix (Android/Samsung) — port lokal v3 + frys-vagt, test på low-end.
2. **[P1]** Lokal bar-tracker edge-case (frys på 5-reps) — reproducér + stram frys-vagt.
3. **[P1]** Skelet-vinkler pr. løft — bliv enige (tabellen ovenfor), implementér DL + sumo (samme kæde) + bænk (arm-kæde).
4. **[P1]** Filmguide pr. løft.
5. **[P2]** Port lokal → app coachview (mobil-format).
6. **[P2]** AI-strategi: beslut (deterministisk kerne + valgfri Claude-dyb-analyse?).
7. **[P2]** Afgræns atlet- vs coach-funktioner i app-trackeren.
8. **[P3 / HOLD]** Bro + del-link via portalen (backend + viewer).
9. **[løbende]** Kreative visualiseringer fra brainstormen — vælg 1-2 at prototype (fx vinkel-kurve + moment-arm).

# OPGAVEKORT — Entropi VideoCoach (til Fable, der overtager)
_Skrevet 8/7-2026. Læs denne + `ROADMAP-VIDEOCOACH.md` + `HANDOVER-VIDEOCOACH.md`._

## Hvad projektet er
Marc = elite styrkeløft-coach. **Entropi VideoCoach** = video-analyse af styrkeløft i ÉN html-fil med 3 tilstande:
- **DESKTOP** (`file://`) = Marcs fulde værksted (det vi arbejder i).
- **COACHWEB** (`?coach=1` online) = coach på mobil.
- **ATLET** (online, default) = minimal atlet-visning.
Kernefunktioner: stangbane-tracking (skive-template-match → m/s, reps, tempo, sticking point), keyframe-skelet (led-vinkler), fund + AI-formulering (lokal Ollama).

## Filer (Windows-stier)
- **MASTER:** `C:\Users\Entropi\Desktop\entropi-agent\videocoach.html` ← al udvikling her.
- **Deploy** (KUN på Marcs go): kopiér til `...\entropi-app\public\` + git commit + push → GitHub Pages → `entropicoaching.dk/videocoach.html`.
- **Rigs (node):** `tracker-freeze-rig.js` (bar-tracker frys), `tracker-kinskel-testrig.js` (keyframe-skelet), `tracker-mskel-testrig.js` (gammelt). Alle i `entropi-agent`.
- **Docs:** `ROADMAP-VIDEOCOACH.md`, `HANDOVER-VIDEOCOACH.md`, `TODO.md` (samme mappe).

## ⚠️ ARBEJDSREGLER (Marcs krav — bryd dem ikke)
1. **AL udvikling + test i MASTER-filen lokalt. INTET deployes før Marc har testet og sagt go.**
2. **CV/tracker-ændringer testes ALTID FØRST i en node-test-rig.** En utestet CV-ændring frøs trackeren i produktion og måtte rulles tilbage. Reproducér fejlen i riggen → fix → bevis at ALLE eksisterende scenarier stadig er grønne → PORT. "Uden konsekvenser" = ingen regression.
3. **Én ændring ad gangen. Marcs øje er facit.** Deterministiske ankre (klik/stang) > statistik. Hellere få ting der ALTID virker end features under 50%.
4. **Syntaks-tjek efter HVER ændring.** Metode: udtræk `<script>` og kør `node --check`. Praktisk: der ligger `syntaxcheck.js` i outputs (læser html, udtrækker script, node --check). Ellers PowerShell-regex `(?s)<script>(.*)</script>` → temp-fil → `node --check`.
5. **Copy-tone:** menneskelig, ikke AI-agtig. Marc skriver selv brand-copy. Atlet-facing tekst skal være **konstruktiv OG opmuntrende** (se resultatkortets "DET VIRKER"/"FOKUS NÆSTE GANG").

## Nuværende status (gjort i sidste session)
- **Keyframe-skelet** erstattede MediaPipe (som fejlede på sorte sleeves/perspektiv). Coach klikker skelet ved TOP + BUND; stangens højde driver interpolation. Virker på squat.
- **Bar-tracker frys-vagt** (Runde 22): når `recenterOnPlate` gentagne gange ikke finder skiven ved punktet = tabt → gensøg m. ORIGINAL-template i lodret stribe, relokér kun hvis skiven er >R væk. Rig-valideret, nul regression.
- **UI:** radikal ryddet bundlinje (ikon-knapper, guld-accent), brand-lockup, mute, "Resultatkort" (PNG m. referat), "Gem video" (silent overlay-eksport).
- **AI** læser nu keyframe-skelettets vinkler + rep-til-rep. Panel ryddet op (NØGLETAL + kort VURDERING).
- **MediaPipe-kode fjernet** (~420 linjer død kode). Fandt+fikset coach-mobil crash (null.onclick).

## NÆSTE (prioriteret — start her)
- **[P0] APP bar-tracker på ældre Android (Samsung):** trackerne flyver rundt kort efter start. Løsning = port den lokale v3-tracker (kontinuitetsregel + patchVar-gulve + frys-vagt) til app'ens tracker. Test på low-end. (App-koden er et SEPARAT repo — afklar adgang med Marc.)
- **[P1]** Lokal frys-edge-case (frøs i bund på 5-reps sæt) — reproducér i frys-riggen.
- **[P1]** Skelet-vinkler pr. løft: squat/DL/sumo = ben-kæde (skulder·hofte·knæ·ankel); **BÆNK = arm-kæde (skulder·albue·håndled)** — skelet-flow skal vælge kæde ud fra øvelse. Se tabel i ROADMAP.
- **[P1]** Filmguide pr. løft.
- Se ROADMAP for P2/P3 (app coachview mobil, AI-strategi, del-link/portal på hold).

## Gotchas
- `node --check` fanger kun syntaks, ikke logik → Marc tester altid selv i browseren.
- Emoji i knap-labels er live-status nogle steder (allBtn/recordBtn) — pas på ved ikon-arbejde.
- Backups tages før store sletninger (`videocoach.backup-*.html`).
- Supabase-projekt (atletportal): `dsqgaxwgtcbqgphsofav`. `athletes.id` ≠ `athletes.user_id`. Frontend-app-koden ligger IKKE i den forbundne mappe.

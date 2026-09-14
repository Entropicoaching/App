# POSE-PROEVE: kan appen måle det Drishti måler?

Ordre 188. Svaret er tal fra en engangsprøve (`scripts/pose-proeve/`), ikke
en anbefaling og ikke et appfeature — se `docs/RAPPORT-188.md` for hele
historien og sammenligningstabellen mod Drishtis facit. Denne fil samler
kun **hvad det ville koste** at bygge det rigtige, hvis Marc siger ja.

## Tid pr. klip (målt, coachens/denne maskines CPU)

| Trin | Tid |
|---|---|
| Transkodering (.mov -> mp4, kun nødvendig fordi Chromium ikke afkoder .mov — se "Ærlig grænse" nedenfor) | ~2s |
| PoseLandmarker på alle 117 billeder (IMAGE-mode, CPU-delegate) | ~27s (≈232ms/billede) |
| **Total, klip til færdig bane** | **~29s** |

Til sammenligning: videocoach.html's EGEN, allerede produktionsafprøvede
skivetracker (template-matching, ikke en pose-model) måler
44-52ms/billede for HELE sit arbejde — se `docs/videocoach/TID-PR-FRAME.md`.
PoseLandmarker er altså **~5× langsommere pr. billede** end den tracker
appen allerede har liggende og kører i produktion i dag.

**CPU, ikke GPU.** Denne prøve tvang `delegate: 'CPU'` — headless Chromium i
et sandbox-miljø har historisk usikker WebGL-understøttelse, og et
pålideligt tal var vigtigere end et optimistisk et. En rigtig browser med
GPU-delegate (almindeligt på en coach-computer) vil formentlig være
hurtigere, men det er IKKE målt her — kun noteret som et åbent spørgsmål.

**Ikke testet på telefon.** Se afsnittet "Hvad mangler for en telefon"
nedenfor.

## Hvad der skal hentes i browseren

| Fil | Størrelse |
|---|---|
| `pose_landmarker_full.task` (posemodellen, float16) | ~9,4 MB |
| `vision_wasm_internal.wasm` (WASM-runtime, SIMD-varianten) | ~11,2 MB |
| Tilhørende JS-loader + `vision_bundle.mjs` | ~0,5 MB |
| **Total, første besøg** | **~21 MB** |

Alt er statiske filer — kan caches (service worker, samme mønster
videocoach.html allerede bruger til sin PWA, se
`docs/videocoach/HANDOVER-VIDEOCOACH.md`s "share target"-afsnit) så de
~21 MB kun hentes ÉN gang pr. enhed, ikke pr. video.

## Hvad der mangler for at en telefon kunne gøre det samme

- **Ingen måling på en rigtig telefon endnu.** 232ms/billede på en
  coach-computers CPU siger intet sikkert om en telefon — mobile CPU'er er
  typisk 3-6× langsommere for den slags WASM-arbejde, og batteri/varme
  sætter en grænse denne prøve ikke har rørt ved.
- **Seek-pr-billede, ikke afspilning.** Denne prøve måtte forlade
  `requestVideoFrameCallback`-under-afspilning (videocoach.html's eget,
  hurtige mønster) til fordel for eksplicit seek pr. billede, fordi
  PoseLandmarkers synkrone kald er for langsomt til at følge videoens egen
  realtid (se `scripts/pose-proeve/harness.html`s kommentar) — og
  `docs/videocoach/HANDOVER-VIDEOCOACH.md` siger selv at seek-pr-frame er
  "10-30× langsommere på mobil". Kombinationen (langsom pose-model + langsom
  seek-metode) er IKKE afprøvet på en telefon, og der er god grund til at
  tro det bliver værre der, ikke bedre.
- **117 billeder blev målt, kun fordi kontrakten kræver hver eneste af de
  28 i banen plus resten til side-/gulvreference.** En rigtig telefon-vej
  ville formentlig ikke behøve hvert billede (se "upload og gå" nedenfor).
- **Ingen stangreference.** Se næste afsnit — det er ikke et
  telefon-specifikt problem, men det løses ikke af mere regnekraft.

## "Upload og gå" — hvad jeg ville lægge i vejen, hvis Marc siger ja

*Ingen anbefaling om AT bygge det — kun hvad vejen selv burde indeholde,
hvis den bygges:*

1. **Genbrug appens EGEN skivetracker til stangen, ikke en håndledstilnærmelse.**
   Denne prøve bruger `bane.py`s oprindelige håndledsproxy (ordrens egen
   "stå på skuldre"-kilde) — sammenligningen i `docs/RAPPORT-188.md` viser
   den er konsekvent forskudt fra Drishtis nyere, mere præcise
   pladeaflæsning (samme retning på alle 28 punkter, ikke tilfældig støj).
   videocoach.html har allerede en produktionsafprøvet, template-matching
   skivetracker (se `docs/videocoach/HANDOVER-VIDEOCOACH.md`s "BAR-TRACKER
   FREDNING") — den løser stangpositionen bedre end enten håndledsproxyen
   ELLER en ny Hough-cirkel-detektor ville, uden ekstra udviklingsarbejde.
   PoseLandmarker ville i så fald KUN levere kropsvinklerne.
2. **Sample billeder, ikke hvert eneste.** Kontraktens 28-punkts-bane er
   Drishtis format til at sammenligne med modellen — et atlet-vendt
   "upload og gå"-flow behøver formentlig kun nøglemomenter (start,
   sticking point, lockout, samme idé som videocoach.html's egen
   "🦴 Klik-skelet"), ikke 117 fulde PoseLandmarker-kald pr. klip.
3. **Cache model + wasm via service worker** (se ovenfor) — ~21 MB én gang,
   ikke pr. video.
4. **Mål på en rigtig telefon FØRST**, før noget af dette bygges — se
   "Hvad mangler" ovenfor. Uden det tal er "upload og gå" et gæt, ikke en
   plan.

## Ærlig grænse

Transkoderingstrinnet (.mov -> mp4) er en artefakt af DENNE prøves
testopstilling (headless Chromium afkoder ikke .mov) — IKKE nødvendigvis
et problem i den rigtige app. Safari (iOS) afspiller `.mov` nativt, og
videocoach.html tager allerede imod uploads direkte fra kameraet uden
transkodering. De ~2s transkodering her bør derfor IKKE tælles med i et
ægte "upload og gå"-tidsbudget — kun de ~27s pose-ekstraktion er reelt
sammenlignelig.

## Kan appen levere kontrakten?

**Ja for de fire ledvinkler** (torso og hofte matcher Drishtis facit inden
for hendes eget usikkerhedsbånd på stort set alle 28 punkter, ankel/knæ
afviger næsten udelukkende på billeder Drishtis egen pipeline allerede
flager som upålidelige — se `docs/RAPPORT-188.md`), **nej for stangens
position uden at erstatte håndledstilnærmelsen med appens egen
skivetracker**, og prisen for det der virker i dag er cirka 21 MB
engangsdownload plus omkring 27-29 sekunder pr. klip på en almindelig
computers CPU — ikke endnu målt på en telefon, som er der hvor det rent
faktisk skal køre.

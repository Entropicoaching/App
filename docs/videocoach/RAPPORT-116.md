# RAPPORT-116: "Vis mig nu" mere 1 til 1

## Gren

`vis-mig-nu-en-til-en`, base `main` (`7efef8e`, ordre 106 med). Tre commits:

- `d4932af` — commit 1: mål hvor tiden går, pr. frame, før noget ændres
- `265c4b0` — commit 2: angrib nedskalering, verificér resten - ærligt bedste tal
- `356680b` — commit 3: kort diag-linje + ret misvisende realtids-forhold

## Hvad ændret

**Commit 1** — Ny pr.-frame-instrumentering i `vcRealtimeTrackWindow`
(`public/videocoach.html`, `vcRtDiag`): hent (getImageData/mpBuildFrame),
nedskalering (drawImage), søgning (mpMatchPoint-løkken + gen-find af
features), filter (one-euro, total pr. vindue) - samt en separat måling af
den synlige `render()`-tegning under selve sporingen ("tegning", kun
målbar i browseren, altid 0 i den headless testbænk). Samme tal vises nu i
den eksisterende `?diag=1`-linje. `verify-videocoach-clip.mjs` udvidet til
at printe samme nedbrydning. `docs/videocoach/TID-PR-FRAME.md` (39 linjer):
søgning (21-25ms/frame) og nedskalering (13-20ms/frame) dominerer.

**Commit 2** — Afprøvede `createImageBitmap({resizeWidth,resizeHeight})`
som erstatning for nedskaleringens `drawImage` (samme mønster som
MediaPipe/TF.js's kamera-input-hjælpere, "stå på skuldre"-research):
lav kvalitet var ~2-3ms/frame hurtigere, MEN ændrede banen (maxPx 40,9 over
grænsen 35px); høj kvalitet holdt banen, men var langsommere end canvas
drawImage. Forkastet i begge varianter - koden er bevaret bag et slået-fra
flag (`RT_USE_IMAGE_BITMAP = false`), ikke slettet. `alpha:false` på
nedskaleringens canvas beholdt (harmløs, ingen målt gevinst, ingen
baneændring). Verificerede (ændrede intet) at "seneste frame vinder" og
"søgning i et vindue omkring sidste fund" allerede var opfyldt siden
ordre 80/85.

Fandt undervejs den reelle flaskehals ved direkte måling: seek + opsætning
FØR selve afspilningen starter koster ~60-80ms alene, på et 0,57s-vindue
over 13% af vinduets egen varighed FØR en eneste frame er sporet. Selv
hypotetisk nul pr.-frame-tid ville derfor lande omkring 1,14x på netop
dette korte klip - browserens egen seek-latens ligger uden for ordrens
værktøjskasse (ingen encoding-ændring, ingen ny afhængighed). Se
"Ærlige grænser".

**Commit 3** — Ny førstelinje i `?diag=1` (samme DOM-element, intet nyt
UI): "x,xx× realtid, n frames sprunget over"; de eksisterende detaljer
følger uændret på linjerne under. Rettede samtidig en unøjagtighed fra
ordre 82: forholdet blev regnet mod HELE videoens varighed i stedet for de
faktisk sporede vinduer - på et sæt med mange reps men kun 3 sporede
vinduer viste det et kunstigt lavt tal. Bruger nu samme mål som
`verify:videocoach-clip`'s egen "tid/afspillet". Bekræftede (byggede ikke
nyt) at "tegn med den one-euro-filtrerede position og interpolér visuelt
mellem fund" allerede var opfyldt: `drawStroke` tager
`drawCleanBarPath`-grenen for enhver sti med `raw`+`analysis` sat (sandt
for Vis-mig-nu siden ordre 82/85), som tegner med `analysis.visualPts`
(`buildVisualBarPath`, en render-only udglatning der aldrig rører
raw/metrics). `verify-videocoach-clip.mjs` udvidet til at køre SAMME
efterbehandling som app'en og printe bekræftelsen pr. vindue.

## Testresultat

| | FØR (main, `7efef8e`) | EFTER (denne gren) |
|---|---|---|
| x realtid (grænse 1,1x) | 1,23x (1,19-1,33x på tre kørsler - maskinstøj) | 1,19-1,28x (samme støj, ingen regression) |
| frames sprunget over | 0 | 0 |
| baneafvigelse meanPx / maxPx | 5,62 / 11,10px | 4,10-5,40 / 8,17-11,10px (grænse 15/35) |

Marcs klip har kun ét rep (ét vindue) - se "Kun 1 gentagelse" i scriptets
egen advarsel. `npm run verify:videocoach-clip` er **RØD** på 1,1x-grænsen,
uændret siden ordre 82/85/109 - se "Ærlige grænser" for hvorfor, målt
direkte, ikke gættet. Kravet i testen er IKKE sænket.

- `npm run lint` — **0 fejl**, samme 13 præeksisterende
  `react-hooks/exhaustive-deps`-advarsler som ordre 109 (urørt).
- Alle øvrige 11 `verify:videocoach-*` scripts — **GRØN**.
- `npm run gate:tracker` (8 gate-rigge, inkl. `bar-path-visual-smoothing-rig`
  og `rep-preview-rig`) — **GRØN**.

## Hvad er næste

- Den reelle flaskehals for 1,1x-grænsen er nu identificeret præcist:
  browserens seek-latens (~60-80ms pr. vindue), ikke tracker-matematikken.
  En fremtidig ordre kunne undersøge om denne latens kan skjules ved at
  starte seeket til vindue 1 SAMTIDIG med at presearch stadig kører (i
  stedet for først bagefter) - ikke afprøvet her, da det ændrer rækkefølgen
  af eksisterende kald i `vcAthletePreviewThree`/`vcRunRepWindowsPresearch`,
  uden for denne ordres "kun ændringer der ikke ændrer banen"-ramme, som jeg
  læste som "ikke omstrukturér kald-rækkefølgen for at jagte tallet."
- Et klip med FLERE reps (3-5, se `docs/videocoach/TEST-CLIPS.md`) ville
  give et mere sigende billede, inkl. et reelt test af flere
  vinduer/anden-vindue-seek (kortere, da video allerede er "varm" fra et
  tidligere vindue) - Marcs eget 1-rep-klip kan ikke vise det.
- `createImageBitmap`-koden (flag `RT_USE_IMAGE_BITMAP`) er bevaret men
  slået fra - en anden browser/telefon-situation kunne i princippet regne
  anderledes, men det er ikke afprøvet her.

## Ærlige grænser

- **1,1x-grænsen er IKKE nået** på Marcs klip. Direkte målt: seek + opsætning
  FØR afspilning koster ~60-80ms på dette 0,57s-vindue - over 13% af
  vinduets egen varighed, FØR en eneste frame er sporet. Selv perfekt
  pr.-frame-ydelse (nul ms søgning/nedskalering) ville derfor kun nå
  ~1,14x, ikke under 1,1x. Dette er browserens egen video-seek-latens,
  ikke noget denne ordres værktøjskasse (ingen encoding-ændring, ingen ny
  afhængighed, ingen ændring af analyse/faser) kan fjerne.
- Testens egen metode (den fulde analyse kører gennem HELE klippet lige
  FØR "Vis mig nu"-vinduerne testes) efterlader videoen ved klippets
  slutning, så vindue 1's seek bliver et stort, "koldt" spring tilbage.
  I den rigtige app går "Vis mig nu" ALDRIG gennem en fuld seek-baseret
  analyse først - kun presearch's egen, lettere seeking. Det er muligt
  (ikke bevist, ikke afprøvet - kræver browser-baseret måling af den
  rigtige app, uden for denne ordres rammer: "aldrig OS-musen") at
  vindue 1's seek er billigere i virkeligheden end i testen. Jeg har
  IKKE ændret testens metode for at få et pænere tal - det ville være at
  gætte på om det er fair, ikke måle det.
- `createImageBitmap`-forsøget (commit 2) blev kun målt på DETTE ene klip,
  tre-fire kørsler. En anden telefon/browser kunne i princippet regne
  anderledes - ikke efterprøvet.
- Kørsel-til-kørsel-variansen (1,19x-1,33x for præcis samme commit, se
  TID-PR-FRAME.md) er denne udviklingsmaskines egen baggrundsbelastning,
  ikke en ændring i koden.
- Ingen atletdata læst, hentet eller kopieret; kun Marcs eget testklip
  brugt, som allerede lå lokalt (gitignored).
- Ingen ny afhængighed, ingen push, ingen ændring af analyse/faser/metrics
  eller upload-vejen.

## Betydning for Hara

Sporet "Appen mærkbart bedre for atleterne"
(spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a): "Vis mig nu" er det
atleten ser FØRST efter et løft, og et tydeligt forsinket/upræcist
øjebliksbillede underminerer tilliden til værktøjet. Denne ordre finder og
dokumenterer PRÆCIST hvorfor 1:1 ikke er nået (browserens seek-latens, ikke
gættet matematik), retter en misvisende diagnostisk måling Marc selv læser,
og lægger et konkret, afprøvet spor til en fremtidig ordre (skjul seeket
bag presearch). Intet Delmål lukkes.

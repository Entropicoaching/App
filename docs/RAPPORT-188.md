# Rapport — Ordre 188: kan appen måle det Drishti måler? En prøve, ikke et produkt

Planet: coaching · Spor: spor-kropsmodel-til-teknikfeedback-i-de-tre-loeft-fb7bd5

## Gren

`pose-proeven`, forgrenet fra `main` (`088ec36`). Tre commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `2ebf871` | `scripts/pose-proeve/` — PoseLandmarker i browseren måler Marcs dødløft |
| 2 | `9a24ea0` | `scripts/pose-proeve/sammenlign.mjs` — sammenligning mod Drishtis facit |
| 3 | `9bfbde4` | `docs/videocoach/POSE-PROEVE.md` — hvad det ville koste i appen |

Arbejdstræet er rent efter hver commit. Intet i `src/` er rørt, appens egen
`package.json` har ingen ny afhængighed, ingen video er committet (kun
`outputs/pose-proeve/*.json`), ingen atletdata (kun Marcs eget klip),
ingen push. Bhishaks filer (`src/Dashboard.jsx`, `outputs/maal-coach/`) er
ikke rørt.

## Hvad ændret

**Commit 1.** `scripts/pose-proeve/` er en selvstændig prøve UDEN FOR
entropi-app's bundle: egen `package.json`/`node_modules` (kun
`@mediapipe/tasks-vision`), Playwright fra den delte codex-runtime (samme
kilde som `e2e/harness.mjs`), og ffmpeg LÅNT fra appens egen, allerede
eksisterende devDependency (`ffmpeg-static`) til at transkodere
`test-clips\marc-doedloeft-270.mov` -> mp4 (Chromium afkoder ikke `.mov`).
`matematik.mjs` er en 1:1 JS-oversættelse af
`entropi-loeftmodel-wt2/tools/videomaal/maal.py` + `bane.py`s formler
(landmark-indekser, sidevalg, `angle_at`, `signed_lean_from_vertical`, den
robuste gulv-/midtfod-/skala-reference) — ikke egne formler, som ordren
selv krævede. Bevidst UDELADT: `stoej.py`s senere Hough-cirkel-
pladeaflæsning for stangen — kun `bane.py` er "stå på skuldre"-kilden i
ordren (se "Hvad ændret", commit 2, for hvad det betyder).

To fejl blev fundet og rettet undervejs (begge dokumenteret i filernes
egne kommentarer, ikke skjult):
- **Billeder droppet ved normal afspilning.** Første forsøg brugte
  `requestVideoFrameCallback` under afspilning (samme mønster som
  videocoach.html's egen tracker, `docs/videocoach/HANDOVER-VIDEOCOACH.md`)
  — men PoseLandmarkers synkrone WASM-kald er langsommere end videoens
  egen realtid, så Chromium sprang billeder over: kun 41 af 117 fanget.
  Rettet ved at skifte til eksplicit seek pr. billede (video sat på pause).
- **Hvert tredje billede en kopi af det forrige.** Seek til præcis `n/fps`
  landede en tredjedel af tiden på DET FORRIGE billede (flydende-komma-
  afrunding i browserens seek-implementation) — ni af 28 målinger var
  byte-for-byte gentagelser. Rettet ved at seeke til billedets MIDTpunkt
  (`(i+0,5)/fps`) i stedet, verificeret: 0 gentagelser i den endelige kørsel.

Output: `outputs/pose-proeve/marc-doedloeft-270-bane.json` (28 målinger,
billede 21-48, `docs/MAALING-KONTRAKT.md`s format) + `-reference.json`
(gulv/skala/side/timing-regnskab, samme gennemsigtighedsmønster som
Drishtis egen `bane.py`). 117/117 billeder fandt en krop. Side valgt:
**right** — samme side Drishtis `maal.py` selv valgte.

**Commit 2.** `sammenlign.mjs` bygger firefelts-tabellen fra
`docs/videocoach/RAPPORT-124.md` (median og maks absolut forskel, plus
hvor mange af de 28 punkter der ligger inden for Drishtis eget
`usikkerhed`-bånd — skiller forskellen fra målemetoden, samme princip
124's tabel selv brugte):

| Felt | Median abs. forskel | Maks abs. forskel (billede) | Inden for usikkerhedsbånd |
|---|---|---|---|
| ankelGrader | 3,07° | 32,78° (billede 27) | 23/28 |
| knaeGrader | 4,96° | 32,58° (billede 27) | 23/28 |
| hofteGrader | 1,36° | 4,48° (billede 22) | 27/28 |
| torsoGrader | 0,70° | 3,14° (billede 34) | 28/28 |
| xFodlaengder | 0,2216 fl | 0,3883 fl (billede 35) | 0/28 |
| yFodlaengder | 1,3007 fl | 1,8460 fl (billede 22) | 0/28 |

(fl = fodlængder)

**torsoGrader og hofteGrader: samme måling.** 28/28 og 27/28 ligger inden
for Drishtis eget usikkerhedsbånd — browserens PoseLandmarker og Pythons
MediaPipe-pipeline måler her det samme, med den samme spredning Drishtis
egen ensemble-metode allerede tilskriver sig selv.

**ankelGrader/knaeGrader: 23/28, men IKKE tilfældig støj.** Krydstjekket
mod Drishtis egen `paalidelig`-flag (fra hendes `stoej.py`, som flager
billeder hvor ankelpunktet er usporet, okkluderet af den nære vægtskive):
4 af de 5 ankelGrader-udenfor-bånd-billeder (23, 24, 26, 27) og 3 af de 5
knaeGrader-udenfor-bånd-billeder (23, 24, 26) er PRÆCIS de billeder
Drishtis egen pipeline allerede mærker upålidelige. Det er en delt
målevanskelighed (samme okklusion rammer begge pipelines), ikke en
model-uenighed. De resterende 1-2 punkter (billede 40, 43) er mindre
(2,1-5,6°) og ægte, mindre afvigelser.

**xFodlaengder/yFodlaengder: 0/28, men systematisk, ikke tilfældig.** Alle
28 forskelle peger SAMME VEJ (positive — min måling ligger konsekvent
foran og over Drishtis). Årsagen er forventet og bevidst: denne prøve
bruger `bane.py`s ORIGINALE håndledstilnærmelse for stangen, mens Drishtis
NUVÆRENDE facit-fil siden er opgraderet til `stoej.py`s automatiske
Hough-cirkel-pladeaflæsning — to forskellige målemetoder for samme
fysiske stang, ikke en pose-model-uenighed. Ordren pegede kun på `bane.py`
som kilde, ikke `stoej.py`, så dette er et bevidst, noteret valg.

**Commit 3.** `docs/videocoach/POSE-PROEVE.md`: ~29s pr. klip total
(~232ms/billede kun selve pose-ekstraktionen, målt CPU-delegate,
headless) — til sammenligning ~5× langsommere pr. billede end
videocoach.html's EGEN, allerede produktionsafprøvede skivetracker
(44-52ms/billede, `docs/videocoach/TID-PR-FRAME.md`). ~21 MB
engangsdownload (model 9,4 MB + WASM 11,2 MB + loader 0,5 MB), cachebart.
Ingen måling på en rigtig telefon endnu — kun noteret som åbent spørgsmål,
med `HANDOVER-VIDEOCOACH.md`s egen advarsel om at seek-pr-billede er
"10-30× langsommere på mobil" citeret som grund til at tro det bliver
værre der. "Upload og gå"-skitsen (ingen anbefaling om at bygge den):
genbrug appens EGEN skivetracker til stangen i stedet for
håndledstilnærmelsen (løser commit 2's eneste reelle uenighed), sample
billeder i stedet for alle 117, cache model+wasm via service worker, mål
på en rigtig telefon FØRST. Sluttet med ét samlet svar: ja for de fire
vinkler, nej for stangen uden en bedre reference, prisen for det der
virker i dag er ~21 MB + ~27-29s pr. klip på en computers CPU.

## Testresultat

**npm run lint:** rent (intet i `src/` rørt).
**npm run e2e:** GRØN — "atlet → coach, ende-til-ende", 24,9s (uændret,
denne gren rører ikke appens kode).
**Alle 31 `verify:*`-scripts + `verify:n8n`:** 32/32 grønne.
**Selve prøven** (`node scripts/pose-proeve/extract.mjs`): 117/117
billeder fandt en krop, 0 gentagne billeder i den endelige bane, side
valgt = right (matcher Drishtis eget valg). Kørt flere gange under
udvikling (se commit 1's to rettelser) — sidste, endelige kørsel er den
committede `outputs/pose-proeve/marc-doedloeft-270-bane.json`.
**`node scripts/pose-proeve/sammenlign.mjs`:** deterministisk — gen-kørt
under denne rapport uden at ændre den committede
`marc-doedloeft-270-sammenligning.json` (`git status` rent bagefter).

## Hvad er næste

- Spørgsmålet ordren stillede er besvaret: JA for kropsvinklerne (torso/
  hofte fuldt inden for Drishtis egen usikkerhed, ankel/knæ næsten
  udelukkende afviger på allerede-kendte upålidelige billeder), IKKE for
  stangens position medmindre håndledstilnærmelsen erstattes — se
  `docs/videocoach/POSE-PROEVE.md`s sidste afsnit for hele svaret.
- Hvis Marc siger ja til at bygge videre: næste skridt er IKKE endnu en
  pose-proeve, men de to ting POSE-PROEVE.md selv peger på — (1) genbrug
  videocoach.html's egen skivetracker til stangen i stedet for
  håndledstilnærmelsen, (2) mål den samme prøve på en rigtig telefon, ikke
  kun denne maskines CPU. Ingen af delene er bygget her — bevidst, ordren
  bad kun om tallene.
- Har betydning for Hara (spor
  "kropsmodel-til-teknikfeedback-i-de-tre-loeft"): et konkret, tal-baseret
  svar på om browseren kan levere Drishtis kontrakt findes nu — beslutningen
  om at bygge videre (eller ej) kan tages på tal, ikke en antagelse. Intet
  Delmål lukket (ordren selv: "Intet Delmål i hovedblokken").

## Ærlige grænser

- **Kun ét klip, ét løft, én atlet (Marc selv).** Samme grænse Drishtis
  egne rapporter allerede har (ordre 178-183) — ingen af de to pipelines
  er afprøvet bredere end dette. Et resultat her generaliserer ikke til
  "virker altid", kun "virkede på dette klip".
- **Stang-sammenligningen er ikke ærlig ende-til-ende** — se commit 2's
  forklaring. 0/28 inden for bånd ser dramatisk ud isoleret, men skyldes
  et BEVIDST metodevalg (bane.py, ikke stoej.py), ikke at PoseLandmarker
  er dårligere til at finde stangen end MediaPipes Python-udgave. En
  fremtidig, ærlig stang-til-stang-sammenligning kræver enten at
  genskabe stoej.py's Hough-cirkel i browseren, eller (billigere,
  anbefalet i POSE-PROEVE.md) bruge videocoach.html's egen skivetracker.
- **CPU-delegate, ikke GPU, og ingen telefon-måling.** Timing-tallene i
  commit 3 er en headless Chromium-CPU-baseline, ikke et loft eller et
  gulv — en rigtig browser med GPU kan være hurtigere, en telefon
  formentlig langsommere. Ingen af delene er målt her, kun navngivet som
  åbne spørgsmål.
- **`usikkerhed`-båndet i sammenligningen er Drishtis egen ensemble-
  spredning, ikke en fælles standard.** At ligge "inden for båndet"
  betyder "inden for HENDES måls egen støj" — det er den mest ærlige
  tilgængelige målestok (kontraktens egen), men det er ikke det samme som
  en uafhængig facit-sandhed.
- **Transkoderingstrinnet er en artefakt af testopstillingen**, ikke
  nødvendigvis et problem i den rigtige app — se POSE-PROEVE.md's eget
  afsnit herom. De ~2s er ikke talt med i det sammenlignelige tidsbudget.
- Ingen atletdata i denne rapport eller i de committede filer — Marcs eget
  testklip (`test-clips\`) er git-ignoreret og blev aldrig committet.

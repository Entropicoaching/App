# Rapport — ordre 218: appens måling opfylder kontrakten: stangen fra skiven, ikke håndleddet

## Gren

Gren `appens-maaling-2`, forgrenet fra `main` (`498ae40`, ordrens egen
base — `main`s spids var på kørselstidspunktet rykket videre til `1dad534`
via ordre 211, som ikke var en del af denne ordres kontekst; grenen bygger
derfor bevidst på den pinnede base, ikke den nyeste `main`).

- `7d72033` — commit 1: stangen fra skiven, ikke håndleddet
- `c2d5597` — commit 2: usikkerhedsbånd i JS, ikke Drishtis som proxy
- `9fae6dd` — commit 3: kæden uden Python, appens egen bane mod modellen
- `002a7bd` — commit 4: samme kæde på frontsquatten
- `22066bd` — commit 5: POSE-PROEVE.md opdateret med prisen
- (denne rapport er commit 6, se hash i `git log` efter commit)

Specen der styrer denne ordre: `entropi-loeftmodel/docs/APP-MAALING.md`
(kun læsning). Alt kode er i `scripts/pose-proeve/` — stadig UDENFOR
appens bundle, `src/` er ikke rørt, ingen ny afhængighed i appens egen
`package.json`.

## Stå på skuldre — hvad der blev taget fra hvem

- **`public/videocoach.html`s `recenterOnPlate()`** (skive-recentrering
  v2): den 16-stråle radiale kant-scan er porteret BOGSTAVELIGT ind i
  `scripts/pose-proeve/skive.mjs`s `edgeScan()` — samme matematik, samme
  valideringstærskler (±18 % radiusbånd, spread ≤5,5 %, ≥6/8 strålepar
  enige). Det ER genbrug, ikke en ny cirkeldetektor.
- **Hvad der IKKE kunne genbruges løsrevet, og hvorfor:** appens fulde
  skivetracker er en LIVE, klik-seedet, kontinuert tracker — invarianterne
  er eksplicit fredet (`docs/videocoach/HANDOVER-VIDEOCOACH.md`, "BAR-
  TRACKER FREDNING": "bryd dem ALDRIG uden rig-bevis foerst"). Denne prøve
  har hverken et klik eller kontinuitet (seek-pr-billede, uafhængigt).
  Ordren åbner selv for dette tilfælde ("kun hvis den ikke kan bruges
  løsrevet, så OpenCV.js HoughCircles som Drishtis stoej.py gør") — i
  stedet for en ekstern OpenCV.js-afhængighed blev en grov gittersøgning
  (`findPlate()`) bygget på TOPPEN af den genbrugte kant-scan, seedet af
  håndleddet (samme "stå på skuldre"-proxy ordre 188 allerede bruger til
  vinklerne).
- **`entropi-loeftmodel/tools/videomaal/stoej.py`**: radius-intervallet
  170-230px (dens `--min-radius`/`--max-radius`-standardværdier for netop
  dette klip) genbrugt som `findPlate()`s søgeinterval — hendes TUNEDE
  PARAMETER, ikke hendes facit-tal.
- **`tools/videomaal/usikkerhed.py`**: samme tre-akse-ensemble (side,
  nabobillede, udglatning) og samme valg (spænd, ikke standardafvigelse) i
  `scripts/pose-proeve/usikkerhed.mjs` — se commit 2 nedenfor for den ene,
  bevidste forskel.
- **`squat_bane.py`**: mønster for `matematik.mjs`s
  `beregnKontraktPunktSquat()` (hoftehøjde i stedet for et stang-felt).
- **`scripts/hele-banen-mod-model.mjs`** (løftmodel-repoet): kørt DIREKTE,
  ikke genskrevet — se commit 3.
- **Tracker-invariant #2** ("spring > R\*0.6 -> gensøg nært - ingen
  coast"): AFPRØVET som et kontinuitetsfilter på tværs af billeder,
  AFVIST — se commit 1.

## Commit 1 — stangen fra skiven

`skive.mjs` finder skiven pr. billede: `edgeScan()` (genbrugt
kant-matematik) + `findPlate()` (ny gittersøgning, seedet af håndleddet,
radius 170-230px). Kørt i browseren (`harness.html`) i samme seek-loop som
PoseLandmarker, på canvas'en der allerede er tegnet — ingen ekstra
pixel-transport til Node.

**Første forsøg** (ingen ekstra filtrering): 28/28 billeder fik en
"valideret" skive, men sammenligning mod Drishtis facit viste
`xFodlaengder`/`yFodlaengder` stadig svagt (median 0,73 / 2,36
fodlængder, kun 5/28 inden for hendes bånd) — fejlsøgning
(`tmp/debug-skive.mjs`, midlertidig, ikke committet) viste at
`findPlate()` i de tidlige billeder (nær gulvet, hvor håndleddet selv er
svagt, op til ~2,7 fodlængder forkert allerede FØR skivesøgningen)
konsekvent låste sig fast på et andet, lige så veldefineret rundt objekt
et godt stykke over den sande skive.

**Kontinuitetsfilter afprøvet, afvist:** tracker-invariant #2s "spring >
R\*0.6 -> gensøg nært" blev implementeret som et `lastGood`-gate hen over
hele klippets 117 billeder. Resultat: VÆRRE (0/28 i stedet for 5/28,
`yFodlaengder`-median 2,64 mod 2,36) — en tidlig fejldetektion opfyldte
sin EGEN kontinuitet og forhindrede korrektion tilbage til den sande
skive, som den uafhængige søgning ellers fandt korrekt i de senere
billeder. Rullet tilbage (se `harness.html`s kommentar for hvorfor).

**Det der virkede:** en fysisk sandsynlighedsport — bar-banen for et
dødløft kan ikke ligge over ca. lockout-højde (`PLAUSIBEL_Y_MAX_FL=3,6`,
en rundhåndet margin, ikke Drishtis tal). Kasserer fysisk umulige
detektioner til fordel for håndled-fallback i stedet for at acceptere et
sikkert, men forkert, svar. Resultat: **9/28 billeder fik en valideret
skive** (resten håndled), og sammenligningen forbedredes til median 0,14 /
1,12 fodlængder, stadig **5/28 inden for Drishtis usikkerhedsbånd** for
begge felter — SAMME størrelsesorden som hendes egen pladeaflæsning
(2-11/28), ordrens eget mål (ikke et krav om 28). Op fra 0/28 med
håndleddet.

`stang_kilde` mærker hvert punkt ærligt (skive/håndled).

## Commit 2 — usikkerhedsbåndet

`usikkerhed.mjs` porter `usikkerhed.py`s ensemble til JS. Én bevidst
forskel, en effektivitetsgevinst: Python-udgaven må køre MediaPipe IGEN
for "den anden side", fordi dens landmark-fil kun gemte den valgte sides
punkter. `extract.mjs` beholder allerede alle 117 billeders FULDE
BlazePose-landmarks (begge sider) — "den anden side" er her blot et andet
array-indeks, ingen ny model-kørsel (se tidsregnskabet i commit 5).

Stangen (skiven) har ingen side (samme observation som `stoej.py`) —
dens ensemble er fire varianter (center, to naboer, udglatning), ikke
fem. Falder et punkts `stang` tilbage til håndled, bruger
`stangUsikkerhed()` i stedet håndledets EGNE fem varianter (side +
naboer + udglatning), for at være internt konsistent med `stang_kilde`.

**Sammenligning af båndbredder** (median, mit mod Drishtis):

| Felt | Mit bånd | Drishtis bånd | Forhold | Over faktor 2 |
|---|---|---|---|---|
| ankelGrader | 9,13° | 9,03° | 1,01 | nej |
| knaeGrader | 16,07° | 13,04° | 1,23 | nej |
| hofteGrader | 8,61° | 11,98° | 0,72 | nej |
| torsoGrader | 5,86° | 6,42° | 0,91 | nej |
| xFodlaengder | 0,0953 fl | 0,0317 fl | 3,01 | **JA** |
| yFodlaengder | 0,2172 fl | 0,1375 fl | 1,58 | nej |

**Forklaring på xFodlaengder (3,0×):** kun 9/28 punkter har en skive at
bygge et tæt bånd på (typisk 0,01-0,03 fl, meget konsistent mellem
naboer). De resterende 19/28 falder tilbage til håndleddets eget,
bredere ensemble (typisk 0,1-0,4 fl, håndleddets kendte støj ved
opstilling/tidligt i trækket) — medianen over alle 28 trækkes derfor op
af den håndled-tunge halvdel. Ikke en fejl i selve ensemblet, en
konsekvens af commit 1's 9/28-dækning.

## Commit 3 — kæden uden Python

Kørt `entropi-loeftmodel/scripts/hele-banen-mod-model.mjs --kilde app`
DIREKTE på commit 1+2's `marc-doedloeft-270-bane.json` — INGEN
`fra_app.py`-substitution (appens egen skive-stang og JS-usikkerhedsbånd
går direkte ind i kæden, som `docs/APP-MAALING.md` efterspørger).

**Mekanik** (løftmodel-repoet: kun læsning + kørsel, ingen varig ændring):
scriptets `--kilde app` forventer sin input på en fast sti INDE i
løftmodel-repoets egen `outputs/videomaal/`-mappe. Min bane.json blev
midlertidigt kopieret dertil, scriptet kørt, dets output kopieret HERTIL
(`outputs/pose-proeve/marc-doedloeft-270-hele-banen-mod-model.json`), og
løftmodel-repoets arbejdstræ derefter gendannet med `git checkout --`
(verificeret: `git status` rent bagefter, ingen commit lavet der).

**Tabel, indenFor/28 (app / Drishtis egen):**

| Felt | App | Drishtis egen |
|---|---|---|
| ankelGrader [tilpasset] | 13 | 13 |
| knaeGrader | 19 | 18 |
| hofteGrader | 10 | 10 |
| torsoGrader | 10 | 9 |
| xFodlaengder | 12 | 2 |
| yFodlaengder | 0 | 11 |

Vinklerne bærer sammenligningen mod modellen mindst lige så godt som
Drishtis egne (knæ/torso endda en anelse bedre her). Stangen er ulige:
appens skive vinder klart på `xFodlaengder` (12 mod 2 — den vandrette
position er overraskende god), men taber helt på `yFodlaengder` (0 mod
11) — konsistent med commit 1's fund (kun 9/28 skive-dækning, og selv de
skive-baserede punkter har en systematisk højde-forskel til Drishtis
plade, se `marc-doedloeft-270-sammenligning.json`).

**Ærlig bemærkning:** scriptets egen `konklusion_appens_vinkler_alene`-
tekst (en fast streng i `hele-banen-mod-model.mjs`, ikke redigerbar
herfra) beskriver stadig ordre 212s situation ("proxy fra Drishtis eget
ensemble") — den er forældet efter denne ordre (appen leverer nu sin EGEN
stang og sit EGET bånd, ikke en proxy), men da filen er læs+kør-kilde,
ikke min at rette, er dette noteret her i stedet.

## Commit 4 — frontsquatten også

`extract-squat.mjs`: samme kæde på Marcs frontsquat-klip
(`IMG_0838.MOV`, `Downloads\`, ALDRIG kopieret ind i repoet eller
committet — kun de første ~172 af klippets ~838 billeder transkoderes,
banen når kun til billede 167). Ingen skivedetektion (`skipSkive: true`)
— frontsquat har intet stang-felt, samme begrundelse som `squat_bane.py`.

`matematik.mjs`s `beregnKontraktPunktSquat()` og `usikkerhed.mjs`s
`hoftehoejdeUsikkerhed()` spejler `squat_bane.py`/`usikkerhed.py`s
frontsquat-gren (fire vinkler + `hofte.hoejdeFodlaengder`).

**Tabel, indenFor/93 (mod Drishtis `marc-frontsquat-0838-bane.json`):**

| Felt | Median abs. forskel | Inden for bånd |
|---|---|---|
| ankelGrader | 1,59° | 81/93 |
| knaeGrader | 4,25° | 76/93 |
| hofteGrader | 4,4° | 83/93 |
| torsoGrader | 2,24° | 85/93 |
| hoejdeFodlaengder | 0,1181 fl | 65/93 |

Klart stærkere end dødløftets stang-tal — uden en skive at læne sig på,
bæres frontsquattens position (hoftehøjde) af kroppens egne, pålidelige
landmarks (hoften er sjældent okkluderet på samme måde som stangen ved
opstilling). 96 målinger, 13 huller (ingen krop fundet) ud af 109 mulige
billeder (58-166) — samme størrelsesorden som Drishtis egne otte huller i
samme interval (`squat_bane.py`s egen kommentar).

## Commit 5 — hvad det koster i appen, opdateret

`docs/videocoach/POSE-PROEVE.md` opdateret: tid pr. klip nu opdelt
(transkodering/pose/skive/usikkerhed) for både dødløft (~24,0s) og
frontsquat (~41,5s). Skivedetektionen lægger ~12ms/billede (~6 % oveni
pose-ekstraktionen for dødløft); usikkerhedsensemblet koster praktisk
talt intet (ren CPU-regning på data der allerede findes, ingen ekstra
model-kørsel). Downloadstørrelsen (~21 MB model+wasm) er UÆNDRET —
`skive.mjs`+`usikkerhed.mjs` er tilsammen ~15 KB ren JS.

"Upload og gå"-punkt 1 omskrevet fra en antagelse til et fund: appens
LIVE skivetracker viste sig ikke genbrugelig løsrevet til en batch-vej
uden klik/kontinuitet (se "stå på skuldre" ovenfor) — hvad en rigtig
"upload og gå"-vej ville kræve for en pålidelig stangposition er nu
eksplicit (et klik-trin ELLER et ægte lost-genkend-mønster), ingen af
delene bygget her. Ingen anbefaling om at bygge det.

## Testresultat

- `npm run lint`: grøn (kørt fire gange, én gang pr. commit-runde).
- `verify:videocoach-plate-detect` (nærmeste `verify:*` til dette
  område): grøn — appens EGEN skivedetektion er urørt (kun læst, aldrig
  redigeret), verify bekræfter det.
- `npm run e2e`: **KUNNE IKKE KØRES** — port 8991 var optaget af en
  allerede kørende Node-proces (`e2e/coach-sporing-trace-real.mjs`, pid
  19844, startet kl. 10:58 samme morgen), højst sandsynligt Bhishaks
  egen kørsel af tracker-e2e i `entropi-app-wt2` (ordrens egen advarsel:
  "Bhishak arbejder i entropi-app-wt2 på videocoachens tracker og e2e").
  Processen er IKKE dræbt (ordrens grænse: rør intet af Bhishaks). Denne
  ordre rører intet i `src/` eller `public/` — ingen grund til at
  forvente en regression, men det er IKKE empirisk verificeret her. Bør
  gen-køres når porten er fri.
- Løftmodel-repoets arbejdstræ: rent efter commit 3 (verificeret `git
  status`).

## Hvad er næste

- Marc dømmer på tallene: er 5/28 (stang) og 65-85/93 (squat-hoftehøjde)
  gode nok til at investere i en rigtig løsning, eller skal en anden vej
  (klik-trin, mobiltest først, kun vinkler) forfølges? Ingen anbefaling
  herfra, som ordren beder om.
- `npm run e2e` bør gen-køres når port 8991 er fri, for en fuld,
  uafhængig bekræftelse af "uændret".
- Hvis Marc siger ja til "upload og gå": de to konkrete huller er nu
  navngivet (stangens klik/lost-genkend, mobilmåling) — se
  `docs/videocoach/POSE-PROEVE.md`.

## Ærlige grænser

- Skivedetektionen (5/28, 9/28-dækning) er stadig svag — den bærer IKKE
  kontrakten alene, kun samme størrelsesorden som Drishtis egen. Den
  systematiske højdeforskel på de skive-baserede punkter (se commit 3's
  `yFodlaengder` 0/28 mod modellen) er ikke fuldt forklaret her — kun
  observeret og dokumenteret, ikke rettet.
- `npm run e2e` ikke kørt (se Testresultat) — ærligt uverificeret, ikke
  antaget grøn.
- Frontsquat-klippet (`IMG_0838.MOV`) er læst direkte fra `Downloads\`
  ved fuld sti, aldrig kopieret eller committet, som ordren kræver.
- Ingen atletdata i denne rapport eller i nogen committet fil — kun Marcs
  eget klip (`test-clips/marc-doedloeft-270.mov`, allerede gitignored fra
  tidligere ordrer) og et absolut, ikke-committet Downloads-klip.

## Til Hara

Intet Delmål i hovedblokken (ordrens egen instruks), og intet af dette er
i appens bundle — det er fortsat en prøve, ikke en levering til atleter.
Ingen direkte betydning for "Appen mærkbart bedre" endnu; betydningen
kommer først hvis/når Marc siger ja til at bygge noget af det ind i appen.

---

**Til Marc:** stangen fra skiven virker nu bedre end håndleddet (0/28 ->
5/28, ligesom Drishtis egen målemetode), men appens EGEN live skivetracker
kunne ikke genbruges direkte — det kræver enten et klik-trin eller mere
udviklingsarbejde, ikke bare mere regnekraft. Usikkerhedsbåndet er ægte nu
(ikke lånt af Drishti), og frontsquattens hoftehøjde er det stærkeste
resultat i hele ordren (65-85/93) — uden en skive at kæmpe med.

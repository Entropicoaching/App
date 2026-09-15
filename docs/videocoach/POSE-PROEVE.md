# POSE-PROEVE: kan appen måle det Drishti måler?

Ordre 188, opdateret ordre 218. Svaret er tal fra en engangsprøve
(`scripts/pose-proeve/`), ikke en anbefaling og ikke et appfeature — se
`docs/RAPPORT-188.md` og `docs/RAPPORT-218.md` for hele historien og
sammenligningstabellerne mod Drishtis facit. Denne fil samler kun **hvad
det ville koste** at bygge det rigtige, hvis Marc siger ja.

## Tid pr. klip (målt, coachens/denne maskines CPU) — ORDRE 218: nu med skive + bånd

| Trin | Tid (dødløft, 117 billeder) | Tid (frontsquat, 172 billeder) |
|---|---|---|
| Transkodering + browseropstart (.mov -> mp4, headless Chromium) | ~1,6s | ~1,9s |
| PoseLandmarker (IMAGE-mode, CPU-delegate), ALENE | ~21,0s (≈179ms/billede) | ~39,6s (≈230ms/billede, matcher 188's 232ms) |
| **Skivedetektion** (`skive.mjs`, kun dødløft — se "Upload og gå" nedenfor) | **+1,4s** (≈12ms/billede oveni pose-ekstraktionen) | 0s (slået fra, `skipSkive` — frontsquat har intet stang-felt) |
| **Usikkerhedsensemble** (`usikkerhed.mjs`) | **+~0s** | **+~0s** |
| **Total, klip til færdig bane** | **~24,0s** | **~41,5s** |

Usikkerhedsensemblet koster praktisk talt intet ekstra tid: det er ren
CPU-regning i Node PÅ data extract.mjs allerede har (samme rå landmarks
for begge sider + naboer, se `usikkerhed.mjs`s egen toptekst) — INGEN nyt
MediaPipe-kald, i modsætning til Drishtis `usikkerhed.py`, som må køre
modellen igen for "den anden side" (se næste afsnit for hvad det sparer
i praksis). Skivedetektionen lægger til gengæld ~6 % oveni
pose-ekstraktionens tid for dødløft-klippet — en grov gittersøgning
(`findPlate()`) kørt for hvert billede, se "Upload og gå" nedenfor for
hvorfor den er der.

Til sammenligning: videocoach.html's EGEN, allerede produktionsafprøvede
skivetracker (template-matching, ikke en pose-model) måler
44-52ms/billede for HELE sit arbejde — se `docs/videocoach/TID-PR-FRAME.md`.
PoseLandmarker ALENE er altså stadig **~4-5× langsommere pr. billede** end
den tracker appen allerede har liggende og kører i produktion i dag —
skivedetektionen her (12ms/billede) er ikke det dyre trin.

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

ORDRE 218: skive- og usikkerhedskoden (`skive.mjs` + `usikkerhed.mjs`) er
tilsammen ~15 KB ukomprimeret ren JS, ingen ny model eller WASM-runtime —
under 0,1 % oveni de ~21 MB. **Downloadstørrelsen er derfor UÆNDRET** af
denne ordre: at lukke stang- og usikkerhedshullerne kostede tid
(skivesøgningens ~12ms/billede), ikke MB.

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

1. **Stangen: appens egen skivetracker viste sig IKKE genbrugelig løsrevet
   — ordre 218 fandt det ud, og "upload og gå" skal regne med den
   konklusion, ikke den gamle antagelse.** videocoach.html's
   produktionstracker (`docs/videocoach/HANDOVER-VIDEOCOACH.md`s
   "BAR-TRACKER FREDNING") er en LIVE, klik-seedet, kontinuert tracker —
   coachen klikker skiven, resten er frame-til-frame-kontinuitet, og
   invarianterne er eksplicit fredet ("bryd dem ALDRIG uden rig-bevis
   foerst"). En batch/"upload og gå"-vej uden et menneskeligt klik og uden
   den kontinuitet kan IKKE bruge den tracker som den er. Ordre 218 byggede
   i stedet `scripts/pose-proeve/skive.mjs`: trackerens EGEN radiale
   kant-scan (`recenterOnPlate()`, genbrugt bogstaveligt), plus en ny grov
   gittersøgning seedet af håndleddet (MediaPipe-proxyen, samme "stå på
   skuldre"-kilde som selve vinklerne), plus en fysisk
   sandsynlighedsport (bar-banen kan ikke ligge over lockout-højde). Det
   løftede stangen fra 0/28 til 5/28 inden for Drishtis usikkerhedsbånd —
   samme størrelsesorden som Drishtis egen pladeaflæsning (2-11/28), IKKE
   en løsning der bærer kontrakten alene (se `docs/RAPPORT-218.md`,
   commit 1). Et FORSØG på at bruge tracker-invariant #2's
   kontinuitetsregel ("spring > R*0.6 -> gensøg nært") som et filter blev
   afprøvet og AFVIST — en tidlig fejldetektion låste sig fast på et
   forkert, stillestående objekt og forhindrede korrektion (se rapportens
   commit 1-afsnit). Skal "upload og gå" have en pålidelig stangposition,
   er det EGEN opgave, ikke en genbrugsgevinst: enten et rigtigt
   klik-til-at-starte-trin (atleten/coachen peger på skiven i første
   billede, ligesom trackeren allerede forudsætter i dag), eller et
   ægte lost-genkend-mønster (vide HVORNÅR forankringen er forkert, ikke
   kun at den er kontinuert med sig selv — ikke bygget i denne prøve).
2. **Usikkerhedsbåndet koster ~intet ekstra at bygge rigtigt.**
   `usikkerhed.mjs` viser at ensemblet (side + naboer + udglatning) er ren
   CPU-regning på data appen allerede har, når den (som denne prøve)
   beholder alle billeders fulde MediaPipe-landmarks — ingen ekstra
   model-kørsel, i modsætning til Drishtis egen Python-kæde. Slipper appen
   for at "smide" den anden sides landmarks og nabobillederne væk, følger
   et ægte bånd praktisk talt gratis med.
3. **Sample billeder, ikke hvert eneste.** Kontraktens 28-punkts-bane er
   Drishtis format til at sammenligne med modellen — et atlet-vendt
   "upload og gå"-flow behøver formentlig kun nøglemomenter (start,
   sticking point, lockout, samme idé som videocoach.html's egen
   "🦴 Klik-skelet"), ikke 117 fulde PoseLandmarker-kald pr. klip.
4. **Cache model + wasm via service worker** (se ovenfor) — ~21 MB én gang,
   ikke pr. video. Skive- og usikkerhedskoden lægger intet mærkbart til
   denne downloadstørrelse (se ovenfor).
5. **Mål på en rigtig telefon FØRST**, før noget af dette bygges — se
   "Hvad mangler" ovenfor. Uden det tal er "upload og gå" et gæt, ikke en
   plan.

## Ærlig grænse

Transkoderingstrinnet (.mov -> mp4) er en artefakt af DENNE prøves
testopstilling (headless Chromium afkoder ikke .mov) — IKKE nødvendigvis
et problem i den rigtige app. Safari (iOS) afspiller `.mov` nativt, og
videocoach.html tager allerede imod uploads direkte fra kameraet uden
transkodering. De ~1,6-1,9s transkodering+browseropstart her bør derfor
IKKE tælles med i et ægte "upload og gå"-tidsbudget — kun pose- og
skivetiden (~22,4s dødløft / ~39,6s frontsquat) er reelt sammenlignelig.

## Kan appen levere kontrakten?

**Ja for de fire ledvinkler** (torso og hofte matcher Drishtis facit inden
for hendes eget usikkerhedsbånd på stort set alle 28 punkter, ankel/knæ
afviger næsten udelukkende på billeder Drishtis egen pipeline allerede
flager som upålidelige — se `docs/RAPPORT-188.md`). **Delvist for stangens
position** (ordre 218: 0/28 -> 5/28 inden for båndet med appens egen
skivedetektion, samme størrelsesorden som Drishtis egen 2-11/28, men ikke
en løsning der bærer kontrakten alene — se `docs/RAPPORT-218.md`, commit
1). **Ja for et ægte usikkerhedsbånd**, ikke længere Drishtis som proxy
(ordre 218, commit 2): 5 af 6 felter inden for faktor 2 af hendes egne
båndbredder, xFodlaengder 3,0× bredere (forklaret i rapporten). Prisen for
det der virker i dag er stadig cirka 21 MB engangsdownload (uændret —
skive- og usikkerhedskoden vejer ~15 KB, se ovenfor) plus omkring 24
sekunder pr. dødløft-klip / 41 sekunder pr. frontsquat-klip på en
almindelig computers CPU — ikke endnu målt på en telefon, som er der hvor
det rent faktisk skal køre.

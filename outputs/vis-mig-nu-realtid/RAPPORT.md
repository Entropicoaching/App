# ORDRE 80 — "Vis mig nu" i realtid, og knapperne af vejen

Spor (Harā): `spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a` ("Appen mærkbart
bedre for atleterne"), delmål `goal-coaching-vaerdigt-produkt-appen-maerkbart-bedre-v1`,
under `goal-coaching-vaerdigt-produkt`, planet Entropi Coaching.

## Gren

`vis-mig-nu-realtid`, fra `main` `8696a64` (ordre 73 merget).

Commits:
- `3f3f3a0` — commit 1: profil pr. frame af "Vis mig nu"-vejen, før noget ændres
- `9e10e07` — commit 2: "Vis mig nu" sporer nu MENS videoen spiller, ikke seeker
- `15c4516` — commit 3: hurtig/langsom-chippen af vejen på en smal skærm
- (denne rapport, separat commit)

Rent træ. De utrackede `drafts-*`-mapper og
`docs/videocoach/ENT0092-AUDIT-EE6D8A8.md` er urørt.

## Hvad ændret

**Commit 1 — profil pr. frame, før noget ændres.** `verify:videocoach-clip`
udvidet med en profil af den (dengang) seek-baserede "Vis mig nu"-vej:
`seekTo` og `octx.drawImage` pakket ind med timere, og mellemrummet fra én
seks slutning til næste seks start viser alt arbejde (tegning + selve
sporingsregnestykket) `processFrame` lavede på den foregående frame. Målt på
ordre 73's klip (3 vinduer, 231-234 målte frames):

| Fase | Sum | Gennemsnit pr. frame |
|---|---|---|
| Afkodning + seek | 20 955 ms | **89,55 ms** |
| Sporingsregnestykke | 4 701 ms | 20,35 ms |
| Tegning (`drawImage`) | 714 ms | 3,09 ms |

Selv sporingsregnestykke + tegning tilsammen (~23,4 ms/frame) er under et
30fps-billedbudget (33,3 ms) — det er selve seeket, ikke matematikken, der
er flaskehalsen. Bekræftede ordrens egen diagnose før noget blev rørt.

**Commit 2 — realtids-sporing.** Ny `vcRealtimeTrackWindow` (i
`public/videocoach.html`, uden for `PL_ANG→startBarTracking`-udtrækket, så
de Node-baserede rigge `tracker-live-bench.mjs`/`rep-preview-rig.mjs`
forbliver upåvirkede) erstatter `startMultipointTracking`-kaldet inde i
`vcAthletePreviewThree`'s løkke. Afspiller hvert af de tre vinduer i 1x og
sporer på de frames der rent faktisk præsenteres
(`requestVideoFrameCallback` hvor den findes, ellers `timeupdate`),
nedskaleret til højst 480px, med et tidsbudget pr. frame afledt af videoens
eget tempo (50% margin) — en frame over budget springes NÆSTE frame over
uden forsøg, og dens position interpoleres bagefter. Ingen seek-løkke.
Genbruger kun de allerede afprøvede match-primitiver (`mpBuildFrame`/
`mpGoodFeatures`/`mpMatchPoint`/`mpClamp`/`mpMedian`) — rører IKKE
`startMultipointTracking`, plade-identitetsvagten, hjem-genfindingen eller
`runFullAnalysis` (coachens fulde analyse er uændret).

To reelle fejl fundet og rettet undervejs, ikke kun stil:
- `requestVideoFrameCallback`s FØRSTE argument er et render-tidsstempel
  (samme skala som `performance.now()`), IKKE videoens medietid — den findes
  kun i `metadata.mediaTime`. Uden rettelsen afsluttede hvert vindue efter
  ét eneste frame.
- Matchet skal søge om hvert enkelt features EGEN forventede position
  (centerets forskydning lagt til DET features egen position), ikke om det
  fælles center direkte — ellers søger et feature langt fra centeret i et
  helt forkert område. Genindført samme `pp=p+(pred-cur)`-mønster og
  hastigheds-ekstrapolation som `startMultipointTracking` selv bruger.

**Commit 3 — knapperne af vejen.** Målt (se screenshots nedenfor): den
gamle, store "⚡ Hurtig sporing"-knap (`position:fixed`, bund-venstre) lå i
coachweb-tilstand, med et klip åbnet, midt oven i BÅDE footeren og
`scrubRow` (tidslinje/fartpanel) på en 390px-viewport — før-billedet viser
den bogstaveligt dække "Tegn"-knappen helt og "Analysér" delvist. To små
ikon-chips (⚡/🐢, 24-30px) erstatter den, flyttet ind i
`#vcUtilityActions` — den eksisterende slot i topbjælken hvor
luk-/tilpas-knapperne allerede bor. (Toppen så først fri ud, fordi
`header`/`zenBtn`/`openSmall` allerede var skjulte der uafhængigt af denne
ordre — men `#vcSystemBar`s fulde bredde (z-index 40) dækkede chippen
visuelt på den første, rent bund-til-top-flyttede version; kun
`#vcUtilityActions`-slotten var reelt fri.) Chippen forsvinder helt mens en
sporing rent faktisk kører, via en ren observatør af de eksisterende
`tracking`/`analyzing`-globaler (rører intet i selve sporings-koden).
Athlete-mode skjulte allerede knappen helt siden ordre 54 — uændret, kun
ID-referencen rettet efter omdøbningen fra `trackerFastBtn` til
`trackerFastSeg`. Atletens standardvej ("Send til coach", ingen sporing) er
slet ikke rørt.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler som
  på uændret main).
- `node --test src/*.test.js` — 48/48 grønne.
- `npm run gate:tracker` — grøn, uændret.
- `npm run verify:videocoach-clip` — grøn:
  - A) Fuld analyse (uændret siden ordre 73): 541 frames, mean 9,75px / max
    20,09px.
  - B) "Vis mig nu" (ny realtids-vej), alle tre vinduer ok=true:

    | Vindue | Frames | Tid | mean/max px |
    |---|---|---|---|
    | 1 | 77 | 2 551 ms | 6,32 / 11,60 |
    | 2 | 77 | 2 580 ms | 5,48 / 10,61 |
    | 3 | 77 | 2 728 ms | 7,16 / 16,20 |

    Samlet: 7 859 ms for 7 650 ms afspillet video — **forhold 1,03x**, under
    ordrens egen grænse på 1,1x. Banen er tilmed en anelse tættere på facit
    end den gamle vej (se "Tiderne før/efter" nedenfor).
- `npm run verify:videocoach-upload-flow` — fortsat grøn, uændret (upload-
  vejen og coachens fulde analyse er ikke rørt af denne ordre).
- `npm run verify:videocoach-buttons-layout` (ny) — grøn: chippens boks
  skærer hverken footerens eller `scrubRow`s boks, og chippen forsvinder
  (`hidden:true`) mens en ægte `runFullAnalysis`-kørsel er i gang.

**Tiderne før/efter (profil fra commit 1 + målt efter commit 2)**

| | Før (ordre 73, seek-løkke) | Nu (ordre 80, realtid 1x) |
|---|---|---|
| 3 vinduer, samlet tid | 24-31 s | **7,86 s** |
| Samlet afspillet varighed | ~7,65 s | 7,65 s |
| Forhold (tid / afspillet varighed) | ~3,1-4,1x | **1,03x** |
| Banens afvigelse (mean/max px) | 12,2-13,6 / 19,9-31,0 | 5,5-7,2 / 10,6-16,2 |

Den nye vej er altså ikke kun hurtigere — den rammer banen en anelse
tættere på facit end den gamle, formentlig fordi hastigheds-ekstrapolationen
retter en smule drift, som den gamle vej ikke havde brug for på så korte
vinduer.

**Skærmbilleder (commit 3, 390px, coachweb, klip åbnet)**

- `outputs/vis-mig-nu-realtid/coachweb-390px-foer.png` — den store
  "⚡ HURTIG SPORING"-knap dækker "Tegn" helt og "Analysér" delvist i
  footeren.
- `outputs/vis-mig-nu-realtid/coachweb-390px-efter.png` — footeren er ren
  (Loop/Tegn/Analysér/Fortryd alle synlige), chippen sidder som to små
  ikoner ved siden af luk-knappen øverst til højre.

## Hvad er næste

- **Telefon-målingen mangler stadig.** Denne ordre lukker "aldrig testet på
  rigtig video-afkodning" (ordre 73) videre til "aldrig testet på en rigtig
  telefon". 1,03x er målt i headless Chromium på en stationær maskine — en
  langsommere telefon vil formentlig ramme budgettet oftere og springe flere
  frames over (interpoleret, ikke tabt), men om det STADIG holder sig under
  1,1x på Marcs egen telefon er ikke noget en kodegennemgang kan afgøre.
- **Realtidsvejen er ikke afprøvet mod de svære mønstre** (okklusion,
  touch-and-go, identitetsskifte) som `tracker-live-bench.mjs` allerede
  dækker analytisk for den fulde tracker. Den er kun bygget og testet til
  korte (1-3 sekunders), rene forhåndsvisningsvinduer — det er dens
  udtrykkelige formål, ikke en begrænsning der blev overset.
- **480px-nedskaleringen er ikke selv justeret for langsommere enheder.**
  RT_MAX_W er ét fast tal. Viser telefon-målingen at selv 480px er for
  meget, er den næste, billige skrue at dreje på.
- **Chippens nye placering (i `#vcUtilityActions`) er kun set i coachweb.**
  Athlete-mode skjuler den fortsat helt (uændret adfærd), og DESKTOP-mode
  beholder sin oprindelige bund-venstre-placering (ikke rørt, ingen kendt
  konflikt dér).

## Ærlige grænser

- Alle mål i denne rapport er fra headless Chromium på en stationær maskine,
  ikke en rigtig telefon. Se "Hvad er næste".
- `verify:videocoach-buttons-layout`s "sporing kører"-tjek udløser
  `runFullAnalysis` direkte via `autoCalib`/`vcConfirmPlateRing` i stedet for
  at simulere et ægte museklik på canvas — et scriptet `PointerEvent` uden en
  ægte inputenhed kan ikke sætte `setPointerCapture`, som canvas'ens rigtige
  klik-handler kræver. Selve `runFullAnalysis`-kaldet er uændret, ægte kode;
  kun VEJEN derhen i testen er en genvej.
- Jeg har ikke set en rigtig atlet eller coach bruge "Vis mig nu" — kun
  headless Chromium mod det syntetiske klip. Om 1,03x rent faktisk føles som
  "med det samme" for Marc, kan kun hans egen telefontest afgøre.
- 480px, tidsbudgettets 50%-margin og den droppede plade-identitetsvagt er
  alle bevidste, begrundede forenklinger for en KORT forhåndsvisning — ikke
  afprøvet for om de holder på en video med dårligere lys eller en anden
  vægtskive-type end det syntetiske klips tegnede design.

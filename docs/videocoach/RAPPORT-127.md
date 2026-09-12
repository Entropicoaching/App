# RAPPORT-127: navet, desktop-knapperne, og klar til Marcs klip

## Gren

`videocoach-nav-og-knapper`, tre commits fra `main` (`eb4971d`):

- `efe07ea` — commit 1: `autoCalib`s ring-scoring afviser nu navet til fordel for skiven
- `64e876f` — commit 2: Video/Bane/Eksport-fanerne op til 44px på desktop
- `0c2878d` — commit 3: `verify:videocoach-clip` kører alle klip i `test-clips\`, `TEST-CLIPS.md` færdig

Rent træ. Ikke pushet, ikke merget.

## Hvad ændret

**Commit 1** rettede ordre 120's kendte, dokumenterede grænse (se
`docs/videocoach/RAPPORT-120.md`, "Ærlige grænser"): en lille, stærkt oplyst
nav/muffe nær skivens centrum kunne have en reelt HØJERE ring-score end
skivens egen svage yderkant, så `autoCalib` låste på navet (109px fejl på
prøvebænkens syntetiske tilfælde). Ring-scorings vinder-logik samler nu
FØRST alle gyldige kandidater (dækningskravet på ≥14/32 uændret), sorterer
efter score, og indfører en nav-vagt: er højeste-scorende kandidats radius
under 50% af en anden gyldig kandidats, og den store har mindst 4% af den
lilles score (ren støj scorer typisk langt under det), vælges den store i
stedet. "Stå på skuldre"s foreslåede 20-45%-bånd for radius-forholdet ramte
IKKE det syntetiske nav-tilfælde (fundne radier 16px/126px ≈ 13%, uden for
det bånd) — nedre grænse er derfor droppet, kun øvre grænse (50%) og
score-gulvet (4%) styrer. Valget er noteret i selve koden (autoCalib's
kommentar) og her.

**Commit 2** rettede `#vcWorkspaceTabs button` (Video/Bane/Eksport-fanerne i
`#vcSystemBar`) fra `min-height:36px` til `var(--vc-control)` (44px) — kun
basis-CSS-reglen, som gælder på alle bredder over 700px uanset body-klasse
(athlete/coachweb/desktop-JS-flag). `@media(max-width:700px)` sætter sin
EGEN `min-height` (40px, eller 44px for `body.athlete`) og er ikke rørt —
ordren bad kun om desktop. Fandt at `maal-app.mjs` (ordre 123) altid kører
`/videocoach.html` uden query-parametre, hvilket sætter `body.athlete` (ikke
`body.desktop`) selv på "Desktop 1280×800"-profilen, fordi `DESKTOP`-JS-
flaget kun er sandt ved `file://`-protokol — den unscopede basis-regel var
derfor den reelle synder på alle tre `maal-app`-profiler.

**Commit 3** gjorde `scripts/verify-videocoach-clip.mjs` i stand til at køre
ALLE klip i `test-clips\`, ikke kun det alfabetisk første (`findRealClip` →
`findRealClips`). Klip-afhængig kørsel (harness-HTML, hele analysen fra
"find stangens punkt" til slut-rapporten) er udtrukket til
`runOneClip(browser, mode, clipPath, realMeta, realClipName)`; `main()`
finder klippene, kører dem i én delt browser (hvert klip får sin egen
side/harness), og printer én sammenfatningslinje pr. klip til sidst, foran
den eksisterende, uforkortede rapport pr. klip. `docs/videocoach/
TEST-CLIPS.md` fik den bedte sektion: præcis hvad Marc skal optage (lyst
3-5 reps-sæt, sort skive på sort gulv, hoftehøjde, 3-4m, fri af rack) for at
lukke nav- og mørk-skive-arbejdet på ægte optagelse, ikke kun det
syntetiske.

## Testresultat

**Commit 1** (`npm run verify:videocoach-plate-detect`) — facit før/efter
(radius-fejl i px):

| Betingelse | Før | Efter |
|---|---|---|
| baseline (god kontrast, fri bane) | 2,0px | 2,0px (uændret) |
| kontrast (lys/lys, diff 22) | 2,0px | 2,0px (uændret) |
| radius > maxR | ikke fundet | ikke fundet (uændret) |
| kant mod rack | 0,0px | 0,0px (uændret) |
| mørk skive på mørk baggrund | 0,0px | 0,0px (uændret) |
| lille video | ikke fundet | ikke fundet (uændret) |
| skive delvist ude af billedet | 0,0px | 0,0px (uændret) |
| portrait+sort bjælke | 0,0px | 0,0px (uændret) |
| sort skive på mørkegrå baggrund | 2,0px | 2,0px (uændret) |
| **sort skive/sort gulv, lys nav** | **109px, FORKERT** | **1,0px** |
| mørkeblå kalibreret skive | 2,0px | 2,0px (uændret) |
| mørk skive, lys ring-tekst | 2,0px | 2,0px (uændret) |
| mørk skive, top-refleks | 2,0px | 2,0px (uændret) |
| ægte frame (marc-doedloeft-270.mov) | 8,0px | 8,0px (uændret) |

13 af 14 rækker uændrede, nav-tilfældet rettet fra 109px til 1,0px (krav:
≤5px). Selv-tjekket i scriptet (mustFind/mustFailSafely) er GRØNT, nav-
tilfældet er nu en almindelig `mustFind`-række i stedet for en dokumenteret,
ikke-hårdt-tjekket undtagelse.

**Tidsbudget** (samme metode som RAPPORT-120: Node, uden browser, Marcs
ægte frame, 6×7-gitteret fra `verify-videocoach-clip.mjs`, 200 gentagelser):
FØR (`HEAD`) 13,80ms/kald, EFTER 14,05ms/kald — **+0,26ms/kald**, under
ordrens grænse på +1ms.

`npm run verify:videocoach-clip` (marc-doedloeft-270.mov, samme kombination
som ordre 124 landede): forhold 1,06x — uændret fra ordre 124.

**Commit 2**: skærmbillede på 390px og 1280px
(`outputs/vis-mig-nu-realtid/ordre127-knapper-*.png`) — fanerne er 44px høje
på begge bredder (103×44 på 390px via den eksisterende `body.athlete`-
override, 78×44 på 1280px via denne commits rettelse), ingen overlap med
`#vcSystemState`/`#vcLiftSlot`. `npm run maal:app`:
Desktop 1280×800/Videocoach-forside trykflader<44px **3 → 0** (se
`outputs/maal-app/EFTER.md`s diff-sektion); alle tre profiler (iPhone 13,
Android 360, Desktop 1280) har nu 0 trykflader under 44px på
videocoach-forsiden.

**Commit 3**: `npm run verify:videocoach-clip` kører nu begge klip der
faktisk ligger i `test-clips\` lige nu og printer:

```
== Sammenfatning (ét klip pr. linje) ==
  GRØN  test-clips\marc-doedloeft-270.mov: 2 vindue(r), forhold 1.06x, meanPx=4.15, maxPx=8.00
  FEJL  test-clips\vis-mig-nu-4-reps-syntetisk.mp4: 3 vindue(r), forhold 1.32x, meanPx=0.00, maxPx=0.00
```

Marcs eget klip er GRØNT (uændret 1,06x). Det andet er en RESTFIL fra ordre
121/124 — se "Ærlige grænser" for hvorfor det er RØDT, og hvorfor det ikke
er en regression fra denne ordre.

`npm run lint`: 0 fejl (13 kendte advarsler, urelaterede). `npm run
gate:tracker`: GRØN (8 rigge). Øvrige `verify:videocoach-*`
(baseline-progress, buttons-layout, feedback-quality, labels, migrations,
submission, upload, upload-flow, variation-migration, zoom): alle GRØNNE.

## Hvad er næste

Marc optager de to klip beskrevet i `TEST-CLIPS.md` ("To klip der lukker
resten") — nav-vagten (commit 1) og mørk-skive-detektionen (ordre 120) er
kun bekræftet på syntetiske testtilfælde og ÉT ægte klip med lys skive;
ingen ægte klip med en MØRK skive på MØRKT gulv er testet endnu. Når de
ligger i `test-clips\`, kører `npm run verify:videocoach-clip` dem
automatisk (commit 3) og printer én linje pr. klip.

## Ærlige grænser

- **`npm run verify:videocoach-clip` er samlet set RØD lige nu** — men ikke
  på grund af denne ordres commits. `test-clips\` indeholder i dag, ud over
  Marcs eget klip, `vis-mig-nu-4-reps-syntetisk.mp4` — et FFmpeg-sammensat
  hjælpeklip Marc/en tidligere session byggede til ordre 121/124's eget
  facit-arbejde (se `RAPPORT-124.md`: "midlertidigt eneste klip i
  test-clips\ under denne test"). Det klip har en allerede dokumenteret,
  ikke-ny grænse: korte 0,56s-rep-vinduer betaler proportionalt mere
  opsætnings-overhead, og rammer 1,32x på 1,1x-realtidsgrænsen (RAPPORT-124
  rapporterede selv 1,34x for SAMME klip — praktisk talt uændret, altså
  ingen regression herfra). Fordi `findRealClip` FØR denne ordre kun kørte
  det alfabetisk FØRSTE klip ("marc-..." < "vis-mig-nu-..."), blev dette
  hjælpeklip aldrig faktisk kørt af `npm run verify:videocoach-clip` før nu
  — commit 3 gør præcis det ordren bad om (kør ALLE klip), og har derved
  gjort en allerede kendt, allerede accepteret rød sag synlig for første
  gang. `test-clips\` er git-ignoreret og Marcs eget - jeg har hverken
  flyttet, omdøbt eller slettet filen; det er Marcs valg om den skal blive
  liggende (og scriptet skal vise den ærligt som rød) eller flyttes til
  `docs/videocoach/clip-cache\` (som er til netop den slags genererede
  hjælpefiler, ikke ægte telefonoptagelser - se `TEST-CLIPS.md`s egen
  definition af `test-clips\`).
- **Nav-vagtens 50%/4%-tal er håndkalibreret mod ét syntetisk tilfælde**,
  ligesom ordre 120's egne 82%/14-af-32-grænser - ikke udledt fra et større
  korpus af ægte nav/muffe-billeder. Et ægte klip med en lys nav (Marcs eget
  `marc-doedloeft-270.mov` HAR en sølv-muffe, men rammer ikke denne kode-vej
  i praksis - se dens uændrede 8,0px) kan kræve justering.
- **Commit 2 rettede kun `#vcWorkspaceTabs button`** (Video/Bane/Eksport) -
  ordren nævnte kun disse tre. `#vcSystemActions button` og andre knapper i
  samme bjælke brugte allerede `var(--vc-control)`, så resultatet er nu
  konsistent, men det var ikke i sig selv målet.
- Commit 3's `runOneClip` deler én browser på tværs af klip for effektivitet
  (playwright-opstart er den dyre del) - hvert klip lukker sin egen side
  igen efter brug, men er IKKE afprøvet med et stort antal klip (kun 2 lige
  nu). Hukommelsesforbrug over mange klip i træk er uafprøvet.

## Til Hara (Coaching-planeten)

Denne ordre retter en konkret, dokumenteret bug (bar-trackeren låste på
navet i stedet for skiven på en mørk-skive/mørkt-gulv-optagelse) og en
tilgængeligheds-bug (for små desktop-trykflader) - begge relevante for
delmålet "Appen mærkbart bedre". Nav-fixet er endnu ikke bekræftet på ægte
optagelse (afventer Marcs klip, se "Hvad er næste").

# RAPPORT-139: testklip der ligner virkeligheden, og et manifest

## Gren

`testklip-manifest`, base `main` (`e1da192`, ordre 134 merget). Tre commits:

- `3e7e31f` — commit 1: `vis-mig-nu-4-reps-realistisk.mp4`
  (`scripts/make-realistic-test-clip.mjs`) - realistisk syntetisk 4-reps-klip
  fra Marcs rigtige rep-vindue.
- `3b267a5` — commit 2: `test-clips\manifest.json` (skema i
  `test-clips.manifest.example.json`) styrer `maxRealtime`/`diagnostic`
  pr. klip i `verify-videocoach-clip.mjs`, i stedet for én fast konstant.
- `f20670a` — commit 3: `TEST-CLIPS.md` skåret ned til 18 linjer -
  optagevejledning, filnavne, hvad hvert klip lukker.

Rent træ. Ikke pushet, ikke merget. Ingen ændring af
`analyse/faser/upload/autoCalib/seek`. Ingen ny afhængighed. Ingen
atletdata (kun Marcs eget klip og de to syntetiske klip afledt af det, alle
git-ignorerede). Nøglerne (HARA_*) er ikke rørt.

## Hvad ændret

**Baggrund (ordre 134's konklusion)**: `verify:videocoach-clip` var RØD på
`vis-mig-nu-4-reps-syntetisk.mp4` (1,35-1,42x, over 1,10x-kravet) - ikke
fordi trackeren var langsom, men fordi det klip selv var urealistisk: ordre
121 · commit 3 skar blot det FØRSTE sekund af Marcs klip ud som "rep", uden
hensyn til hvor den rigtige bevægelse lå, og fik 0,56s rep-vinduer der
betaler proportionalt mere opstarts-overhead end en rigtig rep. Det tal
ville stå i hver rapport fremover uden at måle noget reelt.

**Commit 1** bygger `vis-mig-nu-4-reps-realistisk.mp4` rigtigt:
`scripts/make-realistic-test-clip.mjs` bruger det REELLE rep-vindue
(0,00-2,55s i `marc-doedloeft-270.mov`, fundet af app'ens egen presearch -
samme kilde "Vis mig nu" selv bruger, efterprøvet ved at køre
`verify-videocoach-clip.mjs` med kun det klip i `test-clips\`), strækker
det til 3,00s (inden for ordrens 2,5-3,5s-krav) VED AT GENTAGE FRAMES
(ffmpeg `setpts=1,176*PTS,fps=30` - IKKE `playbackRate`/slowmo: banen
forbliver den samme, men klippet får et REALISTISK antal fysiske frames pr.
vindue, 90 mod det oprindelige 76, ikke det samme antal spredt tyndere ud),
sætter 4,00s stille-stang-pause mellem hver af 4 reps (`tpad=stop_mode=
clone`, samme teknik som ordre 121 · commit 3 - blot en realistisk pause i
stedet for 0,8s), og limer 4 identiske kopier sammen (concat-demuxer,
`repeatedIdenticalWindows: true` i sidecar-filen, samme grund som det ældre
klip).

**Commit 2** erstatter den faste `REALTIME_MAX_FACTOR = 1.1`-konstant i
`verify-videocoach-clip.mjs` med et krav PR. KLIP fra
`test-clips\manifest.json` (git-ignoreret ligesom klippene selv - skema og
eksempler i `test-clips.manifest.example.json`, som ER committet). Ny
`requirementFor()` slår klippets filnavn op i manifestet; mangler en post,
gælder standardkravet uændret (1,10x, ikke diagnostisk) - et nyt klip Marc
lægger i `test-clips\` uden at røre manifestet holdes stadig til fuld
standard. Et klip markeret `diagnostic: true` måles og printes fuldt ud som
ethvert andet klip (egen GRØN/FEJL-linje, eget krav), men tæller ikke med i
`main()`s samlede exit-kode - `summaries.filter(s => !s.diagnostic).every(s
=> s.pass)`. En eksplicit vagt (`requirementFor`) nægter at starte hvis et
IKKE-diagnostisk klips manifest-post sætter `maxRealtime` over 1,10 -
"ingen grænse sænkes for ægte klip" er nu en kodet regel, ikke kun en
instruks i en ordre.

Manifestet (`test-clips\manifest.json`) sætter: `marc-doedloeft-270.mov`
og `vis-mig-nu-4-reps-realistisk.mp4` til standardkravet 1,10x (ikke
diagnostisk); `vis-mig-nu-4-reps-syntetisk.mp4` (ordre 121's ældre,
kortere klip) til `diagnostic: true` med et eget, begrundet loft (1,45x,
`reason`: "0,56 s-vinduer betaler overhead" - se manifestet for hele
teksten).

**Commit 3** skærer `TEST-CLIPS.md` ned fra 85 til 18 linjer: kun
optage-instruks (3-5 reps lys skive; mørk skive på mørkt gulv), filnavne,
og hvad hvert klip lukker. Den tekniske begrundelse (hvorfor
`repeatedIdenticalWindows`, præcis hvordan klippet er sammensat) flyttes
ikke - den lå allerede i `verify-videocoach-clip.mjs`s og
`make-realistic-test-clip.mjs`s egne toptekster; doc'en linker dertil i
stedet for at gentage den.

## Testresultat

**"Vis mig nu" pr. vindue, `vis-mig-nu-4-reps-realistisk.mp4`** (standard-
kørslen, `--windows=new --seek=new --strategy=current`, uændret
produktionssti):

| Vindue | seek | 1.frame | sporing | samlet | x realtid |
|---|---|---|---|---|---|
| 1 [0,00-3,00s] | 33ms | 17ms | 2988ms | 3038ms | 1,01x |
| 2 [7,00-10,00s] | 338-357ms | 11-13ms | 2977-2982ms | 3331-3347ms | 1,11-1,12x |
| 3 [21,00-24,00s] | 343-344ms | 12ms | 2976-2977ms | 3333ms | 1,11x |

Samlet (3 vinduer): 9694-9719ms / 9000ms afspillet = **1,08x - GRØNT**
under 1,10x-kravet (2-3 kørsler, maskinens egen støj). Afvigelse
meanPx=0,00 maxPx=0,00 (facit = vindue 1's eget spor, tidsforskudt -
`repeatedIdenticalWindows`).

**Sammenfatning, alle tre klip i `test-clips\`** (`npm run
verify:videocoach-clip`, manifest-styret):

```
GRØN  test-clips\marc-doedloeft-270.mov: 2 vindue(r), forhold 1.06-1.08x (krav ≤1.1x), meanPx=4.15, maxPx=8.00
GRØN  test-clips\vis-mig-nu-4-reps-realistisk.mp4: 3 vindue(r), forhold 1.08x (krav ≤1.1x), meanPx=0.00, maxPx=0.00
GRØN  test-clips\vis-mig-nu-4-reps-syntetisk.mp4: 3 vindue(r), forhold 1.34x (krav ≤1.45x, diagnostisk), meanPx=0.00, maxPx=0.00

GRØN (samlet): alle ikke-diagnostiske klip holder deres krav.
```

Det gamle klip endte faktisk GRØNT mod sit EGET, løsere diagnostiske loft
(1,45x) i denne kørsel (1,34x, samme størrelsesorden som RAPPORT-134s
1,35-1,42x - maskinens egen støj) - men det er underordnet: det tæller
IKKE med i den samlede exit-kode uanset udfald, per design (`diagnostic:
true`), og INGEN grænse er sænket for de to ægte/realistiske klip (begge
stadig 1,10x, uændret standard).

`npm run lint`: **0 fejl** (samme 13 præeksisterende
`react-hooks/exhaustive-deps`-advarsler, urørt, ingen `videocoach.html`
rørt). Øvrige 11 `verify:videocoach-*`-scripts (alt uden for `-clip`):
**alle GRØNNE** (uændret adfærd - denne ordre rørte kun `-clip`s eget krav-
opslag, ikke selve trackeren/analysen).

## Hvad er næste

- Marc optager stadig de to ægte multi-reps-klip fra `TEST-CLIPS.md`
  ("Optagelse", ordre 127: lys skive / mørk skive på mørkt gulv) - kun
  Marcs 1-reps-klip er ægte optagelse i dag, resten er afledt/syntetisk.
  Når de lægges i `test-clips\`, kører `verify:videocoach-clip` dem
  automatisk mod standardkravet (1,10x, via manifestets fallback).
- Ordre 134s egen "Hvad er næste" (den skjulte video-klon, vindue 1's faste
  ~165ms opstartsomkostning) er UDEN FOR denne ordres grænser (ingen
  ændring af seek/tracking) - stadig ikke portet til produktion, se
  RAPPORT-134.
- `test-clips.manifest.example.json` har i dag kun placeholder-poster for
  de to endnu-ikke-optagede lys/mørk-klip (`dodloft-lys.mp4`) - når Marc
  optager dem, bør en fremtidig ordre tilføje deres RIGTIGE filnavne til
  `test-clips\manifest.json` (eller blot lade standardkravet gælde, det er
  allerede 1,10x).

## Ærlige grænser

- **Kilde-rep-vinduet (0,00-2,55s) er hardcodet i `make-realistic-test-
  clip.mjs`**, ikke fundet dynamisk af scriptet selv ved kørsel - det er
  samme tal som app'ens egen presearch fandt (efterprøvet manuelt, se
  scriptets toptekst for kommandoen), men ændrer Marc sit kildeklip, skal
  tallet findes igen på samme måde og opdateres i scriptet. Valgt sådan for
  at undgå at spinde en hel Playwright/Chromium-afhængighed op i et
  ffmpeg-only byggescript - en rimelig grænse, ikke en genvej der skjuler
  noget.
- **`setpts`+`fps`-strækningen bruger GENTAGELSE (nærmeste frame), ikke
  motion-interpolation** (`minterpolate`) - et bevidst valg (enklere,
  ingen optisk-flow-artefakter der kunne forstyrre skive-sporingen), men
  betyder de "nye" frames i det strukkede vindue er EKSAKTE dubletter, ikke
  en glattere, syntetisk mellemliggende bevægelse. Set fra trackerens side
  er det stadig "flere fysiske frames at behandle pr. vindue" (det denne
  ordre skulle rette), blot ikke perfekt visuelt jævnt - uden betydning for
  selve realtids-målingen, som ikke ser på billedkvalitet.
- **Alle 4 reps i det realistiske klip er IDENTISKE kopier** af samme
  kilde-rep (ligesom det gamle klip) - `repeatedIdenticalWindows: true`
  gør facit for vindue 2+ korrekt (se `TEST-CLIPS.md`), men et klip med 4
  FORSKELLIGE, ægte reps ville stadig være et mere sigende test af
  vindue-til-vindue-variation end nogen syntetisk konstruktion, uanset hvor
  realistisk den enkelte reps varighed er. Uændret ønske siden
  RAPPORT-121/124/134.
- **Vagten mod at sænke `maxRealtime` for ikke-diagnostiske klip
  (`requirementFor`) har ingen permanent, automatiseret verify-test** - kun
  manuelt bekræftet én gang (midlertidigt sat
  `vis-mig-nu-4-reps-realistisk.mp4`s manifest-post til `maxRealtime: 99`
  uden `diagnostic: true`, kørt `verify-videocoach-clip.mjs` og set den
  nægte at starte med præcis den ventede fejlbesked, derefter reverteret -
  `test-clips\manifest.json` er efterfølgende bekræftet identisk med
  originalen igen). Ingen permanent unit-test tilføjet for selve vagten
  (uden for denne ordres commit-struktur) - kun `verify:videocoach-clip`s
  egen kørsel mod det RIGTIGE manifest er efterprøvet i det committede
  resultat.
- Ingen atletdata i denne rapport eller de committede filer - kun Marcs
  eget klip og de to syntetiske klip afledt af det (alle git-ignorerede,
  aldrig committet). Ingen ændring af `analyse/faser/upload/autoCalib/seek`
  (Vaidyas område i `Desktop\entropi-app` er slet ikke rørt - andet
  repo/worktree). Ingen ny afhængighed, ingen push, ingen skrivning til
  miljøvariabler.

## Betydning for Hara

Sporet "Appen mærkbart bedre for atleterne"
(spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a): denne ordre lukker det
Delmål ordre 134 efterlod åbent - `verify:videocoach-clip` var RØD på et
klip der ikke lignede virkeligheden, og det tal ville have stået i hver
fremtidig rapport uden at måle noget reelt. Nu måler testen mod ET
realistisk klip (GRØNT, 1,08x under kravet) og ét ærligt diagnostisk klip
(målt, men fælder ikke testen) - INGEN grænse er sænket for at opnå dette,
kun testens EGET grundlag er rettet. Manifestet (commit 2) gør desuden
fremtidige klip selvbetjente: et nyt klip Marc lægger i `test-clips\` uden
videre indsats holdes automatisk til fuld standard, og et evt. fremtidigt
diagnostisk særtilfælde kan dokumenteres med sin egen begrundelse i stedet
for enten at sænke kravet for alle eller lade testen stå rødt uden
forklaring. Ingen atletdata brugt eller berørt.

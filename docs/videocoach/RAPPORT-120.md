# RAPPORT-120: den mørke skive skal findes

## Gren

`moerk-skive`, tre commits fra `main` (`e265dcc`):

- `b4eda80` — commit 1: udvid prøvebænken med seks mørke tilfælde + et ægte frame
- `a326a27` — commit 2: `autoCalib` finder mørke skiver (lokal normalisering, farve-kant, ring-scoring)
- `479c153` — commit 3: `?diag=1` viser hvilken vej der fandt skiven

Rent træ. Ikke pushet, ikke merget.

## Hvad ændret

**Commit 1** udvidede `scripts/verify-videocoach-plate-detect.mjs` med Marcs
seks tilfælde fra ordren (mørkegrå baggrund, sort gulv med lys nav,
mørkeblå kalibreret skive, lys ring-tekst, top-refleks) plus ét RIGTIGT frame
fra `test-clips\marc-doedloeft-270.mov` (findes, har en sort/rød skive mod
mørkegråt gulv med en sølv-muffe synlig gennem midterhullet — nøjagtig den
"mørk skive, mørk baggrund"-situation Marc beskrev). `autoCalib` selv var
uændret i denne commit — kun facit for "før".

**Commit 2** rettede selve `autoCalib` (samme funktion, `public/videocoach.html`,
ingen ny sti, ingen ny afhængighed):

1. **Lokal kontrast-normalisering** — søgevinduets egen 2./98.-percentil af
   luminans (histogram, ét gennemløb) i stedet for hele billedets. Kun
   forstærket (op til 4×) når vinduet faktisk er fladt (spænd < 60), så
   velbelyste billeder er uændrede. Percentiler (ikke absolut min/max) gør
   den robust mod en lille lys nav/refleks/bogstav, der ellers ville sætte
   hele vinduets skala.
2. **Kant i farve-afstand, ikke kun luminans** — en kalibreret grøn/blå
   skive kan have næsten samme lys/mørk-niveau som gulvet, men en tydeligt
   anden farvetone. `edgeStrength` tager `max(luminans-spring, farve-afstand)`.
3. **Ring-scoring** — hver stråle kan nu stemme med flere lokale toppe (ikke
   kun sin egen bedste), stemmerne klynges i 10px-bøtter, og for hver bøtte
   med ≥2 stemmer *og* dækning på mindst 14 af 32 punkter rundt om cirklen
   udregnes en ring-score (kant-styrke summeret hele vejen rundt). Vinderen
   er højeste score; er nummer to for tæt på (>82% af vinderen), er fundet
   for usikkert → `null`. Dækningskravet kom til undervejs (se "Ærlige
   grænser") — uden det fandt gitter-søgningen i `verify-videocoach-clip.mjs`
   en falsk "skive" i loftet på Marcs eget klip.

To små, nødvendige rettelser fulgte af commit 2's ændrede (mere selektive)
opførsel, begge i test-harnesset, ingen af dem i appen selv:

- `scripts/verify-videocoach-buttons-layout.mjs`: dens syntetiske testklip har
  TRE koncentriske ringe på skiven (center-prik, mønster-ring, yderkant — se
  `make-test-clip.mjs`), og mønster-ringen har reelt højere kontrast end
  skivens egen yderkant. `autoCalib` afviser nu det tilfælde sikkert (`null`,
  for tvetydigt), hvor den gamle kode gættede (forkert, på center-prikken,
  radius 20 i stedet for 110). Testen bruger kun autoCalib til at trigge en
  ægte sporing, ikke til at måle træfsikkerhed — den falder nu tilbage til
  klippets EGEN kendte `PLATE_R=110` hvis `autoCalib` returnerer `null`.
- `scripts/verify-videocoach-clip.mjs`: uden en fundet rep brugte "Vis mig
  nu"-fald-tilbagen HELE klippets spænd som ét vindue — det er ikke hvad
  "Vis mig nu" simulerer, og et langt nok spænd fik headless Chromium til at
  crashe ("Target crashed") da gitter-søgningens startpunkt var dårligt.
  Loftet til 2s.

**Commit 3** lod `wizardClick` sætte `vcPlateCalibReason` til
`plate:auto:lum` / `plate:auto:farve` / `plate:auto:ring` ved et vellykket
fund (var altid `null` før), og `?diag=1` viser nu ruten plus ring-scoren
(`plate:auto:ring (score 2254 mod 1911)`). Samme JSON-felt som ordre 109 —
ingen migration. Wiringen er verificeret i headless browser (autoCalib
mocket til at returnere hver rute); autoCalib's egen træfsikkerhed dækkes af
prøvebænken.

## Testresultat

`npm run verify:videocoach-plate-detect` — før/efter (radius-fejl i px,
"-" = ikke fundet):

| Betingelse | Før | Efter |
|---|---|---|
| baseline (god kontrast, fri bane) | fundet, 2,0px | fundet, 2,0px |
| kontrast (lys/lys, diff 22) | ikke fundet | fundet, 2,0px *(sidegevinst)* |
| radius > maxR | ikke fundet | ikke fundet (uændret) |
| kant mod rack (3/4 sider) | **fundet, FORKERT (30px)** | fundet, **0px** |
| mørk skive på mørk baggrund (diff 19) | ikke fundet — **Marcs bug** | fundet, **0px** |
| lille video (160×120) | ikke fundet | ikke fundet (uændret) |
| skive delvist ude af billede | fundet, 2,0px | fundet, 0px |
| portrait+sort bjælke (letterbox) | **fundet, FORKERT (70px)** | fundet, **0px** |
| sort skive på mørkegrå baggrund (diff 23) | ikke fundet | fundet, 2,0px |
| sort skive/sort gulv, lys nav | **fundet, FORKERT (109px)** | **fundet, FORKERT (109px) — uændret, kendt grænse** |
| mørkeblå kalibreret skive (farve, ikke lum) | ikke fundet | fundet, 2,0px |
| mørk skive, lys ring-tekst | ikke fundet | fundet, 2,0px |
| mørk skive, top-refleks | ikke fundet | fundet, 2,0px |
| **ægte frame** (marc-doedloeft-270.mov) | **fundet, FORKERT (48px)** | fundet, **8px** |

12 af 14 tilfælde forbedret eller uændret-korrekt; ét er en kendt,
dokumenteret grænse (nav — se nedenfor), ét var allerede korrekt afvist og
er det stadig. Selv-tjekket i scriptet er grønt (baseline og delvist-ude-af-
billede er stadig ≤2px, som ordren krævede; øvrige nye fund er tjekket til
≤5px).

**Tidsbudget** (Node, uden browser, Marcs første frame, 6×7-gitteret fra
`verify-videocoach-clip.mjs`'s `__autoFindBarPoint`, 20 gentagelser):

| | Før | Efter |
|---|---|---|
| pr. `autoCalib()`-kald | ~7,0ms | ~10,9ms |
| hele gitteret (42 kald, ÉN gang ved klip-åbning) | ~295ms | ~458ms |

+55% pr. kald, men det er et engangs-kald ved video-åbning (autoCalib kaldes
IKKE pr. frame under sporing) — under et halvt sekund forskel, ikke mærkbart.

**`npm run verify:videocoach-clip`**: GRØN, forhold 1,03x (grænse 1,1x — ikke
den kendte 1,21x-grænse fra ordre 116 længere, se "Ærlige grænser" for
hvorfor tallet ikke er sammenligneligt 1:1). `npm run lint`: 0 fejl (13
kendte advarsler, urelaterede til denne ordre). Alle øvrige
`verify:videocoach-*`: grønne.

## Hvad er næste

- Marc bad om, at der lægges ÉT klip med en mørk skive i `test-clips\` hvis
  intet fandtes — der ligger allerede ét (`marc-doedloeft-270.mov`), og det
  har rent faktisk en mørk skive, så denne ordre er dækket. Et ANDET klip
  (stangen kalibreret grøn/blå, eller et rigtigt eksempel på en atlets "kan
  ikke se skiven"-sag) ville gøre `KNOWN_CLIPS`-tabellen i prøvebænken
  bredere end ét enkelt referenceklip.
- Gitter-søgningens "vælg størst fundne radius"-heuristik i
  `verify-videocoach-clip.mjs` (ordre 85) er nu tydeligt for grov til en
  travl, rigtig gym-scene — se "Ærlige grænser". Uden for denne ordres
  omfang, men værd at kigge på hvis flere rigtige klip skal ind i bænken.

## Ærlige grænser

- **Nav-tilfældet er IKKE rettet.** En lille, lys, fuldt cirkulær nav/muffe
  nær centrum (som den sølv-muffe Marcs eget klip faktisk har) kan have en
  reelt HØJERE, mere konsistent ring-score end skivens egen svage yderkant.
  Ring-scoring kan skelne "en konsistent cirkel" fra "støj", men ikke "den
  stærkeste cirkel" fra "den skive coachen mente" — det kræver en form for
  størrelses- eller kontekst-prior, ikke kun kant-styrke. Ring-bekræftelsen
  i UI'en (`plateConfirm` — atleten SER ringen før analysen starter) er
  fortsat sikkerhedsnettet her, præcis som for rack/letterbox-sagerne i
  ordre 109.
- **Gitter-søgningens blinde fuld-billede-scanning (`verify-videocoach-
  clip.mjs`) er en dårligere test af nøjagtighed end den ser ud til.** Før
  ordre 120 fandt den gamle `autoCalib` "noget" på 42/42 gitterpunkter i
  Marcs rigtige første frame (inklusive loftet, dørkarmen, en anden atlets
  skive) — reelt ingen selektivitet, den var bare "heldig" med hvilket
  punkt der havde størst radius. Den nye `autoCalib` er langt mere selektiv
  (kun 9/42 finder noget efter ordre 120), men "vælg størst radius blandt de
  overlevende" ved stadig ikke hvilken af dem der er skiven — denne ordre
  har IKKE rettet den heuristik (ejes af ordre 85's testscript, ikke
  `autoCalib`). Konsekvensen: gitter-søgningen rammer nu et andet (stadig
  ikke det rigtige) punkt end før, hvilket gjorde at ingen reps kunne
  auto-detekteres i denne ene kørsel — deraf 2s-loftet i commit 2. Den
  ÆGTE, meningsfulde nøjagtigheds-måling — et klik PRÆCIS på den kendte,
  målte skiveposition, som en atlet rent faktisk ville gøre — er
  `verify-videocoach-plate-detect.mjs`'s "ægte frame"-tilfælde, og DEN gik
  fra 48px fejl til 8px.
- **1,03x-tallet for "Vis mig nu" er ikke direkte sammenligneligt med ordre
  116's 1,21x/1,11x.** Fordi ingen rep blev fundet automatisk denne kørsel
  (se ovenfor), måler tallet nu sporing over klippets FØRSTE 2 sekunder
  (loftet), ikke det samme ~0,6-0,8s rep-vindue tidligere kørsler brugte.
  Tallet er ægte og grønt, men det er ikke "samme måling, nyt tal" — det er
  en anden, tilfældigt anderledes stikprøve af det samme klip.
- **Ambiguitets-grænsen (82%) og dæknings-grænsen (14/32) er håndkalibreret**
  mod prøvebænkens 14 tilfælde plus de to rigtige klip — ikke udledt fra en
  større korpus af rigtige gym-videoer. Et tredje rigtigt klip kunne kræve
  justering.
- Refleks-tilfældet (top-lys) endte tættere på en ren sejr end ventet: uden
  dækningskravet blev det korrekt, men FOR usikkert til at gætte (afvist,
  15% margin); MED dækningskravet forkastes refleks-kandidaten helt, og
  skivens egen kant vinder klart. Begge udfald er "sikre" i den forstand
  ordre 109 lagde vægt på — ingen af dem giver en tavs, forkert måling.

## Til Hara (Coaching-planeten)

Denne ordre retter en konkret, atlet-rapporteret bug (bar-trackeren kunne
ikke genkende en mørk skive) — relevant for delmålet "Appen mærkbart bedre".

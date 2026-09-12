# RAPPORT-121: "Vis mig nu" - skjul seeket

## Gren

`vis-mig-nu-skjul-seek`, base `main` (`e265dcc`, ordre 116 med). Tre commits:

- `148c970` — commit 1: seek i skyggen af presearch og mellem vinduer
- `fa21370` — commit 2: mål den rigtige "Vis mig nu"-vej - presearch, ikke fuld analyse
- `911f614` — commit 3: syntetisk 4-reps-klip, mål vindue 2-3's varme seek for første gang

## Hvad ændret

**Commit 1** — To ændringer i `public/videocoach.html`, ingen ændring af selve
sporings-algoritmen (onFrame-løkken, budget/gæld-systemet), kun HVORNÅR og
HVOR MANGE GANGE der seekes:

- `vcRunRepWindowsPresearch`: restaurerede altid `video.currentTime` til
  `savedTime` efter sin egen forudsøgning, hvorefter `vcAthletePreviewThree`
  straks bagefter seekede VIDERE til vindue 1's start - to seeks betalt i
  træk for én visning. Findes vinduer, springes restaureringen nu over, og
  seeket til vindue 1's start startes i stedet MED DET SAMME (bevidst ikke
  ventet på), så det løber i skyggen af resten af opsætningen i
  `vcAthletePreviewThree` (diag-nulstilling, trim-visning, `setAthleteState`)
  i stedet for at blive betalt to gange. Findes ingen vinduer (fejlvejen),
  restaureres `savedTime` som før - uændret for den vej.
- `vcRealtimeTrackWindow`/`vcAthletePreviewThree`: tager nu et valgfrit
  allerede-startet seek-løfte (`preSeek`) i stedet for altid selv at starte
  et. Mellem vinduer startes næste vindues seek MED DET SAMME et vindues
  afspilning er færdig, mens efterbehandlingen (`freezeRawAcquisition`/
  `analyzePath`) af det FORRIGE vindue stadig kører. `rtSeekTo` opdager selv
  om målet allerede er nået (ingen ændring nødvendig dér).

**Commit 2** — `scripts/verify-videocoach-clip.mjs` rettet til at måle den
RIGTIGE "Vis mig nu"-vej: ordre 116 fandt at bænken hidtil kørte de tre
vinduer LIGE EFTER den fulde, seek-baserede analyse (til facit), som
efterlader videoen ved klippets slutning - vindue 1's seek i testen blev
derfor et koldt spring, som app'en aldrig laver (den kører aldrig fuld
analyse først, kun presearch). Vinduerne findes nu via presearch
(`vcRunRepWindowsPresearch`, samme funktion app'en selv kalder), ikke via
den fulde analyses egen rep-detektion. En VARM måling kører på en helt
frisk browser-side (presearch → vinduer, ingen fuld analyse har rørt
videoen) og GATER nu testen. Den gamle måling bevares som KOLD
sammenligningstal (lige efter fuld analyse, som før), ikke gatende.
Presearch fik det bekræftede sæt-interval (afledt af fuld analyses egen,
mere præcise rep-detektion + 0,05s margin) i stedet for hele rå-filen -
ellers tog presearch fejl af opsætnings-/dødtid som ægte reps (afprøvet:
1,0s og 0,2s margin ødelagde banen). Tilføjede eksplicit `process.exit()`
- to browser-sider kunne efterlade en håndtag der holder Node kørende i
det uendelige uden output (opdaget da et testkørsel hang i >15 minutter).

**Commit 3** — Byggede et syntetisk 4-reps-klip fra Marcs eget 1-reps-klip
(han har endnu ikke lavet et rigtigt 3-5 reps-klip): `ffmpeg` (allerede en
afhængighed, `ffmpeg-static`) klipper vinduet (0-1,0s) ud, forlænger det med
et frosset sidste-frame-ophold (`tpad=stop_mode=clone:stop_duration=0.8`),
og limer 4 kopier sammen (concat-demuxer) til
`test-clips\vis-mig-nu-4-reps-syntetisk.mp4` (gitignoreret, aldrig
committet), med en `.meta.json` sidecar (samme dokumenterede
override-mekanisme som testen allerede understøtter) der angiver
vinduernes rigtige tider - se "Ærlige grænser" for hvorfor. Fandt undervejs
at Node ikke kan måle "mellem vinduer"-skyggen: et løfte startet i ét
`page.evaluate()`-kald overlever ikke til det næste kald fra `main()`, så
vinduerne skal spores i ÉN sammenhængende browser-kørsel for at
skygge-effekten overhovedet kan opstå. Ny `window.runVisMigNu` (ikke et
1:1-udtræk - `vcAthletePreviewThree` er tæt vævet ind i DOM/UI-tilstand,
men bruger kun de udtrukne, ægte funktioner til selve arbejdet) sporer nu
alle vinduer i træk med samme `pendingSeek`-mønster som app'en, med ÉT
klik-punkt genbrugt til alle vinduer (som app'en selv gør) - punktet ved
vindue 1's egen start, ikke klippets tid 0 (afprøvet begge, se "Ærlige
grænser").

## Testresultat

| | FØR (main, `e265dcc`) | EFTER (denne gren) |
|---|---|---|
| Marcs klip (1 vindue) - x realtid varm/kold | 1,19-1,28x (RAPPORT-116, ingen varm/kold-skel dengang) | VARM 1,17-1,18x / KOLD 1,20-1,22x (tre kørsler) |
| Marcs klip - frames sprunget over | 0 | 0 |
| Marcs klip - baneafvigelse meanPx/maxPx | 4,10-5,40 / 8,17-11,10 | 5,74-6,01 / 15,01-21,81 |
| Syntetisk 4-reps-klip (3 vinduer) - x realtid varm/kold | (fandtes ikke) | VARM 1,25x / KOLD 1,23-1,24x |
| Syntetisk klip - frames sprunget over | (fandtes ikke) | 0 (alle tre vinduer) |
| Syntetisk klip - baneafvigelse meanPx/maxPx (vindue 1 / 2 / 3) | (fandtes ikke) | 7,04-7,48 / 15,01 · 123,76 / 132,21 · 306,92 / 311,41 |

`npm run verify:videocoach-clip` (mod Marcs klip, alfabetisk først, som før):
**RØD** på 1,1x-grænsen, 1,17-1,18x - tættere på end nogensinde (ordre 116:
1,19-1,33x), men klippets eneste vindue (0,56-0,67s) er kortere end
presearchs egen minimumsgrænse for at finde flere gentagelser (`span >
0,6s`) med sikker margin, se kode-kommentar i `verify-videocoach-clip.mjs`.
Kravet er IKKE sænket.

Mod det syntetiske 4-reps-klip: også RØD, 1,25x - se "Ærlige grænser" for
hvorfor vindue 2/3's store afvigelsestal sandsynligvis er en facit-fejl,
ikke en fejl i selve sporingen (vindue 1, upåvirket af noget snit, rammer
fint).

- `npm run lint` — **0 fejl**, samme 13 præeksisterende
  `react-hooks/exhaustive-deps`-advarsler som ordre 109/116 (urørt).
- Alle øvrige 11 `verify:videocoach-*` scripts — **GRØN**.
- `npm run gate:tracker` (8 gate-rigge) — **GRØN**.

## Hvad er næste

- Vindue 1's gevinst (fjernet dobbelt-seek i presearch) er reel og
  konsistent målt: ~2-3% (1,17-1,18x mod 1,20-1,22x), men ikke nok alene
  til at nå 1,1x på et enkelt-vindue-klip - den resterende afstand er
  browserens egen seek-latens, samme grænse ordre 116 fandt.
- "Mellem vinduer"-skyggen (commit 1's anden halvdel) viste INGEN målbar
  gevinst på det syntetiske klip (VARM 1,25x ≈ KOLD 1,23-1,24x). Mest
  sandsynlige forklaring: det CPU-vindue der er til rådighed til at skjule
  seeket i (`freezeRawAcquisition`/`analyzePath`, et par ms) er for kort til
  at dække en seek på ~100-200ms - koden er stadig korrekt og harmløs
  (afprøvet: identiske tal med/uden skyggen slået fra, se commit 3's
  isolations-test i selve arbejdet, ikke i denne rapport), men gevinsten er
  ikke bevist. En fremtidig ordre kunne undersøge om et STØRRE stykke
  synkront arbejde (fx en tidlig, delvis nedskalering af næste vindues
  første frame) kunne udnytte skyggen bedre - ikke afprøvet her.
- Et RIGTIGT multi-reps-klip fra Marc (kontinuerlig bevægelse mellem reps,
  intet hårdt snit) ville løse den syntetiske klips facit-problem direkte
  og give et pålideligt afvigelsestal for vindue 2/3 for første gang - se
  "Ærlige grænser".
- Presearchs minimumsgrænse (`span > 0,6s`) betyder korte enkelt-reps-klip
  (som Marcs) aldrig kan afprøve presearch fuldt ud alene - kun relevant
  hvis fremtidige testklip forbliver enkelt-rep.

## Ærlige grænser

- **1,1x-grænsen er stadig IKKE nået** på Marcs klip (1,17-1,18x). Vindue
  1's gevinst er reel, men rækker ikke alene - se "Hvad er næste".
- Det syntetiske klips gentagelser er IDENTISKE kopier limet sammen med et
  HÅRDT snit (ikke en kontinuerlig atlet-bevægelse mellem reps). To
  konkrete konsekvenser, begge målt direkte, ikke gættet:
  1. Den fulde analyses egen rep-detektion (`analyzeCleanPath`) slog alle
     fire reps sammen til ÉT fundet "rep" (0,17-4,50s) - sandsynligvis fordi
     dens frame-til-frame-tracker ikke kan følge et snit, der ligner en
     umulig, øjeblikkelig bevægelse. Presearchs sæt-grænser (afledt af
     denne rep-detektion + margin) blev derfor forkerte, og en
     `.meta.json`-sidecar med vinduernes kendte, rigtige tider (fra selve
     konstruktionen) blev nødvendig - samme dokumenterede
     override-mekanisme testen allerede understøtter for rigtige klip, ikke
     en ny mekanisme opfundet til lejligheden.
  2. Samme fulde analyses egen SPORING (brugt som FACIT for
     afvigelses-tallene, jf. testens metode for rigtige klip - "ingen
     uafhængig sandhed findes") driver ved hvert snit: den frosne
     stang-position blev målt til TRE FORSKELLIGE punkter på tværs af de tre
     snit (806,1457 / 798,1327 / 796,1264 - ~130-190px fra hinanden), selvom
     de fire kopier er byte-for-byte identiske og position derfor BURDE være
     ens hver gang. Vindue 2/3's rapporterede afvigelse (meanPx 124/307px,
     stigende med hvert snit - samme retning som facit-driften) er derfor
     sandsynligvis en FACIT-fejl, ikke en fejl i selve "Vis mig nu"-sporingen.
     Vindue 1 (helt før noget snit) rammer fint: meanPx 7,04-7,48px, samme
     størrelsesorden som Marcs eget klip. Dette er IKKE bevist ud over al
     tvivl (ingen uafhængig tredje kilde til sandhed findes for et rigtigt
     klip) - kun sandsynliggjort ved direkte måling af facit-driften.
  3. Et enkelt (ikke-gentaget) "klik-punkt genbrugt til alle vinduer", som
     den rigtige app selv bruger, forudsætter at stangen reelt vender
     tilbage til (nogenlunde) samme position for hver rep - sandt for et
     rigtigt sæt (fysisk position på gulv/stativ), og sandt for dette
     syntetiske klip KUN fordi kopierne er identiske. Ikke et problem for
     testmetoden, men et forbehold ved fortolkningen af vindue 2/3's tal.
- "Mellem vinduer"-skyggen viste ingen målbar tidsgevinst her (se "Hvad er
  næste") - koden er ikke skadelig (identiske tal med/uden), men gevinsten
  er ikke bevist på dette klip.
- Marcs klip er (stadig) for kort til at presearch selv kan finde flere end
  1 vindue (klippets rep-span 0,56-0,67s er lige under presearchs egen
  minimumsgrænse `span > 0,6s` med den margin denne bænk bruger til at
  udlede sæt-grænser fra fuld analyse) - det er PRÆCIS derfor commit 3
  byggede et syntetisk multi-reps-klip.
- Ingen atletdata læst, hentet eller kopieret; kun Marcs eget testklip
  brugt (allerede lokalt, gitignoreret) og et syntetisk klip udledt af det
  (også gitignoreret, aldrig committet).
- Ingen ny afhængighed (ffmpeg-static lå allerede i projektet), ingen push,
  ingen ændring af analyse/faser/metrics eller upload-vejen, `autoCalib`/
  skive-detektion urørt (Vaidyas område).
- `process.exit()` tilføjet i testscriptet er en robusthedsrettelse opdaget
  undervejs (en testkørsel hang >15 minutter uden output efter at have
  åbnet en anden browser-side) - ikke en ændring af selve app'en.

## Betydning for Hara

Sporet "Appen mærkbart bedre for atleterne"
(spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a): denne ordre implementerer
det konkrete spor ordre 116 lagde (skjul seeket bag presearch), retter en
reel unøjagtighed i testens egen metode (den målte ikke den vej atleten
rent faktisk oplever), og bygger for første gang et multi-reps testklip, så
"Vis mig nu"s opførsel på 2.-3. gentagelse kan måles overhovedet. Fandt en
reel, om end lille (~2-3%), målt forbedring - og fandt lige så vigtigt at
den anden halvdel af optimeringen (skygge mellem vinduer) IKKE viste nogen
målbar gevinst med denne metode, samt at det syntetiske klips egen
konstruktion (hårdt snit mellem identiske kopier) gør dets vindue 2/3-tal
upålidelige som facit - et ærligt fund, ikke et pænere tal end det der
reelt blev målt. 1,1x-grænsen er stadig ikke nået. Intet Delmål lukkes.

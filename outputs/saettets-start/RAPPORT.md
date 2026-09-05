# ORDRE 50 — Sættet skal finde sig selv

Gren: `saettets-start` (fra main `ac88a03`, ordre 47 allerede merget)

Commits:
- `8c65fc9` — foreslå sættets start/slut ved video-åbning, kun coach-siden
- `7d55646` — rig der udtrækker og måler forudsøgningen mod syntetiske scenarier

Filer: kun `public/videocoach.html` (kirurgiske tilføjelser, ikke omskrevet) +
én ny fil, `docs/videocoach/set-bounds-presearch-rig.mjs`. `dist/` genbygget
(`npm run build`) for konsistens, ikke committet (git-ignoreret som hidtil).
Ikke rørt: benkædens/bænkens forslag, tracker-hastigheden, atlet-siden
(se "Hvorfor kun coach-siden" nedenfor), Coach Briefing, klipning/beskæring
af selve videofilen (kun analysens ind/ud-punkt foreslås).

## Opgaven

Ordre 43's egen rapport pegede på den sidste urørte opsætningspost: spolingen
til "lige før løftet starter", før Marc overhovedet kan trykke første gang.
Det er den ene ting Marc stadig selv skal *finde*, ikke bare klikke - klik og
trackertid er allerede skåret (ordre 43/45/47).

## Metode

Læste hele klip-flowet (`trimStart`/`trimEnd`/`manualTrackingBounds`, de
eksisterende `⟦`/`⟧`/`✕`-klipknapper og de trækbare håndtag på tidslinjen -
"skyderen" ordren refererer til) og fandt undervejs at ATHLETE-flowet har sin
egen, separate start-gate (`athleteMarkStartBtn`/`syncAthleteStartGate`, en
helt anden UI-sti end coachens klipknapper) - se "Hvorfor kun coach-siden".

**Algoritmen er delt i to lag, samme mønster som ordre 47's IK vs.
state-machine:**

1. **En ren funktion uden DOM** (`vcMotionSeries` + `vcFindSetBounds`,
   markeret med `ORDRE 50 · start/slut`-kommentarer i `videocoach.html`) der
   tager en række lav-opløsnings gråtone-prøver + deres tidspunkter og finder
   to ting: første ro→bevægelse-overgang der holder ved OG hvor intet har
   rørt sig før den (sættets start), og sidste bevægelse→ro-overgang hvor
   ingen ny vedvarende bevægelse findes resten af klippet (sættets slut).
   Begge dele bruger en adaptiv støjgrænse (25.-percentil af selve klippets
   egen bevægelsesstøj), fordi en fast tærskel enten ville overse langsomme
   løft eller fyre på kornethed/kompression.
2. **DOM-laget** (`vcRunSetBoundsPresearch`) henter selve prøverne fra den
   RIGTIGE video: op til 30 tidspunkter, 48px bred nedskaleret canvas,
   gråtone frame-til-frame-diff. Afbrydes stille hvis Marc selv går i gang
   (klik/kalibrering/sporing) mens den kører, og tjekker at videoen ikke er
   skiftet undervejs (`vcApplySetBoundsSuggestion`, samme "stillCurrent"-
   mønster som ordre 43's `vcSyncPriorSetup`).

**Riggen** (`docs/videocoach/set-bounds-presearch-rig.mjs`) udtrækker de to
rene funktioner 1:1 og kører dem mod:
- **De samme seks bevægelsesmønstre som `npm run gate:tracker`**
  (`tracker-live-bench.mjs`, ordre 45) - reproduceret lokalt, da den fil ikke
  eksporterer sine scener og ikke må røres af denne ordre.
- **To ekstra scenarier** med en ægte optaktsstilhed før løftet
  (`leadin_idle_before_rep`, `leadin_and_tail`) - fordi INGEN af de seks
  officielle scenarier har lidt stilhed før bevægelsen begynder (klippet
  starter altid midt i bevægelsen). Ordren selv pegede på at
  `idle_tail_after_rep` var "det perfekte tilfælde" for den ene ende
  (slutningen); disse to er det tilsvarende for den anden ende (starten),
  ikke fordi ordren krævede dem, men fordi startforslaget ellers slet ikke
  kunne valideres mod noget.

**To reelle fejl fundet og rettet af riggen selv, ikke antaget væk:**
- Ved `paused_hold_between_reps` (to reps med en 3,5 s pause imellem) valgte
  den første version af algoritmen genoptagelsen efter pausen som "sættets
  start" (5,47 s fejl) i stedet for den ægte start ved 0 s - fordi den bare
  tog den FØRSTE ro→bevægelse-overgang den fandt, uden at tjekke om noget
  allerede havde bevæget sig tidligere i klippet. Rettet med en
  "everMoved"-vagt: en overgang tæller kun som sættets start, hvis intet har
  rørt sig før den.
- Ved `leadin_idle_before_rep` gav en tilfældig sample-tilpasning til
  bevægelsens egen symmetri ét eksakt nul-differens-billede midt i en ellers
  ægte bevægelse (en klassisk stroboskop-tilfældighed, ikke en fejl i selve
  optagelsen) - den oprindelige "ingen udfald tilladt"-regel afviste derfor
  et gyldigt fund. Rettet ved at tillade et enkelt støj-udfald i vinduet
  (samme tolerance lagt symmetrisk ind i slut-logikken).

## Målt: forudsøgningens egen tid

| scenarie | prøver | ms (Node-rig) |
|---|---|---|
| clean_single_rep | 9 | 7,5 |
| low_contrast_bottom | 9 | 4,6 |
| multi_rep | 24 | 9,1 |
| brief_occlusion | 9 | 3,3 |
| idle_tail_after_rep | 31 | 7,4 |
| paused_hold_between_reps | 31 | 8,1 |
| leadin_idle_before_rep (ekstra) | 27 | 6,1 |
| leadin_and_tail (ekstra) | 31 | 7,4 |

Alle under 10 ms i Node-rigen. Til sammenligning kører `tracker-live-bench`
sin fulde, levende sporing af samme type klip på 24 163 ms for hele
gate:tracker-sættet (alle seks scenarier tilsammen, fuld opløsning, hver
frame). Forudsøgningen sampler højst 30 punkter mod klippets fulde
billedrate (30 fps → op til 318 frames for det 10,6 s lange
`idle_tail_after_rep`-klip alene) ved 48 px bredde mod videoens fulde
opløsning - en størrelsesorden færre prøver, ved en brøkdel af opløsningen
pr. prøve. Se "Ærlige grænser" for hvorfor dette IKKE er et mål for den
rigtige browsers seek+decode-omkostning.

## Hvor tæt forslaget rammer

| scenarie | foreslået | manuel ville have valgt | Δstart | Δslut |
|---|---|---|---|---|
| clean_single_rep | 0,00–1,60s | 0,0–1,6s | 0,00 | 0,00 |
| low_contrast_bottom | 0,00–1,60s | 0,0–1,6s | 0,00 | 0,00 |
| multi_rep | 0,00–4,50s | 0,0–4,5s | 0,00 | 0,00 |
| brief_occlusion | 0,00–1,60s | 0,0–1,6s | 0,00 | 0,00 |
| idle_tail_after_rep | 0,00–2,42s | 0,0–1,6s | 0,00 | 0,82 |
| paused_hold_between_reps | 0,00–6,15s | 0,0–6,5s | 0,00 | 0,35 |
| leadin_idle_before_rep (ekstra) | 3,00–5,10s | 3,5–5,1s | 0,50 | 0,00 |
| leadin_and_tail (ekstra) | 2,10–4,62s | 2,5–4,1s | 0,40 | 0,52 |

Ingen af de seks officielle scenarier afviger mere end 0,82 s - godt inden for
den bevidste margin (0,6 s før / 0,3 s efter, se `vcFindSetBounds`), og
`idle_tail_after_rep`s 0,82 s viser at forslaget rent faktisk stopper langt
før klippets fulde 10,6 s, ikke bare falder tilbage til "hele klippet".
`paused_hold_between_reps` rammer 0 s afvigelse i BEGGE ender efter rettelsen
ovenfor - den midterste pause hverken starter eller slutter sættet forkert.
De to ekstra scenarier (som intet af de seks kunne teste) rammer inden for
0,5 s af den ægte optaktsstilheds afslutning.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler,
  urørt).
- Alle 7 `verify:videocoach-*`-scripts — grønne.
- `npm run gate:tracker` — GRØN (alle rigge, inkl. tracker-live-bench,
  urørt af denne ordre).
- `node docs/videocoach/set-bounds-presearch-rig.mjs` — GRØN (se tabellerne
  ovenfor; fangede og verificerede rettelsen af to reelle fejl undervejs, se
  Metode).
- `node --check` på det udtrukne script fra `videocoach.html` — fejlfrit.
- `npm run build` — dist/ genbygget og indeholder de nye ORDRE 50-markører.

## Hvad jeg ikke turde automatisere, og hvorfor

- **Ingen browser-session overhovedet, hverken headless eller andet.**
  Claude-in-Chrome-udvidelsen var ikke forbundet i dette miljø (samme
  begrænsning som ordre 47's rapport beskrev - hverken `playwright` eller
  `puppeteer` er installeret, og jeg har bevidst ikke lagt en ny
  dev-afhængighed ind for én ordres skyld). Forsøgte at forbinde, men fik
  "Browser extension is not connected". Al verifikation er derfor via den
  udtrukne, rene algoritme kørt mod syntetiske prøver - IKKE den rigtige
  `video`/`canvas`-nedskalering, `seekTo`s ægte `seeked`-event, eller hvordan
  🎯-knappen rent visuelt sidder på en rigtig mobilskærm.
- **Riggens "kamera" er punkt-sampling, ikke browserens rigtige
  billed-nedskalering.** `psCtx.drawImage(video, 0, 0, 48, h)` i den rigtige
  kode bruger browserens bilineære nedskalering; riggen punkt-sampler i
  stedet (se kommentar i filen). Det tester tidslogikken (hvornår er der
  ro/bevægelse) korrekt, men IKKE om en meget lille, langsomt bevægende
  skive drukner i nedskalerings-artefakter ved 48 px bredde på en rigtig
  optagelse.
- **Forudsøgningens egen ms-måling er Node-rig-tid, ikke browser-decode-tid.**
  Samme ærlige begrænsning som `tracker-live-bench` selv har: de <10 ms
  målt her dækker selve algoritmens løbetid mod allerede-genererede
  syntetiske prøver, ikke de rigtige `video.currentTime`-sæt +
  `drawImage`-afkodninger en ægte mobil/browser skal betale for hver af de
  op til 30 prøver. Forventningen om at det er markant billigere end en fuld
  sporing hviler på tælletallene (30 prøver × 48 px mod op til 318 frames ×
  fuld opløsning), ikke på en målt browser-wallclock.
- **Ingen ny bruger møder en video uden forslag** er ikke testet mod en
  rigtig, kompressions-støjet optagelse - kun mod deterministisk,
  Math.sin-baseret syntetisk støj. Ægte kompressionsartefakter (blocking,
  motion-vektor-støj ved lav bitrate) kunne teoretisk give en anden
  støjprofil end riggens; den adaptive tærskel (25.-percentil × 3) er
  designet til at være robust mod det, men det er ikke bevist mod en rigtig
  fil.
- **Standard-margenerne (0,6 s før / 0,3 s efter) er et gæt, ikke et målt
  tal.** Ligesom ordre 47's albue-standardside er de en rimelig antagelse
  (nok tid til at se opsætningen, men ikke så meget at Marc skal spole
  tilbage), ikke afprøvet mod hvad Marc rent faktisk foretrækker.
- **Retroaktiv fravalg efter at sporingen er startet** er ikke bygget - er
  🎯-forslaget først accepteret (eller stiltiende anvendt) og Marc trykker
  ⚡/Start, gælder klippet som ved enhver anden trim; at fortryde bagefter er
  præcis samme vej som at fortryde en manuel klipning i dag (⟦/⟧/✕), intet
  nyt er tilføjet eller fjernet der.

## Betydning for Hara

Under "Appen mærkbart bedre": den sidste rene opsætningspost ordre 43 selv
målte og efterlod urørt er nu automatiseret på coach-siden - Marc kan i
princippet åbne en video og trykke start uden selv at spole, med et tydeligt
markeret forslag han kan fravælge/genvælge med ét tryk, og en stille
fallback til dagens skyder hvis optagelsen ikke giver et klart svar.

## Hvad er næste

- En rigtig browser-/mobil-gennemgang, når Claude-in-Chrome er tilgængelig
  igen, af selve seek-ydelsen og hvordan 🎯-knappen sidder ved siden af de
  øvrige klipknapper på en smal skærm.
- Mål standard-margenerne (0,6 s / 0,3 s) mod hvad Marc rent faktisk retter
  dem til, samme måde `setup_ms` har samlet tal for ordre 43 og 47.
- Overvej om et fundet forslag skal gemmes pr. atlet+løft (som cmPerPx/
  arm-længder allerede gør), hvis kameraopstillingen er stabil uge til uge -
  ikke bygget her, da forudsøgningen i sig selv allerede fjerner spolingen
  uden det.

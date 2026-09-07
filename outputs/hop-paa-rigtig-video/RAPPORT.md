# ORDRE 85 — hoppene målt på rigtig video, uden sidecar-fil

Spor (Harā): `spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a`, planet Entropi
Coaching.

## Gren og commits

`hop-paa-rigtig-video`, fra `main` `92c5100` (ordre 82 merget).

- `0f9645c` — commit 1: bænken finder selv stang og vinduer på rigtige klip
- `c10f1e5` — commit 2: dokumentér forkastede 720px/0,75x-forsøg
- `cff18c5` — commit 3: `docs/videocoach/TEST-CLIPS.md`
- (denne rapport, separat commit)

Rent træ. De utrackede `drafts-*`-mapper og
`docs/videocoach/ENT0092-AUDIT-EE6D8A8.md` er urørt, som ordren beder om.
`test-clips\marc-doedloeft-270.mov` er Marcs eget klip, git-ignoreret,
committes aldrig — heller ikke den transkodede kopi i
`docs/videocoach/clip-cache/` (også git-ignoreret).

Denne ordre var et genstart: `hop-paa-rigtig-video` fandtes allerede, udtjekket,
med ucommittede ændringer i `public/videocoach.html`,
`scripts/verify-videocoach-clip.mjs` og en ny `docs/videocoach/TEST-CLIPS.md`,
uden commits. Jeg gennemgik diffen mod `main` og beholdt næsten det hele —
det var et solidt, gennemtænkt første udkast af auto-kalibrering,
rep-detektion og mp4-transkodering. To ting var ikke brugbare og er rettet
(se "Hvad blev ændret"); resten er commit 1 uændret i substans.

## Hvad blev ændret

**Commit 1 — bænken finder selv stang og vinduer.** Ordre 82 krævede en
sidecar `<navn>.meta.json` (barPoint + windows) for et rigtigt klip — kravet
om at Marc selv skulle skrive pixelkoordinater og sekunder var for tungt, og
bænken stod derfor tom (ingen klip nogensinde lagt). Kravet er fjernet:

- Er klippet ikke H.264 i mp4-container (Marcs `.mov`), transkodes en
  midlertidig, git-ignoreret kopi med `ffmpeg-static` (fandtes allerede,
  ingen ny afhængighed).
- Stangens startpunkt findes med appens EGEN `autoCalib`-funktion (samme kode
  coachen bruger til at bekræfte en klikket skive, udtrukket 1:1) i et gitter
  af 42 kandidatpunkter. Findes intet tydeligt cirkulært punkt nogen steder,
  falder bænken tilbage til den fulde analyses egen kvalitetsmåling af et
  punkt (`mpGoodFeatures`).
- Gentagelses-vinduerne kommer fra den fulde analyses EGEN rep-detektion
  (`analyzeCleanPath`/`path.reps`, udtrukket 1:1), ikke en opfundet
  forudsøgnings-heuristik.
- En sidecar-`.meta.json` er stadig mulig, felt for felt, og vinder over
  automatikken hvis Marc en dag vil rette et forkert gæt — men er ikke
  længere påkrævet.

Ved den FØRSTE kørsel mod Marcs rigtige klip fandt jeg og rettede to bugs,
begge i det uafhængige udkast, ingen af dem i selve appen:

1. **`freezeRawAcquisition`-stubben i bænken ignorerede sit `session`-
   argument** og satte aldrig `path.analysisSession`. Uskadeligt så længe
   `analyzePath` var en no-op (før denne ordre) — men nu hvor `analyzePath`/
   `analyzeCleanPath` er rigtig, udtrukket kode, crashede
   `startMultipointTracking`s EGET interne kald til `analyzePath` midt i
   sporingen med `TypeError: Cannot read properties of undefined (reading
   'lift')`. Rettet ved at lade stubben sætte `path.analysisSession = session`
   ligesom den rigtige funktion (`public/videocoach.html:1279`).
2. **Gitter-heuristikken manglede et sanity-loft på den fundne radius.** Et
   kandidatpunkt i et billedhjørne fandt en falsk "kant" med radius 554px —
   over en tredjedel af billedhøjden, en umulig stor "skive" i en
   almindelig-optaget dødløftvideo. Denne urealistiske radius fik den
   realtidsdrevne "Vis mig nu"-vej (`video.play()` +
   `requestVideoFrameCallback`) til reelt at HÆNGE uden fremgang (bekræftet
   ved at følge browserprocessens CPU-forbrug over flere minutter — helt
   fladt, ikke bare langsomt) — ikke en krasch, en reel deadlock i
   sporingens søgelogik ved en absurd stor søgeradius. Rettet med et loft:
   kandidater med fundet radius over en fjerdedel af billedets korteste side
   forkastes som støj. Efter rettelsen: radius 346px, en plausibel skive,
   og bænken kører færdig.

Begge fejl var i bænkens EGET, nye udtræks-/heuristik-kode fra denne ordre —
ikke i `runFullAnalysis` eller anden eksisterende trackerkode, som er urørt.

**Commit 2 — de to udskudte forsøg, afprøvet og forkastet.** Ordre 82 nåede
ikke (c) 720px i "Vis mig nu"-sporingen og (d) 0,75x afspilning, fordi begge
kun kunne vurderes mod et rigtigt klip. Nu findes ét. Begge afprøvet mod
Marcs klip (se "Testresultat" for tallene) — ingen af dem beholdt:

- **(c) 720px:** gjorde sporingen markant mere præcis (maxPx 11,10→6,46px)
  men for langsom (tid/afspillet 1,18x→1,24x, over 1,1x-grænsen).
- **(d) 0,75x afspilning:** matematisk uundgåeligt at fejle samme grænse —
  at spille klippet 25% langsommere FORLÆNGER selve nævneren i forholdet
  "brugt tid / afspillet varighed", så det aldrig kan komme under
  1/0,75 ≈ 1,33x, uanset hvor hurtig selve sporingen er. Målt til 1,65x.
  Hverken hop eller max-afvigelse blev bedre som kompensation.

Ingen funktionel ændring i commit 2 — kun kommentarer i koden (ved
`RT_MAX_W` og `video.playbackRate`), så et senere forsøg ikke gentager det
samme blindt uden at have læst denne rapport. `runFullAnalysis` er urørt i
begge commits.

**Commit 3 — `docs/videocoach/TEST-CLIPS.md`.** Ti linjer: læg en fil i
`test-clips\`, kør `npm run verify:videocoach-clip`, læs tabellen. Ingen
JSON, ingen koordinater. Nævner at et sæt på 3-5 reps giver et mere sigende
svar end ét enkelt løft.

## Testresultat

- `npm run lint` — 0 fejl (samme 13 præeksisterende React-hook-advarsler som
  på uændret `main`).
- `npm run gate:tracker` — GRØN, inkl. `tracker-live-bench` og
  `rep-preview-rig` (ordre 54 · "Vis mig nu"), uændret.
- `npm run verify:videocoach-clip` mod **det tegnede klip** — GRØN.
- `npm run verify:videocoach-clip` mod **Marcs rigtige klip** — RØD: "Vis mig
  nu" bruger 1,17-1,20x sin egen afspillede varighed (varierer let
  run-til-run, se "Ærlige grænser"), over 1,1x-grænsen. Dette ER selve
  fundet denne ordre bad om at måle for FØRSTE gang — se "Hvad er næste".

**Tegnet klip mod rigtigt klip, før og efter, hop og tid** (facit for det
rigtige klip = den fulde analyses egen bane, der findes ingen uafhængig
sandhed for en rigtig optagelse):

| Klip | Vindue(r) | mean px | max px | hop | tid/afspillet |
|---|---|---|---|---|---|
| Tegnet (syntetisk, 3 vinduer) | 1 / 2 / 3 | 7,65 / 6,82 / 10,03 | 19,75 / 17,47 / 18,65 | 0 / 0 / 0 | 1,02x samlet |
| Rigtigt — ordre 80 (før glatning) | 1 (0,17-0,73s) | 3,94 | 10,10 | 0 | 1,18x |
| Rigtigt — ordre 82 (nuværende, med glatning) | 1 (0,17-0,73s) | 5,40 | 11,10 | 0 | 1,17-1,20x |

Rigtigt-klip-rækkerne er fra en dedikeret ordre-80-vs-82-sammenligning
(samme delte facit/barPoint/vindue for begge, kun selve
`vcRealtimeTrackWindow`-koden byttet — ikke committet, kun kørt til denne
måling). Ordre 82's glatning sporer én frame mere (16 mod 15, ingen
oversprunget) og har samme tid/afspillet som ordre 80 på dette klip, men en
lidt højere gennemsnitlig afvigelse (5,40 mod 3,94px, konsistent med at
one-euro-filteret introducerer et lille slæb, som allerede noteret i ordre
82's rapport) — begge stadig langt inde i 15/35px-tolerancen. **0 hop i
begge tilfælde**, så ordre 82's hop-reduktion kan ikke bekræftes ELLER
afkræftes på dette klip — det har kun ét, meget kort (0,56s) løft, ikke nok
til at fremprovokere et hop i nogen af versionerne.

**Den egentlige nyhed:** BEGGE versioner (ordre 80 og ordre 82) bruger
1,17-1,24x sin afspillede varighed på Marcs rigtige, høj-opløsnings
telefonklip (1440x1920 efter rotation) — over 1,1x-grænsen, noget der ALDRIG
kunne ses på det tegnede klips lave opløsning og pæne forhold (1,02x-1,04x i
både ordre 82 og denne ordre). Kilden er opløsning og ægte H.264-afkodning,
ikke selve glatningslogikken fra ordre 82.

## Hvad er næste

- **Realtidsbudgettet holder ikke på Marcs rigtige telefonklip**, og hverken
  (c) højere opløsning eller (d) langsommere afspilning kan løse det uden at
  bryde selve 1,1x-kriteriet (se "Hvad blev ændret", commit 2). Et reelt
  fremskridt kræver enten et lavere `RT_MAX_W` end 480 (mindre præcist, men
  hurtigere — ikke afprøvet i denne ordre, da (c) kun undersøgte OP, ikke
  NED), en billigere matchfunktion i `vcRealtimeTrackWindow`, eller en
  accept af at 1,1x er for stram en grænse på ægte telefonvideo i høj
  opløsning og bør genforhandles som succeskriterium.
- **Et sæt på flere reps er nødvendigt for at gå videre** med hop-spørgsmålet
  specifikt: Marcs klip har kun ét, 0,56 sekunders lift — der er intet
  "første/midt/sidste" at sammenligne, og 0 hop i begge versioner beviser
  intet om ordre 82's hop-reduktion. Uden et klip med 3-5 reps (se
  `docs/videocoach/TEST-CLIPS.md`) kan hop-spørgsmålet ikke afgøres yderligere
  på rigtig video.
- **En lavere `RT_MAX_W` (fx 360 eller 320px) er den naturlige næste skrue**
  at afprøve — denne ordre testede kun OPAD (720px), som ordren selv bad om;
  en test NEDAD er ikke lavet og er oplagt hvis budgettet fortsat skal
  holdes på Marcs telefon uden at sænke kravet.
- Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen
  mærkbart bedre"): ja — dette er den første ægte måling af "Vis mig nu" på
  en rigtig atlet-telefon (ikke det tegnede klip), og den viser et konkret,
  målt problem (budgetoverskridelse) som tidligere kun var en mistanke fra
  Marcs egen oplevelse.

## Ærlige grænser

- **Kun ét klip, én person, ét løft.** Alle tal er fra `marc-doedloeft-270.mov`
  — Marc selv, ikke en atlet, ét dødløft på 3,85 sekunder. Konklusionerne
  ("budgettet holder ikke", "(c)/(d) hjælper ikke") er sande for DETTE klip;
  om de generaliserer til andre kameraer, belysninger eller løft er ubekræftet.
- **Run-til-run-varians er reel og umålt bort.** Tre uafhængige kørsler af
  den officielle bænk mod samme klip gav tid/afspillet på 1,17x, 1,18x og
  1,20x, og frames sporet på 15-17 — samme kode, samme klip, forskellige
  headless Chromium-instanser. Tallene i tabellen ovenfor er fra den
  dedikerede før/efter-sammenligning (samme kørsel, samme facit for begge
  sider) for at gøre SELVE sammenligningen fair, men den absolutte størrelse
  af "1,17-1,20x" bør læses som "pålideligt over 1,1x", ikke som et
  præcist tal på tredje decimal.
- **Den auto-detekterede skiveradius (346px) er tæt på det nye sanity-loft**
  (360px = en fjerdedel af 1440px). Den ligger inden for tolerance på
  afvigelsesmålet, men er ikke visuelt bekræftet mod klippet. Ser Marc et
  forkert punkt i en fremtidig kørsel, kan en `<navn>.meta.json` med
  `barPoint` stadig tvinge det rigtige punkt (se `TEST-CLIPS.md`).
- **`npm run verify:videocoach-clip` er RØD mod Marcs rigtige klip**, ikke
  grøn som ordrens "Verifikation og aflevering"-afsnit bad om. Jeg har ikke
  løsnet 1,1x-grænsen eller tolerancerne for at tvinge et grønt resultat —
  det ville skjule præcis det fund ordren bad om at afdække. Den ægte,
  ærlige tilstand er: grøn på det tegnede klip, rød på det rigtige, af en
  grund der nu er dokumenteret og målt, ikke gættet.
- **npm test mangler som script** i dette repo (præeksisterende, ikke denne
  ordres ansvar — verificeret uændret i `package.json`).
- To engangs-sammenligningsscripts (ordre-80-vs-82 og 720px/0,75x-forsøgene)
  blev skrevet og kørt uden for repoet (i min egen scratchpad) for at få
  tallene i denne rapport og i kode-kommentarerne — de er ikke committet,
  da de ikke er en del af den løbende bænk, kun et engangsbevis for
  commit 2's beslutning.

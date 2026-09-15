# Rapport — ordre 234: prøverne skal sige sandheden

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `proeverne-sandheden`, forgrenet fra `main` (`d7ba5d4`, ordrens egen
base — min 232 og Vaidyas 231 allerede merget, live var `162abc6`). Tre
commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `946a099` | `docs/PROEVER-KORT.md` — kortet over hvad alle 45 prøver/scripts venter på. Ingen kodeændring |
| 2 | `873c0be` | Den ene fundne, aktive (c)-fejl rettet: `verify-videocoach-buttons-layout.mjs` |
| 3 | `b440a7d` | `npm run proever` — ét samlet facit for enhedstests + alle verify-scripts + e2e |
| 4 | (denne rapport, se hash i `git log` efter commit) | rapport |

Arbejdstræet er rent efter hver commit. Ingen produktions-Supabase, ingen
atletdata, ingen push. `index.html`, `vite.config.*` og `src/` er ikke rørt
(Vaidyas område, ordre 233 — mens jeg arbejdede, blev 233 faktisk merget til
`main`, som nu står på `0513026`; jeg har bevidst IKKE rebaset denne gren
oveni det, da ordren ikke bad om det, og intet i 233 rørte `e2e/` eller
`scripts/verify-*`).

## Hvad ændret

225 fandt at "den hængende browser" fra 221 var en fejlmåling: en test-høst
der kun genkendte to bestemte banner-tekster som "sporingen er færdig",
mens et rigtigt klip faktisk var færdigt ad en tredje, stille vej
(`#sheet.open`, uden banner-tekst). Én forkert prøve kostede tre ordrer.
Denne ordre satte sig for at finde ud af om det var et engangsuheld eller et
mønster — og rettede det den fandt.

**Commit 1 — kortet.** Læste hver af de 45 prøver/scripts (7 e2e-specs,
`run-all.mjs`, 3 manuelle sporings-diagnose-scripts, og alle 34 `verify:*`
fra `package.json`) i sin helhed, og skrev `docs/PROEVER-KORT.md`: hvad den
venter på (banner-tekst, DOM-element, mock-tabel, global variabel, en ægte
funktions-returværdi, eller intet af det — kun statisk kildetekst-regex),
og hvad der sker hvis det udebliver. Systematisk søgt (ikke stikprøve) efter
`waitForTimeout`, `waitForFunction`/`waitForSelector`, banner/`textContent`-
udfaldstjek, `setTimeout`, `Promise.race` og tavse `catch`-blokke på tværs af
samtlige filer. Fund: kun ÉT (a)/(b)-tilfælde findes i hele test-høsten —
`e2e/coach-sporing.spec.mjs`s `confirmAndWaitForTracking` — og det er
allerede rettet, før denne ordre, i ordre 225 (`docs/RAPPORT-225.md`s commit
1). Ingen ny forekomst af samme mønster nogen andre steder. To scripts havde
ubegrundede faste ventetider (kategori c): `verify-videocoach-film-guide.mjs`
(to-tre 150-200ms render-settle-pauser, lav risiko) og
`verify-videocoach-buttons-layout.mjs` (et 400ms gæt på at en app-intern
250ms-poller havde nået at reagere). Fire filer i `scripts/` (`verify-
athlete-identity.mjs`, `verify-periodization-assistant.mjs`, `verify-plan-
aware-forecast.mjs`, `verify-plan-overview.mjs`) ligner verify-scripts, har
rigtige assertions, men er ikke koblet til noget `"verify:..."`-felt i
`package.json` — de kører aldrig, og "alt grønt" dækker dem derfor aldrig.

**Commit 2 — den ene aktive (c) rettet.** `verify-videocoach-buttons-
layout.mjs` ventede på et fast `waitForTimeout(400)` efter at have startet en
ægte `runFullAnalysis()`-kørsel, som et gæt på at chippens egen, uafhængige
250ms-observatør (`public/videocoach.html`, sætter `.vcTrackingBusy` ud fra
`tracking`/`analyzing`-globalerne) havde nået at reagere — ikke farligt (værste
udfald var en falsk rød, aldrig et falsk grønt), men et unødvendigt gæt hvor
det faktiske udfald allerede findes som en observerbar DOM-klasse. Rettet til
`page.waitForFunction(() => trackerFastSeg.classList.contains('vcTrackingBusy'))`
— venter nu på den samme tilstand appen selv bruger til at style chippen.
Bevist rødt (ikke i koden, her): satte midlertidigt `public/videocoach.html`s
`seg.classList.toggle('vcTrackingBusy', !!busy)` til altid `false`, kørte
scriptet igen — `FEJL: page.waitForFunction: Timeout 5000ms exceeded` efter
5s, ikke et falsk grønt. Reverterede `videocoach.html` (bekræftet med `git
status` — rent), kørte scriptet en tredje gang mod den urørte app — grønt
igen. Kun rettelsen i selve verify-scriptet er committet.

`e2e/coach-sporing.spec.mjs`s (allerede rettede) `confirmAndWaitForTracking`
blev desuden kørt LIVE fire gange i denne ordre (`node e2e/coach-sporing-
reliability.mjs`, alternative porte for ikke at kollidere med andre samtidige
arbejdstræer på samme maskine) for at bekræfte fixet stadig virker: alle
fire kørsler afsluttede ÆRLIGT med "Ingen tydelig rep blev fundet" på ~82-83s
hver — ikke et hæng (godt under det 120s-loft funktionen selv sætter), og
ikke et falsk grønt. At selve stangbane-sporingen ikke fandt et brugbart rep
i nogen af de fire kørsler matcher ordre 200s kendte <10/10-pålidelighed for
dette specifikke, CPU-følsomme klik-flow i headless Chromium — det er derfor
`run-all.mjs`/`npm run e2e` bevidst IKKE inkluderer denne prøve (se
kortet). Ikke undersøgt yderligere her — det er sporingens pålidelighed,
ikke prøvens ærlighed, og ligger uden for denne ordre.

**Commit 3 — `npm run proever`.** Nyt script (`scripts/proever.mjs`): kører
alle `*.test.js` under `src/`/`public/` (fundet via filsystem-scan, ikke en
hardkodet liste — der fandtes ingen samlet `npm test`-kommando for dem
overhovedet før denne ordre, kun 20 enkeltstående testfiler kørbare hver for
sig via `node --test`), alle 34 `verify:*`-scripts (læst fra `package.json`s
egne script-navne, aldrig hardkodet — listen kan derfor aldrig drive fra den
ægte kommando), og `npm run e2e` hvis port 8991 er fri (springes ærligt over,
mærket "SPRUNGET OVER", ellers). Skriver én tabel til `outputs/_seneste/
proever.md`: type, navn, resultat, varighed, og en kort "ventede på"-linje
(browser-baseret vs. statisk/enhedstest, med henvisning til kortet for den
fulde begrundelse). Det er det Dhruva kan læse ét sted før en merge, i
stedet for at stole på en rapports ord.

## Testresultat

- **`npm run lint`:** rent, ved alle fire commits.
- **`node --test` på alle 21 `*.test.js`-filer:** alle grønne (kørt både
  enkeltvis under commit 1's gennemgang og som del af `npm run proever`).
- **`npm run proever` (kørt 3 gange i denne ordre):** 55/56 rækker grønne
  hver gang. Samme, ENESTE undtagelse alle tre gange: `verify:videocoach-
  clip`. Undersøgt separat (se "Ærlige grænser" — konklusion: sandsynlig
  maskinbelastning fra andre samtidige arbejdstræer på denne delte maskine,
  IKKE en fejl introduceret i denne ordre; scriptet og den kode det tester er
  ikke rørt af ordre 234).
- **`npm run e2e`:** grønt i alle tre `npm run proever`-kørsler (29,7-31,1s).
- **`verify:videocoach-buttons-layout.mjs`** (rettet i commit 2): grønt før
  og efter rettelsen mod urørt app-kode; bevist rødt mod midlertidigt
  ødelagt app-kode (se commit 2 ovenfor); app-koden er urørt i det
  committede resultat.
- **`git status --short`:** rent efter alle fire commits.

## Hvad er næste

1. De fire ukoblede filer i `scripts/` (`verify-athlete-identity.mjs`,
   `verify-periodization-assistant.mjs`, `verify-plan-aware-forecast.mjs`,
   `verify-plan-overview.mjs`) bør enten kobles til et `"verify:..."`-script
   (så `npm run proever` fanger dem) eller slettes, hvis de er forældede —
   ingen af delene er forsøgt her (ingen ordre om at røre dem, og de er ikke
   "løgnagtige", bare usynlige).
2. `verify-videocoach-film-guide.mjs`s to-tre 150-200ms render-settle-pauser
   (kategori c, lav risiko) er ikke rettet — ingen kendt fejlscenarie, kun en
   ubegrundet konstant. En fremtidig ordre kunne erstatte dem med et konkret
   DOM-tilstandstjek, samme mønster som commit 2 her.
3. `verify:videocoach-clip`s realtids-krav (≤1,1x for det rigtige klip) viste
   sig følsomt over for samtidig maskinbelastning i denne ordres eget
   testmiljø (se "Ærlige grænser") — værd at vide for en fremtidig ordre der
   ser den fejle uden at have rørt tracker-koden: tjek først om andre tunge
   processer kørte samtidig, før det tolkes som en regression.
4. `e2e/coach-sporing.spec.mjs` (den ægte stangbane-sporing) er stadig uden
   for `npm run e2e`/`npm run proever` pga. ordre 200s kendte upålidelighed —
   uændret vurdering, ikke forsøgt løst her (det var ikke ordrens opgave).

Betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): denne
ordre retter selve grundlaget andre ordrer bygger deres "er appen mærkbart
bedre"-vurdering på. 225 viste at én løgnagtig prøve allerede havde kostet
tre ordrer og var tæt på at fejlprioritere Harā. Efter denne ordre er der
dokumenteret, systematisk eftersyn af hele test-høsten, ét ekstra ærligt
værktøj (`npm run proever`), og bekræftelse af at 225s rettelse holder.

**Tre linjer til Marc:** "alt grønt" har hidtil kun betydet "de scripts jeg
huskede at nævne var grønne, sidst jeg kørte dem". Efter denne ordre betyder
det (via `npm run proever`) "55 af 56 navngivne prøver var faktisk grønne
lige nu, og den ene undtagelse er navngivet, ikke gemt væk". Den eneste
kendte, uløste blinde vinkel er at selve stangbane-sporingen (det rigtige
klik-igennem-flow) stadig ikke er pålidelig nok til at stå i den automatiske
suite — det har den ikke været siden ordre 200, og er ikke denne ordres opgave
at løse.

## Ærlige grænser

- **`verify:videocoach-clip` fejlede i alle tre `npm run proever`-kørsler i
  denne ordre**, med tre FORSKELLIGE symptomer på tværs af separate,
  isolerede kørsler af det SAMME, urørte script: (1) en afkortet ffmpeg-
  relateret fejlbesked ved 415-428s (langt over scriptets normale kørselstid
  for dette klip-sæt), (2) et rent Chromium-render-nedbrud
  (`page.evaluate: Target crashed`) på det andet rigtige klip
  (`vis-mig-nu-4-reps-realistisk.mp4`), og (3) et reelt, men marginalt
  tolerance-brud (1,11x mod kravet ≤1,1x — pixel-nøjagtigheden var perfekt,
  `meanPx=0.00`). Alle tre kørsler skete mens `tasklist` viste 15-16 samtidige
  `chrome.exe`-processer på denne DELTE maskine (andre arbejdstræer/agenter,
  bekræftet ved at `main` selv flyttede sig til Vaidyas ordre 233 midt i
  denne ordres arbejde) — den mest sandsynlige forklaring er
  ressourcepres/CPU-udsultning, ikke en regression i denne gren (som ikke
  rører `public/videocoach.html`s trackerkode eller selve verify-scriptet
  ud over den ene, urelaterede rettelse i commit 2's søsterscript). IKKE
  bekræftet ved en kørsel på en rolig maskine — det ville kræve at lukke
  andre arbejdstræers browserprocesser, hvilket ligger uden for denne ordres
  mandat (rør aldrig andre navnes filer/processer).
- Den ene rettede prøve (commit 2) blev bevist rød ved at ændre
  `public/videocoach.html` MIDLERTIDIGT og reversere det igen — arbejdstræet
  blev bekræftet rent (`git status --short`) før næste skridt, men selve
  øvelsen krævede en reel, om end kortvarig, ændring af app-koden lokalt.
  Ingen del af den ændring er i den committede historik.
- `docs/PROEVER-KORT.md`s kategorisering af de 28 ikke-browser-baserede
  verify-scripts som "type (2) statisk kildetjek" er selv en ærlig grænse,
  ikke en fejl: disse beviser at koden ER koblet rigtigt sammen, IKKE at
  UI'en faktisk opfører sig sådan for en bruger. Næsten alle disse filers
  egne kommentarer siger det samme ("der findes ingen DOM/React-
  testopsætning i repoet") — en kendt, tidligere accepteret afvejning,
  ikke noget denne ordre opdagede eller ændrede.
- `npm run proever`s "venter på"-kolonne er en grov, to-vejs klassificering
  (browser vs. ikke-browser, autodetekteret ved at søge efter `chromium`/
  `launchBrowser` i scriptets kildetekst) — den gengiver IKKE den fulde,
  fil-specifikke analyse fra `docs/PROEVER-KORT.md`. Den er bevidst holdt
  simpel og selv-opdaterende (ingen hardkodet liste der kan gå af drift),
  på bekostning af detaljegrad; kortet er stedet for den fulde forklaring.
- `npm run proever` tæller ikke individuelle `assert`-kald inde i en enkelt
  enhedstest-fil eller verify-script som separate rækker — én fil/ét script
  er én række, samme granularitet som ordren selv bruger for verify-scripts.
  En fil med 15 assertions, hvoraf én fejler, viser derfor "FEJL" for hele
  filen; hvilken specifik assertion der fejlede, står i "Fejlede"-afsnittets
  sidste linjer, ikke i selve tabellen.

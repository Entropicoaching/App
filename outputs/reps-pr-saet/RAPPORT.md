# Rapport: reps må være forskellige fra sæt til sæt (ORDRE 106)

## Modellen (commit 1)

**Hvordan et ordineret sæt er repræsenteret**

- `exercises.reps` er en fri tekststreng, ikke et struktureret felt. Coachen
  skriver den i et almindeligt tekstfelt: `src/Dashboard.jsx:3248`
  (`['Reps', 'reps', 'text']`), gemmes uændret ved oprettelse/redigering
  (`src/Dashboard.jsx:1818`, `:1832`) og ligger i formularens state som
  `exerciseForm.reps` (`src/Dashboard.jsx:579`).
- Der findes ingen egen kolonne eller markør for "interval" eller "frit" i
  dag — coachen kan allerede skrive `"4-6"` i feltet, men appen behandler det
  ikke som et interval noget sted. Det eneste sted strengen tolkes som tal er
  `parseInt(...)`, som for `"4-6"` giver `4` (stopper ved bindestregen) — både
  i opvarmningsberegningen (`src/warmup.js:77`) og i sæt-loggeren (se
  nedenfor). Der er ingen eksisterende "frit"-konvention at genbruge.
- `exercises.sets` derimod er numerisk (`['Sæt', 'sets', 'number']`,
  `src/Dashboard.jsx:3248`).

**Hvordan loggede reps gemmes i dag**

- Loggede sæt gemmes allerede **pr. sæt**, ikke pr. øvelse: tabellen
  `exercise_logs` har én række pr. `(exercise_id, set_number)` med kolonnen
  `reps_completed` (bekræftet i alle læsninger/skrivninger, fx
  `src/AthleteView.jsx:2745-2757`, `:2862-2869`, `supabase/sql/training-signals-v1.sql:33`).
  Der er altså **ingen skemaændring nødvendig** — strukturen understøtter
  allerede forskellige reps fra sæt til sæt.
- Problemet er i UI/skrivelogikken: sæt-loggeren i `AthleteView.jsx` har
  ikke noget indtastningsfelt for reps. Linje `4991` viser kun en statisk,
  ikke-redigerbar label `× {ex.reps || '—'}`, og knappen "Log"
  (`src/AthleteView.jsx:4997`) kalder
  `logSet(ex.id, setNum, ex.sets, ex.reps, plannedRpe)` — den sender altid
  **ordinationsstrengen** `ex.reps` ind som `repsCompleted`, uanset hvad
  atleten faktisk lavede. Inde i `logSet` (`:2745-2760`) bliver den
  `parseInt`'et: `reps_completed: parseInt(repsCompleted) || 0` (`:2750`).
  - Ved fast ordination (`"8"`) rammer det tilfældigvis rigtigt, hvis
    atleten laver præcis det antal — men fanger ikke afvigelser.
  - Ved interval-ordination (`"4-6"`) logges **alle** sæt altid som `4`,
    uanset om atleten lavede 4, 5 eller 6 reps i det enkelte sæt. Det er
    kernefejlen ordren beder om at rette.

**Hvad e1RM-grafen, check-in og Coach Briefing læser**

Alle nedenstående læser allerede `exercise_logs.reps_completed` pr. sæt —
ingen af dem skal ændres for at se faktiske reps, når commit 2 begynder at
gemme dem korrekt:

- **e1RM-graf / ugentlig volumen (atlet-visning)**:
  `src/AthleteView.jsx:2507-2545` henter `weight, reps_completed, logged_at`
  pr. logget sæt, summerer tonnage (`weight * reps_completed`, `:2539`) og
  regner ugens bedste e1RM med Epley pr. sæt (`:2541-2543`).
- **"Sidst logget" under hver øvelse (atlet)**:
  `src/AthleteView.jsx:2672-2709` og `:4788-4797` (`exerciseHistory`).
- **PR-detektion** (kører direkte i `logSet`):
  `src/AthleteView.jsx:2811-2857` sammenligner `reps_completed` pr. sæt for
  at afgøre vægt-/rep-/styrke-PR.
- **Coach-visning af ugentlig volumen/PR**:
  `src/Dashboard.jsx:5210-5231`, `:5290-5301`.
- **Coach Briefing** (AI-prompt-teksten coachen sender):
  `src/Dashboard.jsx:2724-2731` (ugentlig tonnage),
  `:2783-2796` (per-sæt-linjer "Sæt N: {weight}kg × {reps}"),
  `:2927-2935` (JSON-payload `reps_completed: log.reps_completed`).
- **Dashboard's egen sæt-for-sæt-visning af atletens log**:
  `src/Dashboard.jsx:7255-7260`, `:7387`, `:7464`, `:7111-7119`.

**Konklusion før noget ændres**

Ingen skemaændring. Fikset er isoleret til `AthleteView.jsx`'s sæt-logger:
den skal (a) genkende hvornår `ex.reps` er et interval (`"4-6"`) eller
markeret "frit", (b) i så fald vise et lille redigerbart repsfelt pr. sæt i
stedet for den statiske label, forudfyldt med intervallets nederste tal, og
(c) sende den faktiske, indtastede værdi til `logSet` i stedet for
`ex.reps`. Alt nedstrøms (e1RM, check-in, Coach Briefing) opdateres
automatisk, fordi det allerede læser `reps_completed` pr. sæt.

## Commit 2 — hvad blev bygget

- Ny `src/repsPrescription.js` — `parseRepsPrescription(reps)` tolker
  `exercises.reps` som `'range'` (fx `"4-6"` eller `"4–6"`, med eller uden
  mellemrum), `'free'` (den nye konvention: coachen skriver bogstaveligt
  `"frit"`, uanset store/små bogstaver), eller `'fixed'` (alt andet, inkl.
  tomt felt og fritekst som `"AMRAP"` — samme opførsel som i dag).
- `src/AthleteView.jsx` (linje ~4958-5021): sæt-loggeren viser nu et lille
  reps-felt (52px bredt, 44px trykflade, samme mønster som vægtfeltet) i
  stedet for den statiske `× {ex.reps}`-label, når prescriptionen er
  `'range'` eller `'free'`. Ved `'range'` forudfyldes feltet med
  intervallets nederste tal (`min`); ved `'free'` starter det tomt (der er
  intet nederste tal at forudfylde med — se "Ærlige grænser"). Fast
  ordination (`'fixed'`) er visuelt og funktionelt uændret.
  `logSet`-kaldet sender nu den faktiske indtastede værdi
  (`repsToLog`) i stedet for altid `ex.reps`.
- `src/athleteTrainingInputs.js`: `mergeAthleteSetInputs` genindlæser nu
  også `reps` fra en allerede logget række (samme mønster som `weight`), så
  et genbesøgt sæt viser hvad der faktisk blev logget. `nextAthleteSetInput`
  nulstiller bevidst `reps` til `''` for det næste sæt — reps skal IKKE
  videreføres fra forrige sæt (i modsætning til vægt), så hvert nyt sæt
  starter ved ordinationens nederste tal.

## Commit 3 — tests og mobil

- `src/repsPrescription.test.js` (7 tests): interval med bindestreg/en-dash/
  mellemrum genkendes; `"frit"` (og varianter med store bogstaver/mellemrum)
  genkendes; fast tal og tom ordination forbliver `'fixed'`; anden fritekst
  (`"AMRAP"`, `"8 pr. side"`) forbliver `'fixed'` og bliver IKKE fejlagtigt
  redigerbar.
- `src/athleteTrainingInputs.test.js` (4 tests): reps gemmes og genindlæses
  pr. sæt (to sæt på samme øvelse kan have forskellige reps); reps carries
  ikke over til næste sæt; en bekræftet log vinder over lokal indtastning;
  og et test der beviser at e1RM regnes af de FAKTISKE reps pr. sæt (Epley
  på 100kg×4 vs. 100kg×6 giver forskellige e1RM-tal — havde begge sæt
  fejlagtigt logget ordinationens nederste tal, ville de være ens).
- `scripts/verify-athlete-training-inputs.mjs` opdateret til det nye
  `reps`-felt (var ved at fejle efter commit 2's ændring af
  `mergeAthleteSetInputs`/`nextAthleteSetInput` — rettet så den nu låser den
  nye adfærd fast).
- Nyt `scripts/verify-athlete-reps-per-set-mobile.mjs`
  (`npm run verify:athlete-reps-per-set-mobile`): kører headless Chromium
  (Playwright) på en 390px-viewport og tager et skærmbillede af de tre
  ordinationstyper side om side (fast/interval/frit) med syntetiske
  øvelsesnavne (Squat/Bænkpres/Roning — ingen atletdata). Bruger den ÆGTE
  `src/repsPrescription.js` til at afgøre hvilke sæt der får et felt.
  Skærmbillede: `outputs/reps-pr-saet/mobil-390px-reps-pr-saet.png`.
  Se "Ærlige grænser" for hvorfor det ikke er den levende app, der er
  screenshottet.

## Gren og commits

- Gren: `reps-pr-saet` fra `main` (`6d0c01e`, ordre 105+109 merget/pushet).
- `3e481d4` — docs(reps-pr-saet): kortlæg modellen (commit 1, ingen kode).
- `646bbe9` — feat(reps-pr-saet): reps pr. sæt ved interval/frit (commit 2).
- Commit 3 (tests, mobil-screenshot, rapport) committes umiddelbart efter
  denne fil gemmes — se `git log reps-pr-saet` for det endelige hash.

## Hvad blev ændret

Se "Commit 2" og "Commit 3" ovenfor for den fulde liste. Kort: ny fil
`src/repsPrescription.js`, ændringer i `src/AthleteView.jsx` (kun
sæt-loggerens render + `logSet`-kald) og `src/athleteTrainingInputs.js`
(kun `reps`-feltet), plus tests og ét opdateret/ét nyt verify-script.
Ingen skemaændring, ingen ændring af programskabelonerne coachen skriver
i `Dashboard.jsx` — kun loggerens læsning og gemning, som ordret.

## Testresultat

- `npm run lint` — grøn (0 fejl, 13 præeksisterende advarsler om
  `react-hooks/exhaustive-deps`, urørt af denne ordre).
- `node --test src/*.test.js` — 116/116 grønne (11 nye: 7 i
  `repsPrescription.test.js`, 4 i `athleteTrainingInputs.test.js`).
- `npm run gate:tracker` — GRØN (urørt område, kørt fordi ordren kræver det).
- `npm run verify:athlete-training-inputs` — grøn (opdateret til `reps`).
- `npm run verify:athlete-tap-targets` — grøn (uændret; bekræfter at
  Log/Spring over/RPE-vælgeren stadig har ≥44px efter ændringen).
- `npm run verify:athlete-write-failures` — grøn (rørt område: sæt-logning).
- `npm run verify:athlete-reps-per-set-mobile` (ny) — grøn, 390px-skærmbillede
  gemt i `outputs/reps-pr-saet/mobil-390px-reps-pr-saet.png`.

## Hvad er næste

- Marc bør se skærmbilledet og bekræfte at et tomt "frit"-felt (uden
  forudfyldning) er den rigtige default — se grænse nedenfor.
- Når grenen er godkendt: Marc merger og pusher (Vaidya gør ikke selv).
- Ingen opfølgende opgaver identificeret i selve implementationen.

## Ærlige grænser

- **"Frit" er en ny konvention, ikke en eksisterende.** Der var intet
  "frit"-flag i skemaet eller UI'et før denne ordre — jeg har defineret det
  som at coachen skriver det bogstavelige ord `"frit"` i det eksisterende
  fritekst-reps-felt (samme felt som allerede rummer `"4-6"`). Virker
  robust nok (case-insensitive, trimmet), men er et valg, ikke noget der lå
  fast i koden i forvejen — værd at Marc bekræfter er den model coachene
  reelt vil bruge.
- **"Frit" forudfyldes tomt, ikke med et tal.** Ordren beder specifikt om at
  intervaller forudfyldes "med intervallets nederste tal" — "frit" har
  ingen nederste tal, så jeg lod feltet starte tomt i stedet for at gætte på
  en vilkårlig default (fx 1). Atleten skal selv skrive et tal for at kunne
  logge sættet (samme som vægtfeltet i dag).
- **`autoCompleteSession` (knappen "Udfyld manglende sæt med sidst loggede
  vægt og reps") er IKKE ændret.** Den fylder alle manglende sæt i en
  session med ÉN reps-værdi (`src/AthleteView.jsx:3315-3339`, uændret
  logik) — den skelnede ikke reps pr. sæt før denne ordre og gør det
  stadig ikke. Den ligger uden for ordrens beskrevne scope (den primære
  sæt-logger), men er en kendt begrænsning: bruges den på et interval-sæt,
  logges stadig ét tal på alle manglende sæt (nu enten sidst loggede reps
  for øvelsen, eller — hvis intet er logget før — ordinationens nederste
  tal/parseInt af `"frit"`-strengen, som før). Flag til Marc, ikke rettet
  uden ordre.
- **Mobil-skærmbilledet er en isoleret gengivelse, ikke den levende app.**
  `AthleteView.jsx` kræver en ægte, indlogget Supabase-session for at boote
  — det kan hverken gøres headless uden atletdata, eller uden i praksis at
  logge ind som en rigtig atlet (forbudt: ingen atletdata i filer/rapport,
  ingen skrivning mod produktion). Skærmbilledet bruger derfor den ÆGTE
  `repsPrescription.js`-logik i en minimal HTML-harness der efterligner
  sæt-loggerens præcise mål (44px trykflader, 52px repsfelt) med
  syntetiske øvelsesnavne. Det beviser UI-tilstandene (fast/interval/frit)
  korrekt, men er ikke et billede af selve produktionskoden i browseren.
- **Ingen ny e1RM-/tonnage-kode.** Som fundet i commit 1 læser e1RM-grafen,
  ugentlig volumen og Coach Briefing allerede `reps_completed` pr. sæt —
  de er urørt, og testen for "e1RM regnes af faktiske reps" beviser derfor
  datastrømmen (reps gemmes og genindlæses korrekt pr. sæt), ikke selve
  Epley-formlen (triviel, uændret, ikke eksporteret som selvstændig
  funktion nogen steder i koden).

## Betydning for Hara

Rører "Appen mærkbart bedre for atleterne" — atleter der får ordineret
intervaller (fx "3×4-6") kan nu logge hvad de faktisk lavede pr. sæt i
stedet for at appen tavst gemmer et forkert tal, og deres e1RM/tonnage
bliver dermed retvisende uden yderligere arbejde.

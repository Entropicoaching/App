# Rapport — ordre 268: atleten kan se om ugen blev som planlagt

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `atletens-uge`, forgrenet fra `main` (`03ca364`, ordre 267 bekræftet
merget inde). Tre commits (denne rapport er den tredje). Arbejdstræet er
rent. Ingen migration, ingen ny tabel, ingen ny afhængighed, ingen push,
ingen atletdata i denne rapport. `e2e/` og `scripts/proever.mjs` er ikke
rørt (Bhishak arbejder der på ordre 269) — commit 3's prøve ligger i
`scripts/verify-atletens-uge.mjs` i stedet, som `npm run proever` finder af
sig selv (den læser `verify:*`-scripts fra `package.json`).

## Hvad ændret

Nyt kort "Ugen som planlagt" på Hjem-fanen, lige under ugekalenderen —
atletens egen udgave af coachens "planlagt mod gennemført" (ordre 210,
`src/volume/planlagt.js`/`VolumenKort.jsx`), men i sæt og tonnage i stedet
for muskelgrupper, så atleten ikke skal kende ordet "muskelgruppe" for at
se om ugen holdt. Regnestykket bor i `src/athlete/ugeStatus.js` (ren
funktion, 9 enhedstests), visningen i `src/athlete/UgensStatusKort.jsx`,
wired ind direkte i `AthleteView.jsx` (ikke lazy-loadet, samme mønster som
`WeekCalendar`/`DagensPasCard`, som allerede bor der). Commit 1: ugens 7
dage (mandag-søndag) hver med planlagt mod gennemført sæt og tonnage —
gennemført matches via `exercise_id` (samme mekanisme som `WeekCalendar`s
`sessDone`), ikke kalenderdato, så dagslinjen virker uændret selv når ugen
ikke har en `start_date` sat. Planlagt tonnage kræver kendt
`recommended_weight` og kendt reps-tal (interval bruger laveste ende, samme
konvention som `DagensPasCard`s `repsDefault`); mangler ét af delene, vises
"–", aldrig et tal der lyver ved kun at tælle det kendte med (samme
"– frem for forkert 0"-princip som `planlagt.js`s `ugePlaceret`). Farver er
grøn (dagen matchede planen) eller grå (alt andet, inkl. ingen planlagt
træning) — aldrig rødt, en manglende dag er ikke en fejl. Commit 2: en knap
skifter visningen til "Hele forløbet" — planlagt mod gennemført pr.
kalenderuge over hele det daterede program, samme ramme som
`beregnPlanlagtPrUge` (kun uger med mindst én dateret programuge,
gennemført matches her på `logged_at`, ikke `exercise_id`, ligesom
coachens egen beregning), tegnet med samme kontur-bag-solid-søjle-teknik
som `VolumenGrafForloeb.jsx` — teknikken er kopieret (to rækker, "Sæt" og
"Tonnage", i stedet for én række pr. muskelgruppe), coachens fil er hverken
ændret eller importeret. Logs til "Hele forløbet" hentes lazy
(`fetchForloebLogs`, samme 2000-sæt-grænse som coachens
`fetchAthleteLogs`), først når atleten rent faktisk åbner den visning.

## Testresultat

- **`npm run lint`:** rent efter alle tre commits.
- **`npm run build`:** grøn efter alle tre commits — `AthleteView` vokser
  til 145,3 kB (39,3 kB gzip), ingen advarsler.
- **Enhedstests (`src/athlete/ugeStatus.test.js`):** 9/9 grønne — dagsvisning
  (fuldt logget, sprunget-over-sæt tæller aldrig med, ukendt planlagt
  tonnage, reps-interval bruger laveste ende, dato udledt af `weekStart`,
  fleksible sessioner uden fast dag) og hele-forløbet-visning (planlagt fra
  daterede uger/gennemført fra samme kalenderuge, uger uden dato tælles for
  sig, én uges ukendte tonnage smitter ikke en anden uges).
- **`scripts/verify-atletens-uge.mjs` (`npm run verify:atletens-uge`,
  commit 3):** åbner den ægte, ubuildede app mod mocken, logger ind som
  atlet, og verificerer at "Ugen som planlagt" viser dagens rigtige tal
  (Squat: 4 planlagt/3 gennemført sæt, 1280kg planlagt/1200kg gennemført
  tonnage — assertet både i DOM'en og direkte mod mockens `exercise_logs`),
  at dage uden session vises som "Ingen træning planlagt" i stedet for et
  0-tal, og at "Hele forløbet" ærligt falder tilbage til "Ingen daterede
  programuger endnu." når seedens uge (bevidst) ikke har en `start_date`.
  Grøn ved isoleret kørsel.
- **`npm run proever`:** **68/68 grønne** (0 fejl, 0 sprunget over), kørt
  efter alle tre commits — inkl. `verify:atletens-uge` og hele den delte
  `e2e (run-all.mjs)`-sekvens. `scripts/proever.mjs` er urørt (den læser
  `verify:*`-scripts fra `package.json` af sig selv).
  Undervejs fundet og rettet (samme mønster som ordre 263, commit 4):
  dagsrækken viste oprindeligt sessionens titel ("Dag 1 — Squat"), som i
  e2e-fixturens seed er identisk med teksten `e2e/atlet.spec.mjs` og
  `e2e/fejl.spec.mjs` klikker via `page.getByText(...)` UDEN `exact:true`
  — et duplikat gjorde den lokator flertydig og væltede hele
  `e2e (run-all.mjs)`. Rettet ved at fjerne titel-visningen fra dagsrækken
  (sæt/tonnage-tallene er selve pointen, titlen var ikke nødvendig) —
  ingen fil i `e2e/` er rørt eller ændret for at fikse det.

## Hvad er næste

1. Planlagt tonnage er kun så god som `recommended_weight`/reps i
   programmet — mange øvelser har ikke en fast anbefalet vægt sat, og vil
   derfor vise "–" i stedet for et tal. Ingen kodeændring løser det; det
   kræver at coachen sætter `recommended_weight` mere konsekvent.
2. Ikke afprøvet mod produktion (samme stående grænse som 131/210/228/248/
   256/259) — kun mod den lokale mock/e2e og `npm run dev`.
3. For Hara: atleten kan nu se, uden at spørge, om ugen blev som aftalt
   eller hvor den skred — samme data Marc allerede bruger tid på at
   forklare mundtligt, nu synlig for atleten selv, i samme sprog (sæt og
   kilo) som resten af appen.

**Tre linjer til Marc:** Atleten ser nu, direkte på Hjem, om ugens dage gik
som planlagt (sæt og kg, grønt når det matcher, gråt ellers — aldrig et
karakterblad), og kan skifte til at se det samme over hele det igangværende
forløb. Det er den samtale du ellers selv skulle tage hver uge, nu noget
atleten selv kan se før I taler sammen.

## Ærlige grænser

- Planlagt tonnage er en beregnet antagelse (laveste reps i et interval ×
  `recommended_weight`), ikke et loft coachen aktivt har bekræftet pr. sæt
  — den kan afvige fra hvad der faktisk var meningen, særligt på øvelser
  uden en sat anbefalet vægt (viser da "–", ikke et forkert tal).
- "Hele forløbet" kræver daterede programuger (`weeks.start_date`) for at
  vise noget som helst — uden dem viser den ærligt "Ingen daterede
  programuger endnu." i stedet for et tal, men giver så heller ingen
  indsigt før coachen sætter datoer.
- Fleksible sessioner (ingen fast ugedag) tælles ikke med i dagslinjen —
  kun i et lille fodnote-tal ("+N fleksible sessioner uden fast dag") — de
  har ingen dag at stå på i en 7-dages-linje.
- E2e-dækningen (`verify-atletens-uge.mjs`) dækker ét scenarie (én session,
  én øvelse, kendt tonnage) plus "hele forløbet"s ingen-dato-fald; en uge
  med flere sessioner/øvelser eller en uge der FAKTISK har en dateret
  `start_date` er kun verificeret af enhedstestene, ikke af en browser-prøve.
- Ikke afprøvet mod produktion, se "Hvad er næste".

# Kortet over hvad prøverne venter på (ordre 234, commit 1)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Ingen kodeændring i denne commit. Gennemgået: alle 7 e2e-specs + `run-all.mjs` +
de 3 manuelle sporings-diagnose-scripts i `e2e/`, og alle 34 `verify:*`-scripts
fra `package.json` (plus 4 filer i `scripts/` der LIGNER verify-scripts men ikke
er koblet til noget npm-script — se egen tabel nederst).

**Kategorier** (ordrens egne):
- **(a)** kan melde hæng uden at der er noget hæng i browseren.
- **(b)** kan bestå stille uden at have set det den skulle bevise.
- **(c)** har en timeout/ventetid uden begrundet tal.
- **ingen** — venter på det faktiske udfald, fejler synligt hvis det udebliver.

## Hovedfund

Kun ét (a)/(b)-tilfælde findes i hele test-høsten, og det er allerede rettet —
**før denne ordre**, i ordre 225 (se `docs/RAPPORT-225.md`): `e2e/coach-sporing.spec.mjs`s
`confirmAndWaitForTracking` genkendte oprindeligt kun to banner-tekster som
"færdig" og ventede derfor for evigt på et rigtigt klip, der reelt var færdigt
via en tredje, stille vej (`#sheet.open` uden banner-tekst). Rettelsen (genkend
også `#sheet.open`) står stadig i koden og er selve grunden til at denne ordre
(234) blev bestilt. Ingen ny forekomst af samme mønster er fundet nogen andre
steder — se "Metode" for hvor grundigt der er ledt.

Alle 6 browser-baserede verify-scripts og alle 7 e2e-specs venter på et ægte
DOM-tilstand, en ægte funktions-returværdi, eller mockens egne tabel-rækker —
ikke på et banner der kan udeblive af en anden, gyldig grund. De resterende 28
verify-scripts kører slet ikke i en browser: de er enten rene enhedstests af
isoleret logik (ingen tidsafhængighed, ingen kategori a/b/c-risiko) eller
statiske kildetekst-/SQL-regex-tjek (se egen note nedenfor — en anden slags
usikkerhed end det ordren leder efter, men værd at nævne ærligt).

## A) e2e — kørt via `npm run e2e` (run-all.mjs) / `e2e:atlet` / `e2e:coach`

| Prøve | Venter på | Hvis udebliver | Kategori |
|---|---|---|---|
| `atlet.spec.mjs` (runAtletJourney) | Ægte DOM-tekst (`Mit program`, `Opvarmningssæt —`), mockens `exercise_logs`/`readiness_logs`-rækker via `waitForFunction` mod `/__e2e/table` | `waitFor`/`waitForFunction` timeout → prøven fejler synligt (rødt), ingen stille bestået | ingen |
| `coach.spec.mjs` (runCoachReview + runMinTraeningPreview) | Ægte DOM-tekst, `pageerror`-liste (skal være tom), ErrorBoundary-tekst (skal være 0) | Timeout eller ikke-tom fejlliste → rødt | ingen |
| `coach-sporing.spec.mjs` (runCoachSporing) | Banner-tekst ("Klip + loop", "Ingen tydelig") **eller** `#sheet.open` (den stille fuldførelsesvej) — se Hovedfund | Efter `maxIterations` (60×2s=120s): kaster med tydelig fejl inkl. sidste banner/procent — intet stille pass. Køres IKKE af `run-all.mjs`/`npm run e2e` (se nedenfor) | **ingen (rettet i ordre 225)** — historisk (a)+(b) før 225 |
| `beskeder.spec.mjs` | Ægte DOM-tekst, ulæst-tæller via `textContent` | Timeout → rødt | ingen |
| `fejl.spec.mjs` (offline-log + afvist upload) | Ægte DOM-tekst ("Fejl — prøv igen", "Prøv at sende igen"), mockens `exercise_logs`/`video_analyses`-rækketal | Timeout → rødt | ingen |
| `video-review.spec.mjs` | Ægte DOM-tekst/dialog, mockens `video_analyses.status` via `waitForFunction` | Timeout → rødt | ingen |
| `video-upload.spec.mjs` | `#athleteSubmitSheet[hidden]` detached, mockens `video_analyses`-række + storage-nøgle | Timeout → rødt | ingen |
| `run-all.mjs` | Kalder ovenstående i rækkefølge, egen `step()`-wrapper kaster ved browser-`pageerror` | Enhver fejl i et skridt stopper hele kørslen med exit 1 | ingen — **men** inkluderer bevidst IKKE `coach-sporing.spec.mjs` (ægte stangbane-sporing), fordi ordre 200 fastslog at sporingen af et rigtigt klip ikke er pålidelig nok (<10/10, se `coach-sporing-reliability.mjs`) til at stå i den automatiske suite. `npm run e2e` grønt beviser IKKE at ægte stangbane-sporing virker — kun at resten af appen gør |

## B) e2e — manuelle diagnose-scripts (ikke kørt af `npm run e2e`, ingen npm-script)

Disse tre findes i `e2e/` men er bevidst uden for den automatiske suite —
brugt til at måle/diagnosticere, ikke til at gate en merge.

| Script | Venter på | Kategori |
|---|---|---|
| `coach-sporing-reliability.mjs` | Kører `runCoachSporing` (samme, rettede funktion som ovenfor) N gange, tæller ok/fejl | ingen — arver 225-rettelsen |
| `coach-sporing-trace.mjs` | Samme, med `--max-minutes` som eksplicit, begrundet loft (default 40 min for `--glat`, se kommentar: baseret på commit 1's målte 74-190s) | ingen — timeout er begrundet i koden |
| `coach-sporing-trace-real.mjs` | Samme mod RIGTIGE klip (`test-clips/`, git-ignoreret), 15 min standard-loft, begrundet (`docs/SVAR-221.md`) | ingen — timeout begrundet, springer selv over hvis klippet mangler lokalt |

## C) verify-scripts — browser-baserede (6 af 34)

| Script | Venter på | Hvis udebliver | Kategori |
|---|---|---|---|
| `verify-athlete-reps-per-set-mobile.mjs` | `window.__harnessReady` (isoleret HTML-harness), DOM-attributter | Timeout 5s → rødt | ingen |
| `verify-videocoach-film-guide.mjs` | `#athFilmGuide`-selector, localStorage-flag, DOM-tekst | Timeout → rødt. To `waitForTimeout(200/150)` efter selector-fund, uden begrundet tal (render-settle) | **(c)** — små, lavrisiko magic numbers |
| `verify-videocoach-buttons-layout.mjs` | Element-bokse (`getBoundingClientRect`), `hidden`-flag før/under en ægte `runFullAnalysis()`-kørsel | **Rettet i commit 2**: ventede før på et ubegrundet fast `waitForTimeout(400)` (gæt på at chippens egen 250ms-poller nåede at reagere). Venter nu på selve `#trackerFastSeg.vcTrackingBusy`-klassen — det ægte udfald observatøren i videocoach.html rent faktisk sætter | **(c) → rettet** |
| `verify-videocoach-clip.mjs` | `page.evaluate()`s returværdi af de ÆGTE `runAnalysis`/`runRepWindowsPresearch`/`runRealtimePreview`-funktioner (afventer selve promise'n, ikke en banner-proxy), sammenlignet mod numerisk facit (pixel-afvigelse, realtidsfaktor) | Intet udebliver stille — assertions er numeriske tolerancer mod kendt facit | ingen |
| `verify-videocoach-upload-flow.mjs` | (A) banner-tekst "Video modtaget" — men denne sættes i SAMME synkrone success-callback som selve upload-bekræftelsen, ingen alternativ stille vej fundet. (B) `runFullAnalysis()`s returværdi direkte via `evaluate()` (ikke banner-polling — faktisk mere ærlig end `coach-sporing.spec.mjs`s metode), med `withTimeout()`-wrapper som begrundet sikkerhedsnet (120s) | Timeout → kaster med label ("runFullAnalysis" osv.) | ingen |
| `verify-ugen-faar-dato.mjs` | Ægte DOM-tekst, mockens `weeks`-tabel | Timeout → rødt | ingen |

## D) verify-scripts — rene enhedstests / statiske kildetjek (28 af 34)

Ingen af disse bruger en browser, en timeout eller en banner-tekst — de kører
enten (1) ren, importeret logik med `assert.equal`/`assert.deepEqual` mod
kendte input/output, eller (2) `readFileSync` + regex/hash mod kildekoden
selv, for at bekræfte at en funktion faktisk er koblet ind de rigtige steder.
Begge er kategori **ingen** i ordrens forstand (intet kan "hænge" eller "tie
stille" — en regex der ikke matcher fejler prøven synligt, med det samme).

**Ærlig grænse ved type (2), værd at kende (ikke en kategori a/b/c-fejl):** en
statisk kildetekst-match beviser at koden STÅR der og er KOBLET rigtigt ind —
den beviser ikke at UI'en rent faktisk opfører sig sådan for en bruger. Det er
en bevidst, dokumenteret afvejning i næsten alle disse filers egne
kommentarer ("der findes ingen DOM/React-testopsætning i repoet") — ikke en
skjult svaghed, men en anden slags tillid end en kørt browser-prøve.

| Script | Type |
|---|---|
| `verify-auth-logout-and-role-switch.mjs` | (2) statisk |
| `verify-athlete-training-inputs.mjs` | (1) enhedstest |
| `verify-athlete-onboarding.mjs` | (1)+(2) blandet |
| `verify-athlete-onboarding-guide.mjs` | (2) statisk |
| `verify-athlete-first-day-flow.mjs` | (2) statisk (+ sha256-hash-lås) |
| `verify-athlete-write-failures.mjs` | (2) statisk |
| `verify-athlete-read-failures.mjs` | (2) statisk |
| `verify-athlete-readiness-draft.mjs` | (2) statisk |
| `verify-athlete-rest-timer-drift.mjs` | (2) statisk |
| `verify-athlete-tap-targets.mjs` | (2) statisk |
| `verify-athlete-password-reset.mjs` | (1)+(2) blandet |
| `verify-athlete-jargon-explained.mjs` | (2) statisk |
| `verify-athlete-self-service.mjs` | (2) statisk |
| `verify-athlete-silent-fails-5.mjs` | (2) statisk |
| `verify-athlete-silent-fail-visibility.mjs` | (2) statisk |
| `verify-coach-inbox-flow.mjs` | (1) enhedstest |
| `verify-coach-priority.mjs` | (1) enhedstest |
| `verify-progression-state.mjs` | (1) enhedstest |
| `verify-videocoach-baseline-progress.mjs` | (1) enhedstest |
| `verify-videocoach-feedback-quality.mjs` | (1) enhedstest |
| `verify-videocoach-labels.mjs` | (1) enhedstest |
| `verify-videocoach-variation-migration.mjs` | (2) statisk (SQL-regex) |
| `verify-videocoach-submission.mjs` | (1) enhedstest (mocket Supabase-klient) |
| `verify-videocoach-upload.mjs` | (1) enhedstest |
| `verify-videocoach-migrations.mjs` | (2) statisk (SQL-regex) |
| `verify-videocoach-zoom.mjs` | (2) statisk |
| `verify-videocoach-plate-detect.mjs` | (1) enhedstest (ægte `autoCalib` kørt i ren Node mod syntetiske pixel-buffere) |
| `verify:n8n` (`n8n/verify-workflows.mjs`) | (2) statisk (workflow-JSON) |

## E) Findes i `scripts/`, men koblet til INTET npm-script (ikke en del af de 34)

Disse fire har rigtige assertions (5-15 stk. hver) og ligner verify-scripts i
alt andet end navn — men `npm run verify:*` rammer dem aldrig, fordi de mangler
et tilsvarende `"verify:..."`-felt i `package.json`. De er ikke "løgnagtige"
(de kører bare aldrig), men de er et sted "alt grønt" kan narre: nogen kan tro
de dækkes af `npm run proever`/CI, uden at de gør. Ikke rørt i denne ordre
(ingen ordre om at slette/koble dem) — nævnt til Dhruva/Marc.

| Fil | Assertions |
|---|---|
| `scripts/verify-athlete-identity.mjs` | 10 |
| `scripts/verify-periodization-assistant.mjs` | 9 |
| `scripts/verify-plan-aware-forecast.mjs` | 15 |
| `scripts/verify-plan-overview.mjs` | 5 |

## Optælling

45 prøver/scripts gennemgået i alt: 7 e2e-specs + `run-all.mjs` + 3 manuelle
sporings-diagnose-scripts + 34 `verify:*`-scripts.

| Kategori | Før commit 2 | Efter commit 2 |
|---|---|---|
| (a) — kan melde hæng uden hæng | 0 aktive (1 historisk, rettet i ordre 225) | 0 |
| (b) — kan bestå stille | 0 aktive (samme historiske tilfælde) | 0 |
| (c) — timeout uden begrundelse | 2 (`verify-videocoach-film-guide.mjs`, `verify-videocoach-buttons-layout.mjs`) | 1 (`verify-videocoach-film-guide.mjs`, lavrisiko render-settle-pauser tilbage) |
| ingen (venter på faktisk udfald) | 43 af 45 | 44 af 45 |

## Metode

Hver fil er læst i sin helhed (ikke kun grep'et), bortset fra
`verify-videocoach-clip.mjs` (1142 linjer) og `verify-videocoach-plate-detect.mjs`
(381 linjer), hvor selve ventelogikken/assertions er læst fuldt ud, men den
omgivende beregningskode (kendt, ordre-dokumenteret tracker-udtræk) er
gennemgået strukturelt. Der er søgt systematisk efter `waitForTimeout`,
`waitForSelector`/`waitForFunction`, `banner`/`textContent`-baserede
udfaldstjek, `setTimeout`, `Promise.race`, og tavse `catch`-blokke på tværs af
alle 34 scripts og alle e2e-filer — ikke kun stikprøver.

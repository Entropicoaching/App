# ORDRE 61 — De tre løse ender fra upload og gå

Gren: `loese-ender-upload` (fra `main` `e0c5e69`, ORDRE 57 allerede merget og live)

Commits:
- `4db228a` — commit 1: bevar coachens notat ved fuldførelse af en afventende video
- `4a3c0ae` — commit 2: annullér under upload
- `c9acec3` — commit 3: "Vis mig nu" sender også belastning, RPE og note

Filer: `public/videocoach.html` (kirurgiske ændringer, ikke omskrevet),
`src/AthleteView.jsx`, `src/supabase.js` (ny eksport:
`createAbortableUploadClient`), `scripts/verify-videocoach-upload.mjs` og
`scripts/verify-videocoach-submission.mjs` (udvidet med regressionstests for
alle tre commits). Ingen SQL, ingen migrationer, ingen policy-ændringer.

Ikke rørt: coach-tilstandens tracker, benkæden, bænkens skulderanker,
sættets start, selve upload- og hentevejen (sti, bucket, signeret URL).
Ingen atletdata i kode, tekst eller test.

## Opgaven

ORDRE 57 er merget og pushet (live), men Marcs telefontest af selve
upload/hente-vejen er ikke kørt endnu. Denne ordre rører derfor ikke ved den
— den løser i stedet de tre løse ender, jeg selv navngav i ORDRE 57's
rapport under "Ærlige grænser", som kunne bygges uden at vente på testen.

## Commit 1 — coachens notat forsvandt stille ved fuldførelse

**Bug:** `vcV3DatabaseRow` (bygger rækken, der gemmes) tvang `bias_note`
til `null` for enhver `athlete_submission`-række — også når coachen selv
skrev i sit eget notatfelt, mens han FULDFØRTE en afventende atlet-video
(ORDRE 57 commit 2's "Spor nu"-flow). Null-kravet
(`video_analyses_v3_payload_bounds`) ligger kun i atletens egen
INSERT-policy (`entropi_vc3_athlete_insert_own_draft`); coachens
UPDATE-policy (`entropi_vc3_coach_update`) tillader `bias_note` på
`athlete_submission`.

**Fix:** `vcV3DatabaseRow(payload, legacy, isCompletion)` fik en tredje
parameter. Kaldestedet sender `!!completingPending` (samme variabel, der
allerede afgør om gemmet er en fuldførelse, jf. ORDRE 57 commit 2).
`bias_note` nulles nu kun, når `source_mode === 'athlete_submission' &&
!isCompletion` — dvs. kun ved atletens egen friske indsættelse.

## Commit 2 — Annullér under upload

**Bug:** Send-knappen var blot deaktiveret, mens videoen overførtes — ingen
vej tilbage, og filen kunne ikke afbrydes.

**Fix:** `@supabase/supabase-js` 2.112.3's `storage.upload()` tager ingen
`AbortSignal` (bekræftet ved at læse `storage-js`'s kildekode — hverken
`FileOptions` eller `uploadOrUpdate` sender et `signal` videre til
`fetch`). Løsningen bruger i stedet supabase-js's egen **fetch-option**:
`src/supabase.js` fik `createAbortableUploadClient(signal)` — en
engangsklient, der genbruger den allerede persisterede session (samme
localStorage-nøgle, ingen ny login), uden egen refresh-timer (undgår to
konkurrerende GoTrue-instanser), og hvis `global.fetch` binder den
medsendte `AbortController`s signal til selve netværkskaldet.

`AthleteView.jsx`s `upload-and-go`-håndtering opretter nu en
`AbortController` pr. forsøg (keyet på `requestId` i en Map), bruger den
engangsklient til selve `storage.upload()`, og en ny besked-type
`abort-upload` kalder `controller.abort()` på den rigtige. Afbrydes
uploaden, svares der `{ aborted: true }` — **før** `buildAwaitingAnalysisRow`
overhovedet kaldes, så en annulleret upload ALDRIG efterlader en afventende
række (bekræftet ved kildeposition i testen: abort-svaret står tekstuelt før
`buildAwaitingAnalysisRow(` i filen).

I VideoCoach-siden (`videocoach.html`) viser en ny "Annullér"-knap sig ved
siden af Send, mens overførslen kører; den sender `abort-upload` med samme
`requestId`. Filen forbliver valgt bagefter (uændret adfærd), og
grænsefladen siger "Annulleret · intet blev sendt" i stedet for en fejl.

## Commit 3 — "Vis mig nu" sender nu også belastning, RPE og note

**Bug:** De tre valgfrie felter boede kun i sendearket
("`athleteSubmitFields`"), som kun åbnes, når man klikker "Send" i
footeren — hvilket i praksis kun sker ved en fejlslagen genforsøgs-visning.
Både "Vis mig nu" og "Start" uploader automatisk, uden nogensinde at åbne
det ark, så felterne stod altid tomme på deres første (og eneste) reelle
forsøg.

**Fix:** Løft/variation lever videre i sendearket (uændret). Belastning/RPE
og notat er flyttet til et nyt panel, `athleteConfirmFields`, som vises i
**nøjagtig samme tilstand** som "Vis mig nu"-knappen (`state === 'confirm'`
— ring-bekræftelsen, lige før Start/Vis mig nu kan trykkes). Ingen ny
skærm: samme trin som løft/variation, blot et nyt lille panel over
footeren i stedet for et skjult sendeark. `vcAthleteUploadAndGo` læser
stadig de samme `#loadInput`/`#athleteNoteInput`-elementer uanset hvor i
DOM'et de sidder, så selve afsendelseslogikken er urørt.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler,
  urørt af denne ordre).
- `npm run gate:tracker` — GRØN (trackeren er urørt).
- `verify:videocoach-submission`, `verify:videocoach-upload`,
  `verify:videocoach-labels` — grønne. Udvidet med:
  - commit 1: at `vcV3DatabaseRow` tager `isCompletion`, og at `bias_note`
    kun nulles uden den.
  - commit 2: at `createAbortableUploadClient` bruger supabase-js's
    fetch-option med signal; at `AthleteView.jsx` sporer aktive uploads pr.
    `requestId`; at `abort-upload` kalder `AbortController.abort()`; og at
    den annullerede gren returnerer FØR `buildAwaitingAnalysisRow` i
    kildeteksten (garantien mod en afventende række).
  - commit 3: at belastning/RPE/notat er flyttet ud af sendearket og ind i
    `athleteConfirmFields`, og at panelet er synligt i nøjagtig samme
    tilstand (`'confirm'`) som "Vis mig nu"-knappen.
- `node --check` af det udtrukne hovedscript i `videocoach.html` — fejlfrit
  efter hver commit.
- **Headless (Claude-in-Chrome)** mod en lokal statisk server af
  `public/videocoach.html?mode=athlete&bridge=athlete-v1` (ingen
  Supabase-forbindelse nødvendig for disse tjek — ren DOM/funktionslogik):
  - Kaldte `vcV3DatabaseRow` direkte med `isCompletion=false` og
    `isCompletion=true`: `bias_note` blev hhv. `null` og bevaret
    ("Coachens note") — commit 1 bekræftet i levende kode.
  - Kaldte `setAthleteState('confirm')`/`'done'`: `athleteConfirmFields`
    var synlig præcis i `'confirm'` (sammen med `athletePreviewBtn`) og
    skjult i `'done'` — commit 3's timing bekræftet.
  - Udfyldte `#loadInput`/`#athleteNoteInput` i `'confirm'`-tilstanden,
    kaldte `vcAthleteUploadAndGo()` (med `vcV3RequestUploadAndGo`
    midlertidigt ombygget til at opsnappe sit argument i stedet for at
    poste til en (ikke-eksisterende) host): payloaden indeholdt
    `loadKg: 120, rpe: 8, athleteNote: 'Knæet vaklede lidt'` — beviser at de
    tre felter reelt når frem til afsendelsen på denne vej, ikke kun at
    UI'en er synlig.
  - Simulerede en igangværende upload og klikkede den nye
    "Annullér"-knap: `vcV3RequestAbortUpload` blev kaldt med SAMME
    `requestId`, som blev sendt i upload-and-go-kaldet — knappens wiring
    til det rigtige forsøg bekræftet. Efter et vellykket gem var knappen
    skjult igen og `saveBtn` tilbage til "Send til coach".
  - Selve netværks-afbrydelsen inde i `AthleteView.jsx` (React, kræver en
    ægte host-forbindelse) er verificeret ved kildelæsning + de hermetiske
    tests ovenfor, ikke ved en levende Supabase-upload (se grænser).

## Ærlige grænser

- **Ingen ægte netværks-annullering testet mod en rigtig upload.**
  `AthleteView.jsx`s `AbortController`/`createAbortableUploadClient`-flow
  er verificeret ved kildelæsning (herunder `storage-js`'s faktiske
  fetch-kald, som bekræftede at `signal` IKKE understøttes af
  `storage.upload()` i denne version) og ved statiske regressionstests —
  ikke ved at afbryde en ægte, igangværende upload mod produktions-Supabase
  fra en telefon. Det kræver Marcs telefontest.
- **Beskedbroens sikkerhedstjek (`event.source !== VC_V3_HOST`) forhindrede
  et fuldt same-window-testet round-trip** af `upload-result`-håndteringen
  med `aborted:true` — det er en bevidst sikkerhedsgrænse (kun den rigtige
  host-forbindelse godkendes), ikke en mangel. Selve logikken
  (`err.vcAborted = true` når `msg.aborted`) er bekræftet ved kildelæsning
  og i regressionstesten.
- **Retry-visningen mistede sin mulighed for at redigere belastning/RPE/note
  efter en fejlet upload.** Før commit 3 lå felterne i sendearket, som også
  åbnede ved en fejlet automatisk afsendelse (til genforsøg). De bor nu kun
  i `athleteConfirmFields` (synligt i `'confirm'`), så en fejlet upload i
  `'done'`-tilstanden viser ikke længere disse felter til redigering før et
  genforsøg — værdierne fra første forsøg genbruges uændret. Bevidst
  afvejning for at holde ordren inden for "ingen ny skærm, samme trin".
- **Ingen oprydning af den delvist uploadede fil ved en annulleret
  upload.** En enkelt `fetch`-baseret upload afbrydes som ÉT samlet
  netværkskald (ikke en chunket protokol), så en afbrudt anmodning bør
  ikke efterlade et gemt objekt i bucket'en — men det er ikke bekræftet
  mod et rigtigt Supabase Storage-endpoint.

## Betydning for Hara

Under "Appen mærkbart bedre": tre konkrete, mærkbare forbedringer af
upload-flowet fra ORDRE 57 — coachens eget notat forsvinder ikke længere
stille ved fuldførelse, atleten kan fortryde en igangværende afsendelse i
stedet for at stå fast med en deaktiveret knap, og "Vis mig nu"/Start
sender nu samme information til coachen som standardvejen.

## Hvad er næste

- Marcs telefontest af selve upload- og hentevejen (ORDRE 57), som denne
  ordre bevidst ikke rørte ved.
- Når den er kørt: en ægte netværks-annullering på et rigtigt mobilnet
  (svag forbindelse, delvist overført data) for at bekræfte at
  `AbortController`-afbrydelsen reelt stopper båndbreddeforbruget, ikke kun
  den lokale ventetid.
- Overvej om retry-visningen (se "Ærlige grænser") bør kunne redigere
  belastning/RPE/note igen, hvis det opleves som et problem i praksis.

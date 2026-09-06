# ORDRE 64 — De stille fejl, runde 2

Gren: `stille-fejl-2` (fra `main` `183e75c`, ORDRE 61 allerede merget og live)

Commits:
- `c402890` — commit 1: F4 — `skipSet`/`skipExercise`/`unskipSet` bruger nu write-garden
- `82935e4` — commit 2: F5 — stævnemaks (`markGoodAndSave`) gemmes kun efter bekræftet RPC
- `8fa3058` — commit 3: F6+F7 — PR-baseline og parathedsfejl skjuler ikke fejlen

Filer: `src/AthleteView.jsx`, `src/athleteWriteGuard.test.js` (udvidet),
`scripts/verify-athlete-write-failures.mjs` (udvidet). Ingen SQL, ingen
migrationer, ingen nye afhængigheder, videocoach/kostlog/beskeder urørt.
Ingen atletdata i kode, tekst eller test.

## Opgaven

ORDRE 41's fundliste identificerede otte steder med samme mønster — rå
Supabase-kald uden fejltjek, hvor atleten eller coachen ender med en skærm
der ikke passer med databasen. F1/F2 blev rettet i ORDRE 41 med
`src/athleteWriteGuard.js` (`runGuardedWrite`). F4-F7 stod tilbage under
stregen med samme løsning allerede identificeret ("samme rettelse
(`runGuardedWrite`) kunne dække den i en senere ordre" — F4's egen note).
Denne ordre lukker dem, uden ny mekanik.

## Commit 1 — F4: spring over uden svar

**Bug:** `skipSet`, `skipExercise`, `unskipSet` skrev rå insert/update/delete
til `exercise_logs` uden at kigge på `{ error }`. Et fejlet tryk kaldte
`fetchExerciseLogs` uanset udfald — selvkorrigerende ved næste hentning, men
uden at fortælle atleten *hvorfor* et "spring over"-tryk ikke slog igennem.

**Fix:** Alle tre kører nu gennem `runGuardedWrite`. Ved fejl vises en linje
i atletens sprog (`showFlash`), og `fetchExerciseLogs` kaldes slet ikke —
skærmen forbliver i den tilstand den var, i stedet for at foregive en
genindlæsning der intet ændrede.

## Commit 2 — F5: stævnemaks der kun var gemt i skærmen

**Bug:** `markGoodAndSave` (Stævnedag) kaldte
`supabase.rpc('update_competition_max', ...)` og opdaterede
`athlete.squat/bench/deadlift` i UI'en uanset RPC-svar. Høj pris (falsk tro
på at konkurrencemakset er gemt), lav frekvens.

**Fix:** `setAthlete(...)` kaldes nu kun når `runGuardedWrite` bekræfter at
RPC'en lykkedes. Ved fejl: én klar besked, tallet på skærmen forbliver
uændret i stedet for at vise et tal databasen ikke har.

## Commit 3 — F6+F7: PR-baseline og parathedsfejl

**F6-bug:** `logSet`s PR-blok læste `personal_records` uden fejltjek — en
fejlet SELECT gav `rows=[]`, som koden tolkede som "atletens allerførste
registrering" og gemte en ny baseline. En netværksfluktuation kunne dermed
stille overskrive/duplikere en ægte tidligere PR.

**F6-fix:** SELECT-fejlen tjekkes nu eksplicit og skelnes fra en ægte tom
liste. Ved fejl springes PR-detektionen over for det sæt (selve sætloggen
er allerede gemt af `persistSetLog` højere oppe i funktionen — upåvirket),
og der logges en linje til `frontend_errors` (samme tabel som
`ErrorBoundary.jsx` allerede bruger).

**F7-bug:** `saveReadiness` viste `setReadinessError(error.message)` — den
rå Supabase-fejlbesked, direkte til atleten.

**F7-fix:** Oversat til én sætning ("Kunne ikke gemme parathed. Tjek din
forbindelse og prøv igen."), detaljen logges til `frontend_errors`.

En lille delt hjælpefunktion, `logFrontendError(message, error, athleteId)`,
blev tilføjet i `AthleteView.jsx` til begge steder — samme mønster som
`ErrorBoundary.jsx`, ingen ny mekanik, bare genbrug af den eksisterende
tabel.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler,
  urørt af denne ordre).
- `npm run gate:tracker` — GRØN (trackeren er urørt).
- `node --test src/*.test.js` — 45/45 grønne, heraf 4 nye i
  `athleteWriteGuard.test.js` (én pr. rettet sted: F4, F5, F6, F7), hver
  med et "fejl fra Supabase giver besked og uændret tilstand"-tjek.
- `verify:athlete-write-failures` (udvidet) — bekræfter i selve kildeteksten
  at alle fire steder rent faktisk går gennem `runGuardedWrite`/
  `logFrontendError`, og at tilstandsændringer (`fetchExerciseLogs`,
  `setAthlete`) kun sker efter et bekræftet svar. Måtte udvide
  udtræknings-hjælperen (`extractFnBalanced`) fordi `markGoodAndSave` er
  defineret dybt inde i JSX (anden indrykning end de øvrige funktioner).
- `verify:athlete-training-inputs`, `verify:progression-state` — grønne
  (urørte områder, kørt som sikkerhedstjek fordi de deler fil).
- **Headless (Node, ingen browser):** kørte `runGuardedWrite` direkte med
  en simuleret netværksfejl på skipSet-mønsteret og printede tilstanden
  før/efter:
  ```
  FØR forsøg:
    exerciseLogs: [{"id":"log-77","exercise_id":"ex-1","set_number":2,"skipped":false}]
    flash: null

  EFTER forsøg (skrivningen fejlede):
    ok: false
    exerciseLogs: [{"id":"log-77","exercise_id":"ex-1","set_number":2,"skipped":false}] (uændret — matcher FØR)
    flash: Sættet kunne ikke springes over. Tjek din forbindelse og prøv igen. (atleten ser besked i stedet for tavs fejl)
  ```

## Hvad står stadig under stregen (ordre 41's fundliste, afsnit 3-6), rangeret

Rangeret efter hyppighed × pris, som i ordre 41. **Fed** = mest oplagt for
en næste ordre.

1. **F11+F12 er allerede rettet** (ordre 41, fix #2) — nævnes ikke igen.
2. **G2 — `undoDelete` (Fortryd efter slettet måltidslogning) har samme
   uskærmede mønster som F1/F2/F4-F7, men blev ikke fanget af nogen af de
   to runder endnu.** Samme fil, samme funktionsfamilie som `deleteLog`
   (allerede rettet). Ærlig udeladelse i ordre 41's egen ordlyd — billigst
   at rette først, fordi det er præcis samme `runGuardedWrite`-mønster som
   lige er brugt fire gange i denne ordre.
3. **G3 — "Spring resten over", "Auto-udfyld" og "Gem feedback" (session-
   niveau i Program-fanen) mangler også fejl/pending-visning.** Samme
   familie som F4 (lige rettet), lavere frekvens (én gang pr. session, ikke
   pr. sæt). Naturlig fortsættelse af denne ordres arbejde.
4. **F13/F14/F15/F16 — resterende tommelfinger-fund under 44px** (kostsøgnings-"+",
   redigér/slet-ikoner, kontomenuens "⋯", mobilitetens "✕"). Lavere
   frekvens end den allerede rettede sæt-logger, men samme kategori.
5. **F17/F18 — jargon uden forklaring** ("TDEE" uden info-knap, de to
   beskedspor uforklarede). Moderat frekvens, lav-moderat pris.
6. **F21/F22 — stille i uge 2** (skjult TDEE-trend, parathed uden
   udviklingsfeedback). F22 er den mest daglige handling i appen uden nogen
   feedback tilbage — svagt fund, men høj frekvens.
7. **F26 — "Glemt adgangskode?"-linket er selv en lille tekstlink uden
   `minHeight`.** Lav frekvens, lav pris, men en efterladt uskarphed i egen
   tidligere rettelse (F25, allerede over stregen).
8. **G5-G13 (mobilitetstimere ved låst skærm, ingen log ud-bekræftelse,
   flere små trykflader, manglende "send bekræftelseslink igen")** — se
   ordre 41's fulde liste for detaljer. Ingen af dem er rangeret over G2/G3
   i denne vurdering.

## Ærlige grænser

- **Ingen levende Supabase-test af de fire rettelser.** Al verifikation er
  statisk kildelæsning (`verify-athlete-write-failures.mjs`) og hermetiske
  enhedstests af `runGuardedWrite`-mønsteret (`athleteWriteGuard.test.js`)
  — ingen af dem kører den faktiske React-komponent mod en rigtig eller
  mocket Supabase-klient, fordi der ikke findes en render-baseret
  test-infrastruktur i dette repo (samme begrænsning som ordre 41's
  verifikation af F1/F2).
- **`logFrontendError` er best-effort og utestet mod den rigtige
  `frontend_errors`-tabel.** Den fejler stille internt (`try/catch`, ingen
  `await`) med samme begrundelse som `ErrorBoundary.jsx` — logning må aldrig
  vælte visningen — men det betyder også at et evt. skema-mismatch
  (kolonnenavne) først opdages i produktion, ikke her.
- **G2/G3 er IKKE rettet i denne ordre** — kun kortlagt og rangeret øverst
  til en næste runde, som ordren bad om.

## Betydning for Hara

Under "Appen mærkbart bedre": fire yderligere steder hvor atleten/coachen
nu får besked i stedet for en tavs, misvisende skærm — samme klasse fund
som F1/F2 (ordre 41), som var den første konkrete forbedring under dette
delmål. Stævnemaks og PR-baseline rammer sjældnere, men med høj pris når de
rammer (falsk stævnetal, forkert baseline-data for coachen).

## Hvad er næste

- G2 (`undoDelete`) og G3 (session-niveau skip/auto-fill/feedback) — samme
  `runGuardedWrite`-mønster, direkte fortsættelse af denne ordre.
- Resten af afsnit 3-6 (tommelfinger, jargon, stille uge 2, selvbetjening)
  efter Marcs prioritering — ingen af dem har samme akutte "stille fejl"-
  karakter som F1-F7/G2/G3.

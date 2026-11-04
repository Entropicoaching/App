# Datagrundlag pr. atlet og uge

Ny, isoleret coachsektion. Ingen import i eksisterende skærme, hooks, netværk,
lagring eller ændring af featureflag. Kun `enabled === true` giver et resultat.
OFF læser hverken kilder, atlet eller dato. Eksisterende OFF-adfærd er urørt.

```js
import Datagrundlag from './tracking/kvalitet/Datagrundlag.mjs'
// En senere integration kontrollerer adgang og henter et komplet snapshot.
createElement(Datagrundlag, {
  enabled: entropi2Enabled,
  athleteId: selectedAthlete.id, // athletes.id, aldrig user_id
  asOf: '2026-11-04',
  sources: {
    training: { athleteId: selectedAthlete.id, state: 'ready', complete: true, rows: exerciseLogs },
    nutrition: { athleteId: selectedAthlete.id, state: 'ready', complete: true, rows: mealLogs },
    weight: { athleteId: selectedAthlete.id, state: 'ready', complete: true, rows: weightLogs },
    readiness: { athleteId: selectedAthlete.id, state: 'ready', complete: true, rows: readinessLogs },
  },
})
```

`weeklyDataBasis(options)` er den rene model med samme argumenter. Den returnerer
`null` ved OFF, `{ state: 'invalid', weeks: [] }` ved ugyldig identitet/dato,
ellers `{ state: 'ready', athleteId, asOf, weeks }`. Ingen implicit systemdato.
`asOf` er en gyldig YYYY-MM-DD, inklusive hele dagen. Fire mandag-søndag-uger,
ældst først. Datoer tæt på kalenderens repræsentationsgrænser afvises.
Indeværende uge opgøres kun til `asOf`; fremtidige dage bliver ikke manglende.
Dagens tal kan fortsat ændres. Træningstidsstempler bliver danske kalenderdatoer
via det eksisterende `load.mjs`; øvrige kilder bruger allerede kalenderdatoer.

Kilder skal have `athleteId` svarende til valgt `athletes.id`. Hver rå række skal
også have præcis samme `athlete_id`; manglende ID og `user_id` afvises. Kalderen
skal hente de kolonner og sikre coachens adgang. Det er ikke en adgangskontrol
at kunne kalde en ren JavaScript-funktion.

`state` er `ready`, `missing`, `loading`, `error` eller `partial`. Ready kræver
`rows` som array og `complete: true`: kalderens udtrykkelige garanti for en fuld,
fejlfri, upagineret læsning fra første viste mandag til og med `asOf`.
Et stale snapshot eller et fejlet refresh må ikke leveres som ready. Udeladt
kilde bliver missing; ukendt state/fejlagtig struktur eller kildeidentitet bliver
invalid. Ikke-ready-kilder undersøger ikke rækker og får null i alle optællinger
og datolister. Ingen nul eller mangelliste udledes af en fejlet læsning.

Pr. uge: `weekStart`, `weekEnd`, `through`, `elapsedDays`, `partial` og `domains`.
Pr. domæne: `state`, `recordedDays`, `valueDays`, `missingDays`, `invalidDays`.
De sidste to er sorterede datoarrays ved ready. `recordedDays` tæller hver dato
én gang; `invalidDays` er de registrerede dage uden værdigrundlag.

- Træning: `load.mjs` ejer datoer, deduplikering, konflikter, fravalgte sæt og
  tonnage. Dato med tilbageholdt sæt tæller; tonnage null giver intet
  værdigrundlag. Manglende mål kan derfor stadig give en registreret dag.
- Kost: `nutritionTrend.mjs` ejer måltidskvitteringer og validering. Én eller
  flere måltider giver en dag; kendte kcal OG protein giver værdigrundlag.
  Én måltidsregistrering dokumenterer ikke en hel kostdag. Nul er en kendt værdi.
- Vægt: kalenderdateret log giver en dag, og en gyldig positiv vægt accepteret
  af `weightTrend.mjs` giver værdigrundlag. Flere målinger tæller én dato.
- Dagsform: `logged_date` og numerisk `readiness_score` i [0,100]. Identiske
  scores samme dato tæller én dag; modstridende eller ugyldige scores giver
  intet værdigrundlag. Der kopieres ingen noter eller særlige private felter.

Optimistiske rækker udelades i alle domæner. Ugyldige/udaterede, fremtidige og
andre atleters rækker tæller ikke. Træningskonflikter ekskluderes som i load og
står derfor som uden tilbageholdt registrering. En manglende træningsdag kan
være hvile; modellen har ingen plan og må ikke bruges til compliance.
Værdigrundlag beskriver kun tilstedeværende værdier. Det godkender hverken
signaler, fuldstændige registreringer eller sammenlignelighed. Eksisterende
moduler og signalproducenter ejer fortsat deres minimum og øvrige kvalitetskrav.

Visningen har fire responsive ugekort. Antal er synlige; datoer foldes ud med
native details/summary. Ingen samlet score, trafiklys eller anbefalinger.
De automatiske prøver opdages af den eksisterende `npm test`-scanner.
Fokuseret kørsel uden installation:

```text
node --test --test-concurrency=1 src/entropi2/tracking/kvalitet/weeklyDataBasis.test.mjs src/entropi2/tracking/kvalitet/Datagrundlag.test.mjs
```

Prøver importerer faktiske kopierede moduler. Kun Reacts createElement erstattes
for den konkrete visningsimport af en syntetisk host-træ-fixture; den bruges
aldrig i appen. Træprøver er ikke ReactDOM-, skærmlæser-, browser- eller visuel
layoutverifikation. Fuld suite og build køres af Dhurva ved fletning.

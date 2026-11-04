# Coachens lokale 4-ugers eksport

Koblet til coachens Analyse-fane umiddelbart under Ugeevaluering og før de
øvrige analyseværktøjer. Den lille disclosure-knap "Eksportér 4 uger (CSV/JSON)"
åbner valget Hent CSV / Hent JSON. Detaljerne er lukkede fra start.
Eksportens lazy-grænse genbruger ugeevalueringens eksisterende Entropi 2-scope;
OFF eller uoverensstemmende coach/atlet monterer ingen eksportkode.
`buildCoachMonthlyReport(snapshot, { enabled: true })` giver rapportmodellen.
`exportCoachMonthlyReport(snapshot, { enabled: true, format: 'csv' })` giver
`{ status, filename, mimeType, content }`; format kan også være `json`.
Standard/OFF returnerer `null` uden at læse snapshot eller format.

## Input og adapter

Kun ét autoriseret atlet-snapshot ad gangen, samme kontrakt som
`atlet/overview.mjs`: `status: 'ready'`, `complete: true`, `athleteId`, `endDate`
(YYYY-MM-DD, sidste afsluttede danske kalenderdag) og alle fire arrays:

- `exerciseLogs`: exercise_logs med `athlete_id`, `id`, `exercise_id`,
  `set_number`, `logged_at`, `weight`, `reps_completed`, `skipped`, `_optimistic`,
  `exercises.name` og evt. `exercises.sessions.weeks.block_name`.
- `mealRows`: `athlete_id`, `date`, `meal`, `kcal`, `protein`, `carb`, `fat`.
- `weightRows`: `athlete_id`, `logged_at` (kalenderdato), `weight`.
- `dailyRows`: `athlete_id`, `logged_date`, `source: 'athlete_manual'`,
  `sleep_hours`, `energy`, `stress`, `soreness` (0–10, aldrig legacy soreness_level).

`complete: true` skal betyde fuld læsning af alle kilder i hele perioden, også
paginering. Autorisation og coachrollen håndhæves før kaldet af den senere
adapter; funktionen er ikke en adgangskontrol. Blandede identiteter afvises
(også uden for datoafgrænsningen); `user_id` accepteres ikke som `athlete_id`.
Hvert array må have højst 10.000 poster; sparse arrays afvises.
Ingen fritekstnoter, cyklusfelter, samtykke eller personnavne projiceres til output.
Send altid kun de nødvendige offentligt definerede felter til denne funktion.

`monthlyDownload.mjs` læser først ved et udtrykkeligt formatklik. Fire kilder
læses gennem den allerede tilsluttede coach-klient med athlete_id-filter,
datoafgrænsning og deterministisk dato/id-sortering. Sider på 500 rækker læses
til en kort side beviser fuldstændighed; mere end 10.000 rækker pr. kilde,
dublerede id'er, forkert atlet eller fejl afviser hele eksporten.
Der er ingen mutationer, auth-kald eller opslag i cykluskilder.

Adapteren vælger de sidste 28 afsluttede danske kalenderdage: endDate =
ugeevalueringens asOf minus én dag. Træningens UTC-interval overhenter ved
midnat; de eksisterende modeller klipper efter dansk kalenderdato.
Søvn, energi og stress hentes fra atletens manuelle readiness_logs. source
sættes til athlete_manual i den kanoniske projektion; legacy soreness_level
omregnes ikke til modellens 0–10-skala. Ømhed forbliver ukendt.

`CoachMonthlyExport.mjs` viser loading, tom og fejl adskilt. Et tomt komplet
snapshot kan downloades med forklaring om manglende data. Fejl giver ingen fil;
formatknapperne tillader et nyt forsøg. Dobbeltklik blokeres, og resultater
fra en tidligere coach, atlet, dato, klient eller afmonteret visning downloades
ikke. Browseradapteren opretter en lokal Blob, klikker et downloadlink, fjerner
linket og frigiver objekt-URL'en i næste task. Ingen browser er kørt i workeren.

## Felter i begge formater

JSON indeholder schema `entropi-coach-monthly-export/v1`, `status`, `athleteId`,
`from`, `to`, `timeZone` og `records`. CSV indeholder samme records som en lang
tabel, én måling pr. række. Fælles kolonner:

| Kolonne | Betydning |
| --- | --- |
| record_type | daily, strength eller data_basis |
| athlete_id | Den ene valgte atlets id |
| period_from / period_to | Inklusive kalenderdatoer, Europe/Copenhagen |
| metric | training_sets, training_volume, nutrition_energy, nutrition_protein, body_weight, sleep, energy, stress, soreness eller estimated_1rm |
| exercise | Normaliseret løft/variant, kun strength |
| value | Tal; null i JSON og tom celle i CSV ved ukendt værdi |
| unit | sets, kg_reps, kcal, g, kg, hours, score_1_to_5 eller score_0_to_10 |
| observed_days / expected_days | daily: 0/1 eller 1/1 kendt dag; data_basis: kendte værdidage af 7; strength: null, ikke opdigtet evidens |
| rule | Læselig dansk forklaring af beregningsgrundlag |

Perioden er præcis 28 dage til og med endDate, fordelt på fire fortløbende
7-dages perioder. Alle 28 dage og ni daglige mål findes, også uden logning.
Data_basis har ni rækker pr. periode. Det er målingsdækning, ikke trænings-
compliance, fuldstændige kostdage eller tilstrækkeligt grundlag for et signal.
Træning angives som gennemførte sæt, ikke som antal pas (kilden beviser ikke pas).
Volumen er kg × udførte reps. Kost er registrerede kcal og gram protein uden
retroaktive mål. Dagsform er søvn, energi, stress og ømhed fra manuelle felter.

De faktiske load-, nutritionTrend-, weightTrend- og strengthTrend-moduler kaldes
gennem buildAthleteOverview. Sæt deduplikeres; konflikter, optimistiske og
sprungne sæt udelades. Ukendte målinger bliver ikke nul. Deload tæller i
registreret volumen, men ikke e1RM. e1RM følger appens tunge hovedløft og
adskilte varianter, Epley-formlen og højeste værdi pr. kalenderuge. Kalenderugen
klippes til eksportperioden, og kun sæt inden for de 28 dage indgår. Ingen
e1RM-række uden et kvalificerende sæt. Ingen trend-signaler eller anbefalinger.

## Tom, fejl og tegnsæt

Et komplet tomt snapshot giver `status: 'empty'` og et downloadklart dokument
med null-målinger og 0 kendte dage. Loading giver kun `status: 'loading'`.
Fejl, ufuldstændig læsning, ugyldig dato/identitet, tvetydige dags- eller
vægtregistreringer giver `status: 'error'` uden content. Ugyldige individuelle
målinger følger eksisterende moduler og forbliver ukendte/udelades.

CSV: komma, CRLF, alle celler citeret, dobbelte anførselstegn escaped, UTF-8 BOM
for danske regneark. Tal har decimalpunkt. Filnavnet indeholder kun de validerede
datoer. Formel-lignende tekstceller får apostrof foran i CSV; JSON bevarer
tekstværdien. JSON har ingen BOM. Serializerne læser aldrig rå felter via spread
eller JSON.stringify(snapshot).

## Prøver

`node --test --test-concurrency=1 src/entropi2/tracking/eksport/*.test.mjs`

Filerne opdages automatisk af den eksisterende scripts/test.mjs ved npm test.
monthlyReport-prøverne og monthlyDownload-prøverne importerer de faktiske
kopierede modeller. monthlyIntegration-prøverne importerer den faktiske
AnalyseTab og eksportkomponent gennem en udtrykkeligt syntetisk JSX/React-rig.
monthlyRealReact-prøverne bruger rigtig React og react-dom/server, når pakkerne
er tilgængelige; de markeres SKIP i den fastlåste kopi uden node_modules.
Fuld npm test, rigtig React og build er Dhurvas integrationsgate.

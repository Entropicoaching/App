# Tracking-dataordbog — Entropi Coach

Dokumentationskandidat TRACK-DATAORDBOG1. Kildegrundlag: den fastlåste offentlige
kopi af `release/entropi-samlet-neste`, revision
`97f09ca2ec5a1d3015b8c671450a31befe33072f`. Ingen skærme, datamodeller,
flag, adgangsregler eller beregninger ændres af dette dokument.

Formålet er coachens evaluering og planlægning; atleten skal kunne se et enkelt
overblik over egne indtastninger og deres datagrundlag. Nu indsamles kun atletens
egne registreringer. Eksisterende program-, profil- og coachdata beskrives som
kontekst, ikke som atletens selvrapport. Mobil- og smartwatchimport er et senere
spor. VideoCoach beskrives særskilt som eksisterende videoanalyse og må ikke
forveksles med nye sensormålinger.

## Læsenøgle og afgrænsning

**E** = observeret i den kopierede kode, **N** = nyt designforslag, ikke bygget,
**S** = senere spor, ikke bygget. Typerne er frontendkontrakten; pakken indeholder
ikke database-DDL, så SQL-typer, constraints, retention og faktisk databaseadgang
kan ikke bekræftes her. `?` betyder manglende/null tilladt i læsemodellen, ikke
bevis for en nullable databasekolonne. ID behandles som en opak nøgle, ikke som
et bestemt SQL-format. Navne efter `ny.*` er forslag, ikke eksisterende tabeller.

Hver tabel angiver felt, type/enhed, indtaster/kilde, læser, privathed/samtykke
og anvendelse. Disse koder gælder for hver række, også sammensatte feltrækker:

| Kode | Betydning |
| --- | --- |
| A | Den pågældende atlet; aldrig andre atleter. |
| C | Atletens tilknyttede coach, inden for dokumenteret ejerskab. |
| AC | A og C; atleten ser enkel egen oversigt, coachen detaljer til planlægning. Dette er produktets målgruppe, ikke bevis for at alle felter vises i begge UI'er. |
| L | Kun tilgængelig i den aktuelle browser/enhed og atletnamespace. Ingen dokumenteret modtagelse på coachens anden enhed. |
| P | Personlige trænings-/profil-/kostdata. Formål og adgang skal oplyses; ingen offentlig deling eller genbrug til andre atleter. Der er ikke påvist en generel samtykkekolonne i kildekopien. |
| H | Potentielt helbredsrelateret selvrapport, smerte, krops- eller videodata. Begrænset til coachingformålet; ingen diagnose. Adgang og behandlingsgrundlag skal afklares ved integration; feltet er ikke automatisk offentligt eller samtykkedækket. |
| X | Cyklusdata og alle afledninger: privat for A som udgangspunkt. C kun med aktuelt eksplicit, afgrænset og tilbagekaldeligt samtykke, håndhævet i databasen. Ikke implementeret her. |

AC er ikke en tilladelse til bredere læsning. Eksisterende frontendfiltre er ikke
en sikkerhedsgrænse. Ingen kolonne i dette dokument giver automatisk rettigheder.
Tabeller, der kun vedrører login, beskeder, fejltelemetri, UI-læstmarkeringer eller
automationsadministration, er ikke trackingmålinger; de må ikke blive en skjult
trackingkilde. Programbiblioteker og madbiblioteker er referenceindhold. Nedenfor
er både målinger, trackingmetadata og den kontekst, der faktisk bruges til analyse.

## Fælles identitet, tid og kvalitet

| Felt (status) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `*.id` (E, hvor læst) | ID | System; sætrække kan have klient-ID | AC | P/H som rækken | Entydighed, rettelse og deduplikering; ikke en måling. |
| `*.athlete_id` (E) | ID | System fra valgt atlet | AC | Som rækken | Ejerskab; refererer til `athletes.id`. |
| `athletes.user_id` (E) | ID? | Eksisterende kontotilknytning | System/C | P | Loginbinding; må aldrig forveksles med `athletes.id`. |
| `athletes.coach_id` (E) | ID | Eksisterende coachkontekst | System/C | P | Afgrænsning af coachens atleter. |
| `created_at`, `updated_at` (E, kun hvor observeret) | ISO-tidspunkt | System | AC | Som rækken | Oprettelse/rettelse, ikke nødvendigvis registreringsdagen. Ikke universelle kolonner. |
| `logged_date`, `date` (E) | `YYYY-MM-DD` / kalenderdag | Atlet/system i registreringsflow | AC | Som rækken | Parathed og kost grupperes på dag; ikke et UTC-tidspunkt. |
| `logged_at` (E) | Dato eller ISO-tidspunkt, afhængigt af kilden | Atletens registreringsflow/system | AC | Som rækken | Vægt-/sæt-/rekordhistorik; se de konkrete tabeller. |
| `ny.source` (N) | enum `athlete_manual` | System, ikke coachens gæt | AC | Som målingen | Proveniens for nye selvrapporter; intet wearable-input nu. |
| `ny.recorded_at`, `ny.updated_at` (N) | ISO-tidspunkt med offset | System | AC | Som målingen | Skelne registrering og rettelse fra måledag. |
| `ny.local_date`, `ny.timezone` (N) | kalenderdag, IANA-zone | Atlet bekræfter dag; system foreslår zone | AC | Som målingen | Reproducerbare dags-/ugevinduer; foreslået standard `Europe/Copenhagen`. |
| `ny.quality_state` (N) | enum `valid`, `missing`, `invalid`, `partial` | Validering | AC | Som målingen | Manglende eller fejlbehæftet læsning er ikke nul. |
| `ny.supersedes_id` (N) | ID? | System ved rettelse | AC | Som målingen | En aktuel observation pr. valgt målenøgle; revisionsspor uden dobbelttælling. |

Datoer skal være gyldige kalenderdatoer; ISO-tidspunkter skal have offset.
Konverter tidspunkt til lokal dag før aggregering. Eksisterende kode bruger både
browserens lokale dag, Copenhagen-konvertering og datostrengsslicing; dokumentet
ensretter ikke runtime. Kilde og metode skal følge en sammenligning, især ved
midnat og sommertid. Ukendt værdi, tom tekst, `NaN`, uendelighed, afkortet svar og
manglende række må ikke udlægges som en faktisk nulmåling eller manglende træning.

## Parathed og søvn — eksisterende

Kilde: `src/athlete/laesninger.js` (`fetchReadiness`, `calcReadinessScore`,
`saveReadiness`), `src/readinessInsight.js`, `src/readinessDraft.js`,
`src/dataEnough.mjs`. Gemmes i `readiness_logs`.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `readiness_logs.athlete_id` | ID | System | AC | H | Ejerafgrænsning. |
| `readiness_logs.logged_date` | kalenderdag | System: dagens dato | AC | H | Dagens log, historik, sammenlignelige dage. |
| `readiness_logs.sleep_hours` | tal? / timer | A; inputalias `sleep` | AC | H | Søvndelscore og gennemsnitlig søvn. Valgfrit; ikke nul ved manglende svar. |
| `readiness_logs.energy` | heltal 1–5 | A | AC | H | Højere er bedre; vægt 0,25. Påkrævet i gemflow. |
| `readiness_logs.motivation` | heltal 1–5 | A | AC | H | Højere er bedre; vægt 0,15. Påkrævet. |
| `readiness_logs.stress` | heltal 1–5 | A | AC | H | Højere er mere stress; inverteret, vægt 0,15. Påkrævet. |
| `readiness_logs.soreness_level` | heltal 1–5 | A; inputalias `soreness` | AC | H | Højere er mere ømhed; inverteret, vægt 0,20. Påkrævet. |
| `readiness_logs.sore_zones` | liste af tekst? | A; inputalias `soreZones` | AC | H | Ømme områder og hyppigste zone; tomt gemmes som null. Ikke et smerteintensitetsmål. |
| `readiness_logs.readiness_score` | heltal 0–100? / point | Beregnet fra selvrapport | AC | H | Personlig parathedssammenligning, lave serier og coachopsummering. Ikke en objektiv sensorværdi. |
| Lokalt parathedsudkast: `sleep`, `energy`, `motivation`, `stress`, `soreness`, `soreZones` | formularstrenge og tekstliste | A | L | H | Gendannelse under `entropi_readiness_draft:<atlet>:<dato>`; ryddes efter gemning. Ikke en gemt check-in. |

Scoren er det afrundede, klippede vægtede gennemsnit af tilgængelige delscorer.
Energi/motivation: `(v−1)/4×100`; stress/ømhed: `(5−v)/4×100`.
Positiv søvn giver 100 ved 7–9 timer, 85 ved >9–10, 80 ved 6–<7,
55 ved 5–<6, 70 ved >10 og 30 ved >0–<5. Søvn vægtes 0,25 og udelades,
hvis den ikke er positiv. Gemflowet kræver de fire skalaer; det viser ikke en
øvre søvngrænse i denne handler. En foreslået fremtidig 0–24-validering er derfor
ikke en påstand om nuværende håndhævelse.

`compareReadiness` kræver mindst fem endelige scores. Grænsen er 0,5 gange
populationens standardafvigelse; ved praktisk nul spredning bruges 3 point.
APP-DATA2 kræver desuden fem sammenlignelige tidligere kalenderdage i 14 dage;
legacy-forespørgslen henter højst 14 tidligere rækker, hvilket ikke i sig selv er
14 kalenderdage. Lav score betyder <50. APP-DATA2 bryder lave serier ved huller
og dubletter; legacy-opsummeringen tæller fra nyeste række. Coachnote inden for
9 dage efter lav score er kun tidsrækkefølge, aldrig dokumenteret årsag.

## Vægt og profilkontekst — eksisterende

Kilder: `src/athlete/beskederOgVaegt.jsx`, `src/athlete/weightTrend.mjs`,
`src/dashboard/atletHandlinger.js`, `src/entropi2/kostMaal/model.mjs`.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `weight_logs.id`, `weight_logs.athlete_id` | ID | System | AC | H | Række/ejer, rettelse af dagens vejning. |
| `weight_logs.weight` | positivt tal / kg | A | AC | H | Vægtkurve, gennemsnit, forskel og TDEE-grundlag. |
| `weight_logs.logged_at` | dato; læsere accepterer også tidsstempel | A/system, dagens vejning | AC | H | Dagsvalg og rækkefølge. KostMaal normaliserer tid til Copenhagen-dag. |
| `athletes.bodyweight` | tal? / kg | C fra profiloplysninger | AC | H | Profilreference og fallback til proteinforslag; ikke en ny dateret vejning. |
| `athletes.height` | tal? / cm i profil | C | AC | H | Krops-/profilkontekst; ikke et trackingforløb i sig selv. |
| `athletes.age` | heltal? / år | C | AC | P | Profilkontekst; ingen fødselsdato foreslås her. |
| `athletes.sex` | tekst? | C fra profil | AC | H | Profilkontekst. Må aldrig udløse antagelser om cyklus eller samtykke. |
| `athletes.weight_class` | tal? / kg | C | AC | P | Konkurrence-/vægtklassekontekst, ikke aktuel vægt. |
| `athletes.squat`, `bench`, `deadlift` | tal? / kg | C eller registreret bedre stævneresultat | AC | P | Profilens maks, SBD-total, styrkereference; kan være startoplysninger. |
| `athletes.kcal_target` | positivt heltal? / kcal pr. dag | C | AC | P | Nuværende energimål; blankt rydder til null. |
| `athletes.protein_target` | positivt heltal? / g pr. dag | C | AC | P | Nuværende proteinmål; ikke automatisk et historisk mål. |
| `athletes.goal` | tekst? | C fra atletens mål | AC | P | Planlægningskontekst, ingen score. |
| `athletes.status`, `vacation_until` | tekst, kalenderdag? | C | AC | P | Status/ferie til planlægning; ikke bevis for manglende efterlevelse. |
| `athletes.competition_date` | kalenderdag? | C | AC | P | Periodisering/stævneplanlægning. |
| `athletes.notes` | tekst? med eventuelle strukturerede markører | C | C; udvalgte atletvendte afledninger | H | Coachnoter og eksisterende hjemmeøvelseskontekst; må ikke gøres til en generel atletvendt journal. |

`weightTrendText` i legacy sammenligner seneste højst syv vejninger med de
foregående højst syv, mindst 2 mod 1; under 0,3 kg absolut forskel kaldes stabilt.
APP-DATA2 bruger to afsluttede syvdagesvinduer med mindst tre forskellige
vejningsdage i hvert. KostMaal er en anden model: indeværende syv dage inklusive
i dag mod de foregående syv, seneste vejning pr. Copenhagen-dag, mindst to dage
i hvert vindue for trend. Visningerne må ikke få samme metodelabel.
KostMaal foreslår proteininterval 1,6–2,2 g/kg, rundet til 5 g, fra aktuelt
vægtgennemsnit eller profilvægt. Forslaget er et udkast; ingen automatisk gemning.

## Kost — eksisterende

Kilder: `src/athlete/kostHandlinger.js`, `kostNumbers.mjs`, `kostSkabeloner.mjs`,
`src/mealEvidence.mjs`, `src/entropi2/coachNutritionRead.mjs`,
`src/entropi2/coach/coachNutrition.mjs`,
`src/entropi2/kostMaal/nutritionWeek.mjs`,
`src/entropi2/home/nutritionTodayModel.mjs`.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `meal_logs.id`, `athlete_id` | ID | System | AC | P | Entydighed/ejer; dubletter må ikke tælles igen. |
| `meal_logs.date` | kalenderdag | A vælger kostdag | AC | P | Dagstotaler, historik og ugevindue. |
| `meal_logs.created_at` | tidspunkt | System | AC | P | Rækkefølge i dagens log. |
| `meal_logs.meal` | tekst | A eller valgt mad/skabelon | AC | P | Beskrivelse, gen-logning; kan også indeholde dagskvitteringsmarkør. |
| `meal_logs.kcal` | ikke-negativt tal / kcal | A eller beregnet fra valgt mængde | AC | P | Energitotal, målprocent, gennemsnit og TDEE. |
| `meal_logs.protein` | ikke-negativt tal / g | A eller mængdeberegning | AC | P | Proteintotal, mål og makroenergi ×4. |
| `meal_logs.carb` | ikke-negativt tal / g | A eller mængdeberegning | A; C via relevante detaljelæsninger | P | Kulhydrattotal og makroenergi ×4; ikke med i coachens syvdageskvittering. |
| `meal_logs.fat` | ikke-negativt tal / g | A eller mængdeberegning | A; C via relevante detaljelæsninger | P | Fedttotal og makroenergi ×9. |
| Formular: `amount`, `unitIdx`, `editGrams`, `editMacros` | talstreng, indeks, talstrenge | A | A | P | Portions-/gramkonvertering og rettelse; ikke separate påviste logkolonner. |
| `meal_templates.id`, `athlete_id`, `name`, `created_at` | ID, ID, tekst, tidspunkt | A/system | A | P | Privat genbrug af måltider. |
| `meal_templates.items[]`: `meal`, `kcal`, `protein`, `carb`, `fat` | tekst og tal / kcal, g | A fra gyldige måltider | A | P | Kopieres til nye måltidsrækker på valgt dag; skabelonen er ikke indtag i sig selv. |
| `custom_foods` maddefinition: `name`, `kcal100`, `protein100`, `carb100`, `fat100` | tekst, tal / kcal og g pr. 100 g | A | A; andre ved deling af definition | P | Reference til portionsberegning; ikke atletens kosthistorik. |
| `custom_foods.unit_label`, `unit_grams` | tekst?, positivt tal? / g pr. enhed | A | Som maddefinitionen | P | Omregning fra valgt portion til gram; loggen gemmer næringsmængder for portionen. |
| `custom_foods.athlete_id`, `is_shared` | ID, bool | System/A | Ejer; delt definition ved eksplicit deling | P | Ejerskab og katalogdeling; giver ikke adgang til `meal_logs`. |
| Dagskvittering i `meal_logs.meal` | tekst med `[appData2-day-v1]` og signatur | A bekræfter tidligere dag; system serialiserer | AC | P | Komplethedsbevis mod konkret multiset af loggede måltider. Rækkens næringsværdier er 0; den er metadata. |
| `nutritionToday` snapshot: `date`, `kcal`, `protein`, `kcalTarget`, `proteinTarget` | dato og tal / kcal, g | Eksisterende valideret model | A | P | Dagens lille overblik; forkert dato eller ugyldige mål skjules. Ikke ny lagring. |

Der summeres faktiske måltider pr. dag; metadata tælles ikke som mad, næring
eller en logget dag. Ændring, tilføjelse eller sletning af et måltid ugyldiggør
en tidligere dagsbekræftelse. En logget dag er ikke nødvendigvis komplet.
Makroprocenter bygger på energi 4/4/9, mens målprocenter er total/mål, klippet
til højst 100 procent i den eksisterende visning.

KostMaal-ugelinjen kræver mindst 3 loggede dage, coachens linje mindst 4 i de
seneste 7 dage inklusive i dag. Nævneren i næringsgennemsnittet er antal
loggede dage, hverken antal måltider eller 7. Målopfyldelse i
`nutritionGoalWeek` bruger nuværende gemte mål og tæller mod 7 dage;
coachens proteinlinje bruger antal loggede dage som nævner. Ingen historisk
målopfyldelse må påstås uden dateret målhistorik.

Legacy-TDEE: gennemsnitligt registreret dagligt kcal minus
`(nyeste vægt − ældste vægt)/dage × 7700`, afrundet. Kræver mindst 7 kostdage,
2 vejninger og mindst 7 dages spænd. APP-DATA2 kræver 21 bekræftet komplette
kostdage og 3 vejninger i hver ende over mindst 21 dage; den viser ukendt
confidence. Dette er et groft estimat, ikke målt energiforbrug eller en diagnose.

## Træningslog, feedback og planreference — eksisterende

Kilder: `src/athlete/saetSkrivning.js`, `src/rpeEvidence.mjs`,
`src/athlete/ugeStatus.js`, `src/athlete/ugeFeedback.js`,
`src/athlete/rekorder.js`, `src/personalRecords.js`, `src/volume/planlagt.js`.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `exercise_logs.id`, `athlete_id`, `exercise_id` | ID | System | AC | P | Række, ejer og planøvelse; den sidste binder sættet til pas og uge. |
| `exercise_logs.set_number` | heltal / sætnummer fra 1 | System fra valgt position | AC | P | Position i plan; logisk nøgle atlet/øvelse/sætnummer. |
| `exercise_logs.logged_at` | ISO-tidspunkt | System ved første registrering | AC | P | Bevares ved forsinket afsendelse/rettelse; er ikke sync-tidspunkt. |
| `exercise_logs.weight` | tal / kg | A; kan forudfyldes fra planen | AC | P | Belastning, tonnage, rekorder og estimater. Spring over kan gemme 0. |
| `exercise_logs.reps_completed` | heltal / gentagelser | A; kan forudfyldes | AC | P | Tonnage, reps-afvigelse og rekorder. 0 ved spring over. |
| `exercise_logs.rpe_actual` | tal? / RPE 0–10 i generel logkontrakt | A eller legacy-planfallback | AC | H | Intensitetsanalyse; tallet alene beviser ikke atletens eget svar. Nogle læsere kræver 1–10. |
| `exercise_logs.rpe_planned` | tal? / planlagt RPE | System fra coachens intensitet | AC | P | Sammenligning med faktisk selvrapport, ikke en måling. |
| `exercise_logs.note` | tekst? | A; system kan vedhæfte proveniens | AC | H | Kvalitativ feedback og smertesignal; markør skjules i normal visning. |
| `exercise_logs.skipped` | bool | A vælger spring over | AC | P | Udelukkes fra gennemførte sæt, tonnage og rekordgrundlag. |
| `rpe_source` (input/læsemodel) | tekst? (`athlete` ved eget valg) | System fra eksplicit valg | AC | H | Proveniens. Ikke påvist separat gemt databasekolonne i dette flow. |
| RPE-markør i `note` | `[appData2-rpe-v1:…]` med RPE, kg, reps, tid | System | System; synlig note renses | H | APP-DATA2 verificerer eget valg mod den aktuelle række; mismatch er ukendt oprindelse. |
| `sessions.athlete_rating` | valgt ratingværdi | A efter pas | AC | H | Pasfeedback. Domænet skal læses fra det aktive UI; ikke en RPE-skala per definition. |
| `sessions.athlete_comment` | tekst? | A | AC | H | Forklaring til pasfeedback; kan også vente i lokal kø. |
| `weeks.id`, `start_date`, `week_number`, `block_name` | ID, dato?, heltal, tekst? | C | AC | P | Dateret planreference, blok og deload-kontekst. |
| `weeks.coach_note` | tekst? | C | AC | H | Forklaring/planlægning; tidsmæssig relation til check-in er ikke årsagsbevis. |
| `sessions.id`, `title`, `weekday` | ID, tekst, heltal 0–6? | C | AC | P | Pasreference og planlagt ugedag; null er fleksibelt pas. |
| `exercises.id`, `session_id`, `name` | ID, ID, tekst | C | AC | P | Øvelsesidentitet, pas og sammenlignelig løftvariant. |
| `exercises.sets` | heltal / planlagte sæt | C | AC | P | Nævner i plandækning; ikke gennemført træning. |
| `exercises.reps` | tekst/tal, interval eller frit | C | AC | P | Planlagte reps; intervallets lave ende bruges i planlagt tonnage. Frit er ukendt tonnage. |
| `exercises.intensity` | tekst med mulig RPE | C | AC | P | Planlagt intensitet; parses særskilt. |
| `exercises.recommended_weight` | tal? / kg | C | AC | P | Planlagt tonnage og afvigelse; manglende vægt gør planlagt tonnage ukendt. |
| `exercises.note` | tekst? | C | AC | P | Planinstruktion, herunder mulig pauseangivelse; ikke atletens oplevelse. |
| `personal_records.exercise_name`, `weight`, `reps`, `logged_at`, `athlete_id`, `id` | tekst, kg, heltal, tid/dato, ID, ID | System fra bekræftet log eller C ved start/stævne | AC | P | Rekordhistorik; startmaks kan være profiloplysninger, ikke observeret træningssæt. |

Tonnage er summen af kg × gennemførte reps, aldrig en sum af plan og log.
`beregnUgeDage` matcher planøvelser; fleksible pas ligger uden for faste dage.
En registrering med `skipped=true` er ikke udført træning. Komplet plan-/læsedækning
og afsluttet dateret periode kræves før efterlevelse kan fortolkes; ingen log er
ikke dokumenteret fravær. APP-DATA2 udelukker plan-/ukendt RPE som selvrapport;
vægtforslag kræver 3 sammenlignelige pas med 2 egne RPE-svar i hvert inden for
28 dage. Ugens RPE kræver 12 egne svar på 3 pas og mindst 80 procent dækning.
Estimeret 1RM og løftkurver skal vise deres faktiske metode og repetitionsgrundlag,
ikke mærkes som et udført 1RM. Ingen score må automatisk ændre atletens program.

Afledte trackingfelter er læsemodeller og ikke selvstændige indtastninger:

| Felt (E) | Type / enhed | Kilde | Ser | Privathed/samtykke | Beregning |
| --- | --- | --- | --- | --- | --- |
| `compareReadiness`: `status`, `mean`, `sd`, `diff` | enum, tal? / point | Parathedslog | AC | H | `diff` = dagens score minus historikkens gennemsnit; status under/normal/over/insufficient. |
| Parathedsopsummering: `logsCount`, `avgSleep`, `topZone`, `lowStreak` | heltal, timer?, zone/antal?, heltal | Parathedslog | AC | H | Antal logs, gennemsnit af kendt søvn, hyppigste område og lav serie; se metodeforskel ovenfor. |
| `kostMaalModel`: `average`, `trend`, `days`, `previousDays`, `latest` | kg?, kg?, antal dage, antal dage, objekt? | Vægtlog | AC | H | Dagsdeduplikerede gennemsnit; trend er aktuel minus forrige periodes gennemsnit. |
| `nutritionWeek`: `days`, `kcal`, `protein` | antal dage, kcal/dag, g/dag | Måltidslog | AC i relevante visninger | P | Næringssum divideret med loggede dage i vinduet. |
| `nutritionGoalWeek`: `kcal`, `protein`, `days` | antal målopfyldte dage?, antal?, loggede dage | Måltider og aktuelle mål | C | P | Null ved manglende mål; tolerance 1e−9 mod decimalstøj. Ikke samme type som næringssummer med samme korte feltnavn. |
| `beregnUgeDage`: `planlagtSaet`, `gennemfoertSaet`, `planlagtTonnage`, `gennemfoertTonnage`, `fuldtLogget`, `flexSessioner` | antal, antal, kg×reps?, kg×reps, bool, antal | Program og log | AC | P | Sæt og tonnage pr. dag; fuldtLogget er modellens logdækning, ikke bevis for fysiologisk belastning. |
| `summarizeWeek`: `status`, `pas`, `afvigelser`, `noter`, `rpe`, `spoergsmaal`, `automatiskProgramaendring` | tekst, lister, objekt, liste, bool false | Program og log | C | H | Beskrivende opsummering; manglende planpositioner kan ikke kompenseres af ekstra sæt i en anden øvelse. |
| `estimatedOneRepMax` / `e1rmKg` | tal / kg | Kg og reps fra kvalificeret sæt | AC | P | Epley `kg × (1 + reps/30)`; rekordfejring afrunder til hele kg. Ikke et målt maks. |
| Repsrekord | heltal / reps ved bestemt kg og øvelse | Gennemførte logs | AC | P | Bedste registrerede reps ved vægten; adskilt fra Epleyrekord, se `src/athlete/repRecords.mjs`. |
| Muskelvolumen: `uge`, `grupper[].direkte`, `grupper[].ialt`, `ukendteSaet` | ISO-uge, sætenheder, sætenheder, antal | Log, øvelseskort og eventuelle kortlægningsrettelser | C | P | `src/volume/beregn.js`: direkte/indirekte bidrag efter kortlægning, ukendte tælles særskilt. Et skøn over logget volumen, ikke målt muskelbelastning. |

Muskelvolumen grupperes efter kalenderuge for logdato, ikke `weeks.week_number`.
Kortlægningsrettelser er coachens modelinput, ikke nye udførte sæt. Nul i en
tom bucket beskriver det læste logudsnit; uden komplet læsning er det ikke bevis
for at ingen træning fandt sted. Nye målinger i parallelle E2-billetter er ikke
kendt fra denne fastlåste revision og skal indføjes efter deres faktiske kontrakt.

## Smerte og lokale markeringer — eksisterende

Kilder: `src/saetSmerte.js`, `src/athlete/smerteStop.js`,
`src/athlete/smerteRegion.js`, `src/mobilityHelped.mjs`,
`src/mobilityAdherence.mjs`, `src/offlineSetQueue.js`, `src/restPause.js`.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| Smerte i sætnote | tekst | A | AC | H | Eksisterende teksttolkning udleder kropsdel og stopper relevante vægtforslag; ikke en struktureret 0–10-måling. |
| Smerte i `sessions.athlete_comment` | tekst? | A | AC | H | Pasfeedback kan også stoppe forslag; `smerteStopAktiv` bruger 14 dages frist og dato udledt af logs eller ugens slutning. |
| Lokale `mobility-helped` og `mobility-done`: `version`, `athleteId` | heltal 1, ID | System | L | H | Format og atletnamespace; eksisterende præfikser `hara:mobility-helped:v1:` og `hara:mobility-done:v1:`. |
| Lokale `rows[].id`, `name`, `date` | øvelses-ID, tekst, dato | A markerer | L | H | Hjalp/udført på en dag; fravær af markering er ukendt udførelse. |
| Lokal hjælpsomhed/udførelse | tilstedeværelse af række, toggle | A | L | H | Egen oplevelse og aktivitetsoversigt, ikke dokumenteret behandlingseffekt. |
| Offline sætkø: `exerciseId`, `setNumber`, `payload`, `clientId` | ID, heltal, logobjekt, ID | Atletens logflow | L indtil bekræftet afsendelse | Som loggen | Forsinket gemning og idempotens; ikke en ekstra måling. |
| Offline kø-/UI-status, `_optimistic` | teknisk status/bool | System | A; C først fra modtaget data | Som loggen | Lokalt gemt, afventer, parkeret og serverbekræftet må ikke sammenblandes. |
| Pause: `startedAt`, `durationSeconds`, `label` | epoch-ms, sekunder, tekst? | System fra plan/atletens handling | L | P | Pausetimer; ingen objektiv restitutionsmåling eller wearable-data. |

Hjalp-listen beholder højst 100 rækker; udførelseslisten højst 400. Udførelses-
opsummeringen tæller forskellige dage i et 14-dagesvindue inklusive i dag.
Coachens lokale profilvisning kan kun læse den aktuelle enheds markeringer;
den beviser ikke at atletens anden enhed har sendt noget. OFF må fortsat være
uden nye læsninger eller skrivninger, og alle lokale writes skal holde sig til
det eksisterende atletnamespace. Dokumentationen tilføjer ingen writes.

## Stævneplan og resultater — eksisterende kontekst

Kilde: `src/dashboard/atletHandlinger.js`, `baselineLaesninger.js`,
`src/athlete/staevnedagPlan.mjs`.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `meet_plans.athlete_id`, `meet_type`, `updated_at` | ID, tekst, tidspunkt | C/system | AC | P | Planidentitet og konkurrencetype. |
| `meet_plans.squat1`, `squat2`, `squat3`, `bench1`, `bench2`, `bench3`, `dead1`, `dead2`, `dead3` | tal? / kg | C | AC | P | Ni planlagte forsøg; ikke udførte løft eller rekordbevis. |
| `meet_plans.notes` | tekst? | C | AC | H | Stævneinstruktioner. |
| `meet_results.athlete_id`, `id` | ID | System | AC | P | Resultatidentitet og ejer. |
| `meet_results.meet_date`, `meet_name`, `meet_type` | dato, tekst?, tekst | C | AC | P | Registreret stævnekontekst. |
| `meet_results.squat`, `bench`, `deadlift` | tal? / kg | C | AC | P | Konkurrerede løft; ikke valgt løft er null. |
| `meet_results.total` | tal? / kg | Beregnet i resultatflow | AC | P | Sum af konkurrerede løft; ikke en træningstonnage. |
| `meet_results.bodyweight` | tal? / kg | C fra stævnevejning | AC | H | Vejning til resultat; ikke automatisk ny `weight_logs`-række. |
| `meet_results.notes` | tekst? | C | AC | H | Resultatkontekst. |
| Stævnedagens lokale tjek og redigerede opvarmningsforslag | bools og sætobjekter (kg, reps, minutter før) | A/C i åben fane | Lokal visning | P | Midlertidig planhjælp; ikke persisterede udførelsesmålinger. |

## VideoCoach — eksisterende, særskilt proveniens

Kilder: `src/videoCoachSubmission.js`, `src/dashboard/baselineLaesninger.js`,
`src/videoCoachBaselineProgress.js`. Listen beskriver det eksisterende analyse-
interface; vilkårlige interne JSON-nøgler er ikke en stabil måleordbog.
En fremtidig udvidelse skal dokumentere hver ny metrik og dens enhed før brug.

| Felt (E) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `video_analyses.id`, `athlete_id`, `client_analysis_id` | ID | System fra atletens indsendelse | AC | H | Ejerskab, idempotens og match af kvittering til rigtig atlet. |
| `source_mode`, `lift`, `variation` | tekst | Optagelses-/analyseflow, atletens valg | AC | H | Metode og sammenligneligt løft; må ikke blandes på tværs af variant/metode. |
| `load_kg`, `rpe` | tal? / kg, RPE | A | AC | H | Belastningskontekst; grænsevalidering 0–1000 kg og 0–10 RPE. |
| `reps_count` | heltal 1–20 | Analyseflow | AC | H | Antal analyserede reps; ikke nødvendigvis alle reps i træningssættet. |
| `analyzed_at`, `created_at` | tidspunkt | System | AC | H | Analyse-/gemmetid; ikke nødvendigvis træningstid. |
| `status`, `analysis_state` | tekst/struktureret analysestatus | System/C efter reviewflow | AC efter relevant visning | H | Kvalitet og review; et udkast er ikke godkendt coachingfeedback. |
| `low_conf_pct`, `position_quality_pct` | tal? / procent 0–100 | Analysemotor | AC | H | Målekvalitet; ikke sandsynlighed for skade eller effekt. |
| `quality_flags`, `findings`, `athlete_feedback` | strukturerede værdier/tekst efter analysekontrakt | Motor/C | C; kun godkendt atletvendt feedback til A | H | Forbehold, observationer og review; ingen automatisk diagnose. |
| `metrics` | objekt med versionsafhængige metrikker | Motor | C; udvalgt godkendt egen visning til A | H | Kun fortolkning med kendt metrikenhed, metode og kvalitet. Ukendt nøgle afventer specifikation. |
| `metrics.<nøgle>.value`, `method`, `confidence`, `eligible_for_baseline` | tal, tekst, tal 0–1, bool | Motor | Som metrics | H | Eksisterende baselineprofil kræver endelig værdi, navngivet metode, eksplicit eligibility og confidence mindst 0,75; metrikens enhed følger nøgle/metode. |
| `bar_path.x0`, `y0`, `dx[]`, `dy[]` | numeriske billedkoordinater/deltaer | Tracker | C/analyseflow | H | Stangbane; ikke meter uden dokumenteret kalibrering. Højst 240 par deltaer i payloadvalidering. |
| `engine_version`, `tracker_version` | versionsstreng | System | AC | H | Reproducerbarhed og sammenlignelig metode. |
| `video_path` | privat objektsti? | Uploadflow | AC efter autoriseret adgang | H | Reference til video; aldrig offentlig URL eller data til generel trackingeksport. |
| `athlete_baselines_v3`: `athlete_id`, `lift`, `variation`, `metric_key`, `metric_method`, `baseline_version` | ID og tekstnøgler | Eksisterende baselineberegning | C/egen godkendt sammenligning | H | Partition af personlig reference. |
| Baseline: `median`, `mad` | tal / den pågældende metriks enhed | Beregnet | C/egen godkendt sammenligning | H | Robust center og median absolut afvigelse; ikke generelt kg eller grader. |
| Baseline: `n_analyses`, `n_reps`, `last_analyzed_at` | heltal, heltal, tidspunkt | Beregnet | C/egen godkendt sammenligning | H | Dækning og aktualitet. |
| Lokal videokø: `queued_at`, `owner_id`, `row` | tidspunkt, ID, analyseobjekt | System | L indtil modtaget | H | Genforsøg; ejer og payload kontrolleres. Køalder højst 7 dage i dette modul. |

APP-DATA2 kræver dokumenteret målegrundlag og tre gyldige reps til observations-
udkast; personlig sammenligning kræver fem godkendte referenceanalyser på tre
dage med samme metode og version. Dokumentet giver ingen tilladelse til at sende
video eller træningsfeedback til atleten; eksisterende godkendelseskrav gælder.

## Nye manuelle felter — forslag til senere implementeringsbillet

Disse felter er ikke nye krav om daglig indtastning. Introducer dem trinvist,
frivilligt og kun med klart coachformål. Ingen nye tabeller, migrationer,
indsamling eller nye skærme er leveret her. Alle N-felter bruger fælles ny
identitet, kilde, dag, tid og kvalitetsmetadata fra ovenfor.

| Felt (N) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Beregning/formål (foreslået) |
| --- | --- | --- | --- | --- | --- |
| `ny.sleep_quality` | heltal? 1–5, højere bedre | A | AC | H; valgfrit | Egen søvnoplevelse ved siden af timer; indgår ikke i eksisterende readiness_score. |
| `ny.pain.region` | kontrolleret områdenøgle? | A | AC | H; valgfrit | Adskil egentlig smerte fra ømhed; ikke udledt diagnose. |
| `ny.pain.intensity` | heltal? 0–10 | A | AC | H; 0 er et eksplicit smertefrit svar | Beskriv udvikling på samme skala; manglende svar er ikke 0. |
| `ny.pain.context`, `ny.pain.note` | enum? (`rest`, `training`, `other`), tekst? | A | AC | H; valgfrit | Sammenlign kun samme kontekst; ingen automatisk programændring. |
| `ny.body_measurement.kind` | enum `waist`, `hip`, `chest`, `upper_arm`, `thigh` | A | AC | H; valgfrit | Identificer målepunkt; ikke beregning af fedtprocent. |
| `ny.body_measurement.value` | positivt tal? / cm | A | AC | H; valgfrit | Dateret forløb pr. målepunkt. |
| `ny.body_measurement.side`, `method` | enum? venstre/højre/ikke relevant, tekst? | A | AC | H; valgfrit | Sammenlignelig protokol; ukendt metode må ikke få præcis trendfortolkning. |
| `ny.hydration_ml` | ikke-negativt heltal? / ml pr. dag | A | AC | H; valgfrit | Registreret væske, ingen automatisk væskeordination. |
| `ny.session_duration_min` | positivt tal? / minutter | A | AC | P; valgfrit | Varighed af faktisk pas; ikke lig med en åben app eller pausetimer. |
| `ny.session_rpe` | tal? 0–10 | A eksplicit efter pas | AC | H; valgfrit | Særskilt fra sættets RPE og den eksisterende rating; eventuel sessionbelastning = minutter × session-RPE, kun når begge er til stede. |
| `ny.goals.valid_from`, `valid_through`, `kcal_target`, `protein_target` | dato, dato?, heltal? / kcal og g pr. dag | C | AC | P | Dateret målhistorik før historisk målopfyldelse; må ikke tilbagedatere nuværende mål stiltiende. |

## Cyklus og samtykke — nyt, privat som standard

Dette spor følger trackingbeslutningen fra 3. november 2026 kl. 20:43. Ingen
cykluskolonner eller databasehåndhævelse er påvist i den leverede kildekopi.
Registrering skal kunne fravælges helt. Coachen skal hverken se værdier,
tilstedeværelsesindikatorer eller afledte cyklussignaler uden gyldigt samtykke.

| Felt (N) | Type / enhed | Indtaster/kilde | Ser | Privathed/samtykke | Beregning/formål (foreslået) |
| --- | --- | --- | --- | --- | --- |
| `ny.cycle.local_date`, `athlete_id`, `id` | dato, ID, ID | A/system | A; C med X | X | Én selvrapport pr. dag og ejer; ingen automatisk cyklusantagelse. |
| `ny.cycle.bleeding` | enum? `none`, `spotting`, `light`, `medium`, `heavy` | A | A; C med X | X; frivilligt | Selvrapporteret blødning; null er ubesvaret, ikke `none`. |
| `ny.cycle.period_start` | bool? | A | A; C med X | X | Eksplicit startmarkering; må ikke gætttes fra blødningsgrad. |
| `ny.cycle.symptoms` | liste af valgte symptomnøgler? | A | A; C med X | X | Eget overblik; ingen diagnose eller skjult berigelse. |
| `ny.cycle.note` | tekst? | A | A; C med X | X | Frivillig forklaring; må ikke kopieres ind i almindelige coachnoter/alarmer. |
| `ny.cycle.cycle_day` | positivt heltal? / dage | Afledt fra A-bekræftet start | A; C med X | X også efter afledning | Dag 1 er bekræftet start; ukendt uden start. Ikke hormonfase eller ægløsning. |
| `ny.cycle_consent.athlete_id`, `coach_id` | ID | A vælger modtager; system binder ejer | A og konkret modtager for egen tilladelse | X | Tilladelsen gælder én relation; en ny coach arver den ikke. |
| `ny.cycle_consent.scope` | eksplicit sæt felter og formål | A bekræfter | A/C inden for scope | X | Adskil registrering, coachlæsning og afledninger; ingen bred standardtilladelse. |
| `ny.cycle_consent.granted_at` | tidspunkt? | System ved A's aktive handling | A/C for egen tilladelse | X | Ingen forudafkrydsning eller implicit godkendelse. |
| `ny.cycle_consent.revoked_at` | tidspunkt? | A/system | A/C for egen tilladelse | X | Tilbagetrækning stopper fremtidig coachadgang straks. |
| `ny.cycle_consent.notice_version` | versionsstreng | System fra vist tekst | A/C for egen tilladelse | X | Dokumentér hvad atleten accepterede. |

Krav til implementeringen: databasepolitikker skal kontrollere autentificeret
atlet, aktiv coachrelation, tilladt scope og ikke-tilbagekaldt samtykke ved hver
læsning. Samme krav gælder views, funktioner, eksport, alarmer, caches og
afledninger; frontendfiltrering alene er utilstrækkelig. Tilbagetrækning skal
invalidere coachvisning/cache og skjule afledte værdier. En tidligere deling kan
ikke gøres uset, men ny adgang og videre behandling må ikke fortsætte på gammelt
samtykke. Tilbagetrækning og sletning er forskellige handlinger; retention,
sletning og nødvendigt revisionsspor skal fastlægges særskilt før indsamling.
Undlad cyklus i generelle eksportfiler og coachresuméer uden særskilt kontrol.
Der må ikke beregnes fertilitet, ægløsning, hormonfase eller automatisk
træningsanbefaling ud fra disse observationer.

## Mobil og smartwatch — senere spor, ingen integration nu

| Felt (S) | Type / enhed | Fremtidig kilde | Ser | Privathed/samtykke | Mulig brug, ikke implementeret |
| --- | --- | --- | --- | --- | --- |
| `senere.steps` | ikke-negativt heltal / skridt pr. dag | Telefon/ur | AC efter særskilt opt-in | H | Aktivitetskontekst; ikke træningscompliance. |
| `senere.resting_heart_rate` | tal / slag pr. minut | Ur | AC efter særskilt opt-in | H | Personlig observation med enheds-/metodekontekst. |
| `senere.hrv`, `hrv_method` | tal / ms, metodenøgle | Ur | AC efter særskilt opt-in | H | Må ikke blandes mellem metoder, fx RMSSD og SDNN. |
| `senere.sleep_duration` | tal / minutter | Telefon/ur | AC efter særskilt opt-in | H | Separat fra atletens selvrapporterede søvntimer. |
| `senere.source_device`, `provider`, `method_version` | tekst | Importadapter | AC efter særskilt opt-in | H | Proveniens; ingen adgangstokens i måleobjekter. |
| `senere.external_record_id`, `observed_at`, `imported_at`, `timezone` | opak ID, tid, tid, zone | Importadapter | System/egen kontekst | H | Dubletkontrol, måletid kontra importtid og dagsgrænser. |

Ingen importer, baggrundslæsninger eller nye sensortilladelser følger af denne
ordbog. En senere billet skal fastlægge separat samtykke, normalisering,
deduplikering og datakvalitet. Import må ikke overskrive manuelle registreringer.

## Analyse- og visningskontrakt

Coachens overblik skal vise periode, kilde, enhed, antal gyldige observationer,
metode og læsedækning før en konklusion. Atletens enkle overblik kan vise seneste
egen registrering og en neutral sammenligning, men skal stadig vise manglende
grundlag og forskellen på lokalt gemt og modtaget. Nye felter må ikke indgå i
eksisterende scores uden en særskilt versionsændring og valideret metode.

`coachNutrition` er en midlertidig læsekvittering, ikke en ny trackingtabel:

| Felt (E) | Type / enhed | Kilde | Ser | Privathed/samtykke | Brug |
| --- | --- | --- | --- | --- | --- |
| `coachId`, `athleteIds`, `day` | ID, ID-liste, dato | Indfanget læsekontekst | C | P | Svar må kun bruges til samme coach, roster og dag. |
| `from`, `through` | datoer | System, dag minus 6 til dag | C | P | Præcist syvdagesvindue. |
| `state`, `complete` | `ready`/`partial`/`error`, bool | Læseresultat | C | P | Kun komplette, aktuelle svar bruges. Cap 1000 på enten mål eller måltider giver partial. |
| `rows`, `targets` | lister med ovenstående måltids-/målfelter | Eksisterende læser | C | P | Må ikke udvides til andre atleter eller andre datakilder. |

Ved ny implementering skal et afledt resultat have inputreferencer, metodeversion,
periode og kvalitetsstatus. Retning og korrelation er ikke årsag; selvrapport er
ikke en medicinsk måling. Cyklusklassifikation X skal følge enhver afledning.
Databaseadgang, retention, samtykke og målemetoder er integrationsgates, der skal
verificeres i den efterfølgende billet; dette dokument hævder ikke at de er live.

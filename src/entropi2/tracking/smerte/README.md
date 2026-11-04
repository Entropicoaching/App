# Smertehistorik til coachen

Coachens atletfane Oversigt viser kun den lukkede fold
`Smerte pr. område (4-8 uger)`, når der er gyldige, indtastede
smerteobservationer med kropsområde. Placering: efter dagens parathed,
før resultatkortene. Standard er seks kalenderuger inklusive i dag (4–8 støttes).

## Eksisterende data, ingen ekstra tabel

`src/dashboard/laesninger.js::fetchAthleteReadiness` læser allerede de seneste
90 `readiness_logs` for den valgte `athletes.id`, nyeste dato først, med `select('*')`.
Oversigt giver samme `athleteReadiness` videre som `readiness`. `painRead.mjs`
projicerer kun `athlete_id`, `logged_date`, eventuel `source`, `pain` og
`pain_location`. Der er ingen ekstra forespørgsel, klientimport, lagring eller effekt.
Den tidligere læsning af `tracking_daily_v1` er fjernet helt.

Den kopierede atletskriver `src/athlete/laesninger.js::saveReadiness` gemmer
`soreness_level` (1–5) og `sore_zones`, men ingen `pain` eller `pain_location`.
De eksisterende ømhedsdata er ikke smerte og konverteres aldrig. Derfor viser
koblingen med disse nuværende data ingen fold, loadingtekst eller fejl.
Produktionsdata er ikke tilgået; vurderingen bygger på den fastlåste kildekode.

Kun hvis readiness-rækker faktisk har heltallig `pain` 0–10 og et ikke-tomt
`pain_location`, kan de indgå i områdehistorikken. En eksplicit 0 med område
er en observation; 0 uden område etablerer ikke smertefrihed for alle områder.
Positiv smerte uden område, ugyldige tal, dubletdatoer, fremmede atleter eller
en eksplicit kilde forskellig fra `athlete_manual` skjuler den valgfrie kobling.
Kilden må mangle på eksisterende manuelle check-ins.

Manglende/utilgængelige data giver ingen valgfri sektion. En manglende relation
(42P01/PGRST205/404) kan ikke udløse en ny læsefejl her: koblingen læser slet
ingen tabel. Den eksisterende loader giver `[]`, når den ikke har data.
Der foretages ingen migration eller ny indtastning i denne leverance.

## Afgrænsning og model

Alle nye indgange kræver bogstaveligt `enabled: true`. OFF læser ikke scope
eller readiness. Fanen kontrollerer flag og datagrundlag før lazy-importen.
`CoachPainHistory` kræver coach-id; eksisterende autorisation/RLS afgør fortsat
adgang. Fremmede readiness-rækker afvises, også under atletskift.
Komponenten har kun synkrone props: ingen cache, ventende svar eller state fra
forrige atlet, coach eller dag. Ingen cyklusfelter eller metadata projiceres.

Snapshotkontrakten er den eksisterende seneste-90-læsning, ikke et nyt kald med
eksakt count. Rækkerne valideres som unikke kalenderdatoer. Et fuldt 90-rækkers
snapshot skal nå vinduets start; ellers vises intet. Normale 90 unikke dage
dækker de højst 56 viste kalenderdage. `buildPainHistory` modtager et valideret
snapshot med `{state:'ready', complete:true, athleteId, asOf, daily}`.

`painModel.mjs` og de eksisterende evidensregler er uændrede: 7+ markerer mindst
én observation ≥7; stigende tendens kræver middelstigning på mindst 2 point
og mindst 3 observationer i hvert af de seneste to 14-dagesvinduer for området.
Huller er ukendte, aldrig 0. Ugehistorik er foldet, og flag viser dato/talgrundlag.
Flag er samtaleanledninger, ikke diagnoser eller automatisk træningsændring.

`PainHistory` er den eksisterende selvstændige indholdsvisning og bevarer sine
loading-/fejltilstande. Coachkoblingen monterer den kun ved gyldige områdedata.

## Prøver

`painRead.test.mjs` importerer den faktiske projektion med syntetiske readiness-rækker.
`painCoach.test.mjs` importerer den faktiske Oversigt-fane, lazy-factory,
coachkomponent og indhold med en snæver syntetisk elementprobe.
Den probe er ikke React eller DOM. `painReact.test.mjs` kræver ægte
React/react-dom, springer ikke over og prøver også hele readiness-til-coach-flowet.
Ingen prøve kræver browser, server eller database.

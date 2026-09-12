# Dommen over de tretten `react-hooks/exhaustive-deps`-advarsler

ORDRE 138 · commit 1. Ingen rettelser i dette dokument — kun undersøgelse og dom.
Metode: for hver advarsel er det undersøgt (1) hvad effekten reelt synkroniserer,
(2) hvor den manglende værdi kommer fra, og (3) om der findes et konkret scenarie
hvor den nuværende kode viser forældede data ("skift atlet hurtigt to gange" er
brugt som lakmustest hvor det er relevant). Retningslinjen er React-dokumentationens
"Removing Effect Dependencies" og "Separating Events from Effects": en reaktiv værdi
der læses i effekten skal med i deps, medmindre koden omskrives så den ikke længere
læser den; kun stabile/parameter-rene værdier eller effekter der reelt er
event-handlere kan undtages.

Domme:
- **(a) reel risiko** — kan give forældede data i et konkret scenarie.
- **(b) bevidst udeladt og harmløst** — den manglende værdi er enten allerede
  dækket af en anden dependency (blot i en anden form, fx et bart objekt vs.
  `?.id`), eller er en funktion hvis eneste input er dens parametre.
- **(c) bør omskrives** — effekten er reelt en event-handler.

## AthleteView.jsx

| # | Fil:linje | Hvad effekten gør | Hvad mangler | Dom |
|---|---|---|---|---|
| 1 | AthleteView.jsx:1921 | Genindsætter/gemmer parathedsudkastet i localStorage pr. atlet+dato, når `readinessInput` eller `athlete?.id` ændres. | `athlete` (helt objekt) — koden læser `!athlete` og `athlete.id` flere steder, men deps har kun `athlete?.id`. | **(b)** `athlete?.id` er allerede den eneste reaktive del effekten bruger (alle brug er `.id` eller en null-tjek); det er den `!athlete`-formulerede null-tjek der er en *anden* afhængighed end `athlete?.id` i ESLints øjne. Ingen forældet-data-scenarie: AthleteView genmonteres altid ved atlet-skift (coach-preview skifter branch i App.jsx; egen-visning har kun én atlet), så der er intet "skift atlet hurtigt to gange"-forløb at teste imod. Rettes ved at gøre null-tjekket til `!athlete?.id`, uden at røre de eksisterende `athlete.id`-kald (som `verify:athlete-readiness-draft` matcher ordret). |
| 2 | AthleteView.jsx:2173 | `fetchAthlete()` ved mount — henter atletens rækker og sætter al initial state. | `fetchAthlete` (funktionsreference, gendannes hver render). | **(b)** Skal kun køre én gang ved mount. `fetchAthlete` læser `coachAthleteId`, `role`, `session` — alle tre er faste for AthleteView-instansens levetid (jf. App.jsx: et nyt preview eller rolleskift giver et helt nyt mount, aldrig en prop-opdatering på samme instans). At tilføje `fetchAthlete` til deps ville køre hele hentningen igen ved hver render (funktionen er ikke `useCallback`). |
| 3 | AthleteView.jsx:2187 | Henter dagens kostlog når `kostDate` eller `athlete?.id` ændres. | `athlete` (bart objekt, samme mønster som #1) og `fetchLogs` (funktion). | **(b)** `fetchLogs(athleteId, date)` er ren ift. sine parametre — ingen closure over andet state — og begge faktiske input (`athlete.id`, `kostDate`) er allerede i deps. Bart `athlete`-tjek er samme ESLint-teknikalitet som #1. |
| 4 | AthleteView.jsx:2191 | Henter beskeder/markerer spor som set/henter delte målinger når `tab`, `athlete?.id` eller `msgTrack` ændres. | `athlete` (bart), `fetchAthleteMessages`, `markTrackRead`. | **(b)** Begge funktioner kaldes synkront inde i selve effekt-kørslen — de bruger `athlete`/`msgTrack` fra PRÆCIS den render der udløste kørslen (samme closure), aldrig en ældre. `markTrackRead` har sin egen `if (!athlete) return`, men det er *dens* interne null-tjek, ikke effektens — kan ikke rettes fra kaldestedet. Intet forældet-data-scenarie: se #1 (ingen live atlet-skift i denne komponent). |
| 5 | AthleteView.jsx:2193 | Henter stævneplan + stævneresultater når `tab` eller `athlete?.id` ændres. | `athlete` (bart), `fetchMeetPlan`, `fetchMeetResults`. | **(b)** Samme begrundelse som #3 — begge funktioner er rene ift. `athleteId`-parameteren, som allerede er dækket af `athlete?.id`. |
| 6 | AthleteView.jsx:2208 | Auto-detekterer opvarmningsfokus (squat/bænk/dødløft) ud fra ugens program, første gang brugeren rammer fokus-fasen. | `warmupFocus`, `warmupPhase` (begge kun brugt som vagt-betingelser: `warmupPhase === 'focus' && !warmupFocus`). | **(b)** Guardet er bevidst: skal kun forsøge auto-detektion når `tab`/`currentWeek`/`mobilityMode` ændres — IKKE hver gang selve seedingen sætter `warmupFocus` (ville give en ekstra, unødvendig kørsel, ikke forkert data). "Tilbage"-knappen (linje 5866-5867) nulstiller altid `warmupPhase` og `warmupFocus` sammen, så et nyt forsøg på fokusvalg sker manuelt uden auto-forslag anden gang — det er tilsigtet UX, ikke en bug. |

## Dashboard.jsx

| # | Fil:linje | Hvad effekten gør | Hvad mangler | Dom |
|---|---|---|---|---|
| 7 | Dashboard.jsx:597 | `fetchAthletes(); fetchExerciseLibrary(); fetchLastBackup()` ved mount af Dashboard. | `fetchAthletes`, `fetchLastBackup` (funktioner). | **(b)** Skal kun køre én gang ved mount (som #2). `fetchLastBackup` læser `session.user.id`, som er fast for Dashboard-instansens levetid — et brugerskift går altid via `<Auth/>`-grenen i App.jsx og giver et nyt mount, aldrig en prop-opdatering på samme instans. |
| 8 | Dashboard.jsx:626 | Henter uger + logs når `activeTab` er program/analyse/log og der er en valgt atlet. | `selectedAthlete` (bart, samme mønster som AthleteView #1/#3). | **(b)** `fetchWeeks`/`fetchAthleteLogs` tager kun `athleteId`, allerede dækket af `selectedAthlete?.id`. |
| 9 | Dashboard.jsx:633 | Henter beskeder + markerer spor som set når `activeTab`/`selectedAthlete?.id`/`coachMsgTrack` ændres. | `selectedAthlete` (bart), `markMessagesRead`. | **(b)** `markMessagesRead` læser `athletes`-listen (til badge-optælling), men bruger den fra SAMME render som effekt-kørslen — aldrig en ældre liste. `fetchMessages` (ikke flagget) har sin egen ref-baseret stale-guard (`messageThreadAthleteRef`) og er allerede immun over for hurtige atlet-skift. Testet mod "skift atlet hurtigt to gange": ingen forkert visning, fordi id'et sendes eksplicit som parameter ved hvert kald. |
| 10 | Dashboard.jsx:644 | Henter vægt/parathed/PR/stævneresultater når `activeTab` er oversigt/analyse/hub. | `selectedAthlete` (bart). | **(b)** Samme mønster som #8 — alle kaldte funktioner er rene ift. `athleteId`. |
| 11 | Dashboard.jsx:650 | Henter VideoCoach-historik når `activeTab` er hub/analyse. | `selectedAthlete` (bart). | **(b)** Samme mønster som #8. |
| 12 | Dashboard.jsx:678 | Henter opvarmningsskabeloner når `activeTab` er opvarmning. | `selectedAthlete` (bart). | **(b)** Samme mønster som #8. |
| 13 | Dashboard.jsx:686 | Henter stævneplan/-resultater/PR når `activeTab` er stævne. | `selectedAthlete` (bart). | **(b)** Samme mønster som #8. |

## Opsummering

Alle 13 lander på **(b)**: ingen af dem viste sig ved undersøgelse at kunne give
forældede data i et konkret scenarie, og ingen af dem er reelt en event-handler
klædt ud som effekt. Det ændrer ikke på at de var værd at undersøge — begrundelsen
i hver række er beviset, ikke en påstand. Ni af de tretten rettes i commit 2 ved at
gøre koden konsekvent (`athlete?.id`/`selectedAthlete?.id` i stedet for et bart
objekt-tjek, som ESLint korrekt ser som en anden afhængighed) uden nogen
`eslint-disable`; resten får en `eslint-disable-next-line` med den begrundelse der
står i tabellen ovenfor.

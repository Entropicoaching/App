# Rapport — Ordre 266: coachens side af atletens klip

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`coachens-side`, forgrenet fra `main` (`3d29a13`, ordre 262 merget). Tre commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `75eb812` | Kompakt måling i atletlisten |
| 2 | `3bd8491` | "Ny måling fra et sæt" i Coach Briefing |
| 3 | `75d68ce` | e2e + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push, ingen migration, ingen
ny tabel, ingen ny afhængighed, ingen ændring af `public/videocoach.html`.
Ingen atletdata i filer eller i denne rapport. Vaidyas område (ordre 267,
`src/AthleteView.jsx`) er urørt.

## Hvad ændret

I atletlisten (coachens forside) viser hver atlet nu, ud over ugen/blokken,
en kompakt linje hvis der findes en allerede SPORET video-måling for hende
— antal reps, gennemsnitlig vandret afvigelse i cm, gennemsnitlig tid pr.
rep og stangbanen som et lille SVG-billede (`videoCoachMeasurementSummary`
i `src/Dashboard.jsx`, samme kolonner AnalyseTabs "Gennemgå måling" allerede
læser: `reps_count`, `rep_details`, `metrics.bar_drift_cm`, `bar_path` —
selectet i `fetchVideoReviewQueue` er udvidet til at hente dem, ingen ny
forespørgsel). Ét klik på linjen genbruger den eksisterende
`openCoachPriorityItem`-vej (samme kode et klik på en video i Coach
Briefing allerede bruger) og åbner enten videocoach til sporing eller den
eksisterende reviewvisning, uændret. Coach Briefings prioritetskø
(`buildCoachPriorityItems`, uændret selv) får desuden sin ordlyd justeret
for atlet-indsendte videoer: `coachVideoPriorityDetail` skriver nu "Ny
måling fra et sæt · [løft] · [variation]" i stedet for det generiske
"Afventer sporing", når `source_mode === 'athlete_submission'` —
"siden sidste kig" er den eksisterende `status='draft'`-afgrænsning
(forsvinder fra køen når videoen analyseres/deles), ingen ny "set"-tilstand,
ingen mail, ingen notifikation, som Marcs valg fra 13. sep foreskriver.

Den vigtigste opdagelse under arbejdet, uddybet under "Ærlige grænser":
ordre 262's "Film et sæt" sender i dag KUN video-filen, løft, variation,
belastning, RPE og kalibrerings-årsag til Supabase når atleten trykker
Gem — ikke de tal hun selv ser på skærmen (antal reps, cm-afvigelse,
tid pr. rep). `reps_count`/`rep_details`/`metrics`/`bar_path` forbliver
derfor database-default `null` for netop disse rækker, indtil nogen (i
dag: kun coachen, via videocoach) rent faktisk kører sporingen. Kortet
denne ordre bygger virker fuldt ud for enhver video der ER sporet — det
viser bare intet for en "Film et sæt"-video FØR det sker, fordi der ikke
er noget gemt at vise endnu.

## Testresultat

- `npm run lint`: rent.
- `npm run build`: grøn (218ms).
- `npm run proever`: **64/64 grønne**, 0 fejl, 0 sprunget over (én
  mellemliggende kørsel viste 2 kendte, load-følsomme e2e-fejl —
  `athlete-film-et-saet.mjs` og `coach-sporing-rigtigt-klip.mjs`, begge
  tunge browser-sporingsprøver — som var grønne både isoleret og i den
  efterfølgende fulde kørsel; ingen sammenhæng med denne ordres
  ændringer, ingen af dem rører kode denne ordre har ændret).
- Ny `e2e/coach-ser-maaling.mjs` (`npm run e2e:coach-ser-maaling`, ~2,5s,
  tilføjet til `npm run proever`): seeder en færdig-sporet, atlet-indsendt
  video (`MEASURED_VIDEO_ID`, egen fixture adskilt fra den eksisterende
  `ANALYZED_VIDEO_ID` for ikke at ændre `video-review.spec.mjs`s seed) og
  beviser med rigtige klik mod den ægte app: atletlisten viser "3 reps ·
  Ø 2.4 cm sidelæns · Ø 2.1s/rep" uden noget klik, Coach Briefings
  forhåndsvisning viser "Ny måling fra et sæt · Squat", og ét klik på
  målingen åbner den eksisterende "Gennemgå måling"-dialog (scoperet til
  selve dialogen, da AnalyseTab mountet bagved har sin egen knap med
  samme tekst). Ingen browser-fejl.

## Hvad er næste

1. **Den reelle værdi af denne ordre låses op af en separat, lille
   udvidelse**: at "Film et sæt"s Gem-knap sender de tal atleten allerede
   ser (`instantRepDriftCm`, reps, tid pr. fase) med i
   `vcAthleteUploadAndGo`-kaldet, gemt i `session_context` (samme mønster
   som `plate_calibration` fra ordre 262 · commit 3 — ingen migration).
   Kræver at røre `public/videocoach.html`, som denne ordre eksplicit
   holdt urørt. Uden den udvidelse viser kortet her intet for en
   "Film et sæt"-video før coachen selv har sporet den én gang — præcis
   det ordrens "Hvorfor" beskriver som problemet.
2. `metrics.bar_drift_cm` er et AGGREGERET tal for hele sættet (samlet
   vandret bevægelse), ikke pr. rep — "vandret afvigelse" i kortet er
   derfor et snit, ikke ordre 262's pr.-rep-tal. Pr.-rep-visning kræver
   punkt 1's udvidelse (rep_details har i dag ingen drift-pr-rep-felt,
   heller ikke for coach-sporede videoer).
3. Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
   bedre"): når punkt 1 er lukket, kan Marc se hvad der blev målt på
   tyve sekunder mellem to atleter uden at åbne videocoach — ordrens
   "Hvorfor". I dag virker kortet fuldt ud for videoer der allerede er
   sporet; for "Film et sæt" specifikt venter gevinsten på punkt 1.

## Ærlige grænser

- **Den centrale grænse er beskrevet ovenfor og gentages her for
  klarhedens skyld**: "Film et sæt" (ordre 262) gemmer i dag ikke
  reps/afvigelse/tid — kun video, løft, variation, belastning, RPE,
  kalibrerings-årsag. Denne ordre kunne ikke lukke det hul uden at røre
  `public/videocoach.html`, hvilket ordren eksplicit forbød i commit 1
  ("Ingen ændring af videocoach selv"). Valgt at bygge visningslaget
  færdigt og korrekt mod de kolonner der FAKTISK bruges i dag (samme som
  AnalyseTab), fremfor at gætte på en datamodel eller bryde grænsen.
- Kortet i atletlisten viser kun ÉN måling pr. atlet — den nyeste sporede
  video i `videoReviewQueue` (kun kladder, `status='draft'`, loft 50
  rækker samlet på tværs af alle atleter). En atlet med mere end 50
  andre atleters videoer foran sig i køen kunne teoretisk mangle et kort
  — ikke undersøgt om det reelt sker i praksis (loftet er sat af den
  eksisterende `fetchVideoReviewQueue`, ikke nyt her).
- Ikke skærmbillede-verificeret på mobil (390px) specifikt for det nye
  kort i atletlisten — kun desktop-viewport i e2e-prøven.
- Den kompakte målings-knap er et `<button>` nestet inde i atlet-rækkens
  `role="button"`-div — samme (allerede eksisterende) mønster som
  "Vis igen"-knappen for skjulte atleter i samme liste, ikke noget nyt
  anti-mønster denne ordre indfører, men heller ikke rettet.

**Tre linjer til Marc:** åbner du appen, ser du nu direkte i atletlisten om
en atlet har en sporet video-måling ventende — reps, cm sidelæns, sekunder
pr. rep, og stangbanen som et lille billede. Ét klik åbner den fulde
gennemgang, som i dag. Lige nu virker det for videoer du selv har kørt
sporing på; en video atleten selv har filmet med "Film et sæt" viser
først noget her, når en kommende, lille ordre lader den sende sine tal
med — indtil da tager det dig 0 sekunder ekstra pr. allerede-sporet atlet,
og "Film et sæt"-videoer ser du som i dag, ved at åbne dem.

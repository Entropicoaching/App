# Kort — ordre 232, commit 1: hvad `src/AthleteView.jsx` indeholder

Ingen kodeændring i denne commit. `src/AthleteView.jsx` er 6.598 linjer, én
funktionskomponent (`export default function AthleteView(...)`, linje 1721),
uspaltet — i modsætning til `Dashboard.jsx`, der allerede har fire interne
`LazyBoundary`-faner (Indbakke/Analyse/Program/Volumenkort, 130/163/228).
Bundtet vejer 251,10 kB rå / 59,45 kB gzip (`npm run build`, denne ordres
egen base `ea8618e` — matcher RAPPORT-228s tal, uændret siden).

## Fanestrukturen findes allerede

Komponenten har sin egen `tab`-state (`useState('hjem')`, linje 1722) og et
`NAV_ITEMS`-array (linje 1633) med seks faner — nøjagtig den samme slags
struktur Dashboard.jsx's fane-opsplitning hænger på, bare aldrig udnyttet til
lazy-loading endnu:

| Fane (nøgle) | Label | JSX-linjer | Størrelse | Vist ved første tegning? |
|---|---|---|---|---|
| `hjem` | Hjem | 3974–4504 | ~530 linjer | JA — default-fanen, "Dagens pas" |
| `program` | Program | 4507–5283 | ~776 linjer | Nej (men ofte brugt) |
| `kost` | Kost | 5286–5713 | ~428 linjer | Nej |
| `beskeder` | Beskeder | 5716–5833 | ~118 linjer | Nej |
| `mobilisering` | Mobilitet | 5836–6245 | ~410 linjer | Nej, sjælden (opvarmning/mobilitet er en selvstændig omvej) |
| `stævnedag` | Stævne | 6248–6557 | ~310 linjer | Nej, SJÆLDNEST — kun i navigationen når `athlete.competition_date` eller `hasMeetPlan` er sat (linje 6563); de fleste atleter ser aldrig fanen |

`return (` for selve JSX'en starter først linje 3827 — alt før det
(linje 1721–3826, ~2.100 linjer) er hooks/state/effekter/handlere delt af
ALLE faner (fetch-funktioner, VideoCoach-postMessage-håndtering,
kost-/session-mutationer, ...). Linje 3827–3973 er fast opmærkning
(VideoCoach-iframe-overlay, toasts, bekræftelses-modal) der altid renderes,
uanset fane.

## De tunge, sjældne dele: mobilitet er langt den største kandidat

`MOBILITET`-fanens JSX (410 linjer) er kun toppen af isbjerget. Selve fanen
trækker på et stort statisk datatræ defineret på MODUL-niveau tidligere i
filen — INGEN af delene bruges af nogen anden fane:

- `WARMUP_BASE` (linje 600–1003, ~404 linjer) — opvarmningsøvelser pr. løft
- `WARMUP_ADDONS` (linje 1005–1288, ~284 linjer) — ekstra øvelser pr. problemområde
- `MOBILITY_AREAS` + `MOBILITY_LIBRARY` (linje 1296–1364, ~69 linjer) —
  daglig mobilitet, otte områder med øvelsesbeskrivelser
- `MOBILITY_PROBLEM_MAP`, `buildMobilityRoutine`, `liftsFromWeek`,
  `areasFromSoreZones`, `slotsFromIntake` (linje 1368–1460, ~93 linjer) —
  rene hjælpefunktioner der kun kaldes fra mobilitetsfanen
- `MobilityGuideStep` (linje 1559–1612, ~54 linjer) — trin-for-trin-guiden,
  kun brugt af mobilitetsfanen (deler `CountdownRing` med `ExerciseTimer`,
  som derimod bruges af PROGRAM-fanen og skal blive i hovedfilen)

Samlet ~1.325 linjer (**20 % af hele filen**) er mobilitets-relateret data
og logik, der aldrig rammer skærmen før atleten selv vælger "Mobilitet" i
bundnavigationen. Det gør mobilisering til den klareste "tung, sjælden"-
kandidat, af samme klasse som Volumenkortet i 228.

`STÆVNEDAG` er lettere i linjetal (310 linjer, ingen store datatabeller),
men SJÆLDNERE end mobilisering: fanen vises kun i navigationen for atleter
med stævnedato eller -plan sat — de fleste atleter ser den aldrig, og de der
gør, kun i ugerne op til et stævne.

`PROGRAM`, `KOST` og `BESKEDER` er tungere i linjetal end stævnedag men
bruges hyppigere (ugeplan, kostlog, coach-beskeder er dagligt brugte
skærme for en aktiv atlet) — kandidater til en SENERE commit, hvis
tallene fra commit 2 bærer det.

## Delt tilstand (skal blive i `AthleteView`, sendes ned som props)

Ingen af fanernes state kan flyttes ind i de nye komponenter — de læses
eller sættes af effekter/handlere i hovedfilens delte 2.100-linjers blok
(fx `warmupFocus`/`warmupSubtype` auto-detekteres af en effekt keyet på
`[tab, currentWeek, mobilityMode]`, linje 2199–2211; timer-effekten
`verify:athlete-rest-timer-drift` statisk forventer i `AthleteView.jsx`,
linje 2219–2232, keyet på `[timerActive]`). Mønsteret er derfor det samme
som `ProgramTab.jsx`/`AnalyseTab.jsx` (130/163): ren udflytning af JSX'en,
ALLE frie variable eksplicit som props, ingen ejerskabsændring.

- **Mobilitet** (kandidat 1): `mobilityMode`/`mobilityPhase`/
  `mobilityIntake`/`mobilitySlots`/`mobilityStep` + tilhørende settere,
  `warmupPhase`/`warmupFocus`/`warmupSubtype`/`warmupProblems`/
  `warmupExercises`/`warmupChoice`/`warmupStep` + tilhørende settere,
  `warmupTemplates` (læses), `timerSeconds`/`timerActive`/`timerDone` +
  settere (delt med `ExerciseTimer` i PROGRAM via samme effekt), `currentWeek`
  og `readinessLog` (læses). `s` (stilarter) og `CountdownRing` udskilles til
  en ny delt fil (`src/athleteShared.js`, samme mønster som
  `dashboardShared.js`), så både `AthleteView.jsx` (til `ExerciseTimer`) og
  den nye mobilitetsfil kan importere dem uden at trække resten af filen med.
- **Stævnedag** (kandidat 2): `athlete`/`setAthlete`, `coachAthleteId`,
  `meetType`/`setMeetType`, `meetAttempts`/`setMeetAttempts`,
  `meetPlanNotes`, `meetWarmupEditing`/`setMeetWarmupEditing`,
  `meetWarmupDraft`/`setMeetWarmupDraft`, `meetWarmupOverrides`/
  `setMeetWarmupOverrides`, `meetResults`, `hasMeetPlan` (kun læst — sættes
  af `fetchMeetPlan`, som bliver i hovedfilen; bruges også i
  navigationsfilteret, linje 6563, uden for fanen), `showFlash`,
  `runGuardedWrite` (importeres direkte i den nye fil, ikke som prop), `s`.

## Ikke rørt i denne ordre

VideoCoach-postMessage-håndteringen (linje 1937–2161) og videocoach-kortet
i HJEM-fanen (linje 4454–4502) er spredt over 10+ kaldsteder i den delte
2.100-linjers blok — samme vurdering som RAPPORT-228 gjorde for
Dashboard.jsx: for stort og risikabelt et greb til denne ordre, ikke en
"tung, sjælden del" i samme forstand (VideoCoach-kortet vises i HJEM, den
mest brugte fane). `src/Dashboard.jsx`, `src/supabase.js` og datahentningen
er Vaidyas område (ordre 231) og er ikke læst med henblik på ændring her.

## Metode

Målt bundtstørrelse via `npm run build` (Vite, samme metode som 226/228).
TTI-baseline måles i commit 1 via `npm run maal:kaeden -- 232-commit1-foer`
(samme devtools-throttling-metode som 226/228, screens: Atletliste for
coach, Dagens pas + Check-in for atlet) — se `docs/RAPPORT-232.md` for
tallene.

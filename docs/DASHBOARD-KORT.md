# Kort over coachens side, FØR opdelingen (ordre 377, blok 2)

`src/Dashboard.jsx` er 6.271 linjer: én komponent, `Dashboard({ session,
onPreviewAthlete })`. Den ejer al coach-tilstand, henter alle data, driver
VideoCoach-broen og tegner alle coachens skærme. Fire faner er allerede
lazy-moduler i `src/dashboard/` (Indbakke, Analyse, Program, Volumenkort).
Resten står inline. Kortet er skrevet efter én hel læsning (ordrens
undtagelse). Snittet nederst følger metoden fra 373
(`docs/ATHLETEVIEW-KORT.md`, `docs/RAPPORT-373.md`).

## Dele og linjeintervaller

| Linjer | Del | Afhænger af |
|---|---|---|
| 1–28 | imports (supabase, LazyBoundary, coachPriority, automationAlerts, coachBriefingSeen, coachInboxState, videoCoach*, progressionDraft, periodizationAssistant, planOverview, exerciseNames, dashboard/afvigelse, dashboardShared, weekDates) | |
| 30–48 | konstanter: `WEEKDAYS_SHORT`, `statusLabels`, `VIDEOCOACH_V3_PREFIX/URL/COLUMNS` | `VIDEOCOACH_BUILD_ID` |
| 50–178 | rene VideoCoach-hjælpere: `videoCoachBridgeConfig`, `validateVideoCoachV3Row`, `videoCoachPathPreview`, `videoCoachFeedbackDraft`, `videoCoachFeedbackPayload`, `coachVideoPriorityDetail`, `videoCoachMeasurementSummary`, `videoCoachMeasurementText` | videoCoach*-modulerne |
| 180–213 | `ic`, `HUB_SECTIONS` (JSX-ikoner), `holidayInfo`, `ferieBadgeLabel`, `ATHLETE_LOGS_LIMIT` | |
| 215–228 | de fire lazy-fabrikker (`indbakke`, `analyseTab`, `programTab`, `volumenKort`) | |
| 230–456 | `Dashboard`: al tilstand (≈150 `useState`, 12 refs) med de oprindelige kommentarer, `openVideoCoachV3` | |
| 458–471 | effekter: `isMobile` ved resize, rulleposition på listen | |
| 473–692 | **VideoCoach-broen**: tre effekter (atletliste og valgt atlet til klienterne, `message`-lytteren med ready/close/baseline-request/prior-setup-request/save-draft) | refs, `showFlash`, `fetchVideoReviewQueue`, `fetchVideoCoachHistory`, `openProfile`, settere |
| 694–803 | opstart (`fetchAthletes`, bibliotek, backup), snooze-migrering, kalender-hentning, fane-hentninger (program/log/analyse/oversigt, beskeder, parathed/PR/stævne, video, opvarmning), review-åbning, body-scroll-lås | læse-funktionerne |
| 805–841 | `refreshCoachInbox` + effekten der holder indbakken frisk (fokus, synlighed, 5 min) | læse-funktionerne |
| 843–856 | `fetchLastBackup`, `showFlash`, `askConfirm` | |
| 858–895 | program-hjælpere: `programActiveStart`, `programShownWeeks`, `gotoWeek`, `sessionLogStatus` | `weeks`, `athleteLogs` |
| 897–1198 | læsninger: `fetchAthletes`, `isoMonday`, `fetchAthleteActivityLogs`, `fetchAthleteWeekSummaries`, `fetchCalendarWeeks`, `setBlockStartDate`, `fetchCalendarProgress`, `snoozeAthlete`, `fetchProfilesLastSeen`, `fetchTodayActivity`, `fetchVideoReviewQueue`, `fetchTrainingSignals`, `fetchAutomationAlerts`, `fetchCoachBriefingSeen` | supabase, settere |
| 1200–1266 | indbakke-handlinger: `handleCoachBriefingSeen`, `handleAutomationAlert`, `handleTrainingSignal` | `showFlash` |
| 1268–1471 | `fetchWeeks`, ugeudkast/progression (`approveDraftProgressionState`, `editDraftForecast`, `setDraftForecastOverrideReason`), `addWeek`, `updateWeek`, `generateWeeksFromPlan`, `applyPeriodizationSuggestion` | |
| 1473–1564 | `createCalendarWeek`, `blockSequenceRows` (JSX), `openCalBlockBuilder`, `goToMyProfile` + tast-M-effekten | |
| 1566–1843 | program-skrivning: uge/session/øvelse (tilføj, ret, slet, flyt, kopiér), øvelsesbibliotek, `canonicalName`, `buildIntensity`, `parseIntensity`, `saveRecommendedWeight`, `copyWeek`, "Sæt datoer" | `fetchWeeks`, `askConfirm`, `showFlash` |
| 1845–1943 | beskeder: `fetchLatestMessages`, `markMessagesRead`, `fetchMessages`, `sendCoachMessage`, `togglePin`, `formatMsgTime` | |
| 1945–2166 | `fetchAthleteLogs`, `fetchVideoCoachHistory`, video-review: `reviewVideoAnalysis`, `saveVideoAnalysisFeedback`, `closeVideoAnalysisReview`, `discardVideoAnalysisFeedback`, `openAwaitingAnalysisVideo`, `openVideoAnalysisReview` | |
| 2168–2271 | vægt/parathed/PR/stævne/opvarmning: hent og gem | |
| 2273–2434 | atlet: `addAthlete`, `saveEdit`, `openMeetResult`, `saveMeetResult`, `deleteMeetResult`, `deleteAthlete` | `openProfile` |
| 2436–2841 | `downloadJSON`, **`generateAIReport`** (≈400 linjer tekstbygning) | logs, vægt, parathed, PR, stævner, bibliotek |
| 2843–2939 | `exportTraeningsdata`, `exportBackup` | `downloadJSON` |
| 2941–2993 | navigation: `openProfile`, `openPlanReview`, `startEdit` | `analyseTabFactory` |
| 2995–3135 | afledte værdier: `a`, totaler, `coachPriorityItems` (+ kø-kontekst), `videoMeasurementByAthlete`, `openCoachPriorityItem`, mail-deep-link-effekten, `currentWeight`, `weightTrend`, `lastLogPerExercise`, `repZone`, `bestLog` | |
| 3137–3270 | `weekdayPicker`, `exFormRow` (JSX-værdier til ProgramTab) | `sessionForm`, `exerciseForm`, bibliotek |
| 3272–3319 | ramme: VideoCoach-iframe, toast, bekræft-modal, mobil-CSS | |
| 3320–3459 | sidebaren (logo, menupunkter, atletliste, "Se som atlet", Værktøjer) | |
| 3461–3471 | `<main>` og topbaren | |
| 3473–3578 | mobil: bundnavigation og menu-ark | |
| 3580–3594 | Indbakken (lazy) | |
| 3596–3688 | Øvelsesbiblioteket | |
| 3690–4164 | **Kalenderen** (planoverblik, tidslinje, dato-panel, blok-bygger, kræver handling, udsatte, fuldt board) | `blockSequenceRows`, kalender-handlinger |
| 4166–4495 | **Forsiden** (hurtigknapper, "Kræver dit blik", atletlisten med afvigelse og målinger) | `coachPriorityItems`, `openCoachPriorityItem` |
| 4497–4642 | profilens hoved: tilbage/kø-kontekst, aktuel opgave, profilkort, sektions-navigation ("Mere") | `HUB_SECTIONS` |
| 4644–4706 | fane Hjem (hub) | |
| 4708–4726 | fane Analyse (lazy) | |
| 4728–4906 | fane Opvarmning | |
| 4908–5132 | fane Oversigt (sidst aktiv, parathed i dag, resultater, kostmål, næste stævne, Volumenkort) | |
| 5134–5220 | fane Kost | |
| 5222–5255 | fane Program (lazy, ≈90 props) | |
| 5257–5546 | fane Log (træningslog pr. uge, øvelsesfilter/progression) | |
| 5548–5689 | fane Stævne (plan, historik, rekorder) | |
| 5691–5711 | fane Noter | |
| 5713–5832 | fane Beskeder | |
| 5837–6075 | **Gennemgå måling** (video-review-modalen) | video-handlinger |
| 6077–6149 | Stævneresultat-modalen | |
| 6151–6255 | Ny atlet-modalen (3 trin) | |
| 6257–6271 | Fjern atlet-modalen, slut | |

## Hvem kalder hvem (det der styrer snittet)

- **Al tilstand bor i `Dashboard`.** Handlerne læser og sætter den direkte, så
  de kan ikke flyttes som rene funktioner. Samme løsning som 373:
  handler-fabrikker `lavX({ ...navne })`, der kaldes i hvert render.
- **Handlerne kalder hinanden på tværs af grupper.** `fetchWeeks` bruges af
  al program-skrivning. `showFlash`/`askConfirm` bruges overalt. `openProfile`
  bruges af broen, `addAthlete`, `openPlanReview` og `openCoachPriorityItem`.
  `fetchLatestMessages` bruges af beskederne, `refreshCoachInbox` af
  effekten. Fabrikkerne kaldes derfor i rækkefølgen læsninger → navigation →
  resten, og `showFlash`/`askConfirm` bliver stående i `Dashboard` som
  hoistede funktioner.
- **Broen er effekter med `[]`-deps.** De fanger første renders `showFlash`,
  `fetchVideoReviewQueue`, `fetchVideoCoachHistory` og `openProfile`. Som hook
  (`useVideoCoachBro(ctx)`) kaldt på effekternes plads fanger de det samme.
- **JSX-skærmene læser mange navne.** De flyttes uændret som komponenter
  med samme navne som props (`<X {...{ a, b }} />`). Listen findes af
  ESLints `no-undef`, så den gættes ikke.
- **`weekdayPicker`/`exFormRow` er JSX-værdier**, ikke komponenter. De bygges
  i render og gives til ProgramTab. De flyttes som funktioner, der returnerer
  samme element, og kaldes samme sted.
- **`blockSequenceRows`** bruges kun i kalenderen og flytter med den.

## Statiske tjek, der læser filen som tekst

Fire `verify:*` læser `src/Dashboard.jsx` som tekst:
`athlete-onboarding`, `athlete-silent-fail-visibility`,
`auth-logout-and-role-switch` og `videocoach-feedback-quality`. De skal læse
`Dashboard.jsx` + de nye moduler (fast liste, `'../x'` skrevet som `'./x'`),
ligesom `scripts/athleteViewKilde.mjs` gør for atletsiden. Kun de nye
moduler kommer på listen, ikke de ældre faner, så negative tjek (fx "Dashboard
importerer ikke AthleteSilentFailNote") ser præcis den samme kode som før.

## Foreslået snit (under `src/dashboard/`, som allerede har fanerne)

Mål: `Dashboard.jsx` under 800 linjer. Det, der bliver tilbage, er
tilstanden (≈230 linjer, der ikke kan flyttes uden at ændre ejerskab),
fabrikskaldene, de små effekter og rammen med komponent-kald.

| Nyt modul | Fra linjer | Slags |
|---|---|---|
| `coachVideoHjaelp.js` | 35–178 | rene funktioner + konstanter |
| `coachKonstanter.jsx` | 30–33, 180–213 | konstanter, `HUB_SECTIONS`, ferie-hjælpere |
| `useVideoCoachBro.js` | 473–692 | hook (broens tre effekter) |
| `laesninger.js` | 805–818, 843–846, 897–1198, 1268–1283, 1672–1675, 1845–1901, 1945–1980, 2168–2249 | fabrik |
| `navigation.js` | 1534–1550, 2941–2993, 3024–3046 | fabrik (`openProfile`, `openPlanReview`, `startEdit`, `goToMyProfile`, `openCoachPriorityItem`) |
| `indbakkeHandlinger.js` | 1200–1266, 1863–1943 | fabrik |
| `programHandlinger.js` | 858–895, 1042–1054, 1285–1491, 1528–1532, 1566–1843 | fabrik |
| `videoReviewHandlinger.js` | 1982–2166 | fabrik |
| `atletHandlinger.js` | 2227–2434, 2436–2444, 2843–2939 | fabrik |
| `aiRapport.js` | 2446–2841 | fabrik (`generateAIReport`) |
| `programFormer.jsx` | 3137–3270 | JSX-værdier (`weekdayPicker`, `exFormRow`) |
| `Overlays.jsx` | 3274–3319 | komponent |
| `Sidebar.jsx` | 3320–3459 | komponent |
| `MobilNav.jsx` | 3473–3578 | komponent |
| `BibliotekView.jsx` | 3596–3688 | komponent |
| `KalenderView.jsx` | 3690–4164 (+ `blockSequenceRows`) | komponent |
| `ForsideView.jsx` | 4166–4495 | komponent |
| `ProfilHoved.jsx` | 4497–4642 | komponent |
| `HubTab.jsx`, `OpvarmningTab.jsx`, `OversigtTab.jsx`, `KostTab.jsx`, `LogTab.jsx`, `StaevneTab.jsx`, `NoterTab.jsx`, `BeskederTab.jsx` | 4644–5832 (uden de lazy faner) | komponenter |
| `VideoReviewModal.jsx`, `StaevneResultatModal.jsx`, `NyAtletModal.jsx` | 5837–6255 | komponenter |

Faner, der i dag tegnes inline, forbliver inline i bundtet: de importeres
statisk, ikke lazy, så chunk-inddelingen og indlæsningen er uændret. Kun
flytning og import/export, `npm run build` efter hvert modul.

# Kort over `src/AthleteView.jsx` (ordre 373, blok 1: FOER flytningen)

Base `5d1486f`. Filen er 4.597 linjer. Kortet fra ordre 232 (6.598 linjer)
er forældet: siden er Program, Kost, Beskeder, Mobilitet, Stævnedag, Volumen,
Fremgang og UgensStatusKort flyttet til `src/athlete/` (lazy via
`LazyBoundary`, undtagen UgensStatusKort). Det der er tilbage er modul-niveau-
hjælpere, forsidens komponenter og selve `AthleteView`-komponenten, som ejer
AL tilstand og alle handlere og sender dem ned som props.

## Filens dele i dag (linjeintervaller)

| Linjer | Del | Art | Brugt af |
|---|---|---|---|
| 1–36 | imports (36 moduler) | | |
| 38–51 | `ATHLETE_VIDEOCOACH_PREFIX/_QUEUE_CHANGED/_URL`, `UUID_PATTERN`, `ATHLETE_VIDEOCOACH_COLUMNS` | konstanter | VideoCoach-broen, iframen, fetchAthlete (`isUuid`) |
| 53–105 | `isUuid`, `validateAthleteVideoCoachRow`, `athleteVideoPathPreview` | rene funktioner | broen (save-draft), `renderSharedFeedbackCards` |
| 108–168 | `computeActiveWeekIdx`, `weekFullyLogged`, `weekStartDate`, `fmtWeekRange` | rene funktioner | fetchProgram, forsiden, ProgramTab (props) |
| 170–171 | `WEEKDAYS_LONG/SHORT` | konstanter | WeekCalendar, forsiden, ProgramTab (props) |
| 186–276 | `WeekCalendar` | komponent | forsiden |
| 284–708 | `DagensPasCard` (egen state: preview, ret-sæt, autofyld) | komponent | forsiden |
| 723–763 | `RestPauseFooter` | komponent | forsiden |
| 767–865 | `WeeklyTonnageChart`, `E1RMChart`, `ReadinessSparkline` | komponenter (SVG) | forsiden ("Mere") |
| 867–1086 | `LOCAL_FOODS` (≈215 fødevarer) | data | `onSearchInput` (kost) |
| 1088–1173 | `NAV_ITEMS` (8 faner med SVG-ikoner) | data/JSX | bundnavigationen |
| 1175–1184 | `*Factory` for 7 lazy faner | konstanter | fanernes `LazyBoundary` |
| 1185–1189 | `parsePlannedRpe` | ren funktion | DagensPasCard, suggestNextWeight, skip*, autoComplete, ProgramTab (props) |
| 1194–1204 | `logFrontendError` | side-effekt (frontend_errors) | læse-/skrivefejl overalt |
| 1206 | `export default function AthleteView(...)` | komponent | App.jsx (lazy) |
| 1207–1424 | ≈110 `useState`/`useRef` | tilstand | alt |
| 1426–1461 | parathed: udkast-effekt + forudfyldning | effekter | |
| 1463–1712 | VideoCoach-broen: config-effekt, `message`-lytter (upload-and-go, abort, save-draft), kladdekø-flush | effekter | iframen/VideoCoach |
| 1714–1793 | opstart, afbrudt-upload, kostdato, offline-sæt, fane-hentning, opvarmnings-autodetektion, timer (G5), loadError | effekter | |
| 1800–1805 | `onReadError` | handler | alle læsninger |
| 1807–2080 | `fetchAthlete` … `fetchReadiness` (atlet, videoer, PR, stævne, volumen, fremgang, forløb, opvarmning, parathed) | læsninger | |
| 2082–2160 | `suggestNextWeight`, `calcReadinessScore`, `saveReadiness` | | |
| 2162–2412 | `fetchProgram`, `fetchWeeklyTonnage`, `fetchWeekLogs`, `openSession`, `openReadiness`, onboarding-guidens 3 handlere, `fetchPastLogs`, `fetchExerciseLogs`, `fetchLastLogs`, `fetchExerciseHistory` | program-læsning + navigation | |
| 2418–2771 | `persistSetLog`, `logSet`, `logDagensPasSet`, `flushOfflineSets`, `undoLoggedSet`, `updateLoggedSet`, `skipSet`, `skipExercise`, `unskipSet`, `saveFeedback` | sæt-skrivning | DagensPasCard, ProgramTab |
| 2773–2875 | vægt (`fetchWeightLogs`, `logWeight`), beskeder (`fetchAthleteMessages`, `markTrackRead`, `markVideoSeen`, `sendAthleteMessage`, `formatMsgTime`) | | forsiden, BeskederTab |
| 2879–2931 | `renderSharedFeedbackCards` | render-funktion | forsiden, BeskederTab |
| 2933–3351 | kost: 20 handlere (`fetchLogs` … `saveEditLog`), plus `autoCompleteSession`, `skipRemainingSets`, `deleteLog`, `showFlash`, `askConfirm`, `undoDelete` | | KostTab, ProgramTab |
| 3353–3397 | kost-tal (tot*, pct, makro-cirkel, `tdeeEstimate`), datotekster, ferie | afledte værdier | KostTab, forsiden |
| 3399–3445 | `backBtn`, indlæser-/fejlskærm, "ikke koblet"-skærm | tidlige return | |
| 3447–3505 | `progressBars` (KostTab), `kostCompact` (forsiden) | JSX-værdier | |
| 3507–3597 | onboarding-guiden | tidligt return | |
| 3607–3630 | `toastSlot` (PR-toast + flash) | JSX-værdi | |
| 3632–3752 | ramme: VideoCoach-iframe, RPE-guide, fortryd-toast, bekræft-modal, topbar m. kontomenu | JSX | |
| 3757–4459 | HJEM-fanen: ferie, overskrift, WeekCalendar, DagensPasCard, RestPauseFooter, chips, "Mere" (ugestatus, program, parathed, coach-kort, besked, kropsvægt, rekorder, tonnage, e1RM, kost, VideoCoach, feedback) | JSX | |
| 4461–4556 | 7 `LazyBoundary`-faner med eksplicitte props | JSX | |
| 4559–4594 | bundnavigation | JSX | |

## Hvem kalder hvem (de afhængigheder der bestemmer snittet)

- `showFlash` → kaldes af næsten alle skrivninger; `onReadError` → `showFlash` +
  `logFrontendError`; alle læsninger → `onReadError`.
- `fetchAthlete` → `fetchProgram`, `fetchLogs`, `fetchReadiness` straks; kost,
  beskeder, vægt, PR, opvarmning, stævne efter `setTimeout(0)`.
- `fetchProgram` → `computeActiveWeekIdx`, `fetchWeekLogs`/`weekFullyLogged`,
  `fetchExerciseLogs`, `fetchLastLogs`, `fetchExerciseHistory`, `fetchWeeklyTonnage`.
- Sæt-skrivning → `persistSetLog` (kæde i `setWriteRef`), `fetchExerciseLogs`,
  `fetchPastLogs`, `showFlash`, PR-detektion.
- Kost → `fetchLogs`, `fetchMealTemplates`, `showFlash`, `LOCAL_FOODS`, `unitsForFood`.
- Effekter → `fetchAthlete`, `fetchLogs`, `flushOfflineSets`, `fetchSharedVideoAnalyses`,
  `fetchAthleteMessages`/`markTrackRead`, `fetchMeetPlan/Results`, `fetchVolumeLogs`,
  `fetchFremgangLogs`.

Ingen handler har egen tilstand; alle læser tilstand fra samme render
(closure). Det betyder at de kan flyttes ud som **fabrikker**
(`lavXHandlinger(ctx)` der destrukturerer præcis de samme navne og
returnerer de samme funktioner), kaldt på samme sted i hvert render: samme
closures, samme funktioner, ingen omdøbning.

## De statiske tjek låser tekst, ikke fil

17 `verify:*`-scripts læser `src/AthleteView.jsx` som tekst og matcher
regex'er på funktionskroppe (indrykning to mellemrum, `\n  }`), JSX-
fragmenter og importlinjer (`from './athleteWriteGuard'` osv.). Flyttes
koden, skal tjekket læse den nye fil. Løsning: `scripts/athleteViewKilde.mjs`
samler `AthleteView.jsx` + de nye moduler (fast liste, IKKE de ældre faner,
så tællende/negative tjek ikke får mere kode at se) og skriver
`from '../x'` som `from './x'`, så importtjekkene rammer samme modul. Selve
regex'erne ændres ikke.

## Foreslået snit (blok 2), under `src/athlete/`

| # | Modul | Indhold (flyttes uændret) |
|---|---|---|
| 1 | `videoCoachBro.js` | VideoCoach-konstanter, `isUuid`, `validateAthleteVideoCoachRow`, `athleteVideoPathPreview` |
| 2 | `ugeHjaelp.js` | `computeActiveWeekIdx`, `weekFullyLogged`, `weekStartDate`, `fmtWeekRange`, `WEEKDAYS_*`, `parsePlannedRpe`, `logFrontendError` |
| 3 | `WeekCalendar.jsx` | ugestrimlen |
| 4 | `DagensPasCard.jsx` | Dagens pas-kortet |
| 5 | `RestPauseFooter.jsx` | pauselinjen |
| 6 | `ForsideGrafer.jsx` | tonnage-, e1RM- og parathedsgraf |
| 7 | `lokaleFoedevarer.js` | `LOCAL_FOODS` |
| 8 | `NavItems.jsx` | `NAV_ITEMS` |
| 9 | `HjemTab.jsx` | HJEM-fanens JSX (ikke lazy: standardfanen) |
| 10 | `OnboardingGuide.jsx` | guideskærmen |
| 11 | `Ramme.jsx` | overlays + topbar |
| 12 | `useVideoCoachBro.js` | de tre bro-effekter som hook, kaldt på samme sted |
| 13 | `laesninger.js` | læse-fabrik (atlet, program, parathed, beskeder, vægt, stævne …) |
| 14 | `saetSkrivning.js` | sæt-skrivnings-fabrik |
| 15 | `kostHandlinger.js` | kost-fabrik + kost-tal |

Tilstanden (`useState`) og de små fane-effekter bliver i `AthleteView.jsx`:
det er dem hele filen samles om, og flyttes de, skal hvert navn gennem endnu
et lag. Om målet (< 600 linjer) nås, afhænger af hvor meget tilstanden fylder
til sidst; se RAPPORT-373.

Sikkerhedslinen: `outputs/373/foer.json` (build + lint + alle 42 verify:*),
skærmbilleder i `outputs/373/foer/` (`node outputs/373/skaermbilleder.mjs foer`,
390×844, e2e-mock + fixtures, kun syntetiske data).

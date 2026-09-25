# Kort over coachens side (efter ordre 377)

`src/Dashboard.jsx` er delt fra 6.271 til 762 linjer. Den ejer stadig AL
tilstand (`useState`/`useRef`) og kalder fabrikkerne og hooks'ene. Resten
ligger i `src/dashboard/`, ved siden af de fire faner, der i forvejen lå der
(Indbakke, Analyse, Program, Volumenkort). Intet er omskrevet: funktionskroppe
og JSX er flyttet tegn for tegn (bevis: `node outputs/377/flytte-tjek.mjs`
viser 0 linjer, der ikke er genfundet). Til en coach-ordre: skriv "Læs KUN
src/dashboard/X" ud fra tabellen nedenfor, og læs `Dashboard.jsx` kun, hvis
ordren kræver ny tilstand eller en ny prop.

## Hvor ligger hvad: "Læs KUN …"

| Ordren handler om | Læs | Linjer |
|---|---|---|
| Forsiden: hurtigknapper, "Kræver dit blik"-forhåndsvisningen, atletlisten (afvigelse, målinger, skjulte) | `dashboard/ForsideView.jsx` | 349 |
| Coach Briefing / Indbakken | `dashboard/IndbakkeView.jsx` (uændret af 377) | 215 |
| Køens rækkefølge (smerte, fravær, afvigelse, beskeder/videoer, fremgang) | `coachPriority.js` (+ `coachBriefingRules.js` for rangtabellen) | 125 |
| Køen i appen: `coachPriorityItems`, kø-kontekst, mailens deep-link | `dashboard/useCoachPrioritet.js` | 82 |
| "Set", signaler (set/udsæt), automatiseringsfejl, beskeder (læst/send/fastgør/tid) | `dashboard/indbakkeHandlinger.js` | 149 |
| Hvad der hentes (atleter, kalender, indbakke, program, logs, video, vægt, parathed, PR, stævne, opvarmning) og `refreshCoachInbox` | `dashboard/laesninger.js` | 490 |
| Hvornår der hentes: opstart, fane-hentninger, snooze-migrering, review-åbning, den friske indbakke | `dashboard/useDashboardEffekter.js` | 157 |
| Åbn profil (returadresse, kø-kontekst), planflade, "Min træning", åbn et briefing-punkt | `dashboard/navigation.js` | 117 |
| Program- og kalenderskrivning: uger/sessioner/øvelser, ugeudkast/progression, blokplan, datoer, udsæt, øvelsesbibliotek | `dashboard/programHandlinger.js` | 595 |
| Program-fanen (tegning) | `dashboard/ProgramTab.jsx` (uændret af 377) + `WeekdayPicker.jsx`, `ExFormRow.jsx` | 1.015 + 26 + 124 |
| Kalenderen (planoverblik, tidslinje, blok-bygger, kræver handling, board) | `dashboard/KalenderView.jsx` + `BlockSequenceRows.jsx` | 486 + 40 |
| Øvelsesbiblioteket | `dashboard/BibliotekView.jsx` | 101 |
| Profilens hoved: tilbage/kø, aktuel opgave, profilkort, fane-navigation ("Mere") | `dashboard/ProfilHoved.jsx` (+ `hubSektioner.jsx`) | 159 + 19 |
| Profilfanerne Hjem, Oversigt, Kost, Log, Opvarmning, Stævne, Noter, Beskeder | `dashboard/<Fane>Tab.jsx` (`HubTab`, `OversigtTab`, `KostTab`, `LogTab`, `OpvarmningTab`, `StaevneTab`, `NoterTab`, `BeskederTab`) | 31–296 |
| Aktuel kropsvægt/trend, `bestLog` | `dashboard/profilTal.js` | 64 |
| Analyse-fanen / videoer | `dashboard/AnalyseTab.jsx` (uændret af 377) | 1.050 |
| "Gennemgå måling": tegning / handlinger | `dashboard/VideoReviewModal.jsx` / `dashboard/videoReviewHandlinger.js` | 254 / 206 |
| VideoCoach-broen (iframe, save-draft, baseline/opsætning) | `dashboard/useVideoCoachBro.js` + `dashboard/coachVideoHjaelp.js` | 242 + 159 |
| AI-rapporten | `dashboard/aiRapport.js` | 413 |
| Opret/ret/fjern atlet, stævneplan og -resultat, opvarmning gem, eksport/backup | `dashboard/atletHandlinger.js` | 331 |
| Modalerne Ny atlet / Stævneresultat | `dashboard/NyAtletModal.jsx` / `dashboard/StaevneResultatModal.jsx` | 113 / 80 |
| Sidebaren, mobilens bundnav og menu-ark | `dashboard/Sidebar.jsx` / `dashboard/MobilNav.jsx` | 160 / 123 |
| VideoCoach-iframe, toast, bekræft-modal | `dashboard/Overlays.jsx` | 60 |
| Konstanter (`statusLabels`, ugedage, ferie-hjælpere, `ATHLETE_LOGS_LIMIT`) | `dashboard/coachKonstanter.js` | 30 |

## Hvad der er tilbage i `Dashboard.jsx` (762 linjer)

| Linjer | Del |
|---|---|
| 1–57 | imports, de fire lazy-fabrikker |
| 58–286 | `Dashboard`: al tilstand og alle refs (med de oprindelige kommentarer), `openVideoCoachV3` |
| 288–381 | de ni fabrikskald (`lavLaesninger`, `lavNavigation`, `lavIndbakkeHandlinger`, `lavVideoReviewHandlinger`, `lavAtletHandlinger`, `lavAiRapport`, `lavProgramHandlinger`, `lavProfilTal`) |
| 383–461 | effekter i den oprindelige rækkefølge: resize, rulleposition, `useVideoCoachBro`, `useDashboardEffekter`, `showFlash`, `askConfirm`, `blockSequenceRows`, tast-M |
| 462–489 | `a`, totaler, `useCoachPrioritet`, `weekdayPicker`, `exFormRow` |
| 490–762 | rammen: `Overlays`, `Sidebar`, topbar, `MobilNav`, skærmene og fanerne med eksplicitte props, modalerne |

## Mønstrene (til den der flytter videre)

Samme tre mønstre som 373 (`docs/ATHLETEVIEW-KORT.md`):

- **Komponent med samme navne som props.** Listen er fundet af ESLints
  `no-undef`. For skærme med en betingelse (`{view === 'x' && (() => {`)
  står betingelseslinjen og slutlinjen uændret i Dashboard, og kun kroppen
  er flyttet. Blokke uden betingelse (sidebar, mobilnav, overlays,
  profilhoved) ligger uændret i et fragment (ingen DOM-ændring).
- **Handler-fabrik** `lavX({ ...navne })`, kaldt i hvert render før
  effekterne. Rækkefølgen er læsninger, navigation og så resten, fordi
  handlerne bruger hinanden. `showFlash`/`askConfirm` står i Dashboard som
  hoistede funktioner.
- **Hook på effekternes gamle plads** (`useVideoCoachBro`,
  `useDashboardEffekter`, `useCoachPrioritet`), så effekternes rækkefølge er
  uændret.

## Statiske tjek

Fire `verify:*` læser coachens side som tekst (`athlete-onboarding`,
`athlete-silent-fail-visibility`, `auth-logout-role-switch`,
`videocoach-feedback-quality`). De læser `scripts/dashboardKilde.mjs`:
`Dashboard.jsx` + modulerne ovenfor (fast liste, ikke de ældre faner), med
`'../x'` skrevet som `'./x'`. **Flytter du kode til en ny fil under
`src/dashboard/`, så føj filen til listen dér.** Listen bruges også af
`outputs/377/flytte-tjek.mjs`.

## Lint

Efter opdelingen kan React Compiler-reglerne analysere `Dashboard`, ligesom
det skete for `AthleteView` i 373. De melder mønstre, der fandtes i forvejen:
ref-objekter givet til fabrikkerne (én `refs`-blok), `initialCoachEntryRef`
læst i render (2), `showFlash`/`askConfirm` givet som props (1) og
`Date.now()` i render (2 × `purity`). I de nye hooks kan `exhaustive-deps`
ikke se, at refs og fabrikkernes funktioner opfører sig som før (10). I alt 16 nye direktiver. Alle er
undertrykt linje for linje med en begrundelse. Compileren kører ikke i build.

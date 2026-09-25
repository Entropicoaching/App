# Kort over atletens visning (efter ordre 373)

`src/AthleteView.jsx` er delt fra 4.597 til 593 linjer. Den ejer stadig AL
tilstand (`useState`/`useRef`) og de små fane-effekter; resten ligger i
`src/athlete/`. Intet er omskrevet: funktionskroppe og JSX er flyttet tegn for
tegn (bevis: `node outputs/373/flytte-tjek.mjs` → 0 linjer der ikke er
genfundet). Til en app-ordre: skriv "Læs KUN src/athlete/X" ud fra tabellen
nedenfor, og læs `AthleteView.jsx` kun hvis ordren kræver ny tilstand eller en
ny prop.

## Hvor ligger hvad: "Læs KUN …"

| Ordren handler om | Læs | Linjer |
|---|---|---|
| Dagens pas-kortet (næste sæt, +/−, Godkendt, ret/fortryd sæt) | `athlete/DagensPasCard.jsx` | 444 |
| Forsidens overskrift, ugestrimmel, chips, "Mere", parathedskort, kropsvægt, rekorder, VideoCoach-kort, feedback-kort på forsiden | `athlete/HjemTab.jsx` | 736 |
| Ugestrimlen alene | `athlete/WeekCalendar.jsx` | 109 |
| Pauselinjen nederst | `athlete/RestPauseFooter.jsx` | 62 |
| Forsidens grafer (tonnage, e1RM, parathed-sparkline) | `athlete/ForsideGrafer.jsx` | 106 |
| Hvad der sker når et sæt logges/rettes/springes over, offline-kø, PR-detektion, udfyld/spring resten over | `athlete/saetSkrivning.js` | 470 |
| Hvad der hentes (atlet, program, sæt-logs, historik, parathed, PR, stævne, volumen, fremgang, forløb, opvarmning, delte videoer), parathed-gem, vægtforslag, openSession/openReadiness, onboarding-handlere | `athlete/laesninger.js` | 640 |
| Kost-handlere og kostfanens tal (totaler, makro-cirkel, TDEE) | `athlete/kostHandlinger.js` | 386 |
| Kost-kortene (forsidens kostlinje, Kost-fanens kalorie/protein-kort) | `athlete/KostKort.jsx` | 71 |
| Kropsvægt, beskeder (hent/læst/send/tid), coachens delte videofeedback-kort | `athlete/beskederOgVaegt.jsx` | 183 |
| VideoCoach-broen på atletsiden (upload-and-go, abort, save-draft, kladdekø, G16-varsel) | `athlete/useVideoCoachBro.js` + `athlete/videoCoachBro.js` | 294 + 77 |
| Parathedsudkast (G12) og forudfyldning fra sidste check-in | `athlete/useParathedUdkast.js` | 52 |
| Topbar, kontomenu, VideoCoach-iframe, RPE-guide, fortryd-toast, bekræft-modal | `athlete/Ramme.jsx` | 133 |
| Bundnavigationen / fanerne i den | `athlete/BundNav.jsx` + `athlete/NavItems.jsx` | 50 + 91 |
| PR-toast / flash-besked | `athlete/ToastPlads.jsx` | 34 |
| Onboarding-guiden | `athlete/OnboardingGuide.jsx` | 101 |
| "Ikke koblet til en atletprofil"-skærmen / indlæser-skærmen | `athlete/IkkeKoblet.jsx` / `athlete/Indlaeser.jsx` | 37 / 19 |
| Uge-/datohjælpere, `parsePlannedRpe`, `logFrontendError` | `athlete/ugeHjaelp.js` | 93 |
| Den indbyggede fødevareliste | `athlete/lokaleFoedevarer.js` | 226 |
| Program, Kost, Beskeder, Mobilitet, Stævne, Volumen, Fremgang (fanerne) | `athlete/<Fane>Tab.jsx` (uændret af 373) | |

## Hvad der er tilbage i `AthleteView.jsx` (593 linjer)

| Linjer | Del |
|---|---|
| 1–35 | imports, de 7 lazy-fabrikker |
| 36–249 | `AthleteView`: al tilstand og alle refs (med de oprindelige kommentarer), `handleRecheckRole` |
| 251–319 | `onReadError`, de fire handler-fabrikker (`lavBeskederOgVaegt`, `lavKostHandlinger`, `lavLaesninger`, `lavSaetSkrivning`), `showFlash`, `askConfirm` |
| 321–399 | hooks og effekter i den oprindelige rækkefølge: parathedsudkast, VideoCoach-broen, opstart, G16, kostdato, offline-sæt, delte videoer, fane-hentning, opvarmnings-autodetektion, timer (G5), loadError |
| 401–457 | datotekster, ferie, `backBtn`, tidlige returns (indlæser, ikke koblet, onboarding), `progressBars`/`kostCompact`/`toastSlot` |
| 459–593 | rammen: `Ramme`, toast, `HjemTab`, de 7 `LazyBoundary`-faner med eksplicitte props, `BundNav` |

## Mønstrene (til den der flytter videre)

- **Komponent med samme navne som props.** JSX'en er flyttet uændret; alle frie
  navne kommer ind som props med samme navn (`<HjemTab {...{ a, b }} />`).
  Listen er fundet af ESLints `no-undef`, så intet navn er gættet.
- **Handler-fabrik.** `lavX({ ...tilstand })` destrukturerer præcis de navne
  funktionerne brugte og returnerer funktionerne. AthleteView kalder den i
  hvert render, altså samme closures som da funktionerne stod i komponenten.
  Fabrikkerne er ikke hooks. Kaldene står før effekterne, så ingen effekt
  nævner et navn der erklæres senere.
- **Hook på effektens gamle plads.** De flyttede effekter (`useVideoCoachBro`,
  `useAfbrudtUploadVarsel`, `useParathedUdkast`) kaldes nøjagtig hvor effekterne
  stod, så effekternes rækkefølge er uændret.

## Statiske tjek

16 `verify:*`-scripts matcher tekst i atletens visning. De læser
`scripts/athleteViewKilde.mjs`: `AthleteView.jsx` + modulerne ovenfor (fast
liste), med `from '../x'` skrevet som `from './x'`. **Flytter du kode til en
ny fil under `src/athlete/`, så føj filen til listen dér**, ellers fejler
tjekkene (det er sket én gang i 373 og blev fanget af netop dem).

## Lint

Efter opdelingen kan React Compiler-reglerne i `eslint-plugin-react-hooks` 7
analysere `AthleteView`. De så den ikke før, sandsynligvis fordi compileren
opgav komponenten. De melder mønstre der fandtes allerede: 5× setState i en
effekt og refs der gives til fabrikkerne. I hooks'ene kan exhaustive-deps
ikke se at refs/settere fra AthleteView er stabile. Alle er undertrykt linje
for linje med en begrundelse, samme mønster som `src/dashboard/AnalyseTab.jsx`.
Compileren kører ikke i build (`vite.config.js` bruger ren `react()`), så det
ændrer intet i appen.

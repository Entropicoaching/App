# Hvad jeg fravalgte (Ordre 193) — til Dhruvas næste ordre

Skrevet så Marc kan læse det uden kode. Erstatter FRAVALGT-184.md's punkt 1
(atletlistens ~5,8s TTI), som nu er præcist diagnosticeret i stedet for
blot dokumenteret som "den værste skærm". De øvrige punkter fra
FRAVALGT-184.md (#3-7) står stadig åbne, uændret — se den for dem.

## 1. Atletlistens ~5,8s TTI — nu forstået, ikke løst

**Den nøjagtige waterfall** (se `docs/VALG-193.md` for den fulde tabel):
~5,6 af de ~5,8 sekunder er en RENT SEKVENTIEL kæde FØR Dashboard.jsx
overhovedet monteres:

1. Hoved-JS-bundtet (`index-*.js`, React+Supabase-js+App.jsx, 424 KB): 2,9s
2. App.jsx's rolleopslag (`profiles?select=role`), venter på #1: 0,6s
3. Dashboard-chunken (266 KB), venter på #2 (React ved først den skal
   lazy-loade Dashboard når rollen er kendt): 2,1s

Dashboard.jsx's EGEN data-hentning (atletliste + fan-out + kalender +
indbakke) tager under 2,4 sekunder derefter, og er allerede delvist
parallel. Den er IKKE længere hovedproblemet — kæden foran den er.

- **Hvad det ville koste at rette:** ændre `App.jsx`, ikke Dashboard.jsx.
  Konkret idé (ikke afprøvet, kun skitseret): start BEGGE
  `dashboardFactory()`/`athleteViewFactory()`s `import()`-kald spekulativt,
  parallelt med rolleopslaget, i stedet for at vente på rollen først og
  KUN DEREFTER starte chunk-downloaden. Rollen er kun 'coach' eller
  'athlete' — den forkerte chunk droppes uden brug. Kunne i teorien spare
  hele fase 3's 2,1 sekunder (den ville allerede være undervejs, ikke
  vente på fase 2 er færdig). Kræver at App.jsx's lazy-loading-timing må
  røres — udtrykkeligt uden for DENNE ordres "kun forsiden (atletlisten)
  må lægges om"-grænse.
- **Hvad det ville give:** potentielt ~2 sekunder af de manglende ~3,8
  sekunder til under 2s-målet — den klart største enkeltgevinst tilbage
  i hele denne undersøgelse, større end noget Dashboard-internt greb kan
  give (afprøvet, se punkt 2 og `docs/VALG-193.md`).
- **Risiko værd at kende:** et spekulativt dobbelt-chunk-load bruger
  ekstra båndbredde/CPU på FØRSTE besøg (henter en chunk der kasseres) —
  billigt på de fleste forbindelser, men bør måles ærligt, ikke antages.

## 2. Dashboard-interne greb — kun ét gav en sikker, reel gevinst

Afprøvet (se `docs/VALG-193.md`s tabel for tal):
- Udskyd `refreshCoachInbox()`/kalender-effekternes FØRSTE kald til efter
  listens egen tegning (500ms) — INGEN TTI-gevinst, og et reelt
  bivirkningsrisiko (Indbakke-skærmen kan vise forældet data i op til
  500ms). Fravalgt.
- Slå `fetchWeeklyActivity`/`fetchAthleteLastLogs` sammen (samme
  tabel/kolonner, den ene var allerede en overmængde) — leveret i commit 2.
  Reel, sikker gevinst (38→36 netværkskald, mindre serverlast), men INGEN
  målbar TTI-gevinst — fase 6 (Dashboard's egen data-byge) var aldrig
  selv flaskehalsen.

**Konklusion:** der er ikke flere billige, TTI-flyttende greb tilbage
inden for "kun forsiden"-grænsen. Yderligere netværkskald-reduktion i
Dashboard.jsx (fx `fetchAthleteWeekSummaries` er en delmængde af
`fetchCalendarWeeks`, samme mønster som denne ordres commit 2 — men bruges
også af den GLOBALE sidebar på ALLE skærme, ikke kun forsiden, så en
fjernelse rører mere end "atletlisten" og blev derfor ikke forsøgt her)
ville reducere serverlast yderligere, men ikke rykke TTI målbart.

## 3-7. Uændrede fra FRAVALGT-184.md

- refreshCoachInbox's faneskift-dublet (tredje forsøg kræver et ægte
  performance-trace).
- calendar/list- og oversigt/analyse-fanernes redundante genhentning ved
  rent faneskift.
- Videocoach-forsidens resterende ~3,5s FCP, Logins preconnect, de tre
  harness-skærmes ægte tal — alle kræver enten sporingskode-adgang eller
  et sikkert Supabase-testmiljø, ingen af delene til rådighed her.

## Prioriteret rækkefølge til Dhruva

1. **App.jsx's sekventielle rolleopslag→chunk-kæde** (punkt 1 ovenfor) —
   den klart største resterende gevinst, kræver at grænsen udvides til at
   dække App.jsx, ikke kun Dashboard.jsx's forside.
2. Punkt 3-4 (dedup ved faneskift) — billige, lavrisiko, samme etablerede
   mønster som ordre 175's rettelse 1.
3. Punkt 5-7 — kræver infrastruktur, ikke kodearbejde.

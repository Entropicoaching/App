# Rapport — Ordre 163: appen må ikke gå i sort

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`appen-holder`, forgrenet fra `be70575` (kritikerpakke, ordre 147) — den SHA ordren
selv navngav som base. Fire commits, ét pr. del:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `d790b86` | Måling: gammel live (7efef8e) vs. faktisk live nu (be70575) |
| 2 | `39c52c3` | Fejlgrænse pr. lazy-indlæst del (LazyBoundary + lazyChunkLoad) |
| 3 | `0e73df8` | PR-hentning fejler roligt i kortet, ikke app-bred banner |
| 4 | (denne commit — se `git log -1 appen-holder`) | Koldstart-gevinster + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Vigtig rettelse til ordrens kontekst** (uddybet i `docs/RAPPORT-163-DEL1.md`):

`origin/main` og `origin/gh-pages` (den faktisk udrullede build) var allerede `be70575`
da jeg undersøgte i dag — IKKE `7efef8e` som ordren antog. De 64 commits (stille
fejl 1-5, nul-advarsler, Dashboard-opsplitning, kritikerpakke) var altså allerede
live. `git diff be70575..4fb72b2` (nuværende `main` i hovedtræet) rører ingen
`src/`-filer — kun Vaidyas e2e-output. "Live" og "nuværende main" er derfor
byte-identiske i app-koden; den sammenligning der reelt betyder noget er gammel
live (11. sep) vs. faktisk live nu.

**Del 2 — fejlgrænse pr. lazy-indlæst del**

Før: kun ÉN global `ErrorBoundary` (App.jsx). Dashboard.jsx's tre interne lazy-faner
(Indbakke/Analyse/Program) havde `Suspense` men ingen egen fejlgrænse — en
render-fejl i ÉN fane rev hele dashboardet ned til helside-"Ups"-skærmen.
`lazyWithReload.js` dækkede kun stale chunk-referencer efter en deploy (ét
helside-genload, ingen back-off).

Ny `src/LazyBoundary.jsx` erstatter dette alle fem steder appen lazy-loader
(App.jsx: Dashboard/AthleteView, Dashboard.jsx: Indbakke/Analyse/Program):
- Egen, lokal fejlgrænse pr. del med en rolig "Prøv igen"-knap der kun
  genindlæser DEN del (ikke hele siden).
- `src/lazyChunkLoad.js` (ren, enhedstestet i `lazyChunkLoad.test.js`, 6/6
  grønne): et forbigående netværksglip ved chunk-hentning prøves igen med
  back-off (lykkes typisk andet forsøg); en vedvarende stale chunk efter
  deploy falder tilbage til ét helside-genload (uændret spærre mod
  uendelig løkke).
- Fejl logges fortsat til `frontend_errors`, nu mærket med hvilken del der fejlede.

Den globale `ErrorBoundary` i App.jsx er bevaret som yderste net (ordrens
"omkring hele appen OG omkring hver lazy-indlæst del").

**Del 3 — "det kald der fejler ved åbning"**

Del 1 fandt fejlteksten Marc så: **"Personlige rekorder kunne ikke hentes. Tjek din
forbindelse og prøv igen."** — vist som en fast, rød toast øverst på HELE appen,
selvom kun ét kort ("Dine rekorder") rammes. Kaldet stoppede allerede ikke resten
af siden (`runGuardedRead`, ordre 76) — det var visningen der var for højrøstet.

`fetchPRs` i `src/AthleteView.jsx` bruger nu sin egen fejlhåndtering: en fejlet
hentning sætter `prsError` (logges fortsat) og forsøges roligt igen i baggrunden
op til 3 gange (1,5s / 3s / 4,5s), uden brugerhandling. "Dine rekorder"-kortet
viser en rolig linje ved fejl ("Rekorder kunne ikke hentes lige nu. Prøver igen i
baggrunden…") i stedet for enten en rød banner eller — hvis atleten heller ikke
har sat manuelle maks — at forsvinde helt.

`scripts/verify-athlete-read-failures.mjs` opdateret: `fetchPRs` udskilt fra den
delte "simple læsning"-skabelon (den har nu et retry-kontrolflow de andre 17 kald
ikke har) til sin egen kontrol af samme invariant plus de to nye krav.

**Del 4 — koldstart der føles som en app (billige gevinster)**

To ændringer, ingen nye afhængigheder, ingen Dashboard-omskrivning:

1. **Skelet i stedet for hvid/sort tekst** (`src/App.jsx`, `loaderScreen`): appens
   tema er næsten sort (`#141410`) i ALLE indlæsningstilstande, og "Indlæser..." i
   lav kontrast (`#4a4844`) på flere sekunders koldstart læses let som en fejl.
   Erstattet med et pulserende CSS-skelet (topbar + tre kort-konturer) — synlig
   struktur med det samme, ingen ny afhængighed.
2. **Dagens pas hentes før resten** (`src/AthleteView.jsx`, `fetchAthlete`):
   `fetchProgram` + `fetchLogs` + `fetchReadiness` (det "hjem"-standardfanen rent
   faktisk viser) hentes med det samme. De resterende ni kald (kost, beskeder,
   opvarmning, stævne — alt på faner brugeren endnu ikke har åbnet) udskydes ét
   tick (`setTimeout(0)`), så de ikke konkurrerer om de første forbindelser med
   det der faktisk skal males på skærmen.

**Tal før/efter** (build-output, samme metode som Del 1):

| Chunk | Før del 4 | Efter del 4 | Diff |
|---|---|---|---|
| `index-*.js` (hovedbundt, inkl. nyt skelet) | 423,80 KB | 424,36 KB | +0,56 KB |
| `AthleteView-*.js` | 251,02 KB | 251,04 KB | +0,02 KB |
| `Dashboard-*.js` / `ProgramTab` / `AnalyseTab` / `IndbakkeView` | uændret | uændret | 0 KB |

**Ærlig grænse (samme som `scripts/maal-app.mjs` og
`scripts/verify-athlete-reps-per-set-mobile.mjs` allerede dokumenterer i dette
repo):** "tid til første indhold" og "antal netværkskald" for selve den
AUTENTIFICEREDE koldstart kræver en levende Supabase-session for at AthleteView/
Dashboard overhovedet booter — forbudt her (ingen produktions-Supabase, ingen
atletdata). Login-siden (`/`, den eneste skærm der kan måles uden en session) er
uændret af disse to fixes (de rammer kun det der vises EFTER login), og målte i
Del 1 til 5,4s FCP på Lighthouse's simulerede langsomme mobilprofil i begge
udgaver — det tal er derfor ikke flyttet af del 4, og skulle heller ikke være det.

## Testresultat

**npm run lint:** rent gennem alle fire commits.

**Tabel fra Del 1** (fuld metode og begrundelse i `docs/RAPPORT-163-DEL1.md`):

| | 7efef8e (gammel live) | be70575 = faktisk live nu |
|---|---|---|
| Fejltekst ved fejlet PR-kald | "Personlige rekorder kunne ikke hentes. Tjek din forbindelse og prøv igen." (app-bred rød toast) | Uændret (rettet i Del 3 af DENNE ordre) |
| Resten af siden efter fejlet PR-kald | Forbliver brugbar | Uændret |
| Chunk-hentefejl efter deploy | `React.lazy()` uden retry → "Ups — noget gik galt" (helside, kræver manuel "Genindlæs") | `lazyWithReload` (ny siden 7efef8e) — ét automatisk genload (nu videreudviklet i Del 2 med back-off først) |
| Dashboard-åbningsvægt | 342 KB i ét bundt | 246 KB + 3 lazy-faner (96 KB mindre ved åbning) |
| Login FCP / LCP / Speed Index (langsom mobilprofil) | 5,4s / 5,6s / 5,4s | 5,4s / 5,6s / 5,4s (uændret — login rørt af ingen af de 64 commits) |

**Verify-scripts kørt (grønne):**
- `verify:athlete-silent-fail-visibility`
- `verify:athlete-read-failures` (opdateret for fetchPRs' nye kontrolflow)
- `verify:athlete-silent-fails-5`
- `verify:athlete-write-failures`
- `verify:athlete-first-day-flow`
- `verify:athlete-onboarding-guide`
- `node scripts/verify-athlete-identity.mjs`
- `node --test src/lazyChunkLoad.test.js` (6/6, inkl. ordrens eget testkrav:
  "en fejlende chunk-hentning prøver igen og lykkes anden gang")

**npm run e2e:** findes ikke på denne gren (`appen-holder`, forgrenet fra
`be70575`) — e2e-scriptene ligger på Vaidyas `main`-arbejde (`4fb72b2`, ordre
153+155), som ordrens Grænser-afsnit eksplicit holder mig ude af
(`e2e/`, `docs/E2E.md`, `package.json`-e2e-scripts). Ikke bygget videre på.

**Fulde verify-suite:** ikke kørt i sin helhed (30+ scripts, mange rører
videocoach/n8n-områder helt uden for denne ordre) — de scripts der rører de
filer jeg har ændret (App.jsx, Dashboard.jsx, AthleteView.jsx,
LazyBoundary.jsx/lazyChunkLoad.js) er kørt og grønne, listet ovenfor.

## Hvad er næste

- **Dashboard.jsx's egen `fetchAthletePRs`** (coachens interne profilvisning, adskilt
  fra AthleteView.jsx) har SLET ingen fejlhåndtering — hverken toast eller
  kort-notat, bare stille tomme lister. Ikke rettet her (ordren pegede specifikt
  på "det kald der fejler ved åbning", som Del 1 bekræftede er AthleteView.jsx's
  vej) — men samme mønster som Del 3 bør anvendes der i en senere ordre.
  Har betydning for Hara (mærkbart bedre-sporet): den samme "stille fejl"-klasse
  er reelt kun halvt lukket for coach-siden af appen.
- **Autentificeret koldstart-måling** (reelle sekunder/netværkskald for Dashboard/
  AthleteView, ikke kun chunk-vægt) kræver et sikkert, ikke-produktions
  Supabase-testmiljø med syntetisk data — ikke bygget her, dyrt, noteret som
  forslag frem for gættet tal.
- **`onReadError`'s app-brede toast** bruges stadig af ~15 andre læsninger i
  AthleteView.jsx (stævneplan, opvarmningsskabeloner, m.fl.) — de fleste af dem
  rammer sjældnere/mindre synlige kort end "Dine rekorder", men samme
  kort-lokale mønster kunne udrulles bredere hvis flere af dem viser sig at
  irritere i praksis.

## Ærlige grænser

- Live-vs-main-sammenligningen i Del 1 måtte omdefineres fordi ordrens antagelse
  om `origin/main = 7efef8e` var forældet på undersøgelsestidspunktet — se
  `docs/RAPPORT-163-DEL1.md` for fuld begrundelse og tidsstempler. Jeg kan ikke
  afgøre om Marcs oplevelse i dag lå før eller efter dagens deploy (kl. 13:01
  dansk tid) — det står åbent.
- En render-fejl i en lazy del der rent faktisk viser "Noget gik galt — Prøv
  igen" i stedet for en sort skærm er IKKE dækket af en automatisk DOM-test
  (repoet har intet React-testbibliotek, og ingen nye afhængigheder var
  tilladt) — kun verificeret ved kodelæsning af Reacts standard
  error boundary-kontrakt, samme grænse som den eksisterende
  `ErrorBoundary.jsx` (uden egen test) allerede har.
- Del 4's tal er build-baserede (chunk-vægt), ikke levende sekunder for den
  autentificerede app — se boundary-noten i afsnit 2. Login-siden er den eneste
  skærm der reelt kunne Lighthouse-måles uden en session, og er per definition
  urørt af disse to fixes.
- Jeg har ikke kørt den fulde `verify:*`-suite (kun de scripts der rører
  filerne jeg ændrede) — se afsnit 3 for hvilke.

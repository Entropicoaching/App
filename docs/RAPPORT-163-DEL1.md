# Ordre 163, Del 1 — hvad er sandt i de to udgaver

## Vigtig rettelse til ordrens kontekst

Ordren antager at "live" er `origin/main` = `7efef8e` (11. sep, ordre 106), og at de 64
commits fra 12.–13. sep (inkl. stille fejl 1-5/131, nul-advarsler/138,
Dashboard-opsplitning/130, kritikerpakke/147) IKKE er i den app Marc rørte i dag.

Det er ikke længere sandt på det tidspunkt jeg undersøger (13. sep, eftermiddag):

- `origin/main` er `be70575` (kritikerpakke, ordre 147) — samme commit som ordrens
  egen base for `appen-holder`.
- `origin/gh-pages` (den faktisk udrullede build) er `deploy: be70575…` — bekræftet
  via `git show origin/gh-pages -1`. Live er altså `be70575`, ikke `7efef8e`.
- Deployet skete kl. 11:01:46 UTC (13:01 dansk tid) i dag. `be70575` blev merget til
  main kl. 06:30 UTC (08:30 dansk tid) samme dag. Jeg kan ikke afgøre om Marcs
  oplevelse lå før eller efter kl. 13:01 — det står åbent.
- `git diff be70575..4fb72b2` (nuværende `main` i hovedtræet, 10 commits foran) rører
  ingen `src/`-filer — kun `outputs/e2e/*.png` og fire nye `package.json`-scripts
  (Vaidyas e2e-arbejde). App-koden i "nuværende main" og "faktisk live" er derfor
  **byte-identisk**.

Konklusion: sammenligningen der reelt betyder noget er **gammel live (7efef8e, 11.
sep) vs. faktisk live nu (be70575, = nuværende main)** — ikke "live vs. main", for de
to sidste er allerede det samme. Resten af dette afsnit bruger den sammenligning.

## Fejlteksten Marc så

"loading pr" er, bekræftet i koden (ikke gættet): den engelsksprogede formulering er
Marcs egen omskrivning af en dansk fejllinje. `src/AthleteView.jsx:2252` (uændret i
begge udgaver — funktionen fandtes allerede ved `7efef8e`):

```
showFlash(`${label} kunne ikke hentes. Tjek din forbindelse og prøv igen.`, 'error')
```

kaldt fra `fetchPRs` (linje 2330-2341) med `label = 'Personlige rekorder'` — dvs. den
tekst der reelt vises er **"Personlige rekorder kunne ikke hentes. Tjek din
forbindelse og prøv igen."** Vises som en fast, centreret, rød-kantet toast øverst på
skærmen (`position: fixed; top: 1.25rem`, z-index 10000, `#e05555`-tekst) —
`AthleteView.jsx:3883-3890`. Toasten dækker HELE appen, ikke kun kortet med
rekorder.

Dette kald rammes både når en atlet åbner sin egen profil og når Marc som coach
bruger "Min profil" (goToMyProfile → `previewMode` → `AthleteView`).

## Hvad sker der når kaldet bag fejler

| | 7efef8e (gammel live) | be70575 = nuværende main (faktisk live nu) |
|---|---|---|
| Fejlhåndtering af `personal_records`-læsning | Samme mønster fandtes allerede (`athleteReadGuard.js`, ordre 76) — `runGuardedRead` + `onReadError` → rød toast app-bredt | **Uændret** — samme kald, samme toast |
| Resten af siden efter fejlet PR-kald | Forbliver brugbar (guard'en opdaterer kun state ved succes) | **Uændret** |
| "Dine rekorder"-kortet ved fejl | Viser INTET ekstra — hvis atleten heller ikke har sat squat/bænk/dødløft-maks manuelt, forsvinder kortet helt (`if (!hasMax && !bestList.length) return null`, `AthleteView.jsx:4348`) | **Uændret** |
| Chunk-hentefejl efter en deploy (stale filnavn) | `React.lazy()` uden retry — en fejlet dynamisk import kastes op til `ErrorBoundary`, som viser "Ups — noget gik galt" (helside, ikke hvid/sort skærm, men heller ingen automatisk løsning — brugeren skal selv trykke "Genindlæs") | **`lazyWithReload` (ny siden 7efef8e)** — genkender netop denne fejltype og genindlæser siden automatisk ÉN gang, uden brugerhandling |
| Coach-dashboardets første chunk (åbningsvægt) | Ét samlet `Dashboard-*.js` på **342 KB** (ukomprimeret) | Splittet: `Dashboard-*.js` **246 KB** + `IndbakkeView` 11 KB + `AnalyseTab` 48 KB + `ProgramTab` 45 KB, kun hentet ved klik på fanen — **96 KB mindre ved åbning** |

## "Sort skærm" — mest sandsynlige forklaring

Ingen af de to udgaver viser en reel SORT skærm ved en fejlet dellæsning (PR-kaldet
stopper ikke resten af siden i nogen af udgaverne — det er allerede løst, jf.
tabellen). Den fejlende chunk-hentning efter deploy (rækken ovenfor) er det tætteste
på en ægte "hænger uden UI"-oplevelse i den GAMLE udgave, og er allerede rettet.

Det mest sandsynlige for det Marc oplevede i dag er en kombination af: appens eget
mørke tema (`#141410`, næsten sort) brugt i ALLE lastetilstande + lav kontrast
("Indlæser..." i `#4a4844` på `#141410`) + reel, målt ventetid (se nedenfor) på
flere sekunder uden nogen visuel struktur (intet skelet, ingen puls, kun tekst) —
det læses som "sort skærm", selvom appen teknisk set arbejder. Dette er uændret
mellem de to udgaver og adresseres i Del 4 (skelet i stedet for ren tekst).

## Tid fra hvid skærm til noget synligt (koldt kald, langsom mobilprofil)

Målt med Lighthouse (mobil-emulering, indbygget simuleret CPU-/netværksdrossel —
samme metode som `scripts/maal-app.mjs` allerede bruger i dette repo) mod
login-siden (`/`), da den er den ene skærm begge udgaver kan vise uden en levende
Supabase-session:

| | 7efef8e | be70575 (= nuværende main) |
|---|---|---|
| First Contentful Paint | 5,4 s | 5,4 s |
| Largest Contentful Paint | 5,6 s | 5,6 s |
| Speed Index | 5,4 s | 5,4 s |
| Netværkskald før login vises | 13 | 12 |
| Performance-score | 66 | 66 |

Login-siden er uændret mellem de to udgaver (ordre 130/131/138/147 rørte ikke
`Auth.jsx`) — tallene er identiske inden for målestøj. **5,4 sekunder til første
indhold på en langsom profil er i sig selv for langt til at føles "smooth"** —
adresseres som billig gevinst i Del 4.

Den autentificerede skal (Dashboard/AthleteView, kræver en levende session) kan ikke
måles med Lighthouse uden en ægte Supabase-forbindelse (forbudt: ingen
produktions-Supabase, ingen atletdata) — samme ærlige grænse som
`scripts/maal-app.mjs` allerede dokumenterer for sin egen metode. Chunk-vægten
ovenfor (fra faktisk build-output) er det mål vi kan give uden en session.

## Metode

- Base for "faktisk live nu": `appen-holder`-grenen selv (= `be70575`), bygget med
  `npm run build` og fiktive `VITE_SUPABASE_URL`/`VITE_SUPABASE_KEY` i
  proces-scope (ingen miljøvariabler rørt).
- Base for "gammel live": midlertidig detached `git worktree` af `7efef8e` uden for
  repoet, bygget samme måde, fjernet igen efter måling (`git worktree remove`).
- Lighthouse kørt mod begge `dist/`-mapper via en lokal statisk server og Chromium
  (samme playwright/lighthouse-runtime som `scripts/maal-app.mjs`), headless —
  ingen OS-mus brugt.

# Rapport — Ordre 167: atletens fem skærme, målt som på en telefon

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`appen-paa-telefonen`, forgrenet fra `appen-holder` (ordre 163, ikke merget endnu).
Fire commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `fcaa65f` | De fem skærme målt (før), to fund |
| 2a | `d62ebc1` | Rettelse: stop dobbelt-genindlæsning på førstegangsbesøg |
| 2b | `2c28297` | Rettelse: videocoach-forsidens skrifttype blokerer ikke render |
| 3 | (denne commit — se `git log -1 appen-paa-telefonen`) | Måling efter + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Baggrund:** ordre 163 fjernede den sorte skærm og fejlen ved åbning — det gør
appen korrekt, ikke god. Denne ordre målte oplevelsen på de fem skærme en
atlet faktisk bruger (Login, Dagens pas, Sæt-logger, Check-in,
Videocoach-forside) med Lighthouse's mobilprofil (390px, simuleret 4x CPU +
langsomt netværk, 3 løb pr. skærm, medianen brugt) og rettede de to reelle,
målbare problemer den fandt.

**Fund 1 — Login genindlæste sig selv midt i indlæsningen.** Netværksloggen
viste HVER ressource hentet to gange (415 KB hovedbundt, CSS, manifest, ikon,
`version.json`). Årsag i `src/appUpdate.js`: `self.clients.claim()` i
`public/sw.js`'s `activate`-håndtering får `controllerchange` til at fyre for
ENHVER klient der lige har registreret service workeren for FØRSTE gang, ikke
kun ved en ægte deploy-afløsning — uden en vagt genindlæste koden altså siden
for enhver bruger uden en tidligere aktiv service worker (ny bruger, ryddet
cache, privat fane — normen, ikke undtagelsen). Rettet med en
`hadController`-vagt (kun genindlæs hvis en worker ALLEREDE kontrollerede
siden før scriptet kørte). Genforsøgslogikken er udskilt til den rene,
enhedstestede `shouldReloadOnControllerChange` (`src/appUpdate.test.js`,
4/4 grønne).

**Fund 2 — Videocoach-forsidens skrifttype blokerede render.** En synkron,
ekstern `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` i
`public/videocoach.html`'s `<head>` tvang browseren til at DNS-opslå,
TLS-forbinde og hente den eksterne CSS færdig før noget som helst kunne
tegnes. Rettet med den almindelige "preload + swap"-teknik
(`media="print" onload="this.media='all'"` + `<noscript>`-fallback) — rører
kun `<head>`, ingen sporingskode. Tilføjede samtidig en manglende
`<link rel="icon">` (siden havde ingen, browseren gættede `/favicon.ico` →
404 hver gang).

**Layoutskift (CLS)** var allerede ~0 på alle fem skærme før nogen rettelse —
"reservér plads så intet hopper" var ikke et reelt problem her, så ingen tid
brugt på at fixe noget der allerede virkede.

## Testresultat

**Tabel — før/efter, alle fem skærme** (median af 3 løb, Lighthouse
mobilprofil):

| Skærm | FCP | TTI | CLS | Netværkskald før brugbar | Perf-score | Dom |
|---|---|---|---|---|---|---|
| Login | 3078ms → 3017ms | 5554ms → **3319ms** | 0 → 0 | 12 → **7** | 74 → 87 | "Hjemmeside der loader" → "Midt imellem" |
| Dagens pas* | 691ms → 616ms | 901ms → 735ms | 0 → 0 | 2 → 1 | 100 → 100 | Føles som en app (uændret) |
| Sæt-logger* | 761ms → 690ms | 901ms → 751ms | 0 → 0 | 4 → 2 | 100 → 100 | Føles som en app (uændret) |
| Check-in* | 693ms → 643ms | 797ms → 660ms | 0 → 0 | 2 → 1 | 100 → 100 | Føles som en app (uændret) |
| Videocoach-forside | 4845ms → **3550ms** | 4845ms → **4118ms** | 0,0006 → 0,0006 | 5 → 6 | 70 → 78 | "Hjemmeside der loader" (uændret, men målbart hurtigere) |

`*` = isolerede harnesses, ikke den ægte autentificerede app — se "Ærlige
grænser". Skærmbilleder: `outputs/167-foer/*.png` og `outputs/167-efter/*.png`.
Rå tal: `outputs/167-{foer,efter}/MAALING.json`.

**De to reelle fund, i tal:**
- Login: TTI faldt 5554ms → 3319ms (**~40% hurtigere**), hovedbundlen hentes
  nu 1 gang i stedet for 2, netværkskald 12 → 7.
  Fuld transparens: FCP flyttede sig ikke mærkbart (bundlen selv — React +
  ReactDOM + @supabase-js, de eneste tre afhængigheder i `package.json` — skal
  stadig downloades+parses uændret; genindlæsningen skete midt i den
  indlæsning, ikke før den, derfor rammer fixet TTI hårdere end FCP).
- Videocoach-forside: FCP faldt 4845ms → 3550ms (~27% hurtigere), TTI 4845ms →
  4118ms (~15% hurtigere), perf-score 70 → 78. (En hurtig enkeltmåling
  undervejs i commit 2b's arbejde viste ingen forskel — 3-løbs-medianen her,
  som er den officielle metode, viser en reel, konsistent gevinst.)

**npm run lint:** rent gennem alle fire commits.

**Enhedstests:** `node --test src/*.test.js` — 143/143 grønne, inkl. de 4 nye
i `src/appUpdate.test.js`.

**Verify-scripts kørt (grønne):** `verify:videocoach-buttons-layout`,
`verify:athlete-silent-fail-visibility`, `verify:athlete-read-failures`.
Fulde `verify:*`-suite ikke kørt i sin helhed (30+ scripts, mange uden for
denne ordres område) — de scripts der rører de filer jeg har ændret
(`src/appUpdate.js`, `public/videocoach.html`) er kørt og grønne.

**npm run e2e:** findes ikke på denne gren (samme som ordre 163 — forgrenet
fra `appen-holder`, som selv er forgrenet fra `be70575`; e2e-scriptene ligger
på Vaidyas `main`-arbejde). Ikke bygget videre på, jf. Grænser.

## Hvad er næste

**Fravalgt her, med pris** (Dhruvas grundlag for næste ordre):

- **Videocoach-forsidens resterende ~3,5s FCP.** Den ægte flaskehals er det
  526 KB store, ét-fils `public/videocoach.html`-dokuments egen
  download+parse-tid (ikke skrifttypen, som nu er rettet). En rigtig
  rettelse ville kræve at splitte siden-skallen fra selve tracking-motoren så
  skallen kan tegnes før trackeren hentes — reelt arbejde, og det rammer
  præcis den sporingskode DENNE ordres Grænser fredede. Bør være sin egen
  ordre, med Vaidya eller en der kender videocoach-koden involveret.
- **Logins resterende ~3s FCP.** Bundet af React + ReactDOM + @supabase-js —
  de eneste tre afhængigheder i `package.json`, ingen lettere erstatning
  uden en ny afhængighed (forbudt her). Et `<link rel="preconnect">` til den
  ægte Supabase-URL i `index.html` er en kendt, billig teknik der ville
  hjælpe det FØRSTE ægte API-kald efter login — men kunne ikke ærligt
  efterprøves her (denne måling bruger en fiktiv Supabase-URL, en
  preconnect til en ikke-eksisterende adresse beviser intet). Kandidat til en
  ordre med et sikkert, ikke-produktions Supabase-testprojekt.
- **De tre harness-skærmes ÆGTE tal** (Dagens pas/Sæt-logger/Check-in i den
  rigtige, autentificerede AthleteView) kræver samme sikre testmiljø som
  ovenstående — samme pris, samme forudsætning.
- Har betydning for Hara (mærkbart bedre-sporet): loginfejlen (dobbelt-
  genindlæsning) ramte efter al sandsynlighed EVERY førstegangsbesøg, ikke
  kun et sjældent tilfælde — sandsynligvis en del af det Marc oplevede som
  "arbejder ikke smooth" i ordre 163's baggrund, selvom den ikke var den
  specifikke fejl han rapporterede der.

## Ærlige grænser

- Kun to af de fem skærme (Login, Videocoach-forside) er den ÆGTE,
  uændrede app uden nogen session — de tre andre er isolerede harnesses
  (samme etablerede grænse som `scripts/maal-app.mjs`, ordre 123) og deres
  perfekte tal måler harnessens egen lette vægt, ikke den ægte
  AthleteView-chunk (251 KB, se ordre 163's rapport). Jeg forsøgte at gøre
  harnessene mere ærlige ved at spejle index.html's service worker-
  registrering ind i dem (for at se om Login-fejlen også ramte dem) — det
  virkede ikke inden for Lighthouses målevindue (harnessene er for lette/
  hurtige til at nå SW'ens install→activate-cyklus i tide), så forsøget blev
  droppet igen (se kommentar i `scripts/maal-atlet-telefon.mjs`).
- Login-fixet er strukturelt sandsynligt at hjælpe LIGE SÅ meget på den ægte
  Dashboard/AthleteView-koldstart (de deler samme `index.html`/`appUpdate.js`/
  `sw.js`) — men det er en rimelig slutning, ikke en målt kendsgerning, da jeg
  ikke kan måle den ægte autentificerede app her.
- Videocoach-fixets første, hurtige enkeltmåling (i commit 2b's eget arbejde)
  viste ingen effekt; den officielle 3-løbs-median her viser en reel gevinst.
  Jeg nævner begge målinger åbent i stedet for kun at vise den der passede
  bedst.
- Jeg har ikke kørt den fulde `verify:*`-suite — kun de scripts der rører
  filerne jeg ændrede (se Testresultat).

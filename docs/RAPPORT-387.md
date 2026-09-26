# Rapport: ordre 387, atleten ser Dagens pas hurtigere på telefonen

Ordren havde tre blokke: (1) mål indlæsningen, (2) hent kun det der skal
ses, (3) bevis. Målingen viste, at det meste allerede var på plads fra
tidligere ordrer: coachens side (`Dashboard`) hentes kun for coachen
(`App.jsx`, lazy siden 163/201), og atletens tunge faner (Program, Kost,
Mobilitet, Volumen, Fremgang, Beskeder, Stævne) og VideoCoach-iframen
hentes først, når de åbnes. Det, der stadig kom med på forsiden, var
**muskelkortet** (61 kB, `muskelkort.generet.json`), fordi forsidens
ugestatus-kort brugte én lille datofunktion fra samme fil. Den er flyttet
ud. Derudover forudindlæses skærmens egne små hjælpe-chunks nu samtidig med
skærmen, i stedet for en rundtur senere.

Resultat (median af 3, 390x844, 4x CPU-drosling, kold cache):

| Profil | Forside synlig før → efter | Interaktiv før → efter | JS før forsiden |
|---|---|---|---|
| Fast 3G | 6.694 → **6.096 ms** (−598 ms, −9 %) | 8.340 → **7.718 ms** (−622 ms) | 606 → 545 kB |
| Slow 4G | 4.313 → **4.054 ms** (−259 ms, −6 %) | 4.695 → **4.485 ms** (−210 ms) | 606 → 545 kB |

Skærmbillederne er uændrede: 11/11 atletskærme og 34/36 coachskærme har
0 % pixel-afvigelse. De to sidste (Coach Briefing, 1280 og 390) afviger
0,0005–0,0027 %, og den samme afvigelse opstår mellem to kørsler af den
samme kode (støj, ikke ændringen).

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
bedre"): **ja, lidt.** Atleten ser Dagens pas ca. 0,6 s hurtigere på
dårligt net (Fast 3G) og 0,25 s hurtigere på Slow 4G. Intet andet ændrer
sig for atleten eller coachen.

## Gren

Gren `hurtigere-start`, forgrenet fra `main` (`1cc7c07`, 373 og 377 merget). 3 commits:

- Blok 1: `0011cdf` FØR-målingen (`outputs/387/foer.json`), måle-, skærmbillede- og verify-scripts
- Blok 2: `37881a5` ugenøglen i egen fil, forudindlæsning af skærmens hjælpe-chunks
- Blok 3: denne rapport, `efter.json`, EFTER-skærmbilleder, pixel- og verify-resultater

## Hvad ændret

**Blok 1 (måling).** `outputs/387/maal-start.mjs` bygger appen mod
e2e-mocken (`e2e/mock-supabase.mjs` + `buildSeed`, samme som verify- og
e2e-scripts), serverer `dist/` lokalt og måler headless i Chromium på
390x844 (DSF 2, mobil, touch). Profiler via DevTools-protokollen, tallene
skrevet ud: Fast 3G = 562,5 ms RTT, 1,44 Mbit/s ned; Slow 4G = 150 ms RTT,
1,6 Mbit/s ned; begge med 4x CPU-nedsættelse. Hver kørsel er en ny
browser-context med kold cache og en logget-ind atlet (som når appen åbnes
igen fra hjemmeskærmen). "Forside" = første frame hvor "Dagens pas" står på
skærmen; "interaktiv" = Lighthouse-lignende TTI (5 s uden lange opgaver og
højst 2 kald i gang).

Hvad atleten hentede før forsiden (rå / gzip kB):

| Chunk | Før | Efter |
|---|---|---|
| `index.js` (React, Supabase, login) | 359 / 101 | 359 / 102 |
| `AthleteView.js` (forsiden, Dagens pas) | 173 / 46 | 173 / 47 |
| `beregn.js` (muskelkort + volumenberegning) | **61 / 8** | hentes først på Volumen-fanen |
| `ugenoegle.js` (ny) | – | 0,4 / 0,3 |
| `videoCoachUpload.js`, `athleteSilentFailLog.js` | 12 / 4 | 12 / 4 |
| **I alt** | **606 / 160** | **545 / 151** |

`Dashboard.js` (283 kB) og alle fane-chunks var allerede ude af atletens
første indlæsning.

**Blok 2.**
- `src/volume/ugenoegle.js` (ny): `kalenderdato` og `ugenoegle` flyttet
  uændret fra `src/volume/beregn.js`, som importerer og genudsender dem
  (ingen anden kode skal ændres). `src/athlete/ugeStatus.js` (forsidens
  ugestatus) og `src/exerciseProgress.js` importerer nu den lille fil.
  Dermed ligger muskelkortet kun i `beregn`-chunken, som Volumen-fanen
  henter, når den åbnes.
- `vite.config.js`: rolle-gættets `<link rel="modulepreload">` (ordre 233)
  forudindlæser nu også den gættede skærms egne chunk-imports (transitivt,
  hovedbundtet udeladt): for atleten `ugenoegle`, `videoCoachUpload`,
  `athleteSilentFailLog`; for coachen `videoCoachUpload`, `exerciseNames`.
  Før blev de først opdaget, når hovedbundtet kørte `import()`. Intet gæt =
  ingen preload, som før.
- Ingen ny indlæsningsindikator: fanerne har allerede appens egen
  `LazyBoundary` med indlæser og "prøv igen".

## Testresultat

- `npm run build` grøn efter hver ændring. `npm run lint` grøn.
- Sikkerhedslinjen `node outputs/387/koer-verify.mjs efter` (build, lint og
  alle 45 `verify:*`): **46/47 bestået** (`outputs/387/verify-efter.json`).
  Den ene er `verify:kritik-379`, som ramte sikkerhedslinjens 600 s-loft. Kørt
  alene hænger den i skak-delen ("gaader", skak-repoet, ikke appen) efter
  "taktik: 11 moenstre, konsol 0". App-delen alene
  (`node scripts/kritik-379.mjs --kun atlet`) er grøn: 7/8 skærme 0 %,
  `03-video-1` 3,99 % (13.124 px), præcis samme tal som det committede
  `outputs/kritik-379/maalinger.json` på `main`, altså ikke denne ændring.
- Pixel (`outputs/387/sammenlign.mjs`, pixelmatch threshold 0), FØR taget
  samme dag på blok 1-commit'en, EFTER på blok 2:
  atlet 11/11 = 0 % (`pixel-foer-atlet-efter-atlet.json`); coach 34/36 = 0 %,
  Coach Briefing 0,0005 % (1280) og 0,0021 % (390)
  (`pixel-foer-coach-efter-coach.json`). To EFTER-kørsler mod hinanden giver
  0,0011 % og 0,0024 % på de samme to skærme
  (`pixel-efter-coach-efter2-coach.json`): støj fra skærmen selv.
- Målingen: `outputs/387/foer.json` og `efter.json` (alle 3 kørsler pr.
  profil, spredning under 1,5 %).

## Hvad er næste

**Til Marc:** atleterne vil mærke, at Dagens pas kommer ca. et halvt sekund
hurtigere frem på dårligt net i centret; ellers er appen den samme.

1. Resten af ventetiden er ikke JavaScript-størrelse, men rækkefølgen:
   hovedbundt → login-session → ca. 35 kald til Supabase før forsiden. Næste
   mærkbare skridt er at se på de kald (hvilke der skal være klar før
   forsiden, og hvilke der kan vente), ikke flere chunks.
2. `index.js` er 102 kB gzip, mest React (~178 kB rå) og Supabase-auth
   (~96 kB rå). Den kan ikke deles mere uden at skifte bibliotek.

## Ærlige grænser

- **Gevinsten er beskeden** (6–9 %), fordi coachens side og fanerne allerede
  var delt ud. Ordrens forudsætning ("i dag henter en atlet hele appen, også
  coachens side og VideoCoach") passede ikke: det var løst før 373/377.
- **Den lokale server gzipper ikke**, så "JS før forsiden" i målingen er rå
  byte, og tiderne er målt med rå overførsel. GitHub Pages gzipper, så i
  virkeligheden er både før og efter hurtigere, og forskellen fra muskelkortet
  mindre (8 kB gzip frem for 61 kB rå). Gevinsten fra forudindlæsningen
  (én rundtur) gælder uændret.
- Målingen er mod mocken på 127.0.0.1, ikke mod Supabase. Mocken svarer uden
  forsinkelse ud over droslingen, så rigtige Supabase-svartider kommer oveni.
- Kun en logget-ind atlet med rollehukommelse er målt (det almindelige
  tilfælde). Første login og coachens start er ikke målt; coachen får samme
  forudindlæsning af sine hjælpe-chunks, men det er ikke målt i tid.
- Skærmbillederne tages mod den ubyggede app (`vite`), som i 373/377.
  `vite.config.js`-ændringen gælder kun build; den er dækket af målingen (den
  byggede app viser forsiden i alle 12 kørsler), ikke af pixel-sammenligningen.
- FØR-skærmbillederne fra 25. sep er taget om 26. sep (datoen står på
  skærmen), med blok 1-commit'en udtjekket midlertidigt og så tilbage til
  grenen.
- `verify:kritik-379`s skak-del hænger (se Testresultat). Den er ikke
  undersøgt; den rører ikke appen. Sikkerhedslinjens kritik-scripts
  overskrev committede filer i `outputs/kritik-384/` og
  `outputs/ugen-faar-dato/`; de er sat tilbage med `git checkout`.
- Uden for "Læs KUN"-listen har jeg læst: `src/LazyBoundary.jsx` (om der
  fandtes en indikator), `src/athlete/Ramme.jsx` (om VideoCoach-iframen var
  betinget), `src/roleCache.js`, `src/volume/beregn.js` og importlinjerne i
  `src/athlete/ugeStatus.js`/`src/exerciseProgress.js`. Nødvendigt for at
  finde og rette årsagen.

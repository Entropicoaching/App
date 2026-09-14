# Rapport — Ordre 193: atletlisten, fra "hjemmeside der loader" til værktøj

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`atletlisten`, forgrenet fra `main` (`e04a771`). To commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `d63c4e7` | Baseline-måling + waterfall-diagnose af hvor forsidens 5,8s går, ingen rettelser |
| 2 | `7f8718e` | Slået `fetchWeeklyActivity`/`fetchAthleteLastLogs` sammen til ét kald + måling |
| 3 | (denne commit) | Måling efter + opdateret fravalgt-liste + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Baggrund:** atletlisten har stået øverst på min egen fravalgt-liste siden
ordre 175 — ~5,8s TTI, "føles som en hjemmeside der loader" — men altid
forbudt at røre af to ordrers grænser. Denne ordre løftede netop den
grænse, kun for forsiden.

**Commit 1 — waterfall i stedet for gæt.** Tidligere undersøgelser (175,
184) målte Dashboard.jsx's EGEN data-hentning (netværkskald, dedup-
muligheder) og fandt reelle, men små gevinster. Denne ordre gik et niveau
dybere: en Lighthouse-waterfall med DevTools-throttling, sorteret efter
starttidspunkt, viste at **~5,6 af de ~5,8 sekunder ligger FØR
Dashboard.jsx overhovedet monteres** — en rent sekventiel kæde: hoved-
JS-bundtet (2,9s) → App.jsx's rolleopslag (0,6s, venter på bundtet) →
Dashboard-chunken (2,1s, venter på rolleopslaget). Dette var IKKE tidligere
dokumenteret — hverken 175 eller 184 skelnede mellem "tid før Dashboard
monteres" og "tid Dashboard selv bruger på at hente data".

**Commit 2 — den ene sikre gevinst der var tilbage.** Med kæden foran
Dashboard.jsx kortlagt, blev to greb afprøvet på Dashboard's EGEN, mindre
resterende andel (fase 4-6 i waterfall-tabellen, under 2,4 sekunder):

- Udskyd `refreshCoachInbox()`s og kalender-effektens første kald til
  efter listens egen tegning (500ms) — INGEN TTI-gevinst målt, og et reelt
  bivirkningsrisiko (Indbakke-skærmens egen opdatering blev forsinket).
  Rullet tilbage.
- `fetchWeeklyActivity` og `fetchAthleteLastLogs` viste sig at hente
  PRÆCIS samme tabel/kolonner/filter (`exercise_logs`, `athlete_id`,
  `logged_at`, `skipped=false`) — kun tidsvinduet forskelligt, og den
  ubegrænsede variant er allerede en overmængde af den anden. Slået sammen
  til `fetchAthleteActivityLogs`; begge tal udledes client-side af samme
  rækker. Ingen funktionsændring, én rundtur mindre.

## Testresultat

**Tabel — før/efter, telefon 390px + desktop 1280px**, median af 3 løb:

| Skærm | Netværkskald | TTI (telefon) | TTI (desktop) | Dom |
|---|---|---|---|---|
| Atletliste, FØR | 38 | 5854ms | 5810ms | "Føles som en hjemmeside der loader" |
| Atletliste, EFTER | 36 | 5852ms | 5803ms | "Føles som en hjemmeside der loader" (uændret) |

De fire andre skærme (Check-in-gennemgang, Atletens uge, Videoer, Indbakke)
er urørt af denne ordre og forbliver "føles som et værktøj"
(48-931ms render, 0-14 kald) — se `outputs/maal-coach/2026-09-14--slut.json`.

**Min egen dom, i 184's ord:** Atletlisten "føles" stadig som en hjemmeside
der loader — TTI flyttede sig ikke målbart. Ikke fordi commit 2's rettelse
var forkert (den er reel og sikker), men fordi den adresserede en del af
siden (fase 6) der aldrig var den faktiske flaskehals (faserne 1-3). Se
"Hvad er næste".

**npm run lint:** rent gennem begge commits.

**Alle 31 `verify:*`-scripts:** grønne.

**npm run e2e:** grøn (`atlet → coach, ende-til-ende`, 24,8s — uændret).

**npm run maal:telefon** (atletens side, regressionstjek — denne ordre
rører kun Dashboard.jsx): grøn, uændrede tal. Se
`outputs/maal/2026-09-14--slut.json`.

**Målet (under 2s TTI på telefonprofilen) er IKKE nået.** TTI står ved
~5,85s, uændret fra før ordren. Hvad der mangler, og hvad det koster: se
"Hvad er næste".

## Hvad er næste

Se `docs/FRAVALGT-193.md` for den fulde, kodefrie liste (erstatter
FRAVALGT-184.md's punkt 1). Kort opsummeret:

1. **Den reelle flaskehals er App.jsx's sekventielle
   rolleopslag→chunk-kæde** (fase 1-3 i waterfall-tabellen, ~5,6 af de
   ~5,8 sekunder), ikke Dashboard.jsx's egen data-hentning. En idé er
   skitseret (start begge lazy-chunks — coach og atlet — spekulativt,
   parallelt med rolleopslaget, drop den forkerte) men IKKE afprøvet, da
   den rører App.jsx og dermed er uden for denne ordres "kun forsiden
   (atletlisten) må lægges om"-grænse. Potentielt den største
   enkeltgevinst i hele denne undersøgelses-serie (175→184→193) — kræver
   en ordre der udtrykkeligt løfter grænsen til App.jsx.
2. Punkt 3-4 fra FRAVALGT-193.md (calendar/oversigt-dedup ved rent
   faneskift) — billige, lavrisiko, samme etablerede mønster som ordre
   175's rettelse 1, stadig ikke afprøvet.
3. Har betydning for Hara (mærkbart bedre-sporet): denne ordre skifter
   ikke Marcs oplevelse af forsiden (stadig ~5,8s), men den ÆNDRER hvad
   den næste ordre skal gøre for reelt at flytte den — fra "gæt og mål
   Dashboard.jsx" til "en præcis, målt diagnose der peger på App.jsx".
   Det er selve fremskridtet her, selvom TTI-tallet ikke flyttede sig.

## Ærlige grænser

- Målet (under 2s TTI) er ikke nået. Jeg har ikke skjult det bag en
  omformulering — atletlisten "føles" stadig som en hjemmeside der loader,
  præcis som før denne ordre.
- Waterfall-diagnosen (Commit 1) blev lavet med et engangs-diagnosescript,
  ikke et committet værktøj — de rå per-forespørgsel-tal er ikke gemt i
  repoet, kun tabellen i `docs/VALG-193.md`. En fremtidig ordre der vil
  genskabe eller uddybe den, må selv bygge en tilsvarende probe (samme
  Lighthouse `network-requests`-audit + DevTools-throttling, dokumenteret
  i `docs/VALG-193.md`).
- Commit 2's rettelse er leveret ÆRLIGT som "reel, sikker, men ikke en
  TTI-sejr" — fristelsen til at oversælge en gyldig, men lille gevinst som
  løsningen på det store problem er undgået bevidst, i samme ånd som
  ordre 175's "fuld ærlighed fremfor at kalde det en sejr".
- Målt mod `e2e/mock-supabase.mjs` (lokal mock), 45 attrap-atleter — samme
  metode og samme begrænsning som alle tidligere målinger i denne serie.
- Jeg overvejede at fjerne `fetchAthleteWeekSummaries` helt (den er en
  delmængde af `fetchCalendarWeeks`, samme mønster som commit 2), men den
  bruges også af den GLOBALE sidebar på ALLE Dashboard-skærme (ikke kun
  forsiden) — at fjerne den ville derfor røre mere end "atletlisten", og
  blev droppet af den grund, ikke fordi ideen var forkert.

# Ordre 175, commit 1 — coachens side målt som Marc bruger den

Metode: samme grundprincip som ordre 173 — mocken (`e2e/mock-supabase.mjs`),
logget ind som coach (`e2e/fixtures.mjs`'s `COACH_USER`), gennem den ÆGTE,
uændrede `Dashboard.jsx` (ikke en harness, til forskel fra ordre 130/137's
`scripts/maal-coach.mjs`). To profiler denne gang (ordrens eget valg, jf.
"Marc bruger begge"): telefon 390×844 og desktop 1280×800 — IKKE iPad, som
130/137 brugte. Attrap-seed: `e2e/fixtures.mjs`'s testatlet plus 45 ekstra
attrap-atleter (kun i `scripts/maal-coach-telefon.mjs`, ikke i
`e2e/fixtures.mjs`), for at kunne se om en lang atletliste er et reelt
problem. `npm run maal:coach-telefon foer-rettelser`. Ingen rettelser i denne
commit.

## Fem skærme, klik fra forsiden (atletlisten) og målt tal

Atletlisten er den ægte, autentificerede forside — målt med Lighthouse (samme
metode som ordre 173). Dashboard.jsx har ingen URL-routing (`view`/`activeTab`
er React-state) — de fire andre skærme er derfor målt som klik→synlig-
overgange under samme CDP-emulering (390×844/mobil-UA på telefon, ingen
kunstig nedsættelse på desktop — Lighthouses eget 'desktop'-formFactor har
heller ingen indbygget netværks-/CPU-emulering, samme konvention som den
gamle `scripts/maal-coach.mjs` allerede fulgte).

| Skærm | Klik fra forside | Telefon | Desktop |
|---|---|---|---|
| Atletliste | 0 | TTI 5822-5847ms · CLS 0,13-0,15 · 40 kald · perf 64-65 · "Føles som en hjemmeside der loader" | TTI 5801-5810ms · CLS 0,07-0,09 · 40 kald · perf 56-57 · "Føles som en hjemmeside der loader" |
| Check-in-gennemgang (hub-fanen) | 2 (atlet-række → "Hjem") | 314ms · 6 kald · "Føles som et værktøj" | 79ms · 6 kald · "Føles som et værktøj" |
| Atletens uge (log-fanen) | 2 (atlet-række → "Log") | 167ms · 4 kald · "Føles som et værktøj" | 44ms · 4 kald · "Føles som et værktøj" |
| Videoer (analyse-fanen, lazy chunk) | 3 (atlet-række → "Mere" → "Analyse") | 918ms · 20 kald · "Føles som et værktøj" | 72ms · 20 kald · "Føles som et værktøj" |
| Indbakke | 1 (sidebar/bundnav "Indbakke") | 471ms · 11 kald · "Føles som et værktøj" | 68ms · 11 kald · "Føles som et værktøj" |

Atlet-rækkens klik lander altid på `program`-fanen (Dashboard.jsx's
`openProfile(athlete, 'program')` ved rækkeklik — IKKE `hub`, selvom
`openProfile`s egen standardparameter siger `'hub'`). "Check-in-gennemgang" og
"Atletens uge" kræver derfor BEGGE et ekstra fane-klik oveni rækkeklikket.
Skærmbilleder: `outputs/maal-coach/2026-09-13--foer-rettelser/*.png`. Rå tal:
`outputs/maal-coach/2026-09-13--foer-rettelser.json`.

## Det klare fund

**Atletlisten er langt den værste skærm, på BEGGE profiler** — TTI ~5,8s,
perf 56-65, mod de fire andre skærmes 44-938ms. De fire andre "føles som et
værktøj" allerede (under 1s, ingen CLS). Dette er modsat ordre 173s mønster
(hvor harnessene løj OM en dårlig autentificeret skærm) — her er der ingen
harness at afsløre; forsidens kostbarhed er ægte og allerede synlig.

En ægte netværkslog (`page.on('request')`, ikke Lighthouses egen
netværks-audit, som viste et højere og mindre pålideligt tal — se Ærlige
grænser i slutrapporten) viser 16 REST/RPC-kald på en enkelt kold
genindlæsning af forsiden, hvoraf flere (fx `exercise_logs`, `weeks`) hentes i
2-4 forskellige forme til forskellige formål (dagens aktivitet, kalender,
compliance) — ikke tydelige duplikater, snarere en genuint datatung side.

Et separat, klart duplikat blev fundet ved at klikke Forside→Indbakke→Forside→
Indbakke: `entropi_training_signals_v1`, `coach_signal_actions`, `messages` og
`video_analyses` blev alle hentet 4 gange på blot 4 klik — Dashboard.jsx's
`refreshCoachInbox()`-effekt (linje ~710-728) genkører uforandret ved ethvert
skift mellem 'list' og 'inbox'. Rettes i commit 2 (se dens ærlige grænse der).

## Grænser

Målt mod en lokal mock, ikke en rigtig Supabase-instans, over localhost.
45 attrap-atleter (plus testatleten) — et tal jeg selv har valgt for at kunne
teste atletlistens skalering, ikke et kendt tal for Marcs rigtige atletantal.

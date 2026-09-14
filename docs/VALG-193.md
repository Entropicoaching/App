# Valg — Ordre 193: hvor forsidens tid går, og hvad der kan gøres nu

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Baseline (før nogen rettelse)

`npm run maal:telefon` (atletens side, regressionstjek — uændret denne ordre):
grøn, se `outputs/maal/2026-09-14.json`.

`npm run maal:coach-telefon`, atletliste (telefon 390px / desktop 1280px),
median af 3 løb:

| Profil | FCP | TTI | CLS | Netværkskald | Perf-score | Dom |
|---|---|---|---|---|---|---|
| Telefon | 3793ms | 5854ms | 0,000 | 38 | 70 | "Føles som en hjemmeside der loader" |
| Desktop | 3760ms | 5810ms | 0,089 | 38 | 56 | "Føles som en hjemmeside der loader" |

Samme tal som ordre 175/184 fandt (~5,8s) — problemet har ikke flyttet sig
siden. Se `outputs/maal-coach/2026-09-14.json`.

## Waterfall — hvor de 5,8 sekunder faktisk går

Målt med en engangs-diagnose (Lighthouses `network-requests`-audit med
DevTools-throttling — samme profil som `maal:coach-telefon`, 45 attrap-
atleter), sorteret efter starttidspunkt. Fulde rå tal ikke committet (kun
denne tabel — se "Ærlige grænser").

| Fase | Tid (fra→til) | Varighed | Hvad venter på hvad |
|---|---|---|---|
| 1. Hoved-JS-bundtet (`index-*.js`, React+Supabase-js+App.jsx, 424 KB) | 89ms → 2970ms | **2881ms** | Intet — første ting browseren henter |
| 2. `version.json` + `profiles?select=role` (App.jsx's rolleopslag) | 3103ms → 3750ms | 647ms | Venter på at bundtet er FÆRDIGT PARSET (kan først køre JS'en der beder om det) |
| 3. `Dashboard-*.js`-chunken (266 KB) | 3812ms → 5868ms | **2056ms** | Venter på at rolleopslaget (fase 2) er færdigt — React ved først at den skal lazy-loade Dashboard, når `role==='coach'` er kendt |
| 4. Dashboard monteres, `fetchAthletes()`+co. starter | 5868ms → 6207ms | 339ms | JS-parse/eksekvering af den friskhentede chunk |
| 5. `athletes`-kaldet selv | 6213ms → 6880ms | 667ms | Venter på at chunken er monteret (fase 4) |
| 6. Efterslæb (weeks/logs/profiles) + kalender + indbakke — 10+ kald i én byge | 6897ms → 8228ms | ~1330ms | Venter på `athletes` (fase 5); konkurrerer indbyrdes om samme forbindelse/båndbredde |

**Det klare fund:** faserne 1-3 — hoved-bundtet, rolleopslaget, og
Dashboard-chunken — er en RENT SEKVENTIEL kæde på **~5,6 sekunder**, og intet
af det er Dashboard.jsx's egen atletliste-kode. Dashboard's EGEN
data-hentning (fase 4-6) starter først ved 5868ms og er selv færdig omkring
8228ms — under 2,4 sekunder, og allerede delvist parallel (fase 6's mange
kald overlapper hinanden, om end de også konkurrerer om samme forbindelse).

**Hvorfor kæden er sekventiel:** `App.jsx` afgør FØRST coachens rolle
(`profiles?select=role`, fase 2) — KUN DEREFTER kalder den
`dashboardFactory()` (`import('./Dashboard')`), som starter Dashboard-
chunkens download (fase 3). De to kunne i princippet hentes samtidig (rollen
er enten 'coach' eller 'athlete' — begge chunks kunne startes spekulativt,
og den forkerte droppes), men det er en ændring i `App.jsx`, ikke i
"forsiden (atletlisten)" — denne ordres eneste løftede grænse. Se "Hvad er
næste".

## Hvad er valgt til denne ordre

Givet at ~5,6 af de ~5,8 sekunder ligger FØR Dashboard.jsx overhovedet
monteres, og at min grænse er "kun forsiden (atletlisten) må lægges om" —
er den adresserbare rest fase 4-6, hvor Dashboard.jsx's EGEN kode styrer
rækkefølgen. To greb afprøvet, ét beholdt:

| Greb | Hypotese | Målt effekt | Beholdt? |
|---|---|---|---|
| Udskyd `refreshCoachInbox()`s og kalender-effektens FØRSTE kald til efter listens egen tegning (500ms) | Mindre byge = mindre kø på samme forbindelse = hurtigere TTI | TTI uændret (5845ms mod 5854ms baseline — inden for støj). Indbakke-skærmens EGEN opdatering blev til gengæld målbart forsinket (11→1 netværkskald i målingen — mistanke om at scriptets eget måle-vindue lukkede FØR den udskudte hentning nåede at køre, ikke en ægte gevinst) | **Nej** — ingen TTI-gevinst, reel risiko for at Indbakke-skærmen viser forældet data i op til 500ms |
| Slå `fetchWeeklyActivity` og `fetchAthleteLastLogs` sammen (samme tabel/kolonner/filter, kun forskelligt tidsvindue — den ubegrænsede er allerede en overmængde af den anden) | Én rundtur mindre burde flytte TTI en smule | Netværkskald 38→36 (bekræftet, -1 rundtur), TTI uændret (5854ms mod 5854ms — bygen i fase 6 er ikke selv flaskehalsen, de sekventielle faser 1-3 er) | **Ja** — reel, sikker forbedring (mindre serverlast, ingen funktionsændring), leveret ærligt uden at oversælge den som en TTI-sejr |

**Konklusion:** der er ikke flere billige, sikre greb tilbage INDEN FOR
"kun forsiden"-grænsen der flytter TTI målbart. Den ubestridte grund til at
2-sekunders-målet ikke nås, er faserne 1-3 (bundt→rolleopslag→chunk,
sekventielt) — ikke atletlistens egen datahentning. Se `docs/FRAVALGT-193.md`.

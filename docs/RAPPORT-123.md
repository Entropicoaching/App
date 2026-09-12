# RAPPORT-123 — appen målt på telefonen

## Gren

`appen-maalt` (base `main` = `5a09e22`, ordre 120 merget). Tre commits:

- `c7cd895` — commit 1: `scripts/maal-app.mjs` (`npm run maal:app`) +
  `outputs/maal-app/FOER.md`/`FOER.json` + skærmbilleder. Ingen rettelser.
- `d4a0995` — commit 2: trykflader op på 44px + programmatiske labels.
- `97eadaf` — commit 3: `outputs/maal-app/EFTER.md` + diff,
  `FORSLAG-TIL-MARC.md`, `dagens-pas-foer-efter.png`.

Ikke pushet, ikke merget. Ingen atletdata nogen steder. Ingen ændring af
`public/videocoach.html`s afspilnings-/seek-vej (Bhishaks spor i
`entropi-app-wt2`).

## Hvad blev ændret

**Måleværktøj** (`scripts/maal-app.mjs`, ny): tre profiler (iPhone 13,
Android 360×740, desktop) gennem seks atlet-skærme — login og
videocoach-forsiden mod den ægte, uændrede app (`npm run build` + lokal
statisk server, fiktive Supabase-nøgler i proces-scope, aldrig skrevet til
miljøvariabler); dagens pas, sæt-logger, opvarmning og check-in i isolerede
harnesses, der bruger den ægte `src/repsPrescription.js` og `src/warmup.js`
plus ægte inline-stilarter kopieret fra `AthleteView.jsx`, med syntetiske
øvelser (`AthleteView.jsx` kræver en levende Supabase-session for slet at
boote — se `scripts/verify-athlete-reps-per-set-mobile.mjs`'s egen
begrundelse for samme greb). Browser: playwright fra den delte
codex-runtime (samme kilde som `verify-videocoach-*.mjs` allerede bruger i
denne app) i stedet for `entropi-coaching-site/scripts/maal.mjs`'s
puppeteer; Lighthouse peger på playwright-Chromiums egen CDP-port. Nye
dev-afhængigheder: `axe-core`, `lighthouse`.

**App-rettelser** (kun det målingen fandt, ingen design-/tekstændring):

- `Auth.jsx`: EMAIL/ADGANGSKODE-labels er nu `<label htmlFor>` knyttet til
  inputtets id (var løse `<div>`'er — axe critical "label"); "Log
  ind"-knappen fik `minHeight: 44px` (var ~40px).
- `AthleteView.jsx` sæt-logger: vægt- og reps-felterne fik `aria-label`
  (axe critical "label" — placeholder alene var ikke nok).
- `AthleteView.jsx` "Dagens pas": sessionsrækkerne i "Mit program" fik
  `minHeight: 44px` (var ~37-38px).
- `AthleteView.jsx` check-in: 1-5-skalaknapperne og "Lokal
  ømhed"-zoneknapperne fik `minHeight: 44px` (var hhv. ~29-32px og ~29px).
- `AthleteView.jsx` opvarmning: "spring dette sæt over"-knappen (✕) gik fra
  en eksplicit 32px til 44px.

Harnessene i `scripts/maal-app.mjs` er opdateret 1:1 med disse rettelser,
så FØR/EFTER er sammenlignelige.

## Testresultat

Fuld tabel: `outputs/maal-app/FOER.md` og `outputs/maal-app/EFTER.md`
(diff nederst i EFTER.md). Skærmbilleder side om side: `outputs/maal-app/
dagens-pas-foer-efter.png`. Sammendrag:

| Skærm | Axe critical "label" | Trykflader <44px | A11y (iPhone 13) |
| --- | --- | --- | --- |
| Login | 1 → 0 | 3 → 2* | 75 → 87 |
| Sæt-logger | 1 → 0 | 0 → 0 | 75 → 92 |
| Dagens pas | — | 3 → 0 | 91 → 91 |
| Opvarmning | — | 10 → 0 | 86 → 86 |
| Check-in | — | 5 → 1** | 87 → 87 |

\* Login's resterende 2 er selve email-/adgangskodefelterne (~39px, ikke
navngivet af scriptets egen tekstudtræk — se FORSLAG). \*\* Check-in's
resterende 1 er søvntimer-feltet (~39px), ikke rettet i dette commit — se
`FORSLAG-TIL-MARC.md`.

Uændret med vilje (jf. ordren): farvekontrast ("serious" i alle 6 skærme —
kræver formentlig en ny nuance i paletten, noteret til Marc, paletten er
ikke rørt) og videocoach-forsidens desktop-knapper (Bhishaks spor).

`npm run lint`: 0 fejl (13 kendte, urelaterede react-hooks/exhaustive-deps-
advarsler, uændret af denne ordre). Relevante `verify:*` kørt grønne:
athlete-tap-targets, athlete-reps-per-set-mobile, athlete-onboarding(-guide),
athlete-password-reset, athlete-readiness-draft, athlete-rest-timer-drift,
athlete-self-service, athlete-write-failures, athlete-training-inputs,
athlete-jargon-explained, videocoach-feedback-quality, videocoach-submission,
videocoach-upload, videocoach-upload-flow. Tre scripts fejler allerede på
`main` FØR denne ordre (bekræftet ved at køre dem mod `main`s uændrede
kildefiler via `git stash`): `verify-athlete-first-day-flow`,
`verify-athlete-read-failures`, `verify-auth-logout-and-role-switch` — ikke
rørt af denne ordre, og ikke rettet (uden for ordrens omfang: "ingen
ændring af datamodel ... uden ordre" og ingen af de tre filer denne ordre
må røre er årsagen).

## Hvad er næste

- Marc's fire punkter i `outputs/maal-app/FORSLAG-TIL-MARC.md`: kontrast/
  palette, check-in's søvntimer-felt, login-formularens lodrette placering
  på desktop, videocoach-forsidens desktop-knapper.
- De tre pre-eksisterende, urelaterede test-fejl bør have deres egen ordre —
  jeg har ikke undersøgt årsagen, kun bekræftet at de ikke stammer herfra.
- Ingen anden opfølgning identificeret af selve målingen.

## Ærlige grænser

- "Dagens pas", "Sæt-logger", "Opvarmning" og "Check-in" er isolerede
  harnesses, ikke den fulde, monterede `AthleteView.jsx` — se begrundelsen
  i `scripts/maal-app.mjs`'s hoved-kommentar. Deres sidevægt-tal er
  harness-isolerede, ikke den ægte bundtvægt (den ægte autentificerede skal
  — main + AthleteView-chunk, 658 KB — er rapporteret separat, én gang,
  øverst i FOER.md/EFTER.md).
- Lighthouse-performance-tal har naturlig støj mellem kørsler (±7 points
  set på videocoach-forsidens performance-score i to identiske kørsler) —
  brug dem som retning, ikke et eksakt tal.
- Jeg har ikke rettet farvekontrast eller ændret paletten (jf. ordren).
- Jeg har ikke undersøgt de tre pre-eksisterende testfejl nærmere end at
  bekræfte, at de findes uafhængigt af denne ordre.

## Delmål (Hara)

Sporet er "Appen mærkbart bedre for atleterne". Dette arbejde giver den
første egentlige måling af appen som en atlet oplever den på en telefon —
samme metode som hjemmesiden (ordre 111) og Adaptiv (ordre 113) allerede har
fået — og fjerner to konkrete, målte friktionspunkter (unavngivne
formularfelter, trykflader under 44px på fire atlet-skærme) uden at ændre
udseende. Relevant for Hara/"Appen mærkbart bedre".

# Entropi Abonnementsapp — implementeringsplan (slice 1)

Status: lokal prototype. Ikke committet, ikke deployet, ikke offentlig.
Dato: 2026-07-31

## 0. Arbejdsområde

| | |
|---|---|
| Worktree | `C:\Users\Entropi\Documents\Entropicoaching\control-tower\worktrees\entropi-subscription-app` |
| Branch | `feature/subscription-app-slice-1` |
| Base-commit | `4c3c6aceadd40b62f6deac19d2306ff7606b8399` (`origin/main`, 2026-07-31 12:02, "feat: integrate athlete onboarding and personal feedback") |
| Hovedcheckout | `C:\Users\Entropi\Desktop\entropi-app` — **røres ikke** (står på `codex/identity-v3-hardening` med igangværende arbejde) |

Basen er `origin/main` og ikke lokal `main` (lokal `main` var 16 commits bagud) — prototypen refererer altså til den kode der faktisk er i produktion.

## 1. Eksisterende filer: kun læst

Ingen af disse ændres i slice 1.

| Fil | Hvorfor læst |
|---|---|
| `package.json` | Stak: React 19, Vite 8, `@supabase/supabase-js`. Ingen router, ingen testrunner. |
| `vite.config.js` | Build-id-plugin, `base: '/'`, single entry (`index.html`). |
| `index.html` | Produktionsentrypoint (PWA-manifest, service worker). |
| `eslint.config.js` | Lint gælder `**/*.{js,jsx}` med browser-globals + `react-refresh/vite`. |
| `src/main.jsx` | Mount-mønster for 1:1-portalen. |
| `src/App.jsx` | Auth/rolle-gating (`profiles.role` → Dashboard/AthleteView). Reference for hvordan vi **ikke** kobler os på. |
| `src/index.css`, `src/App.css` | Rester af Vite-skabelonen — bruges ikke af abonnementsappen. |
| `src/AthleteView.jsx` | Designreference: farver, typografi, kort-/knap-stil (`s`-objektet, l. 1396-1407). |

## 2. Nye filer

| Fil | Rolle |
|---|---|
| `docs/entropi-subscription-app-plan.md` | Dette dokument. |
| `subscription.html` | **Dev-only** entrypoint. Ligger i roden, så Vites dev-server serverer `/subscription.html`. `vite build` bruger kun `index.html` som input, så filen kommer aldrig med i `dist/` og kan ikke deployes ved et uheld. |
| `src/subscription/README.md` | Isolationsreglerne, kort. |
| `src/subscription/main.jsx` | Mount af prototypen. |
| `src/subscription/SubscriptionApp.jsx` | Skal + navigationstilstand (ingen router). |
| `src/subscription/theme.js` | Designtokens kopieret fra `AthleteView.jsx` (ingen delt import). |
| `src/subscription/ui.jsx` | Små byggeklodser: Card, Button, Chip, Stepper, TabBar. |
| `src/subscription/storage.js` | localStorage-lag, nøgleprefix `entropi:sub:v1:`, skemaversion. |
| `src/subscription/programs.js` | 3 faste programmer (rene data). |
| `src/subscription/selectProgram.js` | Deterministisk programvalg. |
| `src/subscription/entitlements.js` | `free` / `member` / `coaching` + `can()`. |
| `src/subscription/progression.js` | Rene funktioner til historik/progression. |
| `src/subscription/screens/Onboarding.jsx` | Profil + niveau/dage/udstyr → programmatch. |
| `src/subscription/screens/Today.jsx` | Dagens træning. |
| `src/subscription/screens/LogSession.jsx` | Logning af sæt/reps/vægt/RPE. |
| `src/subscription/screens/History.jsx` | Historik + progression. |
| `src/subscription/screens/Profile.jsx` | Profil, entitlement-demo, nulstil. |
| `src/subscription/__tests__/subscription.test.mjs` | `node:test` (indbygget — ingen ny dependency). |

Ingen nye afhængigheder. `package.json`, `package-lock.json` og `vite.config.js` er byte-uændrede.

## 3. Informationsarkitektur

```
subscription.html
└── SubscriptionApp
    ├── (ingen profil)  → Onboarding      4 trin: navn → niveau → dage → udstyr → match
    └── (profil findes) → Tab-navigation
        ├── I dag       Today      → LogSession (fuldskærm, ét træningspas)
        ├── Historik    History    → pas-liste + progression pr. øvelse
        └── Profil      Profile    → programvalg, entitlement-demo, nulstil demo-data
```

Navigation er `useState` i `SubscriptionApp` — ingen router, ingen ændring i URL-håndtering.

### Datamodel (kun localStorage)

```
entropi:sub:v1:profile  { id, name, level, daysPerWeek, equipment, programId,
                          entitlement, createdAt, schemaVersion }
entropi:sub:v1:sessions [ { id, programId, dayId, startedAt, completedAt,
                            entries: [ { exerciseId, sets: [ {reps, weightKg, rpe, loggedAt} ] } ] } ]
```

Skrives ved hver ændring, så en genindlæsning midt i et pas ikke taber sæt.

### Programvalg (deterministisk)

Udstyrstrin: `bodyweight` (0) → `dumbbells` (1) → `gym` (2).
Et program er kandidat hvis `niveau ∈ program.levels`, `program.days <= valgte dage`, og `udstyrstrin >= program.minEquipment`.
Blandt kandidater vælges **flest dage**; ved lige stand vælges højeste udstyrskrav; fallback er startprogrammet. Samme input giver altid samme program, og valget forklares i UI'et.

### Progression

Programmet er fast. Appen laver **ingen** automatiske træningspåstande: den viser sidste logning som udgangspunkt og en skrevet, statisk progressionsregel pr. program. Al sammenligning er inden for samme bruger — aldrig på tværs.

## 4. Adskillelse fra 1:1-portalen

| Grænse | Hvordan |
|---|---|
| Entrypoint | Eget `subscription.html`; `index.html` og `src/main.jsx` er urørte. |
| Build | Prototypen er ikke en del af `vite build` → kan ikke havne på `app.entropicoaching.dk`. |
| Kode | Alt nyt ligger under `src/subscription/`. Ingen import fra `src/App.jsx`, `Auth.jsx`, `Dashboard.jsx`, `AthleteView.jsx`, `supabase.js`, `appUpdate.js`, `videoCoach*`. |
| Data | Kun `localStorage` med prefix `entropi:sub:v1:`. Ingen Supabase-klient, ingen netværkskald, ingen auth. |
| Design | Tokens er **kopieret** til `theme.js`, ikke importeret — 1:1-portalen kan ændre sit udseende uden at påvirke prototypen og omvendt. |
| Indhold | Ingen video, chat, kost, kalender eller coach-beskeder. |

Kontrol: `git status` i worktreet må kun vise nye filer (`??`) — ingen `M` på eksisterende filer.

## 5. Entitlement-model

En intern værdi på demoprofilen, ikke et adgangssystem:

| Tier | Betydning i produktet |
|---|---|
| `free` | Startprogram + logning + simpel historik. |
| `member` | Hele programbiblioteket + progressionsvisning. Demoprofilen bruger dette. |
| `coaching` | 1:1-produktet. Findes i modellen, men leveres af den eksisterende atletportal — abonnementsappen låser ikke op for det. |

`can(entitlement, feature)` er ren og unit-testet. Der vises **intet** betalingsflow, ingen pris og ingen opgraderingsknap. Når et tier mangler adgang, står der hvad der ikke er inkluderet — ikke hvad det koster.

## 6. Produktbeslutninger der skal tages senere

1. **Datamodel og Supabase-scope** — eget projekt, eget skema eller delte tabeller med `product`-kolonne? RLS-konsekvenser for 1:1-atleter.
2. **Konto og login** — deler abonnenter auth med atletportalen (én konto, to produkter) eller helt adskilt?
3. **Programbibliotek** — hvem skriver og vedligeholder programmerne, hvor mange, og hvordan versioneres de når en bruger er midt i et forløb?
4. **Progressionsregel** — fast tekstregel (som nu), eller struktureret vægtforslag? Sidstnævnte er en træningspåstand og kræver et bevidst produktvalg.
5. **Betaling** — Stripe vs. App Store; abonnementsniveauer og priser; hvad `member` reelt indeholder.
6. **Distribution** — PWA på et subdomæne, eller native app? Påvirker om det kan ligge i samme Vite-build.
7. **Overgang free → coaching** — hvordan opdager og håndterer vi en abonnent der vil have 1:1?
8. **Dataejerskab ved opsigelse** — hvad sker der med træningsloggen?

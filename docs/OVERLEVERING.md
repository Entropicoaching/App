# Overlevering — appen som den er nu (efter ordre 233, 2026-09-15)

Skrevet af Vaidya, ordre 239. Formål: ét dokument en ny agent (måske ikke
Claude) kan læse og vide hvordan Entropi Coach hænger sammen, hvad der er
målt, hvad der er fredet, og hvad der ikke må gøres. Læs `AGENTS.md` FØRST
(arbejdsregler, produkt-skel, Supabase-godkendelse) — det er filen der ikke
er skrevet om her. Denne fil er kortet over appens *tilstand*, ikke reglerne
for at arbejde i den.

## Appens dele og chunks

Entropi Coach er React/Vite. Tre hovedskærme, alle kodeopdelt via
`src/LazyBoundary.jsx`:

| Del | Fil(er) | Ca. størrelse (rå/gzip) | Hentes |
|---|---|---|---|
| Hovedbundt | `index.js` (React, routing, `App.jsx`, `src/supabase.js`) | 359,07 kB / 101,61 kB | Altid, først |
| Dashboard (coach) | `src/Dashboard.jsx` + tre `LazyBoundary`-faner (Indbakke/Analyse/Program) | 247,79 kB / 62,15 kB | Ved coach-login |
| — Volumenkort-fane | `src/dashboard/VolumenKort.jsx` (+ `src/volume/`, inkl. 53 kB `muskelkort.generet.json`) | 80,78 kB / 13,92 kB | Kun ved klik på 'Oversigt' på en atlet |
| AthleteView (atlet) | `src/AthleteView.jsx` (HJEM-fanen, eager — deler ~2.100 linjer state/skrivefunktioner med alle faner) | 120,34 kB / 32,96 kB | Ved atlet-login |
| — Mobilisering-fane | `src/athlete/MobiliseringTab.jsx` | 60,58 kB / 14,70 kB | Ved fanevalg |
| — Stævnedag-fane | `src/athlete/StaevnedagTab.jsx` (+ `CountdownRing.jsx`) | 14,40+1,35 kB / 3,53+0,65 kB | Ved fanevalg |
| — Program-fane | `src/athlete/ProgramTab.jsx` | 32,32 kB / 8,37 kB | Ved fanevalg |
| — Kost-fane | `src/athlete/KostTab.jsx` (søgehandler + `LOCAL_FOODS`/`PORTION_UNITS` bevidst IKKE flyttet ud, se `docs/RAPPORT-232.md`) | 24,00 kB / 5,35 kB | Ved fanevalg |
| — Beskeder-fane | `src/athlete/BeskederTab.jsx` | 6,32 kB / 2,05 kB | Ved fanevalg |
| VideoCoach | `public/videocoach.html`, ét selvstændigt statisk værktøj, åbnes via `window.open` fra Dashboard/AthleteView | separat, ikke i denne bundle-kæde | Egen navigation |

Fælles state/props-kontrakt: udflyttede faner har ALLE frie variable som
eksplicitte props (ingen ny global tilstand); skrivefunktioner
(`logSet`, `skipSet`, `quickLogFood`, `deleteLog`, …) ligger i
`AthleteView.jsx` selv og sendes ned som props, så
`verify:athlete-write-failures`s garanti (F1-G3) ikke rører dem.
Kilde: `docs/RAPPORT-228.md`, `docs/RAPPORT-232.md`, `docs/ATHLETEVIEW-KORT.md`.

## Hvordan indlæsningen sker

1. **Rollehukommelse** (`src/roleCache.js`, ordre 201 → flyttet fra `App.jsx`
   ordre 233): efter hvert succesfuldt rolleopslag gemmes rollen i
   `localStorage` pr. bruger-id. Et cachet gæt viser den gættede visning MED
   DET SAMME; det ægte opslag bekræfter/retter i baggrunden. Aldrig kastende
   (korrupt JSON, manglende nøgle, storage der selv kaster → "intet gæt").
2. **Modulepreload** (ordre 233, `vite.config.js`-plugin
   `entropi-role-guess-preload`): ved byggetid bages `roleCache.js`s kode RÅT
   (IIFE, `export` fjernet) ind i et inline-script lige efter
   `<meta charset>` i `index.html`. Scriptet gætter rollen fra
   `sb-*-auth-token` i `localStorage` og indsætter
   `<link rel="modulepreload">` for den gættede rolles skærmchunk — den
   begynder nu at hente ~5-40ms efter hovedbundtet, ikke først når
   hovedbundtets modulgraf er kørt færdig. **Vigtigt for enhver der ændrer
   `roleCache.js`s SIGNATUR:** inline-scriptet følger automatisk med ved
   næste build (ingen separat kopi), men ingen advarsel udløses hvis
   signaturen ændres — se `docs/RAPPORT-233.md`s "Ærlige grænser".
3. **LazyBoundary** (`src/LazyBoundary.jsx`) og dens regel fra ordre 215:
   når to `<LazyBoundary>`-elementer bytter plads på SAMME position i
   træet (fx Dashboard ↔ Atletvisning ved "Min træning"), skal `factory`
   OG `label` stå i `useMemo`s deps — ikke kun `retryKey`. Ellers genbruger
   React den memoiserede `lazy()`-instans og viser den forkerte skærm uden
   fejl. Se `docs/RAPPORT-215.md`.
4. **Den reelle grænse er nu byte-mængden, ikke rækkefølgen** (ordre 233,
   commit 3): hovedbundt og skærmchunk hentes parallelt, men deler samme
   throttlede, båndbredde-begrænsede forbindelse — at starte to store
   hentninger samtidig flytter ikke meget under en reel mobilprofil. Næste
   greb der skal flytte TTI må skære i selve størrelserne
   (`AthleteView.jsx`s manglende yderligere opsplitning,
   `Dashboard`-chunken).

## Supabase-klienten efter ordre 226

`src/supabase.js` bygger klienten direkte af de fire submoduler appen
faktisk bruger — `@supabase/auth-js`, `postgrest-js`, `storage-js`,
`functions-js` — i stedet for gennem `@supabase/supabase-js`, som kun blev
brugt for sin sammensætning af netop de fire PLUS en Realtime-klient
(`realtime-js`/`phoenix.js`) appen ALDRIG kalder (`.channel()` findes ingen
steder i `src/`). Samme `storageKey`-format
(`sb-<projekt-ref>-auth-token`, eksisterende sessioner mister ikke login),
samme auth-klasse (`GoTrueClient`). `@supabase/realtime-js` og
`@supabase/phoenix` er væk fra `node_modules`, ikke bare utrukket fra
bundlet — hovedbundtet blev 16 % mindre i gzip (120,99→101,61 kB).
**Ingen Realtime-abonnementer findes i appen i dag** — hvis en fremtidig
ordre vil bruge `supabase.channel()`, skal `realtime-js` geninstalleres
eksplicit. Se `docs/RAPPORT-226.md`, `docs/VALG-226.md`.

## Målescripts og hvordan de køres

| Script | Kommando | Måler | Metode |
|---|---|---|---|
| `maal-kaeden.mjs` | `npm run maal:kaeden` | TTI for Atletliste (coach), Dagens pas + Check-in (atlet), telefon 390px, 5 løb, median | Lokal mock/build, `throttlingMethod: 'devtools'` (reel CDP-nedsættelse — IKKE Lighthouses simulate, som skjuler reelle gevinster, se ordre 201 vs. 226) |
| `kaeden-tegn.mjs` | `npm run kaeden:tegn` | Kaldrækkefølge/-form (hvad venter på hvad), request/response-spor | Lokal mock, ingen throttling — til KÆDENS FORM, ikke absolutte ms |
| `maal-produktion.mjs` | `npm run maal:produktion` | TTI direkte mod `https://app.entropicoaching.dk` | Devtools-throttling, frisk Chrome-proces pr. løb (kold cache — genbrugt proces gav falske "0 bytes" cache-hits, se ordre 228). Kun login-/landingsskærmen er nåelig uden ægte produktionslogin |
| `byg:muskelkort.mjs` | `npm run byg:muskelkort` | (byg, ikke måling) genererer `muskelkort.generet.json` | — |

Alle tre målescripts er committede, ikke ad hoc — men flere af de "næste
sten"-vandfald i rapporterne 226-233 er ETT løb, ikke committet kode (samme
metode gentaget manuelt hver gang, se hver rapports "Ærlige grænser").
**Kendt skævhed i hele serien siden ordre 123:** den lokale statiske
testserver sender ukomprimerede bytes (ingen gzip/br) — de absolutte TTI-tal
(~5,7-7,2s) er derfor sandsynligvis mere pessimistiske end produktion reelt
viser (produktionen serverer bekræftet gzip, ~28,5 % af rå størrelse, ordre
228). RETNINGEN (før/efter samme metode) er upåvirket; de ABSOLUTTE
sekundtal er ikke pålidelige nok til at bruges alene — se
`docs/MAALINGER.md`.

## Fredede invarianter

**VideoCoach-trackeren** (`public/videocoach.html`,
`docs/videocoach/HANDOVER-VIDEOCOACH.md`, "BAR-TRACKER FREDNING"):
1. Tider, aldrig index, når bane parres med andet (pose, skelet).
2. Kontinuitetsregel (spring > R·0,6 → gensøg nært) — ingen coast.
3. patchVar-gulve under emaBest og template-porten (stille start).
4. Frys-vagt v1 uændret: original-template + recenter-validering.
   Cirkel-scan-relokering og template-hygiejne er MODBEVIST — genopfind dem
   ikke.
5. Korrektioner fødes ALDRIG live ind i matcheren (kun post-hoc).
6. Enhver ændring: reproducér i rig → fix → alle scenarier grønne → port →
   Marc tester → deploy på hans go.

Brydes disse uden rig-bevis først, fryser trackeren i produktion (skete én
gang, måtte reverteres — se HANDOVER-filen).

## Hvad der venter på Marc

- **Push af `main`.** Alle ordrer 215-233 er committet og merget lokalt til
  `main`; live står stadig på `162abc6` (før ordre 226). Ingen push sker
  uden Marc.
- **Migration 209** (`docs/supabase/20260915-exercise_muscle_overrides.sql`
  + `.md`): ny tabel til coachens rettelser af muskel-kortlægningen
  (`src/volume/rettelser.js`), RLS pr. coach. IKKE kørt mod produktion —
  venter på Marcs direkte, navngivne godkendelse (jf. `AGENTS.md`s
  Supabase-afsnit). `docs/RAPPORT-209.md` siger hvad der sker før/efter.

## "Gør ikke"-listen

Ting der er prøvet og afvist, med begrundelse — prøv dem ikke igen uden nyt
bevis:

- **Kontinuitetsfilter på tværs af billeder i pose-prøven (ordre 218).**
  Tracker-invariant #2 ("spring > R·0,6 → gensøg nært") anvendt som et
  `lastGood`-gate hen over hele klippets billedserie gjorde resultatet
  VÆRRE (0/28 mod 5/28 inden for Drishtis usikkerhedsbånd) — en tidlig
  fejldetektion opfyldte sin EGEN kontinuitet og forhindrede korrektion
  tilbage til den sande skive. Kilde: `docs/RAPPORT-218.md`.
- **Billigere genfinding i videocoach-trackeren (ordre 225).** Ordren
  foreslog at afgrænse `plSearch`s gitter HVIS commit 1 viste dyr søgning.
  Målt: 57ms/kald, ~618 punkter i snit, selv 113 kald i træk kostede kun
  ~6,1s — ikke i nærheden af at forklare et flerminutters hæng. At gøre
  gitteret billigere bag et flag ingen ville slå til er "ren spildt
  kompleksitet". Kilde: `docs/FRAVALGT-225.md`.
- **Den falske hæng-måling (ordre 221 → 225).** Ordre 221 fandt at rigtige
  klip (modsat det syntetiske) aldrig blev færdige i sporingen — "sad fast"
  ved 96-99 % i op til 15 minutter, reproduceret 2/2 og 3/3 gange. Ordre 225
  fandt den EGENTLIGE årsag: ikke en dyr søgning i selve trackeren, men en
  fejl i e2e-testens EGEN `confirmAndWaitForTracking`, som kun genkendte to
  bestemte banner-tekster som "færdig" og derfor ventede for evigt på et
  klip der reelt var færdigt efter 21-46s og havde åbnet analyse-arket ad
  en tredje, ikke-genkendt vej. Rettet i testen, ikke i trackeren. Kilde:
  `docs/RAPPORT-221.md`, `docs/FRAVALGT-225.md`.
- **Rollecaching uden effekt på TTI (ordre 201).** Rollen huskes lokalt
  (`localStorage`) og en waterfall-diagnose bekræftede MEKANISK at
  Dashboard-chunken begynder at downloade ~250-700ms tidligere — men den
  aggregerede TTI-måling (Lighthouses SIMULEREDE throttling, dengang eneste
  metode) viste ingen klar ændring. Beholdt alligevel (mekanisk korrekt,
  sikker), men ikke en TTI-gevinst i sig selv — se hvorfor under
  Målescripts (devtools vs. simulate). Kilde: `docs/RAPPORT-201.md`.
- **Spekulativ parallel-hentning af BEGGE lazy-chunks (ordre 201).** Lød
  rigtigt på papiret, var en REGRESSION under båndbredde-begrænsning
  (telefon-TTI 6005ms→7318ms) — den throttlede profils begrænsede
  båndbredde deles mellem to samtidige hentninger. Rullet tilbage med det
  samme. Kilde: `docs/RAPPORT-201.md`. Samme fysik bekræftet igen i ordre
  233's commit 3 (parallel hentning af hovedbundt+skærmchunk flytter lidt
  under en båndbredde-begrænsning, selvom rækkefølgen er brudt).

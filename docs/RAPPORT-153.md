# RAPPORT — ORDRE 153: e2e, atlet → coach, i en rigtig browser

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`e2e-atlet-til-coach` fra `main` (`be70575`):

1. `82a0efa` — mock-backend (`e2e/mock-supabase.mjs`, `e2e/fixtures.mjs`, `e2e/harness.mjs`, `.env.e2e`, `npm run e2e:mock`)
2. `105337e` — atletens rejse (`e2e/atlet.spec.mjs`, `npm run e2e:atlet`, skærmbilleder)
3. `12362d2` — coachen ser det (`e2e/coach.spec.mjs`, `npm run e2e:coach`, skærmbilleder)
4. `35a37b4` — én kommando + dokumentation (`e2e/run-all.mjs`, `npm run e2e`, `docs/E2E.md`, denne rapport)
5. (dette commit) — rettede rapportens overskrifter til høstformatet (se nedenfor)

Træet er rent ved aflevering.

## Hvad ændret

Ny `e2e/`-mappe med en lokal Supabase-mock (Node `http`, ingen ny
runtime-afhængighed — genbruger playwright fra den delte codex-runtime,
samme kilde og begrundelse som `scripts/maal-app.mjs` allerede bruger) der
taler PostgREST-/GoTrue-formen appen rent faktisk sender. `.env.e2e` peger
`VITE_SUPABASE_URL`/`_KEY` på den — **ingen ændring i `src/`**. To specs
kører den ÆGTE, ubyggede app (`vite --mode e2e`) i en rigtig Chromium:

- **Atlet** (390px): login → dagens pas → opvarmning vises → logger tre sæt
  interval-reps (4, 5, 6) → check-in → VideoCoach-forsiden åbner uden video
  → logout.
- **Coach** (1280px): login → atletlisten viser Testatlet → Log-fanen viser
  ugens tre sæt → Hjem-fanens statuslinje viser dagens parathed → den
  lazy-loadede Analyse-fane åbner uden fejl → indbakken åbner.

`npm run e2e` starter mock+vite ÉN gang og kører begge specs i rækkefølge —
coachens browser-session læser dermed data atletens browser-session lige
skrev, gennem samme backend-form. Det er selve beviset ordren efterspørger.

Undervejs fandt selve e2e-arbejdet to stille huller i mocken (ikke i
appen — rettet i `e2e/mock-supabase.mjs`, ikke i `src/`): `exercise_logs` og
`personal_records` sættes aldrig med `logged_at`/`created_at` fra klienten
(den ægte DB gør det via `DEFAULT now()`); uden det crashede coachens
Analyse-fane på en `undefined.localeCompare()`. Se `TIMESTAMP_DEFAULTS` i
mocken og `docs/E2E.md`.

**Fund værd at følge op på (ikke rettet — uden for denne ordre):** under
sæt-loggeren observerede e2e-kørslen to reelle React-konsol-advarsler
("controlled til uncontrolled input" / omvendt) i AthleteView.jsx's
vægt-/reps-felter for et sæt, uden at det blokerede funktionaliteten. Præcis
den slags stille afvigelse ingen af de 32 verify-scripts kunne se, fordi de
ikke kører en levende browser mod en levende backend. Kandidat til en
fremtidig ordre.

## Testresultat

- `npm run lint`: grøn.
- Alle 32 `verify:*` (fuld liste, ingen `src/`-ændring i denne ordre): grønne.
- `npm run e2e:atlet`: grøn, ~6,6s.
- `npm run e2e:coach`: grøn, ~3,8s.
- `npm run e2e`: grøn, ~7,8s (langt under 2-minutters-graensen).

## Hvad er næste

Ingen `npm run verify`-paraplykommando findes i dette repo i dag (kun
individuelle `verify:*`) — `npm run e2e` er derfor tilføjet som et
selvstændigt sidste-trin, IKKE hægtet på en `verify`-kommando der ikke
findes endnu. Hvis/når Marc samler `verify:*` under én kommando, er
`npm run e2e` klar til at blive sidste linje i den, jf. ordrens eget forslag
("verify:local-stil"). Naturlig fortsættelse: udvid `e2e/fixtures.mjs`/
mockens `EMBEDS`/`rpcHandlers` i takt med at flere flows (kost, stævne,
videoupload) skal ende-til-ende-proves — se opskriften i `docs/E2E.md`.

## Ærlige grænser

Mocken er bevidst IKKE en fuld PostgREST-klon: filtre/operatorer og
embed-relationer er kun dem appen rent faktisk bruger i det testede flow
(grep'et i `src/` før den blev skrevet). RLS, ægte Postgres-constraints,
storage-politikker og mail-bekræftelse simuleres ikke. "Videoer-fanen" i
ordren er tolket som coachens lazy-loadede Analyse-fane (kommentaren i
`src/dashboard/AnalyseTab.jsx` kalder sig selv netop det: "videoer +
træningsgrafer") — NAV_ITEMS har ingen fane der bogstaveligt hedder
"Videoer". "Atletens uge" er proves via Log-fanen (viser hvert sæt),
ikke Program-fanen (viser kun komplians/overblik) — samme "vælg det mest
fornuftige, noter valget"-princip. Personal_records-tabellens
`logged_at`-vs.-`created_at`-uklarhed (se ovenfor) er en uafklaret,
opdaget uoverensstemmelse i selve produktionsskemaet/-koden — ikke noget
denne ordre har rettet, kun noteret.

## Betydning for Hara

Lukker det konkrete hul kritikerpakken (ordre 147) pegede på: "32
verify-scripts, ingen e2e mod rigtig backend." Appen har nu et reelt,
kørende bevis for at en atlets handling i browseren rent faktisk når frem
til coachens skærm gennem en ægte backend-formet kontrakt — relevant for
delmålet "Appen mærkbart bedre".

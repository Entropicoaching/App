# E2E: atlet → coach (ORDRE 153 + 155)

Ende-til-ende-prov mod den ÆGTE, ubuildede app (`vite`, ikke en isoleret
harness) og en lokal mock-backend — ikke mod produktions-Supabase.

## Kør det

- `npm run e2e:mock` — starter kun mocken (til manuel afprøvning/debugging).
- `npm run e2e:atlet` — atletens rejse alene, egen frisk mock.
- `npm run e2e:coach` — coachens gennemgang alene, seedet som om atleten
  allerede har trænet (så den er meningsfuld uden en forudgående atlet-kørsel).
- `npm run e2e` — den rigtige pointe: mock+vite startes ÉN gang, ni skridt
  kører i hvert sit friske login mod SAMME kørende backend (glat rejse →
  video op → coach gennemgår → det der går galt → beskeder). ~20-25s.

Skærmbilleder pr. skridt lander i `outputs/_seneste/e2e/` (git-ignoreret —
se "Facit vs. prøvekørsel" nedenfor).

## Hvad den dækker

**Ordre 153** — login (rigtig e-mail/kodeord mod `/auth/v1/token`),
rolle-opslag (`profiles`), dagens pas, opvarmningsvisning, sæt-logning med
interval-reps, check-in (parathed), VideoCoach-forsiden (uden video),
logout — og på coach-siden: atletlisten, ugens loggede sæt, dagens parathed,
den lazy-loadede Analyse-fane og indbakken.

**Ordre 155** — video "upload og gå" (atleten filmer/vælger en video i den
ÆGTE `public/videocoach.html`, sender den, mocken gemmer de rigtige bytes);
coachen åbner den afventende video i broen (signeret URL, rigtig hentning);
tekst-feedback (works/focus/next_set) skrevet, godkendt og delt, og atleten
ser den; et sæt logget uden net (aldrig en dobbelt-række); en afvist
videoupload hvor "prøv igen" rent faktisk virker (aldrig to rækker);
beskeder atlet↔coach med ulæst-tæller.

Assertions mod skrivninger er mod mockens egne tabeller
(`GET /__e2e/table?name=...`, `GET /__e2e/storage-keys`), ikke kun DOM-tekst.

## Hvad den IKKE dækker

RLS/policies (mocken håndhæver ingen adgangsregler), rigtige
mails/bekræftelseslinks, storage-adgangspolitikker, og enhver tabel/RPC uden
for atlet→coach-flowet (de får et neutralt tomt svar i stedet for en fejl,
se `e2e/mock-supabase.mjs`'s `rpcHandlers`/`TIMESTAMP_DEFAULTS`).

Coachens EGEN stangbane-sporing (den manuelle klik-igennem-video-analyse i
VideoCoach) køres ikke — det kræver en video med en faktisk sporbar skive
(samme problem `scripts/make-test-clip.mjs` løser for tracker-testen), ude
af omfang her. Video-review-flowets tekst-feedback/godkend/del-kæde er
derfor proved mod en video der er SEEDET som "allerede sporet"
(`fixtures.mjs`'s `ANALYZED_VIDEO_ID`), ikke en der lige er sporet i testen.
Broen/signeret-URL/afspilning ER proved ægte, mod den video atleten faktisk
uploadede i commit 1.

`personal_records`-tabellens `logged_at`-vs.-`created_at`-uklarhed (opdaget
under ordre 153, se mockens `TIMESTAMP_DEFAULTS`-kommentar) er en uafklaret
uoverensstemmelse i selve produktionsskemaet/-koden — ikke rettet, kun
noteret. "Timeout" (`?fejl=timeout` i ordre 155's eget sprog) er i mocken en
øjeblikkelig forbindelsesafbrydelse, ikke et ægte 12s-hæng op til appens
`fetchWithTimeout`-grænse — samme brugeroplevede udfald, uden at gøre
suiten langsom.

## Facit vs. prøvekørsel (ORDRE 205)

`npm run e2e`, `npm run maal:telefon` og `npm run maal:coach-telefon`
skriver alle til den git-ignorerede `outputs/_seneste/` (`e2e/`, `maal/`,
`maal-coach/`) — en almindelig kørsel efterlader derfor et rent træ. De
committede leverancebilleder (`outputs/e2e/`, `outputs/maal/`,
`outputs/maal-coach/`) er facit fra tidligere ordrer og røres ikke af det.

Skal facit opdateres, fordi en ordre udtrykkeligt beder om nye
leverancebilleder: tilføj `--opdater-leverance`, fx
`npm run e2e -- --opdater-leverance` eller
`npm run maal:telefon -- --opdater-leverance` (label kan stadig gives, i
vilkårlig rækkefølge med flaget). Se `scripts/leverance-sti.mjs`.

## Sådan tilføjes et nyt skridt

1. Udvid seed'en i `e2e/fixtures.mjs` hvis det kræver ny data.
2. Hvis appen kalder en tabel/RPC mocken ikke kender: tjek at generisk
   filter/select-håndtering i `mock-supabase.mjs` dækker det (den er en
   generisk, ikke en fuld, PostgREST-klon — se filens hoved-kommentar), eller
   tilføj en `rpcHandlers`-indgang.
3. Skriv et nyt `e2e/<navn>.spec.mjs` med en eksporteret `run...(page, opts)`-
   funktion (egen login — se `fejl.spec.mjs`/`beskeder.spec.mjs`'s
   kommentarer for hvorfor delt browserside-tilstand undgås), skærmbillede
   pr. skridt, og en assertion mod mockens tabel via `/__e2e/table?name=...`
   (eller `/__e2e/storage-keys` for filer). Tilføj den som et `step(...)` i
   `e2e/run-all.mjs`.
4. For at injicere en fejl i ét kald: `POST /__e2e/fault` med
   `{ pathPrefix, method, mode: '500'|'timeout', times }` — se
   `fejl.spec.mjs`.

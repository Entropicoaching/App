# E2E: atlet → coach (ORDRE 153)

Ende-til-ende-prov mod den ÆGTE, ubuildede app (`vite`, ikke en isoleret
harness) og en lokal mock-backend — ikke mod produktions-Supabase.

## Kør det

- `npm run e2e:mock` — starter kun mocken (til manuel afprøvning/debugging).
- `npm run e2e:atlet` — atletens rejse alene, egen frisk mock.
- `npm run e2e:coach` — coachens gennemgang alene, seedet som om atleten
  allerede har trænet (så den er meningsfuld uden en forudgående atlet-kørsel).
- `npm run e2e` — den rigtige pointe: mock+vite startes ÉN gang, atletens
  browser-session logger tre sæt + parathed, og coachens (anden) browser-
  session læser dem fra SAMME kørende backend. ~8s.

Skærmbilleder pr. skridt lander i `outputs/e2e/`.

## Hvad den dækker

Login (rigtig e-mail/kodeord mod `/auth/v1/token`), rolle-opslag (`profiles`),
dagens pas, opvarmningsvisning, sæt-logning med interval-reps, check-in
(parathed), VideoCoach-forsiden (uden video), logout — og på coach-siden:
atletlisten, ugens loggede sæt, dagens parathed, den lazy-loadede Analyse-fane
og indbakken. Assertions mod skrivninger er mod mockens egne tabeller
(`GET /__e2e/table?name=...`), ikke kun DOM-tekst.

## Hvad den IKKE dækker

RLS/policies (mocken håndhæver ingen adgangsregler), rigtige
mails/bekræftelseslinks, storage-politikker (upload er en ren fil-til-temp-
mappe-stub — ingen af specsne sender en rigtig video), og enhver tabel/RPC
uden for atlet→coach-flowet (de får et neutralt tomt svar i stedet for en
fejl, se `e2e/mock-supabase.mjs`'s `rpcHandlers`/`TIMESTAMP_DEFAULTS`).

## Sådan tilføjes et nyt skridt

1. Udvid seed'en i `e2e/fixtures.mjs` hvis det kræver ny data.
2. Hvis appen kalder en tabel/RPC mocken ikke kender: tjek at generisk
   filter/select-håndtering i `mock-supabase.mjs` dækker det (den er en
   generisk, ikke en fuld, PostgREST-klon — se filens hoved-kommentar), eller
   tilføj en `rpcHandlers`-indgang.
3. Tilføj skridtet i `runAtletJourney`/`runCoachReview`, med et skærmbillede
   og en assertion mod mockens tabel via `/__e2e/table?name=...`.

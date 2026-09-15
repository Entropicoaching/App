# Valg — Ordre 201: hvad er i hovedbundtet, og hvilket greb bryder kæden

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Hovedbundtets indhold (top ~15 moduler, `vite build`s rollup-graf)

Målt med `rollup-plugin-visualizer` (midlertidig dev-afhængighed til denne
analyse, `npm install --no-save` — rører aldrig `package.json`). Kun
`index-*.js` (hovedbundtet — det ALTID hentes, uanset rolle) vist:

| Modul | Ukomprimeret | Gzip | Bruges det? |
|---|---|---|---|
| `react-dom/cjs/react-dom-client.production.js` | 529.6 KB | 99,1 KB | Ja — kan ikke undværes |
| `@supabase/auth-js/GoTrueClient.js` | 109,0 KB | 16,9 KB | Ja — login/session |
| `@supabase/storage-js/index.mjs` | 41,9 KB | 7,7 KB | Ja — videoupload |
| **`@supabase/phoenix/priv/static/phoenix.mjs`** | **40,7 KB** | **9,9 KB** | **NEJ — se nedenfor** |
| `@supabase/postgrest-js/index.mjs` | 30,9 KB | 7,2 KB | Ja — alle databasekald |
| `@supabase/supabase-js/index.mjs` (selve klienten) | 20,6 KB | 6,0 KB | Ja |
| **`@supabase/realtime-js/RealtimeChannel.js`** | **16,9 KB** | **4,5 KB** | **NEJ — se nedenfor** |
| `react/cjs/react.production.js` | 16,0 KB | 4,2 KB | Ja |
| `@supabase/auth-js/webauthn.js` | 14,3 KB | 3,1 KB | Ja (del af auth-js) |
| **`@supabase/realtime-js/RealtimeClient.js`** | **14,1 KB** | **3,7 KB** | **NEJ — se nedenfor** |
| `@supabase/auth-js/GoTrueAdminApi.js` | 13,2 KB | 2,0 KB | Ja (del af auth-js) |
| `@supabase/auth-js/helpers.js` | 13,1 KB | 4,0 KB | Ja (del af auth-js) |
| `src/Auth.jsx` | 10,8 KB | 2,4 KB | Ja |
| `scheduler/cjs/scheduler.production.js` | 9,1 KB | 2,3 KB | Ja (React) |
| `iceberg-js/index.mjs` | 8,1 KB | 2,0 KB | Nej, men bundtet ind i `storage-js` (som ER brugt) — for lille/tæt koblet til at adskille |

**Fundet:** `grep`et for `.channel(`/`realtime`/`.storage.` i hele `src/`
viser at appen kun bruger `supabase.storage` (videoupload) — ALDRIG
`supabase.channel()` eller andre realtime-abonnementer.
`@supabase/supabase-js`'s `createClient()` opretter dog ALTID en
`RealtimeClient` internt, uanset om den bruges, så phoenix.js +
RealtimeChannel + RealtimeClient (**~18,1 KB gzip, ~13% af det ALLEREDE
gzippede hovedbundt**) ligger død vægt i hver eneste sideindlæsning.

**Hvorfor ikke fjernet i denne ordre:** at fjerne det kræver enten (a) at
erstatte `@supabase/supabase-js`s samlede klient med separate
`@supabase/postgrest-js`+`@supabase/auth-js`+`@supabase/storage-js`-kald i
`src/supabase.js` (rører kildekode uden for denne ordres tilladte filer —
"kun App.jsx, lazy-loading/chunk-opsætning og byggekonfigurationen"), eller
(b) at alias'e/stubbe `realtime-js` væk i byggekonfigurationen (inden for
grænsen, men risikabelt at gøre sikkert uden god tid til at verificere at
INTET i klientens interne opstart forudsætter en ægte `RealtimeClient`-
instans). Dokumenteret her til en fremtidig, målrettet ordre — se
"Hvad er næste" i `docs/RAPPORT-201.md`.

**Kan ikke flyttes ud af hovedbundtet uden adfærdsændring:**
`react`/`react-dom`/`scheduler` (kræves før NOGEN komponent kan rendere,
inklusive `loaderScreen`), `@supabase/auth-js` (login/session skal virke
FØR vi ved hvilken lazy-chunk der skal hentes), `src/Auth.jsx` (renderes
direkte i App.jsx, ikke lazy).

## Greb afprøvet til at bryde kæden (fase 2→3 i `docs/RAPPORT-193.md`s waterfall)

| Greb | Hypotese | Målt | Beholdt? |
|---|---|---|---|
| Hent BEGGE lazy-chunks (Dashboard + AthleteView) spekulativt, parallelt med rolleopslaget | Ingen ventetid på rolleopslaget FØR chunk-hentningen starter | **Værre**: telefon-TTI 6005ms→7318ms, desktop 5964ms→7302ms. Den throttlede mobilprofils begrænsede båndbredde deles mellem de to samtidige 250+266 KB-hentninger — den FAKTISK nødvendige chunk bliver langsommere, ikke hurtigere, fordi den nu konkurrerer om samme rør | **Nej** — klar regression, rullet tilbage med det samme |
| Husk rollen lokalt (`localStorage`) fra sidste succesfulde opslag; vis den gættede visning MED DET SAMME; det ægte opslag bekræfter/retter i baggrunden | Springer rolleopslagets ventetid over uden at hente noget ekstra | Bekræftet MEKANISK korrekt (en dedikeret waterfall viser Dashboard-chunken starte ~250-700ms tidligere, længe før rolleopslaget selv er færdigt) — men INGEN klar ændring i den AGGREGEREDE TTI-måling, hverken hos coach eller atlet (se `docs/RAPPORT-201.md`s tabel) | **Ja** — sikker, mekanisk korrekt, ingen regression; leveret ærligt uden at påstå en TTI-sejr målingerne ikke viser |

**Hvorfor ingen TTI-gevinst trods en bekræftet tidligere chunk-start:**
`npm run maal:*`s Lighthouse-kald angiver ikke `throttlingMethod: 'devtools'`
og bruger derfor Lighthouses standard SIMULEREDE throttling (en model bygget
på en UTHROTTLET sides observerede afhængighedsgraf, ikke en reelt
throttlet afspilning) — en ren scheduling-forskel på under et sekund i JS
kan forsvinde i den model. En dedikeret devtools-throttlet probe (samme
metode som `docs/RAPPORT-193.md`s waterfall) bekræftede den tidligere
chunk-start direkte, men også en målestøj på flere hundrede millisekunder
mellem ellers identiske kørsler i denne lange arbejdssession — for stor til
at et under-1-sekunds greb kan skelnes pålideligt fra støj med de
værktøjer, der var til rådighed her.

**Tredje kandidat ("tunge moduler ud af hovedbundtet og ind i chunks"):**
ikke afprøvet — givet at de eneste reelt flytbare moduler (Realtime-delen)
allerede kræver den samme, mere risikable ændring som ovenfor er
fravalgt af, og at commit 2's ramme (ét greb, målt) allerede var brugt op
af de to første forsøg.

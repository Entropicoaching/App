# Rapport — Ordre 173: mål den rigtige app, ikke en harness

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`maalt-mod-mocken`, forgrenet fra `main` (`838dece`, ordre 163+167 merget).
Fire commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `fa916a5` | De fem skærme målt i den ægte app (mock-login), ingen rettelser |
| 2a | `d588d17` | Rettelse: stop dobbelt profiles-rolleopslag ved app-åbning |
| 2b | `8516e7d` | Rettelse: reservér plads til ugekalenderen (CLS) |
| 3 | (denne commit — se `git log -1 maalt-mod-mocken`) | `npm run maal:telefon`, dokumentation, måling efter + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Baggrund:** ordre 167 målte de samme fem skærme, men tre af dem ("Dagens
pas", "Sæt-logger", "Check-in") som isolerede, statiske harnesses — de kunne
ikke andet, `AthleteView.jsx` kræver en levende Supabase-session for
overhovedet at boote, og produktions-Supabase var forbudt. Ordre 173 bruger i
stedet Vaidyas mock-Supabase (`e2e/mock-supabase.mjs`, ordre 153/155): logger
ind som testatleten og måler de tre skærme gennem den ÆGTE, uændrede app.

**Fund (commit 1, ingen rettelser der):** harnessenes perf-score 100 og
TTI < 1s for "Dagens pas" og "Check-in" var isoleret harness-vægt. Den ægte,
autentificerede skærm ligger på TTI ~6000ms og perf-score 66-69 — 8-9× langsommere
end harnessen lod tro, fordi den skal downloade+parse Dashboard-/
AthleteView-bundterne (251+246 KB) OG afvente 57 netværkskald til mocken
(mod harnessens 1-2), før den er brugbar. Endnu et fund: "Dagens pas" og
"Check-in" er i den ægte app SAMME skærm (samme faneblad "hjem" i
`AthleteView.jsx`, samme DOM) — ordre 167s to isolerede harnesses fremstillede
dem fejlagtigt som to uafhængige skærme med hver sit 100-tal. "Sæt-logger" kan
slet ikke Lighthouse-måles i den ægte app (ingen URL-routing til den, kun et
klientside faneskift) — målt i stedet som en klik→synlig-overgang under
samme CPU/net-emulering: 244ms, "Føles som en app". Se
`docs/RAPPORT-173-DEL1.md` for den fulde udredning.

**Fund 1 — dobbelt rolleopslag ved hver app-åbning.** Netværksloggen for
"Dagens pas"/"Check-in" viste `profiles?select=role` hentet TO gange (med
hver sin CORS-preflight) ved hver eneste app-åbning. Årsag i `src/App.jsx`:
`supabase.auth.getSession().then(...)` og `onAuthStateChange`s egen første
(INITIAL_SESSION-)fyring kalder begge `resolveRole` for samme bruger-id
samtidig — den eksisterende `resolvedFor`-vagt sættes først når kaldet er
FÆRDIGT, så den fanger ikke racet mellem de to. Rettet med `resolvingFor`: en
ref der markerer et kald i gang, tjekket/sat/ryddet i `resolveRole` selv.

**Fund 2 — ugekalenderen skubber parathedskortet ned.** `WeekCalendar`
(faneblad "hjem") returnerer `null` (findes slet ikke i DOM'en) før ugedata
er hentet, og dukker op som en hel ny blok når data ankommer — det skubber
alt nedenfor, bl.a. "Dagens parathed"-kortet, ned. Målt som appens største
reelle layoutskift: CLS 0,106 på Check-in (samme skærm som Dagens pas).
Ordre 167s isolerede harness havde altid statisk data fra første billede og
kunne aldrig se dette. Rettet ved at reservere en tom boks i
`WeekCalendar`s typiske højde, mens ugedata endnu ikke er hentet.

**Commit 3:** `npm run maal:telefon` (script fra commit 1, dokumenteret i
`docs/MAAL-TELEFON.md`) genkørt efter begge rettelser, som bevis for
gevinsten og som reproducerbart værktøj til fremtidige ordrer.

## Testresultat

**Tabel — harness (167) vs. ægte app, før/efter rettelser (173)**, alle tal
median af 3 løb, Lighthouse mobilprofil (390px, 4x CPU + langsomt net):

| Skærm | TTI · harness (167) | TTI · ægte, før (173) | TTI · ægte, efter (173) | CLS · før | CLS · efter | Netværkskald · før→efter | Perf-score · før→efter |
|---|---|---|---|---|---|---|---|
| Login | 3319 ms | 3322 ms | 3317 ms | 0 | 0 | 7 → 7 | 87 → 87 |
| Dagens pas | **735 ms** (harness — se DEL1) | 6000 ms | 5991 ms | 0 | 0,027 | 57 → 55 | 69 → 69 |
| Check-in | **660 ms** (harness — se DEL1) | 6001 ms | 5991 ms | **0,106** | **0,027** | 57 → 55 | 66 → 69 |
| Sæt-logger | **751 ms** (harness — se DEL1) | 244 ms (renderMs, se note) | 190 ms (renderMs) | 0 | 0 | 0 → 0 | n/a (se note) |
| Videocoach-forside | 4118 ms | 4076 ms | 4082 ms | 0,0006 | 0,0006 | 6 → 6 | 79 → 79 |

`Dagens pas`/`Check-in`'s TTI-kolonne er, som noteret i commit 1's rapport,
statistisk SAMME skærm målt to gange — forskellen mellem dem er målestøj, ikke
to reelt forskellige skærme. Skærmbilleder: `outputs/maal/2026-09-13--foer-rettelser/*.png`
og `outputs/maal/2026-09-13/*.png` (efter, kørt med `npm run maal:telefon`
uden label). Rå tal: samme mapper + `.json`.

**De to rettelsers gevinst, i tal:**
- **Fund 1 (dobbelt rolleopslag):** netværkskald før brugbar faldt 57 → 55 på
  begge skærme (den duplikerede `profiles`-forespørgsel + dens preflight er
  væk). TTI-effekten er lille og til dels inden for målestøj (6000ms → 5991ms
  på Dagens pas, ~6001ms → 5991ms på Check-in) — gevinsten er reelt "en
  unødig netværks-rundtur mindre pr. app-åbning" (mindre belastning på
  backend, marginalt hurtigere), ikke en dramatisk følt hastighedsforskel.
  Fuld transparens fremfor at oversælge en lille gevinst.
- **Fund 2 (CLS):** 0,106 → 0,027 på Check-in — en ~75% reduktion, gentaget i
  tre separate målekørsler (ikke ét heldigt løb). IKKE fuld eliminering; se
  Ærlige grænser.
- Login og Videocoach-forside er, som forventet, uændrede (rørt af ingen af
  de to rettelser) — tallene her matcher før/efter inden for normal
  målestøj, en god kontrol af at metoden selv ikke er kilden til de andre
  ændringer.

**npm run lint:** rent gennem alle fire commits.

**Enhedstests:** `node --test src/*.test.js` — 143/143 grønne (ingen af de to
rettelser har egne enhedstests — begge er ét-linjes race-/layout-rettelser i
komponenter der allerede er dækket af `verify:*` og `e2e`, se nedenfor).

**Verify-scripts:** ALLE 31 `verify:*`-scripts kørt, alle grønne. Én var i
stykker FØR denne ordre — `verify:auth-logout-role-switch` lavede en
kildetekst-regex mod en JSX-attributsyntaks (`onRecheckRole={...}`) som
`src/App.jsx` ikke længere bruger (den ægte kode har brugt objekt-syntaks
`onRecheckRole: () => ...` siden før ordre 173, bekræftet mod `main`) —
rettet som en ren regex-opdatering i selve verify-scriptet (ingen
adfærdsændring), så aflevering ærligt kan stå til "alle verify:* grønne".

**npm run e2e:** grøn (`atlet → coach, ende-til-ende`, ~25s).

**npm run maal:telefon:** grøn — se Testresultat.

## Hvad er næste

**Fravalgt her, med pris** (Dhruvas grundlag for næste ordre):

- **De resterende ~55 netværkskald og ~6s TTI på Dagens pas/Check-in.**
  Fjernelsen af ét duplikeret kald løste ikke hovedproblemet: 55 separate
  REST-kald (program, logs, beskeder, kost, PR'er, vægt, opvarmningsskabeloner
  m.fl.) sendes hver for sig i stedet for batchet/parallelliseret bevidst.
  En rigtig rettelse ville kræve at gennemgå `AthleteView.jsx`s
  data-hentnings-effekter og enten batche kald eller lade flere køre
  parallelt fra start — reelt arbejde der rammer en fil ordrens "billige
  gevinster"-regel ikke dækker. Bør være sin egen ordre.
- **Resterende CLS ~0,027 på Check-in/Dagens pas.** Sandsynligvis
  "Mit program"-kortets egen tekst-til-liste-ændring (fra "Intet program
  tilknyttet endnu." til den udfyldte sessionsliste) — samme mønster som
  `WeekCalendar`, men ikke rørt her for at holde denne rettelse til ét,
  velafgrænset sted. Kandidat til en opfølgende ordre.
- **Login/Videocoach-forsides kendte, ufixede flaskehalse** står som
  beskrevet i `docs/RAPPORT-167.md`s "Hvad er næste" — uændret her, ingen
  af de to blev rørt.
- Har betydning for Hara (mærkbart bedre-sporet): ordre 167s "100 i
  perf-score" på tre skærme var vildledende — den ægte, autentificerede app
  (den Marc og atleterne rent faktisk bruger, ikke isolerede harnesses) tager
  ~6s at blive brugbar og har 55-57 netværkskald i vejen. Det er efter al
  sandsynlighed en del af den oplevede "arbejder ikke smooth", uafhængigt af
  om nogen nogensinde så en isoleret harness's tal.

## Ærlige grænser

- Målt mod `e2e/mock-supabase.mjs` (lokal, in-memory), IKKE en rigtig
  Supabase-instans — RLS, ægte Postgres-latens og ægte netværksvej er ikke
  del af disse tal (se `docs/E2E.md`s egen grænse for mocken selv).
  Netværksvejen er localhost, ikke et rigtigt mobilnet — kun Lighthouses
  simulerede 4x CPU + langsomt net er "langsomt" her.
  Testatlet og alt indhold er syntetisk (`e2e/fixtures.mjs`) — ingen
  atletdata nogen steder i denne ordre.
- Sæt-loggers "renderMs" er IKKE en Lighthouse-perf-score/TTI — den ægte app
  har ingen URL-baseret vej til denne skærm, kun et klientside faneskift, så
  en kold Lighthouse-sidenavigation kan ikke ramme den. Tallet er en
  klik→synlig-overgang under identisk CPU/net-emulering — sammenligneligt på
  tværs af før/efter, men ikke direkte sammenligneligt med de andre skærmes
  TTI-tal.
- Lighthouses autentificerede løb (Dagens pas/Check-in) kører med
  `disableStorageReset:true` (ellers forsvinder login-sessionen efter første
  af de tre løb) — det betyder browser-cache heller ikke ryddes mellem de tre
  løb for disse to skærme. Lidt for optimistisk sammenlignet med et koldt
  asset-cache; nævnt her i stedet for skjult.
- "Dagens pas" og "Check-in" er, som udredt i commit 1's rapport, samme
  reelle skærm i den ægte app — de to rækker i tabellen er en kontrolmåling
  af hinanden, ikke to uafhængige fund.
- Fund 1's TTI-gevinst er lille og delvist inden for målestøj — jeg har
  vist begge tal åbent (57→55 kald er sikkert, TTI-faldet er det ikke) i
  stedet for kun at fremhæve det tal der ser bedst ud.
- Fund 2's CLS-rettelse er en reduktion (0,106 → 0,027), ikke en fuld
  eliminering — den resterende årsag er ikke undersøgt til bunds her.
- `verify:auth-logout-role-switch`-rettelsen er en regex i selve
  verify-scriptet (ikke i appen) — den var i stykker før denne ordre, af en
  årsag der ikke har noget med ordre 173 at gøre.

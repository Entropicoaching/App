# Rapport — Ordre 175: coachens side, målt som Marc bruger den

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`coachen-maalt-2`, forgrenet fra `maalt-mod-mocken` (ordre 173). Tre commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `d3faef9` | Coachens fem skærme målt gennem den ægte Dashboard.jsx, ingen rettelser |
| 2 | `e5c3e63` | Tre billige rettelser + måling efter |
| 3 | (denne commit — se `git log -1 coachen-maalt-2`) | Fravalgt-liste + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Baggrund:** atletens side er målt ved ordre 163, 167 og 173. Coachens side
— Marcs eget arbejdsredskab, åbnet flere gange dagligt — er ikke målt siden
ordre 130/137, hvor Dashboard blev splittet i lazy-chunks, og kun i isolerede
harnesses (samme begrænsning ordre 173 fandt og løste for atletens side).
Denne ordre gør det samme for coachen: mocken (`e2e/mock-supabase.mjs`),
logget ind som coach, gennem den ægte, autentificerede `Dashboard.jsx`.

**Fund (commit 1, ingen rettelser der):** atletlisten (forsiden) er langt
den værste skærm — TTI ~5,8s, perf 56-65, på BEGGE profiler (telefon 390px,
desktop 1280px). De fire andre skærme (check-in-gennemgang, atletens uge,
videoer, indbakke) var alle allerede under 1 sekund og "føles som et
værktøj" — til forskel fra ordre 173's mønster fandt jeg her ingen harness
der løj; forsidens kostbarhed var ægte og synlig fra første måling. Et
konkret duplikat: klikker man Forside→Indbakke→Forside→Indbakke, hentes
`entropi_training_signals_v1`, `coach_signal_actions`, `messages` og
`video_analyses` hver især 4 gange — Dashboard.jsx's `refreshCoachInbox()`
genkører uforandret ved ethvert skift mellem 'list' og 'inbox'. Se
`docs/RAPPORT-175-DEL1.md`.

**Rettelse 1 — redundant weeks/athleteLogs-genhentning mellem faner.**
`program`/`log`/`analyse`-fanerne bruger samme to datakilder
(`fetchWeeks`/`fetchAthleteLogs`), men effekten der henter dem kørte igen
ved ETHVERT faneskift imellem de tre — selv for samme atlet, uden nogen
skrivning imellem. Enhver ægte skrivning (tilføj øvelse, omarrangér session
osv.) kalder allerede disse to funktioner eksplicit selv bagefter, så et
rent faneskift er trygt at springe over. Rettet med en ref
(`weeksLogsLoadedForRef`) der husker hvilken atlet der sidst blev hentet
for, ryddet når profilen lukkes så et senere genbesøg altid henter friskt.

**Rettelse 2 — Analyse-fanens lazy chunk forudhentes.** Chunken (48 KB)
hentede sig selv først PÅ klikket på "Analyse". Forudhentes nu med det
samme en atlets profil åbnes (`openProfile`), så browseren har en chance
for at have den klar inden coachen klikker sig derhen via "Mere" → "Analyse".

**Rettelse 3 — atletlisten viser top 25 i stedet for alle rækker.** Samme
"vis kun det synlige, tilbyd at vise resten"-mønster som den eksisterende
"vis skjulte atleter"-knap. Se Testresultat og `docs/FRAVALGT-175.md` for
hvorfor denne rettelse ikke gav en målbar TTI-gevinst her.

**En fjerde kandidat blev afprøvet og rullet tilbage:** en 3-sekunders-vagt
mod `refreshCoachInbox()`s gentagne kald reducerede netværkskald reelt (11→1
på Indbakke), men gav en reproducerbar renderings-regression (Indbakke
68ms → 330-930ms) jeg ikke kunne forklare. Se `docs/FRAVALGT-175.md`.

## Testresultat

**Tabel — før/efter de tre rettelser**, median af 3 løb, klik→synlig-tal
under CDP-emulering (samme metode som ordre 173):

| Skærm | Profil | Netværkskald før→efter | Tid før→efter | Dom |
|---|---|---|---|---|
| Atletliste | Telefon | 40 → 40 (urørt) | TTI 5822-5847 → 5848ms | "Føles som en hjemmeside der loader" (uændret) |
| Atletliste | Desktop | 40 → 40 (urørt) | TTI 5801-5810 → 5808ms | "Føles som en hjemmeside der loader" (uændret) |
| Check-in-gennemgang | Telefon | 6 → 6 (urørt — rører ikke weeks/logs) | 314 → 326ms | "Føles som et værktøj" |
| Check-in-gennemgang | Desktop | 6 → 6 | 79 → 81ms | "Føles som et værktøj" |
| Atletens uge | Telefon | **4 → 0** | 167 → 187ms | "Føles som et værktøj" |
| Atletens uge | Desktop | **4 → 0** | 44 → 37ms | "Føles som et værktøj" |
| Videoer | Telefon | **20 → 14** | 918 → 938ms | "Føles som et værktøj" |
| Videoer | Desktop | **20 → 14** | 72 → 88ms | "Føles som et værktøj" |
| Indbakke | Telefon | 11 → 11 (urørt — se Fravalgt) | 471 → 475ms | "Føles som et værktøj" |
| Indbakke | Desktop | 11 → 11 | 68 → 70ms | "Føles som et værktøj" |

Skærmbilleder: `outputs/maal-coach/2026-09-13--foer-rettelser/*.png` og
`outputs/maal-coach/2026-09-13--efter-rettelser/*.png`. Rå tal: samme mapper
+ `.json`.

**De tre rettelsers gevinst, i tal:**
- **Rettelse 1 (weeks/logs-dedup):** "Atletens uge" mistede alle 4
  netværkskald (0 tilbage) — det var udelukkende de redundante kald der
  skete der. "Videoer" faldt 20→14 (samme 2 kald sparet, plus effekten
  spreder sig til flere fane-kombinationer undervejs til Videoer). Tiden i
  ms flytter sig ikke synligt (kaldene var hurtige/parallelle allerede) —
  gevinsten er reelt "6 unødige netværks-rundture mindre pr. profilbesøg",
  ikke en følt hastighedsforskel. Nævnt ærligt fremfor oversolgt.
- **Rettelse 2 (chunk-forudhentning):** ingen målbar gevinst i DENNE ordres
  scriptede, øjeblikkelige klik-tempo — se `docs/FRAVALGT-175.md` punkt 4
  for hvorfor. Rettelsen er billig og harmløs, og forventes at hjælpe i
  virkelig brug (hvor der går længere tid mellem klik), men det er en
  rimelig slutning her, ikke en målt kendsgerning.
- **Rettelse 3 (vis top 25):** INGEN målbar TTI/perf-gevinst på atletlisten
  — 45 attrap-atlet-rækkers DOM-vægt var aldrig den reelle flaskehals
  (netværkskaldene er det, se Hvad er næste). Rettelsen står fordi den er
  billig og korrekt i princippet, ikke fordi den løser det målte problem.
  Fuld ærlighed fremfor at kalde den en sejr, se `docs/FRAVALGT-175.md`.

**npm run lint:** rent gennem alle tre commits.

**Enhedstests:** `node --test src/*.test.js` — 143/143 grønne (ingen af de
tre rettelser rører kode med egne enhedstests).

**Verify-scripts:** alle 31 `verify:*`-scripts kørt, alle grønne.

**npm run e2e:** grøn (`atlet → coach, ende-til-ende`) — kørt både før og
efter de tre rettelser, ingen regression. `npm run e2e:coach` kørt separat
efter hver rettelse undervejs.

**npm run maal:telefon** (ordre 173's værktøj, regressionstjek): grøn —
ordre 175 rører ikke `src/App.jsx` eller `src/AthleteView.jsx`.

**npm run maal:coach-telefon:** grøn — se Testresultat.

## Hvad er næste

Se `docs/FRAVALGT-175.md` for den fulde, kodefrie liste med pris/gevinst.
Kort opsummeret, i prioriteret rækkefølge:

1. **Atletlistens ~5,8s TTI** — den klart største uløste flaskehals, kræver
   en ægte gennemgang af Dashboard.jsx's data-hentningsstrategi (hvad skal
   være klar FØR første tegning, hvad kan komme lidt efter). Egen ordre.
2. **Den tilbagerullede fjerde rettelse** (Indbakke-regressionen) — værd at
   forsøge igen med bedre værktøj (en trace, ikke kun før/efter-tal) til at
   forstå PRÆCIS hvorfor at springe et redundant kald over gør en anden
   skærm langsommere.
3. Har betydning for Hara (mærkbart bedre-sporet): coachens side er Marcs
   eget daglige arbejdsredskab — en ~5,8s ventetid på den skærm han åbner
   først, hver gang, er formentlig en del af den oplevede "arbejder ikke
   smooth", uafhængigt af de tre billige rettelser her.

## Ærlige grænser

- Målt mod `e2e/mock-supabase.mjs` (lokal mock), ikke en rigtig
  Supabase-instans, over localhost. 45 attrap-atleter (plus testatleten) —
  et tal jeg selv valgte for at kunne teste listeskalering, ikke Marcs
  rigtige atletantal.
- Atlet-rækkens klik lander på `program`-fanen (ikke `hub`, selvom
  `openProfile`s standardparameter siger det) — "Check-in-gennemgang" og
  "Atletens uge" koster derfor begge 2 klik fra forsiden, ikke 1.
- Atletlistens "40 netværkskald" er Lighthouses egen audit-optælling under
  simuleret 4x CPU/langsomt net — en uafhængig kontrol med ægte
  `page.on('request')` (ingen Lighthouse, ingen simuleret throttling) viste
  16 kald på en enkelt kold genindlæsning. Begge tal peger samme vej
  (atletlisten laver mange kald), men de er ikke direkte sammenlignelige —
  nævnt åbent fremfor at vælge det tal der ser bedst/værst ud.
- Rettelse 3 (vis top 25) gav ingen målt gevinst på selve atletlisten — se
  Testresultat og Fravalgt-listen. Den er ikke fjernet igen, fordi den er
  billig, korrekt og skalerer bedre ved et fremtidigt større atletantal —
  men den skal ikke tælles som en løsning på det målte problem.
- Den fjerde, tilbagerullede rettelse viste et REELT fald i netværkskald
  (11→1) men også en reproducerbar renderings-regression jeg ikke kunne
  forklare inden for denne ordres tid — dokumenteret ærligt i stedet for
  enten at skjule den eller levere den uforstået.

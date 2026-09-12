# RAPPORT-131 — stille fejl, runde 5: hele atletens dag

## Gren

`stille-fejl-5`, base `main` (`690edd7`, ordre 127 med). Fire commits:

- `a6855d2` — commit 1: katalog G14-G16 (`docs/STILLE-FEJL-5.md`), ingen kodeændring
- `e0ad404` — commit 2: G14/G15/G16 rettet — atleten får det at vide
- `ad1fc13` — commit 3: Marc får det at vide (session_context-resumé i coach-visningen)
- (denne rapport) — commit 4: ærlig sammenfatning

Filer: `src/AthleteView.jsx`, ny `src/athleteSilentFailLog.js` (+ test),
ny `src/AthleteSilentFailNote.jsx`, `src/Dashboard.jsx` (to linjer, se
nedenfor), to nye verify-scripts, `package.json` (to nye `verify:*`).
`docs/STILLE-FEJL-5.md` (katalog + sammenfatning). Ingen skema, ingen SQL,
ingen migration, ingen push, ingen nye afhængigheder. `videocoach.html`
urørt (gennemgået, ingen nyt fund der krævede ændring der). Ingen
atletdata i kode, tekst eller test.

## Hvad ændret

**Commit 1 — kataloget**: hele atletens dag gennemgået igen (login →
dagens pas → opvarmning → sæt-logger → check-in → videocoach → logout)
med de otte fejlscenarier fra ordren. Tre nye fund af høj/mellem alvor
(G14-G16), resten af dagen allerede dækket af tidligere runder eller
vurderet robust. Se `docs/STILLE-FEJL-5.md` for den fulde tabel.

**Commit 2 — G14/G15/G16, atleten får det at vide**:

- **G14** (`logSet`s PR-detektion): `INSERT` på `personal_records` blev
  aldrig fejltjekket — en fejlet skrivning viste alligevel "PR!"-fejringen.
  Går nu gennem `queueWrite` (samme genforsøg-med-backoff som resten af
  skrivningerne); fejringen (`setPrToast`) står nu i `else`-grenen af et
  eksplicit fejltjek, samme mønster som den SELECT-fejl logikken allerede
  håndterede korrekt (F6, ordre 41) — samme rettelse udvidet til søster-
  INSERT'en.
- **G15** (`logWeight`): hverken `update` eller `insert` på `weight_logs`
  blev fejltjekket; feltet ryddedes uanset udfald. Går nu gennem
  `runGuardedWrite` (samme garde som `skipSet`/`saveFeedback` m.fl.); ved
  fejl vises "Vægten blev ikke gemt. Tjek din forbindelse og prøv igen."
  og feltet BEVARES, så atleten ikke skal taste tallet igen.
- **G16** (afbrudt "upload og gå"): lukkes/genindlæses fanen midt i selve
  videooverførslen, når ingen kode nogensinde færdig — hverken succes-
  eller fejl-håndtering når at køre. En inflight-markør (`localStorage`,
  pr. atlet) sættes FØR `storage.upload()` og ryddes af `reply()`-
  lukningen ved ethvert bekræftet udfald (succes, fejl, annullering). Ved
  næste app-åbning viser en fundet, ikke-ryddet markør at forrige session
  sluttede uden et bekræftet udfald; atleten får en forklaring
  ("Din seneste video blev muligvis afbrudt...") og opfordres til at
  sende igen.

Ny `src/athleteSilentFailLog.js` (rene funktioner, samme stil som
`readinessDraft.js`): en whitelistet kø af stille-fejl-koder
(`silent:pr-insert-failed`, `silent:weight-log-failed`,
`silent:video-upload-interrupted` — samme forsigtighed som
`PLATE_CALIBRATION_REASONS` i `videoCoachUpload.js`, aldrig fri tekst),
plus inflight-markør-funktionerne til G16. Modulet rummer også de to
funktioner commit 3 bruger (`attachPendingSilentFails`/
`clearPendingSilentFails`) — introduceret samlet her, da det er ét lille,
sammenhængende modul, ikke fordi de hører logisk til commit 2 alene.

**Commit 3 — Marc får det at vide**: de whitelistede koder tømmes ind i
`video_analyses.session_context` (feltet findes allerede — ingen
migration, samme felt ordre 109 · commit 3 brugte til kalibreringsårsagen,
bekræftet med et read-only skema-opslag, se "Ærlige grænser") ved
atletens NÆSTE videoanalyse, både "upload og gå"- og den ældre,
sideløbende `save-draft`-vej (`vcV3RequestSave` — ordre 109 dokumenterede
dengang at netop DEN vej ikke bar kalibreringsårsagen; samme rettelse
lukker det hul for stille-fejl-koderne her). Koderne lægges i rækken FØR
den forsøges gemt, men ventekø'en ryddes lokalt først EFTER en bekræftet
gemning (eller en bekræftet lokal kø-indsættelse for `save-draft`-vejens
retry-sti) — en fejlet gemning taber derfor ikke koderne.

Ny `src/AthleteSilentFailNote.jsx`: selvstændig komponent der henter sine
egne data (kun `session_context, created_at` for den valgte atlet — ingen
andre kolonner, ingen atletdata udover koder og tidsstempler) og viser én
linje i coachens atlet-visning, fx "Atleten havde netproblemer 2 gange i
denne uge", når der er stille fejl inden for den seneste uge. `null` (intet
vist) når der ingen er.

`Dashboard.jsx` (Vaidyas fil) er kun rørt to linjer, begge markeret "ORDRE
131 · commit 3":
- **linje 19**: `import AthleteSilentFailNote from './AthleteSilentFailNote'`
- **linje 5318**: `<AthleteSilentFailNote key={selectedAthlete?.id} athleteId={selectedAthlete?.id} />`,
  placeret lige før "Kropsvægt"-kortet i atlet-detaljepanelet (samme sted
  `weightChartData`/`fetchVideoCoachHistory` allerede bruges, så panelet
  entydigt er scoperet til `selectedAthlete`).

**Commit 4 — denne rapport + opdateret `docs/STILLE-FEJL-5.md`** med
"rettet/ikke rettet og hvorfor" pr. fund.

## Testresultat

- `npm run lint` — **0 fejl**, 13 præeksisterende `react-hooks/exhaustive-deps`-
  advarsler (samme antal og samme linjer som før denne ordre — ingen nye).
- `node --test src/*.test.js` — **133/133 grønne**, heraf 17 nye i
  `athleteSilentFailLog.test.js` (whitelist, ventekø, 7-dages-afgrænsning,
  maks. 5 ventende, inflight-markør, `summarizeSilentFailsForCoach`).
- Alle 31 `verify:*`-scripts kørt (inkl. de to nye):
  - `verify:athlete-silent-fails-5` (ny) — **GRØN**, bekræfter G14/G15/G16
    statisk i kildeteksten.
  - `verify:athlete-silent-fail-visibility` (ny) — **GRØN**, bekræfter
    session_context-tømningen (begge gemme-veje), Dashboard.jsx kun rørt
    det ene tilladte sted, og at coach-komponenten kun henter
    `session_context, created_at`.
  - Alle øvrige 29 — **GRØNNE**, med én PRÆEKSISTERENDE undtagelse:
    `verify:videocoach-clip` fejler på timing-tolerancen ("Vis mig nu" tog
    1.28x sin afspillede varighed, grænse 1.1x) for
    `test-clips\vis-mig-nu-4-reps-syntetisk.mp4`. Samme klasse fejl som
    RAPPORT-109 dokumenterede ("en timing-sag, ikke en kalibrerings-sag,
    uden for dette ordres omfang") — bekræftet urelateret her: intet i
    denne ordre rører `public/videocoach.html`, sporing eller
    "Vis mig nu"-tidtagning. Ikke rettet, som tidligere rapporter.

## Hvad er næste

- **G16's Marc-synlighed kræver at atleten når en ny videoanalyse.**
  Koden lægges i NÆSTE `video_analyses`-rækkes `session_context` — bruger
  atleten ikke videocoach igen efter en afbrudt upload, ser Marc det
  aldrig i étlinje-resuméet (kun i `frontend_errors`, ikke i coach-UI'en).
  At lukke det hul kræver enten et nyt, athlete-scoped felt uden om
  `video_analyses` (migration) eller Marcs dom om det er værd at rette —
  begge dele uden for denne ordres grænser.
- **Madlogning** (`deleteTemplate`, `saveCustomFood` — opdaget under
  gennemgangen, men uden for ordrens gå-igennem-liste) har svage,
  utjekkede skrivninger af samme (lave) alvor som F3. Kandidat til en
  fremtidig, navngiven "stille fejl, runde 6" der dækker kost/beskeder
  eksplicit.
- **F3** (`markTrackRead`) står stadig urettet — uændret vurdering fra
  ordre 76 (lav alvor, kun en ulæst-badge).
- Login (`Auth.jsx`) blev gennemgået (del af "hele dagen") men er ikke
  Bhishaks filområde — ingen ændring lavet eller nødvendig der.

**Betydning for Hara**: alle tre commits lukker samme klasse fund som
runde 1-4 — data eller bekræftelse der stille forsvinder eller viser
forkert for atleten (en falsk PR-fejring, en vægt der ser gemt ud men
ikke er det, en video der forsvinder sporløst), plus en ny evne: fejl der
IKKE kan vises for atleten med det samme (fordi hele appen kan være
lukket/genindlæst) bliver nu i det mindste synlige for coachen bagefter.
Relevant for delmålet "Appen mærkbart bedre" under Coaching-planeten.

## Ærlige grænser

- **Ingen levende attrap-server bygget.** Ordren beder om at gå hver vej
  igennem "med attrap-server og fejl injiceret" — samme begrænsning som
  alle tidligere stille-fejl-runder: fundene er sporet ved statisk
  kildelæsning (hvert Supabase-kald vurderet mod de otte fejlscenarier)
  og bekræftet med hermetiske enhedstests af selve logikken
  (`athleteSilentFailLog.test.js`) samt statiske verify-scripts der låser
  KILDETEKSTENS struktur — ikke en render-baseret test af de faktiske
  React-komponenter mod en rigtig eller mocket Supabase-klient, og ikke en
  faktisk afbrudt netværksforbindelse i en browser. Lokal dev peger på
  produktions-Supabase, og der er ikke oprettet en testkonto.
- **Ét read-only skema-opslag mod produktions-Supabase blev brugt** (via
  MCP, `information_schema.columns` for `athletes` og `video_analyses`) —
  IKKE for at læse eller skrive atletdata, men for at bekræfte at
  `session_context` rent faktisk kun findes på `video_analyses` (og ikke
  fx også på `athletes`), før commit 3 blev designet. Ingen skrivning, og
  ingen rækker/atletdata blev læst — kun kolonnenavne og datatyper.
- **`queueWrite`-genforsøg på PR-INSERT'en (G14) har samme teoretiske
  dublet-risiko som `persistSetLog`s eksisterende brug af `queueWrite`**:
  lykkes skrivningen server-side, men går svaret tabt (fx en droppet
  forbindelse lige efter commit), kan et genforsøg i teorien indsætte en
  dublet-PR. Samme accepterede afvejning som allerede findes andre steder
  i koden (ikke ny risiko introduceret af denne ordre) — ingen unik-
  begrænsning fundet på `personal_records` ved skema-opslaget ovenfor.
- **G16-detektionen kan i teorien give et falsk positiv** hvis appen selv
  bliver dræbt (proces-crash, ikke bare fane-lukning) PRÆCIS mellem
  `reply()`s `clearUploadInflight`-kald og selve `postMessage`-afsendelsen
  — et ekstremt smalt tidsvindue, ikke testet levende.
- **`verify:videocoach-clip`s præeksisterende timing-fejl** (se
  Testresultat) er urørt, som i RAPPORT-109.
- Ingen atletdata læst, hentet eller kopieret nogen steder i denne ordre.

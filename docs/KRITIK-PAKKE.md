# Kritikerpakke — coaching-appen (entropi-app)

Formål: giv en ekstern kritiker (ChatGPT) alt hvad der skal til for at være
kritisk over for Sonnets arbejde på denne app, uden at kunne vedhæfte selve
repoet (for stort, atletdata bag login). Sæt direkte ind uden forklaring.

## 1. Prompt til kritikeren

Du skal være kritisk over for en coaching-app til styrkeløft (dansk,
mobil-først for atleten, desktop/iPad for coachen). ~10 atleter, én coach
bruger den aktivt i dag. Fem spørgsmål:

1. **Hvor er arkitekturen skrøbelig?** Klienten taler direkte med Supabase
   (ingen backend-lag), sikkerhed hviler på Postgres RLS-policies alene, og
   video-bar-tracking ligger i én selvstændig, ikke-bundlet HTML-fil på
   ~10.150 linjer (`public/videocoach.html`).
2. **Hvilke af de sidste to ugers ændringer (liste nedenfor) lugter af
   hurtige lappeløsninger** frem for rigtige rettelser?
3. **Hvad mangler i testdækningen?** 32 `verify:*`-scripts, ingen ende-til-
   ende-test mod en rigtig backend (kun statisk kildelæsning, syntetiske
   klip og isolerede harnesses med attrap-data).
4. **Hvad ville en atlet på en gammel telefon i en hal opleve?** Dårligt
   netværk, en skærm i sollys, én hånd fri.
5. **Hvilke tre ting ville du gøre først** hvis du overtog appen i morgen?

Vær konkret: nævn fil og begrundelse for hvert fund, ikke generiske råd.

## 2. Arkitektur

- `src/App.jsx` (173) — indgang: session/rolle-opslag mod `profiles`, lazy-
  loader `Dashboard` eller `AthleteView` efter rolle.
- `src/Auth.jsx` (275) — login, oprettelse, glemt adgangskode.
- `src/supabase.js` (197) — klient, `warmupAuth`, `queueWrite`/`withRetry`
  (genforsøg med backoff, retter en cold-start-bug).
- `src/AthleteView.jsx` (6.563) — hele atletens flow i én fil: dagens pas,
  opvarmning, sæt-logger, check-in, videocoach-broen.
- `src/Dashboard.jsx` (5.858) + `src/dashboard/AnalyseTab.jsx` (1.050),
  `ProgramTab.jsx` (988), `IndbakkeView.jsx` (187) — coachens visning,
  splittet i lazy-loadede chunks (ordre 130/137) for mindre første-hent.
- `src/dashboardShared.js` (197), `src/dashboardCharts.jsx` (121) — delte
  stilarter/hjælpefunktioner/graf-komponenter mellem chunks.
- `public/videocoach.html` (10.156) — selvstændig statisk fil (bar-
  tracking, `autoCalib`, "Vis mig nu"), bevidst ikke bundlet med Vite.
- ~30 domænemoduler i `src/*.js` (readinessDraft, warmup,
  athleteSilentFailLog, videoCoachSubmission m.fl.), hver med matchende
  `*.test.js`.

**Dataflow**: atlet logger i `AthleteView.jsx` → direkte Supabase-kald
(`sets`, `readiness`, `weight_logs`, `video_analyses` …) → Postgres,
adgang styret af RLS-policies pr. tabel → coach ser samme tabeller i
`Dashboard.jsx`, filtreret på valgt atlet.

**Videocoach-broen**: `AthleteView.jsx` renderer `public/videocoach.html`
i et `<iframe>` og udveksler `postMessage` begge veje (config ind,
upload-/save-resultat ud, ~linje 1930-2120 i `AthleteView.jsx`).

**Upload og gå**: atleten uploader og kan lukke fanen med det samme; en
`localStorage`-inflight-markør (ordre 131) opdager afbrudte overførsler.
Analyseresultat/diagnostik genbruger samme JSON-felt
(`video_analyses.session_context`) til flere formål på tværs af ordrer.

## 3. Ændringsliste, ordre 105-139 (én linje pr. ordre)

- **109** (videocoach) — atleten sad fast når skive-genkendelse fejlede;
  rettet med manuel 2-kliks-kalibrering + ring-bekræftelse. Grænse: kun
  "upload og gå"-vejen bærer kalibreringsårsagen til coachen.
- **116** (videocoach) — forsøgte at lukke "Vis mig nu"s 1,1x-realtidskrav.
  Grænse: browserens egen seek-latens gør 1,1x uopnåeligt på et kort klip.
- **120** (videocoach) — `autoCalib` finder nu mørke skiver (kontrast/
  farve/ring-scoring). Grænse: en lys nav nær centrum kunne stjæle fundet
  (rettet først i ordre 127).
- **121** (videocoach) — fjernede dobbelt-seek, byggede første syntetiske
  multi-reps-klip. Grænse: klippets eget facit var fejlbehæftet.
- **123** (app-måling) — målte appen på telefon (axe/Lighthouse/44px),
  rettede labels/trykflader. Grænse: målinger er isolerede harnesses, ikke
  den fulde, monterede app; farvekontrast bevidst urørt.
- **124** (videocoach) — rettede en ægte race-condition (dobbelt-seek) i
  produktionskoden. Grænse: muligt utilsigtet samspil med ordre 120, ikke
  undersøgt.
- **126** — rettede tre røde verify-scripts (2 forældede, 1 CRLF-
  miljøproblem) + sidste 44px-trykflader. Grænse: CRLF-fix kun lagt hvor
  det faktisk fejlede.
- **127** (videocoach) — nav-vagt retter skive/nav-forveksling, 44px på
  desktop-faner. Grænse: tærskler håndkalibreret mod ét syntetisk tilfælde.
- **130** — `Dashboard.jsx` splittet i lazy-chunks (28% mindre JS for
  atletliste/check-in). Grænse: målt i isolerede harnesses med attrap-data.
- **131** — PR-fejring/vægt-log/afbrudt upload fejltjekkes nu og fortælles
  til atlet/coach. Grænse: ingen levende attrap-server med injicerede fejl.
- **134** (videocoach) — fandt en lovende men **ikke shippet** løsning
  (skjult video-klon, 1,35x→1,14x) for "Vis mig nu"; rettede en usynlig
  diag-linje på telefon. Grænse: 1,1x stadig ikke nået.
- **137** — rebasede coach-splitten oven på ordre 131, video-knapper til
  44px, Coach Briefing-placering dokumenteret (A/B, afventer Marc).
- **138** — nul lint-advarsler (13 rettet), rent træ. Grænse: ingen levende
  browser-verifikation af omstruktureringerne.
- **139** (videocoach) — bygger et realistisk syntetisk testklip fra
  Marcs eget rep-vindue; manifest styrer krav pr. klip. Grænse: kilde-
  rep-vinduet er hardcodet, ikke fundet dynamisk.

(Kilde: `docs/RAPPORT-*.md` og `docs/videocoach/RAPPORT-*.md` — de eneste
rapportfiler der findes i det navngivne interval. Andre ordrenumre i
105-139 har ikke en fil i dette navnemønster.)

## 4. Kendte huller (vi ved det allerede)

- **Kontrast-paletten**: axe rapporterer "serious" farvekontrast på alle
  målte skærme (både atlet og coach) — bevidst urørt, kræver en
  designbeslutning om selve paletten, ikke en lokal rettelse.
- **Coach Briefing, A/B**: er i dag Indbakken (`view === 'inbox'`), ikke en
  selvstændig visning — to muligheder dokumenteret, afventer Marcs valg.
- **Sort skive med lys nav**: nav-vagten i `autoCalib` er håndkalibreret
  mod ét syntetisk tilfælde, ikke bekræftet på en ægte mørk-skive-optagelse.
- **1,1x-grænsen** ("Vis mig nu"): ikke nået. Bedste ærlige tal er 1,14x
  med en løsning (skjult video-klon) der ligger klar men ikke er portet
  til produktion eller afprøvet på en rigtig telefon.
- **Ingen rigtig magic-link-test**: login/adgangskode-flow er verificeret
  statisk og via harness, ikke mod et ægte magic-link-kald i browser
  (adaptivt — til orientering, ikke et lukket hul denne pakke retter).

## 5. Sådan læser kritikeren koden (fem filer, i rækkefølge)

1. `src/App.jsx` — rolle/session, hvordan appen forgrener.
2. `src/supabase.js` — klienten, retry/warmup-mønsteret alt andet bygger på.
3. `src/AthleteView.jsx` — atletens fulde flow + videocoach-broen.
4. `src/Dashboard.jsx` og `src/dashboard/*.jsx` — coachens visning.
5. `public/videocoach.html` — bar-tracking, selvstændig fra resten af appen.

## 6. Svarformat

En tabel: `fil/ordre | fund | alvor | forslag`. Alvor: lav/mellem/høj.
Forslaget skal være konkret nok til at sætte ind uden yderligere kontekst.

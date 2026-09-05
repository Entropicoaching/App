# ORDRE 57 — Upload og gå

Gren: `upload-og-gaa` (fra `main` `c4175f2`, ORDRE 54 allerede merget)

Commits:
- `58e84d9` — commit 1: atletens standardvej uploader videoen, ingen sporing på telefonen
- `6c0bfa1` — commit 2: coachens side — afventende analyser, ét klik til sporing
- `2eed91c` — commit 3: belastning, RPE og note tilbage i samme trin

Filer: `public/videocoach.html` (kirurgiske tilføjelser, ikke omskrevet),
`src/AthleteView.jsx`, `src/Dashboard.jsx`, `src/videoCoachSubmission.js`
(én ny mulighed: `updateClientAnalysisId`), ny fil `src/videoCoachUpload.js`
(stibygger, validering, rækkebygger — rene funktioner, ingen Supabase-kald),
ny `scripts/verify-videocoach-upload.mjs` + udvidelser af
`scripts/verify-videocoach-submission.mjs`, og migrationsfilen
`supabase/migrations/20260905_video_upload_and_go_v1.sql` (dokumentation —
allerede kørt på produktion, ingen SQL kørt herfra).

Ikke rørt: coach-tilstandens tracker/skiveringens klik-logik, benkæden,
bænkens skulderanker, sættets start (ORDRE 43/45/47/50), `public/videocoach.html`
er ikke omskrevet.

## Opgaven

ORDRE 54 gjorde ventetiden *opleves* kortere, men atleten skulle stadig lade
skærmen stå åben til sporingen var færdig, fordi ægte "film og send" krævede
videolagring, som ikke fandtes. Marc har nu sagt ja, Dhruva har kørt
skemaændringen. Denne ordre bygger den anden halvdel: hun filmer, sender, og
lægger telefonen i tasken. Sporingen sker først, når coachen åbner videoen.

## Commit 1 — atletens standardvej: vælg video, send, færdig

**Trin for trin, som hun oplever det:**
1. Åbner VideoCoach fra sin profil, vælger/optager en video.
2. Sendearket ("Send videoen") åbner automatisk — ingen anden skærm
   imellem. Hun vælger løft og variation (påkrævet), og kan valgfrit skrive
   belastning/RPE og en note til coachen (commit 3).
3. Trykker "Send til coach". Filen uploades til `videocoach-uploads` på
   stien `<athlete_id>/<client_analysis_id>.<ext>` (ext udledt af filens
   mime-type — aldrig af filnavnet). Den eneste ventetid er selve
   overførslen, vist som "Sender video (X MB) ..." — ingen sporing kører.
4. Når uploaden lykkes, indsættes én række i `video_analyses` med
   `analysis_state = 'awaiting_analysis'` og `video_path` sat. Skærmen siger
   "Sendt til din coach" / "Video modtaget ✓ · din coach ser den, når han
   åbner den" — bevidst IKKE "analysen er på vej", for der sker intet før
   coachen selv åbner den.

**Fejler uploaden** (net, størrelse, mime): filen forbliver valgt
(`vcAthletePendingFile` røres ikke), hun får én klar besked
(`Videoen blev ikke sendt · <årsag>`) og "Prøv at sende igen"-knappen kører
nøjagtig samme forsøg igen — samme sti, samme klient-id. Lykkes uploaden
anden gang, men rækkens indsættelse fejlede første gang, genkendes den
allerede-uploadede fil som en idempotent gentagelse (storage svarer 409/
"already exists", som IKKE er en fatal fejl) — kun rækken forsøges igen,
filen uploades ikke to gange. Der er bevidst ikke bygget en ny offline-kø
til videofiler; den eksisterende kladdekø i `videoCoachSubmission.js` er
til rækker, ikke filer, og passer ikke til den slanke, analyseløse række vi
indsætter her (den ville blive afvist af `validateVideoCoachPayloadBounds`,
som forudsætter en fuldt sporet analyse).

**Ringen (bekræft skivens position) hører til sporingen, ikke til
upload — standardvejen springer den helt over.** Intet går tabt: ringens
eneste formål var kalibrering (cm-per-px) til LOKAL sporing på telefonen.
Da standardvejen ikke sporer noget lokalt, er der intet at kalibrere til.
Kalibreringen sker i stedet, når coachen selv åbner videoen i
coach-tilstand (commit 2) — nøjagtig samme klik-ring-bekræft-interaktion,
han allerede kender fra enhver video, han sporer fra sin egen telefon.
Ingen ny coach-UI var nødvendig for det.

**"Vis mig nu" og "Start" (den valgfrie forhåndsvisning fra ORDRE 54)
lever videre som "den anden vej":** vælger hun i stedet at bekræfte ringen
og trykke Start/Vis mig nu, kører den lokale sporing (3 reps eller hele
sættet) som før, ren og skær til hendes eget "se banen nu"-øjeblik — men
bagefter uploades videoen på nøjagtig samme måde som standardvejen, i
stedet for at auto-sende de sporede tal. `vcAthleteAutoSubmit` (ORDRE 54's
auto-send af FÆRDIGE tal) er fjernet; den fulde lokale analyse er ikke
længere noget, telefonen selv sender videre. Sidegevinst: "Vis mig nu"
sporede tidligere sættet TO gange (3 reps til forhåndsvisning + 8 reps i
baggrunden til afsendelse) — det dobbelte forbrug er væk, for baggrunds-
sporingen er ikke længere nødvendig, når coachen alligevel sporer selv.

## Commit 2 — coachens side: afventende analyser, ét klik til sporing

I den samlede indbakke (prioritetskøen) og i den enkelte atlets
analyse-fane er en `awaiting_analysis`-række et eget, enklere kort:
"Afventer sporing", løft, variation, "Modtaget [dato]" — ingen tal, ingen
godkend/udelad-knapper (der er intet at tage stilling til endnu). Ét klik
på "Spor nu →":
1. Henter en kortlivet (10 min) signeret URL til videoen
   (`storage.createSignedUrl`).
2. Åbner coach-VideoCoach med atlet, løft og variation forudfyldt, og
   indlæser videoen direkte fra den signerede URL (`video.crossOrigin =
   'anonymous'`, så canvas'et ikke bliver "tainted" af en cross-origin-kilde
   — nødvendigt for at trackeren kan læse pixels).
3. Coachen kører den fulde, helt uændrede sporing selv — samme klik-ring-
   bekræft-⚡-flow som enhver anden analyse.
4. Når han trykker Send, opdateres SAMME række (`client_analysis_id` er
   nøglen — `saveVideoCoachDraft` fik en ny `updateClientAnalysisId`-mulighed,
   der laver et rent `UPDATE ... WHERE client_analysis_id = ...` i stedet
   for `INSERT`): metrics, bar_path, reps, rep_details, versioner sættes,
   `analysis_state` bliver `'complete'`. Der oprettes aldrig en ny række ved
   siden af — bekræftet i en hermetisk test (se Verifikation).

To sikkerhedsdetaljer, der ikke stod eksplicit i ordren, men som fulgte af
at læse skemaet grundigt:
- **`bias_note` tvinges til `null`**, når rækken er en `athlete_submission`
  (både ny og fuldført), fordi databasens
  `video_analyses_v3_payload_bounds`-tjek kræver `bias_note is null` for den
  kilde. Uden dette ville coachens EGEN notat-felt (som stadig vises i
  coach-UI'en) stille få gemmet til at fejle, hvis han tilfældigt skrev i
  det, mens han fuldførte en atlet-video. Ikke synligt markeret i UI'en —
  se "Hvad er næste".
- **Skifter coachen atlet i dropdown'en, mens en afventende video er åben**,
  afviser gemmet med en klar fejl i stedet for at flytte videoen til den
  forkerte atlet (kontrolleret på appens side, ikke kun i databasens RLS).

## Commit 3 — belastning, RPE og note tilbage

De tre felter, ORDRE 54 gjorde utilgængelige (fordi afsendelsen blev
automatisk), er tilbage i sendearket fra commit 1 — samme trin, ingen
ekstra skærm, ingen af dem påkrævet. `vcAthleteUploadAndGo` læser dem og
sender dem med; hvis hun i stedet vælger "Vis mig nu"/Start (den
avancerede vej), er felterne tomme, ligesom i ORDRE 54 (samme afvejning,
ikke noget nyt tab).

## Lagringsregnestykke

Ingen automatisk oprydning er bygget i denne ordre (bevidst udenfor
scope). Til grund for en beslutning:

- Et almindeligt sæt (film fra telefon, H.264 1080p, ~45-90 sekunder for et
  otte-reps-sæt) vejer typisk **30-90 MB**, oftest omkring **50 MB**,
  afhængig af telefonens kodningskvalitet og sættets længde.
- **10 atleter × 2 videoer om ugen** giver 20 videoer/uge. Ved 50 MB/klip:
  ~1,0 GB/uge → **~4,3 GB på en måned** (4,3 uger). Ved den brede grænse
  30-90 MB/klip: **~2,6-7,8 GB/måned**.
- Bucket-grænsen er 500 MB pr. fil (sat i migrationen) — et enkeltstående,
  usædvanligt langt eller ukomprimeret klip kan altså fylde langt mere end
  et typisk sæt.

Tallene vokser lineært med antal atleter og videoer/uge. Værd at beslutte,
når Marc har et reelt billede: en fast opbevaringstid (fx slet video efter
X dage/når analysen er godkendt), eller ingen oprydning overhovedet, hvis
lagerprisen er ubetydelig.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler,
  urørt af denne ordre).
- `npm run gate:tracker` — GRØN (trackeren er urørt; kørt som ekstra
  sikkerhed, da `vcV3DatabaseRow`/`buildV3AnalysisPayload` er ændret).
- `verify:videocoach-submission`, `verify:videocoach-labels` — grønne.
  Submission-scriptet har fået tre nye tests for `saveVideoCoachDraft`'s
  `updateClientAnalysisId`: en UPDATE opretter aldrig en INSERT ved siden
  af, rammer `client_analysis_id`, og udløser ALDRIG dublet-genforsøget
  (som kun giver mening for en INSERT).
- Ny `verify:videocoach-upload` (tilføjet, ikke krævet af ordren, men
  matcher dens eget testkrav) — grøn: stibyggeren (mime → ext, aldrig
  filnavn), en tjekliste-for-tjekliste-verifikation af den afventende
  rækkes payload mod `entropi_vc3_athlete_insert_own_draft`s WITH CHECK
  (kopieret ind som konkrete assertions), idempotent genkendelse af en
  gentaget upload-sti, og at migrationsfilen indeholder de aftalte
  skema-stykker og "allerede kørt"-linjen.
- `node --check` af det udtrukne hovedscript i `videocoach.html` — fejlfrit
  efter hver commit.
- Headless (Claude-in-Chrome) mod en lokal `vite`-server: atlet- og
  coach-tilstand loader uden konsolfejl; sendearket viser præcis Løft +
  Variation i commit 1, og alle fire felter (inkl. Belastning/RPE og Notat)
  efter commit 3; guard-beskederne ("Vælg squat, bænkpres eller dødløft
  først" / "Åbn en video først") virker; `vcAthleteUploadAndGo` blev kørt
  direkte i browseren med en syntetisk fil og bekræftet at sende
  `loadKg`/`rpe`/`athleteNote`/`lift`/`variation`/`mimeType` korrekt videre;
  `buildV3AnalysisPayload`/`vcV3DatabaseRow` blev kørt direkte i coach-
  tilstanden og bekræftet at sætte `analysis_state: 'complete'`, bevare
  `client_analysis_id` ved en fuldførelse, og tvinge `bias_note` til `null`
  KUN for `athlete_submission`-rækker (ikke for almindelige coach-analyser).
- Appen har ingen samlet `npm test`-kommando (uændret siden ORDRE 54).

## Beviset, Marc skal levere

Jeg kan ikke logge ind mod produktion, og skal heller ikke — selve beviset
er hans: én rigtig video fra hans telefon.

**Skærm 1 (atlet):** vælg/optag en video, vælg løft+variation (evt.
belastning/RPE/note), tryk Send. Kig efter: "Sender video (X MB) ..." mens
den overføres, derefter en tydelig "Sendt"/"Video modtaget"-besked — INGEN
sporings-UI (ingen ring, intet "Sæt start") undervejs. Læg telefonen i
lommen med det samme bagefter.

**Skærm 2 (coach):** åbn indbakken eller atletens analyse-fane. Kig efter:
et blåt "Afventer sporing"-kort med løft og "Modtaget [i dag]". Tryk
"Spor nu →" — videoen skal indlæses uden at skulle vælges som fil (kommer
fra den signerede URL). Kør sporingen som normalt, tryk Send. Kortet skal
nu forsvinde fra "afventer"-listen og dukke op som en almindelig,
færdig analyse — SAMME række, ikke en ekstra.

## Ærlige grænser

- **Ingen ægte video er testet.** Som i ORDRE 54's audit er der intet
  versioneret testklip i repoet, og jeg har ikke adgang til en rigtig
  telefon eller produktions-Supabase. Hele upload- og hente-vejen (File
  over `postMessage`, `storage.upload`, `createSignedUrl`,
  `video.crossOrigin` mod en signeret URL) er verificeret ved kildelæsning,
  hermetiske tests af de rene funktioner, og direkte funktionskald i en
  headless browser — IKKE en ende-til-ende-upload mod en rigtig bucket.
- **File/Blob over `postMessage` er standard webplatform-adfærd** (struktur-
  klonbar siden længe), men jeg har ikke kunnet bekræfte det for en
  flere-hundrede-MB-video på en rigtig mobil-browser i dette miljø.
- **CORS på den signerede URL er en antagelse.** Supabase Storage's REST-
  lag sætter typisk permissive CORS-headers på GET, hvilket er
  forudsætningen for at `video.crossOrigin='anonymous'` + canvas-læsning
  ikke fejler med en "tainted canvas"-sikkerhedsfejl. Jeg har ikke kunnet
  bekræfte det mod det rigtige bucket.
- **Ingen ægte upload-fremdrift (byte-for-byte).** `@supabase/supabase-js`
  v2's `storage.upload` er `fetch`-baseret uden fremdrifts-callback.
  "Simpel fremdrift med filstørrelse" er derfor en fast besked
  ("Sender video (X MB) ...") + spinner, ikke en procent-bjælke. En ægte
  procent-bjælke ville kræve en selvbygget XHR-upload i stedet for
  `supabase-js` — ikke bygget, da det er en større arkitekturændring, ordren
  ikke bad om.
- **Ingen cancel under selve uploaden.** ORDRE 54's "Annullér"-mønster for
  lokal sporing er ikke genskabt for netværksoverførslen (send-knappen er
  blot deaktiveret, mens den kører). Kan tilføjes, hvis det bliver et
  problem i praksis (fx via en `AbortController`).
- **Vælger hun "Vis mig nu"/Start i stedet for standardvejen, sendes
  belastning/RPE/note IKKE med** (de felter er tomme, siden sendearket ikke
  blev åbnet på den vej) — samme, bevidste afvejning som ORDRE 54's
  oprindelige begrænsning, nu kun relevant for den valgfrie vej.
- **`bias_note`-beskyttelsen (se commit 2) er stille.** Skriver coachen i
  sit eget notatfelt, mens han fuldfører en afventende atlet-video, gemmes
  noten ikke, uden at UI'en siger det. Værd at gøre synligt, hvis det
  opleves i praksis.
- **git-splitningen mellem commit 1 og commit 2 er ikke perfekt filmæssigt.**
  `public/videocoach.html` er én fil, og en lille smule coach-side
  "scaffolding" til commit 2 (fx `vcV3PendingCompletion`,
  `vcV3DisplayLift/Variation`, `load-remote-video`-håndteringen) blev
  skrevet sammen med commit 1's kode og landede derfor i commit 1's diff i
  stedet for isoleret i commit 2 — for at undgå risikoen ved at
  omhugge en allerede testet, sammenhængende ændring med `git add -p`.
  Kommentarerne i koden er mærket med hvilken ordre/commit de hører til.
- **Ingen rigtig mobil-gennemgang af det nye sendeark** (kun headless,
  ~500 px, samme værktøjsbegrænsning som i ORDRE 54's audit).

## Betydning for Hara

Under "Appen mærkbart bedre": atleten oplever nu det, ORDRE 54 lovede, men
ikke kunne bygge — vælg video, vælg løft, send, læg telefonen væk. Ingen
sporing, intet "hold skærmen åben". Coachen får en tydelig, handlingsklar
"afventer sporing"-kø og ét klik til at spore videoen selv, uden at nogen
data går tabt eller dubleres undervejs.

## Hvad er næste

- Mål den rigtige upload (tid, oplevet pålidelighed) på en rigtig telefon
  og et rigtigt mobilnet, når det er muligt — det er den eneste reelle
  bekræftelse af hele denne ordre.
- Bekræft CORS på `videocoach-uploads`-bucket'ens signerede URL'er mod
  produktion, før Marc regner med "Spor nu"-knappen i drift.
- Beslut en opbevaringspolitik for uploadede videoer ud fra
  lagringsregnestykket ovenfor.
- Overvej en synlig markering i coach-UI'en af, at notatfeltet stille
  ignoreres, når han fuldfører en atlet-video (se "Ærlige grænser").
- En rigtig procent-baseret upload-fremdrift, hvis "Sender video (X MB) ..."
  viser sig utilstrækkeligt i praksis.

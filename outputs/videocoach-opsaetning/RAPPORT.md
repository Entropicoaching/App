# ORDRE 43 — VideoCoachen skal foreslå i stedet for at spørge

Gren: `videocoach-opsaetning` (fra main `3e314d9`)

Commits:
- `582fc8e` — commit 1: mål opsætningstid og klik (baseline før optimering)
- `e31fa2e` — commit 2: keyframes foreslås fra bane (median-rep, rep-vælger)
- `075f255` — commit 3: opsætning huskes pr. atlet+løft (kalibrering + skelet-proportioner)

Filer: `public/videocoach.html` (kirurgiske tilføjelser, ikke omskrevet — 8 418
linjer nu, mod 8 042 før), `src/Dashboard.jsx` (én ny bridge-besked, samme
mønster som den eksisterende baseline-bro). `dist/videocoach.html` er en
git-ignoreret Vite-build-artefakt (kopieres uændret fra `public/` ved
`npm run build`) — rørt ikke, og der er intet at holde manuelt i sync: byg
genererer den. Ikke rørt: atlet-siden, klik-guiden, Coach Briefing (alle
ændret i dag af en anden ordre) — bekræftet ved `git diff` at kun de to
filer ovenfor er ændret.

## Metode

Læste hele opsætningsflowet i `videocoach.html` (kalibrering → skivens
midte → tracker → klik-skelet → gem) og coach-broen i `Dashboard.jsx` for
at forstå hvad der allerede findes, før jeg tilføjede noget. Vigtigt fund
undervejs: keyframe-auto-seek til klik-skelettets tre positioner (top/bund/
sticking point) fandtes allerede fra en tidligere runde — commit 2 er
derfor en **skærpelse** af en eksisterende mekanisme (præcis bund, median-
rep, kvalitetsgate, rep-skift), ikke en ny fra bunden.

Al ny matematik er verificeret tre steder:
1. **Isolerede enhedstests** — de rene funktioner (`mskelAnkleBarRatio`,
   `mskelApplyAnkleBarRatio`, `mskelPickMedianRep`, `mskelDeepestIndex`,
   `mskelKeyTimes`) udtrukket direkte fra `public/videocoach.html` og kørt
   i Node med syntetiske baner (11 assertions, alle grønne — se "Ærlige
   grænser" for hvorfor Node og ikke kun browseren).
2. **Levende browser, ægte kode-stier** — `npm run dev` + Chrome, siden
   åbnet med `?coach=1`. Da jeg ikke kunne få en syntetisk video til at
   afspille (se grænse nedenfor), drev jeg de FAKTISKE onclick-handlers og
   interne funktioner (`mskelBtn.click()`, `wizardClick(p)`, `mskelStep(p)`,
   knap-klik på de nye UI-elementer) med et syntetisk 3-reps-forløb og
   inspicerede den resulterende DOM/state direkte — ikke bare kodelæsning.
   Fandt og rettede undervejs et ægte lag-problem (se nedenfor).
3. **Regressionssuiten** — alle 7 `verify:videocoach-*`-scripts + `npm run
   lint`, grønne både før og efter hvert commit.

## Hvad blev bygget

**Commit 1 — mål før optimér.** Registrerer pr. analyse: tid fra video
indlæst til tracker kører (`setup_ms`), total tid til gemt kladde
(`total_ms`), og antal klik i selve opsætningen (kalibrering, skivens
midte, klik-skelet — IKKE spoling/afspilning, talt i canvas'ens
pointerdown-handler). Gemmes i den eksisterende `extra`-kolonne. Ingen ny
UI ud over Gem-knappens `title`-tooltip ("Opsætning: 8 klik · 12s til
trackeren kørte · 41s i alt") — synlig hvis Marc holder musen over/trykker
langt på knappen, ellers usynlig. Ingen tredjeparts-analytics.

**Commit 2 — keyframes foreslås fra bane.**
- **Bunden er banens faktiske laveste stangposition** i det valgte rep
  (`mskelDeepestIndex`, søger pixel-maksimum i et vindue om den
  excentriske fase), ikke længere kun fasegrænsen der detekterede reppet.
- **Median-dybde-rep vælges automatisk** ved flere reps
  (`mskelPickMedianRep`, bruger den allerede beregnede `romCm` pr. rep), så
  en enkelt afvigende rep (fx en let opvarmning, eller et rep hvor
  trackeren gled) ikke sætter dagsordenen. Ingen anden regel viste sig
  nødvendig — den specificerede (nærmest medianen) holdt i både test og
  levende gennemsyn.
- **Rep-vælger (◀ Rep 2/4 ▶)** lader Marc skifte til et andet rep, kun
  muligt før første klik i toppositionen (så et skift midt i placeringen
  ikke kan blande punkter fra to reps).
- **Kvalitetsgate:** kan trackeren ikke bære et forslag (rep.validRatio
  under 50%, eller ingen reps fundet overhovedet), sker der intet auto-seek
  — Marc lander præcis der hvor han trykkede ⚡, og finder positionerne
  manuelt som i dag. Meldes tydeligt: "Banen var for usikker til at
  foreslå positioner · find TOP manuelt".
- **Nap et keyframe et par frames:** de eksisterende ‹/›-frameknapper
  (`backS`/`fwdS`) viste sig allerede IKKE at afbryde en igangværende
  klik-skelet-placering (`disarmSession` rører aldrig `mskelClicks`) — så
  ingen ny nudge-UI var nødvendig, kun en henvisning til dem i
  statusteksten.
- **Rettelse fundet undervejs:** `mskelStickTimeRatio` normaliserede altid
  mod rep 1's varighed, uanset hvilket rep der rent faktisk blev klikket.
  Uskadeligt før (klikket var altid i rep 1), men rep-vælgeren ville have
  forvrænget torso-renderingen for ethvert andet valgt rep. Rettet til at
  finde det rep, tiden faktisk falder i.

**Commit 3 — opsætning huskes pr. atlet+løft+variation.** Ny bridge-besked
`prior-setup-request`/`-result` (samme mønster som den eksisterende
baseline-bro) henter `bar_path.cm_per_px` og en ny `extra.skeleton_
proportions` fra seneste `coach_approved`/`shared`-analyse for samme
atlet+løft+variation. Ingen skemaændring — begge felter ligger i
eksisterende jsonb-kolonner.
- **Kalibrering:** ét klik på skivens midte viser straks en ring i
  historikkens størrelse (markeret som forslag — stiplet blå ring +
  "FORSLAG · sidste gang", i stedet for den normale gule) i stedet for at
  skulle måle på ny. Én bekræft-tryk (⚡), eller ét træk i kanten hvis
  kameraet flyttede sig lidt. Positionen (x,y) foreslås bevidst IKKE — kun
  størrelsen (cm/px) — se "turde ikke automatisere" nedenfor.
- **Skelet-proportioner (kun ben-kæden: squat/dødløft):** hofte/knæ/skulder
  gemmes ikke som pixler, men som et komplekst tal — positionen relativt
  til ankel→stang-vektoren (`mskelAnkleBarRatio`). Det tal er en ren
  skala+rotation, uafhængig af hvor kameraet står. Ved næste analyse
  klikker Marc kun ankelen; resten af kæden lægges ud automatisk
  (`mskelApplyAnkleBarRatio`, matematisk verificeret: rund-tur-identitet OG
  korrekt skala/rotation ved ændret kamera-afstand/vinkel — se test 1).
  Punkterne er markeret tydeligt som forslag (stiplet ring), og Marc kan
  trække hvert af dem på plads, før han trykker "✓ Videre" — ét
  klik/træk gør forslaget til hans eget, præcis som princippet kræver.
- **Ingen historik → uændret opførsel.** Verificeret direkte: uden en
  matchende tidligere analyse forbliver `vcPriorSetup = null`, og
  kalibrering/klik-skelet følger nøjagtig samme kodesti som før ordren.

## Klikketallet før og efter

Talt ved at spore den faktiske klik-sekvens koden kræver (se metode punkt
2 — ikke en fysisk museklik-session, se grænse nedenfor):

| | Kalibrering | Klik-skelet (4 led × 3 faser) | I alt |
|---|---|---|---|
| **Før** (ingen historik) | 2 (auto-ring + bekræft) — 3 ved manuel fallback | 12 klik | **14–15** |
| **Efter** (med historik, ben-kæde) | 2 (samme antal, men fra et stabilt tidligere mål i stedet for en frisk, kan-fejle kant-gæt) | 3 ankel-klik + 3 bekræft-tryk = **6** | **8** |

Den reelle besparelse ligger næsten udelukkende i klik-skelettet (12 → 6,
halveret), som ordren selv pegede på som den tungeste post. Kalibreringens
klikTAL falder ikke nødvendigvis — dens PÅLIDELIGHED gør (en gemt måling i
stedet for et gæt der nogle gange kræver 3-kliks-fallback). For bænkpres
(arm-kæden) er der ingen ændring i klikantal — se nedenfor.

## Hvad jeg IKKE turde automatisere, og hvorfor

- **Kalibreringens position (x,y)** foreslås ikke, kun størrelsen
  (cm/px). Athleten/kameraet flytter sig lidt hver uge; at gætte HVOR
  skiven er ville kunne give en tavs fejlplacering, og et forkert sted er
  dyrere end at bede om ét klik.
- **Ingen stiltiende bekræftelse** noget sted — hverken kalibreringsringen
  eller skelet-forslaget anvendes uden et eksplicit tryk/træk fra Marc.
- **Bænkpres (arm-kæden) er helt uden for Commit 3.** Ordren nævner
  udtrykkeligt ankelen som ankerpunktet; arm-kæden har intet
  anatomisk analogt fastpunkt der er lige så pålideligt. Bænk bruger
  fortsat den fulde manuelle vej (12 klik), både med og uden historik.
- **Lockout blev ikke gjort til en fjerde, separat klik-fase.** Den
  eksisterende kode bruger allerede "TOP"-positionen som både
  "start af nedturen" og reelt "lockout" (samme fysiske stående/strakte
  position, målt før hhv. efter løftet) — at splitte den i to ville kræve
  at ændre den eksisterende, produktionsbrugte torso-vinkel-model
  (`mskelPoseAtDepth`/segmentlængder), en risiko jeg ikke vurderede
  nødvendig for at opfylde ordren.
- **Deadlifts lockout-position** (`topIndex = last.end`) er urørt — bruger
  fortsat SIDSTE rep, ikke det median-valgte. Ordrens "median rep"-krav
  handlede specifikt om BUNDEN/dybden; deadlift-lockout var ikke en del af
  det problem, og at ændre det uden grund var unødvendig risiko.
- **Lav-konfidens reps får intet delvist forslag.** Falder helt tilbage
  til manuel — ingen "bedste gæt" fra en bane trackeren mistede stangen i.

## Hvad koster stadig tid, som denne ordre ikke rører

- Den allerførste analyse af en ny atlet+løft+variation-kombination får
  ingen hjælp fra Commit 3 (intet at genbruge endnu) — kun Commit 2's
  bane-baserede forslag.
- Selve spolingen til "lige før løftet starter" før allerførste ⚡-tryk,
  og klip (trim ind/ud), er urørt.
- Selve tracker-kørslen tager stadig reel tid (0,25×–1× afspilning
  afhængig af enhed) — ikke en klik-ting, men den største enkeltpost i
  `setup_ms` for de fleste sæt.
- Bænkpres' klik-skelet er stadig fuldt manuelt (se ovenfor).
- Fri tekst-feedback/noter efter analysen er urørt.

Dette er de næste kandidater til en runde 2, når `setup_ms`/`setup_clicks`
fra Commit 1 har givet et par ugers rigtige tal at måle imod.

## Testresultat

- `npm run lint` — 0 fejl (12 præeksisterende React-hook-advarsler i
  `AthleteView.jsx`/`Dashboard.jsx`, urørt af denne ordre).
- Alle 7 `scripts/verify-videocoach-*.mjs` — grønne, både før og efter
  hvert af de tre commits.
- Hele det indlejrede script i `videocoach.html` parser fejlfrit
  (`new Function(...)` på det udtrukne script — ingen syntaksfejl).
- 11 isolerede enhedstests af den nye matematik (rund-tur-identitet,
  skala+rotation ved ændret kamera, degenereret ankel/stang → sikkert
  `null`, median-rep-valg, ufuldstændige data → sikker fallback,
  dybde-forfining, `suggested:false`-fallback ved lav konfidens/ingen
  reps) — alle grønne.
- Levende browser-gennemsyn (se metode punkt 2): rep-vælgeren viste og
  opdaterede korrekt ("Rep 3/3" → "Rep 2/3" efter ◀-tryk); ankel-klik
  udledte hofte/knæ/skulder matematisk korrekt (efterregnet i hånden);
  træk + "✓ Videre" ryddede forslags-markeringen og rykkede fasen videre
  korrekt; kalibreringsforslaget satte `cmPerPx` fra historikken og
  markerede ringen som forslag, uden at røre pixel-kant-detektionen.
- **Fundet og rettet i samme gennemsyn:** `#mskelRepNav`/`#mskelConfirmNav`
  lå (z-index 31) bag coach-headeren (`<nav id="vcSystemBar">`,
  z-index 40) under klik-skelet-placering — ville have gjort rep-vælgeren
  usynlig/uklikkelig i praksis. Rettet til z-index 41, genverificeret
  levende: knappen lå korrekt øverst efter rettelsen.

## Ærlige grænser

- **Ingen fuld, ende-til-ende gennemgang med en museklik-session på en
  rigtig video.** Miljøet her har hverken `ffmpeg` eller den `playwright`-
  runtime som `docs/videocoach/run-clean-rebuild-gate.mjs` selv kræver
  (peger på en Codex-specifik cache-sti der ikke findes her). Jeg forsøgte
  at generere en syntetisk testvideo i browseren selv (canvas +
  `MediaRecorder`/`captureStream`) — lykkedes med at producere en
  webm-blob, men Chrome kunne ikke afgøre dens metadata/afspille den
  (`videoWidth` forblev 0), formentlig fordi `MediaRecorder`s webm mangler
  et gyldigt Duration-element uden efterbehandling. Jeg brugte i stedet den
  levende app til at drive de faktiske funktioner/DOM direkte (se metode
  punkt 2) — stærkere end kodelæsning alene, men ikke det samme som at
  se en coach faktisk klikke sig igennem en rigtig video.
- **Klikketallet i tabellen ovenfor er talt ved kode-sporing, ikke
  stopur på en fysisk session.** Sekvensen er den samme kodesti en rigtig
  session ville følge (verificeret klik for klik i den levende app), men
  tallet er ikke fra en observeret bruger.
- **`setup_ms`/`total_ms` fra Commit 1 er ikke selv afprøvet på en rigtig
  video** — kun verificeret at koden sætter/nulstiller tidsstemplerne
  korrekt ved de rigtige hændelser (video indlæst, tracker starter, gem).
  De første rigtige tal kommer først når Marc bruger værktøjet efter
  deploy — det er hele pointen med Commit 1.
- **Proportions-forslagets kvalitet på en RIGTIG athlet er ikke set.** Den
  matematiske korrekthed er verificeret stringent (rund-tur + skala/
  rotation), men om en menneskekrops proportioner rent faktisk holder sig
  stabile nok uge til uge til at gøre forslaget brugbart i praksis (fx ved
  tykkere/tyndere tøj, let ændret kamera-højde) er en antagelse, ikke et
  målt resultat. Hvis det viser sig unøjagtigt i praksis, er drag-to-
  correct allerede indbygget som sikkerhedsnet.
- **Rep-vælgerens og bekræft-knappens visuelle placering** er kun set på
  desktop-browser-viewport i denne gennemgang, ikke på en rigtig mobil
  (COACHWEB bruges typisk på tablet/mobil i marken).

## Betydning for Hara

Direkte under delmålet "Appen mærkbart bedre" (Coaching-planeten): dette er
den tungeste, mest gentagne friktion Marc selv har peget på i VideoCoach —
opsætning pr. video, ikke selve coachingen. Commit 1 giver et første,
objektivt tal at måle "mærkbart bedre" imod fremover (ikke kun en
fornemmelse). Klik-skelettet, den tungeste enkeltpost, er halveret i
klikantal for ben-løftene ved anden analyse af samme atlet+løft.

## Hvad er næste

- Lad `setup_ms`/`setup_clicks` samle et par ugers rigtige tal, så runde 2
  kan måles mod en ægte baseline i stedet for et gæt.
- Samme ankel-anker-idé for bænkpres (arm-kæden) kræver et andet
  fastpunkt end ankel — ikke undersøgt her, bevidst uden for ordrens
  eksplicitte scope ("ankelen").
- Den indledende spoling/klip før allerførste ⚡-tryk (nævnt i
  problembeskrivelsen som "og før alt det") er urørt af denne ordre.

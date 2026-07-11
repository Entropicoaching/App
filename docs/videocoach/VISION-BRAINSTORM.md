# ENTROPI - VISION, SJAEL & KONKRET HANDLEPLAN
_Fable, 8/7-2026. Afskedsgave. Bygget paa en uges intensivt arbejde med
trackeren, atleterne, appen, sitet og Marcs stemme. Alt tekstindhold til
atleter/offentligheden skal forbi Marc foer brug - det er hans ord._

## 0. SJAELEN (fra sitet, ikke fra min fantasi)
"Entropi er erkendelsen af at kompleksitet kraever struktur."
Matematiklaereren. DM-guld i baenkpres. Otte aars coaching. "Data,
moenstre, progression. Ikke mode, ikke genveje." "Struktureret, aerlig
og procesorienteret." "Bygge atleter der holder - fysisk, mentalt og
konkurrencemaessigt." VideoCoach-loeftet: "Ren teknik, ingen fornemmelser."
ALT nedenfor skal kunne staa paa de saetninger. Kan det ikke, ryger det.

## 1. DEN STORE IDE: BRANDET OG MAALINGEN ER SAMME TING
Entropi er fysikkens maal for UORDEN. Termodynamikkens anden hovedsaetning:
alt driver mod uorden, MEDMINDRE der tilfoeres arbejde og struktur.
Det ER coaching. Det er derfor navnet er genialt - og det er uudnyttet.
VideoCoach MAALER allerede bogstaveligt uorden i et loeft: bane-
effektivitet (omveje), hysterese (positionstab), fartfalds-ujaevnhed
(kontroltab), tempo-spredning (inkonsistens).

### ENTROPI-SCOREN (signatur-konceptet, byg i horisont 2)
Et deterministisk 0-100-tal for hvor meget ORDEN der er i et saet:
  score = vaegtet af (eff_pct, hyst_cm, dip-jaevnhed, tempo-spredning
  paa tvaers af reps, rep-til-rep fartkonsistens)
- 100 = perfekt orden. Lavt = kaos. "Traening tilfoerer orden" bliver
  MAALBART: atletens score stiger over en blok = synlig proces-sejr,
  ogsaa i uger hvor kiloene staar stille (KAEMPE motivationsvaerdi -
  procesorienteret, praecis som brandet lover).
- Deterministisk og forklarlig (ingen AI-magi): tryk paa scoren ->
  se de fire komponenter. "Ren teknik, ingen fornemmelser."
- Paa resultatkortet: "ENTROPI 87" med guld-typografi = brandet BOR
  i hvert delt billede. Ingen konkurrent kan kopiere det uden at
  reklamere for navnet Entropi.
- VIGTIGE VAERN: kalibreres foerst mod Marcs oeje paa 30+ analyser
  (som FUND-graenserne); atleter maaler sig kun mod SIG SELV (aldrig
  leaderboard paa score); coachen ser komponenterne, atleten ser
  fremgangen. Scoren aabner samtaler, den doemmer ikke.

## 2. DE FIRE SOEJLER (hvordan alt haenger sammen)
  OEJET      = VideoCoach (se loeftet som det ER)
  SYSTEMET   = appen: program, logging, soendagsagent (strukturen)
  STEMMEN    = Marc: fund -> ord, artikler, kort, stoevnecoaching
  FLOKKEN    = holdet: Ugens Loeft, delte kort, kultur
Reglen: Oejet og Systemet producerer DATA. Stemmen producerer MENING.
Flokken producerer LYST. AI faar aldrig Stemmens job.

---

## 3. HORISONT 1 - DE NAESTE 4 UGER (praksis foerst)

### 3.1 SVINGHJULET (vigtigst af alt)
Hver 💾 med kg-tal er braendstof til ALT i horisont 2-3. Konkret vane:
gem MINDST topsaettet pr. atlet pr. video-session. Maal: 50+ analyser
i video_analyses inden august. JSON'erne baerer allerede alt.

### 3.2 FELTLOG.md (5 min efter hver session)
Dato, hvad virkede, hvad irriterede, hvad manglede - og guldspoergsmaalet:
"Sagde jeg noget til atleten, som VAERKTOEJET burde have vist mig foerst?"
Svarene ER naeste features. Ingen kode foer moenstre viser sig.

### 3.3 Traeningsmode-forfining (efter 2 ugers brug)
Kandidater: loop ved sidste rep i stedet for foerste? Stoerre fartpanel
(laesbart paa 1 meter ved racket)? Feltloggen afgoer.

### 3.4 Fase 3B: Atlet-resultatkortet
Atleterne kan nu gemme video m. bane. Naeste: story-kortet til dem, i
atlet-udgave: DERES tal, bane, stroboskop og KUN opmuntrende sektioner
(Marcs copy-godkendelse paakraevet). Hvert delt kort baerer
"entropicoaching.dk" - stolthed og markedsfoering i samme billede.

---

## 4. HORISONT 2 - DATASLOEJFEN (ved 50+ analyser)

### 4.1 VBT-PROFIL PR. ATLET (stoerste enkeltgevinst)
Python i entropi_agent, laeser video_analyses:
- Load-velocity-fit pr. atlet pr. loeft -> personligt e1RM-estimat UDEN
  maxforsoeg + personlige fartzoner ("Regitzes 80% squat = 0.45-0.55 m/s").
- DAGSFORM: dagens fart ved X kg vs. baseline -> "+4% / -6% ift. normal"
  FOER det daarlige saet sker. Autoregulering (Marcs egen artikel!)
  faar taender: sitet PRAEDIKER det, appen LEVERER det. Brand-cirklen
  slutter.
- RPE-KALIBRERING: loggede RPE vs. maalt fart -> hvem lyver for sig
  selv (begge veje). Direkte ind i programmeringen og drafts.

### 4.2 SOENDAGSAGENTEN FAAR OEJNE
drafter/analytics laeser video_analyses: reviews faar VIDEO-sektion +
auto-flag ved 3-sessioners negativ trend i eff/hyst/hip-ratio/score.
"Emmas eff: 94->91->88 - folder hun frem igen?" moeder Marc i rapporten.
Marcs tid er den knappeste ressource; det her koeber den tilbage.

### 4.3 TEKNIK-BASELINE (allerede forberedt i extra-feltet!)
Median/MAD pr. atlet paa eff/hyst/hip_ratio/tempo -> INDIVIDUELLE
graenser i stedet for universelle (90%/4cm/1.4x). "Emma flagges ved 85,
for HENDES normal er 93." Forskellen paa maaling og coaching.

### 4.4 Supabase-gem fra coach-mobil
JSON-download -> direkte insert fra telefonen. RLS-design foerst
(athletes.id != user_id - kendt faelde). Saa fodrer racket ogsaa hjulet.

### 4.5 AI-BESLUTNINGEN (traf naesten sig selv i praksis)
Alt peger paa: DROP lokal Llama. Fundene er deterministiske, Stemmen er
Marcs. Evt. Claude-API-knap som coach-only "andet blik" ved svaere
cases, betalt pr. kald. Uafhaengighed = fundene virker offline, gratis,
for evigt. Det har vi allerede.

---

## 5. HORISONT 3 - ATLETENS REJSE (fastholdelse og kultur)

### 5.1 TEKNIK-TVILLINGEN (byg foerst i H3)
Gem banens punkter (komprimeret) i hver analyse -> atleten laegger
DAGENS rep oven paa SIT bedste historiske. "Dig i dag mod dig i marts"
er den mest motiverende sammenligning i styrketraening, kraever ingen
andres data, og overlay-motoren FINDES allerede.

### 5.2 FREMGANGS-LINJEN
Badge efter analyse naar appens logs x video-fart siger PR: "Din
hurtigste 140 kg nogensinde." Smaa oejeblikke, stor loyalitet - og
praecis den slags aerlige fejring, brandet kan staa inde for.

### 5.3 UGENS LOEFT (Flokken)
Marc vaelger ugens flotteste TEKNIK (ikke tungeste kg) -> stroboskop-
kort i holdkanalen. Kultur: her fejrer vi orden, ikke bare vaegt.

### 5.4 SAESONKORTET (gave-oejeblik)
Ved blok/meet-afslutning: ET kort med hele rejsen - fart ved openers
over 12 uger, score-kurven, bedste stroboskop. Atleter indrammer den
slags. (Og deler den.)

### 5.5 Portal/del-link: stadig "kravle foer loebe" - foerst naar
5.1-5.4 har bevist traekket i praksis.

---

## 6. STEMMEN SOM MOTOR (indhold og vaekst, Marcs copy hele vejen)

### 6.1 Fra analyse til indhold (10 min pr. opslag)
Hver god analyse = stroboskop-/story-kort + 3 linjer Marc. Serie-navn
ligger lige til hoejrebenet: "REN TEKNIK" (fra sitets egen saetning).
IG @entropicoaching faar en genkendelig, uefterlignelig visuel signatur
(guldbane paa moerk bund - ingen andre HAR de billeder).

### 6.2 Artiklerne faar beviser
"I praksis hos Entropi"-boksen (allerede godkendt ide paa site-listen):
autoregulerings-artiklen viser en RIGTIG dagsform-graf; intensitets-
artiklen viser en RIGTIG load-velocity-profil. Anonymiseret eller med
samtykke. Ingen konkurrent i DK kan matche det bevisniveau.

### 6.3 Funnel (kobler til sitets eksisterende planer)
- VideoCoach ER lead-magneten: gaeste-analyse virker, og hvert kort/
  video baerer entropicoaching.dk. Overvej blid kobling til leads-
  tabellen (Item 4 paa site-listen): "faa dit resultatkort tilsendt".
- QR-kode i traeningslokalet -> videocoach. Nul friktion for gaester.
- Onboarding-KLIP: Marc indtaler 30 sek "saadan filmer du" (filmguiden
  som menneskestemme). Nye atleter faar Marc i oeret fra dag et.

### 6.4 Stoevnecoaching forstaerket (sitets eget loefte: "forsoegsstrategier
baseret paa praestationsdata")
IKKE meet-mode paa dagen (droppet, Marc stoler paa oejet). Men FOER
staevnet: forsoegsvalg stoettet af VBT-profilen ("135 gik 0.42 m/s
sidste uge - 3. forsoeg 142.5 er daekket"). Det er praestationsdata,
leveret som brandet altid har lovet det.

## 7. FORRETNINGS-TANKER (kun tanker - Marcs domaene)
- Video-analyse som SELVSTAENDIGT produkt: "Entropi Blik" - async
  teknikgennemgang (atleten sender video, faar kort + Marcs stemme
  retur). Lav marginal-tid pr. stk. naar vaerktoejet goer det tunge.
- Hold-tier med Ugens Loeft + faelles kort = fastholdelse.
- Prissaet ALDRIG scoren/dataene alene - vaerdien er Stemmen ovenpaa.

## 8. "ATLETER DER HOLDER" SOM FEATURES (brandloeftet indfriet)
- Fysisk: dagsform-flag + trend-flags fanger nedbrud FOER skaden
  (jf. Marcs egen piriformis-styring med pause squat - praecis den
  slags kunne vaerktoejet flagge af sig selv).
- Mentalt: fremgangs-linje, score-kurve, saesonkort - fremskridt
  synligt ogsaa naar baren ikke flytter sig.
- Konkurrence: forsoegsstrategi paa data, teknik-tvilling mod egen
  bedste udgave.

## 9. ANTI-BACKLOG (besluttet IKKE - spar energien)
Egen pose-model (modbevist ROI). Meet-mode paa dagen. Live-VBT foer
traeningsmode-brugen kraever det. Front-view/symmetri. Auto-popups.
Leaderboards paa tvaers af atleter (imod sjaelen). Feature-vaeg i
atlet-view - simpelt VANDT, det beviste ugen.

## 10. 30/60/90 (konkret)
DAG 1-30:  Traeningsmode hver session. 💾 alt m. kg. FELTLOG. Fase 3B
           atletkort (copy forbi Marc). 2-3 REN TEKNIK-opslag som test.
DAG 30-60: 50+ analyser -> VBT-profil + soendagsagentens video-sektion.
           Llama-beslutning eksekveres. Entropi-scorens komponenter
           beregnes STILLE i rapporterne (kalibrering mod Marcs oeje).
DAG 60-90: Score paa coach-kortet naar kalibreret. Teknik-baseline.
           Supabase-gem fra mobil. Teknik-tvillingen. Artikel-beviser.
           DEREFTER: portal-beslutning paa rigtige tal.

## 11. TIL MARC
Du har nu det, ingen anden dansk coach har: et oeje der maaler, et
system der husker, og en stemme der kan oversaette tal til traening.
Faren er ikke laengere bugs - det er at lade tallene coache. Lad dem
aabne samtalerne ("kan du maerke, hvad der sker i rep 4?"), og lad
navnet baere pointen: entropi vokser af sig selv - orden kraever en
coach. Det er brandet, det er vaerktoejet, og det er dig.
Gem analyserne. Resten venter kun paa braendstoffet.

God rejse. Det bliver rigtig godt.
- Fable

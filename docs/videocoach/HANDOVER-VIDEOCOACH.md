# VIDEOCOACH - OVERDRAGELSE (skrevet 7/7-2026 sen aften)
LAES DENNE FOERST, derefter TODO.md (detaljeret historik).

## Hvad det er
Entropi VideoCoach: styrkeloefts-videoanalyse i EN html-fil med 3 tilstande:
- DESKTOP (file://) = Marcs fulde vaerksted
- COACHWEB (?coach=1 online) = coach paa mobil, glas-layout
- ATHLETE (online, default) = minimal atletvisning
Kernefunktion: stangbane-tracking (template matching paa skiven) -> m/s,
reps, tempo, sticking point, FUND-regler + MediaPipe-skelet (valgfrit).

## Filer og deploy
- MASTER:  C:\Users\Entropi\Desktop\entropi-agent\videocoach.html
- DEPLOY:  kopier til C:\Users\Entropi\Desktop\entropi-app\public\
           + git commit + push origin main -> GitHub Actions -> Pages
           -> live paa entropicoaching.dk/videocoach.html
- Appen (React/Vite) aabner den via window.open fra AthleteView/Dashboard.

## ARBEJDSREGLER (Marcs krav - bryd dem ikke)
1. AL udvikling + test sker i MASTER-filen lokalt (file://). INTET deployes
   foer Marc har testet og siger go. Live er pr. commit 61af121 + hotfixes
   til og med 4ed967e/c29ce8a-serien (se git log i entropi-app).
2. CV/tracker-aendringer testes ALTID foerst i test-riggen
   (tracker-testrig.js her i mappen, koer med node). Laering fra i dag:
   en utestet CV-aendring froes trackeren i produktion og maatte reverteres.
3. Kvalitetsbar: hellere faa ting der ALTID virker end features under 50%.
   Marc dropper gerne features (film-i-appen, auto-guide = droppet).
4. Syntaks-tjek foer hver test: udtraek <script> og koer node --check
   (PowerShell-one-liner findes i TODO/historik - regex '(?s)<script>(.*)
   </script>' -> temp-fil -> node --check).
5. 50% af atleterne bruger Android, 50% iOS. Filmguide (kamera i hoejde
   med midten af loeftet, 3-4 m afstand) daekker optagekvalitet.

## TRACKER v3 - ARKITEKTUR (vigtigste viden)
- rVFC-afspilning (requestVideoFrameCallback) m. AEGTE frametider pr.
  punkt (path.times) - IKKE seek-pr-frame (10-30x langsommere paa mobil).
  Seek-fallback ved manglende rVFC/iOS-stroemspare (<5 punkter).
- Matching: zero-mean SSD, patch ~W/32, soegning om forudsagt position.
- KONTINUITETSREGEL: spring > R*0.6 fra forudsigelse -> gensoeg naer
  forudsigelsen (R*0.45) og tag naere bedste. ERSTATTER okklusions-coast
  som FROES ved stille start og loeb loebsk (bevist i rig).
- patchVar-GULVE under emaBest-seed/opdatering og template-porten -
  ellers kollapser taersklerne efter stille start (statisk video-intro).
- ROTATIONSFIX: recenterOnPlate() maaler skivens centrum via kantscan
  (16 straaler, smalt baand +-18% om kalibreret radius, 3 valideringer).
  Maalinger foeres ALDRIG live ind i matcheren (destabiliserer - bevist);
  de anvendes som udglattet offset EFTER sporing (applyPlateCenter).
  Vaerste fald = ingen korrektion. Fjernede U-form-bias fra roterende skiver.
- AUTO-TRIM i analyzePath: alt foer/efter reps (+-0.6s) klippes fra
  metrikkerne. Nyeste bane bruges overalt (filter(...).pop()).
- Kvalitet: path.lowConf taeller usikre frames -> banner-advarsel +
  OBS-linje i maalinger ved >15%.

## KUN I VAERKSTEDET (ikke deployet - venter paa Marcs test/go)
- ⇄ Side-om-side: to videoer, ⚓-syncpunkt pr. side, faelles kontroller.
  Marc: "virker fint".
- ◉ Overlay + ◍ Forskel-blending (difference: ens=sort, afvigelse lyser).
- 👥 Rep-overlay: SAMME video i 2 dekodere, klikbar rep-TABEL (snitfart/
  fald, vaelg Fuld+Ovenpaa), auto-klip+loop om rep A. Marc: "fedt lavet".
- DOBBELT-SKELET i rep-overlay: rep A cyan + rep B orange (kun sameVid).
- Play/pause: #playBtn2 forrest i tidslinjen (synkes hvert frame fra
  updateTimeline), klik paa video = toggle (pen-tap uden traek).
- Desktop-bund ryddet op: kun analysér/tegn/linje/vinkel/visk/fortryd/
  ryd/loop/ghost + "⋯ Mere"-bakke (deskTray) med resten.
- color-scheme:dark (rullelister var hvid-paa-hvid paa Windows).
- SKULDER-FIX (2 runder, SKAL verificeres paa squat-video!):
  a) snapWristsToBar: gate paa 25%-fraktil, outliers/lav synlighed (<0.55)
     FULD-snappes til stangen (i squat ER skulderen paa stangen).
  b) smoothPose: hul-udfyldning aendret fra nabo-KOPI (skelet froes gennem
     squat-bunden) til LINEAER INTERPOLATION m. arvet lav synlighed (*0.5).
  KENDT REST: hvis hoften mangler PRAECIS ved vendepunktet kan lineaer
  interpolation klippe dybde-hjoernet -> naeste greb: bar-relativ warp af
  hofte-y gennem huller (stangens y-kurve kender vendepunktet).
  c) RUNDE 3: Marc saa skulder-x vandre MOD hoften (torso lodret) - snappet
     rettede kun y! Nu blandes BEGGE akser (i sidevisning ER skulderen ved
     stangen i x og y), gate aendret til 75%-fraktil ("foelger stangen
     naesten hele loeftet" - sandt i squat, falsk i baenk/DL saa den aldrig
     fejlaktiverer), outlier-graense strammet (med*1.5 / 0.05W).
     + repairHips (cirkel-skaering) faar dermed korrekt skulder at regne fra.
  d) RUNDE 4 - RODAARSAGEN: auto-trim (analyzePath) klipper path.pts men
     IKKE pose.frames -> index-forskydning. snapWristsToBar slog stang-
     punktet op via INDEX -> skulderen fulgte banens loop forskudt i tid
     ("loeber med uret" - Marcs observation afsloerede det). FIX: alle
     pose<->path-opslag sker nu via TID (idxAtTime), baade i snapWrists,
     sticking-vinkler og hofte-foer-stang-fusionen i collectMetrics.
     LAERING: pose.frames og path.pts maa ALDRIG index-parres direkte.
     Skelet-"blink" er muligvis samme fejl - ellers: detektion hver frame.
  e) RUNDE 5: pose daekker HELE forloebet, banen kun rep-vinduet (auto-
     trim) -> frames udenfor vinduet fik clamped opslag m. kaempe afstande
     som druknede q3-gaten => snap sloges ALDRIG til. FIX: gate+snap kun
     paa frames inden for banens tidsspan (inSpan). + repairHips: kandidat
     skal blive paa samme side af skulder-knae-linjen som forrige frame
     (hofte smuttede ellers ind mod laaret ved naer-symmetri).
  f) RUNDE 6 - PRINCIPSKIFTE: ved oevelse=Squat forankres skulderen
     BETINGELSESLOEST og fuldt til stangen (inden for banens tidsvindue).
     Domaeneviden slaar statistik: den statistiske gate var selv-
     underminerende (jo vaerre modellens skuldergaet, desto mere sagde
     den "stol ikke paa stangen"). KRAEVER at Marc vaelger oevelse FOER ⚡.
     Baenk/DL/umarkeret bruger stadig den statistiske gate.
  g) RUNDE 7 - TO HULLER FUNDET: (1) auto-trim klipper banen til +-0.6s om
     KONCENTRISKE faser -> nedturen paa rep 1 (hvor skiven daekker skulderen
     foerste gang) laa UDEN FOR vinduet = ingen stangdata = intet snap.
     FIX: analyzePath gemmer path.fullPts/fullTimes (u-trimmet) foer trim;
     snapWristsToBar bruger den fulde bane. (2) snap/repair koerte KUN i
     ⚡-flowet - koerte man 🦴 Skelet-knappen separat, var ALT arbejdet
     inaktivt. FIX: poseBtn-flowet kalder nu ogsaa snap+repair naar en
     bane findes. VIGTIG TESTINSTRUKS: oevelse=Squat valgt FOER analyse.
  h) RUNDE 8 - OFFSET-FORANKRING: forankringen VIRKEDE nu, men limede
     leddet paa SKIVECENTRUM (Marc: "binder sig til maerkelige punkter
     paa skiven"). Leddet er stift forbundet med stangen men sidder ikke
     i navet. FIX: maal konstant offset stang->led (median over frames
     m. visibility>0.7), forankr til stang+offset. Gaelder alle led
     (haandled faar dermed ogsaa grebs-offset). Cap: offset < 0.14W
     ellers 0. Retter ogsaa repairHips (regner fra skulderen).
  i) RUNDE 9 - STRATEGISKIFTE (hofte stadig off, skulder forkert det
     meste af bevaegelsen): statistik-stakken OPGIVET. (1) repairHips
     DEAKTIVERET (funktionen findes stadig) - raa model + udglatning er
     bedre end rekonstruktion m. forgiftede referencelaengder. (2) Skulder-
     offset kalibreres nu af COACHENS KLIK: efter analyse (Squat valgt)
     beder banneret om ét klik paa skulderleddet -> offset = klik minus
     stangpunkt i samme frame -> re-snap. Deterministisk, nulstilles pr.
     video (shOffset). LAERING: MediaPipe er selvsikkert-forkert; visibility
     kan IKKE bruges som sandhedsfilter til statistik paa sidevisning.
  j) RUNDE 10 - KLIK-SKELET (Marcs idé, muligvis LOESNINGEN): 🦴 Klik-
     skelet-knap: coach klikker skulder/hofte/knae/ankel paa tydelig frame
     -> skulder = stang+offset, hofte+knae TRACKES med skive-metoden
     (template match, kontinuitetsregel, ingen MediaPipe!), ankel statisk.
     Stroke-type 'mskel', tegnes m. hofte/knae-vinkler. Armene tegnes
     desuden ALDRIG i squat/DL (MediaPipe-hallucinationer gav kaempe
     vildfarne streger - det VAR formentlig "skulderen er godnat").
     Fartkurven fik 3-pkt median-udglatning (savtak var frametids-artefakt).
     MANGLER MARCS TEST. Hvis klik-skelettet virker: overvej at goere det
     til STANDARD for squat/DL og lade MediaPipe vaere bench/fallback.
  STRATEGI-NOTE (Marcs spoergsmaal): byg IKKE egen pose-model (kraever
  datasaet+GPU-traening, urealistisk). Ejerskabet ligger i LAGET OVENPAA
  (bar-anchor, anatomi-constraints, tidsfiltrering - alt modelagnostisk).
  God Opus-opgave: benchmark 2-3 faerdige web-modeller (nyere MediaPipe,
  MoveNet, RTMPose/ONNX) paa Marcs SIDEVISNINGS-videoer og vaelg bedste -
  vores domaenelag genbruges uanset model.

## DEPLOYET I DAG (allerede live)
Mobil-pipeline (rVFC+nedskalering+loadfixes), coach-mobil A+B+C (ikoner,
analyse-ark, husk valg), 8 robusthedsfixes, rotationsfix v2, Wake Lock,
filmguide (📷), HEVC/load-fejlbeskeder, share target ("Del til VideoCoach",
Android, kraever installeret PWA - sw.js roerer INTET andet). Marc har
verificeret tracker v3 i appen.

## NAESTE ETAPER (aftalt raekkefoelge)
1. Marc verificerer squat-bund-skelettet paa rigtig video (vaerksted).
2. FARTKURVE-GRAF: BYGGET 7/7 nat (kun vaerksted). 📈-knap i footer,
   v/t-kurve nederst paa canvas m. rep-baand+numre, fartfarver, nullinje,
   spillehoved, klik i grafen = spol. Skjult i ⇄-tilstand og for atleter.
   MANGLER Marcs test.
3. RESULTATKORT: PNG m. bane+kurve+noegletal til atleten (delbart).
4. Rep-eksport som video (recorder fanger allerede canvas inkl. overlay).
5. Evt. senere: live-tilstand (VBT ved racket), skelet paa video 2 i ⇄,
   CONFIG-blok m. graenser (90%/4cm/1.4x) naar Marc kalibrerer, Supabase-
   gem (niveau 2: React-integration, atletvaelger fra DB, coach-login).

## KENDTE BEGRAENSNINGER
45cm-skiveantagelse (smaa opvarmningsskiver = skaeve m/s), perspektivfejl
ved <2m/lav vinkel (~2-5%, filmguiden daekker), skelet kun paa video 1,
iOS har ikke share target (behoever det ikke - vaelgeren virker der).

## Historik/detaljer: TODO.md (samme mappe). Test-rig: tracker-testrig.js
(v2-udgave; coast/stoej-scenarierne fra i dag er beskrevet i TODO -
genopbyg dem ved behov foer nye tracker-aendringer).

## SKELET I REN SIDEVISNING - AABEN HOVEDUDFORDRING (Marcs sidste input 7/7)
Marc: skelettet laaser sig daarligt fast naar der filmes DIREKTE fra siden
(hans foretrukne vinkel). ~30 grader skraat virker ok. Aarsag: MediaPipe
er traenet mest paa frontale/skraa kroppe - ren profil = maksimal selv-
okklusion, lav visibility, gaetteri. BEMAERK SPAENDINGEN: ren side er
OPTIMAL for stangbanen, men VAERST for skelettet.
Kandidat-loesninger til naeste agent (utestede, i prioriteret raekkefoelge):
1. Detektion HVER frame (ikke hver 2.) i kombineret ⚡-koersel + mindre/
   taettere ROI-boks om atleten (poseBox) - billig gevinst foerst.
2. IMPLEMENTERET 7/7 nat: repairHips() - hoften rekonstrueres geometrisk
   (cirkel-cirkel-skaering: torso-laengde fra skulder + laar-laengde fra
   knae, kandidat naermest forrige gode hofte). Koerer efter
   snapWristsToBar i ⚡-flowet. Gate: hofte-vis <0.55 eller knogle-
   laengde-afvigelse >25%. MANGLER MARCS TEST paa squat-bunden.
3. Bar-relativ warp af hofte-y gennem interpolations-huller (stangens
   y-kurve kender vendepunktet - lineaer interpolation goer ikke).
4. Evt. nyere pose-model / to-pass (fremad+baglaens tracking, midl).
5. Pragmatisk: filmguiden kan anbefale 15-20 grader skraat NAAR skelet
   oenskes (koster lidt stangbane-praecision - Marcs afvejning).

## RUNDE 10 TESTRESULTAT (Marcs sidste test 7/7 nat) + PRAECIS DIAGNOSE
Klik-skelettet startede MEGET bedre, men: skulderpunkt mistet undervejs,
knaepunkt roeg langt frem og fortsatte UENDELIGT ud af billedet.
DIAGNOSE (kod-niveau, til naeste agent):
- "Uendeligt ud af billedet" = hold-grenen i runMskel's stepF: naar match
  afvises (spring > R*0.6) saettes nx=pred, MEN vel opdateres med
  (nx-cur)=vel -> hastigheden BEVARES udaempet -> punktet glider lineaert
  for evigt. SAMME fejl som okklusions-coast'en fra tidligere paa dagen!
  FIX (ikke implementeret): i hold-grenen daemp vel (*0.8), cap paa faa
  sammenhaengende holds, derefter genfind i STOERRE vindue omkring sidste
  SIKRE position (ikke pred).
- Knae/hofte-templates: toej deformerer + roterer -> template-drift.
  Overvej: mindre template-opdatering (0.95/0.05), to templates (original
  + adaptiv, match mod begge), eller optisk flow i lille vindue.
- Skulder = stang+offset kan KUN fejle hvis stangbanen fejler eller
  offset-frame var daarlig -> tjek om skulderklikket skete paa en frame
  med daarligt stangpunkt (vis stangpunktet naar der klikkes!).
IDEEN ER RIGTIG (Marc vil beholde den): coach-klik + egen tracker,
MediaPipe ude. Det er EKSEKVERINGEN af punkt-trackeren der skal modnes -
og det SKAL ske i en test-rig med syntetisk "toej-tekstur" foer deploy.

## LAERINGER - GOER/GOER-IKKE (dyrt betalt i dag, respekter dem)
GOER: test-rig foer enhver CV-aendring; en aendring ad gangen; Marcs oeje
som facit; deterministiske anker (klik/stang) frem for statistik; tid -
ALDRIG index - naar pose/bane parres; damp ALTID hastighed naar en tracker
"holder"; synlige tilstande (banner) - aldrig usynlige ventetilstande.
GOER IKKE: stol paa MediaPipe visibility som sandhed (selvsikkert forkert
i profil); foed korrektioner live tilbage i en koerende matcher; stak
heuristikker oven paa hinanden uden at kunne se mellemresultater; deploy
utestet; lad say('') rydde prompts andre venter paa.

## MODEL-ANBEFALING TIL NAESTE SESSION (fra Fable, aerligt vurderet)
- OPUS (hoej reasoning) til klik-skelettets punkt-tracker og al CV/
  arkitektur: dagens fejl var subtile SAMSPILSFEJL (index vs tid, coast-
  loeb-loebsk, prompt-raecefoelge). Svagere modeller trasher mere paa den
  slags, og 10 blinde runder koster mere end tokenprisen sparer.
- SONNET er fint og billigere til VELAFGRAENSEDE opgaver m. praecis spec:
  resultatkort-PNG, rep-eksport, UI-polish, deploy-flow. Brug den der.
- Arbejdsform uanset model: (1) laes denne fil + TODO, (2) byg/udvid
  test-riggen FOER tracker-aendringer, (3) en hypotese ad gangen, (4) Marc
  tester lokalt, (5) deploy kun paa hans go.

## FRYS-RIG SESSION 8/7 (Fable, sidste session) - VIGTIGT RESULTAT
Marcs krav: trackeren skal virke for VILKAARLIGT antal reps (ikke kun 5).
Riggen blev haerdet med scenarie 4: 7 reps, udtraetning (laengere reps),
~6 omdrejningers akkumuleret rotation, bund-okklusion (nedre halvskive
daekket naer bunden) OG plade-lignende distraktor naer bunden.
RESULTAT (alle tal i riggen):
- BASELINE (uden vagt): doer PERMANENT paa langt saet (slutfejl 329).
- RUNDE-22-VAGTEN (v1, allerede i master): kortvarige tab undervejs, men
  SELVHELER - slutfejl 32. Groen paa alle 4 scenarier. INGEN master-
  aendring noedvendig: vagten staar valideret til vilkaarlig saetlaengde.
- AFPROEVEDE OG MODBEVISTE alternativer (GENTAG DEM IKKE uden nyt bevis):
  a) Cirkel-scan-relokering (rotations-sikker gensoegning): relokerer til
     falske cirkler under okklusion; "laer nyt udseende ved relokering"
     CEMENTERER fejlplaceringer (permanent tabt, slutfejl 200+).
  b) Tidslig bekraeftelse + naermeste-kandidat: deadlocker paa stabile
     falske cirkler (statiske plade-lignende features findes ogsaa i
     virkelige gyms - andre skiver!).
  c) Template-hygiejne (kun laere ved recenter-bekraeftet laas): UDSULTER
     templaten under null-striber -> rotation loeber fra den -> vaerre.
  NOEGLEINDSIGT: v1's konservatisme VINDER fordi original-templaten
  genmatcher hver hele omdrejning, og fordi den aldrig kan forgiftes.
NAESTE SKRIDT: Marc genkoerer den video der froes (IMG_0860.MOV ligger i
mappen) i vaerkstedet. Selvheler den (kort hop, genfinder) = kravet er
opfyldt. Fryser den PERMANENT = der er en rig-virkelighed-kloeft, og
netop den video er aktivet at fejlsoege med (traek frames ud, foed riggen
med RIGTIGE pixels i stedet for syntetiske).

## ROADMAP PKT. 3+4 BYGGET 8/7 (Fable, kun vaerksted - venter Marcs test)
PKT 3 - SKELET-KAEDER PR. LOEFT: mskel-flowet vaelger kaede ud fra
oevelsen: squat/DL/sumo = ben (sh-hip-knee-ank, vinkler hofte/knae),
BAENKPRES = ARM (sh-el-wr, vinkler: albue + underarmens afvigelse fra
lodret - 0 grader = optimal kraftoverfoersel). Keyframes for baenk:
TOP=lockout, BUND=brystet. Stroke baerer chain+order; drawMskelAt,
mskelAnglesAt, AI-maalinger (collectMetrics) og rep-overlay-readouten
(A/B/delta) er alle kaede-bevidste. Gamle mskel-strokes uden order
falder tilbage til ben-kaeden.
PKT 4 - FILMGUIDE PR. LOEFT: guiden aabner nu med en fremhaevet
oevelses-specifik linje (guideLift, opdateres ved aabning ud fra
liftSel): squat=hoftehoejde, DL/sumo=knaehoejde, baenk=stanghoejde v.
brystet + hvad der SKAL vaere i billedet. Intet valgt = venlig hint.
TEST (Marc): 1) baenk-video -> vaelg Baenkpres -> koer analyse + klik-
skelet (lockout/bryst, 3 klik pr. fase) -> albue/underarm-vinkler + AI-
linje. 2) DL som foer (ben-kaede). 3) Filmguiden med hver oevelse valgt.

## SELVSTAENDIGT ARBEJDE 8/7 (Marc AFK, tjek hvert 30. min) - TESTLISTE
Backup foer start: videocoach.backup-8-7-foer-selvstaendigt-arbejde.html
Alt nedenfor er ADDITIVT, syntaks-tjekket, KUN i vaerkstedet.

BATCH 1-3 KLAR TIL TEST (aabn vaerkstedet, koer ⚡ + klik-skelet):
1. VINKEL-KURVE i fartgrafen: tynd cyan kurve (hofte-vinkel; albue for
   baenk) + DYBESTE vinkel pr. rep som cyan tal i bunden af grafen =
   dybde-konsistens i grader. (NB: keyframe-skelettet er stanghoejde-
   drevet, saa kurven viser dybde/vinkel pr. rep - IKKE timing-afvigelser.)
2. MOMENTARM: orange stiplet vandret linje stang<->hofte m. cm-tal ved
   hoften (kraever kalibrering; kun ben-kaede). "Se hvor langt vaegten
   er fra hoften".
3. MIDTFOD-LINJE: diskret lodret stiplet reference gennem anklen -
   "stangen over midtfod" gjort synlig mod stangbanen.
4. TEMPO-BJAELKER: tynd stribe i grafens top pr. rep - blaa=excentrisk,
   graa=pause, guld=koncentrisk. Timing/kontrol aflaeses direkte.
5. TORSO-VINKEL paa skelettet: DL/sumo = "ryg X° over gulv", squat =
   "torso X° frem" (fra lodret), midt paa torsoen. Loeft laeses fra
   oevelsesvalget VED skelet-opsaetning (gemmes i strokes).
6. BAENK-TAL hele vejen igennem: albue/underarm nu ogsaa i FUND-note,
   noegletal-raekker (sheet/resultatkort) og gemt analyse-JSON
   (elbow_angle/forearm_dev).
VIGTIGT VED TEST: vaelg oevelse FOER klik-skelettet saettes (kaede+labels
bestemmes dér). Momentarm/midtfod kun ben-kaede; vinkel-kurve begge.

BATCH 4: Resultatkortet har faaet TEMPO-linje i referatet (ned/pause/op
pr. rep i sekunder). Frys-riggen genkoert efter alle aendringer: GROEN.
MOBILTEST FORBEREDT (P0): masteren er kopieret til entropi-app\public\
(KUN arbejdstraeet - INTET committet/deployet) og dev-serveren koerer.
Paa telefonen (samme wifi):
  ATLET:  http://192.168.1.85:5173/videocoach.html
  COACH:  http://192.168.1.85:5173/videocoach.html?coach=1
Det ER masteren med ALT nyt (keyframe-skelet, kort, kurver). Naar Marc
siger go efter mobiltest -> commit + push = deploy. Ellers: git checkout
-- public/videocoach.html ruller arbejdskopien tilbage.

CYKLUS 2 (Marc AFK): OVERGANGSPLAN.md skrevet (4 faser + AI-beslutnings-
ramme + koncept-koe). Coach-mobil PARITETS-AUDIT: strukturelt taet paa
komplet (alt nyt naas via bjaelke/Mere; nye funktioner korrekt skjult for
atleter). Kinskel-rig genkoert: GROEN. Supabase video_analyses: TOM ->
VBT-profil venter paa data (svinghjul: deploy -> 💾-brug -> data).
MARC HAR MOBILTESTET bar-trackeren paa masteren (dev-server): "virker
fint". DEPLOY VENTER KUN PAA EKSPLICIT GO. Dev-server koerer stadig paa
192.168.1.85:5173 (atlet: /videocoach.html, coach: ?coach=1).

CYKLUS 3: DEPLOY GENNEMFOERT paa Marcs go (7e70d9a) - hele master-
opgraderingen er LIVE (atlet naesten uaendret, coach-mobil faar alt).
Marcs retning bekraeftet: COACH FOERST - atlet-tillaeg (fase 3) venter.
STROBOSKOP bygget paa resultatkortet (kun vaerksted, IKKE deployet):
findes et klik-skelet, bliver STANGBANE-panelet til "STROBOSKOP" - banen
+ skelet ved bund (guld, 95%), sticking (cyan, 80%) og lockout (hvid,
55%) med diskret prik-legende. Rammen udvides automatisk saa hele
skelettet er med. Uden skelet: panel som foer. TEST: koer ⚡ + klik-
skelet + Resultatkort, tjek at aftrykket ser PROF ud (Marcs krav:
god, nem, prof).

CYKLUS 4: Resultatkort redesignet til STORY-FORMAT 1080x1920 (Marc:
"cramped paa iPhone 15 Pro"). Paneler stables i FULD bredde: stroboskop
640 hoej, fartkurve 290, derefter referat. Al typografi skaleret op
(noegletal 31px/54 rk-hoejde, referat 25px, sektionstitler 20px, tempo
23px). 9:16 = IG/besked-format = mere delbart. KUN vaerksted.
TEST: samme flow (⚡ + klik-skelet + Resultatkort) paa telefonen - er
det luftigt og prof nu? Hvis referatet loeber over m. mange fund, er
naeste greb at faa Hc til at vokse dynamisk med indholdet.

CYKLUS 5: Marcs MAAL formuleret: hurtigt at "svinge op og tale ud fra"
i traening. SHIPPET (vaerksted): analyse-playbackRate 0.5 -> 1.0 desktop
/ 0.75 mobil (halveret ventetid ved racket) + idle-throttle i render
(hver 3. frame ved pause/inaktivitet -> koeligere telefon, mindre
thermal-lag). TRAENINGSMODE spec'et i OVERGANGSPLAN.md (max 3 tryk:
aabn -> vaelg video -> tap skiven -> auto klip+loop+halv fart, INTET
ark i vejen). Byg den naeste session. Marcs lag-observation: decode-
warmup + termik - observeres i felten efter throttle.

DEPLOY 2 (Marcs go): 19a0613 - story-kort, stroboskop, analyse-fart,
idle-throttle er LIVE. Naeste session starter med TRAENINGSMODE
(spec i OVERGANGSPLAN.md) - det er Marcs erklaerede maal.

CYKLUS 6 (Fables sidste): 🏋️ TRAENINGSMODE BYGGET (kun vaerksted).
Flow: video vaelges (coach/desktop, IKKE atlet) -> ⚡ armeres automatisk
med banner "Tryk paa skiven = analysér" -> foerste tap paa skiven koerer
HELE analysen -> auto: klip+loop om saettet, ½ fart, INTET ark - klar
til at tale. Spoler/afspiller/tegner man i stedet, afvaebnes armeringen
LYDLOEST (disarmSession i togglePlay/step/scrub/vaerktoejsvalg).
Marcs maal: max 3 tryk fra video til samtale - det er praecis dette.
Implementering: wizard.session-flag -> sessionRun -> applySessionView()
i runFullAnalysis-slutningen (skipper analyse-arket i coachweb).
TEST: aabn video -> tap skiven -> tael selv trykkene. Og modsat: aabn
video -> spol bare (armeringen skal forsvinde lydloest, intet i vejen).
DEPLOY: ved Marcs go som saedvanlig. Backup: videocoach.backup-
traeningsmode.html.

CYKLUS 7 - ATLET-AUDIT (kode-verificeret) + fixes (kun vaerksted):
OK: traeningsmode rammer IKKE atleter, coach-knapper skjult, tap/traek-
gestik, ◎-flow, ghost-via-rep-tryk, fejlbeskeder, wake lock, share
target. FIXET: (1) filmguidens fallback bad atleten "vaelge oevelse" som
ikke findes for dem -> atlet-specifik tekst (hofte-/knaehoejde). (2) DET
MAGISKE OEJEBLIK: efter ◎-analyse faar atleten nu auto klip+loop i ½
fart m. atlet-venlig banner ("groen=hurtig, roed=langsom, tryk paa
rep-tal") - noel ekstra tryk. BESLUTNING TIL MARC: fartgrafen VISES
allerede for atleter (default-til, kan ikke slaas fra af dem) - flugter
med fase 3-forslag A, men er formelt hans call. FORSLAG (ikke bygget):
atlet-resultatkort (fase 3B), "min bedste rep"-markering, og paa sigt
personlig fremgangs-linje naar VBT-data findes.

DEPLOY 3 (Marcs go): 4e4f01c - TRAENINGSMODE + atletens magiske
oejeblik + filmguide-fix er LIVE. Fartgraf for atleter: Marc besluttede
TIL. Al projektviden (handover/roadmap/overgangsplan/opgavekort + 3
test-rigs) er nu OGSAA versioneret i entropi-app/docs/videocoach/ -
overlever disk-doed og foelger med repoet. Dev-server (5173) koerer
stadig paa Marcs PC - kan lukkes med at draebe node-processen, eller
bare lade vaere til naeste genstart. INTET udestaar i vaerkstedet -
master == live pr. denne commit.

CYKLUS 8: ATLET-VIDEOEKSPORT aabnet (kun vaerksted): ⬇ Video-knap i
atlet-footeren (ikon+label) -> eksporterer klippet m. bane/tal braendt
ind (mp4 paa iPhone) -> groent hentelink + atlet-venlig besked.
disarmSession foer eksport (armeret wizard maa ikke aede taps under
afspilningen). TEST: atlet-view -> ◎-analyse -> ⬇ -> afspilningen
koerer klippet igennem -> tryk groent link -> gem paa telefonen.

DEPLOY 4: 5cde399 - atlet-videoeksport LIVE. Marc livetester selv.
Master == live. Alt dokumenteret. Fable signing off.

## BAR-TRACKER FREDNING (sidste verifikation, Fable 8/7)
Frys-rig: GROEN paa alle scenarier. Master == live (hash-verificeret).
Trackerens INVARIANTER - bryd dem ALDRIG uden rig-bevis foerst:
1. Tider, aldrig index, naar bane parres med andet (pose, skelet).
2. Kontinuitetsregel (spring > R*0.6 -> gensoeg naert) - ingen coast.
3. patchVar-gulve under emaBest og template-porten (stille start).
4. Frys-vagt v1 uaendret: original-template + recenter-validering.
   Cirkel-scan-reloker og template-hygiejne er MODBEVIST - genopfind
   dem ikke.
5. Korrektioner foedes ALDRIG live ind i matcheren (kun post-hoc).
6. Enhver aendring: reproducer i rig -> fix -> alle scenarier groenne
   -> port -> Marc tester -> deploy paa go.
Marc finder forbedringspunkter gennem praksis - det er planen. Traceren
er fredet; alt andet maa gerne udvikle sig.

CYKLUS 9 (Fables allersidste, Marc til traening): FRAMEWORK.md faerdig-
gjort og committet (f9d4914) - Entropi-score v1 (komponenter, normali-
sering, vaegte, kalibreringsprotokol K1-K4, visningsregler, pseudokode),
VBT-matematik (fit-krav, MVT, e1RM-interval, dagsform-taerskler),
flag-motor F1-F6 m. stoejvaern, datamodel-migrationer M1-M4 inkl.
bar_path-format (muliggoer teknik-tvillingen), atletrejse-stadier,
KPI'er (+anti-KPI), tekniske triggere T1-T3, risici, 8 AABNE
BESLUTNINGER (B1-B8) og implementerings-koe til Opus. FELTLOG.md
skabelon klar m. dags dato. OPUS: start med Marcs B-svar, saa koeen
i FRAMEWORK sektion 11. Byg intet foer B-svarene.

CYKLUS 10 (efter Marcs B-svar, han traener): FRAMEWORK EKSEKVERET:
- B5/B6: Supabase-migration KOERT (videocoach_framework_m1_m2):
  video_analyses += load_kg, rpe, bar_path, low_conf_pct, schema_v,
  score, score_components, score_version. Nye tabeller athlete_baselines
  + athlete_lv_profiles (RLS taendt, deny-by-default, python bruger
  service-noegle). Tabellen var tom -> nul risiko.
- 💾 v2 i MASTEREN (kun vaerksted, VENTER GO): parseLoad (kg/RPE af
  fritekst, viser parsed vaerdi i banner saa fejlparse fanges straks),
  compressBarPath (<=120 pkt delta-kodet, cm_per_px med), low_conf_pct,
  schema_v:2. Importeren virker UAENDRET (feltnavne matcher kolonner).
- entropi_agent/scoring.py: Entropi-score v1 praecis efter FRAMEWORK
  sektion 3 (ankre foer baseline, median/MAD efter, vaegte 30/20/25/25,
  lowConf-vagt). SELVTEST GROEN: rent saet 94, rodet 15, usikker afvist.
- entropi_agent/lv_profile.py: VBT efter sektion 4 (vaegtet fit m.
  60-dages halveringstid, modenhedskrav, MVT pr atlet PR LOEFT (B3),
  e1RM som interval, dagsform beta 4/8%). SELVTEST GROEN: e1RM 204
  (202-206) mod syntetisk sandhed 205, r2 .998.
- run_weekly.bat kalder nu scoring + lv_profile efter import (verificeret
  mod live DB: rene no-ops uden data).
- B7: Llama er DEPRECATED (droppes som retning) men koden bevares til
  alternativ er valgt - roer den ikke, byg ikke videre paa den.
NAESTE I KOEEN (til Opus, kraever DATA foerst): flag-motor F1-F6 ind i
analytics/rapport (giver foerst mening ved 3+ sessioner pr. atlet),
K-protokol-vaerktoejet ved 30+ analyser, score paa coach-kort efter K3.
VENTER PAA MARC: test af 💾 v2 (gem en analyse, tjek banner-kg + at
JSON'en har bar_path) -> go -> deploy.

CYKLUS 11 - SIDSTE FAELLES (Marc gaar i seng, "kun gode minder"):
COACH-RO-PAKKEN (kun vaerksted, backup: videocoach.backup-sidste-
faelles.html):
- SKELET-PLACERING I FULD RO: body.placing skjuler header/footer/
  bakker/zen/luk under punkt-placering (ankel/knae sidder nederst -
  praecis hvor bjaelken laa). Tidslinjen bevares (skal spole top/bund).
  🦴 flyder op som "✕ afbryd" oppe til hoejre (dataset.prev gemmer/
  gendanner knaptekst). Afsluttes ved buildMskel ELLER ✕.
- Punkt-tryk har FORTRINSRET: mskelClicks tjekkes foer fartpanel/graf/
  play-cirkel i pointerdown (foer kunne centrum-tryk starte AFSPILNING
  midt i placeringen - fikset). togglePlay blokeret under placering
  (ogsaa mellemrumstast). Gammel dublet-check fjernet (verificeret: 1
  check + 1 definition).
- Coach-footer slanket 8 -> 6: graphBtn + ghostBtn til Mere (ghost
  styres alligevel via rep-tal-tryk). ::after-labels footer-scopet
  (ingen dobbelt-labels i Mere). mskelBtn ikoniseret i coachweb.
DEPLOY-STATUS: IKKE deployet (jernregel R2: Marcs test foerst). Naar
Marc har telefontestet skelet-flowet: Opus deployer med standard-
flowet (copy til public + commit + push). Alt andet er allerede live.

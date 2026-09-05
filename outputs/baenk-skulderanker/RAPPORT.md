# ORDRE 47 — Bænkpressen får sit skulderanker

Gren: `baenk-skulderanker` (fra main `bcffbe8`, tracker-hastighed allerede merget)

Commits:
- `22acb6c` — bænkens skulderanker: ét klik for hele sættet, albuen geometrisk
  låst mellem skulder og stang, ⇄-vending af den to-sider-tvetydighed ordren
  pegede på

Filer: kun `public/videocoach.html` (kirurgiske tilføjelser, ikke omskrevet).
Ikke rørt: `dist/videocoach.html` (git-ignoreret build-artefakt, kopieres
uændret ved `npm run build`), benkædens forslag (`mskelAnkleBarRatio`/
`mskelApplyAnkleBarRatio` er ikke ændret én linje), tracker-hastigheden fra i
nat, atlet-siden, Coach Briefing, `src/Dashboard.jsx` (broen for
`skeleton_proportions` er allerede generisk pr. kæde-type siden ordre 43 —
ingen backend-ændring nødvendig), ingen skemaændring.

## Metode

Læste hele klik-skelet-flowet for bænk (`mskelBtn.onclick` → `mskelStep` →
`mskelAdvancePhase` → `buildMskel`) og genbrugte samme
gemte-proportioner-mønster som benkædens ankel-forslag (ordre 43), men med en
anden geometri: hvor ankel→stang er en **similaritets-ratio** (skala+rotation,
ingen tvetydighed), er skulder→stang for bænk en **to-cirkel-skæring**
(klassisk 2-leds-IK: kendt skulder + kendt håndled/stang + kendte
arm-længder ⇒ albuen ligger på præcis to punkter, spejlvendt om
skulder-stang-linjen). Det er den tvetydighed ordren selv beskrev, og den
findes ikke i benkæden — derfor kunne det gamle mønster ikke bare kopieres,
det skulle udvides med et sideval.

Al ny matematik og kontrolflow er verificeret tre steder, ingen af dem i en
browser (se "Ærlige grænser" for hvorfor):

1. **12 isolerede enhedstests** af selve IK'en
   (`mskelSolveElbow`/`mskelElbowSign`/`mskelReflectAcrossLine`/
   `mskelDeriveArmFromShoulder`), udtrukket direkte fra
   `public/videocoach.html` og kørt i Node mod syntetiske punkter: korrekte
   segmentlængder, de to løsninger er hinandens spejling, degenereret
   input → `null` uden krasch, sideval-prioritet (denne sessions ⇄-tryk >
   forrige analyses valg > standard), og **kalibrerings-uafhængighed** — et
   albue-forslag gemt ved én kameraafstand (cm + `elbowSign`) genskaber
   præcis samme fysiske albuevinkel ved en helt anden kameraafstand i en ny
   session. Alle 12 grønne.
2. **Kørsel af de FAKTISKE state-machine-funktioner**
   (`mskelStep`/`mskelAdvancePhase`/`mskelBeginArmPhase`/
   `mskelUpdateConfirmUI`/`mskelFlipElbow`), udtrukket verbatim fra filen og
   kørt i en minimal Node-harness (stub-DOM, stub-video) — ikke en browser,
   men de rigtige funktioner, ikke gentypet. Drev et helt syntetisk
   bænk-sæt igennem klik for klik og talte de fysiske interaktioner (se
   tabel nedenfor), testede ⇄-vending midt i et forslag, og testede at en
   degenereret IK (skulder ≈ stang) falder rent tilbage til manuel
   albue+håndled-klik uden at krasche.
3. **Regressionskørsel af benkæden** med samme harness, samme
   `mskelStep`/`mskelAdvancePhase` (delte funktioner) — 12 klik uden
   historik, 6 med (3 ankel-klik + 3 bekræft-tryk), præcis som ordre 43.
   Beviser at de fælles funktioner, jeg måtte røre for at hægte armkæden på,
   ikke har ændret benkædens opførsel.
4. `npm run lint`, alle 7 `verify:videocoach-*` og `npm run gate:tracker` —
   grønne efter commit.

## Hvad blev bygget

**Skulderen: ét klik for hele sættet.** I modsætning til benkædens ankel
(som flytter sig gennem hele squat/dødløft-bevægelsen og derfor skal
placeres i alle tre faser) står skulderen fysisk stille i et bænkpres.
Klikkes den i TOP-fasen, genbruges den **direkte** i BUND og STICKING uden
noget nyt klik — det gælder uanset om atletens arm-længder er kendt fra
tidligere eller ej. Det er den billigste gevinst i ordren og kræver ingen
historik overhovedet.

**Håndled: stangens sporede position, intet klik.** "Grebet er på stangen" —
`barXYAt()` (allerede trackerens output) bruges direkte som håndledspunktet
i hver fase, ligesom benkædens hænder allerede var låst til stangen i den
ældre kode.

**Albue: geometrisk låst, med et synligt, vendbart sideval.** Kendes
atletens overarm+underarm-længde fra en tidligere godkendt/delt analyse af
samme atlet+løft+variation (`extra.skeleton_proportions`, samme kolonne som
benkæden bruger — ingen skemaændring), lægges albuen ud ved to-cirkel-skæring
mellem skulder og stang. Tvetydigheden (albuen kan ligge på to sider af
skulder-stang-linjen) løses:
1. ud fra denne sessions eget ⇄-tryk, hvis Marc allerede har vendt den,
2. ellers ud fra den forrige analyses faktiske valg pr. fase (gemt som
   `elbowSign`),
3. ellers standard: albuen "nedad" i billedet — sådan flader den ud i et
   bænkpres uafhængigt af hvilken vej atleten vender på skærmen, så
   standarden er kamera-retnings-uafhængig.

Forslaget er markeret synligt (stiplet ring, samme sprog som benkæden, plus
en ekstra tekstlabel "albue: forslag · ⇄ kan vendes" ved selve punktet,
fordi netop denne tvetydighed er ordrens hovedfaldgrube). En ny **⇄
vend albuen**-knap (ved siden af ✓ Videre) spejler albuen om
skulder-stang-linjen med ét tryk, og valget gælder resten af sættet (næste
fase genbruger samme side, medmindre Marc vender den igen). Drag-to-correct
virker som hidtil på alle punkter, inklusive de nye albue/håndled-punkter
(rettede en hul i hit-testen — se nedenfor).

**Ingen gemte arm-længder → uændret funktionalitet, men billigere.** En helt
ny atlet+løft-kombination får ingen albue/håndled-genvej, men skulderen
genbruges stadig på tværs af faser (den bevæger sig jo jo ikke, uanset om vi
kender arm-længderne) — så selv FØRSTE analyse af en ny atlet falder fra 9
til 7 fysiske klik. Rammer en gemt proportion en degenereret geometri midt i
et sæt (fx en tracking-fejl der lægger stangen oven i skulderen), falder den
ramte fase rent tilbage til manuel albue+håndled-klik, uden at krasche og
uden at kaste den allerede placerede skulder væk.

**Rettet undervejs:** drag-to-correct-hit-testen (`canvas pointerdown`,
"et klik nær et auto-placeret punkt optager det til at TRÆKKE") var
hardkodet til benkædens fire led (`sh/hip/knee/ank`) og ville aldrig have
ramt de nye albue/håndled-forslag — rettet til at inkludere `el`/`wr`.

## Klikketallet før og efter

Talt ved at KØRE de faktiske `mskelStep`/`mskelAdvancePhase`-funktioner
gennem et helt syntetisk sæt (se metode punkt 2), ikke ved håndoptælling:

| | Bænk — FØR ordre 47 | Bænk — EFTER, ingen historik | Bænk — EFTER, med gemte arm-længder |
|---|---|---|---|
| **Klik-skelet (3 punkter × 3 faser)** | 9 klik | 7 (skulder genbrugt, albue+håndled fortsat manuelt i BUND/STICK) | **1 skulder-klik + 3 bekræft-tryk = 4** |

Målet var "ned mod noget der ligner benkædens 6 eller derunder" — bænk
lander på **4 med historik**, under benkædens 6. Uden historik lander den på
7, en mindre gevinst end benkædens (som ikke havde en "ingen historik men
alligevel billigere"-vej) — ren bonus af at skulderen er fysisk stillestående,
uafhængig af om arm-længderne er kendt.

Den oprindelige ordre og min egen ordre-43-rapport nævnte "12 klik" for
bænk — det var upræcist: bænks klik-skelet har altid haft 3 led (skulder/
albue/håndled), ikke benkædens 4, så den reelle før-værdi er **9**, ikke 12.
Rettet her for ærlighedens skyld; målsætningen ("ned mod ~6 eller derunder")
er nået uanset hvilket tal man starter fra.

Benkæden selv (squat/dødløft) er upåvirket: 12 → 6, uændret, verificeret ved
regressionskørsel (se metode punkt 3).

## Hvad jeg ikke turde automatisere, og hvorfor

- **Retroaktiv sideret-flip.** Vender Marc albuen i BUND-fasen (fordi
  standard-gættet var forkert der), propagerer valget FREMAD til STICKING,
  men retter ikke en allerede bekræftet TOP-fase. At åbne en lukket fase
  igen for at rette den ville kræve at gense-seeke og genopbygge UI-state
  for en fase Marc allerede har forladt — risikoen ved det virkede større
  end gevinsten. Drag-to-correct er stadig den universelle rettelse for en
  allerede bekræftet fase.
- **Ingen "gæt på et anatomisk sideval" uden nogen reference overhovedet.**
  Standarden ("albuen nedad") er en rimelig antagelse for et almindeligt
  bænkpres set fra siden, men jeg har ikke forsøgt at genkende gribebredde,
  skråbænk vs. flad bænk, eller andre variationer der kunne ændre hvilken
  side der er anatomisk korrekt. Er standarden forkert for en given
  opsætning, viser forslaget det tydeligt (spejlvendt figur, markeret som
  forslag) og ⇄ retter det på ét tryk — men jeg har ikke bygget en smartere
  heuristik end "nedad i billedet".
- **Håndledspunktet får ingen offset fra stangens centrum.** "Håndleddet
  følger stangen" er implementeret som lighed (håndled = stangens sporede
  punkt), ikke stangcenter + et gemt gribe-offset. Grebbredden varierer
  reelt lidt fra stangens midte i et sidebillede, men den forskel er lille
  nok (få cm, oftest under trackerens egen usikkerhed) at en ekstra gemt
  størrelse ikke virkede nødvendig for at opfylde ordren.
- **Ingen ny bruger møder et tomt løft** — bekræftet: uden gemte
  proportioner er bænkens flow funktionelt identisk med i går (blot med
  skulderen genbrugt, som er en ren gevinst, aldrig et tab af mulighed).

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler,
  urørt).
- Alle 7 `verify:videocoach-*`-scripts — grønne.
- `npm run gate:tracker` — GRØN (alle rigge, inkl. tracker-live-bench).
- 12 isolerede enhedstests af IK-geometrien — grønne (se metode punkt 1).
- Faktisk kørsel af den udtrukne state-machine gennem et helt syntetisk
  bænk-sæt, tre scenarier (ingen historik / med historik / degenereret
  IK-fallback midt i sættet) — alle forløb korrekt, ingen krasch.
- Regressionskørsel af benkæden gennem samme delte funktioner — 12/6 klik,
  uændret fra ordre 43.
- Hele det indlejrede script parser fejlfrit (`node --check` på det
  udtrukne script).

## Ærlige grænser

- **Ingen browser-session overhovedet, hverken headless eller andet.**
  Miljøet her har hverken `playwright` eller `puppeteer` installeret, og jeg
  har bevidst ikke installeret dem i selve projektet (ville lægge en ny
  dev-afhængighed ind for én ordres skyld, uden for ordrens omfang). Jeg
  forsøgte oprindeligt at bygge en fuld jsdom-drevet DOM-test, men opgav den
  til fordel for at køre de faktiske udtrukne funktioner direkte (metode
  punkt 2-3) — det tester den ægte kontrol-flow og de ægte klik-tal, men
  IKKE canvas-tegningen, koordinat-omregningen fra skærm-px til video-px,
  eller hvordan `⇄ vend albuen`-knappen rent visuelt sidder ved siden af
  ✓ Videre på en rigtig mobilskærm.
- **Standard-sidevalget ("albuen nedad") er ikke afprøvet mod en rigtig
  bænkpres-video.** Det er en geometrisk/anatomisk antagelse, ikke et målt
  resultat — ligesom ordre 43's proportions-forslag var en antagelse om
  uge-til-uge-stabile kropsmål, indtil Marc rent faktisk brugte det.
- **Kun ét reelt bænkforslag pr. sæt testet i harness'en** (top→bund→sticking
  i én, lineær kørsel) — ikke rep-til-rep-variation inden for samme sæt
  (klik-skelettet gælder jo hele sættet, ikke pr. rep, så det er ikke en
  hulhed i selve mekanikken, men jeg har ikke testet fx at skifte rep via
  ◀/▶-knappen SAMTIDIG med et arm-forslag i gang — de to features rører ikke
  hinandens kode, men er ikke eksplicit testet sammen).
- **Håndledsligheden med stangen** (uden gribe-offset, se ovenfor) er en
  antagelse jeg ikke har målt mod en rigtig video.

## Betydning for Hara

Direkte under "Appen mærkbart bedre" (Coaching-planeten): bænkpres var den
ene løftetype ordre 43 eksplicit måtte lade stå ("intet anatomisk analogt
fastpunkt") — nu har den sit eget, stærkere anker (skulderen bevæger sig
mindre end ankelen gør), og klik-skelettet for bænk går fra 9 til så lidt
som 4 klik ved anden analyse af samme atlet, under benkædens egen 6.

## Hvad er næste

- Lad `elbowSign`/arm-længderne samle et par ugers rigtige tal (som
  `setup_ms` gør for ordre 43), så standard-sidevalget kan efterprøves mod
  faktisk brug.
- Et gemt gribe-offset fra stangcenter (hvis mobil-gennemgangen viser at
  ligheden er for grov i praksis).
- En rigtig mobil/tablet-gennemgang af ⇄-knappens placering ved siden af
  ✓ Videre (kun set i kode/harness her, ikke på en skærm).

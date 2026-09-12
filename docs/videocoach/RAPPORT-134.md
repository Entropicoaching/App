# RAPPORT-134: "Vis mig nu" på flere reps - vindue 2 og 3

## Gren

`vis-mig-nu-vindue-2-3`, base `main` (`3f0e13b`, ordre 131 merget). To commits:

- `24855e6` — tid pr. vindue (diag-linje + `verify:videocoach-clip`) OG de tre
  forsøgte seek-strategier for vindue 2/3 (playthrough/fastSeek/skjult
  video-klon), som teknisk delte samme kode-overflade
  (`vcRealtimeTrackWindow`s nye `opts`-parameter) - lagt i ét commit i
  stedet for ordrens "commit 1"/"commit 2", da de ikke kunne adskilles
  bagefter uden at skrive koden om. Valgt fornuft, ikke spurgt blokerende -
  se "Ærlige grænser".
- `7c41aad` — `#vcDiagLine`s synlighed rettet i ATHLETE/SLIM-visning (den
  rigtige telefon-oplevelse), fundet ved et 390px-screenshot under
  verifikation af commit 1's nye tabel.

Ingen ændring af `analyse/faser/upload/autoCalib`. Ingen ny afhængighed.
Ingen push. Ingen atletdata (kun Marcs eget testklip og det syntetiske
4-reps-klip, begge git-ignorerede).

## Hvad ændret

**Commit 1** — `vcRtDiag` (`public/videocoach.html`, delt med
`scripts/verify-videocoach-clip.mjs`s stub) fik tre nye buckets:
`seekMs` (ventetid på vinduets seek - eget eller arvet skygge-løfte),
`foersteFrameMs` (ankerframe + første features FØR selve rVFC-løkken
starter) og `sporingMs` (hele løkkens vægtid, inkl. den tid den reelt
venter på 1x-afspilning frem til næste frame - ingen enkelt bucket fangede
den tid før). `vcAthletePreviewThree` snapshotter `vcRtDiag` før/efter hvert
vindue og bygger nu en tabel pr. vindue i den eksisterende `?diag=1`-linje;
`verify:videocoach-clip` printer samme tre tal pr. vindue i sin egen
konsol-tabel.

Målt FØR noget ændredes (se "Testresultat"): søgningen bekræftede
TID-PR-FRAME.md's fund (søgning+nedskalering dominerer PR. FRAME), men viste
noget nyt PR. VINDUE - *seek-tiden vokser med afstanden* mellem vinduer
(31ms → 121ms → 293ms på det syntetiske klip, vindue 1→2→3), fordi den
nuværende skygge (ordre 121/124: næste vindues seek startes først når
FORRIGE vindues afspilning er færdig) kun giver et par ms's efterbehandling
som skjul - alt for kort til en seek der typisk tager 100-300ms.

**Commit 1's tre forsøgte strategier** for vindue 2/3's seek (alle KUN i
`scripts/verify-videocoach-clip.mjs`s test-only orkestrering, bag et nyt
`--strategy=current|playthrough|fastseek|clone`-flag - INGEN af dem ændrer
produktionsstien i `vcAthletePreviewThree`, som stadig kalder
`vcRealtimeTrackWindow` med præcis de samme 4 argumenter som før):

- **(a) playthrough** (`rtAdvanceTo`, ny i `public/videocoach.html`): intet
  seek - videoen blive ved med at spille (1x, tracking slået fra) gennem
  mellemrummet, `vcRealtimeTrackWindow` fik en `opts.pauseAtEnd`-flag (default
  `true`, uændret adfærd) der lader den blive ved med at køre i stedet for at
  pausere ved vinduets slutning.
- **(b) fastSeek** (`rtFastSeekToOn`, ny): samme skygge-mønster som i dag,
  men bruger `video.fastSeek()` i stedet for at sætte `currentTime` direkte.
- **(c) skjult video-klon** (`rtEnsureClone`, ny): to `<video>`-elementer
  (den rigtige og en skjult klon med samme kilde) bytter rolle for hvert
  vindue (dobbelt-bufring) - imens vindue k spores på det ene, forudsøges
  vindue k+1 på det andet, med HELE vindue k's spilletid som skygge (typisk
  0,5-2,5s) i stedet for blot efterbehandlingens få ms.
  `vcRealtimeTrackWindow` fik `opts.sourceVideo` til at kunne spore på et
  vilkårligt videoelement.

**Commit 2** (ordrens commit 3, "atletens oplevelse") - ingen af de tre
strategier vandt gate'n (se "Testresultat"), så den betingede opgave
("Hvis (a) vinder: ...") bortfaldt. I stedet blev en REEL, hidtil ukendt
fejl fundet ved at følge ordrens egen instruktion om et 390px-screenshot:
`#vcDiagLine` (commit 1's nye tabel, og hele det oprindelige `?diag=1`-fund
fra ordre 82) er `position:static` og har ALDRIG haft nogen egen positionering
- i DESKTOP-tilstand (Marcs egen `file://`-visning, hvor alt andet er
normal dokument-flow) fungerer det fint, men i ATHLETE/SLIM-tilstanden (den
rigtige telefon-oplevelse, hvor ALT andet UI er `position:fixed`) males en
ikke-positioneret boks altid BAGVED sine positionerede søskende, uanset
DOM-rækkefølge - `#vcDiagLine` var derfor 100% USYNLIG på telefonen, malet
under hele video-scenen. Rettet med samme mønster som `#athleteStatus` selv
fik under ordre 54 · commit 3 ("ned under begge"): `body.athlete #vcDiagLine`
får nu `position:fixed`, placeret lige under statuskortet, `pointer-events:
none` (rører aldrig video/scrub-berøring nedenunder).

## Testresultat

**Tid pr. vindue, FØR noget ændredes** (standard-kørslen,
`--windows=new --seek=new --strategy=current`, uændret produktionssti):

| Klip | Vindue | seek | 1.frame | sporing | samlet | x realtid |
|---|---|---|---|---|---|---|
| Marcs klip | 1 | 38ms | 18ms | 2607ms | 2663ms | 1,04x |
| Marcs klip | 2 | 112-120ms | 17-19ms | 1614-1627ms | 1744-1766ms | 1,09-1,11x |
| Syntetisk | 1 | 31-40ms | 18-21ms | 720-728ms | 774-783ms | 1,38-1,40x |
| Syntetisk | 2 | 108-145ms | 11-16ms | 534-555ms | 665-698ms | 1,19-1,25x |
| Syntetisk | 3 | 281-347ms | 12-15ms | 534-538ms | 833-900ms | 1,49-1,61x |

Samlet (3 kørsler pr. klip, maskinens egen støj): **Marcs klip 1,06-1,07x**
(GRØN, uændret siden ordre 124), **syntetisk klip 1,35-1,42x** (RØD, over
1,1x-grænsen - uændret facit-billede siden RAPPORT-121/124: korte 0,56s-
vinduer betaler proportionalt mere opsætnings-overhead). Seek-tiden VOKSER
tydeligt med afstanden mellem vinduer (31→108→281ms på det ene klip,
112→? kun 2 vinduer på det andet) - den nuværende skygge (efterbehandlingens
få ms) dækker næsten intet af det.

**De tre strategier, målt på det syntetiske klip** (samme presearch/vinduer,
kun HVORDAN vindue 2/3's seek udføres varierer):

| Strategi | Vindue 2 seek | Vindue 3 seek | Samlet x realtid | Facit (mean/max px) |
|---|---|---|---|---|
| current (uændret, i produktion) | 108-145ms | 281-347ms | **1,35-1,42x** | 0,00 / 0,00 |
| (a) playthrough | 1264ms (!) | 3067ms (!) | **3,67x** | 0,00 / 0,00 |
| (b) fastSeek | 137ms | 320ms | **1,41x** | 0,00 / 0,00 |
| (c) skjult video-klon | **0ms** | **0ms** | **1,14x** | 0,00 / 0,00 |

Marcs klip (kun 2 vinduer, ingen vindue 3) bekræfter samme billede: current
1,06-1,07x, (c) skjult klon 1,04-1,05x (vindue 2's seek 112ms → 0ms), (a)
playthrough 0,95x (kunstigt godt - klippets to vinduer OVERLAPPER i tid
[0,00-2,55s og 2,25-3,84s], så "spil gennem mellemrummet" kræver ingen ventetid
overhovedet her - et facit uden almen gyldighed, se "Ærlige grænser"), (b)
fastSeek 1,41x (ingen målbar forskel fra current).

**(a) playthrough forkastet**: et rent tab på ethvert klip med reel hvile
mellem reps (som det syntetiske, 1,24s og 3,04s mellemrum) - at lade videoen
spille i 1x GENNEM mellemrummet koster PRÆCIS mellemrummets egen længde i
ægte ventetid, langt mere end selv den dyreste seek (293ms). Ordrens egen
"stå på skuldre"-tekst nævnte `playbackRate` som en mulighed for hurtigere
gennemspilning af mellemrummet - IKKE afprøvet her (ude for tid), se
"Hvad er næste".

**(b) fastSeek forkastet**: ingen målbar forskel fra den nuværende seek
(137-320ms mod 108-347ms, samme størrelsesorden, indenfor maskinens egen
støj) - Chromium ser ud til at behandle `fastSeek()` som en almindelig,
præcis seek, ikke en billigere keyframe-seek, i hvert fald i denne
headless-udgave.

**(c) skjult video-klon** gav den klart bedste, og eneste reelt lovende,
forbedring: vindue 2 og 3's seek faldt til PRÆCIS 0ms (fuldt skjult i det
foregående vindues egen spilletid, ~0,56-2,55s - langt mere skygge end
efterbehandlingens få ms) på BEGGE klip, konsistent over gentagne kørsler.
Samlet gik det syntetiske klip fra 1,35-1,42x til **1,14x** - stadig OVER
ordrens 1,10x-grænse, men det resterende gab er nu fuldstændig lokaliseret:
vindue 1 (som ALTID spores på det oprindelige element, ingen klon kan
forudsøge det FØRSTE vindue) har en fast ~165ms "sporing"-overhead ud over
sin egen spilletid (728ms sporing for 560ms spillet), IDENTISK i alle fire
strategier og også i baseline FØR denne ordre - en allerede kendt
opstartsomkostning (kold JIT/dekoder-opvarmning ved sessionens allerførste
`video.play()`), ikke noget seek-strategien kan løse. 1,14x - 1,10x svarer
næsten PRÆCIS til denne ene overhead fordelt over tre vinduers samlede
spilletid.

**Vigtig selvkorrektion undervejs**: (c)-strategien fik headless Chromium
til at style ("Target crashed") to gange under back-to-back-kørsler af
BEGGE testklip i samme browser-session, hvilket først blev noteret som en
mulig ressource-risiko ved dobbelt video-afkodning. Direkte efterprøvet ved
at gendanne den HELT UÆNDREDE, oprindelige kode (før nogen ordre 134-ændring)
og køre PRÆCIS samme kombinerede test igen: DEN CRASHEDE OGSÅ, på et helt
andet sted i koden (`window.runAnalysis`, ikke klon-strategien). Konklusion:
crashet er en allerede kendt, ikke-relateret skrøbelighed i denne
headless-testbænk under lang, tung session-belastning (samme klasse fund som
RAPPORT-124 selv dokumenterede for "Target crashed"), IKKE en egenskab ved
video-klon-tilgangen. Isolerede enkelt-klip-kørsler af (c) var 100% stabile
og reproducerbare (se rå tal ovenfor). Denne selvkorrektion betyder (c) ikke
er udelukket af et bevist crash-problem - men den ER stadig IKKE portet til
produktionskoden, se "Ærlige grænser" for hvorfor.

`npm run lint`: **0 fejl** (samme 13 præeksisterende
`react-hooks/exhaustive-deps`-advarsler, urørt). Alle 12
`verify:videocoach-*`-scripts udenfor `-clip`: **GRØN**. `verify:videocoach-clip`
(standard, ingen flag - den ægte produktionssti): **Marcs klip GRØN (1,06-
1,07x)**, **syntetisk klip FEJL (1,35-1,42x, over 1,1x)** - UÆNDRET facit
siden før denne ordre, da ingen strategi blev shippet til produktion.

## Hvad er næste

- **1,10x-grænsen er stadig ikke nået** på det syntetiske klip. Den skjulte
  video-klon (c) er den eneste strategi der reelt lukker det meste af gabet
  (1,35-1,42x → 1,14x) og er IKKE udelukket af noget bevist crash-problem
  (se selvkorrektionen ovenfor) - men er heller ikke portet til
  `vcAthletePreviewThree`: den introducerer et ANDET, ikke-testet
  ressourceforbrug (to samtidige video-afkodninger i stedet for én) som
  aldrig er afprøvet på en rigtig telefon, kun i headless Chromium på en
  udviklingsmaskine. En fremtidig ordre med adgang til et rigtigt device
  (eller Marcs egen telefon) bør afprøve (c) direkte der, FØR den overvejes
  til produktion - koden ligger klar i `scripts/verify-videocoach-clip.mjs`s
  `window.runVisMigNuFromPresearchClone` og de fire nye hjælpefunktioner i
  `public/videocoach.html` (`rtSeekToOn`, `rtFastSeekToOn`, `rtAdvanceTo`,
  `rtEnsureClone`), alle allerede 1:1 genbrugelige fra `vcAthletePreviewThree`
  via `vcRealtimeTrackWindow`s nye `opts`-parameter.
- Selv med (c) fuldt ud portet ville vindue 1's ~165ms faste
  opstartsomkostning stadig stå tilbage som den sidste hindring for 1,10x på
  KORTE (0,56s) vinduer - ikke et seek-problem, formentlig kold JIT/dekoder-
  opvarmning ved selve sessionens første `video.play()`. Ude for denne
  ordres grænser at undersøge videre (ville røre selve
  sporings-/opstartskoden, ikke seek-strategien).
- (a) playthrough kunne muligvis konkurrere med en hurtigere `playbackRate`
  under selve mellemrummet (ordrens egen "stå på skuldre"-idé, ikke afprøvet
  her) - men (c) er allerede klart bedre og enklere at ræsonnere om, så
  denne vej blev ikke forfulgt videre.
- Et RIGTIGT multi-reps-klip fra Marc (3-8 reps, ingen hårde snit) ville
  stadig give et mere sigende facit-billede for vindue 2/3 end det
  syntetiske klips kunstige, ens-gentagne vinduer - uændret ønske siden
  RAPPORT-121/124.

## Ærlige grænser

- **1,10x-grænsen er IKKE nået** på det syntetiske klip, i INGEN af de
  afprøvede strategier. Bedste ærlige tal: 1,14x (skjult video-klon, ikke
  shippet). Marcs eget (ægte) klip var og er GRØN (1,04-1,11x på tværs af
  alle fire strategier).
- **Ingen produktionsadfærd er ændret** i denne ordre - `vcAthletePreviewThree`
  kalder stadig `vcRealtimeTrackWindow` med præcis de samme 4 argumenter som
  før ordre 134; `opts`-parameteren defaulter til uændret adfærd. Kun
  test-scriptets nye `--strategy`-flag kan slå de tre forsøg til. Dette er et
  BEVIDST valg, direkte efter ordrens egen regel ("Behold kun det der giver
  ≤1,10x ... Kan det ikke nås, så det bedste ærlige tal") - ingen strategi
  nåede målet, så ingen blev shippet.
- **Commit 1 og commit 2 (ordrens nummerering) blev lagt i ét git-commit**:
  tidsmålingen og de tre seek-strategier delte samme kodeændring
  (`vcRealtimeTrackWindow`s nye `opts`-parameter, indført for at kunne spore
  på et andet element/lade videoen blive ved med at spille) og kunne ikke
  adskilles bagefter uden at skrive koden om fra bunden. Valgt fornuftigt
  fremfor at spørge blokerende (ordrens egen instruks) - noteret her, ikke
  skjult.
- **Video-klonens ressourceprofil er ikke afprøvet på en rigtig telefon** -
  kun i headless Chromium på en udviklingsmaskine (som selv viste sig
  generelt skrøbelig under lang session-belastning, se selvkorrektionen i
  "Testresultat" - IKKE bevis for eller imod klonens egen sikkerhed, kun et
  ubesvaret spørgsmål). To samtidige hardware-videodekodere er et reelt,
  anderledes ressourceforbrug end i dag; en moderne telefon kan sandsynligvis
  klare det, men det er en påstand, ikke en måling.
- **fastSeek() gav ingen målbar gevinst** i Chromium (headless eller andet er
  ikke afprøvet - kun denne bænks Chromium-version er testet). Kan opføre sig
  anderledes i Safari/WebKit (iOS, hvor de fleste atleter formentlig er) -
  IKKE afprøvet her, uden for denne ordres rækkevidde (ingen iOS-testmiljø
  til rådighed).
- **playthrough (a) er kun afprøvet ved 1x afspilningshastighed** - ordrens
  egen "stå på skuldre"-hint om en hurtigere `playbackRate` under
  mellemrummet blev IKKE afprøvet (tidsprioritering: (c) var allerede klart
  bedre, se "Hvad er næste").
- **`#vcDiagLine`s synlighedsfejl (commit 2) er en ny, hidtil ukendt fejl**,
  fundet ved et 390px-screenshot af den ATHLETE/SLIM-visning en rigtig atlet
  (og Marc, når han tester på telefonen) faktisk ser - IKKE en regression
  fra denne ordres commit 1 (samme `position:static`-mangel har ligget der
  siden ordre 82's oprindelige `vcShowDiag`), men commit 1's længere tabel
  gjorde den usynlige boks endnu større (162px i stedet for ~30px), hvilket
  var det der udløste den grundige efterprøvning. Retter kun synligheden -
  rører ikke selve diag-tekstens indhold eller `?diag=1`-logikken.
- Ingen atletdata i denne rapport eller de committede filer - kun Marcs eget
  testklip og det syntetiske klip (begge git-ignorerede, aldrig committet).
  Ingen ændring af `analyse/faser/upload/autoCalib` (Vaidyas område i
  `Desktop\entropi-app\Dashboard.jsx` er slet ikke rørt - andet repo/worktree).
  Ingen ny afhængighed, ingen push, ingen skrivning til miljøvariabler.

## Betydning for Hara

Sporet "Appen mærkbart bedre for atleterne"
(spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a): denne ordre lukkede IKKE
1,10x-grænsen for vindue 2/3 (Delmål ikke lukket her), men gjorde tre
konkrete ting af varig værdi: (1) en PR.-VINDUE tidstabel (seek/1.frame/
sporing/x realtid), nu synlig for Marc både i appens `?diag=1`-linje og i
testbænken, der for første gang viser PRÆCIS hvor de resterende millisekunder
går på hvert enkelt vindue, ikke kun gennemsnittet; (2) en solidt målt, men
IKKE shippet, kandidat-løsning (skjult video-klon) der lukker det meste af
gabet (1,35-1,42x → 1,14x) og ligger klar til en fremtidig ordre med
device-adgang; (3) en reel, hidtil usynlig fejl rettet - `?diag=1`-tabellen
var 100% usynlig på selve telefonen (kun synlig i Marcs egen desktop-test),
fundet ved at følge ordrens egen "tag et screenshot"-instruks bogstaveligt.
Ingen atletdata brugt eller berørt.

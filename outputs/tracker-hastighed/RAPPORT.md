# ORDRE 45 — Tracker-hastighed: samme svar, halvt så lang tid

Gren: `tracker-hastighed` (fra main `d7ab62e`)

Commits:
- `7e0b3fb` — commit 1: byg tracker-hastighedens målestok (`npm run gate:tracker`)
- `8af8d85` — commit 2: spor kun det der skal ses (bekræftet tidligt stop)
- `88f9feb` — commit 3: "søg mindre pr. frame" — forsøgt, rullet tilbage
- `0f452f9` — commit 4: spring frames over i bekræftede pauser

Filer: `public/videocoach.html` (kirurgisk, kun `mpMatchPoint` + `startMultipoint
Tracking` rørt), `docs/videocoach/tracker-live-bench.mjs` (ny), `docs/videocoach/
tracker-live-bench.baseline.json` (ny), `scripts/gate-tracker.mjs` (ny),
`package.json` (ét nyt script). `dist/videocoach.html` er urørt — den er
git-ignoreret og en ren Vite-build-artefakt af `public/`, regenereret ved
`npm run build`, samme forhold som beskrevet i ordre 43's rapport; intet at
holde manuelt i sync. Ikke rørt: atlet-siden, klik-guiden, Coach Briefing,
opsætningsforslagene fra ordre 43, bænkpressens klik-kæde.

## Rig-fundet (commit 1's vigtigste opdagelse)

Ordren nævnte fem eksisterende rigge i `docs/videocoach/` som allerede
kørte i hånden. En grundig gennemgang af alle 17 filer i mappen (kildekode
læst, hver rig faktisk kørt) viste: **ingen af dem beskyttede den kode
denne ordre skulle optimere.**

- **`tracker-testrig.js` og `tracker-freeze-rig.js`** hen-porterer en
  fuldstændig ANDEN, DØD funktion — `startBarTracking`, det gamle
  encentrums-spor med `grabGray`/`recenterOnPlate`. `grep` bekræfter:
  `startBarTracking` kaldes intet sted i appen. Kun `startMultipointTracking`
  (den `mp*`-baserede fler-punkts-tracker) er live. Porteringen er desuden
  forældet ift. den døde kode der stadig ligger i filen (rig: `bestJ>22`,
  html: `bestJ>26` osv.). `tracker-testrig.js` exit'er derudover ALTID 0,
  selv når den selv skriver "\*\*\* FEJL" i output — kørt på uændret main gav
  to af dens fire enhedstest allerede "\*\*\* FEJL", uden at nogen proces
  nogensinde har fejlet på det.
- **De resterende hurtige `.mjs`-rigge** (`tracker-probe-test`,
  `tracker-deadlift-rig`, `tracker-bottom-seam-rig`,
  `tracker-deadlift-descent-rig`, `tracker-deadlift-top-exit-rig`,
  `bar-path-visual-smoothing-rig`) ER kildetekst-kontrakter mod den LEVENDE
  `startMultipointTracking` — de rører rigtige linjer og fejler hvis de
  forsvinder/omdøbes. Men de kører ikke selve matching-algoritmen og kan
  derfor ikke opdage en ændret bane.
- **`tracker-kinskel-testrig.js`** tester et fjernet, urelateret koncept
  (det gamle MediaPipe-skelet — erstattet af klik-skelettet i en tidligere
  runde). **`run-clean-rebuild-gate.mjs`/`run-entropi-track-ux-gate.mjs`**
  ville faktisk kunne læse den indbyggede `TRACKER_BENCHMARK`-kanal
  (`window.__vcTrackerBenchmarkLast`) fra live-koden, men kræver en browser
  (playwright FANDTES i miljøet, modsat hvad jeg antog i ordre 43) og er i
  dag røde af en urelateret MIME-fejl (`videocoach-zoom.js` serveres
  forkert af riggens egen test-server) — for brede, langsomme og allerede
  i stykker til en hurtig, hyppig gate. **`braek-*.mjs`** muterer
  `public/videocoach.html` midlertidigt for at bevise at test-nr. 2
  fanger en injiceret fejl — nyttigt som meta-test, men for risikabelt at
  køre automatisk i en gate der arbejder på den samme fil. **`athlete-
  start-flow-rig.mjs`** og **`run-OLDER-REPS-AFFORDANCE-HOTFIX-001.mjs`**
  er UX/bro-kontrakter uden relation til trackeren.

Derfor bygger `npm run gate:tracker` (commit 1) på en NY rig,
`tracker-live-bench.mjs`, der trækker `startMultipointTracking` +
`mp*`/`pl*`-hjælpefunktionerne 1:1 ud af `public/videocoach.html` ved
kørsel (samme udtræksteknik som allerede brugt i ordre 43's rapport) og
kører dem i ren Node mod fire (senere seks) deterministiske, syntetiske
scenarier — ægte pixel-for-pixel sporing af den kode jeg rent faktisk
ændrer, ikke en kontrakt eller en portering. De trygge, eksisterende
rigge kører med i `gate:tracker` (som gate for kontrakterne, som ren
info for de to døde) for at opfylde ordrens "kør dem alle" — men den
egentlige beskyttelse er den nye rig.

## De syntetiske scenarier

Alle deterministiske (seeded `Math.sin`-støj, ingen `Math.random`, ingen
ægte video). En skive (radius 70px) med roterende tekstur (som
tryk/logo på en rigtig skive — nødvendigt for at `mpGoodFeatures`
overhovedet finder hjørne-lignende detaljer at spore) bevæger sig lodret
mod en statisk, støjet baggrund.

1. **`clean_single_rep`** — ét rent rep, fuld kontrast.
2. **`low_contrast_bottom`** — samme bane, kontrasten falder til 28% i den
   nederste tredjedel (Marcs egen beskrivelse af skygge/mørk baggrund ved
   gulvet).
3. **`multi_rep`** — tre reps af varierende dybde (samme princip som
   median-rep-valget fra ordre 43).
4. **`brief_occlusion`** (bonus) — en mørk bjælke glider hen over skiven i
   ca. 5 frames midt i nedturen. Stresser identitets-/hjemme-
   genfindingsstien i `startMultipointTracking`, som INGEN eksisterende
   rig i mappen rører ved (de to "frys"-rigge tester som nævnt den døde
   tracker).
5. **`idle_tail_after_rep`** (tilføjet i commit 2) — et rent sæt + 9
   sekunders dødtid, skiven ligger stille resten af klippet.
6. **`paused_hold_between_reps`** (tilføjet i commit 2) — to reps med et
   3,5 sekunders hold ved toppen imellem. Den konkrete sikkerhedslås mod
   at en legitim pause midt i sættet fejltolkes som "sættet er slut".

**Hvad de IKKE fanger, som en rigtig optagelse ville:** kamerarystelser/
håndholdt zitter, autofokus-pust, komprimerings-artefakter (blocking,
motion-blur på hurtige reps), en atlet der delvist skjuler skiven med
kroppen, mere end én person/skive i billedet, ægte belysningsskift
(skyer, lys der tændes), og — vigtigst for commit 3's fund — en RIGTIG
skives tryk/logo, som kan have en anden (formentlig skarpere, siden
trykt tekst typisk har hårdere kanter end en genereret "blob") kost-
fladeform end den syntetiske roterende plet. Tolerancen (1,5px maks /
0,5px snit) er sat ud fra hvad koden GARANTERET burde holde (0px ved
uændret sti), ikke ud fra hvor meget en rigtig video kan tåle at
afvige — det ved jeg ikke, og har ingen måde at måle her.

## Tabellen: tid pr. rig, før og efter

`tracker-live-bench.mjs`, alle seks scenarier, sammenlignet mod
`tracker-live-bench.baseline.json` (kørt med `VC_TRACKER_FAST=false`,
adfærdsmæssigt identisk med koden før denne ordre):

| Scenarie | Før (ms) | Efter (ms) | Faktor | Bane-afvigelse (maks/snit px) | Frames-diff |
|---|---:|---:|---:|---:|---:|
| clean_single_rep | 1361 | 1293 | 1,05× | 0 / 0 | 0 |
| low_contrast_bottom | 1447 | 1378 | 1,05× | 0 / 0 | 0 |
| multi_rep | 5356 | 4415 | 1,21× | 0 / 0 | 0 |
| brief_occlusion | 2121 | 1937 | 1,09× | 0 / 0 | 0 |
| idle_tail_after_rep | 12409 | 7106 | **1,75×** | 0 / 0 | 122 (bevidst — se commit 2) |
| paused_hold_between_reps | 7823 | 7062 | 1,11× | 0 / 0 | 0 (bevidst uændret — sikkerhedslås) |

(Tallene svinger nogle få procent fra kørsel til kørsel, som forventet i
et delt Node-miljø — faktorerne ovenfor er fra den seneste rene kørsel;
gentagne kørsler under udviklingen lå konsekvent i samme størrelsesorden.)

**Ærlig konklusion om "halvering":** for et sæt UDEN dødtid efter sidste
rep (allerede stramt klippet) er gevinsten beskeden — 5-21%, drevet
udelukkende af commit 4's pause-genkendelse. For et sæt MED dødtid efter
sidste rep — den konkrete, målte situation min egen ordre 43-rapport
pegede på som den største tilbageværende post i `setup_ms` — er
gevinsten markant (1,75× målt her, og vokser lineært med hvor meget
dødtid klippet indeholder, siden commit 2 stopper efter en fast margin
uanset klippets samlede længde). Der er IKKE fundet en generel halvering
af selve match-arbejdet pr. frame (se commit 3) — kun af HVOR MANGE
frames der reelt skal analyseres.

## Baneafvigelsen pr. rig (mod baseline fra commit 1)

Se tabellen ovenfor — 0px afvigelse i alle seks scenarier i den
endelige, afleverede tilstand. To mellemliggende forsøg gav MÅLT
afvigelse og blev enten strammet (commit 4) eller rullet helt tilbage
(commit 3):

- **Commit 4, første forsøg** (QUIET_NEEDED=4, QUIET_SPEED=radius·0,10):
  op til 2,33px maks / 0,05px snit i `idle_tail_after_rep` og 1,65px
  maks / 0,03px snit i `paused_hold_between_reps` — lige over
  tolerancen. Strammet til QUIET_NEEDED=6, QUIET_SPEED=radius·0,04, som
  gav 0px i alle seks. Sandsynlig årsag til den første afvigelse: den
  syntetiske skives KONSTANT roterende tekstur giver et sub-pixel
  "bevægelses"-signal selv når positionen reelt står stille — en rigtig
  skive i ro roterer typisk ikke kontinuerligt, så den effekt er
  formentlig et syntetisk-test-artefakt, ikke noget der nødvendigvis
  ville ramme en rigtig video lige så hårdt. Strammet alligevel, fordi
  tolerancen skal holde uanset.
- **Commit 3**: se næste afsnit — op til ~300px, rullet helt tilbage.

## Hvilke greb jeg rullede tilbage, og hvad de gjorde ved banen

**"Søg mindre pr. frame" (commit 3), rullet tilbage.** Forsøgt: gør
`mpMatchPoint`s vindue-søgning grovere (skridt 3-4px i stedet for 2px),
med en bredere efterfølgende finpudsning der i teorien dækker de
kandidater det grove skridt sprang over. Målt i `gate:tracker`:

| Skridt/finpudsning | multi_rep afvigelse (maks px) | multi_rep faktor |
|---|---:|---:|
| 4px / ±4px | 297 | 0,90× (LANGSOMMERE) |
| 3px / ±3px | 281 | 0,67× (LANGSOMMERE) |

Begge forsøg var både forkerte OG langsommere — ikke bare uden for
tolerance, men et helt andet resultat i praksis (banen "hopper" til en
forkert lokal løsning). Roden: den ZNSSD-baserede punkt-matching har et
smalt, skarpt minimum omkring en tekstureret detalje (den roterende
"logo"-plet i den syntetiske skive); et groft gitter kan lande på begge
sider af det minimum uden nogensinde at samplet punktet der faktisk er
tættest på, og finpudsningen forfiner så blot et forkert coarse-fund.
Samme risiko er sandsynlig på en rigtig skives tryk/logo — måske
skarpere, siden trykt tekst typisk har hårdere kanter end en genereret
blob. Rullet 100% tilbage til den oprindelige, tætte søgning; koden er
uændret bortset fra en forklarende kommentar (se commit `88f9feb`).

## Hvad jeg ikke turde røre i trackeren, og hvorfor

- **En rigtig billed-pyramide** (ægte nedskalering/udjævning af BÅDE
  skabelon og søgebillede — ikke bare et gitter med større skridt i
  samme opløsning) ville formentlig undgå commit 3's problem, siden
  udjævning netop glatter det smalle minimum ud i stedet for at springe
  hen over det. Men det er en væsentligt større omskrivning af selve
  matcheren (nyt patch-format, ny skabelon-opbygning, ny fejlmargin at
  validere) end denne ordre kan bære forsvarligt på én nat, med reel
  risiko for en ny, subtilere version af samme fejl. Ikke forsøgt.
- **`plEvidence`/`plSearch`s vinkel- og radius-opløsning** (24 vinkler ×
  5 radier i identitets-/hjemme-genfindingsvagten) blev overvejet som et
  alternativt "søg mindre"-mål — formentlig en glattere kostflade end
  ZNSSD, så mindre udsat for commit 3's fejl. Ikke forsøgt: det er
  SIKKERHEDSmekanismen bag frys-vagten og dødløftens gulv-genankring
  ("Du må gøre dem hurtigere. Du må ikke gøre dem svagere" — ordrens
  egen formulering), og efter commit 3's dyrekøbte lektie ville endnu et
  forsøg på samme nat, uden tid til lige så grundig validering, være
  uansvarligt.
- **Deadliftens lockout-position** (`topIndex=last.end` i den
  keyframe-relaterede kode fra ordre 43) er urørt af hele denne ordre —
  ingen af de fire greb rører den kodesti.
- **`QUIET_SPEED`/`QUIET_NEEDED` i commit 4** er sat stramt (kun 0px
  afvigelse accepteret), hvilket betyder gevinsten er beskeden på de
  syntetiske scenarier. Jeg forsøgte IKKE at finde en "netop akkurat
  nok" mellemting mellem det første (for løse) og det endelige (stramme)
  forsøg — givet commit 3's erfaring valgte jeg den sikre side frem for
  endnu en tuning-runde.
- **Bænkpressens rotationsfiltrerede center-korrektion** (den særlige
  `benchMode`-gren i `startMultipointTracking`) er urørt — ingen af de
  fire greb ændrer betingelserne der fører ind i den, og ordren beder
  eksplicit om at lade bænk-klik-kæden stå.

## Frys-vagten og kontinuitetsreglen

Rørt, men kun gjort hurtigere, ikke svagere: `mpMatchPoint` (bruges af
BÅDE den almindelige fremad-matching og kontinuitetsreglens tilbage-
tjek) er 100% uændret i den afleverede tilstand (commit 3 rullet
tilbage). Identitets-/hjemme-genfindingslogikken i
`startMultipointTracking` (plade-audit, dødløft-hjem-anker,
lost-recovery) er slet ikke rørt af nogen af de fire commits.
`brief_occlusion`-scenariet (tilføjet netop for at stresse denne sti)
viser 0px afvigelse i den endelige tilstand.

`tracker-freeze-rig.js` (portering af den døde tracker, se ovenfor)
består "hele vejen igennem" som krævet — men fordi den tester kode jeg
aldrig rører, ikke fordi jeg har bevist noget om den LEVENDE frys-vagt.
Det beviser i stedet `brief_occlusion`-scenariet i den nye rig.

## Én kontakt

`VC_TRACKER_FAST` (localStorage-nøgle `vc_tracker_fast`, default TIL)
styrer alle tre greb (commit 2 + commit 4 — commit 3 er rullet helt
tilbage og har derfor intet at slå fra). Slået fra er koden
byte-for-byte den samme sti som før ordre 45 — bekræftet i `gate:tracker`
ved at generere baseline med flaget fra og sammenligne mod samme flag
igen; alle seks scenarier giver identisk bane.

En lille, altid synlig knap ("⚡ Hurtig sporing" / "🐢 Langsom sporing
(original)") nederst til venstre i videocoach.html slår kontakten til/fra
med ét tryk, husker valget i localStorage, og virker med det samme —
ingen kodeændring, intet redeploy. Testet i en levende browser (klik →
`VC_TRACKER_FAST` skifter → teksten opdateres → valget overlever en
genindlæsning). `?trackerFast=0`/`=1` i URL'en sætter og husker samme
kontakt, hvis Marc nogensinde skal sætte den eksplicit udefra.

## Testresultat

- `npm run gate:tracker` — grøn efter hvert commit. Endelig kørsel: 6/6
  scenarier i `tracker-live-bench.mjs` inden for tolerance (0px
  afvigelse i alle), 6 eksisterende kildetekst-kontrakter grønne, 2
  INFO-rigge (portering af død kode) kørt uden at fejle processen.
- `npm run lint` — 0 fejl (12 præeksisterende React-hook-advarsler i
  `AthleteView.jsx`/`Dashboard.jsx`, urørt af denne ordre).
- Hele det indlejrede script i `videocoach.html` parser fejlfrit efter
  hvert commit (`new Function(...)` på det udtrukne script).
- Levende browser-gennemsyn: siden loader uden konsolfejl, kontakt-
  knappen er synlig og korrekt placeret, og toggler + persisterer
  korrekt ved et rigtigt klik.

## Ærlige grænser

- **Kun syntetiske videoer** — se afsnittet "Hvad de IKKE fanger" ovenfor.
  Ingen af de fire greb er set virke (eller fejle) på en rigtig
  optagelse. Ordren forbød udtrykkeligt atletvideoer, så dette er en
  strukturel grænse, ikke en jeg kunne omgå.
- **Tallene i tabellen er fra Node, ikke browseren.** Absolutte
  millisekund-tal siger derfor intet om hvad Marc vil opleve på sin
  telefon/tablet (anden CPU, JIT-opvarmning, `requestVideoFrameCallback`-
  overhead findes slet ikke i denne rig, da `HAS_RVFC=false` bruges
  bevidst for determinisme). FAKTORERNE (før/efter-forholdet) er det
  troværdige tal — den underliggende matematik og antal beregninger pr.
  frame er identisk uanset miljø.
- **Tolerancen (1,5px maks / 0,5px snit) er et ingeniør-skøn**, ikke en
  værdi Marc har godkendt eller en værdi der er afprøvet mod hvor meget
  en rigtig analyse rent faktisk tåler at afvige før metrics (ROM,
  knævinkel osv.) ændrer sig mærkbart. Sat stramt med vilje ("en
  optimering, der ændrer banen ud over en snæver tolerance, er ikke en
  optimering").
- **`QUIET_SPEED`/`IDLE_STOP_S`-tallene (commit 2 og 4) er ikke afledt af
  målte, rigtige sæt** — de er valgt ud fra hvad der virkede sikkert på
  de syntetiske scenarier plus en generøs margin. Et usædvanligt langt
  hold (over 5 sekunder, fx en meget langsom coach-instrueret pause)
  ville fortsat blive sporet korrekt (ingen tidligt-stop-fejl er mulig
  der er kortere end IDLE_STOP_S), men grænsen er ikke selv testet mod
  en dokumenteret, rigtig grænsetilfælde.
- **Commit 3's konklusion (skarpt minimum i ZNSSD-fladen) er en
  hypotese, ikke et bevist faktum** om rigtige skiver — jeg har kun
  vist at DEN SYNTETISKE tekstur opfører sig sådan, og ræsonneret om
  hvorfor en rigtig skives tryk/logo sandsynligvis ligner nok til at
  dele problemet.

## Betydning for Hara

Under samme delmål som ordre 43 ("Appen mærkbart bedre"): den post
ordre 43's egen rapport pegede på som den største tilbageværende
("selve tracker-kørslen tager stadig reel tid") er nu reelt kortere for
den konkrete situation der blev målt — et sæt med dødtid efter sidste
rep, som er en almindelig del af Marcs opsætning ("han taler videre").
Gevinsten er ikke en generel halvering af selve sporingsarbejdet (det
blev forsøgt og målt til ikke at holde), men en ægte, sikker reduktion i
hvor meget der overhovedet skal spores — plus en nødkontakt Marc selv
kan betjene, hvis noget nogensinde ser forkert ud på en rigtig video.

## Hvad er næste

- Lad Marc bruge værktøjet en uges tid med `VC_TRACKER_FAST` slået til;
  ordre 43's `setup_ms`/`setup_clicks` giver nu et sammenligneligt
  før/efter-tal på rigtige sæt, ikke kun syntetiske.
- Skulle en ægte billed-pyramide (nedskaleret skabelon + søgebillede,
  korrekt udjævnet) vise sig værd at forsøge, kræver den sin egen ordre
  med tid nok til samme grundighed som commit 1-4 her — ikke et
  natte-forsøg oven på tre andre greb.
- Flaskehalsen der er tilbage NÅR et sæt er stramt klippet uden dødtid
  (5-21% i denne gennemgang, ikke en halvering): selve
  punkt-matchingens pr.-frame-omkostning. Målt her, ikke gættet — og
  ikke løst af denne ordre.

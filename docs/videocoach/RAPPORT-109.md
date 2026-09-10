# RAPPORT-109: "Den kunne ikke finde skiverne"

## Gren

`skiverne-findes-ikke`, base `main` (`0afce10`, ordre 105 med). Tre commits:

- `26acdee` — commit 1: kortlægning + syntetisk prøvebænk
- `8ba8d9e` — commit 2: atleten kommer altid videre
- `af7a7e6` — commit 3: kort kalibrerings-årsag til coachen

## Hvad blev ændret

**Commit 1** — `docs/videocoach/SKIVEN-FINDES-IKKE.md` (60 linjer) kortlægger
præcis hvilke betingelser får `autoCalib` (public/videocoach.html, ~linje
6061) til at opgive, og hvad der sker i UI'en ved hvert punkt. Bygget på
`scripts/verify-videocoach-plate-detect.mjs` (`npm run
verify:videocoach-plate-detect`), en syntetisk prøvebænk der kører appens
EGEN `autoCalib` (udtrukket via de eksisterende ORDRE 85-markører, samme
teknik som `verify-videocoach-clip.mjs`) i ren Node - ingen browser, ingen
video, tegnede RGBA-buffere i stedet.

**Stå på skuldre**: før noget blev rørt, undersøgte jeg Hough-cirkel-
transformen og open source barbell-trackere (kilder nedenfor). En JS Hough-
implementation ([alxcnwy/Hough-Circle-Detection](https://github.com/alxcnwy/Hough-Circle-Detection))
har ingen licensangivelse - kan ikke bruges. `kostecky/VBT-Barbell-Tracker`
(CC0) bruger, ligesom appens egen kode, farve/kontrast frem for tung CV, men
kræver en påmalet grøn markør på stangen - irrelevant for en almindelig
skive. Ingen kode importeret. Mønsteret "prøv igen med anden forbehandling
før du opgiver" blev testet DIREKTE i prøvebænken i stedet for gættet:
"inverteret kontrast" gav intet (matematisk virkningsløst, `autoCalib`
bruger allerede `Math.abs(v - prev)`), og "to radius-intervaller" reddede
intet af prøvebænkens fejlende tilfælde. `autoCalib` er derfor **uændret**.

Otte betingelser, otte fund:

| Betingelse | Fundet | Radius-fejl (px) |
|---|---|---|
| baseline (god kontrast, fri bane) | ja | 2.0 |
| kontrast (lys skive på lys baggrund) | nej | - |
| radius uden for forventet interval | nej | - |
| kant mod rack (3 af 4 sider) | ja, men **FORKERT** | 30.0 |
| mørk skive på mørk baggrund | nej | - |
| lille video (160×120) | nej | - |
| skive delvist ude af billedet | ja | 2.0 |
| portrait + sort bjælke (over+under) | ja, men **FORKERT** | 70.0 |

De fire "nej"-rækker fejler RENT (returnerer `null`) - det er dem der ramte
Marcs atlet, og dem commit 2 retter for. De to "FORKERT"-rækker er farligere:
`autoCalib` opdager IKKE selv at den tog fejl, den returnerer en tro og
sikker, men forkert, radius - kun ring-bekræftelsen i UI'en (`plateConfirm`)
fanger dem, uændret af denne ordre.

**Commit 2** — `wizardClick` i `public/videocoach.html`: når auto-detektion
fejler, står atleten ALDRIG fast længere. Én besked ("Jeg kan ikke se skiven
her. Tryk på skivens TOP og BUND, så klarer vi det manuelt") gennem ÉN
kanal ad gangen (statuskort for atleter, banner for coach - aldrig begge, se
"knapper oven på hinanden"-fund nedenfor). Manuel kalibrering krævede FØR 3
klik (TOP, BUND, MIDTE); nu kun 2 (TOP, BUND) - det allerede klikkede
centrum genbruges som MIDTE. Bagefter går flowet gennem SAMME
ring-bekræftelse som et vellykket auto-fund, så Start og "Vis mig nu"
fortsætter ad præcis samme vej uanset kalibreringsmetode. Den gamle,
nu-uopnåelige 3-kliks-gren er fjernet (ikke efterladt som dødt kode).

Konkret fund undervejs: for atleter på smalle skærme landede den gamle
fejlbesked (banner, `top:116px`) OG statuskortets tekst (`athleteStatus`,
også `top:116px`) på PRÆCIS samme sted - to separate rettelser
(MOBIL-GENNEMGANG-2026-09-03 og ORDRE 54 · commit 3) skubbede hver sin ned
for at undgå ANDRE elementer, uden at tjekke hinanden. Det er den konkrete,
levende version af "knapper oven på hinanden" ordren advarede om. Rettet ved
kun at bruge én kanal i den nye besked.

**Commit 3** — en kort årsagskode (`plate:fail:auto`, `plate:fail:small-video`,
`plate:manual:ok`) gemmes i `?diag=1`-feltet (ordre 82) og sendes med i
atletens "upload og gå"-payload i den EKSISTERENDE JSON-kolonne
`session_context` - **ingen migration**. Whitelistet i
`validateVideoUploadRequest` (kun de tre kendte koder). Coach-visningen
(Dashboard.jsx, "Gennemgå måling") viser nu en linje som "Atleten
kalibrerede skiven manuelt (auto-genkendelsen fandt den ikke)" ved siden af
atletens notat.

## Testresultat

Der findes intet `"test"`-script i `package.json` (kun `dev/build/lint/
verify:*`) - samme situation som ordre 105's rapport. Kørt i stedet:

- `npm run lint` — **0 fejl**, 13 præeksisterende `react-hooks/exhaustive-deps`-advarsler (urørt af denne ordre).
- `npm run verify:videocoach-plate-detect` — **GRØN**, tabellen ovenfor.
- Alle 12 `verify:videocoach-*` scripts — **GRØN**, inkl. `verify:videocoach-clip`
  (Marcs eget klip `test-clips\marc-doedloeft-270.mov`: autoCalib finder
  skiven fint på DETTE klip, radius 346px, tier 1). Én PRÆEKSISTERENDE fejl
  i samme script, uændret af denne ordre: "Vis mig nu" tager 1.18-1.20x sin
  afspillede varighed mod grænsen 1.1x - en timing-sag, ikke en
  kalibrerings-sag, uden for dette ordres omfang.
- `verify:videocoach-upload-flow` og `verify:videocoach-upload` — **GRØN**
  (ende-til-ende mod rigtigt klip, bekræfter commit 3's payload-ændring ikke
  brød upload-stien).
- `verify:videocoach-migrations` — **GRØN** (bekræfter ingen migration mangler).

## Hvad er næste

- De to "FORKERT"-tilfælde (rack, portrait-letterbox) er stadig kun dækket
  af ring-bekræftelsen, ikke af en selv-opdagende kontrol. En fremtidig
  ordre kunne måle SPREDNINGEN i de 16 fundne radier (ikke kun medianen) og
  vise en advarsel ved høj uenighed - men det er ikke en billig tilføjelse,
  og lå uden for denne ordres "spørg aldrig blokerende"-ramme.
- Den ældre, sideløbende fulde-spor-og-gem-vej (`vcV3RequestSave`/
  `:save-draft` i AthleteView.jsx) bærer IKKE den nye kalibrerings-årsag -
  se Ærlige grænser.
- `verify:videocoach-clip`'s præeksisterende timing-fejl (1.1x-grænsen) bør
  undersøges i en separat ordre, hvis den stadig generer Marc.

## Ærlige grænser

- **Jeg har ikke set atletens video eller hendes udstyr.** Alt i denne
  ordre er udledt af koden og en syntetisk prøvebænk - ikke af hendes
  faktiske optagelse. Hvis fejlen gentager sig, bør Marc spørge atleten:
  (1) **telefon/model** (ældre telefoner giver lavere opløsning - "lille
  video"-sporet i tabellen), (2) **browser** (Safari/Chrome - påvirker ikke
  autoCalib direkte, men kan påvirke videoopløsning/orientering), (3) **hvor
  skiven var i billedet** - tæt på et rack, delvist uden for kanten, eller
  en mørk skive mod en mørk baggrund er de mest sandsynlige årsager ifølge
  prøvebænken. Med commit 3's diagnostik vil FREMTIDIGE tilfælde vise en
  kort årsag i coach-visningen uden at skulle spørge.
- Den syntetiske prøvebænk er en MODEL af `autoCalib`s opførsel, ikke et
  bevis for hvad der skete for denne specifikke atlet - den viser hvad DER
  KAN gå galt, ikke hvad der GJORDE.
- Kun standardvejen ("upload og gå") bærer den nye kalibrerings-årsag til
  coachen; den sideløbende fulde-spor-og-gem-vej gør ikke - se "Hvad er
  næste".
- Ingen migration lavet eller nødvendig (feltet ligger i eksisterende
  `session_context`-JSON).
- Ingen atletdata læst, hentet eller kopieret; kun Marcs eget testklip brugt,
  som allerede lå lokalt (gitignored).

## Betydning for Hara

Sporet "Appen mærkbart bedre for atleterne" (goal-coaching-vaerdigt-produkt):
en atlet der ikke kan bar-tracke og bliver stående uden vej videre er det
modsatte af mærkbart bedre. Denne ordre lukker det konkrete symptom (atleten
sad fast) og lægger et spor Marc kan følge, hvis det sker igen. Intet
Delmål lukkes.

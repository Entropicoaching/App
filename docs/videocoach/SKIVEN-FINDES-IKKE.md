# "Den kunne ikke finde skiverne" (ORDRE 109)

Marcs eneste faktum: en atlet så beskeden om at skiven ikke kunne findes. Ingen
telefon, browser, lys eller løft kendt. Dette er hvad koden faktisk gør, testet
mod otte syntetiske betingelser i `scripts/verify-videocoach-plate-detect.mjs`
(`npm run verify:videocoach-plate-detect`) - se tabellen i RAPPORT-109.md.

## Hvad `autoCalib` gør (public/videocoach.html, linje ~6061)

Fra ét klik i skivens centrum scannes 16 retninger udad efter det største
kontrast-spring (gråtone, ét trin ad gangen). Mindst 6 af 16 retninger skal
finde et spring > 28 (ud af 0-255), ELLERS returneres `null`. Medianen af de
fundne radier bruges - men kun hvis den er ≥ 12px.

## Betingelser der får den til at opgive rent (returnerer `null`)

- **Lav kontrast** (lys skive på lys baggrund, generelt < 28 i spring): ingen
  retning ser et spring - `radii.length < 6`.
- **Mørk skive på mørk baggrund**: samme mekanisme, den mest sandsynlige
  virkelige version - dæmpet gymlys + sort bumperplade.
- **Radius uden for forventet interval** (skiven fylder > 45% af den korte
  billedside): scanningen når aldrig den rigtige kant.
- **Lille video / skive på få pixels**: bevidst gulv, `rad < 12`.
- **Skive delvist uden for billedet**: grænsetilfælde - nok retninger kan
  stadig nå de 6 stemmer, men det er skrøbeligt.

## Betingelser der IKKE fejler rent - finder en radius, men den kan være FORKERT

- **Kant mod rack**: en stolpe med større spring end skivens egen "vinder" på
  de retninger der rammer den. Én stolpe rykker ikke medianen (kun 1-2 af 16
  stemmer), men rack på 3 af 4 sider gav 30px fejl - stille, uden fejlbesked.
- **Portrait-telefon med sort bjælke tæt på skiven**: bjælke over OG under
  gav 70px fejl, samme mekanisme.

Disse to er IKKE dækket af commit 2's "prøv igen"-vej, fordi `autoCalib` ikke
opdager fejlen selv - den returnerer en tro og sikker værdi. Eneste værn:
ring-bekræftelsen (`plateConfirm`) - atleten SER ringen før analysen starter
og kan trække den eller klikke langt væk for at måle om.

## Hvad skete der i UI'en, før ORDRE 109

Ved `null`: appen krævede 3 nye klik (TOP, BUND, MIDTE), meddelt via
`say('Kunne ikke finde skivens kant · 1/3 · Tryk på skivens TOP')` - ordret
det Marcs atlet sandsynligvis så. For atleter blev DENNE besked vist SAMTIDIG
med en separat `setAthleteState('target', ...)`-tekst i statuskortet - på
smalle skærme lander begge på `top:116px` (MOBIL-GENNEMGANG-2026-09-03 og
ORDRE 54 · commit 3 flyttede hver sin ned for ANDRE elementer, uden at tjekke
hinanden) - "knapper oven på hinanden"-risikoen commit 2 skal undgå.

## Hvorfor ikke Hough-transform eller et OSS-bibliotek

Undersøgt (kilder i RAPPORT-109.md): en JS Hough-cirkel-implementation uden
licensangivelse (kan ikke bruges), og `kostecky/VBT-Barbell-Tracker` (CC0),
der ligesom appen bruger farve/kontrast frem for tung CV - men kræver et
påmalet mærke, irrelevant for en almindelig skive. Mønsteret "prøv igen med
anden forbehandling" er testet direkte i prøvebænken: "inverteret kontrast"
giver intet, fordi `autoCalib` bruger et ABSOLUT spring
(`Math.abs(v - prev)`), uændret af inversion. "To radius-intervaller" reddede
intet af prøvebænkens fejl (kontrast er under grænsen uanset interval;
`rad<12` er bevidst). `autoCalib` er derfor UÆNDRET - commit 2 retter UI'en.

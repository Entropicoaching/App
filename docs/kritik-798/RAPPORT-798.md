Marcs domme holdt: nej (kun een: low bar ligger stadig 6,4 cm under high bar; bænkens stablede led, squat-albuen bag og under stangen og dødløftens skinneben og fodbredder holder). Ligner rigtige løft: ja, næsten (squat, bænk og dødløft ja i stillingerne; på 390 er squat-figuren lille, og sumo-vinduet dækker en del af ryggen). De tre vigtigste ting Yantra retter næste gang: (1) low bar er stadig 6,4 cm under high bar (`S798-1280-lowbar-bund.png` "5,3 cm under skulderen" mod `S798-1280-highbar-bund.png` "1,1 cm over skulderen"; `src/embed/squatAnimation.js` og tabellerne bag): Marc siger "et par cm"; genkalibrér low bar til 4-5 cm som standard nu (det er et spektrum, ikke en tærskel) i stedet for at vente på et svar; (2) squat-animationen på 390 viser stadig figuren lille nederst med et tomt bånd midt i (`A798-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren fylder ca. en sjettedel af højden mellem forfra-feltet og gulvet; forstør figuren og brug højden; (3) forfra-vinduet i dødløft-animationen på 390 ligger over ryg og nakke ved bred sumo (`A798-390-dl-sumo-bred-t0.png`, 82 cm stand; `src/embed/deadliftAnimation.js`, `forfraKasse` i `src/doedloeftFigurer.js`): 784 målte kun 76 cm; vælg hjørnet ud fra alle fodbredder eller gør vinduet mindre på 390.

# Ordre 798, Bhishak, 30. sep. 2026

## Gren

`kritik-798` (fra `main`). Filer kun under `docs/kritik-798/` og `outputs/kritik-798/`: rapporten, mine tre scripts (`tur-798.mjs`, `squat-stang-798.mjs`, `server-798.mjs`; `bue-798.mjs` er ikke kørt) og skærmbilleder (`T798-` stille figurer, `A798-` animationer, `S798-` squat bund/sticking/lockout, `maaling-798.json`). Set på Yantras `main` (nyeste rapport: `RAPPORT-ordre-784.md`, merge f63405e), i headless Chrome på 390 (touch) og 1280, kun 127.0.0.1, ingen netkald (0 blokerede), syntetiske kroppe. Ingen rettelser i løftemodellen eller sitet.

## Holder figurerne Marcs domme?

- **Bænk: ja.** Ved brystet (`T798-1280-baenk-bryst.png`, `T798-390-baenk-bryst.png`) står underarmen lodret og leddene stablet under stangen; stor bue: kontakt 16,8 cm fra skulderen, lille bue 21,1 cm (`A798-1280-baenk-tre-buer.png`, tre buer i samme skala), så toppen ligger tættere på halsen jo større buen er. I lockout står stangen over skulderleddet ved alle tre buer, hvilket er rigtigt; forskellen ses i lænd, bryst og kontaktpunkt. Animationen (`A798-*-baenk-*-t0..t3.png`) bevæger sig fint, men jeg kunne ikke se, hvilken fase t0-t3 er (lille bue t0 viser stangen frit i luften over brystet med skrå underarm), så jeg dømmer bænk-animationen kun på de stille billeder.
- **Squat: albuen ja, stangens sted nej.** Albuen står under og bag stangen ved både low bar (17 cm bag, 19 cm under) og high bar (11 cm bag, 23 cm under) og aldrig ved hovedet (`S798-*-lowbar-bund.png`, `S798-*-highbar-bund.png`, `A798-1280-squat-lowbar-t2.png`). Men afstanden mellem low bar og high bar er 5,3 + 1,1 = 6,4 cm, og Marc siger "et par cm". Stangens sted er et spektrum i modellen, men de to stillinger er stadig to faste punkter langt fra hinanden.
- **Dødløft: ja.** Skinnebenet er helt frem til stangen i starten ved konventionel og sumo (`A798-1280-dl-konventionel-t0.png`, `A798-1280-dl-sumo-bred-t0.png`); fodbredden er en glidende skala 32-82 cm (konventionel, mellemting, sumo), og sumo er nu tydeligt anderledes fra siden (hofte 22 cm over knæ mod 30, mere lodret ryg) og har forfra-vinduet "knæ uden for armene", "stand 82 cm, 40 grader ud". Det er Yantras 784-rettelse, og den virker.
- **Intet er binært:** holder for fodbredde, buer og squat-bar i selve modellerne; kun low/high-afstanden er stadig to faste tal.

## Hvad ser stadig unaturligt ud for en erfaren coach?

- Squat på 390: figuren er lille nederst, et stort tomt felt i midten (`A798-390-squat-lowbar-t2.png`); en coach kan ikke se ryglinjen eller knæet uden at zoome. Figuren i stillingsvisningen (`S798-390-lowbar-bund.png`) er fin og stor.
- Halsen i squat-bunden er en kort klump: hovedet sidder direkte på trapezius (`S798-1280-lowbar-bund.png`, `S798-1280-highbar-bund.png`); Yantra har det som åbent punkt fra 780.
- Sumo-vinduet forfra ligger over øverste del af ryggen på 390 ved 82 cm stand (`A798-390-dl-sumo-bred-t0.png`); figuren skinner igennem under teksten "stand 82 cm".
- Bænk på 390: mærket "skulder 20,1 cm" står oven på det stiplede stangspor og stativet (`T798-390-baenk-bryst.png`, `T798-1280-baenk-bryst.png`); figuren er lille nederst med tomt felt over.
- Dødløft på 390: målene "lænd 24,7 cm" og "hofte 41,0 cm" står nu i tomt rum, men stregerne fra dem og "knæ 0,8 cm" krydser ryggen og hovedet (`T798-390-doedloeft-opstilling.png`); læsbart, men en streg gennem kroppen ser rodet ud.

## Er mine seneste fund lukket? (792)

- Sumo fra siden ligner konventionel: **lukket** (forfra-vindue, lavere hofte).
- Dødløftens mål oven på ryg og hofte på 390: **lukket** (0 mærker på kroppen), kun stregerne krydser.
- Squat-animationen på 390 stor tomt felt: **ikke lukket.**
- Low bar 6,4 cm under high bar: **ikke lukket** (Yantra skriver 6,0; jeg aflæser 5,3 + 1,1 = 6,4 i selve figuren).
- Bænkens lockout viser ikke buens forskel: **ikke ændret, men jeg dømmer nu, at det er rigtigt** (stangen står over skulderen uanset bue); forskellen ligger i kontaktpunktet og lænden, og den ses ved brystet.

## Hvad ændret

Intet i løftemodellen eller sitet; kun mine egne filer under `docs/kritik-798/` og `outputs/kritik-798/`. ca. 117 skærmbilleder og `maaling-798.json` (0 sideafbrudte netkald, 1 fejl på 390: en 404 fra en fil, som siden selv beder om; ikke undersøgt).

## Testresultat

`tur-798.mjs` og `squat-stang-798.mjs` kørte til ende; 390: 1 konsolfejl (404), 1280: 0; 0 blokerede netkald begge. Ingen af Yantras tests kørt (ikke min opgave).

## Hvad er næste

Yantra retter i denne rækkefølge: (1) low bar til 4-5 cm under high bar, (2) squat på 390: større figur, (3) sumo-vinduet uden om ryggen ved alle fodbredder (og mærket "skulder" i bænk på 390). Marc afgør, om 4-5 cm er nok. Betydning for Hara: ingen.

## Ærlige grænser

- Jeg er ikke coach: dommene er en coachs øjne så godt jeg kan aflæse dem, og de to punkter der afhænger af tal (low bar, buens top) er Marcs at afgøre.
- Set i headless Chrome, stille billeder på tilfældige tidspunkter (t0-t4 er ikke navngivne faser), ikke film og ikke en rigtig telefon. Bænk-animationen er kun dømt på de stille billeder.
- Jeg har kun set balancerede, syntetiske kroppe med standardindstilling, ikke alle kroppe og alle indstillinger; `bue-798.mjs` er kopieret fra 792 og ikke kørt.
- Læst: Yantras `RAPPORT-ordre-784.md` og min `kritik-792`; `LAES-MODELLER-3.html` er ikke åbnet (billederne i den er indlejret; jeg tog mine egne af `main`, som er det den beskriver).

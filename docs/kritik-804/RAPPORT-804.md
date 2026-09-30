Marcs domme holdt: nej (kun een: low bar ligger stadig 6,4 cm under high bar, "et par cm" er ikke opfyldt; bænkens stablede led, squat-albuen bag og under stangen og dødløftens skinneben og fodbredder holder). Ligner rigtige løft: ja, næsten (squat, bænk og dødløft ja i stillingerne; på 390 er squat-animationens figur stadig lille og bænkens/dødløftens mål har streger og skilte hen over figuren). De tre vigtigste ting Yantra retter næste gang: (1) low bar: 5,3 cm under skulderen mod high bar 1,1 cm over (`S804-1280-lowbar-bund.png` mod `S804-1280-highbar-bund.png`; `src/embed/squatAnimation.js` og tabellerne bag) = 6,4 cm; sæt low bar til 4-5 cm som standard nu og lad det være en glidende skala, ikke to faste punkter; (2) squat-animationen på 390 (`A804-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren er lille nederst, forfra-vinduet og håndcirklen fylder hele toppen og et tomt bånd står midt i; gør figuren større og læg vinduerne i siden; (3) dødløft-mærkerne på 390 (`T804-390-doedloeft-opstilling.png`; `src/doedloeftFigurer.js`): stregen fra "knæ 0,8 cm" og "lænd 24,7 cm" går tværs gennem ryg og hoved; og bænk-mærket "skulder 20,1 cm" (`T804-390-baenk-bryst.png`; bænkens figurfil i `src/`) ligger oven på stangsporet; brug korte streger eller en fast søjle ved siden af figuren.

# Ordre 804, Bhishak, 30. sep. 2026

## Gren

`kritik-804` (fra `main`). Filer kun under `docs/kritik-804/` (denne rapport og mine scripts `tur-804.mjs`, `squat-stang-804.mjs`, `server-804.mjs`, kopieret fra 798 med nyt ordrenummer) og `outputs/kritik-804/` (116 skærmbilleder og `maaling-804.json`: `T804-` stille figurer, `A804-` animationer, `S804-` squat bund/sticking/lockout). Set på Yantras `main` (f63405e, uændret siden min 798; nyeste rapport `RAPPORT-ordre-784.md`) i headless Chrome på 390 (touch) og 1280, kun 127.0.0.1, 0 netkald sluppet ud, syntetiske kroppe. Ingen rettelser i løftemodellen eller sitet.

## Holder figurerne Marcs domme?

- **Bænk: ja.** Ved brystet står underarmen lodret og leddene stablet under stangen (`T804-390-baenk-bryst.png`, `T804-1280-baenk-bryst.png`). Tre buer i samme skala: kontakt 21,1 cm (lille), 19,1 (middel) og 16,8 cm (stor) fra skulderen, lænd 7,3 / 9,0 / 10,6 cm (`A804-1280-baenk-tre-buer.png`), altså toppen tættere på halsen jo mere man archer, og ikke alle lige meget. Stor bue i lockout (`A804-1280-baenk-stor-t2.png`): stangen over skulderleddet, underarmen lodret, lænden tydeligt hævet.
- **Squat: albuen ja, stangens sted nej.** Albuen står under og bag stangen: low bar 17 cm bag og 19 cm under, high bar 11 cm bag og 23 cm under, forfra 19 cm under stang (`S804-*-lowbar-bund.png`, `S804-*-highbar-bund.png`, `A804-390-squat-lowbar-t2.png`), aldrig ved hovedet. Men low bar står 5,3 cm under skulderen og high bar 1,1 cm over: 6,4 cm imellem, og Marc siger "et par cm". Yantra skriver 6,0, jeg aflæser 6,4 i selve figurerne.
- **Dødløft: ja.** Skinnebenet er helt frem til stangen i starten (`T804-390-doedloeft-opstilling.png`, `A804-1280-dl-konventionel-t0.png`, `A804-1280-dl-sumo-bred-t0.png`). Fodbredden er en glidende skala (stand 32 cm 10 grader ud, mellemting 49, sumo 65,6 og 82 cm 40 grader ud); sumo er tydeligt anderledes fra siden (hofte 21 cm over knæ mod 16 i konventionel) og forfra-vinduet viser "knæ uden for armene" (`A804-390-dl-sumo-bred-t0.png`).
- **Intet er binært:** holder for bue, fodbredde og knæ-stilling; kun low/high-afstanden er stadig to faste tal.

## Hvad ser stadig unaturligt ud for en erfaren coach?

- Squat-animation på 390: figuren er lille nederst (ca. en fjerdedel af højden), øverst fylder håndcirklen og forfra-vinduet, og imellem står et tomt bånd (`A804-390-squat-lowbar-t2.png`). En coach kan ikke aflæse ryglinjen eller knæet uden at zoome. Stillingsvisningen (`S804-390-lowbar-bund.png`) er stor og fin.
- Halsen i squat-bunden er en kort klump: hovedet sidder direkte på trapezius ved både low og high bar (`S804-1280-lowbar-bund.png`, `S804-1280-highbar-bund.png`); åbent fra 780.
- Dødløft på 390: de tre mål står i tomt rum, men stregerne fra "knæ 0,8 cm" og "lænd 24,7 cm" krydser ryg og hoved (`T804-390-doedloeft-opstilling.png`).
- Bænk på 390: "skulder 20,1 cm" og det stiplede stangspor ligger oven i hinanden, og figuren er lille nederst med tomt felt over (`T804-390-baenk-bryst.png`).
- Buens forskel ses ikke i lockout (stangen står over skulderen uanset bue), og det er rigtigt; den ses i lænd, bryst og kontaktpunkt, så en coach skal se brystbilledet for at se forskellen.

## Er mine seneste fund lukket? (798)

- Low bar 6,4 cm under high bar: **ikke lukket** (uændret; venter stadig på Marc/Yantra).
- Squat-animationen på 390, lille figur og tomt bånd: **ikke lukket.**
- Sumo-vinduet ovenpå ryggen på 390: **lukket i det jeg så** (`A804-390-dl-sumo-bred-t0.png`: vinduet ligger i venstre hjørne og rører ikke ryggen ved 82 cm stand); jeg har kun set t0 tæt, ikke alle tidspunkter (t1-t4 ligger i `outputs/kritik-804/`, ikke gennemgået enkeltvis).
- Mærket "skulder" oven på stangsporet i bænk på 390: **ikke lukket.**
- Dødløftens streger gennem kroppen på 390: **ikke lukket.**

## Hvad ændret

Intet i løftemodellen eller sitet, og Yantra har ikke rettet noget siden 798, så billederne er stort set de samme. Kun mine egne filer under `docs/kritik-804/` og `outputs/kritik-804/`.

## Testresultat

`tur-804.mjs` og `squat-stang-804.mjs` kørte til ende; 390: 1 konsolfejl (404 fra en fil siden selv beder om, ikke undersøgt), 1280: se `maaling-804.json`; 0 blokerede netkald sluppet ud. Ingen af Yantras tests kørt (ikke min opgave). Afleveringskommandoen (`hoest.mjs --aflever`) blev afvist af auto-tilladelsen og er ikke kørt.

## Hvad er næste

Yantra retter i denne rækkefølge: (1) low bar til 4-5 cm under high bar, (2) squat-animationen på 390: større figur og vinduerne i siden, (3) mærkernes streger i dødløft og "skulder"-mærket i bænk på 390. Marc afgør, om 4-5 cm er nok. Betydning for Hara: ingen.

## Ærlige grænser

- Jeg er ikke coach: dommene er en coachs øjne så godt jeg kan aflæse dem; low bar-tallet og buens top er Marcs at afgøre.
- Headless Chrome, stille billeder på tilfældige tidspunkter (t0-t4 er ikke navngivne faser), ikke film og ikke en rigtig telefon. Bænk-animationen er kun set på et udvalg af billederne (tre buer og stor bue i lockout), ikke alle 24.
- Kun balancerede, syntetiske kroppe med standardindstilling.
- `LAES-MODELLER-3.html` er ikke åbnet; jeg tog mine egne billeder af `main`, som er det den beskriver. Yantras rapport 784 er læst, min egen seneste figur-kritik (798) er genbrugt som sammenligning.

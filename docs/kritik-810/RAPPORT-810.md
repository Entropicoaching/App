Marcs domme holdt: nej (kun een: low bar ligger stadig 6,4 cm under high bar, "et par cm" er ikke opfyldt; baenkens stablede led, squat-albuen bag og under stangen, doedloeftens skinneben og fodbredder holder). Ligner rigtige loeft: ja, naesten (stillingerne ligner; paa 390 er squat-animationens figur stadig lille og doedloeftens maerker og vindue ligger hen over figuren). De tre vigtigste ting Yantra retter naeste gang: (1) low bar er stadig 6,4 cm under high bar (`S810-1280-lowbar-bund.png` "5,3 cm under skulderen" mod `S810-1280-highbar-bund.png` "1,1 cm over skulderen"; `src/embed/squatAnimation.js` og tabellerne bag): saet low bar til 4-5 cm som standard nu, som en glidende skala; (2) squat-animationen paa 390 (`A810-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren fylder ca. en tredjedel af hoejden, haandcirklen og forfra-vinduet fylder hele toppen og et tomt baand staar midt i; goer figuren stoerre og lae vinduerne i siden, eller under figuren; (3) doedloeft paa 390 (`A810-390-dl-sumo-bred-t0.png` og `T810-390-doedloeft-opstilling.png`; `src/embed/deadliftAnimation.js`, `src/doedloeftFigurer.js`): forfra-vinduet dækker nakke og hoved ved bred sumo (82 cm), spoegelsens tekst "hofte 8,6 cm lavere" rammer skinnebenet, og streger fra "knae 0,8 cm" og "laend 24,7 cm" gaar tvaers gennem ryg og hoved; brug en fast soejle ved siden af figuren og et mindre vindue.

Testet paa main i loeftmodel-traeet (88b46a4, merge af ordre 793), som stille billeder i headless Chrome paa 390 (touch) og 1280, kun 127.0.0.1, syntetisk krop. Ingen kode er rettet.

## 1. Marcs domme, en for en

- Baenk: holder. Stangen staar over led, der er stablet (overarm og underarm i lige linje, underarm lodret ved lockout, `T810-1280-baenk-lockout.png`). Tre buer (lille 7,3, middel 9,0, stor 10,6 cm) er tydeligt forskellige, og toppen ligger taettere paa hals/skulder jo stoerre buen er (kontakt 21,1, 19,1, 16,8 cm fra skulderen, `A810-1280-baenk-tre-buer.png`). Det er et spektrum og ikke to punkter.
- Squat: holder paa albuen. Low bar: albue 17 cm bag og 19 cm under stang; high bar: 11 cm bag og 23 cm under stang. Aldrig ved hovedet. Forfra: stangen paa ryggen, albuer under (`A810-1280-squat-lowbar-t2.png`). Holder IKKE paa stangens sted: low bar er 5,3 cm under skulderen mod high bar 1,1 cm over, altsaa 6,4 cm, og Marc siger "et par cm". Det er det samme tal som i 798 og 804.
- Doedloeft: holder. Skinnebenet staar helt frem til stangen i opstilling (skinneben 14 grader, stang 3,0 cm foran, `T810-390-doedloeft-opstilling.png`), og fodbredden er en glidende skala fra 32 til 82 cm (konventionel, mellemting, sumo), med knae og haender set forfra.
- "Intet er binaert": holder for baenk og doedloeft (glidende buer og fodbredde). Squatten har stadig to knapper, "Low bar" og "High bar", selv om modellen kan give et spektrum.

## 2. Hvad ser stadig unaturligt ud for en erfaren coach

- Baenkens hoved er en rund klump uden nakke, der sidder direkte paa baenken (`A810-1280-baenk-lille-t0.png`). Squattens hals blev glat i 793; baenken beholdt den gamle af hensyn til vandret hals. En coach ser det som en dukke.
- Forfra i baenk ved lockout er skulderpartiet meget smalt i forhold til grebet: greb 64 cm, men kroppen er kun en lille skive, saa underarmene staar skraat ind som et V (`T810-1280-baenk-lockout.png`). Bredt greb ser ud som et hængende V, ikke som en stang over en brystkasse.
- Sumo: konventionel-spoegelset (793) viser hoften 8,6 cm lavere, men ryggen 7,8 grader MERE vandret, og en erfaren coach forventer en mere oprejst ryg i sumo. Yantra skrev selv, at det er Marcs dom; det staar stadig aabent (`A810-390-dl-sumo-bred-t0.png`).
- Squat-bunden fra siden er en kompakt klump: laar og hofte fylder mest, og stangens skive og hovedet ligger taet. Det er godt nok til en coach, men det er svaert at se laendens kurve.

## 3. Er mine seneste fund lukket (804)

- Low bar 6,4 cm: ikke lukket (samme tal, 5,3 mod 1,1).
- Squat-animationen paa 390 lille med tomt baand: ikke lukket (`A810-390-squat-lowbar-t2.png`, figuren fylder ca. en tredjedel af hoejden i bunden, oeverste del er to vinduer med et tomt baand under).
- Doedloeft- og baenkmaerker hen over figuren paa 390: ikke lukket for doedloeft (streger gennem ryg og hoved, `T810-390-doedloeft-opstilling.png`); baenk-maerket "skulder 20,1 cm" ligger stadig oven paa stangsporet (`T810-390-baenk-bryst.png`).
- Lukket siden 804: halsen i squatten (793) er nu en glat form (`A810-1280-squat-lowbar-t2.png`); sumo har et spoegelse, der viser forskellen (men med en tekst, der rammer skinnebenet paa 390).

## 4. Hvad jeg ikke kunne

- Set som stille billeder, ikke som film paa en rigtig telefon. Bevaegelsen (hastighed, hop mellem faser) er kun vurderet ud fra fem til seks billeder pr. forloeb.
- Jeg har ikke laest `LAES-MODELLER-3.html` billede for billede; jeg har laest dens tekst (aaben low bar-linje og Yantras egne forbehold), og brugt mine egne billeder af main. Siden er kun laest.
- Jeg kan ikke vurdere, om en rigtig sumo-ryg er mere oprejst; det er Marcs dom.

## 5. Hvad er naeste

Yantra retter de tre ting oeverst i denne rapport; i den raekkefoelge er (1) en tal-aendring i squatten, (2) og (3) er layout paa 390. Bagefter: baenkens hoved og hals og forfra-vinduets skulderbredde. Hara: ingen betydning for Hara; intet er koert mod eller skrevet til Hara, og ingen miljoevariabler er roert.

Filer: `outputs/kritik-810/` (117 billeder plus `maaling-810.json`), scripts `docs/kritik-810/server-810.mjs`, `tur-810.mjs`, `squat-stang-810.mjs`.


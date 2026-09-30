Marcs domme holdt: nej (kun een: low bar ligger stadig 6,4 cm under high bar, 5,3 cm under skulderen mod 1,1 cm over, "et par cm" er ikke opfyldt; baenkens stablede led og buer, squat-albuen bag og under stangen og doedloeftens skinneben og fodbredder holder). Ligner rigtige loeft: ja, naesten (stillingerne ligner; squat-animationen paa 390 er bedre men figuren er stadig lille, og sumo fra siden og maerkerne paa 390 er stadig det, en coach ser foerst). De tre vigtigste ting Yantra retter naeste gang: (1) low bar er stadig 6,4 cm under high bar (`S822-1280-lowbar-bund.png` "5,3 cm under skulderen" mod `S822-1280-highbar-bund.png` "1,1 cm over skulderen"; `src/embed/squatAnimation.js` og tabellerne bag): saet low bar til 4-5 cm som standard med genkalibrering, som 799 har forberedt i `outputs/799/lowbar-proevet/`, og lad stangens sted glide som en skala; (2) sumo fra siden (`A822-1280-dl-sumo-bred-t1.png` og `A822-390-dl-sumo-bred-t1.png`; `src/embed/deadliftAnimation.js`, `src/doedloeftFigurer.js`): spoegelsens tekst "hofte 7,3 cm lavere / ryg 9,4 grader mere vandret" staar paa 390 stadig oven paa skinnebenet, og sumo ser i bunden af traekket stadig ud som en konventionel med bredt stand; flyt teksten ind i den tomme venstre halvdel af laerredet og vis en oprejst ryg (Marcs dom afgoer retningen); (3) squat-animationen paa 390 (`A822-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): laupen ligger nu under forfra-vinduet (godt), men figuren fylder stadig kun nederst til venstre, mens hele hoejre halvdel under laupen er tomt; centrer figuren og goer den 1,5 gange stoerre ved at bruge hele bredden.

# Ordre 822, Bhishak, 30. sep. 2026

## Gren

`kritik-822` (fra `main`). Filer kun under `docs/kritik-822/` (denne rapport og mine tre scripts `tur-822.mjs`, `squat-stang-822.mjs`, `server-822.mjs`, kopieret fra 815 med nyt ordrenummer) og `outputs/kritik-822/` (117 filer: `T822-` stille figurer, `A822-` animationer, `S822-` squat bund/sticking/lockout, `maaling-822.json`). Set paa Yantras `main` (f78dca8, ordre 799 merget; nyeste rapport `RAPPORT-ordre-799.md`), hentet med `git archive` og serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280. 0 netkald sluppet ud, syntetiske kroppe. Ingen rettelser i loeftmodellen eller sitet. `Til Marc\LAES-MODELLER-3.html` er kun laest som kontekst (1,2 MB, dens billeder svarer til de samme figurer; jeg har maalt selv). Tid: under 30 minutter, saa jeg har set et udvalg af de 117 billeder taet (squat bund low/high, squat-animation 390, baenk tre buer, baenk bryst, lille og stor bue i lockout, doedloeft opstilling, sumo bred paa 390 og 1280), ikke alle.

## Hvad aendret

Intet i loeftmodellen, sitet eller appen. Kun nye filer: denne rapport, tre scripts og 117 filer i `outputs/kritik-822/`.

## Testresultat

Ingen tests koert og ingen kode aendret. Maalingerne: 117 billeder og `maaling-822.json` (0 netkald, 1 konsolfejl paa 390 (en 404 paa en ressource), som i 815).

## Holder figurerne Marcs domme?

- **Baenk: ja.** Ved brystet staar underarmen lodret og leddene stablet under stangen (`T822-390-baenk-bryst.png`). Tre buer i samme skala: kontakt 21,1 / 19,1 / 16,8 cm fra skulderen og laend 7,3 / 9,0 / 10,6 cm (`A822-1280-baenk-tre-buer.png`). I lockout staar stangen over skulderleddet med lodret underarm for begge buer (`A822-1280-baenk-lille-t3.png`, `A822-1280-baenk-stor-t2.png`); stangens top ligger lidt taettere paa hovedet ved stor bue (ca. 25 px paa 1280), men forskellen er lille, og det er hovedet og laenden, der viser buen, ikke stangen. I stor bues nedre fase (`A822-1280-baenk-stor-t3.png`) er armen skraa og overlapper skulderkassen; det ligner en overgang mellem faser, ikke en fejl i toppen. Bemaerkning "skulder 20,1 cm" staar nu fri af stangsporet.
- **Squat: albuen ja, stangens sted nej.** Albuen under og bag stangen: low bar 17 cm bag og 19 cm under, high bar 11 cm bag og 23 cm under, forfra 19 cm under (`S822-1280-lowbar-bund.png`, `S822-1280-highbar-bund.png`, `A822-390-squat-lowbar-t2.png`), aldrig ved hovedet. Men low bar staar 5,3 cm under skulderen og high bar 1,1 cm over: 6,4 cm imellem. Uaendret siden min 804; Yantra proevede 4,5-5,2 cm i 799 og rullede tilbage, fordi 20+ laaste tal og fejlgenkenderen skal genkalibreres. Det er stadig det eneste, der bryder en af Marcs domme.
- **Doedloeft: ja.** Skinnebenet staar helt frem til stangen i opstillingen (stang 3,0 cm foran, `T822-390-doedloeft-opstilling.png`). Fodbredden er en skala: konventionel 32 cm, mellemting 49 cm og sumo 65,6 og 82 cm, med tydeligt forskellig hofte og knaestilling (`A822-*-dl-*`).
- **"Intet er binaert":** baenk og doedloeft ja (glidende buer og glidende standbredde). Squat er kun halvt: low/high er to knapper med 6,4 cm imellem, ikke en skala.

## Ligner de rigtige loeft?

Ja, naesten. Stillingerne ser rigtige ud for en coach: baenkens stablede led og buer, squatens dybde og tilbagelaenede low bar-torso mod mere oprejst high bar, doedloeftens ryg og knae i opstillingen. Det der stadig er unaturligt eller forstyrrer:

- Squat paa 390: lupen staar nu under forfra-vinduet, og albuen kan ses (`A822-390-squat-lowbar-t2.png`), men sidefiguren fylder kun nederst til venstre; hele hoejre halvdel under lupen er tom. En coach ser stadig en lille figur.
- Sumo: spoegelset (konventionel som stiplet linje) er godt, og maerkerne paa doedloeftens opstilling ligger nu til hoejre for stangen med vandrette streger, uden at gaa gennem ryg og hoved (`T822-390-doedloeft-opstilling.png`; det var mit fund 3 i 815). Men sumo-spoegelsets tekst ligger paa 390 stadig oven paa skinnebenet (`A822-390-dl-sumo-bred-t1.png`), og fra siden ligner sumo i bunden af traekket stadig en konventionel med en bred fodstilling (`A822-1280-dl-sumo-bred-t1.png`): hofte 8,0 cm lavere, ryg 11,3 grader mere vandret. Yantra har selv skrevet i 793, at en rigtig sumo-loefter staar mere oprejst; modellen siger det modsatte. Det er Marcs dom, ikke min.
- Doedloeft opstilling paa 390: streg fra "hofte 41,0 cm" ligger hen over armen og stangens lodlinje (`T822-390-doedloeft-opstilling.png`), men det er en maalestreg, ikke en fejl paa kroppen.
- Baenk: hovedet er en lille klump ved baenkens ende, og hals og skulderparti haenger sammen som en kasse (`T822-390-baenk-bryst.png`). Det ses kun, naar man kigger efter.

## Er mine seneste fund lukket?

Mine tre fund fra 815 sammenholdt med `main` nu:

1. Low bar 6,4 cm under high bar: **aaben** (samme tal; Yantra har proevet og rullet tilbage i 799, det staar i deres rapport som "aabent").
2. Squat-animation paa 390 med lille figur og fyldt top: **delvist lukket**. Lupen er flyttet under forfra-vinduet, figuren har faaet hele hoejden ved siden af, og albuen ses; men figuren er stadig lille, og der er stort tomt felt til hoejre (799 maalte 1,22-1,29 gange stoerre paa 390).
3. Maerker hen over figuren paa 390: **lukket for doedloeft og baenk** (doedloeftens streger og baenkens "skulder" ligger nu uden for kroppen og sporet; 799 maalte 0 af 54 og 0 af 202); **aaben** for sumo-spoegelsets tekst paa skinnebenet.

## Hvad er naeste

1. Low bar 4-5 cm som standard med genkalibrering af fejlgenkenderen (Yantra har forsoegets testliste klar), saa stangens sted er et spektrum.
2. Sumo: flyt spoegelsens tekst vaek fra skinnebenet paa 390, og find ud af (Marc) om sumoryggen skal vaere mere oprejst end konventionel.
3. Squat-animationen paa 390: brug hele bredden, saa figuren bliver stoerre.

Har arbejdet betydning for Hara: nej, ingen kode, ingen data, ingen aendring i Hara-miljoeet.

## Aerlige graenser

- Set i headless Chrome som stille billeder, ikke som film paa en telefon, og kun et udvalg af de 117 billeder er set taet.
- Kroppene er syntetiske; jeg har ikke set en rigtig atlet eller et klip.
- Mit skoen af 25 px (baenkens stang mod hoved) er aflaest af billeder, ikke maalt af modellen.
- Jeg har ikke selv proevet at aendre low bar; tallene 5,3 og 1,1 er Yantras egne, aflaest af billedernes tekst.

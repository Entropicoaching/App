Marcs domme holdt: nej (kun een: low bar ligger stadig 6,4 cm under high bar, 5,3 cm under skulderen mod 1,1 cm over, "et par cm" er ikke opfyldt; baenkens stablede led og buer, squat-albuen bag og under stangen og doedloeftens skinneben og fodbredder holder). Ligner rigtige loeft: ja, naesten (stillingerne ligner; men sumo har stadig en vandret ryg, hvor en coach venter en oprejst, og squat-figuren paa 390 er lille). De tre vigtigste ting Yantra retter naeste gang: (1) low bar 6,4 cm under high bar (`S826-1280-lowbar-bund.png` "5,3 cm under skulderen" mod `S826-1280-highbar-bund.png` "1,1 cm over skulderen"; `src/embed/squatAnimation.js` og tabellerne bag): saet low bar til 4-5 cm som standard med genkalibrering af fejlgenkenderen (forsoeget ligger i `outputs/799/lowbar-proevet/`), og lad stangens sted glide som en skala; (2) sumo-ryggen og spoegelsens tekst (`A826-1280-dl-sumo-bred-t1.png` "ryg 11,3 grader mere vandret", `A826-390-dl-sumo-bred-t1.png`; `src/embed/deadliftAnimation.js`, `src/doedloeftFigurer.js`): sumo skal have lavere hofte OG mere oprejst ryg end konventionel, ikke fladere; teksten "mod konv. (stiplet)" paa 390 staar stadig oven paa skinnebenet, saa flyt den ind i den tomme venstre halvdel; (3) squat-animationen paa 390 (`A826-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren fylder stadig kun nederst til venstre, hoejre halvdel under lupen er tom; centrer figuren og goer den 1,5 gange stoerre.

# Ordre 826, Bhishak, 30. sep. 2026

## Gren

`kritik-826` (fra `main`). Filer kun under `docs/kritik-826/` (denne rapport og tre scripts `tur-826.mjs`, `squat-stang-826.mjs`, `server-826.mjs`, kopieret fra 822 med nyt ordrenummer) og `outputs/kritik-826/` (116 billeder `T826-` stille figurer, `A826-` animationer, `S826-` squat bund/sticking/lockout, samt `maaling-826.json`). Set paa Yantras `main` (f78dca8, ordre 799 merget; nyeste rapport `RAPPORT-ordre-799.md`), hentet med `git archive`, serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280. 0 netkald sluppet ud, kun syntetiske kroppe. `Til Marc\LAES-MODELLER-3.html` er ikke aabnet paa ny; dens figurer er de samme som dem jeg har maalt selv.

## Hvad aendret

Intet i loeftmodellen eller sitet. Yantras `main` er ikke aendret siden min forrige kritik (822): samme commit, saa mine fund fra 822 staar stadig. Jeg har taget alle billederne om og set et udvalg taet: squat bund low/high (1280), squat-animation 390, baenk tre buer og stor bue i lockout (1280 og 390), doedloeft konventionel og sumo bred (1280 og 390), doedloeft opstilling (390).

## Testresultat

Ingen kodetest koert (jeg aendrer intet). Maaling: 0 sideudefra-kald; paa 390 een konsolfejl, en 404 paa en ressource (sandsynligvis ikonet, ingen figur mangler); paa 1280 ingen. Alle tre loeft, alle stillinger og alle animationer aabnede uden fejl.

## Dom: Marcs domme, rigtige loeft og tidligere fund

- Baenk: holder. Stangen staar over leddene med underarmen lodret i lockout (`A826-1280-baenk-stor-t2.png`); toppen rykker taettere paa skulderen jo stoerre bue (21,1 / 19,1 / 16,8 cm i `A826-1280-baenk-tre-buer.png`), tre forskellige buer, ikke een. Paa 390 (`A826-390-baenk-stor-t2.png`) staar "skulder"-maerket nu frit og ikke paa stangen.
- Squat: albuen er bag og under stangen i begge (17 cm bag / 19 cm under low bar, 11 / 23 high bar), aldrig ved hovedet. Low bar-stedet er stadig for langt nede (se punkt 1 ovenfor); den glidende skala mangler, der er to faste steder.
- Doedloeft: skinnebenet staar mod stangen i opstilling (`T826-390-doedloeft-opstilling.png`), konventionel, mellemting og sumo (slider 32-82 cm) findes som et spektrum. Men sumo bred har en ryg 11,3 grader mere vandret og hofte 8 cm lavere end konventionel. Hoften er rigtig; ryggen er omvendt af hvad en coach forventer.
- Ligner rigtige loeft: ja, naesten. Det en erfaren coach ser foerst er sumo-ryggen, teksten oven paa skinnebenet paa 390 og squat-figurens lille fylde paa 390.
- Mine seneste fund (822): (1) low bar, aaben; (2) sumo fra siden, aaben, i dag ogsaa ryggens retning; (3) squat-animation 390, aaben. Bænkens og maerkernes streger er lukket siden 799.

## Hvad er naeste

Yantra tager de tre punkter i foerste linje i den raekkefoelge; det er de samme som i 822, og 1 kraever en genkalibrering og er en ordre for sig. Bænkens hoved og hals og 360 px er ikke set denne gang. Haerlige graenser: headless Chrome, stille billeder og fem tidspunkter pr. animation, ikke film paa en telefon; jeg har set et udvalg af de 116 billeder, ikke alle; 11,3 graders ryg og 8 cm hofte staar i figurens egen tekst, ikke maalt af mig paa en atlet. Hvis sumo-ryggens retning afgoeres af Marc, er det hans dom, ikke min. Arbejdet har ingen betydning for Hara.

## Ærlige grænser

Headless Chrome, stille billeder og fem tidspunkter pr. animation, ikke film på en telefon. Jeg har set et udvalg af de 116 billeder tæt, ikke alle; bænkens hoved og hals og 360 px er ikke set. Tallene (11,3 graders ryg, 8 cm hofte) står i figurens egen tekst, ikke målt af mig på en atlet. Sumo-ryggens retning afgøres af Marc.

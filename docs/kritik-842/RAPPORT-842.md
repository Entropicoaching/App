Marcs domme holdt: ja (alle; low bar 3,7 cm under skulderen mod high bar 1,1 cm over = 4,8 cm; baenkens underarm lodret ved brystet; albuen 17/11 cm bag og 19/23 cm under stangen; skinnebenet frem til stangen; fodbredden 32/49/65,6/82 cm). Ligner rigtige loeft: ja, naesten (stillingerne holder; det der staar tilbage er layout paa 390, ikke kroppen). De tre vigtigste ting Yantra retter naeste gang: (1) doedloeftens forfra-vindue daekker stadig figurens ryg og skulder paa 390 (`A842-390-dl-konventionel-t0.png`, `A842-390-dl-sumo-bred-t1.png`; `src/embed/deadliftAnimation.js`): vinduets bund og teksten "stand 32 cm . 10 grader ud" ligger hen over ryggen, saa flyt vinduet ud i hjoernet over stangen eller goer det smallere, saa figuren aldrig er bag det; (2) doedloeftens opstilling paa 390 (`T842-390-doedloeft-opstilling.png`; `src/doedloeftFigurer.js`): stregerne "laend 24,7 cm", "hofte 41,0 cm" og "knae 0,8 cm" gaar stadig tvaers gennem laar, ryg og skinneben (fjerde kritik i traek); brug en fast soejle af tal til hoejre for figuren eller korte streger, der kun ligger uden for kroppen; (3) squat-animationen paa 390 (`A842-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren er stoerre end i 836, men fylder stadig kun den nederste venstre tredjedel, mens forfra-vindue og haandlup ligger i topog hoejre side med tom plads imellem; goer figuren endnu stoerre og saet lup og vindue i samme raekke, saa en coach ser dybden.

## Gren

`kritik-842` (fra `main`). Filer kun under `docs/kritik-842/` (denne rapport og scripts `server-842.mjs`, `tur-842.mjs`, `squat-stang-842.mjs`, kopieret fra 836 med nyt ordrenummer) og `outputs/kritik-842/` (105 filer: `T842-` stille figurer, `A842-` animationer, `S842-` squat bund/sticking/lockout, `maaling-842.json`). Set paa Yantras `main` (c2240c1, ordre 819 merget; nyeste rapport `RAPPORT-ordre-819.md`), hentet med `git archive` og serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280. 0 netkald sluppet ud, syntetiske kroppe. `Til Marc\LAES-MODELLER-3.html` blev kun brugt som kontekst (ikke aabnet i browser); jeg har malt selv. Jeg har set et udvalg taet (squat bund low/high, squat-animation 390 og 1280, baenk tre buer og bryst 390, doedloeft opstilling og konventionel/sumo i start), ikke alle 105.

## Hvad aendret

Intet i loeftmodellen, sitet eller appen. Kun nye filer: rapport, tre scripts og billeder. Sub-agenter er ikke brugt.

## Testresultat

Ingen tests koert og ingen kode aendret. Malinger: 105 billeder og `maaling-842.json` (0 netkald; paa 390 een konsolfejl, en 404 paa en ressource, samme som i 836; 0 paa 1280; jeg fandt ikke hvilken ressource).

## Holder figurerne Marcs domme?

- **Baenk: ja.** Ved brystet staar underarmen lodret med stablede led under stangen (`T842-390-baenk-bryst.png`). Tre buer i samme skala: kontakt 21,1 / 19,1 / 16,8 cm fra skulderen, laend 7,3 / 9,0 / 10,6 cm (`A842-1280-baenk-tre-buer.png`): toppen taettere paa halsen jo mere bue, ikke alle lige meget. Stor bue: laenden tydeligt haevet (`A842-390-baenk-stor-t2.png`).
- **Squat: ja.** Albuen under og bag stangen, aldrig ved hovedet: low bar 17 cm bag og 19 cm under, high bar 11 cm bag og 23 cm under, forfra 19-26 cm under (`S842-1280-lowbar-bund.png`, `S842-1280-highbar-bund.png`, `A842-1280-squat-highbar-t2.png`). Low bar 4,8 cm under high bar: "et par cm" holder. Stangens sted er stadig tre knapper (low, high, front), ikke en glidende skala.
- **Doedloeft: ja.** Skinnebenet frem til stangen i opstillingen (stang 3,0 cm foran, `T842-390-doedloeft-opstilling.png`). Fodbredden er en skala: konventionel 32 cm, mellemting 49 cm, sumo 65,6 og 82 cm med tydeligt forskellig hofte og knae (`A842-*-dl-*`).
- **"Intet er binaert":** baenk og doedloeft ja; squat naesten (tre stangsteder i stedet for glidende).

## Ligner de rigtige loeft?

Ja, naesten. Kroppene holder for en coach: low bar-torso 54 grader mod high bar 36, baenkens stablede led, doedloeftens ryg og knae. Det der stadig ser unaturligt eller forstyrrende ud:

- Doedloeft paa 390: forfra-vinduet ligger oven paa ryg og skulder i konventionel start (`A842-390-dl-konventionel-t0.png`) og lidt paa ryggen i sumo bred (`A842-390-dl-sumo-bred-t1.png`); hovedet er frit nu, og spoegelsens tekst staar frit nederst til venstre (aendret i 819, ser ud til at virke).
- Doedloeft opstilling paa 390: maalestregerne gaar gennem kroppen.
- Squat-animation paa 390: figuren er stoerre, men lille i et hjoerne (`A842-390-squat-lowbar-t2.png`); paa 1280 er den fin (`A842-1280-squat-highbar-t2.png`).
- Baenk: hovedet er stadig lille og ligger som en klump ved skulderen, halsen er glat (`T842-390-baenk-bryst.png`). Lille, men et coach-blik ser det.
- Sumo fra siden er stadig en ret vandret ryg i starten (8,6 grader mere vandret end konventionel); om en rigtig sumoloefter staar mere oprejst, er Marcs dom, ikke min.

## Er mine seneste fund lukket?

Mine tre fund fra 836 mod `main` nu:

1. Squat-animation paa 390 med lille figur i hjoernet: **delvist lukket** (ordre 819: 3-16 % stoerre), men stadig kun ca. en tredjedel af bredden nede til venstre.
2. Doedloeftens streger paa 390: **aabent** (`T842-390-doedloeft-opstilling.png`).
3. Sumo-animationen paa 390, vindue og tekst: **teksten lukket** (staar nu frit nederst til venstre, en linje for hele loeftet), **vinduet aabent** (dækker ryggen i konventionel og lidt i sumo).

Har arbejdet betydning for Hara: nej, ingen Hara-filer eller noegler rort.

## Aerlige graenser

- Kun stille billeder fra headless Chrome, ikke film paa en telefon; mellem de fem tidspunkter pr. animation har jeg ikke set figuren.
- Jeg aabnede ikke `LAES-MODELLER-3.html`; tallene er mine egne malinger paa `main` c2240c1.
- Udvalg, ikke alle 105 billeder set taet; sumo smal og mellemting er kun set ud fra navne og tal, ikke taet.
- Vindue-overlappet er vurderet paa oejemaal i 390-billederne; jeg har ikke maalt pixels.
- Modellen kender ingen enkelte muskler, og alt her er tegning og segmentlaengder, ikke en maaling paa en atlet.

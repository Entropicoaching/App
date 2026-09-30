Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja, med et forbehold for sumo (hoften). De tre vigtigste ting Yantra retter naeste gang: (1) sumo paa 1280 og 390, start: hoften staar langt bag fødderne og stangen, og overkroppen er kraftigt foroverbøjet (ryg ca. 50 grader fra lodret), som en konventionel med bred stand; i rigtig sumo er hoften taettere paa stangen og ryggen mere lodret (`outputs/kritik-918/A918-1280-dl-sumo-bred-t0.png` og `A918-390-dl-sumo-smal-t2.png`; `src/embed/deadliftAnimation.js`, sumo-opstillingen: skub hoften frem mod stangen med bredere stand, eller sig i panelet hvorfor den ikke gaar; Yantra har selv parkeret det som modelvalg til Marc i 893, saa spoerg ham nu); (2) squat: figuren fylder stadig kun ca. en tredjedel af bredden paa 390 og staar smal midt i et bredt billede paa 1280, mens haandcirklen og frontvinduet fylder hjoernerne (`A918-390-squat-lowbar-t4.png`, `A918-1280-squat-highbar-t4.png`; `src/embed/squatAnimation.js` og panelets layout; kraever Marcs ja til at skjule haandcirklen paa smal skaerm, spoerg ham; aabent siden 887); (3) baenk, stor bue: laaret er naesten vandret og foden staar langt bag knaeet, saa benet bliver en lang skraa linje; en coach siger "fod under knae" (`A918-1280-baenk-stor-t3.png`, `A918-390-baenk-stor-t1.png`; `src/embed/bench-animation.js`, benets/fodens sted ved stor bue: laes foden ind under knaeet, uden at flytte kontaktpunktet paa braestet).

## 1. Dom

Marcs domme holder paa alle tre loeft, paa 390 og 1280. Det der staar tilbage er sumo-hoftens sted, figurens stoerrelse i squat og baenkens benlinje; ingen af dem bryder en dom. Mine seneste fund (912): doedloeft-teksten paa 390 er lukket (nu to linjer under gulvet, rammer ikke hovedet i nogen sumo-stand); hovedet er delvist lukket (skygge, lys, bryn, oeje, hals; stadig lille og enkelt paa 390); squat-stoerrelsen er aaben. Yantras nyeste rapport er ordre 893 (main 020f126). Jeg har ikke rettet noget og ikke roert modellen.

## 2. Hvad jeg goerte

Hentede loeftmodellens main med `git archive` (zip) til scratchpad og koerte den paa en lokal server, kun 127.0.0.1, alle eksterne kald blokeret: 0 netkald; en 404 paa 390 fra en lille fil jeg ikke har fulgt (samme som i 912). Genbrugte mit 912-script (`docs/kritik-918/tur-918.mjs`, `server-918.mjs`), headless Chrome, syntetiske kroppe. 105 filer i `outputs/kritik-918/`: panelets stille figurer for alle tre loeft, squat (low bar, high bar, 5 tidspunkter), baenk (tre buer, 4 tidspunkter, buekortet) og doedloeft (konventionel, semi, sumo smal og bred, 5 tidspunkter), plus `maaling-918.json`. Jeg har set en stikproevne af billederne (ni), ikke alle 105. `LAES-MODELLER-3.html` er kun laest (den er stor; jeg har kun kontrolleret at den findes og hoerer til 893).

## 3. Marcs domme, en for en

- Baenk: holder. Stangen rammer buens top med underarmen naesten lodret over albuen (lidt skraa midt i loeftet paa 390, `A918-390-baenk-stor-t1.png`); kontaktpunktet ligger taettere paa halsen jo stoerre bue: 21,1 / 19,1 / 16,8 cm fra skulderen for lille / middel / stor, laend 7,3 / 9,0 / 10,6 cm (`A918-390-baenk-tre-buer.png`). Tre forskellige buer: ikke alle archer lige meget.
- Squat: holder. Albuen er 3 cm bag og 22-26 cm under stangen, aldrig ved hovedet (`A918-390-squat-lowbar-t4.png`, `A918-1280-squat-highbar-t4.png`). Low bar og high bar ligger tæt; stangens sted er et spektrum.
- Doedloeft: holder. Skinnebenet er frem til stangen i start i konventionel og sumo (`A918-390-dl-konventionel-t0.png`, `A918-1280-dl-sumo-bred-t0.png`); stand 32 til 82 cm med 10 til 40 grader ud er et spektrum.
- "Intet er binaert": ja, glidende valg i alle tre (bue, stang, stand).

## 4. Hvad der stadig ser unaturligt ud for en erfaren coach

- Sumo, hoften: se punkt 1 ovenfor. Det er det eneste sted, hvor en coach vil sige "det er ikke sumo".
- Squat: figuren er lille i sit felt (punkt 2); haandcirklen "haand 3x" og frontvinduet fylder mere end det, man skal kigge paa.
- Baenk, stor bue: benlinjen (punkt 3). Hovedet ligger fint og har nu form.
- Hovedet generelt: har nu skygge, bryn og oeje og en hals, og er ikke laengere en klods; men paa 390 er det ca. 25 px, og ansigtet er stadig ens paa alle figurer.
- Doedloeft, frontvinduet paa 390: figuren er ca. 35 px hoej; man kan ikke laese hofte og knae i den, kun teksten over.
- Konventionel doedloeft, start (`A918-390-dl-konventionel-t0.png`): mit snapshot ligner en stilling med strakte ben; det kan vaere tidspunktet i animationen og ikke en fejl, jeg har ikke tjekket start-stillingen i panelet (`T918-390-doedloeft-opstilling.png`) for skinne-til-stang paa hele stillingen.

## 5. Graenser og Hara

- Mit oeje paa stille billeder fra headless Chrome, ikke maalt af en loefter; kun de tal modellen selv skriver paa billederne er citeret. Ryggen "ca. 50 grader" er skoenet fra billedet, ikke maalt.
- Kun en syntetisk gennemsnitskrop; lange laarben og lang torso i panelet har jeg ikke gennemgaaet enkeltvis (under 30 minutter). Set: ni af 105 billeder.
- Hara: intet i dette arbejde beroerer Hara; ingen miljoevariabler er roert.
- Ingen push, ingen merges, ingen sub-agenter, ingen aendring af loeftmodellen eller appens kode.

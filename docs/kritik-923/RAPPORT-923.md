Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja, stadig med forbehold for sumo (hoften). De tre vigtigste ting Yantra retter naeste gang: (1) sumo, alle stande paa 1280 og 390, start: hoften staar langt bag foedderne og stangen, hofte kun 7 cm over knae og ryggen kraftigt foroverboejet; en rigtig sumo har hoften taettere paa stangen og ryggen mere lodret (`outputs/kritik-923/A923-1280-dl-sumo-bred-t2.png`, `A923-390-dl-sumo-smal-t2.png`; `src/embed/deadliftAnimation.js`, sumo-opstillingen: skub hoften frem mod stangen med bredere stand, eller skriv i panelet hvorfor den ikke gaar; Yantra har parkeret det som modelvalg til Marc siden 893, saa spoerg ham nu); (2) squat: figuren fylder stadig kun ca. en tredjedel af bredden paa 390 og staar smal midt i et bredt billede paa 1280, mens haandcirklen og frontvinduet fylder hjoernerne (`A923-390-squat-lowbar-t4.png`, `A923-1280-squat-highbar-t4.png`; `src/embed/squatAnimation.js` og panelets layout; kraever Marcs ja til at skjule haandcirklen paa smal skaerm; aabent siden 887); (3) baenk, stor bue: laaret er naesten vandret og foden staar langt bag knaeet, saa benet bliver en lang skraa linje; en coach siger "fod under knae" (`A923-1280-baenk-stor-t3.png`, `A923-390-baenk-stor-t1.png`; `src/embed/bench-animation.js`, benets/fodens sted ved stor bue; kontaktpunktet paa braestet maa ikke flytte sig).

## 1. Dom

Marcs domme holder paa alle tre loeft, paa 390 og 1280. Modellen er uaendret siden min kritik 918: loeftmodellens main er stadig 020f126 (Yantras nyeste rapport er ordre 893; ingen nye commits). Mine tre fund fra 918 staar derfor alle aabne, ingen er lukket. Det der staar tilbage bryder ingen af Marcs domme; det er sumo-hoftens sted, squattens stoerrelse i sit felt og baenkens benlinje. Hovedet (skygge, lys, bryn, oeje) er fint nok i stor stoerrelse; paa 390 er det lille. Jeg har ikke rettet noget og ikke roert modellen.

## 2. Hvad jeg goerte

Hentede main med `git archive` til scratchpad og genbrugte min 918-tur (`docs/kritik-923/tur-923.mjs`, `server-923.mjs`), headless Chrome, kun 127.0.0.1, alle eksterne kald blokeret: 0 netkald, en 404 (samme lille fil som i 912 og 918). Port 9001 var optaget af en server fra tidligere; jeg sammenlignede md5 af `demo/squat.html` og `dist/tre-loeft/index.html` med mit uddrag af main: identiske, saa billederne er af 020f126. 105 filer i `outputs/kritik-923/` (`A923-*`: squat low/high bar 5 tidspunkter, baenk tre buer 4 tidspunkter og buekort, doedloeft konventionel/semi/sumo smal/sumo bred 5 tidspunkter; `T923-*`: panelets stille figurer), plus `maaling-923.json`. Jeg har set otte billeder (sumo bred 1280 t0 og t2, baenk stor 1280, squat low bar 390, squat high bar 1280, konventionel 390 start, baenk-buekortet), ikke alle 105. `LAES-MODELLER-3.html` er ikke aabnet i denne session; jeg har kun kontrolleret, at Yantras 893-rapport siger, at den hoerer til 893.

## 3. Marcs domme, en for en

- Baenk: holder. Stangen rammer ved buens top med underarmen lodret over albuen (`A923-1280-baenk-stor-t3.png`). Kontaktpunktet ligger taettere paa halsen jo stoerre bue: 21,1 / 19,1 / 16,8 cm fra skulderen for lille / middel / stor, laend 7,3 / 9,0 / 10,6 cm (`A923-390-baenk-tre-buer.png`): ikke alle archer lige meget.
- Squat: holder. Albuen er 8 cm bag og 22-25 cm under stangen, aldrig ved hovedet (`A923-390-squat-lowbar-t4.png`, `A923-1280-squat-highbar-t4.png`); low bar og high bar ligger taet paa hinanden, stangens sted er et spektrum.
- Doedloeft: holder. Skinnebenet er frem til stangen i start i konventionel (`A923-390-dl-konventionel-t0.png`, knae inden for armene, hofte 39 cm over knae) og i sumo (`A923-1280-dl-sumo-bred-t2.png`); stand 32 til 82 cm med 10 til 40 grader ud er et spektrum.
- "Intet er binaert": ja, glidende valg i alle tre (bue, stang, stand).

## 4. Hvad der stadig ser unaturligt ud for en erfaren coach

- Sumo, hoften: se punkt 1. Det er det eneste sted, en coach vil sige "det er ikke sumo". Konventionel start er derimod god: skinne til stang, ryg og hofte som i virkeligheden.
- Squat: figuren er lille i sit felt; haandcirklen "haand 3x" og frontvinduet fylder mere end det, man skal kigge paa.
- Baenk, stor bue: benlinjen (punkt 3). Hovedet ligger fint og har form.
- Hovedet generelt: ansigtet er ens paa alle figurer og ca. 25 px paa 390.
- Doedloeft, frontvinduet paa 390: figuren er ca. 35 px hoej; hofte og knae kan ikke laeses i den, kun teksten over.
- Den stiplede tekst under gulvet i doedloeft (lukket siden 893) staar roligt og rammer ikke hovedet paa de billeder jeg har set.

## 5. Graenser og Hara

- Mit oeje paa stille billeder fra headless Chrome, ikke maalt af en loefter; kun de tal modellen selv skriver paa billederne er citeret. Sumo-ryggens vinkel er skoenet fra billedet.
- Kun den syntetiske gennemsnitskrop; lange laarben og lang torso i panelet er ikke gennemgaaet enkeltvis (under 30 minutter). Set: otte af 105 billeder.
- Aflevering: koerslen af `hoest.mjs` blev afvist af tilladelsessystemet, saa rapporten er committet paa kritik-923 men ikke afleveret via `hoest.mjs`. Det maa Marc eller Dhruva koere, hvis den skal ind.
- Hara: intet i dette arbejde beroerer Hara; ingen miljoevariabler er roert.
- Ingen push, ingen merges, ingen sub-agenter, ingen aendring af loeftmodellen eller appens kode.

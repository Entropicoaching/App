Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft sumo smal: hoften staar 12 cm over knaeet og langt bag stangen, laaret er naesten vandret, saa opstillingen ligner en dyb squat med lige arme; en coach vil vaere skeptisk (`outputs/kritik-928/A928-1280-dl-sumo-smal-t0.png`; hoftereglen i `src/embed/deadliftAnimation.js`; Yantra kalder det et modelvalg, saa foreslaa Marc en regel med hoften hoejere/tættere paa stangen og lad ham vaelge); (2) baenk, frontvinduet: kun to spredte arme og en graa klump, intet hoved, ingen skulderlinje, ikke til at laese; og squat-figuren fylder kun ca. en tredjedel af bredden paa 1280 (`outputs/kritik-928/A928-1280-baenk-stor-t3.png`, `A928-1280-squat-highbar-t2.png`; `src/embed/bench-animation.js` frontvinduet og `src/embed/squatAnimation.js` layoutet; skjul haandcirkel kraever Marcs ja); (3) baenk, stor bue: laaret naesten vandret og foden langt ude, en lang benlinje, "fod under knae" (`outputs/kritik-928/A928-390-baenk-stor-t3.png`; benet i `src/embed/bench-animation.js`).

# Rapport: Ordre 928, loeftfigurerne som de staar nu (Bhishak)

## 1. Dom

Marcs domme holder paa alle tre loeft, paa 390 og 1280. Figurerne ligner rigtige loeft; hovedet er nu et ansigt, teksten i doedloeft rammer intet, og squat er større paa 390. Det, der staar tilbage, er sumo-hoftens placering, frontvinduerne og squat-figurens størrelse paa 1280. Yantras nyeste rapport paa main er ordre 910 (main 068c8d8). LAES-MODELLER-3 naevner ordre 917 (baenk, foden længere frem); den ligger paa en gren `ordre-917`, ikke paa main, saa mine billeder viser main og ikke 917. Jeg har ikke rettet noget og ikke roert modellen.

## 2. Hvad jeg goerte

Hentede `dist` og `demo` fra main med `git archive`, koerte dem paa en lokal server (127.0.0.1:9928, port 9001 var optaget af en anden proces, saa jeg brugte min egen), headless Chrome, 390 og 1280, syntetisk krop, alle eksterne kald blokeret. Scripts: `docs/kritik-928/tur-928.mjs` (samt `tur-928b.mjs`, der tog de sidste 1280-billeder, fordi foerste koersel blev afbrudt af tidsgraensen) og `server-928.mjs`. Ca. 100 billeder i `outputs/kritik-928/`. Jeg har set ca. 12 af dem enkeltvis (squat low/high bar, baenk lille/stor, doedloeft konventionel og sumo smal, begge bredder); resten er taget, men ikke gennemgaaet et for et. Laeste LAES-MODELLER-3.html (kun laest) og mit eget 912.

## 3. Marcs domme, en for en

- Baenk: holder. Stangen staar paa buens top med lodret underarm; kontaktpunktet ligger tættere paa halsen jo større bue: 21,1 cm (lille) og 16,8 cm (stor) fra skulderen, lænd 7,3 og 10,6 cm (`A928-390-baenk-lille-t3.png`, `A928-1280-baenk-stor-t3.png`, `A928-390-baenk-tre-buer.png`). Ikke alle archer lige meget: ja.
- Squat: holder. Albuen er under og bag stangen: high bar 10 cm bag / 24 cm under, low bar 3-17 cm bag / 19-22 cm under, aldrig ved hovedet (`A928-1280-squat-highbar-t2.png`, `A928-390-squat-lowbar-t4.png`, `T928-390-squat-bund.png`). Low bar sidder bag skulderen, faa cm fra high bar ("3,7 cm under skulderen"). Spektrum: ja.
- Doedloeft: holder. Skinnebenet er frem til stangen i start i konventionel og sumo (`A928-390-dl-konventionel-t0.png`, `A928-390-dl-sumo-smal-t2.png`, `A928-1280-dl-sumo-smal-t0.png`); stand 32 og 66 cm er set (samt semi og bred i filerne). Spektrum: ja.
- "Intet er binaert": ja, bue, stang og stand er glidende valg.

## 4. Hvad der stadig ser unaturligt ud, og mine seneste fund

- Sumo smal: hoften 12 cm over knaeet (1280, start) og langt bag stangen; ryggen naesten vandret over et vandret laar. En erfaren coach ser en "squat-start"; en sumoloefter staar oftere med hoften taettere paa og hoejere over stangen. Knaeet er tegnet oven paa den haengende arm (uaendret siden 912).
- Baenk, frontvinduet: to skraa arme og en graa flade, uden hoved og skuldre. Det siger ikke coachen noget, og det er det samme vindue paa 390 og 1280. Stor bue: laaret naesten vandret, foden langt ude (fra 912, uaendret paa main).
- Squat: figuren fylder ca. halvdelen af hoejden paa 1280 men kun en smal midte af bredden; haandcirkel og frontvindue fylder hjoernerne. Paa 390 er den bedre end i 912.
- Frontvinduet i doedloeft paa 390 er stadig en figur paa ca. 35 px; hofte og knae kan ikke laeses i det.

Mine seneste fund (912): (1) doedloeft-tekst paa 390: LUKKET, den staar nu i gulvet nederst i sumo smal og rammer intet (`A928-390-dl-sumo-smal-t2.png`); (2) squat-figurens størrelse: delvist bedre paa 390, aaben paa 1280; (3) hovedet: LUKKET for min del, det har nu pande, bryn, oeje, næse og hals i profil og forfra (`A928-1280-squat-highbar-t2.png`, `A928-1280-dl-sumo-smal-t0.png`); i baenk ses hovedet kun i profil og blikket er ikke modelleret; (4) sumo-knaeet over armen: aaben; (5) baenk stor bue "fod under knae": aaben paa main (917 skulle ramme det, ikke set).

## 5. Graenser og Hara

- Mit oeje paa stille billeder fra headless Chrome, ikke maalt af en loefter; tal er kun dem modellen selv skriver paa billederne. Kun en syntetisk gennemsnitskrop; ikke set paa en telefon.
- Ikke gennemgaaet: hver enkelt af de ca. 100 billeder, film i realtid, og gren `ordre-917`.
- Hara: intet i dette arbejde beroerer Hara; ingen miljoevariabler er roert.
- Ingen push, ingen merges, ingen sub-agenter, ingen aendring af loeftmodellen eller appens kode.

Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft paa 390, sumo smal, midt i traekket: den stiplede tekst oeverst til hoejre ("ryg 4,9 grader lodrere") ligger igen lige oven paa hovedets top (syvende kritik i traek: 864, 870, 881, 889, 894, 900, 905) (`outputs/kritik-912/A912-390-dl-sumo-smal-t2.png`; `src/embed/deadliftAnimation.js`, `drawKonvSpoegelse`: flyt teksten til gulvet under figuren som paa 1280, hvor den allerede staar nederst til venstre uden at ramme noget); (2) squat paa 390 og 1280: figuren fylder stadig kun en tredjedel af bredden paa 390 og staar smal midt i et bredt billede paa 1280, mens haandcirkel og frontvindue fylder hjoernerne (`outputs/kritik-912/A912-390-squat-lowbar-t4.png`, `A912-1280-squat-highbar-t4.png`; `src/embed/squatAnimation.js` og panelets layout; kraever Marcs ja til at skjule haandcirklen paa smal skaerm, saa spoerg ham); (3) hovedet i squat, baenk og sumo: fladt, ensfarvet, uden hals, med en lys ovalklat til oeje (femte-ottende gang; 887 rettede kun doedloeft-hovedet i konventionel) (`outputs/kritik-912/A912-1280-squat-highbar-t4.png`, `A912-1280-baenk-stor-t3.png`; hovedet i `src/embed/squatAnimation.js` og `bench-animation.js`).

# Rapport: Ordre 912, loeftfigurerne som de staar nu (Bhishak)

## 1. Dom

Alle Marcs domme holder paa de tre loeft, paa 390 og 1280. Figurerne ligner nu loeft en coach genkender; det der staar tilbage er tegnehaandvaerk (hoved, tekst der rammer, figurens stoerrelse), ikke biomekanik. Yantras nyeste rapport er ordre 887 (main 7a06884). Jeg har ikke rettet noget og ikke roert modellen.

## 2. Hvad jeg goerte

Hentede loeftmodellens main med `git archive` til scratchpad, koerte den paa en lokal server (kun 127.0.0.1, alle eksterne kald blokeret: 0 netkald, ingen sideafhoengige fejl paa 1280, en 404 paa 390 fra en ukendt lille fil, som jeg ikke har fulgt). Genbrugte mit eget 905-script (`docs/kritik-912/tur-912.mjs`, `server-912.mjs`), headless Chrome, syntetiske kroppe. 105 filer i `outputs/kritik-912/`: De tre loeft-panelets stille figurer (squat, baenk, doedloeft, alle stillinger), squat-animationen (low bar og high bar, 5 tidspunkter), baenk-animationen (tre buer, 4 tidspunkter, buekortet) og doedloeft-animationen (konventionel, semi, sumo smal og bred, 5 tidspunkter). Jeg har laest `LAES-MODELLER-3.html` (kun laest): den gengiver 887 og passer med det jeg ser.

## 3. Marcs domme, en for en

- Baenk: holder. Stangen rammer buens top med underarmen lodret over albuen (`A912-390-baenk-stor-t1.png`, `A912-1280-baenk-stor-t3.png`). Kontaktpunktet ligger tættere paa halsen jo stoerre bue: 21,1 / 19,1 / 16,8 cm fra skulderen for lille / middel / stor, laend 7,3 / 9,0 / 10,6 cm (`A912-390-baenk-tre-buer.png`). Ikke alle archer lige meget: ja, tre forskellige buer.
- Squat: holder. Albuen er under og bag stangen i alle stillinger: low bar 4 cm bag / 23 cm under, high bar 8-10 cm bag / 24-25 cm under, aldrig ved hovedet (`A912-390-squat-lowbar-t4.png`, `A912-390-squat-highbar-t4.png`). Low bar sidder bag skulderen ("3,7 cm under skulderen" i panelet), kun faa cm fra high bar. Stangens sted er et spektrum: ja.
- Doedloeft: holder. Skinnebenet er helt frem til stangen i starten i konventionel, semi og begge sumo (`A912-390-dl-konventionel-t0.png`, `A912-390-dl-sumo-smal-t2.png`, `A912-1280-dl-sumo-smal-t0.png`); fodbredden er et spektrum: 32 / 49 / 66 / 82 cm stand, vinkel 10 til 40 grader ud.
- "Intet er binaert": ja, alle tre loeft har glidende valg (bue, stang, stand).

## 4. Hvad der stadig ser unaturligt ud for en erfaren coach

- Hovedet: fladt, ensfarvet, uden hals, med en oval klat til oeje. I squat og baenk ser det ud som en klods sat paa skulderen. I doedloeft er det bedre siden 887 (hals 16 cm, nakken foelger ryggen), og blikket gaar nu nedad i konventionel; i sumo smal peger det stadig lidt ud foran stangen.
- Teksten i doedloeft paa 390: paa 1280 er den flyttet ned i gulvet nederst til venstre og rammer intet (lukket). Paa 390 staar den stadig oeverst til hoejre og rammer hovedets top i sumo smal (`A912-390-dl-sumo-smal-t2.png`); i lockout er den kommet fri (`A912-390-dl-semi-t4.png` og `A912-390-dl-sumo-bred-t2.png`, ca. 8 px luft).
- Squat: figuren er lille i sit felt. 390: ca. en tredjedel af bredden. 1280: smal midt i et bredt billede. Yantra (887) siger selv, at det er Marcs layoutvalg.
- Frontvinduet i doedloeft paa 390 er en figur paa ca. 35 px; man kan ikke laese hofte og knae i det. Teksten over er laesbar, figuren er ikke.
- Baenk, stor bue: laarene er naesten vandrette og foden staar langt til hoejre; det ser ud som en meget lang benlinje. En coach vil sige "fod under knae". Ikke et brud paa Marcs domme, men et unaturligt indtryk (`A912-1280-baenk-stor-t3.png`).
- Sumo: knaeet er tegnet oven paa den haengende arm; i virkeligheden er armen indenfor og skjult bag laaret set fra siden (lille, `A912-390-dl-sumo-smal-t2.png`).

Mine seneste fund (905): (1) doedloeft-tekst: lukket paa 1280, halvt paa 390 (rammer stadig i sumo smal); (2) squat-figurens stoerrelse: aaben, uaendret; (3) hovedet: aaben. Yantra prioriterede hoved og panelet paa 1280 i 887; panelet paa 1280 ser nu stort og laeseligt ud.

## 5. Graenser og Hara

- Det er mit oje paa stille billeder fra headless Chrome, ikke maalt af en loefter; kun de tal modellen selv skriver paa billederne er citeret. Tidspunkt t0 til t4 er mine egne snapshots af en animation, ikke faste stillinger.
- Jeg har kun set en syntetisk gennemsnitskrop; lange laarben og lang torso i panelet har jeg ikke gennemgaaet enkeltvis (under 30 minutter).
- Hara: intet i dette arbejde beroerer Hara; ingen miljoevariabler er roert.
- Ingen push, ingen merges, ingen sub-agenter, ingen aendring af loeftmodellen eller appens kode.

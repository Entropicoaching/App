Marcs domme holdt: ja (med et forbehold: baenk-animationen hælder underarmen ca. 35 grader undervejs i loeftet; i pausen og i den stille figur er den lodret). Ligner rigtige loeft: ja (med forbeholdene nedenfor). De tre vigtigste ting Yantra retter naeste gang: (1) sumo-spoegelsens tekst brydes stadig midt i saetningen i animationen paa 390 ("op / til:" og "ryg" alene paa en linje; `A859-390-dl-sumo-bred-t1.png`; `src/embed/deadliftAnimation.js`, `konvForskelHele`): ordre 847 maalte linjerne paa den stille figur, men canvas'en i animationen er smallere end tekstens fulde bredde; goer skriften mindre eller flyt teksten op i det frie felt til hoejre, saa hver linje staar hel; (2) overskriften "De tre buer, samme skala" er klippet i toppen paa 390 (`A859-390-baenk-tre-buer.png`, sammenlign `A859-1280-baenk-tre-buer.png`; `src/baenkBuer.js` og `src/embed/benchAnimation.js`): 847 kaldte det "formentlig hans udsnit", men billedet er selve canvas'ens element, saa klippet er ikke et udsnit; giv overskriften luft over foerste baseline; (3) squat-animationen paa 390 er stadig kun ca. en tredjedel af bredden, mens forfra-vindue og haandcirkel fylder toppen (`A859-390-squat-lowbar-t2.png`, `A859-390-squat-highbar-t2.png`; `src/embed/squatAnimation.js`; samme fund som 836 og 848, ikke lukket, kraever Marcs ja til at flytte eller skjule vinduet).

# Ordre 859, Bhishak, 30. sep. 2026

## Gren

`kritik-859` (fra `main`). Filer kun under `docs/kritik-859/` (denne rapport, `server-859.mjs`, `tur-859.mjs`, `squat-stang-859.mjs`, tilpasset fra 848) og `outputs/kritik-859/` (117 filer: `T859-` stille figurer, `A859-` animationer, `S859-` squat bund/sticking/lockout, `maaling-859.json`). Set paa Yantras `main` (c28c93a, ordre 847 merget; nyeste rapport `RAPPORT-ordre-847.md`), hentet med `git archive` og serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280 (mus). 0 netkald ud af huset, ingen JS-fejl (kun en 404, formentlig favicon). Min seneste figur-kritik er 848. `Til Marc\LAES-MODELLER-3.html` er laest som tekst, ikke aendret. Arbejdet har ingen betydning for Hara.

## Hvad aendret

Ingenting i loeftmodellen eller sitet; det er en kritik. Fundene, per loeft og med Marcs domme:

- **Squat (low bar og high bar, side og forfra, animation):** holder. Albuen staar under og bag stangen i bunden (low bar: 17 cm bag og 19 cm under; animation 12 cm bag og 20 cm under; high bar 10 cm bag og 24 cm under), aldrig ved hovedet. Low bar og high bar ligger tydeligt taet, ikke en trappe. Haanden i cirklen ligger over stangen med tommelen rundt om, ser ret ud. For en coach staar hovedet stadig paa en lidt lang hals (aabent hos Yantra, 847 punkt 3). Paa 390 er figuren lille (se punkt 3 ovenfor).
- **Baenk (tre buer, animation):** holder i pausen: stangen staar paa kontaktprikken med lodret underarm (`T859-390-baenk-bryst.png`), og buens top ligger taettere paa halsen jo stoerre bue (kontakt 21,1 / 19,1 / 16,8 cm fra skulder; cirklerne sidder paa buernes top i `A859-1280-baenk-tre-buer.png`). Undervejs haelder underarmen ca. 35 grader (`A859-390-baenk-stor-t1.png`, stor bue, stangen ca. 8 cm fra prikken): det er banens J-form, Yantra har maalt det og lader det staa (847). For en coach ser det ud som en stang, der glider frem mod skulderen; det er ikke i pausen, men det er det, man ser mest af i animationen.
- **Doedloeft (konventionel, mellemting, sumo smal og bred):** holder. Skinnebenet er helt frem til stangen i opstillingen (knae 0,8 cm fra stangen, `T859-390-doedloeft-opstilling.png`), og fodbredden er et spektrum (32 til 82 cm i skyderen, 10 til 40 grader ud). Sumo ser rigtig ud paa 1280 (`A859-1280-dl-sumo-bred-t1.png`). Paa 390 er teksten ved den stiplede figur stadig brudt (se punkt 1).
- **Er mine seneste fund lukket?** 848 (1) baenkens bund: ikke lukket i animationen (undervejs), men pausen er rigtig. 848 (2) squat paa 390: ikke lukket (kraever et valg om siden). 848 (3) sumo-tekst: rigtig paa 1280 og i den stille figur, men ikke lukket i animationen paa 390. Nyt: buernes overskrift klippet paa 390.

## Testresultat

Maalt af mig, ikke af Yantras tests: 20 stille figurer (side, forfra, tre stillinger pr. loeft), 4 til 5 billeder pr. animation (squat low/high, baenk lille/middel/stor, doedloeft konventionel/semi/sumo smal/sumo bred) paa 390 og 1280, plus tre buer paa begge bredder. `maaling-859.json`: 0 netkald, 0 JS-fejl, en 404. Tekstbruddet i sumo (390) og den klippede overskrift (390) er set i billederne; 1280 er rent paa begge punkter. Jeg har set de vigtigste billeder enkeltvis, ikke alle 117.

## Hvad er naeste

Yantra retter de tre punkter oeverst. Marc afgoer, om squat-vinduet forfra og haandcirklen maa flytte eller skjules paa telefon (punkt 3), og om baenkens J-bane skal aendres (model, ikke figur). Marcs domme ("intet er binaert") holder i alle tre loeft; det, der staar tilbage, er telefonens laesbarhed, ikke loeftenes form.

## Aerlige graenser

- Stille billeder fra headless Chrome, ikke film paa en telefon; animationerne er set i 4 til 5 billeder med ca. 0,6 sekunds mellemrum, saa et enkelt oejeblik kan vaere tabt. Bunden af baenkloeftet i animationen ramte jeg ikke praecist; pausen kender jeg fra den stille figur og Yantras maaling.
- Kun syntetiske kroppe fra modellen; ingen atlet og ingen klip. Dybde og albuens sted er modellens tal, ikke maalt paa en loefter.
- Jeg har kun laest teksten i LAES-MODELLER-3, ikke set billederne; mine billeder er taget paa dist fra `main`, ikke fra Marcs fil.
- Leveringen (`hoest.mjs --aflever`) blev afvist af Claude Codes tilladelsesklassifikator, som en skrivning til et eksternt system. Jeg har ikke forsoegt at omgaa det; rapporten er committet paa grenen og skal leveres af Marc eller Dhruva.

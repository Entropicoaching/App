Marcs domme holdt: nej (kun een: low bar ligger stadig 6,4 cm under high bar, "et par cm" er ikke opfyldt; bænkens stablede led og buer, squat-albuen bag og under stangen og dødløftens skinneben og fodbredder holder). Ligner rigtige løft: ja, næsten (stillingerne ja; men squat-animationen på 390 er stadig lille nederst, og dødløftens og bænkens mål har streger og skilte hen over figuren). De tre vigtigste ting Yantra retter næste gang: (1) low bar: 5,3 cm under skulderen mod high bar 1,1 cm over = 6,4 cm (`S815-1280-lowbar-bund.png` mod `S815-1280-highbar-bund.png`; `src/embed/squatAnimation.js` og tabellerne bag); sæt low bar til 4-5 cm som standard og gør stangens sted til en glidende skala, ikke to faste punkter; (2) squat-animationen på 390 (`A815-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren fylder under en tredjedel af højden, mens forfra-vinduet og håndcirklen fylder hele toppen og et tomt bånd står imellem; gør figuren større og læg vinduerne i siden; (3) mærkerne på 390: dødløftens streger fra "knæ 0,8 cm" og "lænd 24,7 cm" går tværs gennem ryg og hoved (`T815-390-doedloeft-opstilling.png`; `src/doedloeftFigurer.js`), sumo-spøgelsets tekst "hofte 9,3 cm lavere / ryg 5,1° mere vandret" ligger oven på skinnebenet (`A815-390-dl-sumo-bred-t1.png`; `src/embed/deadliftAnimation.js`), og bænk-mærket "skulder 20,1 cm" ligger oven på stangsporet (`T815-390-baenk-bryst.png`; bænkens figurfil i `src/`); brug korte streger eller en fast søjle ved siden af figuren.

# Ordre 815, Bhishak, 30. sep. 2026

## Gren

`kritik-815` (fra `main`). Filer kun under `docs/kritik-815/` (denne rapport og mine scripts `tur-815.mjs`, `squat-stang-815.mjs`, `server-815.mjs`, kopieret fra 804 med nyt ordrenummer) og `outputs/kritik-815/` (117 filer: `T815-` stille figurer, `A815-` animationer, `S815-` squat bund/sticking/lockout, `maaling-815.json`). Set på Yantras `main` (88b46a4, ordre 793 merget; nyeste rapport `RAPPORT-ordre-793.md`), hentet med `git archive` og serveret på 127.0.0.1 i headless Chrome på 390 (touch) og 1280. 0 netkald sluppet ud, syntetiske kroppe. Ingen rettelser i løftemodellen eller sitet. `Til Marc\LAES-MODELLER-3.html` er kun læst som kontekst (dens billeder svarer til de samme figurer; jeg har målt selv i stedet for at stole på den). Tid: under 30 minutter, så jeg har set et udvalg af de 117 billeder tæt (squat bund low/high, squat-animation 390, bænk tre buer, bænk bryst og stor bue i lockout, dødløft opstilling, sumo bred), ikke alle.

## Hvad ændret

Intet i løftemodellen, sitet eller appen. Kun nye filer: denne rapport, tre scripts og 117 filer i `outputs/kritik-815/`.

## Testresultat

Ingen tests kørt og ingen kode ændret. Målingerne: 117 billeder og `maaling-815.json` (0 netkald, 1 konsolfejl på 390, 0 på 1280).

## Holder figurerne Marcs domme?

- **Bænk: ja.** Ved brystet står underarmen lodret og leddene stablet under stangen (`T815-390-baenk-bryst.png`). Tre buer i samme skala: kontakt 21,1 / 19,1 / 16,8 cm fra skulderen og lænd 7,3 / 9,0 / 10,6 cm (`A815-1280-baenk-tre-buer.png`): toppen tættere på halsen jo mere bue, og ikke alle lige meget. Stor bue i lockout: stangen over skulderleddet, underarmen lodret, lænden tydeligt hævet (`A815-390-baenk-stor-t2.png`).
- **Squat: albuen ja, stangens sted nej.** Albuen under og bag stangen: low bar 17 cm bag og 19 cm under, high bar 11 cm bag og 23 cm under, forfra 20 cm under (`S815-1280-lowbar-bund.png`, `S815-1280-highbar-bund.png`, `A815-390-squat-lowbar-t2.png`), aldrig ved hovedet. Men low bar står 5,3 cm under skulderen og high bar 1,1 cm over: 6,4 cm imellem, og Marc siger "et par cm". Uændret siden min 804. Yantra har ikke rørt den, fordi den venter på Marcs svar; det er stadig det eneste, der bryder en af hans domme.
- **Dødløft: ja.** Skinnebenet står helt frem til stangen i opstillingen (stang 3,0 cm foran, `T815-390-doedloeft-opstilling.png`). Fodbredden er en skala: konventionel 32 cm, mellemting 49 cm og sumo 65,6 og 82 cm, med tydeligt forskellig hofte og knæstilling (`A815-*-dl-*`).
- **"Intet er binært":** bænk og dødløft ja (glidende buer og glidende standbredde). Squat er kun halvt: low/high er to knapper med 6,4 cm imellem, ikke en skala.

## Ligner de rigtige løft?

Ja, næsten. Stillingerne ser rigtige ud for en coach: bænkens stablede led og buer, squatens dybde og tilbagelænede low bar-torso mod mere oprejst high bar, dødløftens ryg og knæ i opstillingen. Det, der stadig er unaturligt eller forstyrrer:

- Squat på 390: figuren er lille nederst i animationen (`A815-390-squat-lowbar-t2.png`); den store del af skærmen er forfra-vindue, hånd-lup og tomt felt. En coach ser ikke længere dybden.
- Sumo: spøgelset (konventionel som stiplet linje) er godt, men teksten "ryg samme vinkel"/"ryg 5,1° mere vandret" står på 390 oven på skinnebenet. Og fra siden ligner sumo i lockout stadig meget en konventionel (`A815-1280-dl-sumo-bred-t1.png`): hofte 9,1 cm lavere, ryg "samme vinkel". Yantra har selv skrevet i 793, at en rigtig sumo-løfter står mere oprejst; modellen siger det modsatte (fladere ryg). Det er Marcs dom, ikke min.
- Bænk: hovedet er en lille klump ved bænkens ende, og hals og skulderparti hænger sammen som én kasse (`T815-390-baenk-bryst.png`). Det ses kun, når man kigger efter.

## Er mine seneste fund lukket?

Mine tre fund fra 804 sammenholdt med `main` nu:

1. Low bar 6,4 cm under high bar: **åben** (samme tal, afventer Marc).
2. Squat-animation på 390 med lille figur og fyldt top: **åben** (samme layout).
3. Mærker hen over figuren på 390 (dødløft "knæ" og "lænd", bænk "skulder"): **åben**, og et nyt er kommet til med sumo-spøgelsets tekst på skinnebenet.

Lukket siden sidst (ordre 793): sumo har nu konventionel som stiplet spøgelse med tal (godt, og det svarer på mit fund om at sumo lignede konventionel fra siden), og halsen i squat og dødløft er en glat form uden firkantede hjørner (`S815-1280-lowbar-bund.png`: nakken går blødt ind i skulderen).

## Hvad er næste

Marc afgør low bar ("et par cm": 2, 3 eller 4-5 cm), så Yantra kan rette punkt 1. Derefter punkt 2 og 3 (layout på 390), som ikke afhænger af Marc. Sumo-ryggens vinkel er også Marcs dom.

## Ærlige grænser

Se næste afsnit: udvalg af billeder, kun stille billeder, kun sidemodel.

## Hvad jeg ikke kunne, og Hara

- Ikke set: hver enkelt af de 117 billeder, og ingen film på rigtig telefon (kun stille billeder fra headless Chrome). Konsolfejl: én 404 på 390 (formentlig ikon, ikke løftesiden; ikke undersøgt), ingen på 1280.
- Marcs domme kan jeg kun aflæse i figuren; jeg har ikke målt en rigtig løfter, og modellen regner kun fra siden.
- Ingen betydning for Hara.

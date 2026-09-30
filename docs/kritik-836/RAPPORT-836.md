Marcs domme holdt: ja (alle; low bar er nu 3,7 cm under skulderen mod high bar 1,1 cm over = 4,8 cm, og det var den sidste). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) squat-animationen paa 390 (`A836-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren fylder stadig kun ca. en fjerdedel af bredden nede til venstre, mens forfra-vindue og haandcirkel fylder hele toppen; goer figuren stoerre og laeg vinduerne i siden; (2) doedloeftens opstilling paa 390 (`T836-390-doedloeft-opstilling.png`; `src/doedloeftFigurer.js`): stregerne "laend 24,7 cm", "hofte 41,0 cm" og "knae 0,8 cm" gaar stadig tvaers gennem ryg, laar og skinneben; brug korte streger eller en fast soejle ved siden af figuren; (3) sumo-animationen paa 390 (`A836-390-dl-sumo-bred-t1.png`; `src/embed/deadliftAnimation.js`): forfra-vinduet daekker figurens hoved og skulder, og spoegelsens tekst "hofte 9,3 cm lavere / ryg 4,0 graders mere vandret" ligger oven paa skinnebenet; teksten skifter desuden fortegn hen over loeftet (foerst "4,0 mere vandret", til sidst "1,0 mere lodret", `A836-1280-dl-sumo-bred-t4.png`), saa en coach ikke kan laese et enkelt svar; flyt vinduet og teksten ud af figuren og vis een linje for hele loeftet.

# Ordre 836, Bhishak, 30. sep. 2026

## Gren

`kritik-836` (fra `main`). Filer kun under `docs/kritik-836/` (denne rapport og scripts `server-836.mjs`, `tur-836.mjs`, `squat-stang-836.mjs`, kopieret fra 815 med nyt ordrenummer) og `outputs/kritik-836/` (117 filer: `T836-` stille figurer, `A836-` animationer, `S836-` squat bund/sticking/lockout, `maaling-836.json`). Set paa Yantras `main` (dd8408d, ordre 807 merget; nyeste rapport `RAPPORT-ordre-807.md`), hentet med `git archive` og serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280. 0 netkald sluppet ud, syntetiske kroppe. `Til Marc\LAES-MODELLER-3.html` er kun set som kontekst; jeg har malt selv. Jeg har set et udvalg taet (squat bund low/high, squat-animation 390, baenk tre buer, baenk bryst og stor bue, doedloeft opstilling, konventionel og sumo bred i start og slut), ikke alle 117.

## Hvad aendret

Intet i loeftmodellen, sitet eller appen. Kun nye filer: rapport, tre scripts og 117 filer i `outputs/kritik-836/`.

## Testresultat

Ingen tests koert og ingen kode aendret. Malinger: 117 billeder og `maaling-836.json` (0 netkald; paa 390 een konsolfejl, en 404 paa en ressource; 0 paa 1280).

## Holder figurerne Marcs domme?

- **Baenk: ja.** Ved brystet staar underarmen lodret og leddene stablet under stangen (`T836-390-baenk-bryst.png`). Tre buer i samme skala: kontakt 21,1 / 19,1 / 16,8 cm fra skulderen, laend 7,3 / 9,0 / 10,6 cm (`A836-1280-baenk-tre-buer.png`): toppen taettere paa halsen jo mere bue, og ikke alle lige meget. Stor bue: laenden tydeligt haevet (`A836-390-baenk-stor-t2.png`).
- **Squat: ja.** Albuen under og bag stangen: low bar 17 cm bag og 19 cm under, high bar 11 cm bag og 23 cm under, forfra 20 cm under (`S836-1280-lowbar-bund.png`, `S836-1280-highbar-bund.png`, `A836-390-squat-lowbar-t2.png`), aldrig ved hovedet. Low bar 4,8 cm under high bar: "et par cm" holder. Stangens sted er stadig tre knapper (low, high, front), ikke en glidende skala; jeg vurderer det som lille, fordi forskellen nu er lille.
- **Doedloeft: ja.** Skinnebenet staar helt frem til stangen i opstillingen (stang 3,0 cm foran, `T836-390-doedloeft-opstilling.png`). Fodbredden er en skala: konventionel 32 cm, mellemting 49 cm, sumo 65,6 og 82 cm, med tydeligt forskellig hofte og knaestilling (`A836-*-dl-*`).
- **"Intet er binaert":** baenk og doedloeft ja; squat naesten (tre stangsteder i stedet for glidende).

## Ligner de rigtige loeft?

Ja. Stillingerne holder for en coach: baenkens stablede led og buer, squatens dybde med low bar-torso 54 grader mod high bar 36 grader, doedloeftens ryg og knae. Det der stadig er unaturligt eller forstyrrer, alt paa 390:

- Squat-animationen: figuren er lille i nederste hjoerne; en coach ser ikke dybden (`A836-390-squat-lowbar-t2.png`).
- Doedloeft og sumo: maerker og vinduer oven paa figuren (se punkt 2 og 3 i dommen).
- Baenk: hovedet er stadig en lille klump; halsen er nu glat og ses ikke som en kasse (`T836-390-baenk-bryst.png`). Aabent men lille.
- Sumo fra siden ligner en konventionel med bredere ben; ryg-vinklen er Marcs dom, ikke min.

## Er mine seneste fund lukket?

Mine tre fund fra 815 sammenholdt med `main` nu:

1. Low bar 6,4 cm under high bar: **lukket** (ordre 807; nu 4,8 cm, `S836-1280-lowbar-bund.png`).
2. Squat-animation paa 390 med lille figur og fyldt top: **aabent** (samme layout).
3. Maerker hen over figuren paa 390: **aabent** for doedloeftens streger og sumo-spoegelsens tekst; baenk-maerket "skulder 20,1 cm" ligger stadig ved stangsporet men generer mindre (`T836-390-baenk-bryst.png`).

Lukket ud over low bar: baenkens hals er nu en glat form som i squat og doedloeft (ordre 807).

Har arbejdet betydning for Hara: nej.

## Hvad er næste

Yantra retter de tre punkter i dommen (squat-animation 390, doedloeftens streger 390, sumo-vinduet og spoegelsestekst 390). Marc svarer paa sumo-ryggens vinkel. Naeste kritik: se de tre 390-billeder igen efter rettelsen.


## Ærlige grænser

- Jeg har set et udvalg af de 117 billeder taet, ikke alle.
- Stille billeder fra headless Chrome, ikke film paa en telefon; syntetiske kroppe, ingen rigtige atleter.
- Jeg er ikke coach: Marcs domme er maalestokken, og sumo-ryggen overlader jeg til ham.


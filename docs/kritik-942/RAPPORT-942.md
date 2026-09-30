Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) squat paa 1280: figuren fylder ca. en fjerdedel af bredden, mens haandcirklen og frontvinduet tager hjoernerne og figuren ligner en lille mand i et stort moerkt rum (`outputs/kritik-942/A942-1280-squat-lowbar-t2.png`; layoutet i `src/embed/squatAnimation.js`; skaler figuren op eller saet haandcirklen ind i hjoernet; skjul haandcirkel kraever Marcs ja); (2) baenk, frontvinduet og stor bue: frontvinduet er stadig to arme, en graa klump og en stiplet skulderlinje uden hoved, og ved stor bue er laaret naesten vandret med foden langt ude (`A942-1280-baenk-stor-t3.png`, `A942-390-baenk-stor-t3.png`; `src/baenkFigurer.js` tegnForfra og benet i `src/embed/bench-animation.js`; foreslaa hovedet loeftet op over brystet som Marcs valg, og laan hoften/foden lidt tilbage ved stor bue); (3) doedloeft sumo: hoften staar nu 17-23 cm over knaeet (var 12), det er bedre, men ved smal sumo er laaret stadig naesten vandret og hoften langt bag stangen, saa opstillingen ligner en squat-start; og frontvinduet paa 390 er en figur paa ca. 35 px, hvor hofte og knae ikke kan laeses (`A942-1280-dl-sumo-smal-t0.png`, `A942-390-dl-sumo-bred-t0.png`; hoftereglen i `src/embed/deadliftAnimation.js`; regelvalget er Marcs, saa spoerg ham om en sumoregel, og giv frontvinduet plads under figuren).

# Rapport: Ordre 942, loeftfigurerne som de staar nu (Bhishak)


## Hvad ændret

Intet i koden (jeg retter ikke). Dom:

Marcs domme holder, og figurerne ligner rigtige loeft for en coach paa stille billeder. Det der staar tilbage er stoerrelse og layout (squat 1280, doedloeft-frontvindue 390), og to tegnevalg Marc skal tage (hoved i baenkens frontvindue, sumo-hoftens regel). Intet er nyt siden 928 paa den daarlige led; to ting er blevet bedre.

## Gren

kritik-942 (commit cf8355bb scripts og billeder, rapport i senere commits). Metode:

Hentede `dist` og `demo` fra `main` i loeftmodel-traeet (HEAD 515007f, ordre 926 flettet) med `git archive` til en midlertidig mappe og koerte dem paa en lokal server (127.0.0.1:9942), headless Chrome, 390 touch og 1280 mus, syntetisk krop, alle eksterne kald blokeret (0 netkald, 0 sidefejl paa 1280; en 404 paa 390 for en ressource, figurerne tegnede alligevel). Script: `docs/kritik-942/tur-942.mjs` (kopi af 928) og `server-942.mjs`. 105 billeder i `outputs/kritik-942/`; jeg har set ca. 9 enkeltvis (squat low/high bar, baenk lille/stor, doedloeft konventionel, sumo smal og bred). Laeste Yantras `RAPPORT-ordre-926.md` og foerste linje af min 928. `LAES-MODELLER-3.html` blev ikke aabnet separat; dens indhold er Yantras 926-billeder, og jeg vurderede selve demoerne.

## Testresultat

Ingen kodetest (kritik). Målt med `node docs/kritik-942/tur-942.mjs`: 105 billeder, 0 netkald, 0 sidefejl på 1280. Marcs domme, en for en:

- Baenk: holder. Stangen staar over buens top med lodret underarm; kontaktpunktet ligger taettere paa halsen ved stor bue: 16,8 cm fra skulder (stor) mod laend 10,6 cm, lille bue laend 7,3 cm (`A942-1280-baenk-lille-t3.png`, `A942-1280-baenk-stor-t3.png`, `A942-390-baenk-stor-t3.png`). Ikke alle archer lige meget: ja, tre buer.
- Squat: holder. Albuen er under og bag stangen, aldrig ved hovedet: high bar 3 cm bag / 26 cm under (390), low bar 12-13 cm bag / 19-20 cm under (`A942-390-squat-highbar-t2.png`, `A942-390-squat-lowbar-t3.png`, `A942-1280-squat-lowbar-t2.png`). Low bar sidder bag skulderen, faa cm fra high bar; spektrum: ja.
- Doedloeft: holder. Skinnebenet er frem til stangen i start i konventionel, semi og sumo (`A942-390-dl-konventionel-t0.png`, `A942-1280-dl-sumo-smal-t0.png`, `A942-390-dl-sumo-bred-t0.png`). Stand 32 til 82 cm, glidende.
- "Intet er binaert": ja, bue, stang og stand er glidende valg.

## Hvad er næste

Yantra retter de tre ting i første linje. Hvad der stadig ser unaturligt ud, og mine seneste fund:

- Squat 1280: lille figur i stort rum. Paa 390 fylder den godt.
- Baenk: frontvinduet har nu en skulderlinje (926), men intet hoved; Yantra har forklaret det i grænselisten. Stor bue: laaret naesten vandret, foden langt ude, en lang benlinje.
- Sumo smal: hoften 17 cm over knaeet (var 12 i 928), men stadig en squat-agtig start, hvor ryggen er naesten vandret. Sumo bred ser rimelig ud (hofte 23 cm over knae, ryg lodrere end konventionel).
- Doedloeft frontvindue paa 390: figur ca. 35 px, hofte/knae ikke til at laese.

Mine seneste fund (928): (1) sumo smal hofte: delvist bedre (12 til 17 cm), regelvalget stadig aabent; (2) baenk frontvindue: delvist lukket (skulderlinje), hoved mangler, forklaret; (3) baenk stor bue fod/laar: aaben; squat-stoerrelse 1280: aaben; doedloeft frontvindue 390: aaben (Yantra droppede et stoerre vindue, fordi det ramte figuren).

## Ærlige grænser

Grænser og Hara:

- Mit oeje paa stille billeder fra headless Chrome, ikke en loefter i realtid, ikke set paa en telefon; tal er dem modellen selv skriver. Kun en syntetisk gennemsnitskrop.
- Ikke gennemgaaet: alle 105 billeder enkeltvis, film i realtid, `LAES-MODELLER-3.html` som side.
- Hara: intet i dette arbejde beroerer Hara; ingen miljoevariabler er roert.
- Ingen push, ingen merges, ingen sub-agenter, ingen aendring af loeftmodellen eller sitet.

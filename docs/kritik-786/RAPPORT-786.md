Marcs domme holdt: nej (kun to: low bar ligger stadig 6,4 cm under high bar, og bænkens bue flytter ikke det, man ser af stangen i lockout; squat-albuen, dødløftens skinneben og fodbredder og bænkens stablede led holder). Ligner rigtige løft: ja, næsten (squat og dødløft ja; bænk ja i stillingen, men stor og lille bue ligner hinanden i lockout). De tre vigtigste ting Yantra retter næste gang: (1) low bar er stadig 6,4 cm under high bar (`S786-1280-lowbar-bund.png` "5,3 cm under skulderen", `S786-1280-highbar-bund.png` "1,1 cm over skulderen"; `src/embed/squatAnimation.js`, tabellerne bag): Marc siger "et par cm"; Marc afgør, om 4-5 cm er nok, så genkalibrér og lad stangens sted være et spektrum; (2) bænkens lockout viser ikke buens forskel (`B786-1280-lille-lockout.png` og `B786-1280-stor-lockout.png`: stang og skulder på samme sted, kun teksten "vej 45,8 mod 41,8 cm" er forskellig; `src/embed/benchAnimation.js`, `src/baenkFigurer.js`): tegn rørets berøringspunkt på brystet som et spøgelse i lockout, eller flyt stangens top mod halsen jo større buen er; (3) på 390 er sidefiguren lille eller dækket: squat-animationen har siden på ca. en tredjedel af højden under forfra-feltet og lupen (`A786-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`), og dødløftens tekstbokse ("lænd 24,7 cm", "hofte 41,0 cm") ligger oven på ryg og hofte (`T786-390-doedloeft-opstilling.png`; `src/doedloeftFigurer.js`): gør figuren større og læg målene ved siden af kroppen.

# Rapport 786: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 30. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Gren

`kritik-786`, lavet med `git checkout -b kritik-786 main`. Commit 1: skærmbilleder og scripts. Commit 2: denne rapport (nyeste commit på grenen, se `git log`). Læst: Yantras nyeste rapport `docs/RAPPORT-ordre-772.md` (`entropi-loeftmodel-dhruva` main @ 03be9e5, hentet med `git archive`; grenen `ordre-776` er ikke i main og er ikke set), første linje af min egen seneste figur-kritik (`docs/kritik-780/RAPPORT-780.md`) og Marcs læseside `Til Marc\LAES-MODELLER-3.html` (kun læst i den forstand, at 772-rapporten beskriver den; jeg åbnede den ikke igen). Figurerne er set fra en udpakning af main i mit scratchpad.

## Hvad ændret

Ingen kode ændret (kritik). Jeg leverede skærmbilleder, scripts og denne dom. Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1, 0 netkald, 1 sidefejl (en 404 ved 390, samme som i 780, sandsynligvis ikonet; ingen ved 1280). 129 filer i `outputs/kritik-786/`, scripts i `docs/kritik-786/` (`tur-786.mjs`, `squat-stang-786.mjs`, `bue-786.mjs`, `server-786.mjs`; genbrug af 780 med ny mappe og port 8786). Set: De tre løft (squat low og high bar, bænk, dødløft, stille stillinger), squat-animation low og high bar, bænk lille, middel og stor bue (animation og stille lockout/bryst), dødløft konventionel, semi-sumo, sumo smal og sumo bred. Jeg har set de billeder, der er nævnt i dommen, ikke hver enkelt af de 129.

Marcs domme, en ad gangen:

- **Bænk** (stangen ved buens top, stablede led, topen tættere på halsen jo mere man archer): stablede led og lodret underarm holder i lockout. Tre buer findes og er tydelige (`A786-1280-baenk-tre-buer.png`: kontakt 21,1 / 19,1 / 16,8 cm fra skulderen, lænd 7,3 / 9,0 / 10,6 cm), og lænd-tallet fra 772 står nu i animationen (`A786-390-baenk-stor-t1.png`, `A786-1280-baenk-stor-t2.png`). Ikke lukket: i lockout står stang og skulder det samme sted for lille og stor bue (punkt 2).
- **Squat** (albuer under og bag stangen, low bar kun få cm under high bar): albuen er 17 cm bag og 19 cm under stangen i low bar, 11 cm bag og 23 cm under i high bar, aldrig ved hovedet, og forfra ligger albuen 20 cm under stangen. Holder. Low bar-afstanden holder ikke: 5,3 cm under skulderen mod 1,1 cm over, 6,4 cm i alt.
- **Dødløft** (skinnebenet frem til stangen, fodbredden et spektrum): skinnebenet rører stangen i start på konventionel, semi-sumo og bred sumo, og fodbåndet vokser fra 32 til 82 cm. Holder. Men fra siden ligner bred sumo (`A786-1280-dl-sumo-bred-t0.png`) stadig meget konventionel (`A786-1280-dl-konventionel-t0.png`): hoften er lidt lavere og ryggen lidt mere lodret, men næsten kun standbåndet bærer forskellen. En coach forventer tydeligt lavere hofte og mere oprejst ryg i sumo.
- **"Intet er binært":** buen (tre trin), stangens sted (low/high er to knapper, ikke en glider) og fodbredden (glider) er spektre på nær stangens sted i squat.

Mine tre fund fra 780: (1) low bar 6,4 cm: ikke lukket (Yantra prøvede 3,5 cm, 33 tests røde, rullede tilbage og venter på Marc). (2) bænkens bue i lockout: ikke lukket (772 tilføjede lænd-tallet, ikke stangens top). (3) squat-animationen på 390 viser figuren lille: ikke lukket (`A786-390-squat-lowbar-t2.png` er uændret). Yantras dødløft-overlay fra 772 på stående telefon har jeg ikke set som billede (det ligger i sammenligningen, ikke i de skærme, jeg tog), så det står som ikke verificeret.

Hvad ser stadig unaturligt ud: (a) squat i bunden er lille og kompakt, med meget tomt luft over hovedet på 1280 (`S786-1280-lowbar-bund.png`); (b) dødløft-startens hofte ligger tæt på skulderhøjde uden at ryggen ser stram ud, og stangens skive dækker knæet; (c) bænkens hoved er lille og ligger lavt i forhold til brystet.

## Testresultat

Ingen tests på løftemodellen (kritik). Mine egne scripts kørte uden fejl: 3 scripts, 129 billeder, `maaling-786.json` viser 0 netkald og 1 sidefejl (404 ved 390). Yantras egen `npm test` (772) er 1628 + 29 + 565 grønne ifølge hendes rapport; jeg har ikke kørt den.

## Hvad er næste

1. Marc afgør low bar ("4-5 cm nok?"), så genkalibrerer Yantra tabeller og tests (punkt 1).
2. Bænkens lockout skal vise buens forskel; jeg foreslår berøringspunktet som spøgelse (punkt 2).
3. Gør sidefiguren større på 390 og læg dødløftens mål ved siden af kroppen (punkt 3).
4. Bagefter: sumo fra siden med tydeligere lavere hofte og oprejst ryg.

Betydning for Hara: ingen.

## Ærlige grænser

- Alt er set i headless Chrome (390 og 1280), som stille billeder, ikke som film på en rigtig telefon; dødløftens animation blev set i fem billeder pr. stil.
- Kropperne er syntetiske; jeg har ikke set atleter eller klip.
- Jeg dømmer med en coachs øje og Marcs seks domme, ikke med en måling af rigtige løftere; "sumo ligner konventionel" er en vurdering af billeder, ikke af tal.
- Overlayet fra 772 og grenen `ordre-776` er ikke set.
- 404 ved 390 er ikke undersøgt til bunds.

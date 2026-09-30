Marcs domme holdt: ja (alle seks holder; kun "low bar kun et par cm under high bar" er stadig et åbent tal: 5,3 cm under skulderen mod 1,1 cm over, Marc har ikke afgjort, om det er nok). Ligner rigtige løft: ja, næsten (squat og dødløft ja; bænk ja i stillingen, men buens forskel ses mest i hoved og kontaktpunkt, ikke i stangens top). De tre vigtigste ting Yantra retter næste gang: (1) sumo fra siden ligner stadig konventionel (`A792-1280-dl-sumo-bred-t0.png` mod `A792-1280-dl-konventionel-t0.png`; `src/embed/deadliftAnimation.js`, `src/doedloeftFigurer.js`): hoften er kun lidt lavere, ryggen kun lidt mere lodret, og fodbredden ses kun som en streg under gulvet; sænk hoften tydeligt, oprejs ryggen, og vis fodbredden som forfra-felt som i squat; (2) dødløftens målebokse på 390 ligger stadig ovenpå ryg og hofte (`T792-390-doedloeft-opstilling.png`, "lænd 24,7 cm", "hofte 41,0 cm"; `src/doedloeftFigurer.js`): læg målene ved siden af kroppen med en tynd streg, som squat allerede gør; (3) squat-animationen på 390 er større, men figuren ligger stadig lille nederst med et stort tomt felt midt i (`A792-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`), og low bar ligger 6,4 cm under high bar (`S792-1280-lowbar-bund.png`, `S792-1280-highbar-bund.png`): brug højden mellem forfra-feltet og figuren, og få Marcs svar på 4-5 cm, så low bar kan genkalibreres som spektrum.

# Rapport 792: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 30. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Gren

`kritik-792`, lavet med `git checkout -b kritik-792 main`. Commit 1: skærmbilleder og scripts. Commit 2: denne rapport (nyeste commit på grenen, se `git log`). Læst: Yantras nyeste rapport `docs/RAPPORT-ordre-776.md` (`entropi-loeftmodel-dhruva` main @ 6ffe8fc, hentet med `git archive`; `dist/` og `demo/` udpakket i mit scratchpad, så figurerne er 776-udgaven), første linje af min egen seneste figur-kritik (`docs/kritik-786/RAPPORT-786.md`) og tekst-starten af Marcs læseside `Til Marc\LAES-MODELLER-3.html` (kun læst).

## Hvad ændret

Ingen kode ændret (kritik). Jeg leverede skærmbilleder, scripts og denne dom. Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1, 0 netkald, 1 sidefejl (samme 404 ved 390 som i 780 og 786, ikke undersøgt; ingen ved 1280). 129 filer i `outputs/kritik-792/`, scripts i `docs/kritik-792/` (genbrug af 786 med ny mappe og port 8792). Set: De tre løft (stille figurer), squat-animation low og high bar, squat bund/sticking/lockout for begge stænger, bænk lille/middel/stor (animation og stille bryst/lockout), dødløft konventionel, semi-sumo, smal og bred sumo. Jeg har set de billeder, der er nævnt i dommen, ikke hver enkelt af de 129.

Marcs domme, en ad gangen:

- **Bænk** (stangen ved buens top, stablede led, toppen tættere på halsen jo større bue): stablede led og lodret underarm holder (`B792-1280-lille-lockout.png`, `B792-1280-stor-lockout.png`). Buens forskel ses nu i hovedets afstand (vej 45,8 mod 41,8 cm), brystets top (16,8 cm fra skulderen ved stor bue, `A792-390-baenk-stor-t2.png`) og lændbuen. Men stangen står lodret over skulderen i begge, så øjet ser hovedet flytte sig, ikke stangens top. Holder, men svagt.
- **Squat** (albuer under og bag stangen, low bar kun få cm under high bar): albuen er 17 cm bag og 19 cm under stangen i low bar, 11 cm bag og 23 cm under i high bar, aldrig ved hovedet; forfra 19 cm under stangen (`A792-390-squat-lowbar-t2.png`). Holder. Low bar-afstanden er urørt siden 772. Stangens sted er to knapper, ikke en glider.
- **Dødløft** (skinnebenet frem til stangen, fodbredde et spektrum): skinnebenet rører stangen i start på alle fire stilarter, og fodbåndet går fra 32 til 82 cm. Holder. Fra siden er forskellen mellem stilene lille (punkt 1).
- **"Intet er binært":** bue (tre trin) og fodbredde (glider) er spektre; stangens sted i squat er to knapper.

Mine fund fra 786: (1) low bar: ikke lukket, venter på Marc. (2) bænkens bue i lockout: delvist lukket af 776 (hoved og kontaktpunkt følger buen, stangen står samme sted). (3) squat på 390: delvist lukket (figuren større, mærker til højre med streg; stadig lille med tomt felt midt i); dødløftens målebokse ovenpå kroppen: ikke lukket. Dødløftens forfra-felt fra 772 er nu set som stillbillede: lille, men læseligt.

Hvad ser stadig unaturligt ud: (a) squat-bunden på 390 har meget tomt luft, og halsen er en klump mellem hoved og skulder (`S792-1280-lowbar-bund.png`); (b) dødløft-startens hofte ligger højt uden at ryggen ser stram ud, og stangens skive dækker knæet; (c) bænkens hoved er lille og ligger lavt i forhold til brystet.

## Testresultat

Ingen tests på løftemodellen (kritik). Mine scripts kørte uden fejl: 3 scripts, 129 billeder, `maaling-792.json` viser 0 netkald og 1 sidefejl (404 ved 390). Yantras egen `npm test` (776) er 1637 + 29 + 565 grønne ifølge hendes rapport; jeg har ikke kørt den.

## Hvad er næste

1. Sumo fra siden: tydeligt lavere hofte, mere oprejst ryg, fodbredde som forfra-felt (punkt 1).
2. Dødløftens mål ved siden af kroppen på 390 (punkt 2).
3. Squat på 390: fyld højden; Marc afgør low bar ("4-5 cm nok?"), så genkalibreres (punkt 3).
4. Bagefter: hals i squat-bunden og bænkens hoved.

Betydning for Hara: ingen. Aflevering via `hoest.mjs --aflever` blev afvist af værktøjets tilladelseskontrol og er ikke kørt; Dhruva eller Marc må køre den, hvis rapporten skal ind i floden.

## Ærlige grænser

- Alt er set i headless Chrome (390 og 1280) som stille billeder, ikke som film på en rigtig telefon; animationerne er set i 4-5 billeder pr. stil.
- Kropperne er syntetiske; jeg har ikke set atleter eller klip.
- Jeg dømmer med en coachs øje og Marcs seks domme, ikke med en måling af rigtige løftere; "sumo ligner konventionel" er en vurdering af billeder.
- Læsesiden er ikke åbnet i browser og ikke set i sin helhed; 404 ved 390 er ikke undersøgt; `npm test` er ikke kørt.

Marcs domme holdt: ja (baenk, squat og doedloeft-skinneben er ikke gaaet i stykker). Ligner rigtige loeft: nej, ikke helt (squat og baenk ja; sumo-doedloeft ser stadig ud som en konventionel krop med bredt stand). De tre vigtigste ting Yantra retter naeste gang: (1) sumo-doedloeftets krop: paa 1280 med stand 66 cm staar hoften ca. 25 cm bag haelen, ryggen ca. 55-60 grader fra lodret og skuldrene langt foran stangen, som en konventionel; en sumo-loefter har hoften taettere paa stangen og en lodrere ryg, og teksten "ryg 4,9 grader vandrere" (med "stiplet konv., op til:") laeses som det modsatte (`A876-1280-dl-sumo-smal-t0.png`, `A876-390-dl-sumo-bred-t0.png`; `src/embed/deadliftAnimation.js`, `konvForskelHele`, og kropsplaceringen i doedloeftmodellen for standbredde over ca. 55 cm); (2) squat-animationen paa 390 er stadig kun en tredjedel af bredden, fordi forfra-vinduet og haandcirklen fylder toppen (`A876-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`; aabent siden 836, kraever Marcs ja til at flytte eller skjule vinduet); (3) baenkens tre buer er paa 390 en flade af overlappende omrids uden krop og uden markering af hvor stangen rammer (`A876-390-baenk-tre-buer.png`; `src/baenkBuer.js`): tegn en lille markering paa hver bues top, hvor stangen rammer, saa en coach kan se "toppen taettere paa halsen jo mere man archer" uden at laese tal; og lidt af det stille figurers "H" og dobbeltstreg midt paa laar og skinneben i squat-lockout (`S876-1280-lowbar-lockout.png`) er ukommenterede maerker.

## Gren

`kritik-876` fra `main`. Loeftmodellen hentet med `git archive main` (Yantras main, e6d519d, ordre 861 merget; nyeste rapport `RAPPORT-ordre-861.md`), serveret paa 127.0.0.1 og koert headless (puppeteer-core, Chrome) paa 390 (touch) og 1280 (mus). Scripts: `docs/kritik-876/server-876.mjs`, `tur-876.mjs`, `squat-stang-876.mjs` (tilpasset fra 859). Billeder i `outputs/kritik-876/`: `T876-` stille figurer, `A876-` animationer, `S876-` squat low/high bar, `maaling-876.json`. Min seneste figur-kritik var 859 (foerste linje laest). `Til Marc\LAES-MODELLER-3.html` er kun set som fil (aendret 30. sep 12.44), ikke aendret. 0 netkald ud af huset, ingen JS-fejl. Ingen betydning for Hara.

## Hvad aendret

Ingen aendring i loeftmodellen eller sitet; kun kritik.

### Marcs domme

- Baenk: holder. Stangen rammer ved buens top, underarmen er lodret paa brystet og i lockout (`T876-390-baenk-bryst.png`, `A876-1280-baenk-stor-t2.png`); toppen ligger 23,8 / 21,1 / 16,8 cm fra skulderen for lille/middel/stor bue, altsaa taettere paa halsen jo mere man archer. Ikke alle archer lige meget: tre buer findes.
- Squat: holder. Low bar: albue 17 cm bag og 19 cm under stang i bunden (`S876-1280-lowbar-bund` og `T876-1280-squat-bund.png`); high bar: 11 cm bag og 23 cm under. Albuerne er aldrig ved hovedet. Stangen sidder paa bageste skulder mod oeverste trapezius, kun lidt forskel i hoejde, og stangens sted staar som et spektrum i demoen.
- Doedloeft: holder. Skinnebenet er helt frem til stangen i opstilling (knae 0,8 cm, `T876-1280-doedloeft-opstilling.png`), ogsaa i sumo smal (`A876-1280-dl-sumo-smal-t0.png`). Fodbredden er et spektrum (glideren 32 til 82 cm; jeg saa 32, 49, 66 og 82).

### Hvad ser stadig unaturligt ud for en coach

Se de tre ting oeverst. Derudover: i konventionel opstilling staar hoften ca. 15 cm bag haelen (hofte 41 cm bag stang), lidt langt bag, men ikke forkert.

### Er mine seneste fund lukket (859)?

(1) Sumo-spoegelsens tekst: lukket. Teksten staar hel paa 390 ("stiplet konv., / op til: / hofte 9,5 cm lavere / ryg 11,3 grader vandrere"). Indholdet i "vandrere" er derimod nyt fund nr. 1. (2) De tre buers overskrift: lukket, der er luft over den paa 390. (3) Squat paa 390 for lille: aaben.

## Testresultat

Ingen npm test (loeftmodellen er ikke min). Alle tre scripts koerte til ende: 105 billeder plus 12 squat-billeder.

## Hvad er naeste

Yantra: (1) sumo-kroppen (hofte og rygvinkel over ca. 55 cm stand) og ordlyden "vandrere/lodrere"; (2) faa Marcs ja til at flytte eller skjule forfra-vindue og haandcirkel paa 390; (3) marker stangens ramme-punkt paa hver af de tre buer og fjern eller forklar "H"-mærket i squat-lockout. Baenkens J-bane midt i loeftet (underarm ca. 35 grader) er en modelbeslutning, ikke gentaget her.

## Aerlige graenser

Stille billeder fra headless Chrome paa 390 og 1280 (ikke 360); ikke en rigtig telefon og ikke film. Baenkens midt-loeft, sumo-hoftens og rygvinklens grad er aflaest paa billederne, ikke maalt; jeg har ikke oeppet hvordan "ryg vandrere" er regnet, saa fund 1 kan delvis vaere ordlyd frem for krop. Animationsbilleder er taget under afspilning, saa tidspunktet svinger. Kun syntetiske kroppe. Afleveringsscriptet er forsoegt koert efter commit; se svaret.

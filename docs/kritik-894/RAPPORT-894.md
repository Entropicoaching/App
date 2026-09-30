Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft paa 390: den nye sumo-tekst oeverst til hoejre (13 px) ligger nu hen over figurens hoved/haand i semi-sumo (49 cm) og sumo smal: "ryg 1,6 grader lodrere" staar oven paa figuren, og "op til:" brydes stadig paa egen linje (`outputs/kritik-894/A894-390-dl-semi-t0.png`, `A894-390-dl-semi-t4.png`; `src/embed/deadliftAnimation.js`, `drawKonvSpoegelse`: flyt teksten til den tomme venstre kant eller ned under figuren, og hold "op til: hofte ..." paa een linje); (2) squat paa 390: figuren fylder stadig kun ca. en tredjedel af bredden, mens frontvindue og haandcirkel fylder hele toppen; paa 1280 er De tre loeft-panelets stille billeder smaa med naesten ulaeselig tekst; syvende kritik i traek (836, 848, 864, 870, 881, 889, 894) (`outputs/kritik-894/A894-390-squat-lowbar-t2.png`, `T894-1280-squat-bund.png`; `src/embed/squatAnimation.js` og tre-loeft-panelets layout; Marcs ja til at skjule haandcirklen paa smal skaerm); (3) hovedet i squat og sumo: tung klods paa lang hals, blikket ud over gulvet i sumo (`outputs/kritik-894/A894-390-squat-highbar-t0.png`, `A894-390-dl-sumo-bred-t2.png`; hovedet i `src/embed/squatAnimation.js` og `deadliftAnimation.js`; samme fund som 848, 864, 870, 881, 889).

# Ordre 894, Bhishak, 30. sep. 2026

## Gren

`kritik-894` fra `main`. Filer kun under `docs/kritik-894/` (rapport og fire scripts genbrugt fra 889) og `outputs/kritik-894/` (`A894-` animationer, `T894-` stille figurer, `S894-` squat, samleark `ARK-*.png`, `maaling-894.json`). Set paa Yantras `main` 2dc1b53 (ordre 882 merget; nyeste rapport `RAPPORT-ordre-882.md`), hentet med `git archive`, serveret paa 127.0.0.1, headless Chrome paa 390 (touch) og 1280 (mus). Min seneste figur-kritik er 889 (foerste linje laest). `Til Marc\LAES-MODELLER-3.html` er ikke aabnet (tid); Yantras egne foer/efter-billeder i den er ikke kontrolleret, figurerne er set direkte i dist og demo. Kun syntetiske kroppe, ingen atletdata.

## Hvad aendret

Intet i appen eller loeftmodellen. Kun kritikkens egne filer.

## Dom pr. loeft (Marcs domme)

- Baenk (tre buer, animationen, 390 og 1280): stangen rammer ved buens top med underarmen lodret i lockout; kontakt 21,1 / 19,1 / 16,8 cm fra skulder (lille/middel/stor), toppen taettere paa halsen jo stoerre bue; prikken paa brystet ses. Ikke alle archer lige meget: holder. Holdt.
- Squat (low bar, high bar, side og forfra, animationen): albuerne under og bag stangen hele vejen. Ordre 882 virker: high bar staaende er nu 3 til 4 cm bag stangen (foer 1); bund low bar 12 til 17 cm bag, 19 til 20 cm under; high bar 11 cm bag, 23 cm under. Aldrig ved hovedet. Low bar kun lidt under high bar. Holdt.
- Doedloeft (konventionel 32 cm, semi 49, sumo 66 og 82): skinnebenet frem til stangen i start i alle bredder (knae 0,8 cm fra stang i opstilling); fodbredden er et spektrum med tre synlige trin. Holdt.

## Hvad ser stadig unaturligt ud

- Sumo-teksten er nu stor nok, men ligger oven paa figuren i semi- og smal sumo (ny fejl skabt af 882), og "op til:" brydes stadig.
- Hovedet: klods paa lang hals i squat; i sumo bund kigger den ud over gulvet.
- Sumo og konventionel ligner stadig hinanden i kroppen (hofte 4,5 til 9,5 cm lavere, ryg 5 til 11 grader lodrere); Yantra har stillet det som spoergsmaal til Marc.
- Squat 390: figuren smal, toppen fyldt af frontvindue og haandcirkel; low bar t0 ligner en good morning (brystkassen meget vandret).
- Baenk 390: figuren fylder kun oeverste halvdel af feltet. Tre-buer-figuren viser kroppen som en kantet kasse med ben, ikke en ryg; svaer at laese som en bue.
- Yantras aabne punkt 4 ("H" og dobbeltstreg midt paa laar og skinneben i squat-lockout): set paa 390 i `S894-390-lowbar-lockout.png`, et lille "H" paa laaret; ukommenteret marke, ikke forklaret for en laerling.

## Er mine seneste fund lukket

- 889 nr. 1 (sumo-tekst 8 px og brudt): delvist lukket; skriften er 13 px og staar oeverst, men den overlapper nu figuren i semi/smal sumo og "op til:" brydes.
- 889 nr. 2 (squat lille paa 390, panel lille paa 1280): aabent.
- 889 nr. 3 (hoved): aabent.
- 881 forbehold (high bar-albue 1 cm bag): lukket (3 til 4 cm).

## Testresultat

Ingen appkode aendret, ingen testsuite koert. Maalingerne: ca. 117 billeder, 0 scriptfejl ud af scriptet, alle netkald ud af huset afvist.

## Hvad er naeste

Yantra retter de tre ting i foerste linje; nr. 1 er mindst og er en fejl fra sidste runde. Marc kan svare "modeller ok" eller "modeller ret: ...". Har arbejdet betydning for Hara: nej.

## Aerlige graenser

- Stille billeder fra headless Chrome, ikke film paa en telefon. 1280 er set paa udvalgte billeder, ikke alle faser.
- LAES-MODELLER-3.html ikke aabnet. Overlappet i sumo er set paa to billeder (semi t0 og t4) og kun paa 390; jeg har ikke talt hvilke standbredder mellem 49 og 82 der rammes.
- Jeg har ikke set squat-hovedets "blik" paa alle kroppe; det er et coach-indtryk uden maal.

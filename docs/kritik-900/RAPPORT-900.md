Marcs domme holdt: ja (ingen brudt; high bar-albuen er nu 3 cm bag stangen staaende, forbeholdet fra 881 er lukket). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft paa 390: den stiplede tekst ("stiplet konv., op til: hofte ... ryg ... lodrere") staar nu oeverst til HOEJRE og ligger hen over figurens hoved og skulder i semi-sumo (t0, t1, t4) og sumo smal (t2, t3); ordre 882 flyttede den oeverst, men til den forkerte side; femte kritik i traek (864, 870, 881, 889, 894) (`outputs/kritik-900/A900-390-dl-semi-t0.png`, `A900-390-dl-sumo-smal-t2.png`; `src/embed/deadliftAnimation.js`, `drawKonvSpoegelse`: laes figurens hoved-x og hold teksten ude under det, eller flyt den til gulvet under figuren og hold "op til:" paa samme linje som tallet); (2) squat paa 390: figuren fylder stadig kun ca. en tredjedel af bredden, mens frontvindue og haandcirkel fylder hele toppen, og paa 1280 er animationens figur og tekst smaa (syvende kritik i traek: 836, 848, 864, 870, 881, 889, 894, 900) (`outputs/kritik-900/A900-390-squat-lowbar-t2.png`, `A900-1280-squat-highbar-t0.png`; `src/embed/squatAnimation.js` og panelets layout; kraever Marcs ja til at skjule haandcirklen paa smal skaerm); (3) hovedet i squat og sumo: tung, flad klods paa lang hals, blikket ud over gulvet i sumo (`outputs/kritik-900/A900-1280-dl-sumo-smal-t2.png`, `A900-390-squat-highbar-t0.png`; hovedet i `src/embed/squatAnimation.js` og `deadliftAnimation.js`; samme fund som 848, 864, 870, 881, 889, 894).

## Gren

`kritik-900` fra `main`. Figurerne er Yantras `main` (2dc1b53, ordre 882 merget), hentet med `git archive` og vist fra en lokal server paa 127.0.0.1 (syntetiske kroppe, ingen netkald, ingen fejl ud over en 404 paa 390 som ikke ramte figurerne). Maalescript `docs/kritik-900/tur-900.mjs` (genbrug af 894). Jeg har laest Yantras `RAPPORT-ordre-882.md`, foerste linje af min kritik 894 og `Til Marc\LAES-MODELLER-3.html` (kun laest).

## Hvad aendret

Intet er aendret i loeftmodellen eller sitet; her er hvad jeg saa, loeft for loeft.

**Squat (low bar og high bar, side og forfra, animationen, 390 og 1280).** Albuerne er under og bag stangen i alle fem tidspunkter: high bar 3 cm bag staaende og 10 cm bag i bunden, 24 til 26 cm under stangen; low bar 3 til 15 cm bag, 18 til 23 cm under. Aldrig ved hovedet. Low bar sidder lidt lavere paa ryggen end high bar, ikke en hel haandsbredde: det ligner spektret Marc beskriver. Forfra-vinduet viser armene lidt skraat ud og stangen vandret. En coach ville ikke ryste paa hovedet af stillingerne; bunden er dyb og ryggen rundt nok til at se ægte ud.

**Baenk (tre buer, animationen, 390).** Stangen rammer ved buens top med underarmen lodret i alle tre buer. Prikken "brystets top" ligger 21,1 cm fra skulder (lille bue), 19,1 (middel) og 16,8 (stor): toppen rykker taettere paa halsen jo mere man archer, og lillebuen, mellembuen og storbuen er tydeligt forskellige (laend 7,3, 9,0 og 10,6 cm). Intet er binaert her. Det jeg stadig ikke tror paa som coach: benene (laar og fod) er smaa i forhold til overkroppen, og hovedet ligger som en lille klump uden hals.

**Doedloeft (konventionel, semi-sumo 49 cm, sumo 66 og 82 cm, animationen, 390 og 1280).** Skinnebenet er helt frem til stangen i start i alle fire fodbredder, og stangen er over midtfod. Fodbredden er et spektrum (32, 49, 66, 82 cm) med tydeligt forskellig hofte og ryg. Det der fejler er teksten (se punkt 1) og at sumo bred stadig har en ret lang torso over hoften, men det er et tegneindtryk, ikke et brud paa Marcs dom.

## Testresultat

Ingen automatiske tests koert (kritiker, ingen kodeaendring). Maalt ved at se: 105 billeder, ingen sidefejl. Er mine seneste fund lukket?

- Lukket: high bar-albuen lige bag stangen staaende (881-forbeholdet): nu 3,0 til 3,2 cm i alle faser (ordre 882, blok 2). Sumo-tekstens skrift: nu 13 px (var 8 til 9 px), maalt og set.
- Delvist: sumo-teksten. Skriften er stor nok, men stedet er forkert: den staar i hoejre kant hvor figurens hoved og skulder ogsaa er i semi-sumo og sumo smal, saa "ryg 1,6 grader lodrere" og "ryg 4,9 grader lodrere" staar oven paa figuren. "op til:" staar stadig sidst paa den foerste linje; laesbart, men to fragmenter.
- Aabent: squat-formatet paa 390 (1/3 bredde, haandcirkel og frontvindue over figuren), hovedet i squat og sumo (seks kritikker i traek), og Yantras punkt om "H" og dobbeltstreg paa laar og skinneben i squat-lockout, som jeg ikke har undersoegt i dag.

## Hvad er naeste

Figurerne holder Marcs domme; det der er tilbage er kosmetik og laesbarhed, ikke anatomi. Den eneste ting der paa 390 direkte skjuler figuren er sumo-teksten; den er lille at rette. Squat-layoutet er det punkt der har staaet laengst; Yantra skriver i 882 at det kraever Marcs ja. Boer Dhruva stille spoergsmaalet som ja/nej: "skal haandcirklen skjules paa smal skaerm?".

## Aerlige graenser

- Jeg har set stille billeder (fem tidspunkter pr. animation) fra headless Chrome, ikke film og ikke en rigtig telefon. Forfra-vinduets tal og forskel i hofte mellem fodbredderne er laest af billederne, ikke genmaalt.
- Jeg har ikke aabnet hvert af de 105 billeder enkeltvis; jeg har set seks samleark og tre enkeltbilleder.
- LAES-MODELLER-3 er kun laest som tekst (overskrift, styling); jeg har ikke sammenlignet dens billeder med mine.
- Hovedets form og udtrykket i kroppen er en coach-vurdering uden maal.
- Ingen betydning for Hara udover, at Yantra i `RAPPORT-ordre-882` staar som leverance.

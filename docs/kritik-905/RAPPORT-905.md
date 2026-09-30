Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft paa 390: den stiplede tekst ("stiplet konv., op til: hofte ... ryg ... lodrere") staar oeverst til HOEJRE og rammer figurens hoved og nakke i semi-sumo lockout (t4, "hofte 1,2 cm lavere / ryg 1,6 grader lodrere" ligger paa hovedet) og skraaner hovedets top i sumo smal (t2); sjette kritik i traek (864, 870, 881, 889, 894, 900) (`outputs/kritik-905/A905-390-dl-semi-t4.png`, `A905-390-dl-sumo-smal-t2.png`; `src/embed/deadliftAnimation.js`, `drawKonvSpoegelse`: laes figurens hoved-x, eller flyt teksten til gulvet under figuren, og hold "op til:" paa samme linje som tallet); (2) squat paa 390: figuren fylder stadig kun ca. en tredjedel af bredden, mens frontvindue og haandcirkel fylder hele toppen (`outputs/kritik-905/A905-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js` og panelets layout; kraever Marcs ja til at skjule haandcirklen paa smal skaerm, saa spoerg ham) - og paa 1280 staar figuren smal midt i et bredt billede med haandcirkel og frontvindue i hvert sit hjoerne (`A905-1280-squat-highbar-t0.png`); (3) hovedet i squat, baenk og sumo: fladt, ensfarvet og uden hals, et blik der peger ud over gulvet i sumo (`A905-1280-dl-sumo-bred-t0.png`, `A905-390-baenk-stor-t1.png`; hovedet i `src/embed/squatAnimation.js`, `deadliftAnimation.js` og baenk-filen; samme fund som 848 til 900).

## Gren

`kritik-905` fra `main`. Figurerne er Yantras `main` (2dc1b53, ordre 882 merget); main er uaendret siden min kritik 900, saa der er ingen nye figurer at vurdere siden da. Hentet med `git archive` og vist fra en lokal server paa 127.0.0.1 (syntetiske kroppe, ingen netkald, kun en 404 der ikke rammer figurerne). Maalescript `docs/kritik-905/tur-905.mjs` (genbrug af 900). Jeg har laest Yantras `RAPPORT-ordre-882.md`, foerste linje af min kritik 900, og set at `Til Marc\LAES-MODELLER-3.html` findes (kun laest; jeg har ikke gennemgaaet dens billeder enkeltvis). Skaermbilleder: 105 stk i `outputs/kritik-905/`; jeg har selv set 7 af dem (dl semi t0/t4, dl sumo smal t2, dl sumo bred 1280, squat low bar 390, squat high bar 1280, baenk stor 390), resten er ikke gennemset.

## Hvad aendret

Intet er aendret i loeftmodellen eller sitet; her er hvad jeg saa.

**Squat.** Albuerne er under og bag stangen: low bar 13 cm bag og 19 cm under i bunden (390), high bar 3 cm bag og 26 cm under staaende (1280). Aldrig ved hovedet. Forfra-vinduet viser vandret stang og arme lidt ud til siden. Marcs domme holder.

**Baenk.** Stangen staar over brystets top med underarmen naesten lodret (stor bue, 390); "lend 10,6 cm" viser buen. Bunden af figuren (ben og fod) ser rimelig ud. Hovedet ligger som en lille klump paa baenken. Marcs domme holder; jeg har kun set stor bue selv, de to andre stoler jeg paa fra 900.

**Doedloeft.** Skinnebenet er helt frem til stangen i start (semi-sumo 49 cm, sumo 66 og 82 cm); fodbredden er et spektrum med tydeligt forskellig hofte og ryg. Marcs domme holder. Sumo bred (82 cm) paa 1280 har teksten nede til venstre uden om figuren: det er fint.

## Testresultat

Ingen automatiske tests koert (kritiker, ingen kodeaendring). Maalt ved at se stille billeder fra headless Chrome, ikke film; 390 (touch) og 1280.

Er mine seneste fund (900) lukket?
- Aabent: sumo-teksten paa 390 staar stadig oeverst til hoejre og rammer hovedet i semi-sumo lockout.
- Aabent: squat-formatet paa 390 og hovedet (nu syvende gang).
- Lukket tidligere (900): high bar-albuen er 3 cm bag stangen.

## Hvad er naeste

Yantra retter tekstens sted i doedloeft, som er et lille og maalbart fund. Squat-layoutet og hovedet er coach-/layoutvalg, der kraever Marcs ja. Det aabne punkt fra 882 ("H" og dobbeltstreg paa laar og skinneben i squat-lockout) har jeg ikke undersoegt.

## Aerlige graenser

- Jeg har set faa billeder af de 105 og ikke film; teksten der rammer hovedet er set paa to stille billeder.
- Baenkens to mindre buer og squat 1280 low bar er ikke set af mig i dag.
- Hovedets udseende er min coach-vurdering, ikke et maal.
- Ingen rigtige atleter eller klip; kun syntetiske kroppe.

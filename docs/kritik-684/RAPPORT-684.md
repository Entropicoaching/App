Figurerne ligner rigtige loeft: nej. Marcs tre punkter rettet: nej (to af tre: squattens albue og doedloeftets knae er rettet; baenkens arch er kun rettet ved lockout, ikke ved brystet). Tre vigtigste ting Yantra retter naeste gang: (1) baenken ved brystet, (2) squat: low bar og high bar kan ikke skelnes med et blik, og armen/hovedet, (3) sumo og konventionel: hoften og haenderne.

Ordre 684: figurerne efter Yantras 676 (og 679) set med en coachs oejne. Bhishak, 29. sep. 2026.

## Hvad er vurderet

Yantras `docs/RAPPORT-dag-105.md` (loeftmodel main @ d22018c, git archive) er laest. `RAPPORT-dag-106.md` findes ikke paa main, og grenen `ordre-679` peger paa selve merge-commitet af 676 (d22018c), saa der er intet 679-arbejde at vurdere ud over 676. Jeg vurderer derfor 676. `LAES-MODELLER-3.html` (672 og 676 side om side, 7 par) er kun aabnet. Siden viser ikke squat; low bar og high bar har jeg renderet fra loeftmodellens main (De tre loeft, bunden, lokalt uddraget, kun laest). Alt headless: 390 touch og 1280 mus, uden net. Maalt: 14 af 14 figurer tegnes, 0 px sidelaens, 0 JS-fejl, 0 netkald paa begge bredder (`outputs/kritik-684/maaling-684.json`, `F684-*.png`, `S684-*.png`).

## Marcs tre punkter

- Squattens albuer: rettet. Albuen er under skulderen og bag ryggen i low bar og high bar (`S684-1280-lowbar-bund`, `-highbar-bund`), ikke i hovedhoejde.
- Baenkens torso og arch: rettet ved lockout (`F684-stor-06`): en rolig bue fra skulderblade til balde, lenden loeftet, ingen baand. Ved brystet (`F684-stor-02`, `F684-390-par1`), den stilling Marc ser mest, er torsoen stadig en flad, liggende masse med overarmen langs baenken; buen ses ikke. 676 aendrede her kun maerkater og hoved. Det er samme fund som 675.
- Doedloeft, knae og arme: rettet. Forfra er knaeene inden for armene i konventionel (`F684-stor-12`) og uden for i sumo (`F684-stor-10`). Fra siden hanger armen lodret.

## Low bar og high bar, et blik

Nej, ikke sikkert. De to squats er nedadtil naesten ens (knae 46 og 44 grader, skinneben 40 og 42). Forskellen er torso 49 mod 38 grader og stangens sted, men stangen sidder paa begge figurer ved nakken/overryggen, og skiven bag ligner hinanden. Low bar-armen ligger naesten vandret hen over ryggen. Hovedet er stukket frem og ned, som en skildpadde. Begge figurer fylder kun nederste tredjedel af panelet; resten er tom moerk flade, og "knae 23,0 cm"-maerkatet ligger oven paa laaret. Coachen vil se to squats med lidt forskellig vinkel, ikke to teknikker.

## Hvad ser stadig unaturligt ud

- Baenk: bue ved brystet mangler (se ovenfor). Forfra ved lockout (`F684-stor-06`, indsat vindue) er torsoen en lille skaal og armene et bredt V; skuldrene ser smallere ud end grebet, og brystet er en flad plade. Maerkaterne "skulder 24,8" og "albue 5,2" har fatet led-linjer (N3 forbedret), men staar tykt paa 390 og dækker hoved og haand.
- Haender: knyttede klumper uden greb om stangen, baade fra siden og forfra; ingen tommel eller finger.
- Fodstilling: sumo forfra har fodderne helt lige (kasser), selvom der staar "40 grader ud"; taaerne peger ikke ud. Konventionel forfra er ok.
- Sumo forfra: hoften er kun lidt over knaeet, laarene naesten vandrette: det ligner shiko, ikke et sumoloeft. Skuldrene er blokke og kroppen kort.
- Konventionel fra siden: knae 98 grader og laaret naesten vandret, balden langt bagud; ryggen er ret og hovedet neutralt (godt), men startstillingen ligner en halv squat.
- Ryggen: ret og glat i doedloeft, med torso 61 grader, fint. I squat er den lille, rund bue over overryggen lidt for glat.

## Lukket eller aabent fra 653, 662, 669 og 675

- Lukket: skulderleddet som ekstra hoved og deltoid-skiven (669), baenkens hoved (669/675), forfra-figurerne som pinde og blokke (N4, 653), Min krop-figuren, maerkater der laa paa baenken (N3, delvist: linjer tilbage til leddet).
- Aabent: baenkens bue ved brystet (675 punkt 1), squat-armen og halsen (675 punkt 2), low bar-skinnebenet 40 grader (Yantras kildegraense), sumo forfra (653 D5, 669, 675 punkt 3). Baenk-animationen bruger stadig den gamle figur (Yantras egen graense).

## De tre vigtigste ting Yantra retter naeste gang

1. Baenken ved brystet: tegn armen gennemsigtig eller bag torsoen, og luften under lenden tydeligere, saa buen ses. Ret samtidig forfra-torsoen i lockout, saa den ikke er en lille skaal.
2. Squat: goer low bar og high bar forskellige med et blik (stangens sted paa ryggen, torsovinkel, hoved, arm), luk skildpadde-halsen, og fyld panelet med figuren. Low bar-skinnebenet kraever en kilde eller Marc.
3. Haender og fodder, plus sumo: lav en haand, der griber om stangen (ikke en klump), taaer der peger ud i sumo, og en sumo-opstilling med hoften hoejere end knaeet (kilde).

## Gren og graenser

Grenen `kritik-684` er lavet med `git checkout -b kritik-684 main`. Commit 1: 09a15b8 (maalinger og skaermbilleder). Commit 2: denne rapport (hashen staar i `git log`). Filer kun under `docs/kritik-684/` og `outputs/kritik-684/`. Loeftmodellen og sitet er ikke roert; ingen push, ingen merges, ingen sub-agenter, ingen atletdata. Dommen er min, ikke en maaling; Marc har det sidste ord. `npm run lint` er kun kørt paa, hvad grenen aendrer (ingen kildefiler). Ingen betydning for Hara ud over at delmaalet "Appen maerkbart bedre" er uaendret: figurerne er endnu ikke klar til Marcs klasse.

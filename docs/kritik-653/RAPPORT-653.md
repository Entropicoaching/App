Figurerne ligner rigtige loeft: nej. Marcs tre punkter rettet: nej (squattens albuer ja, doedloeftets knae/arme delvist, baenkens bue nej).

Ordre 653: figurerne efter Yantras 646 set med en coachs oejne. Bhishak, 28. sep. 2026.

**De tre vigtigste ting Yantra retter naeste gang:**
1. **Baenk: buen skal kunne ses.** Lav en synlig luft mellem laenden og baenken (armen maa ikke daekke den), gør brystet til en bue og ikke en kuppel med toppen ved stangen, og traek foedderne tilbage, saa knaeet er foran anklen. Nu er "nu" naesten det samme billede som "foer".
2. **Sumo fra siden skal ligne sumo.** Skinnebenet er 14 grader som i konventionel, hoften staar lige saa langt bag stangen, og kun torsoen er lidt mere opret. En coach ser en konventionel opstilling med et blaat filter. Sumo har lodrette skinneben, hoften taettere paa stangen og opret bryst.
3. **Squattens arm: skulderleddet sidder ved halsen og albuen inde i kroppen.** Overarmen gaar skraat hen over hele torsoen fra halsen, og albuen ender inden for ryggens omrids. En low bar-loefter har albuen bag ryggen, overarmen omtrent langs ryggen og haanden taet ved skulderen.

## Gren

`kritik-653`, lavet med `git checkout -b kritik-653 main` fra `main` @ `8bb8276` i `entropi-app-kritik`.

- `74b61b3` kritik 653 blok 1 commit 1: skaermbilleder og maaling af LAES-MODELLER.html
- commit 2: denne rapport og verify-653. Hashen staar i `git log`.

Filer kun under `docs/kritik-653/` og `outputs/kritik-653/`. Ingen push, ingen merges, ingen sub-agenter, ingen atletdata, kun Yantras syntetiske figurer.

Laest: Yantras `docs/RAPPORT-dag-100.md` fra loeftmodellens `main` @ `d0530a9` (merge af ordre-646), laest med `git show main:...` (samme som `git archive`, intet tjekket ud; loeftmodellens trae er ikke roert). `C:\Users\Entropi\Desktop\LAES-MODELLER.html` er kun aabnet.

## Hvad ændret

Intet i loeftmodellen, sitet eller appen. Kun en kritik.

**Maaling** (`outputs/kritik-653/figurer-653.mjs`, headless Google Chrome, file://, net blokeret): paa 390 (touch) og 1280 (mus) tegnes 10 af 10 figurer, 0 px sidelaens, 0 JS-fejl, 0 netkald. Figurerne er 175 px brede paa 390 og 430 px paa 1280. Skaermbilleder: `F653-{390,1280}-par1..5.png` (foer/nu-raekkerne), `F653-side-{390,1280}.png` (hele siden) og `F653-stor-01..10.png` (hver figur stor; lige numre er "nu").

**Marcs tre punkter, en for en:**

- **"albuerne vender den forkerte vej ... oppe i hovedhoejde": rettet.** I low bar og high bar staar albuen nu under skulderen og bag den, og haanden er paa stangen (`F653-stor-02`, `-04`). Men armen ser stadig ikke naturlig ud: overarmen starter foran, ved halsen/hagen, og gaar skraat ned over hele torsoen, saa det ligner en arm der holder om brystet. Albuen ligger inden for ryggens omrids, ikke bag den. High bar og low bar har naesten samme arm; high bar-albuen boer pege mere lige ned, low bar-albuen mere bagud. Torsovinklerne er rigtige (ca. 50 grader low bar, ca. 42 grader high bar, laest paa billedet), dybden er parallel, knaeet gaar frem over taeerne. Det er armen og skulderen, der skaemmer.
- **"baenk ser torsoen maerkelig ud, arch virker unaturligt": ikke rettet.** Foer og nu side om side (`F653-1280-par3`) er naesten ens: en lille flad plet ved skulderbladene, ellers den samme kuppel med toppen lige under stangen. Buen, som en coach kigger efter (luften under laenden), kan ikke ses, fordi den naere arm og torsoens omrids daekker den. Foedderne staar foran knaeet med lodret skinneben; en styrkeloefter med bue har foedderne trukket tilbage. Hovedet er meget stort i forhold til torsoen og ligger fladt paa baenken; det giver figuren et tegneserieagtigt praeg. Paa 390 (175 px) er forskellen mellem foer og nu ikke til at se.
- **"doedloeft: knaeene enten paa ydersiden eller indersiden af armene": delvist.** Vinduet forfra siger det nu rigtigt og tydeligt: konventionel "knae inden for armene" med smal fod, sumo "knae uden for armene" med 85 cm og 40 grader ud. Men sidebilledet er uaendret for begge (foer = nu, `F653-390-par4`, `-par5`), og paa 390 er vinduet ca. 75 x 60 px, saa knae- og haandprikkerne er et par pixel. Og det Marc egentlig saa, at sumo fra siden ikke ligner sumo, er ikke roert (se punkt 2 oeverst).

**Hvad ellers ser unaturligt ud for en coach:**

- D1 middel, doedloeft: oeverste ryg har en spids pukkel ved skulderbladene, og hovedet haenger langt frem og ned foran skulderen (kran-hals). Det laeses som krum oeverryg, ikke som en neutral ryg i opstilling.
- D2 middel, sumo fra siden: maerkaterne "laend 21,0 cm" og "hofte 35,3 cm" ligger ovenpaa armen og skjuler hvor armen gaar i forhold til knaeet; der er ogsaa en brun skygge-figur bag den blaa.
- D3 lav, alle: hovedet er for stort (i squat naesten saa bredt som torsoen er dyb).
- D4 lav, squat paa 390: figuren fylder kun den nederste halvdel af feltet; den oeverste halvdel er tom, saa armen er lille.
- D5 lav, sumo forfra: laarene er vandrette, saa hoften ser ud til at staa i knaehoejde; i en sumo-opstilling er hoften over knaeet.
- Haender: i squat er haanden en prik paa stangen, fint; i doedloeft er grebet en prik paa stangen, fint. Fodstillingen fra siden er ens for alle fem (samme fod), ogsaa sumo.

## Testresultat

- `node outputs/kritik-653/figurer-653.mjs`: exit 0, 10/10 figurer, 0 sidelaens, 0 fejl, 0 net (`maaling-653.json`).
- `node outputs/kritik-653/verify-653.mjs`: groen (rapportens foerste linje har begge domme, fem afsnit, skaermbillederne findes, maalingen siger 0/0/0).
- `npm run lint`: groen (0 fejl).

## Hvad er næste

Yantra retter de tre ting oeverst (baenkens synlige bue og foedder, sumo fra siden, squattens skulder og albue), derefter D1 (oeverryg og hoved i doedloeft) og D2 (maerkaterne over armen i sumo). Doedloeftvinduet forfra boer vaere stoerre paa 390 eller saettes under figuren i fuld bredde. LAES-MODELLER boer vise baenken ved lockout ogsaa, hvor Yantra selv siger buen ses bedst.

Marc boer ikke svare "modeller ok" endnu. Hans svar kunne vaere: `modeller ret: baenk bue kan ikke ses, sumo fra siden ligner konventionel, squat-armen gaar over brystet fra halsen`.

Hara: planeten coaching, spor kropsmodel-til-teknikfeedback-i-de-tre-loeft. Figurerne er et skridt taettere paa (squattens albue er rettet), men de er ikke klar til at vise en atlet som teknikfeedback.

## Ærlige grænser

Jeg har kun set de fem "nu"-figurer paa LAES-MODELLER (bunden i squat, stangen paa brystet i baenk, opstillingen i doedloeft), ikke alle faser, Min krop eller Tre loeft, og ikke sitets `dist/`. Vinklerne i afsnittet om squat er laest paa billedet, ikke regnet. Dommen "ligner et rigtigt loeft" er min coach-vurdering af tegningen, ikke en maaling; Marcs oejne er dommeren. Kun lys/moerk-uafhaengige billeder: figurerne har egen moerk baggrund, og siden er ikke gennemgaaet i lyst og moerkt tema hver for sig.

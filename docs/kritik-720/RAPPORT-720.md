Marcs domme holdt: nej (squat: low bar ligger 11,6 cm under skulderen mod 1,1 cm over for high bar, ikke "et par cm", og albuerne ses slet ikke i siden; dødløft: sumo ser fra siden ud som en konventionel, så bredden er et lille målebånd, ikke et spektrum). Bænk og dødløftens skinneben holdt. Ligner rigtige løft: næsten (bænk ja, dødløft ja, squat nej). De tre vigtigste ting Yantra retter næste gang: (1) low bar-stangens sted i squat, 11,6 cm under skulderen og torso 54° mod 36° for high bar (`dist/tre-loeft/index.html`, squat, Low bar mod High bar, bunden; `demo/squat.html` og modelfilen for stangplacering): saml de to, så forskellen er nogle få cm og ikke en hel skulderhøjde; (2) squatten har ingen arme og ingen forfra-visning, så "albuerne under og bag stangen" kan hverken ses eller dømmes (`S720-1280-lowbar-bund.png`, `A720-1280-squat-lowbar-t2.png`; `demo/squat.html`, `src/embed/squatAnimation.js` og De tre løfts squatfigur): tegn overarm og albue bag stangen og en lille forfra-figur som bænk og sumo har; (3) bænkens arm ved kontakten er tegnet som en gennemsigtig dobbelt-arm hen over brystet og de tre buer ser ens ud i animationen (`A720-1280-baenk-lille-t0.png`, `T720-1280-baenk-bryst.png`, `A720-1280-baenk-stor-t2.png`; `demo/baenk.html`, `src/embed/benchAnimation.js`, `baenkFigurer.js`): tegn den nærmeste arm ugennemsigtigt og lad buen synes i lænden hele vejen op, ikke kun på det samlede billede.

# Rapport 720: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 29. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Gren

`kritik-720`, lavet med `git checkout -b kritik-720 main`. Commit 1: skærmbilleder og scripts. Commit 2: denne rapport. Læst: Yantras `docs/RAPPORT-dag-110.md` (ordre 703, `main` @ 8bc340c, hentet med `git archive`), første linje af min egen kritik 702, og Marcs læseside `LAES-MODELLER-3.html` (kun læst, ikke åbnet i browser; jeg har set de samme figurer i `dist/` og `demo/`).

## Hvad ændret

Ingen kode ændret; kun nye filer under `docs/kritik-720/` og `outputs/kritik-720/`.

Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1, 0 netkald. Squat: low bar og high bar, bunden, sticking og lockout i De tre løft, samt animationen (fem billeder pr. stang). Bænk: de stille figurer (bryst, midt, lockout) og animationen med lille, middel og stor bue (fire billeder hver) plus billedet med de tre buer. Dødløft: opstilling i De tre løft og animationen for konventionel og sumo med stand 65,6, 73,8 og 82 cm (fem billeder hver). Alle billeder ligger i `outputs/kritik-720/` (`S720-`, `T720-`, `A720-`), scripts `tur-720.mjs`, `squat-stang-720.mjs`, `server-720.mjs`. JS-fejl: 0 ud over en 404 på 390 (favicon).

## Marcs domme mod figurerne

- **Bænk, stangen ved buens top med stablede led: holder.** Underarmen er lodret over skulderen ved kontakten, og stangen sidder på brystet ved buens top i alle tre buer (Yantras tal: underarm 0°, kontakt højst 0,6 cm fra buens top). Toppen kommer tættere på halsen: 21,1 / 19,1 / 16,8 cm fra skulderen for lille, middel og stor. Ikke alle archer lige meget: ja, i tallene og på det samlede billede.
- **Squat, albuer under og bag stangen: kan ikke dømmes.** I siden er der ingen synlig overarm eller albue bag stangen (low bar viser kun en lille håndflade ved stangen; high bar en underarm i luften). Der er ingen forfra-visning af squat, så albuens position kan ikke ses. Det er Marcs punkt, og det er stadig åbent siden 702.
- **Squat, low bar kun et par cm under high bar: holder ikke.** Low bar: 11,6 cm under skulderen, torso 54°, skinneben 36°. High bar: 1,1 cm over skulderen, torso 36°, skinneben 44°. Det er 12,7 cm forskel i stangens højde og 18° i torso, ikke "et par cm". På figuren står low bar midt på skulderbladet og high bar på nakken, så de to ligner to forskellige øvelser. Stangens sted er et spektrum hos Marc; her er det to punkter. Der findes ingen mellemting.
- **Dødløft, skinnebenet frem til stangen i start: holder.** I opstillingen er skinnebenet 14° og stangen 3,0 cm foran midtfod, knæet 0,8 cm fra stangen; i animationen rører skinnebenet stangens forkant.
- **Dødløft, fodbredden som spektrum: holder halvt.** Skyderen går fra 65,6 til 82 cm (kun sumo; konventionel er en separat knap uden bredde). Fra siden er sumo ved 65,6, 73,8 og 82 cm næsten den samme figur, kun med et lille bånd "sumo-stand" under gulvet; skinnebenet er lidt mere lodret og hoften lidt lavere. Bredden ses kun forfra i den lille figur i De tre løft, ikke i animationen.

## Hvad ser stadig unaturligt ud for en erfaren coach

1. Squatten ligner en krop uden arme: intet ved siden af stangen viser hvor albuen er, og på 390 er den højeste-stang-frame (lockout) en tynd skikkelse med en enlig arm foran stangen.
2. Bænken har en gennemsigtig dobbeltarm hen over brystet ved kontakten (den nærmeste arm er tegnet med gennemsigtighed over torsoen), som lyder som en fejl; og de tre buer kan ikke skelnes i selve animationen, kun på det samlede billede og i tallene (lænd 7,3 / 9 / 10,6 cm).
3. Sumo og konventionel ligner hinanden fra siden. En coach venter mere vandret afstand mellem fod og stang og en mere opret torso i sumo ved bred stand.
4. Figuren fylder kun nederste tredjedel af animationspanelet på 1280 (squat og dødløft), med meget tom sort flade over hovedet.

## Er mine seneste fund lukket (kritik 702)

- Bænk-animationen er stadig kapsel-figuren uden bue: **lukket**. Den bruger nu den samme figur som de stille (Yantra, 703).
- De tre bænkbuer ligner hinanden: **halvt lukket**. Nu kan de skelnes på det samlede billede og i tallene; i animationen og i de stille figurer er forskellen lille (Yantra skriver selv, at trinnene er 1,3 til 2,3 cm).
- Squat forfra findes ikke: **åbent**. Uændret.
- Hænder og tekst meget små på 390: **åbent**. Hænderne er stadig små i bænkens forfra-figur og animationen.

## Ærlige grænser

- Jeg har set figurerne som headless-billeder på 390 og 1280 med én krop (den standard, siderne åbner med); tallene er fra figurernes egne tekster, ikke målt af mig.
- Jeg kørte ikke Marcs læseside i browser; jeg kiggede på siderne i `dist/` og `demo/`.
- Dødløftens hoftehøjde og torsovinkel i sumo er vurderet på øjemål fra fem billeder pr. bredde, ikke målt.
- Fire animationsbilleder pr. bue er stikprøver af et løb; en pludselig knæk mellem billederne kan jeg have overset (Yantra melder selv om en hurtig albuebevægelse de sidste procent før lockout).

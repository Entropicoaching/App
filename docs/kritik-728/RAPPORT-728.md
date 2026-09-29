Marcs domme holdt: nej (squat: albuen bag stangen ses kun forfra i animationen, aldrig fra siden, og low bar ligger nu 6,4 cm under high bar, som er tæt på men stadig mere end "et par cm"; dødløftens fodbredde er ikke et helt spektrum, for semi-sumo kan ikke vælges i animationen). Bænk og dødløftens skinneben holdt. Ligner rigtige løft: nej, men tæt på (dødløft ja, bænk næsten, squat næsten). De tre vigtigste ting Yantra retter næste gang: (1) bænkens animation har stadig en gennemsigtig dobbeltarm hen over brystet i nederste del af løbet (`A728-1280-baenk-lille-t0.png`, `A728-390-baenk-stor-t0.png`; `demo/baenk.html`, `src/embed/benchAnimation.js`, `baenkFigurer.js`): tegn den fjerneste arm bag torsoen, ugennemsigtig, så der kun ses én arm; (2) squat fra siden viser hverken overarm eller albue bag stangen, kun en hånd i lup (`F728-1280-squat-lowbar-bund.png`, `A728-1280-squat-lowbar-t2.png`; `demo/squat.html`, `src/embed/squatAnimation.js`, De tre løfts squatfigur): tegn overarmen fra skulderen ned og bag stangen til albuen, så sidebilledet siger det samme som forfra-billedet ("albue 19 cm under stang"); (3) dødløftens fodbredde springer fra konventionel 32 cm til sumo 65,6 cm (animationen) eller 1,6 gange skulderbredden (De tre løft), så mellemtingen semi-sumo findes kun som tal (`F728-1280-dl-konv-opstilling.png`, `F728-1280-dl-sumo-smal-opstilling.png`, `A728-1280-dl-sumo-smal-t0.png`; `demo/doedloeft.html` skyderen `standbredde-slider`, `src/doedloeftStillinger.js` `FODBREDDER`): lad skyderen starte ved konventionel og gå kontinuerligt til bred sumo.

# Rapport 728: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 29. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Hvad jeg gjorde

**Gren.** `kritik-728`, lavet med `git checkout -b kritik-728 main`. Commit 1: skærmbilleder og scripts (`c2ababf0`). Commit 2: denne rapport. Læst: Yantras nyeste rapport `docs/RAPPORT-dag-113.md` (ordre 714, `entropi-loeftmodel-dhruva` main @ afa63e5, hentet med `git archive`), første linje af min egen kritik 720, og Marcs læseside `LAES-MODELLER-3.html` (åbnet kun til læsning i headless Chrome).

Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1 og `file:`, 0 netkald. Squat: low bar og high bar, bunden, sticking og lockout i De tre løft (`F728-`), og animationen med fem billeder pr. stang (`A728-`). Bænk: stille figurer (`T728-`), animationen med lille, middel og stor bue (fire billeder hver) og billedet med de tre buer. Dødløft: opstilling og lockout for konventionel og sumo ved 1,6 og 2,0 gange skulderbredden, samt animationen for konventionel og sumo ved 65,6, 73,8 og 82 cm. Marcs læseside: 10 billeder på både 390 og 1280, 0 px sidelæns, 0 JS-fejl, 0 netkald (`L728-*-laeseside.png`). Billeder i `outputs/kritik-728/`, scripts `tur-728.mjs`, `figurer-728.mjs`, `laeseside-728.mjs`, `server-728.mjs`. JS-fejl i figurerne: 0 ud over en 404 på 390 (favicon).

## Marcs domme mod figurerne

- **Bænk, stangen ved buens top med stablede led: holder.** Underarmen står tæt på lodret under stangen ved bunden af løbet, og stangen sidder ved buens top i alle tre buer. Toppen kommer tættere på halsen: 21,1 / 19,1 / 16,8 cm fra skulderen for lille, middel og stor. Ikke alle archer lige meget: ja, tydeligt på det samlede billede (lænd 7,3 / 9 / 10,6 cm).
- **Squat, albuer under og bag stangen: holder halvt.** Nyt siden 720: animationen har en forfra-figur med tekst "albue 19 cm under stang" og en hånd i lup, og albuerne sidder under stangen. Fra siden ses stadig ingen overarm eller albue bag stangen, hverken i De tre løft eller i animationen; "bag" kan altså ikke ses, kun "under" forfra. På 390 dækker forfra-figuren øverste del af skiven og hovedet.
- **Squat, low bar kun et par cm under high bar: næsten.** Low bar: 5,3 cm under skulderen, torso 54°, skinneben 32°. High bar: 1,1 cm over skulderen, torso 36°, skinneben 44°. Forskellen i stangens højde er 6,4 cm mod 12,7 cm i 720, så stangens sted ligner nu et spektrum og ikke to forskellige øvelser. Er 6 cm "et par"? Det er Marcs at afgøre; Yantra spørger selv om 0,92 til 0,95 af torsoen.
- **Dødløft, skinnebenet helt frem til stangen i start: holder.** I opstillingen er stangen 3,0 cm foran midtfod og knæet 0,8 cm fra stangen (konventionel) og 1,8 cm (sumo, 95 cm stand); i animationen rører skinnebenet stangen i både konventionel og sumo ved alle tre bredder.
- **Dødløft, fodbredden som spektrum: holder halvt.** Sumo ses nu fra siden: torso 45° mod konventionelt 61°, hoften 4 cm over knæet mod 16 cm, hoften lavere, så de to ligner to forskellige stillinger. Men skyderen i animationen går kun fra 65,6 til 82 cm, konventionel er en separat knap, og semi-sumo (1,2 gange skulderbredden) findes ikke som valg; i De tre løft går skyderen fra 1,6 gange skulderbredden. Mellemtingen mangler dermed i selve brugerfladen.

## Hvad ser stadig unaturligt ud for en erfaren coach

1. Bænkens animation viser en gennemsigtig dobbeltarm hen over torsoen i nederste del af løbet (lille bue, `A728-1280-baenk-lille-t0.png`): begge arme er synlige gennem brystet, og overarmen peger tilbage mod hovedet. Det læses som en fejl, ikke som en arm.
2. Squat fra siden er en krop uden arm: stangen sidder på ryggen, men der er ingen overarm eller albue at se, så Marcs "aldrig ved hovedet" ikke kan ses fra siden.
3. Dødløft ved lockout og fodbredder imellem: figuren fra siden er tydelig, men hvor bredden ændrer sig, ses det kun som et lille bånd "sumo-stand" under gulvet; foden forfra findes kun i den lille figur i De tre løft.
4. Figurerne fylder stadig kun nederste to tredjedele af animationspanelet på 1280, med meget tom sort flade over hovedet (squat og dødløft).

## Er mine seneste fund lukket (kritik 720)

- Low bar 11,6 cm under skulderen: **lukket, næsten** (5,3 cm, forskel 6,4 cm).
- Squat uden arme og uden forfra-visning: **halvt lukket**. Forfra findes og viser albue under stang; siden viser stadig ingen arm.
- Bænkens gennemsigtige dobbeltarm: **åben**. Ses stadig i animationen.
- Bænkens tre buer ser ens ud i animationen: **halvt lukket**. Buerne skelnes på det samlede billede og i tallene; i selve animationen er forskellen stadig lille (1,3 til 2,3 cm pr. trin, Yantras egne ord).
- Sumo ser ud som konventionel fra siden: **lukket**. Torso og hofte viser forskellen tydeligt.
- Figuren fylder kun nederste tredjedel af panelet: **åben**.

## Ærlige grænser

- Jeg har set figurerne som headless-billeder på 390 og 1280 med én krop (den standard, siderne åbner med); tallene er fra figurernes egne tekster, ikke målt af mig.
- Animationsbillederne er stikprøver (fem pr. dødløft og squat, fire pr. bænkbue); et knæk mellem billederne kan jeg have overset. "Underarm tæt på lodret" i bænk er vurderet på øjemål.
- Jeg kiggede ikke på squat forfra i De tre løft, kun i animationen, og ikke på squat med front-stang, kropsvariationerne (lange lårben, lang torso) eller de øvrige dødløftsbredder mellem 1,6 og 2,0 gange skulderbredden.
- Marcs læseside blev kun åbnet og talt (10 billeder, 0 px sidelæns, 0 fejl); jeg har ikke gennemgået hver figur på den enkeltvis.

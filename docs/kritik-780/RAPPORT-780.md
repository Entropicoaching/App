Marcs domme holdt: nej (kun to: low bar ligger stadig 6,4 cm under high bar, og bænkens bue flytter ikke stangens top i lockout; squat-albuen, dødløftens fodbredder og bænkens stablede led holder). Ligner rigtige løft: ja, næsten (squat og dødløft ja; bænk ja i stillingen, men stor og lille bue ser ens ud i lockout). De tre vigtigste ting Yantra retter næste gang: (1) low bar er stadig 6,4 cm under high bar (`S780-1280-lowbar-bund.png` "5,3 cm under skulderen", `S780-1280-highbar-bund.png` "1,1 cm over skulderen"; stangens sted i squatmodellen, `src/embed/squatAnimation.js`): Marc siger "et par cm"; Marc afgør først, om 4-5 cm er nok, så lav genkalibreringen som 768 beskriver, og lad stangens sted være et spektrum; (2) bænkens bue flytter ikke stangens top i lockout (`B780-1280-lille-lockout.png`, `B780-1280-stor-lockout.png`, samme fase; `src/embed/benchAnimation.js`): stangen står på samme sted over skulderen og afstanden til hovedet er ens (ca. 55 px i begge billeder), selvom tabellen siger kontakt 21,1 mod 16,8 cm fra skulderen; lad stangens top og skulderen ligge tættere på halsen, jo større buen er; (3) squat-animationen på 390 viser figuren lille: siden fylder ca. en tredjedel af lærredets højde nederst, mens forfra-feltet og håndlupen fylder toppen (`A780-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): gør sidefiguren større eller stil forfra-feltet og lupen under den, så coachen kan se albuen.

# Rapport 780: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 30. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Gren

`kritik-780`, lavet med `git checkout -b kritik-780 main`. Commit 1: skærmbilleder og scripts. Commit 2: denne rapport (nyeste commit på grenen, se `git log`). Læst: Yantras nyeste rapport `docs/RAPPORT-ordre-768.md` (`entropi-loeftmodel-dhruva` main @ 4815e43, hentet med `git archive`), første linje af min egen seneste figur-kritik (`docs/kritik-758/RAPPORT-758.md`) og Marcs læseside `Til Marc\LAES-MODELLER-3.html` (kun læst; jeg åbnede den ikke igen, fordi 768-rapporten beskriver den). Jeg har set figurerne fra en udpakning af main i mit scratchpad, ikke fra Yantras mappe.

## Hvad ændret

Ingen kode ændret (kritik). Jeg leverede skærmbilleder, scripts og denne dom. Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1, 0 netkald, 1 sidefejl (en 404 ved 390, sandsynligvis ikonet; ingen fejl ved 1280). 129 filer i `outputs/kritik-780/`, scripts i `docs/kritik-780/` (`tur-780.mjs`, `squat-stang-780.mjs`, `bue-780.mjs`, `server-780.mjs`; genbrug af 758 med ny mappe og port 8780). Set: De tre løft (squat low/high, bænk, dødløft, stille stillinger), squat-animation low og high bar, bænk lille, middel og stor bue (animation og stille lockout/bryst), dødløft konventionel, semi-sumo, sumo smal og sumo bred.

Marcs domme, en ad gangen:

- **Bænk** (stangen ved buens top, stablede led): stablede led og lodret underarm holder i lockout og med stangen på brystet på begge bredder. Ikke lukket: buen ændrer sig, men stangens top gør ikke (punkt 2). Ikke alle archer lige meget: tre buer findes, og `A780-1280-baenk-tre-buer.png` viser dem tydeligt.
- **Squat** (albuer under og bag stangen, low bar kun få cm under high bar): albuen er 17-21 cm under stangen og 7-17 cm bag den i low bar og 11 cm bag i high bar, aldrig ved hovedet, og armen tegnes nu fra skulder til albue. Holder. Low bar-afstanden 6,4 cm holder ikke (punkt 1).
- **Dødløft** (skinnebenet frem til stangen, fodbredde som spektrum): skinnebenet rører stangen i starten (`T780-390-doedloeft-opstilling.png`, "stang 3,0 cm foran"), og konventionel, semi-sumo, smal sumo og bred sumo giver forskellig opstilling, lodret skinneben og mere oprejst overkrop i sumo. Holder.

Mine fund fra 758: (1) low bar 6,4 cm, ikke lukket; (2) forfra-feltet i bænk oven i plade og overkrop på 390, lukket (feltet ligger nu over figuren, `A780-390-baenk-stor-t1.png`); (3) bænkens bue flytter ikke stangens top, ikke lukket.

Hvad der stadig ser unaturligt ud for en erfaren coach, ud over de tre punkter: ved bunden i low bar er hovedet en klump direkte på kroppen med næsten ingen hals (`T780-390-squat-bund.png`); sumo set fra siden ligner konventionel i skulder og arm, og bredden står kun som en linje under gulvet (`A780-390-dl-sumo-bred-t2.png`), så en elev ser ikke, at fødderne står bredt.

## Testresultat

Ingen tests kørt (kritik; jeg rører ikke Yantras træ). Verificeret ved skærmbilleder: 0 netkald, 1 sidefejl (404), alle billeder i mappen læst efter hinanden for de vigtigste stillinger og faser; animationerne er set som fem stille billeder pr. serie, ikke som film. Bænkens lockout er set i samme fase via De tre løfts stille stillinger (`B780-*`), fordi animationens billeder ellers fanger forskellige faser.

## Hvad er næste

Yantra retter i den rækkefølge: (1) low bar-afstanden efter Marcs svar på 4-5 cm, (2) bænkens buetop i lockout, (3) squat-animationen på 390. Derefter: sumos bredde synlig fra siden (fx forfra-felt som i squat), og halsen i squat-bunden. Har Marc svaret "modeller ok" på LAES-MODELLER-3, vælger han selv, hvad der kommer først.

## Ærlige grænser

- Headless Chrome i 390 og 1280, ikke en rigtig telefon; stille billeder, ikke film. Pixelafstand for bænkens hoved-til-stang er læst på billederne (ca. 55 px), ikke målt i koden.
- Jeg har ikke set front squat, forfra-visning af bænk i animation ved alle bredder, eller Marcs egen mål-krop. Kun syntetiske kroppe.
- 404'en ved 390 er ikke undersøgt.
- Betydning for Hara: ingen.

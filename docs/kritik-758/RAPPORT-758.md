Marcs domme holdt: nej (kun én: low bar ligger stadig 6,4 cm under high bar, 5,3 cm under skulderen mod 1,1 cm over; squat-albuen, dødløftens tre fodbredder og bænkens stablede led holder). Ligner rigtige løft: ja, næsten (dødløft og squat ja; bænk ja i stillingen, men buen flytter ikke stangens top i lockout). De tre vigtigste ting Yantra retter næste gang: (1) low bar er stadig 6,4 cm under high bar (`S758-1280-lowbar-bund.png`, `S758-1280-highbar-bund.png`; stangens sted i squatmodellen, `src/embed/squatAnimation.js` og De tre løfts squat): Marc siger "et par cm", så flyt mod 2-3 cm og lad stangens sted glide som spektrum, med genkalibrering af tabeller og tests som 742 beskriver; (2) forfra-feltet i bænk på 390 ligger oven i plade og overkrop (`A758-390-baenk-lille-t1.png`, `A758-390-baenk-stor-t3.png`; `src/embed/benchAnimation.js`): gør feltet mindre eller læg det under figuren, som squat gør; (3) bænkens bue flytter ikke stangens top mod halsen i lockout (`A758-1280-baenk-lille-t3.png`, `A758-1280-baenk-stor-t3.png`; `src/embed/benchAnimation.js`): afstanden hoved til stang er ens for lille og stor bue (ca. 152 px begge), selvom tabellen siger kontakt 21,1 mod 16,8 cm fra skulderen; lad stangens top følge buen.

# Rapport 758: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 30. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Gren

`kritik-758`, lavet med `git checkout -b kritik-758 main`. Commit 1: skærmbilleder og scripts. Commit 2: denne rapport (nyeste commit på grenen, se `git log`). Læst: Yantras nyeste rapport `docs/RAPPORT-ordre-742.md` (`entropi-loeftmodel-dhruva` main @ 8cf42d2, hentet med `git archive`), første linje af min egen seneste figur-kritik `docs/kritik-751/RAPPORT-751.md`, og Marcs læseside `LAES-MODELLER-3.html` (kun læst; jeg har ikke åbnet den på ny i 758, kun søgt i teksten).

## Hvad ændret

Ingen kode ændret (kritik). Jeg leverede skærmbilleder, scripts og denne dom. Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1, 0 netkald og 0 sidefejl, 119 filer i `outputs/kritik-758/`, scripts i `docs/kritik-758/` (`tur-758.mjs`, `squat-stang-758.mjs`, `laeseside-758.mjs`, `server-758.mjs`; genbrug af 751 med ny mappe og port). Sat i gang: De tre løft (squat low/high/front, bænk, dødløft, stille stillinger), squat-animation low bar og high bar, bænk lille, middel og stor bue, dødløft konventionel, semi-sumo, sumo smal og sumo bred.

## Testresultat

Ingen tests (kritik). Set mod Marcs domme:

- **Bænk, stablede led ved buens top: holder.** Underarm og overarm lodret under stangen i lockout (`A758-1280-baenk-stor-t3.png`). **Men** toppen flytter sig ikke mod halsen med buen: hoved til stang er ca. 152 px for både lille og stor bue. Tabellen "kontakt 21,1 / 19,1 / 16,8 cm fra skulder" i `A758-1280-baenk-tre-buer.png` viser forskellen, animationens lockout viser den ikke. Ikke alle archer lige meget: de tre buer er tydelige som konturer, kun svage i selve figuren.
- **Squat, albuer under og bag stangen: holder, og 751-fund 1 er lukket.** De tre løft viser nu ringen "albue 17 cm bag, 19 cm under stang" for low bar og "11 cm bag, 23 cm under stang" for high bar (`S758-1280-lowbar-bund.png`, `S758-1280-highbar-bund.png`, `S758-390-lowbar-bund.png`, teksten er ikke klippet på 390). Animationen har samme ring og forfra "albue 19 cm under stang" (`A758-1280-squat-lowbar-t2.png`). Mindre: ringen sidder på overkroppen, og selve overarmen ses ikke i sidebilledet; kun ringen siger, hvor albuen er.
- **Low bar kun et par cm under high bar: holder ikke.** 5,3 cm under skulderen mod 1,1 cm over, altså 6,4 cm, uændret siden 728 og bevidst udskudt i 740 og 742. Stangens sted ses som to trin, ikke som spektrum. Læsesiden nævner ikke tallet.
- **Dødløft, skinnebenet helt frem til stangen i start: holder** i alle fodbredder, både i animationen (`A758-1280-dl-semi-t0.png`, `A758-390-dl-sumo-bred-t0.png`) og i De tre løft. Konventionel t0 er taget efter start (stangen er løftet), så startstillingen er set ved semi og sumo.
- **Dødløft, fodbredden er et spektrum: holder, og 751-fund 3 er lukket.** Lærredet siger `konventionel-stand`, `semi-sumo-stand` og `sumo-stand`, målebåndet ligger under fødderne og er ikke klippet på 390. Skyderen går 32 til 82 cm. Mit tidligere "sumo-stand ved både 49 og 82" er rettet.
- **Mine seneste fund (751):** 1 (albue i De tre løft) lukket; 2 (low bar) åbent; 3 (dødløftens mærke og bånd) lukket. Ny: forfra-feltet i bænk på 390, som jeg i 751 kaldte "mindre", ligger nu oven i pladen og overkroppen og er derfor blevet et fund.

## Hvad er næste

Yantra retter de tre punkter i første linje i den rækkefølge; punkt 1 er en hel ordre for sig (som 714). Mindre: (a) luft over hovedet i dødløftens startbillede, fordi rammen er hele banen til lockout; (b) albuens overarm kunne tegnes i De tre løfts sidebillede, så ringen ikke står alene; (c) læsesiden bør sige 6,4 cm ærligt, før Marc svarer "modeller ok". Til Hara: delmålet "Appen mærkbart bedre"; rapporten viser, at to af tre 751-fund er lukket, og at der er ét coach-synligt fund tilbage i squat og to i bænk.

## Ærlige grænser

- Alt er set i headless Chrome på 390 og 1280, ikke på en rigtig telefon; 360 ikke set. Stille billeder af animationerne (fire-fem tidspunkter pr. variant), ikke hele bevægelsen som film.
- Tallene er aflæst af figurernes egen tekst; 152 px er aflæst grovt af billeder og ikke målt med et værktøj. Squat kun set med den balancerede krop; front og safety bar, sammenligningsvisning og Min krop-siden er ikke set.
- Læsesiden er ikke åbnet på ny; kun tekstsøgning. Jeg dømmer figurerne som tegning og mod Marcs domme, ikke om modellens kræfter er rigtige.

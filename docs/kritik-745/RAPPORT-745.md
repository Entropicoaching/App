Marcs domme holdt: nej (kun to rester: low bar ligger stadig 6,4 cm under high bar i De tre løft, 5,3 cm under skulderen mod 1,1 cm over, og De tre løfts stille squat fra siden viser stadig ingen albue bag stangen; alt andet holder nu). Ligner rigtige løft: ja, næsten (bænk og dødløft ja, squat i animationen ja, squat i De tre løft næsten). De tre vigtigste ting Yantra retter næste gang: (1) De tre løfts squat fra siden mangler overarm og albue bag stangen (`F745-1280-squat-lowbar-bund.png`, `F745-390-squat-lowbar-bund.png`; `dist/tre-loeft/`, De tre løfts squatfigur): overfør ringen "albue 12 cm bag, 19 cm under stang" fra animationen, så sidebilledet siger det samme overalt; (2) low bar ligger 6,4 cm under high bar (`S745-1280-lowbar-bund.png`, `S745-1280-highbar-bund.png`; stangens sted i squatmodellen, `src/embed/squatAnimation.js` og De tre løfts squat): Marc siger "et par cm", så flyt low bar op mod 2-3 cm, og lad stangens sted glide som et spektrum; (3) på 390 dækker forfra-feltet toppen af sidefiguren i squat, og teksten "19 cm under stang" er klippet i venstre kant (`A745-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`, placering af forfra-felt og albue-tekst); dødløftens lærred siger kun "sumo-stand" som mærke ved både 49 og 82 cm, hvor konventionel intet mærke har (`A745-1280-dl-semi-t0.png`; `src/embed/deadliftAnimation.js`): navngiv stedet på skalaen (konventionel, semi-sumo, sumo) også på lærredet.

# Rapport 745: løftefigurerne som de står nu, set med en coachs øjne

Bhishak, 30. sep. 2026. Kritiker; jeg har ikke rørt løftemodellen eller sitet. Kun syntetiske kroppe, ingen push, ingen merges.

## Gren

`kritik-745`, lavet med `git checkout -b kritik-745 main`. Commit 1: skærmbilleder og scripts. Commit 2: denne rapport (nyeste commit på grenen, se `git log`). Læst: Yantras nyeste rapport `docs/RAPPORT-ordre-738.md` (`entropi-loeftmodel-dhruva` main @ e73bfb3, hentet med `git archive` og `git show`), første linje af min egen seneste figur-kritik `docs/kritik-728/RAPPORT-728.md`, og Marcs læseside `LAES-MODELLER-3.html` (åbnet kun til læsning i headless Chrome).

## Hvad ændret

Ingen kode ændret (kritik). Jeg leverede skærmbilleder, scripts og denne dom. Headless Chrome, 390 (touch) og 1280 (mus), kun 127.0.0.1 og `file:`, 0 netkald, 130 billeder i `outputs/kritik-745/`, scripts `tur-745.mjs`, `figurer-745.mjs`, `squat-stang-745.mjs`, `laeseside-745.mjs`, `server-745.mjs`, `maaling-745.json`. Squat: low bar og high bar, bunden, sticking og lockout i De tre løft (`F745-`, `S745-`), og animationen med fem billeder pr. stang (`A745-`). Bænk: stille figurer (`T745-`), animationen med lille, middel og stor bue (fire billeder hver) og billedet med de tre buer. Dødløft: opstilling og lockout for konventionel, sumo 1,6 og sumo 2,0 gange skulderbredden, og animationen ved 32, 49, 65,6 og 82 cm. Marcs læseside: 15 billeder på både 390 og 1280, 0 px sidelæns, 0 JS-fejl, 0 netkald (`L745-*-laeseside.png`). Eneste JS-fejl i figurerne: en 404 på 390 (favicon).

## Testresultat

Ingen tests kørt; der er ingen kode at teste. Målt og set:

- **Bænk, stangen ved buens top med stablede led: holder.** Underarmen står lodret under stangen, stangen sidder ved buens top, og der ses nu kun én arm (Yantra 736 lukkede min dobbeltarm; `A745-1280-baenk-stor-t1.png`). Toppen kommer tættere på halsen for større bue: 21,1 / 19,1 / 16,8 cm fra skulderen for lille, middel og stor, og lænden løfter 7,3 / 9 / 10,6 cm. Ikke alle archer lige meget: ja. På 390 dækker forfra-feltet lidt af øvre ryg og stang, men ikke armen.
- **Squat, albuer under og bag stangen: holder i animationen, ikke i De tre løft.** Animationen viser fra siden en ring "albue 12 cm bag, 19 cm under stang" (low bar) og "albue 2 cm bag, 26 cm under stang" (high bar), og forfra "albue 19 cm under stang" (`A745-1280-squat-lowbar-t2.png`). Det er lukket siden 728. I De tre løft viser sidebilledet stadig kun bar-tekst og ingen albue.
- **Low bar kun et par cm under high bar: holder ikke.** Low bar står 5,3 cm under skulderen og high bar 1,1 cm over: 6,4 cm forskel, uændret siden 728.
- **Dødløft, skinnebenet helt frem til stangen: holder** i alle fodbredder (konventionel, semi-sumo, sumo), både i animationen og i De tre løft (skinnebenet rører stangen i start på `A745-1280-dl-konventionel-t0.png`, `F745-1280-dl-konv-opstilling.png`).
- **Dødløft, fodbredden er et spektrum: holder** i animationen: skyderen går 32 til 82 cm (måling: min 32, max 82, start 32) og er altid synlig. Lukket siden 728. I De tre løft går skyderen kun fra 1,6 til 2,0 gange skulderbredden, så semi-sumo vælges dér med stilknappen, ikke på skyderen.

## Hvad er næste

Yantra retter de tre punkter i første linje. Derudover, mindre: (a) i dødløftens animation er der stadig luft over hovedet i startbilledet, fordi rammen er hele banen til lockout (Yantras eget punkt 2 fra 738, uændret); (b) forfra-feltet i bænk på 390 kunne gøres mindre. Marc svarer stadig "modeller ok" eller "modeller ret: ..." på læsesiden. Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja, tre konkrete figurrettelser, og bænk og dødløft lever nu op til Marcs domme.

## Ærlige grænser

- Alt er set i headless Chrome på 390 og 1280, ikke på en rigtig telefon. Jeg har set stille billeder af animationerne (fire-fem tidspunkter pr. variant), ikke hele bevægelsen som film; et mellemrum mellem to billeder kunne skjule et hop.
- Tallene (6,4 cm, albuens afstand, fodbredder) er aflæst af figurernes egen tekst og af skyderen, ikke målt uafhængigt på pixels. Jeg har ikke set front- og safety bar, og squat er kun set med den balancerede krop.
- Jeg dømmer figurerne som tegning og mod Marcs domme, ikke om modellens kræfter er rigtige.

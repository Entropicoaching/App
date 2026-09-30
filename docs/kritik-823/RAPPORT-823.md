MMORPG-følelse: halvvejs. Rodet: ja (niveau-op-/klaret-kortet på 390 er værst; Min helt er blevet bedre). De tre vigtigste ting Ganita retter næste gang: (1) niveau-op og klaret er stadig to grønne kort oven på hinanden plus et tredje "Mere: Mølleren fortæller" (skærm: `E823-main-390-10-klaret-hel.png` og `E823-main-390-6-niveauop-hel.png`; fil: `.niveau-banner` i `src/spil.css` og `klaret-fortsaet` i `src/spil-app.js`: ét kort, "Næste opgave" som eneste store knap, "Mere" lukket og kun én gang); (2) styrke-pletterne fra ordre 803 er i main, men er ét 7 px gult punkt under fødderne: ingen 11-årig ser dem som "helten er stærkere", og Hjerte står på 1 (skærm: `E823-main-390-5-svar-650ms.png`, `E823-main-1280-5-svar-650ms.png`; fil: `styrkePletter` og `heltVoksPuls` i `src/spil-app.js`, `.helt-styrke-plet` i `src/spil.css`: gør dem 3-4 gange større og lad den nye plet ligge tydeligt på figuren, fx som stjerne på skjoldet; Hjerte-regnemåde er Marcs valg); (3) spilsprog og gamle ord er tilbage: "1 ny quest" på Min helt-knappen, "hele quest" under Hjerte og "Mål og regn om" under Hånd på helt-skærmen (skærm: `E823-main-390-8-helt-hel.png` og `E823-main-390-2-ny-foerste-hel.png`; fil: `src/spil-app.js` linje ca. 2976 og badgen "ny quest", `src/hjaelp.js`: skriv "opgave-række" i stedet for "quest" og "Måle og regn om" i stedet for "Mål").

## Hvad jeg har set på
- Spillet fra main (`7a2b5c4`, hentet med `git archive` til en midlertidig mappe; intet ændret). Nu med ordre 803 (styrke-pletter, "måle") og 797 ("Mere", udstyr bag lukket oversigt) i main.
- Ganitas to nyeste rapporter (803 og 797, "Hvad ændret" og "Hvad er næste") og første linje af min seneste matematik-kritik (817).
- Mit elev-script `docs/kritik-823/elev-823.mjs` (kopi af 817): syntetisk elev "Tulle", headless Chromium, 390 touch og 1280 mus, uret og tilfældighed låst, bevægelse tændt, intet net. Tre opgaver, niveau op, forløb klaret, Min helt, 60-opgavers simulering. Skærmbilleder og `elev-main.json` i `outputs/kritik-823/`.

## Dom
- Føles det som et MMORPG? Halvvejs. Det virker: stor niveau-tal, "+10 erfaring" i en grøn boks, "+1" på Hoved, træskjold og kappe ved niveau 3, en gul glød om figuren, og reglen "det betaler sig at være et godt menneske" holder (60 ærlige opgaver: niveau 15, Hoved 9, Hånd 7, 14 forløb mestret; en gætter: niveau 1, intet mestret, 325 erfaring). Det mangler: mellem niveauerne ændrer figuren sig knap. Pletten fra 803 er der, men er for lille til at blive set (på 390 er den et prik under foden). Tallet er stort, helten er ikke synligt stærkere pr. svar. Ikke Cookie Clicker, men ikke helt MMORPG.
- Rod: talt af mig i det synlige første skærmbillede på 390 (målt af scriptet som ting i skærmen, ca.-tal): forside med ny elev 8 ting og 4 knapper (2,6 skærmhøjder; kortet er det meste); efter tre opgaver 21 ting og 7 knapper; niveau-op 12 ting og 7 knapper (2,37 skærmhøjder); klaret 14 ting og 8 knapper (2,68 skærmhøjder, den højeste); Min helt 15 ting og 5 knapper (2,15, før 797: 2,83). De tre vigtigste skærme: klaret/niveau-op (to kort + "Mere" + "Næste opgave" + næste spørgsmål, alt på én side), forsiden efter et svar (figur, glød, "+10"-boks, tre tal, "Min helt"-knap, "1 ny quest", opgave, "Videre", kort) og Min helt. Klaret-skærmen konkurrerer mest om blikket. Ingen vandret rulning på 390 eller 1280.
- Forstår en 11-årig Hoved, Hånd og Hjerte første gang? Næsten. Første gang åbner forsiden et kort ("Hoved er at regne… Hånd er at måle og regne om, fx skridt til møllen. Hjerte er at hjælpe en person, fx Ane") med "Forstået". Det er godt og i børnehøjde. Under tallene står "regn / måle / hjælp", nu ens for Hånd (803 rettede "mål"). To svagheder: kortet forsvinder efter "Forstået" og "?" er lille, så barnet kan ikke let se det igen; og Min helt siger "Mål og regn om" og "Hjælp Ane med hele quest" (ordet "quest" er spilsprog, ikke klasseværelsessprog).
- Er mine seneste fund (817) lukket? Fund 1 (helten stærkere pr. "+N"): delvist, pletter er i main men usynligt små; Hjerte uændret. Fund 2 (niveau-op som ét kort): nej, uændret. Fund 3 (mål/måle, quest): "måle" lukket på tallene, "quest" og "Mål" på helt-skærmen åben.

## Hvad der virker
- Hoved/Hånd/Hjerte-kortet ved første besøg, tre tal med ét ord hver, "+10 erfaring"-boksen.
- 797 og 803 er ægte forbedringer: Min helt 2,83 -> 2,15 skærmhøjder, "Dit udstyr 1 af 9" lukket, "Gå til" bag "Mere: andre steder".
- Niveau-op giver en synlig ting (træskjold) og en titel (Lærling).

## Ikke set
- En rigtig 11-årig; alt er syntetisk elev i headless Chromium. Lyd og rigtig touch-føling er ikke prøvet.
- Om en 11-årig finder "Mere: andre steder" og "Dit udstyr" uden hjælp (små, ikke afprøvet).
- Om styrke-pletten popper (0,9 s) er ikke målt i film, kun set som stillbilleder; på 1280 er den et lille prik.
- Antal ting er talt af scriptet/mig fra billederne, ca.-tal. Scriptets klaret-billede er taget med "Mere: andre steder" åben.

## Hvad er næste
Ganita: de tre ovenfor, i den rækkefølge. Marcs valg: Hjerte af ærlig regning og ny figurgrafik pr. "+N". Har arbejdet betydning for Hara: nej.

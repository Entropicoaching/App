MMORPG-foelelse: halvvejs. Rodet: nej (opgaveskaermen 66 ord; Niveau op-siden er den travleste, men ikke rod). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15 og Hjerte staar paa 1 (fjortende gang aabent, Marcs valg: spoerg ham i dag) (skaerm: `elev-nu.json` under `m.390.sim.aerlig` og `E937-nu-390-9-aerlig-efter-60.png`; fil: Hoved-reglen og niveau-reglerne i `src/spil-app.js`; vis "Hoved er fuldt, nu vokser Haand" ved loftet); (2) Hoved/Haand/Hjerte-kasserne roerer sig stadig ikke ved et rigtigt svar: 2/1/1 ved 650 ms og slut, kun "+10 erfaring" og et guldskin om figuren (skaerm: `E937-nu-390-5-svar-650ms.png`; fil: egenskabs-kasserne og `voksTal` i `src/spil-app.js` og `src/spil.css`; lad den egenskab, opgaven traener, faa et synligt loeft/glimt i sin kasse ved hvert rigtigt svar); (3) "Ane" i Hjerte-forklaringen er en person, eleven ikke har mødt, og forklaringen af Hoved/Haand/Hjerte staar kun paa allerfoerste skaerm (skaerm: `E937-nu-390-2-ny-foerste.png` og `E937-nu-390-4-opgave.png`; fil: `#hhh-forklaring` i `src/spil-app.js`; skriv "Hjerte: hjaelp en i landsbyen, fx Ane, moellerens ven" og vis en kort linje under kassen, ogsaa efter "Forstaaet").

## 1. Hvad jeg goerte og maalte

Spillet hentet med `git archive main` fra `Desktop\matematik` (main = `ce55087`, Ganitas ordre 921) til en midlertidig mappe og koert lokalt, headless Chromium, uden net (0 netkald, 0 sidefejl, ingen vandret rulning). Mit elev-script (`docs/kritik-937/elev-937.mjs`, kopi af 930) med den syntetiske elev "Tulle": 390 touch og 1280 mus; en helt ny elev, tre-fire opgaver, et rigtigt svar fanget efter 150/650 ms/slut, spillet til Niveau op, Min helt, og 60 opgaver aerligt mod 60 gaet (kun 390). Laeste Ganitas to nyeste rapporter (916, 921: "Hvad aendret" og "Hvad er naeste") og foerste linje af kritik 930. Skaermbilleder og `elev-nu.json` i `outputs/kritik-937/` (`E937-nu-390-*`, `E937-nu-1280-*`).

Maalt (synlige ord / tal / knapper / skaermhoejder): 
- Ny elevs foerste skaerm: 390 104/19/7, 1,10 hoej; 1280 113/16/5, 1,24. 
- Opgaveskaerm: 390 66/21/7, 1,90; 1280 66/21/7, 2,06.
- Niveau op-siden: 390 101/9/8, 1,81; 1280 117/15/8, 2,16.
- Min helt: 390 139/15/5, 1,47 (130 ord i ro); 1280 205/23/9, 1,18.

## 2. Foeles det som et MMORPG? Halvvejs

Det der virker: "+10 erfaring" kommer som et stort groent tal ved figuren, figuren faar guldskin, erfaringstallet taeller op, "NIVEAU OP! Niveau 3 . Laerling" med et nyt traeskjold, som figuren faktisk baerer paa Min helt; Hoved-tallet taeller op i banneret (300 ms viser "nu 2", det ender paa 3). Hvor det stadig er halvt: (a) Hoved/Haand/Hjerte er de tal, der skulle goere helten staerkere, men de staar stille ved hvert svar og vokser kun ved niveau. Den 11-aarige ser erfaring vokse, ikke helten. (b) Loftet: 60 aerlige opgaver giver niveau 15 og 600 erfaring, men Hoved 9 fra opgave 40; Haand stiger 1 til 7, Hjerte 1. Tallet "holder op" uden forklaring, og det er der, det minder om Cookie Clicker (erfaringstal der vokser, en helt der ikke goer). (c) Hjerte, "det betaler sig at vaere et godt menneske", er 1 hele vejen; den 11-aarige ser aldrig hjaelp give noget stort. Gaetter mod aerlig: 60 gaet giver niveau 1, 325 erfaring, ingen fremgang (0 forloeb mestret) mod 14 aerligt; det er rigtigt: det betaler sig at vaere aerlig.

## 3. Rod

Opgaveskaermen paa 390: cirka 23 ting, der konkurrerer (figur, navn, niveau, to cirkler + hint, erfaring, tre kasser + "?", Min helt-bjaelken med "1 ny", moellerens kort med titel, stjerner, opgave, Broeker-chip, tre svar). 66 ord, roligt, svarene i en klar raekke; kortet ligger under kanten (1,9 skaerme), saa det ikke kaemper. Ny elev foerst: 1,1 skaerm, kun forklaring + foerste opgave; kortet venter (Ganitas 921 virker). Niveau op-siden er den travleste (banner, klaret-kort med figur, "Naeste hos ...", to knapper), 101 ord og 8 knapper mod 137 og 15 i 916; den er ryddelig at se paa, men paa 1280 er den 2,16 skaerme. Min helt er den laengste side paa 390 (ca. 24 blokke: figur, tre kasser, "Oev her", "Find en", Udstyr, to Rygsaekke-raekker, Titler); den 11-aarige naar aldrig ned til titler; og "Journalen"/"Questbogen" oeverst er to ekstra knapper, der ikke er forklaret. Marcs "stadig lidt rodet" rammer i dag mest Min helt og Niveau op paa 1280 (smal midtersoejle med meget tom flade, siden er alligevel hoej).

## 4. Forstaar en 11-aarig Hoved, Haand og Hjerte foerste gang? Halvt

Foerste skaerm forklarer dem nu i tre korte linjer ("Hoved er at regne...", "Haand er at maale...", "Hjerte er at hjaelpe en person, fx Ane, med alle hendes opgaver") og kasserne har et ord under sig hele tiden (regn/maale/hjaelpe): det er en klar forbedring siden 930 (fund 3 er delvis lukket). Men (a) "Ane" er ukendt for eleven og forklarer ikke, hvorfor det goer noget; (b) "maale" forstaar en 11-aarig som at *maale med lineal*, mens Haand ogsaa er skridt og maalestok; (c) forklaringen forsvinder ved "Forstaaet"/foerste svar, og efter det er det kun et lille "?" og ordet under kassen; (d) paa Min helt staar forklaringen bedre ("Hjaelp Ane med hele hendes opgave-raekke, saa vokser den"), men kasserne dér viser stadig kun "1" og en prik-raekke uden at sige, hvad der mangler til naeste.

## 5. Er mine seneste fund lukket? (930) og hvad jeg ikke kunne

- Fund 1, Hoved-loftet: aaben (Marcs valg, fjortende gang). 
- Fund 2, kasserne roerer sig ikke ved rigtigt svar: aaben (2/1/1 ved 150, 650 ms og slut; "+10 erfaring" og figurens glimt er nyt siden 930, "+N" staar nu over hovedet). 
- Fund 3, forklaringen: delvist lukket (ordene regn/maale/hjaelpe staar nu under kasserne hele tiden; Ane er stadig ukendt, og forklaringen er stadig kun paa foerste skaerm). 
- Nyt siden 930 (Ganitas 916/921, verificeret): stort Hoved-tal i banneret, "Naeste opgave" fjerner klaret-kortet, ny elev ser kun forklaring + foerste opgave (1,10 skaerme mod 2,03).
- Kunne ikke: scriptets "klaret"-maaling gav `false` paa begge bredder (scriptet naaede ikke klaret-kortet inden for 40 svar; jeg har kun set klaret-kortet inde i Niveau op-siden, `E937-nu-390-6-niveauop-300ms.png`), saa klaret-siden er ikke maalt for sig. Kun stillbilleder af animationer (150/300/650 ms); ikke set paa rigtige elever eller skole-pc. Skaermbillederne er kun set for 390 og et par af 1280; resten er maalt via scriptet.

Betydning for Hara: ingen.

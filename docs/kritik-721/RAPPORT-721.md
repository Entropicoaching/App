MMORPG-følelse: halvvejs. Rodet: ja (opgaveskærmen på 390 viser 12 tal og 9 knapper, men selve opgaven ligger først under kortet). De tre vigtigste ting Ganita retter næste gang: (1) opgaveskærmen viser kortet før opgaven (`M721-390-4-opgave.png`, `M721-390-5-svar-650ms.png`; rækkefølgen i `src/spil-app.js` og `src/spil.css`): en 11-årig, der trykker "Din opgave nu", skal se opgaven, ikke et helt kort først; læg opgavekortet øverst og kortet under; (2) niveau-banneret og klaret-kortet siger det samme to gange i træk (`M721-390-6-niveauop.png`, `M721-390-10-klaret.png`; `.niveau-banner` og `renderKlaret` i `src/spil-app.js`): "Niveau 3", "du mestrede Del ligeligt" og "Fedt!" står i banneret, og "Forløbet er klaret", "Niveau 3!" og bonus står lige under; slå dem til ét kort med ét tryk; (3) tallet vokser kun som lille tekst (`M721-390-5-svar-650ms.png`, `src/spil-app.js` svar-visning): svaret giver "Rigtigt!" i en grøn boks og "40 erfaring" i lille skrift, og helten på forsiden er stadig 96 px; lad "+40" stå stort ved helten og tælle op, og lad helten få en ny genstand ved niveau 3 til 8 (`src/helten.js`).

# Rapport 721: matematikspillet som det står nu, set med en 11-årigs og en lærers øjne

## Hvad ændret

Gren: `kritik-721` fra `main`. Ingen kode ændret, kun kritik. Jeg hentede spillet fra matematik-træets `main` (efter Ganitas 708) med `git archive` til en midlertidig mappe og spillede den syntetiske elev "Tulle" headless på 390 (touch) og 1280 (mus) med `outputs/kritik-721/mat-721.mjs`: ny elev, tre opgaver, niveau op (banneret), et klaret forløb og Min helt. Skærmbilleder og `mat-721.json` ligger i `outputs/kritik-721/` (`M721-390-*` og `M721-1280-*`). Commits: `dde9684c` (billeder og script) og denne rapport.

Ganitas 708 og 700 læst (Hvad ændret, Hvad er næste); min egen seneste matematik-kritik er 717.

## Svar på de fire spørgsmål

**1. Føles det som et MMORPG? Halvvejs.** Det virker: niveau-banneret er stort og grønt med "NIVEAU OP!" (`M721-390-6-niveauop.png`); Min helt har et stort "3" og en helt, der er større end på forsiden (`M721-390-8-helt-ro.png`); ærlig elev når niveau 15 på 60 opgaver, mens en elev, der gætter, stadig er niveau 1 med 0 mestrede forløb efter 60 opgaver (hoved 9 mod 1). Det betaler sig altså at regne ærligt. Det, der mangler, er øjeblikket: efter et rigtigt svar er der "Rigtigt!" i en flad grøn boks og "40 erfaring" i lille skrift ved en bjælke (`M721-390-5-svar-650ms.png`). Tallet ser ikke ud til at springe eller tælle op. Helten på forsiden er 96 px ved niveau 1 og kun lidt større senere, og ingen ny genstand dukker op mellem spring. Det ligner et regneark, der får farve, mere end en helt, der bliver stærkere.

**2. Hvor er der rod? Opgaveskærmen.** Synlige elementer i første skærmhøjde på 390 (målt i `mat-721.json`, ord / tal / knapper): ny elev 78 / 9 / 9; almindelig dag og opgave 49 / 12 / 9; niveau op 88 / 10 / 5; klaret 118 / 14 / 7; Min helt lige efter åbning 118 / 16 / 3, i hvile efter 3,5 s 117 / 7 / 3. Flest ting kæmper om blikket på opgaveskærmen og klaret-skærmen. På opgaveskærmen ser eleven navn, niveau, erfaring, tre tal, "?", tre knapper, "Din opgave nu", en indbyggertæller med otte prikker og et stort kort; selve opgaven står først under kortet, så skærmen er 2,2 skærmhøjder høj (`M721-390-3-kort-hel.png`). På 1280 er det samme, blot bredere (12 tal, 9 knapper). Ingen vandret rulning på nogen skærm.

**3. Forstår en 11-årig Hoved, Hånd og Hjerte første gang? Hoved ja, Hånd og Hjerte kun halvt.** Forklaringen kommer af sig selv første gang, med "Forstået" (`M721-390-2-ny-foerste.png`): "Hoved er at regne: dele, brøker og klokken" er klart. "Hånd er at bruge matematikken: mål og regn om i Grusgraven" nævner et låst sted, eleven ikke har hørt om. "Hjerte er at hjælpe andre" siger ikke hvem eller hvordan; på Min helt står "Du har ikke hjulpet nogen endnu", og mine 60 opgaver rørte aldrig Hjerte (det blev ved 1). Jeg kan derfor ikke sige, om "det betaler sig at være et godt menneske" kan ses, kun at det ikke ses ved ærlig regning alene.

**4. Er mine seneste fund lukket (kritik 717)?** Delvist. (a) Banner og klaret siger det samme: ikke lukket; 708 ryddede klaret-kortet (8 til 4 blokke), men banneret og klaret-kortet står stadig efter hinanden (`M721-390-6-niveauop.png`). (b) Hånd og Hjerte med ord, eleven ikke kender: ikke lukket; teksten står som før, og "Forstået"-kortet ligger stadig over "Din opgave nu". (c) Helten bliver kun større: delvist; forsiden vokser nu (96 px til 116 px ved niveau 15, ifølge 708), men der er stadig ingen ny tegnet ting mellem trinnene.

## Ærlige grænser og testresultat

- Ingen kode ændret, så ingen lint eller verify-scripts. Måling: `outputs/kritik-721/mat-721.json`, 0 netkald og 0 JS-fejl på 390 og 1280.
- Kun syntetisk elev, headless Chromium med låst ur og `Math.random`; jeg har ikke set en rigtig 11-årig spille. "Forstår en 11-årig" er min vurdering af teksten, ikke en test.
- Tælle-animationen vurderer jeg ud af tre billeder efter svaret (150, 650 og efter 1500 ms); en kort animation mellem billederne kan jeg have overset.
- Hjerte-vejen (at hjælpe en person) er ikke spillet; "godt menneske"-svaret bygger kun på ærlig mod gættende elev.
- Tal er talt på synlige tekstnoder i første skærmhøjde; klaret-skærmens tal (14) er første skærmhøjde, ikke hele siden.

## Hvad er næste

Ganita retter de tre ting i første linje: opgaven før kortet, banner og klaret som ét kort, og et stort +tal og en ny genstand ved svar og niveau. Dernæst Hånd og Hjerte med et eksempel fra Møllen i stedet for "Grusgraven". Jeg vurderer igen i næste kritik, og da også Hjerte-vejen.

## Betydning for Hara

Delmålet "Appen mærkbart bedre" (Coaching/matematik): rapporten peger på tre konkrete rettelser i matematikspillet, så det føles som et MMORPG og er mindre rodet i Marcs klasse; intet ændret i selve appen.

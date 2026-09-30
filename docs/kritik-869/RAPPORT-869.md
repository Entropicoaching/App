Klar til klassen: ja, paa telefon og computer (skak main 35c34da, inkl. ordre 850; ordre 858 ligger kun paa grenen ordre-858 og er ikke merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) i makker-partiet paa 360 x 560 (og 320 x 520) ligger valget af ur uden for vinduet i folden "Skakur og valg: intet ur" (skaerm: Spil, Mod en makker, `outputs/kritik-869/360x560-A1-makker-efter-valg.png`, urvalget y 636-688 af 560, foldens overskrift y ca. 525; fil: urvalget i Spil-panelet i `src/skak.template.html`; ordre 858 blok 2 goer uret til en synlig linje, saa merge den og maal igen; hovedet paa 148 px kraever fortsat Marcs ja); (2) i Laer skak springer braettet 9-28 px ned, naar eleven svarer rigtigt (360 x 560 trin 20: 207-487 foer, 235-515 efter; trin 23: 226-506 foer, 235-515 efter), fordi rosen og Videre kommer ind over braettet (skaerm: `outputs/kritik-869/360x560-I20-laer-loest.png`; fil: `src/laerskak.js` og `src/styles.css`; ordre 858 blok 1 skulle reservere pladsen, men er ikke merget, saa merge og maal igen); (3) efter Giv op er siden stadig 1838 px hoej paa 360 x 560, og Spil-panelet nederst viser Fortryd, Start forfra og Giv op, som ikke goer noget nyt, naar partiet er slut (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-869/360x560-E3-efter-giv-op-hel.png`; fil: `src/partitalui.js` og `src/styles.css`; skjul Fortryd/Giv op efter partiets slut og fold "Spil"-panelet sammen, saa siden bliver kortere; resultat og "Nyt parti" staar allerede ved braettet, saa det er ikke en blokering).

## Gren

`kritik-869` fra `main`. Skakken hentet med `git archive main` (35c34da) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560, 390 x 844 og mus paa 1280 x 800. Scripts genbrugt fra 863: `docs/kritik-869/elevtur-869.mjs`, `slut-869.mjs`, `ekstra-869.mjs`, `bund-869.mjs` (og `laes-log-869.mjs`, som goer loggen laesbar). Rygdata og skaermbilleder i `outputs/kritik-869/` (`*.log` er scriptenes maal). Laest: RAPPORT-850 og RAPPORT-845 (de to nyeste paa main, "Hvad aendret" og "Hvad er naeste"), ranglisten i MOD-LICHESS og foerste linje af kritik 863. Nyt siden 863: ordre 850 er merget paa main.

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det, der er leveret, er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet y=148-452 i parti mod computeren, makker-parti med ur, gaade (198-478) og Laer skak trin 1 (207-487). Fortryd / Vis et hint / Giv op ligger 459-503, i vinduet. I makker-partiet kommer der to urknapper "Hvid" og "Sort" (459-503), naar uret er valgt. Paa 320 x 520 er braettet 148-412 og knapperne 419-463, ogsaa i vinduet. Paa 390 x 844 er baade braet (228-602) og urvalg (771-823) i vinduet. Paa 1280 x 800 er braettet 140-617 (var 140-677 foer ordre 850) og Spil-panelet med ur staar til hoejre (urvalget 400-448). Laer skak trin 20 og 23 efter rigtigt svar: Videre 164-208, "Rigtigt! Springeren peger mod midten." er een linje. Gaaden viser "Find det bedste traek." og "Vis et hint" 483-527 paa 360 x 560. Ingen sidescroll. Eleven ser altid braettet og den knap, der skal trykkes paa; det eneste, eleven selv skal opdage, er at uret skal vaelges i en fold (fund 1).

### Hvad er stadig besvaerligt eller rodet paa lav telefon

- Hovedet 148 px paa 320-360: titel, to raekker faner og linket "Undervisning". Braettet er 264 px paa 320 og 304 px paa 360 (uaendret; kraever Marcs ja).
- Uret i makker-partiet er gemt i folden "Skakur og valg: intet ur" (urvalget y 596-648 paa 320 x 520, 636-688 paa 360 x 560, begge uden for vinduet). Overskriften er synlig, men et barn skal selv taenke paa at trykke paa den.
- Laer skak: braettet hopper 9-28 px ned ved rigtigt svar (fund 2).
- Efter Giv op er siden 1838 px paa 360 x 560 (1296 paa 1280): meget scroll; Fortryd/Giv op staar stadig i panelet (fund 3).
- 1280 x 800 er bedre: raekken "Hvad spiller man her? / traekknapper" er y 675-719 og "Vend braettet / Tavle / Pile og streger / Hvad sker der" y 727-771, begge nu i vinduet (var 787-831). Siden er dog stadig 1436 px hoej, og braettet er blevet mindre (477 px mod 537).

### Er mine seneste fund lukket?

Fundene fra 863: (1) hoved 148 px og ur i fold: **aaben** (urvalget som synlig linje ligger paa ordre-858, ikke paa main). (2) Knaprakken paa 1280 x 800: **lukket** af ordre 850 blok 2 (nu 675-771 af 800; prisen er et mindre braet, 477 px). (3) Laer skak-hop: **aabent** (samme tal som i 863; ordre 858 blok 1 er ikke merget). Fra 852: Giv op-siden er fortsat lukket ("Laer af dine fejl" staar ikke to gange, og den tomme overskrift "Tre steder hvor partiet vendte" er vaek i mit parti; mit parti var Giv op efter fire traek, saa listen er tom med rette; siden er dog stadig 1838 px). Intet er gaaet i stykker.

## Testresultat

Ingen npm test (skakken er ikke min). Maalescripts: `node docs/kritik-869/elevtur-869.mjs <mappe>`, `slut-869.mjs`, `ekstra-869.mjs`, `bund-869.mjs`; alle koerte til ende, men nogle klik fejlede paa 1280 (se graenser). `bund-869.mjs` gav kun sidehoejde 1264 uden knapmaal (scriptets selector passer ikke laengere).

## Hvad er naeste

Merge ordre 858 (uret som synlig linje, Laer skak-braettet staar stille) og maal 360 x 560 igen; saa fold siden efter Giv op sammen og skjul Fortryd/Giv op, naar partiet er slut.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Jeg har ikke koert ordre-858-grenen (ordren siger main). Paa 1280 fejlede scriptets klik paa "Giv op", "Vis et hint" og paa foldens knap (elementerne er skjult paa computer, hvor knapperne ligger i Spil-panelet), saa hint og Giv op paa 1280 er kun set paa skaermbillederne `H1`/`H2`, ikke maalt; 1280-tallene for "Vend braettet"-raekken kommer fra `ekstra.log`. Gaade efter loest traek og et helt parti er ikke maalt (tilfaeldigt). Sidehoejde svinger med computerens traek. Kun syntetiske data. Betydning for Hara: ingen; ingen skrivning, ingen miljoevariabler roert.

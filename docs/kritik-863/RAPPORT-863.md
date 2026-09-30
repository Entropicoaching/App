Klar til klassen: ja, paa telefon og computer (skak main ddf5eac, uaendret siden kritik 857; Chaturangas ordre 850 ligger paa grenen ordre-850 og er ikke merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet fylder stadig 148 px paa 320-360, saa braettet kun er 264-304 px bredt, og i makker-partiet ligger urvalget (5+0 osv.) uden for vinduet i folden "Skakur og valg: intet ur" (skaerm: Spil, Mod en makker, `outputs/kritik-863/360x560-A1-makker-efter-valg.png`, urvalget y 636-688 af 560; fil: hoved-markup i `src/skak.template.html` og urvalget i Spil-panelet; hovedet kraever Marcs ja til nye fanenavne, men urvalget kan vaere en synlig linje uden Marcs ja); (2) paa 1280 x 800 ligger raekken "Vend braettet / Tavle / Pile og streger / Hvad sker der" stadig under vindueskanten (y 787-831 af 800) og siden er 1436 px hoej (skaerm: `outputs/kritik-863/1280x800-B1-computer-traek.png`; fil: braetraekkens CSS i `src/styles.css`; ordre 850 blok 2 goer braettet 19rem paa computer, men er ikke merget, saa merge den foerst og maal igen); (3) i Laer skak springer braettet 9-28 px ned, naar eleven svarer rigtigt (360 x 560 trin 20: 207-487 foer, 235-515 efter; trin 23: 226-506 foer, 235-515 efter), fordi rosen og Videre kommer ind over braettet (skaerm: `outputs/kritik-863/360x560-I20-laer-loest.png`; fil: `src/laerskak.js` og `src/styles.css`; reserver pladsen til rosen, saa braettet staar fast).

## Gren

`kritik-863` fra `main`. Skakken hentet med `git archive main` (ddf5eac) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560, 390 x 844 og mus paa 1280 x 800. Scripts genbrugt fra 857: `docs/kritik-863/elevtur-863.mjs`, `slut-863.mjs`, `ekstra-863.mjs`, `bund-863.mjs`. Rygdata og skaermbilleder i `outputs/kritik-863/` (`*.log` er scriptenes maal). Laest: RAPPORT-845 og RAPPORT-839 ("Hvad aendret" og "Hvad er naeste"), ranglisten i MOD-LICHESS og foerste linje af kritik 857. Vigtigt: siden 857 er der ikke merget noget i skak main; de to nyeste rapporter paa main er stadig 845 og 839. Alle tal er identiske med 857.

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det, der er leveret, er dommen og maalingerne: skak main er uaendret siden kritik 857, og alle maal er identiske.

### Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet fra y=148 til 452 i parti mod computeren, makker-parti med ur, gaade og Laer skak trin 1; Fortryd / Vis et hint / Giv op ligger ca. 459-527 (i vinduet). I makker-partiet kommer der to urknapper "Hvid" og "Sort" (459-503) efter valg af 5+0. Laer skak trin 20 og 23 efter rigtigt svar: braettet 235-499 paa 320 x 520 og 235-515 paa 360 x 560, Videre 164-208, "Rigtigt! ..." er een linje. Paa 1280 x 800 er braettet 140-677 og Spil-panelet med ur staar til hoejre (urvalget 400-448). Ingen sidescroll paa nogen bredde. Eleven ser altid braettet og den knap, der skal trykkes paa; det eneste, eleven skal vide selv, er at uret skal vaelges.

### Hvad er stadig besvaerligt eller rodet paa lav telefon

- Hovedet 148 px paa 320-360: titel, to raekker faner og linket "Undervisning". Braettet er 264 px paa 320 og 304 px paa 360.
- Uret i makker-partiet: urvalget er y 596-648 paa 320 x 520 og 636-688 paa 360 x 560, gemt i folden "Skakur og valg". Et barn, der skal spille med ur, skal selv finde folden. Paa 390 x 844 er valget i vinduet (746-798).
- Efter Giv op er siden 1838 px paa 360 x 560 (1296 paa 1280): meget scroll, men resultat og "Nyt parti" staar ved braettet.
- Laer skak: braettet hopper 9-28 px ned ved rigtigt svar (fund 3).
- 1280 x 800: knaprakken 787-831 er uden for vinduet; siden er 1436 px hoej.
- Gaaden: "Vis et hint" 483-527 paa 360 x 560, i vinduet; "Vend braettet" og Tegn 566-610 er under kanten, men er ikke noedvendige for en elev.

### Er mine seneste fund lukket?

Fundene fra 857: (1) hoved 148 px og ur i fold: **aaben** (kraever Marcs ja til fanenavne; urvalget som synlig linje kraever ikke ja). (2) Knaprakken paa 1280 x 800: **aaben paa main**; ordre 850 blok 2 (19rem-braet) skulle lukke den, men ligger kun paa `ordre-850`, saa jeg har ikke kunnet bekraefte det. (3) Laer skak-hop: **aabent** (9-28 px, uaendret maal). Fra 852 er Giv op-siden fortsat **lukket** (1838 px, ingen dobbelt knap). Ordre 850 blok 1 (Laer af dine fejl en gang) er heller ikke paa main. Intet er gaaet i stykker; intet nyt er lukket, fordi intet er merget.

## Testresultat

Ingen npm test (skakken er ikke min). Maalescripts: `node docs/kritik-863/elevtur-863.mjs <mappe>`, `slut-863.mjs`, `ekstra-863.mjs`; alle tre koerte til ende, men to klik fejlede (se graenser).

## Hvad er naeste

Merge ordre 850 og maal 1280 x 800 og Giv op igen; saa laeg urvalget som synlig linje og reserver rosepladsen i Laer skak.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Jeg har ikke koert ordre-850-grenen (ordren siger main). Scriptets klik paa "Vis et hint" efter et makker-parti og paa Mod computeren fejlede paa 1280, saa hint og Giv op mod computeren paa 1280 er set paa skaermbilleder fra 857-scriptet. Gaade efter loest traek og et helt parti er ikke maalt (tilfaeldigt). Sidehoejde svinger med computerens traek. Kun syntetiske data. Betydning for Hara: ingen; ingen skrivning, ingen miljoevariabler roert.

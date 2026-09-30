Klar til klassen: ja, paa telefon og computer (skak main 142c666, inkl. ordre 850 og 858). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px paa en lav telefon goer braettet lille: 248 px paa 320 x 520 og 288 px paa 360 x 560, altsaa felter paa 31-36 px, under en fingers 44 px (skaerm: Spil, Mod en makker, 360 x 560, `outputs/kritik-875/360x560-A3-efter-2-traek.png`, braettet y 148-436 og hovedet y 0-148; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever fortsat Marcs ja til nye navne, saa spoerg ham); (2) paa 1280 x 800 skubbes knaprakken under braettet ned, naar aabningens navn dukker op efter foerste traek: "Brikker og farver" staar alene paa en tredje raekke og er halvt uden for vinduet (y ca. 775-815 af 800) (skaerm: Spil, Mod en makker, e4 e5, `outputs/kritik-875/1280x800-H2-computer-hint.png`, navnet "Kongebondeparti" foran raekken; fil: raekken "Hvad spiller man her? / Vend braettet / Tavle / Pile og streger / Hvad sker der / Brikker og farver" i `src/styles.css`; goer den to raekker, ogsaa naar navnet er der, eller reserver navnets plads); (3) efter Giv op er siden stadig 1838 px hoej paa 360 x 560 (1296 paa 1280), og Spil-panelet nederst viser Fortryd, Start forfra og Giv op, som ikke goer noget nyt efter partiets slut (skaerm: Spil, Mod computeren, Giv op, `outputs/kritik-875/360x560-E3-efter-giv-op-hel.png`; fil: `src/partitalui.js` og `src/styles.css`; skjul Fortryd/Giv op naar partiet er slut og fold panelet sammen; resultat og "Nyt parti" staar allerede ved braettet, saa det er ikke en blokering).

## Gren

`kritik-875` fra `main`. Skakken hentet med `git archive main` (142c666) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560, 390 x 844 og mus paa 1280 x 800. Scripts genbrugt fra 869: `docs/kritik-875/elevtur-875.mjs`, `slut-875.mjs`, `ekstra-875.mjs`, `bund-875.mjs` (og `laes-log-875.mjs`). Rygdata (`*.log`) og skaermbilleder i `outputs/kritik-875/`. Laest: RAPPORT-858 og RAPPORT-850 ("Hvad aendret" og "Hvad er naeste"), ranglisten i MOD-LICHESS og foerste linje af min kritik 869. Nyt siden 869: ordre 858 er merget paa main.

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det, der er leveret, er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet y 148-452 mod computeren (Fortryd / Hint / Giv op 459-503, i vinduet), 148-436 i makker-partiet, 198-478 i gaaden og 235-515 i Laer skak. Uret i makker-partiet er nu en synlig linje lige under braettet: "Hvid 5:00 / Fortryd / Giv op / Sort 5:00" y 443-487, og urvalget "Intet 3+0 4+0 5+0 10+0 5+3 Frit" y 490-542 af 560; paa 320 x 520 er linjerne 403-447 og 450-502 af 520. Eleven behoever ikke aabne en fold. Paa 390 x 844 er alt i vinduet (braet 228-602, ur 609-653, urvalg 656-708). Gaade: "Find det bedste traek." og "Vis et hint" 484-528 paa 360 x 560, 468-512 af 520 paa 320 (taet, men i vinduet). Laer skak trin 20 og 23 efter rigtigt svar: "Rigtigt! Springeren peger mod midten." er een linje, "Videre" 164-208, og braettet staar stille. Ingen sidescroll. Eleven ser altid braettet og den knap, der skal trykkes paa. Efter Giv op staar "Gennemse partiet", "Nyt parti" og "Proev niveau 1 igen" lige under braettet, saa der er en tydelig vej videre.

### Hvad er stadig besvaerligt eller rodet paa lav telefon

- Hovedet 148 px (titel, to raekker faner, linket "Undervisning") giver et lille braet: 248 px paa 320 og 288 px paa 360 (var 300 og 340 foer 858, fordi uret nu ligger under braettet; 52 px pris). Felter paa 31-36 px er svaere at ramme for 11-aarige fingre.
- Efter Giv op er siden 1838 px paa 360 x 560, med et Spil-panel med Fortryd/Start forfra/Giv op, en graf, "Lettisk gambit" og flere folde. Meget scroll for et barn, men ikke en blokering.
- Laer skak efter rigtigt svar: den anden knap er afkortet ("Traen mere: Udvikl brik..."), og teksten kan ikke laeses helt paa 360.
- Paa 1280 x 800 (mus): braettet er 477 px, siden 1436 px hoej; efter foerste traek kommer aabningsnavnet ("Kongebondeparti") og skubber knaprakken ca. 27 px ned, saa "Brikker og farver" halvt forsvinder nederst.

### Er mine seneste fund lukket?

Fundene fra 869: (1) ur i fold paa lav telefon: **lukket** af ordre 858 blok 2 (urvalget 636-688 uden for vinduet foer, nu 490-542 af 560 og 450-502 af 520; prisen er et mindre braet). Hovedet paa 148 px: **aabent** (Marcs ja mangler; fundet er nu nr. 1). (2) Laer skak-braettet der hoppede 9-28 px: **lukket** af ordre 858 blok 1 (braettet 235-515 baade foer og efter rigtigt svar paa 360 x 560, 235-499 paa 320, trin 20 og 23). (3) Sidehoejden efter Giv op og de doede knapper: **aaben** (samme 1838 px). Intet er gaaet i stykker.

## Testresultat

Ingen npm test (skakken er ikke min). Maalescripts: `node docs/kritik-875/elevtur-875.mjs <mappe>`, `slut-875.mjs`, `ekstra-875.mjs`, `bund-875.mjs` (alle koerte til ende). `bund-875.mjs` giver kun sidehoejde 1264 uden knapmaal (selectoren passer ikke laengere; ikke rettet, det er kun et hjaelpescript).

## Hvad er naeste

Chaturanga: (1) faa Marcs ja til et lavere hoved paa 320-360 (evt. faner paa een raekke), saa braettet naar mindst 320 px paa 360 bredde; (2) hold knaprakken under braettet paa 1280 inde i vinduet, ogsaa naar aabningsnavnet staar der; (3) skjul Fortryd/Giv op og fold Spil-panelet sammen, naar partiet er slut. Saa maal 360 x 560 og 1280 x 800 igen. Ellers er skakken klar; laereren boer dog vide, at makker-braettet er lille paa en 320-telefon.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Paa 1280 fejlede scriptets klik paa "Giv op", "Vis et hint" og "Mod computeren" (elementerne er skjult paa computer, hvor knapperne ligger i sidepanelet), saa hint og Giv op paa 1280 er kun set paa skaermbillederne, ikke maalt; "Brikker og farver"-placeringen er aflaest paa skaermbilledet, ikke maalt. Gaade efter loest traek og et helt parti er ikke maalt. Sidehoejde svinger med computerens traek. Afleveringsscriptet `hoest.mjs` blev afvist af tilladelsessystemet og er ikke koert; rapporten er committet, men ikke afleveret til Hara. Kun syntetiske data. Betydning for Hara: ingen skrivning, ingen miljoevariabler roert; afleveringen mangler.

Klar til klassen: ja, paa telefon og computer (skak main 83dd032, inkl. ordre 850, 858 og 866). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px paa en lav telefon goer braettet lille: 248 px paa 320 x 520 og 288 px paa 360 x 560, altsaa felter paa 31-36 px, under en fingers 44 px (skaerm: Spil, Mod en makker, 360 x 560, `outputs/kritik-880/360x560-A3-efter-2-traek.png`, braettet y 148-436, hovedet y 0-148; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever fortsat Marcs ja til nye navne, saa spoerg ham); (2) paa 1280 x 800 staar "Brikker og farver" alene paa en tredje raekke, halvt uden for vinduet (y ca. 775-815 af 800), saa snart aabningens navn ("Kongebondeparti") staar over raekken efter foerste traek (skaerm: Spil, Mod en makker, e4 e5, `outputs/kritik-880/1280x800-H2-computer-hint.png`; fil: raekken "Vend braettet / Tavle / Pile og streger / Hvad sker der / Brikker og farver" i `src/styles.css`; goer den til to raekker eller reserver navnets plads); (3) efter Giv op er siden stadig 1827 px hoej paa 360 x 560 (1296 paa 1280): efter Fortryd og Start forfra kommer Traekliste, "Laer af dine fejl"-tekst, Oev en aabning, Koordinater, Avanceret og Del (skaerm: Spil, Mod computeren, Giv op, `outputs/kritik-880/360x560-E3-efter-giv-op-hel.png`; fil: `src/partitalui.js` og `src/styles.css`; fold panelet "Spil" og "Traekliste / Oev en aabning / Koordinater" sammen efter partiets slut, som ordre 866 selv skriver som naeste skridt; resultat og "Nyt parti" staar allerede ved braettet, saa det er ikke en blokering).

## Gren

`kritik-880` fra `main`. Skakken hentet med `git archive main` (83dd032) til en midlertidig mappe (slettet bagefter) og koert headless (Playwright): touch paa 320 x 520, 360 x 560, 390 x 844 og mus paa 1280 x 800. Scripts genbrugt fra 875: `docs/kritik-880/elevtur-880.mjs`, `slut-880.mjs`, `ekstra-880.mjs`, `laes-log-880.mjs`. Rygdata (`*.log`) og skaermbilleder i `outputs/kritik-880/`. Laest: RAPPORT-866 og RAPPORT-858 ("Hvad aendret" og "Hvad er naeste"), ranglisten i MOD-LICHESS og foerste linje af min kritik 875. Nyt siden 875: ordre 866 er merget (Giv op-siden og Laer skak trin 32).

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det, der er leveret, er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet y 148-452 mod computeren (Fortryd / Hint / Giv op 459-503, i vinduet), 148-436 i makker-partiet (uret "Hvid 5:00 / Fortryd / Giv op / Sort 4:59" 443-487 og urvalget 490-542 af 560), 198-478 i gaaden ("Vis et hint" 484-528) og 235-515 i Laer skak. Paa 320 x 520: braet 148-396 (makker, ur 403-447, urvalg 450-502), 148-412 (computer, knapper 419-463), gaade 198-462 med hint 468-512, Laer skak 235-499. Paa 390 x 844 er alt i vinduet (braet 228-602, ur 609-653). Laer skak trin 20 og 23: "Rigtigt! ..." er een linje, "Videre" 164-208, og braettet staar stille (235-515 baade foer og efter). Ingen sidescroll. Paa 1280 x 800 staar braettet 140-617 (makker) med uret og knapperne i sidepanelet til hoejre, i vinduet. Eleven ser altid braettet og den knap, der skal trykkes paa. Efter Giv op staar "Gennemse partiet", "Nyt parti" og "Traen ..." lige under braettet, og Hint og Giv op er nu skjult (det var mit fund 3 fra 875).

### Hvad er stadig besvaerligt eller rodet paa lav telefon

- Hovedet 148 px (titel, to raekker faner, linket "Undervisning") giver et lille braet: 248 px paa 320 og 288 px paa 360 (felter 31-36 px). Uret ligger nu synligt, men prisen er et mindre braet.
- Efter Giv op er siden 1827 px paa 360 x 560. Det er meget scroll for et barn, men der er en tydelig vej videre oeverst, saa det er ikke en blokering.
- Paa 1280 x 800: "Brikker og farver" glider halvt ud af vinduet, naar aabningsnavnet kommer.
- Laer skak efter rigtigt svar: den anden knap kan vaere afkortet ("Traen mere: ..."); ikke set forvaerret siden 875.

### Er mine seneste fund lukket?

Fundene fra 875: (1) hovedet paa 148 px: **aabent** (venter paa Marcs ja). (2) knaprakken paa 1280 skubbes ned af aabningsnavnet: **aaben** (samme 775-815 af 800). (3) Fortryd/Giv op efter Giv op og sidehoejden: **delvist lukket** af ordre 866 blok 1: Hint, Giv op og de to afkrydsninger er skjult efter partiets slut, og siden er 1827 mod 1838 foer; Fortryd og Start forfra staar (med vilje) og siden er stadig lang, saa resten er aaben. Laer skak trin 32 (866 blok 2) er ikke min sag, men trin 20 og 23 staar stille. Intet er gaaet i stykker.

## Testresultat

Ingen npm test (skakken er ikke min). Maalescripts `node docs/kritik-880/elevtur-880.mjs <mappe>`, `slut-880.mjs`, `ekstra-880.mjs` koerte til ende; logfiler `outputs/kritik-880/elevtur.log`, `slut.log`, `ekstra.log`.

## Hvad er naeste

Chaturanga: (1) faa Marcs ja til et lavere hoved paa 320-360 (evt. faner paa een raekke), saa braettet naar mindst 320 px paa 360 bredde; (2) hold knaprakken under braettet paa 1280 inde i vinduet, ogsaa naar aabningsnavnet staar der; (3) fold Spil-panelet og "Traekliste / Oev en aabning / Koordinater" sammen efter partiets slut, saa siden bliver under 1500 px. Saa maal 360 x 560 og 1280 x 800 igen. Ellers er skakken klar; laereren boer vide, at makker-braettet er lille paa en 320-telefon.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Paa 1280 x 800 fejlede scriptets klik paa "Giv op", "Ja, giv op", "Vis et hint" og "Mod computeren" (elementerne ligger i sidepanelet, ikke i strimlen), saa Giv op og hint paa 1280 er kun set paa skaermbillederne; "Brikker og farver"-placeringen er aflaest paa skaermbilledet, ikke maalt. Scriptet fandt heller ikke slutstrimlens elementer efter Giv op (`skjult`), saa slutsidens knapper er aflaest paa skaermbilledet. Gaade efter loest traek og et helt parti er ikke maalt. Sidehoejde svinger med computerens traek. Kun syntetiske data. Betydning for Hara: ingen skrivning, ingen miljoevariabler roert.

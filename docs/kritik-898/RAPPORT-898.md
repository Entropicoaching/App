Klar til klassen: ja (skak main 415fad9, uaendret siden min kritik 892; ordre 890 ligger endnu kun paa grenen ordre-890 og er ikke merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px goer stadig braettet lille paa lav telefon: felter paa 33 px paa 320 x 520 og 38 px paa 360 x 560, under en fingers 44 px (skaerm: Spil, Mod computeren, efter et traek, `outputs/kritik-898/360x560-B1-computer-traek.png`, braet y 148-452; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever Marcs ja til nye navne, saa spoerg ham); (2) merge ordre 890 til main: uden den er braettet paa 1280 x 800 kun 443 px og en gaade hvor sort traekker vender braettet uden forklaring paa telefon (skaerm: Gaader paa 360 x 560, `outputs/kritik-898/main-360x560-gaade-sort.png` mod `outputs/kritik-898/b890-360x560-gaade-sort.png`; fil: `src/styles.css`, `src/skak.template.html`, commits 42df801 og bfbcd0d); (3) statuslinjen paa 320 x 520 bryder stadig til to linjer med cirklen alene til venstre ("Computeren spillede d7-d5. / Din tur."), hvilket skubber braettet ned (skaerm: Spil, Mod computeren, `outputs/kritik-898/320x520-B1-computer-traek.png`; fil: `#status` i `src/styles.css` og `src/skak.template.html`; kortere tekst eller cirklen inde i teksten).

## Gren

`kritik-898` fra `main`. Skakken hentet med `git archive main` (415fad9) og, som ekstra, `git archive ordre-890` (bfbcd0d) til to midlertidige mapper og koert headless (Playwright): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800 (og 1280 x 720, 1366 x 768 til braetmaaling). Scripts i `docs/kritik-898/` (elevtur, slut, ekstra genbrugt fra 892; nyt: `nyt-898.mjs`, `maal-spil-898.mjs`). Skaermbilleder og logs i `outputs/kritik-898/`. Laest: Chaturangas to nyeste RAPPORT paa main (885, 879), ranglisten i `docs/MOD-LICHESS.md` og foerste linje af min kritik 892. Nyt siden 892: intet paa main; kun ordre 890 paa en gren (RAPPORT-890 laest som ekstra).

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det leverede er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp, og ser eleven altid braettet og det, der skal trykkes paa?

Ja. Spil: eleven vaelger "Mod computeren" eller "Mod en makker" og har straks braettet i vinduet (360 x 560: braet y 148-452 mod computeren, knapperne Fortryd / Hint / Giv op lige under; makker med ur: Hvid 5:00 / Fortryd / Giv op / Sort 5:00 i en raekke, `360x560-A3-efter-2-traek.png`). Statuslinjen siger hvem der skal traekke, og sidste traek er gult. Computerens traek staar i teksten. Gaader: "Find det bedste traek", "Hvid/Sort traekker" og Vis et hint staar inde i vinduet paa 360 x 560. Laer skak trin 1 forklarer felternes navne og beder om et klik paa e4, og "Videre" staar i vinduet. Paa 1280 er alt (braet, sidepanel med niveau, Fortryd, Hint, Giv op) inde i vinduet.

### Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Hovedet er 148 px, saa felterne er 33-38 px paa 320-360 (maalt i `maal-spil.log`). Uaendret siden 857; kraever Marcs ja.
- 320: statuslinjen bryder til to linjer efter computerens traek, og cirklen staar alene.
- Gaade hvor sort traekker (nu set, tidligere ikke): braettet vendes helt, saa tallene staar 1 oeverst og bogstaverne h til a fra venstre. Paa main staar kun "(sort nederst)" i statuslinjen; en 11-aarig kan godt undre sig over de omvendte bogstaver. Paa 1280 staar "vendt: sort nederst". Ordre 890 aendrer noten til "vendt: du er sort" (telefon) og "vendt, fordi du er sort" (computer), det er bedre, men ikke merget.
- Efter Giv op (360 x 560) er siden 1431 px hoej; Fortryd, Traekliste og Del ligger under vinduet som lukkede foldere. "Valg: Hvid, niveau 1" er en lukket folder ved bunden, saa en elev der vil skifte niveau skal vide at trykke paa den.

### Er mine seneste fund lukket?

Fra 892: nr. 1 (hovedet, 148 px): aabent, afventer Marc. Nr. 2 (1280 x 800): paa main aabent (443 px; 1280 x 720 363 px, 1366 x 768 411 px). Paa ordre-890-grenen delvist lukket: 460 px, 380 px og 428 px, altsaa 1 rem mere og ikke de ca. 480 jeg bad om; Chaturanga skriver at kun 19 px var ledige, og jeg har ikke genmaalt knaprakkens bund paa 890 (min maaling fandt ikke knappen), saa "knaprakken staar inde" er Chaturangas tal, ikke mit. Nr. 3 (statuslinjen paa 320): aabent paa main; 890 roerer den ikke. Fra 886: gaaden hvor sort traekker er nu set og forklaret paa 890, ikke paa main.

## Testresultat

Headless Chromium, ingen fejl i scriptene udover klik der ikke fandt elementer: 1280-scriptet fra 892 leder efter telefonens strimmel-id'er (`#strimmel-hint`, `#strimmel-giv-op`), som ikke findes paa computer, saa Giv op / hint paa 1280 er set paa skaermbillederne fra 892 (`1280x800-B1`, `-B2`), ikke klikket her. Skakkens egen `npm test` er ikke koert (ikke min opgave). Brikker og farver-knappens bund blev ikke fundet af `maal-spil-898.mjs`; braetmaalene er sikre, knapmaalet mangler.

## Hvad er naeste

Chaturanga: (1) faa Marcs ja til lavere hoved paa 320-360 (faner paa een raekke), det er den ene ting der goer braettet stort nok til fingre; (2) faa ordre 890 merget, og overvej ca. 480 px paa 1280 x 800; (3) kort statuslinjen paa 320 saa den holder sig paa een linje. Ellers er skakken klar til klassen. Laereren boer vide: makker-braettet er lille paa en 320-telefon, og en gaade som sort vender braettet (paa main med en kort note).

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Et helt parti til mat er ikke spillet (kun to traek mod computeren og en makker), Fortryd efter slut, Nyt parti-genvejen og en lektion ud over trin 1, 20 og 23 er ikke proevet i denne omgang. Gaade-retningen er tilfaeldig, saa hvilken skaerm der fik en sort-foerst gaade varierer (main 390 og 1280 x 720 fik en hvid-foerst gaade; 890 1280 x 800 ligeledes). Sidehoejden svinger med computerens traek. Kun syntetiske data; ingen rigtige navne. Betydning for Hara: ingen skrivning, ingen miljoevariabler roert.

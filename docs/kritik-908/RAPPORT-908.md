Klar til klassen: ja (skak main d02c009, inkl. ordre 896 og 902). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px goer stadig braettet lille paa lav telefon: 264 px paa 320 x 520 og 280 px paa 360 x 560, felter paa 33-35 px, under en fingers 44 px (skaerm: Spil, Mod en makker, 360 x 560, `outputs/kritik-908/360x560-A3-efter-2-traek.png`, braet y 148-436; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever Marcs ja til nye navne, saa spoerg ham); (2) paa 1280 x 800 staar knaprakken under braettet stadig rodet, saa snart aabningens navn er der: "Hvad sker der" er skaaret i kanten og "Brikker og farver" staar alene paa en anden linje helt nede ved vinduets bund, og "Giv op" staar alene under de tre andre knapper i sidepanelet (skaerm: Spil, Mod computeren, efter d4 d5, `outputs/kritik-908/1280x800-B1-computer-traek.png`; fil: raekken "Vend braettet / Tavle / Pile og streger / Hvad sker der / Brikker og farver" og knapraekken i `src/styles.css`; gor knapperne kortere eller lad dem ombryde i to ens linjer, og saet Giv op ved siden af Fortryd / Vis et hint / Start forfra); (3) efter Giv op staar siden 1282-1667 px hoej paa telefon, og der ligger to "Fortryd" (en lige under braettet og en ekstra paa y 856 paa 320, 879 paa 360, 1241 paa 390): den nederste er et dobbeltgaenger-tilbud, som en elev kan ramme ved at scrolle (skaerm: Spil, Mod computeren, efter Giv op, `outputs/kritik-908/320x520-M1-giv-op-resultat.png`; fil: `#slut-fortryd` og sidepanelets Fortryd i `src/skak.template.html` og `src/styles.css`; skjul den ene paa telefon).

## Gren

`kritik-908` fra `main`. Skakken hentet med `git archive --format=zip main` (d02c009) til en midlertidig mappe og koert headless (Playwright, Chromium): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts i `docs/kritik-908/`: `elevtur-908.mjs` og `nyt-908.mjs` (genbrugt fra 903: makker med ur, computer, hint, Laer skak fra "Jeg er ny", gaade, Giv op, sort-foerst gaade) og `proev-908.mjs` (nyt: Giv op paa alle fire stoerrelser inkl. 1280, Laer skak trin 1-14 paa alle fire). Logs og skaermbilleder i `outputs/kritik-908/`. Laest: Chaturangas to nyeste rapporter (902 og 896), ranglisten i `docs/MOD-LICHESS.md` og foerste linje af min kritik 903.

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det leverede er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp, og ser eleven altid braettet og det, der skal trykkes paa?

Ja. Paa 320, 360 og 390 staar braettet oeverst under statuslinjen ("Hvid traekker."), og Fortryd / Giv op (og Hint mod computeren) ligger lige under braettet, med skakuret (Hvid 5:00 / Sort 5:00) i samme raekke (`360x560-A3`). Paa 1280 staar braettet 460 px stort til venstre og valgene i sidepanelet. Computer-parti: efter d4 svarer computeren, og statuslinjen siger "Computeren spillede d7-d5. Din tur." Efter Giv op paa 1280 staar en tydelig boks "Du gav op mod niveau 1." med "Proev niveau 1 igen", "Fortryd", "Gennemse partiet" og "Nyt parti" (`1280x800-M1-giv-op-resultat.png`; Giv op paa 1280 er nu set, hullet fra 903 er lukket). Laer skak fra "Jeg er ny": "Trin 3 af 32, Dronningen ... Saml alle stjernerne", braettet fuldt synligt paa 320 (y 242-506) (`320x520-N3-laer.png`). Gaade: braettet fuldt synligt, "Vis et hint" under. En elev, der ikke har laest noget, kan trykke sig ind i alle fire flows.

### Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Hovedet paa 148 px (Skak + fem faner i to raekker + "Undervisning"): braettet er 264 px paa 320 og 280 px paa 360. Fuldt synligt, men smaa felter. Uaendret siden 880, venter paa Marcs ja.
- Statuslinjen efter computerens traek staar nu paa EN linje paa 320 ("Computeren spillede f7-f6. Din tur.", `320x520-K1-efter-4-klik.png`). Lukket.
- Laer skak paa 320: braettet er y 255-519 paa trin 8 ("Bonden slaar paa skraa"), altsaa 1 px fra vinduets bund; det holder, men der er ingen luft. Teksten over braettet skifter laengde, saa braettet hopper 12-20 px mellem trin (235 / 223 / 242 / 255).
- Efter Giv op er siden 1282 px (320), 1306 (360) og 1667 (390) hoej, og en ekstra "Fortryd" ligger langt nede (se dom, punkt 3).
- "Valg: Hvid, niveau 1" er en foldet boks under knapperne; eleven ser ikke niveauet uden at scrolle (ok, niveau 1 er standard).

### Er mine seneste fund lukket? (kritik 903)

1. Hovedet paa 148 px: nej, aabent (Marcs ja).
2. Knapraekken paa 1280 x 800: nej, aabent. Aabningsnavnet ("Dronningebondeparti") og "Hvad spiller man her?" tager stadig plads, "Hvad sker der" er skaaret, "Brikker og farver" faar egen linje nederst, og Giv op staar alene (`1280x800-B1`).
3. Statuslinjen paa 320: ja, lukket (ordre 896, een linje).

Fra 903's "proev naeste gang": Giv op paa 1280 er set og fungerer; Fortryd i resultatboksen (ordre 902) staar paa 1280 som knap i boksen (y 335) og er let at finde.

## Testresultat

Ingen test koert (kun kritik). Maalinger: `outputs/kritik-908/elevtur.log`, `nyt.log` og `proev.log`; skaermbilleder i samme mappe.

## Hvad er naeste

Chaturangas tre ting (se foerste linje): (1) hovedet paa lav telefon (Marcs ja), (2) knapraekken paa 1280 x 800, (3) dobbelt Fortryd efter Giv op paa telefon. Bhishak boer proeve naeste gang: et makker-parti hvor uret loeber ud, og Laer skak med rigtige tryk hele vejen (ikke "Spring over").

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern. Uret loeb ikke ud. Laer skak: trin 1-14 blev kun gennemgaaet ved at trykke "Spring dette trin over" (Videre-knappen er skjult, indtil opgaven loeses), saa jeg har set titler og braettets placering, ikke at trinnene kan loeses. Sort-foerst gaade er set paa 320 og 360 (fundet efter 6 og 5 forsoeg, "Sort traekker"), ikke paa 390 og 1280. Computerpartier kun spillet 2-4 klik. Leveringskommandoen (hoest.mjs --aflever) blev afvist af auto-tilladelsen, saa rapporten er committet men ikke leveret til Hara. Ingen elevdata, intet net, ingen push, ingen aendring af skakken.

Klar til klassen: ja (skak main a27aa08, inkl. ordre 890; Chaturangas nyeste rapport er 890). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px goer stadig braettet lille paa lav telefon: 248 px paa 320 x 520 og 288 px paa 360 x 560, felter paa 31-36 px, under en fingers 44 px (skaerm: Spil, Mod en makker, 360 x 560, `outputs/kritik-903/360x560-A3-efter-2-traek.png`, braet y 148-436; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever Marcs ja til nye navne, saa spoerg ham); (2) paa 1280 x 800 staar knaprakken stadig rodet, efter aabningens navn dukker op: "Brikker og farver" alene paa tredje linje i vinduets bund (y ca. 755-797 af 800), "Pile og streger: til" og "Hvad sker der" er skaaret af, og "Giv op" staar alene under de tre andre knapper i sidepanelet (skaerm: Spil, Mod computeren, efter d4 d5, `outputs/kritik-903/1280x800-B1-computer-traek.png`; fil: raekken "Vend braettet / Tavle / Pile og streger / Hvad sker der / Brikker og farver" og knapraekken i `src/styles.css`; gor knapperne kortere eller lad dem ombryde i to ens linjer, og saet Giv op ved siden af Fortryd / Vis et hint / Start forfra); (3) statuslinjen paa 320 x 520 bryder stadig til to linjer med den lille cirkel alene til venstre ("Computeren spillede g8-e7. / Din tur."), og det skubber braettet ned (skaerm: Spil, Mod computeren, efter et traek, `outputs/kritik-903/320x520-K1-efter-4-klik.png`; fil: `#status` i `src/styles.css` og `src/skak.template.html`; kortere tekst ("g8-e7. Din tur.") eller cirklen inde i teksten).

## Gren

`kritik-903` fra `main`. Skakken hentet med `git archive --format=zip main` (a27aa08) til en midlertidig mappe og koert headless (Playwright, Chromium): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts i `docs/kritik-903/`: `elevtur-903.mjs` (genbrugt fra 898: makker med ur, computer, hint, Laer skak fra "Jeg er ny", gaade), `nyt-903.mjs` (computer med fire klik, Giv op, sort-foerst gaade paa 320 og 360), `laes-log-903.mjs`. Logs og 35 skaermbilleder i `outputs/kritik-903/`. Laest: Chaturangas to nyeste rapporter (890 og 885), ranglisten i `docs/MOD-LICHESS.md` og foerste linje af min kritik 898.

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det leverede er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp, og ser eleven altid braettet og det, der skal trykkes paa?

Ja. Paa alle fire stoerrelser staar braettet oeverst ved siden af statuslinjen ("Hvid traekker."), og paa telefon ligger Fortryd / Giv op (og Hint mod computeren) lige under braettet, 44 px hoeje (`360x560-A3`, `360x560-B1`). Skakuret (Hvid 5:00 / Sort 4:59) staar i samme raekke som Fortryd og Giv op. "Giv op" spoerger foerst ("Giv op? Modstanderen vinder partiet."), med "Ja, giv op" og "Annuller" (`360x560-A4-giv-op.png`). Efter Giv op staar "Hvid gav op. Sort vinder.", "Gennemse partiet", "Nyt parti" og "Prov niveau 1 igen" lige under braettet uden at scrolle (`360x560-K2-efter-giv-op.png`; siden er 1307 px hoej paa 360 og 1287 paa 320, men det ligger under fold og er ikke en blokering). Laer skak fra "Jeg er ny": Trin 1 af 32 "Braettet ... Klik e4." med en groen cirkel paa e4, braettet y 235-515 (`360x560-C1-laer-ny.png`). Gaade: braettet er helt synligt og "Vis et hint" staar under (`320x520-K3-gaade-sort.png`). En elev, der ikke har laest noget, kan trykke sig ind i alle fire flows.

### Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Hovedet paa 148 px (Skak + fem faner i to raekker + "Undervisning"): braettet er 248 px paa 320 og 288 px paa 360, altsaa felter paa 31 og 36 px. Braettet er fuldt synligt, men en 11-aarig med store fingre rammer forkert felt af og til. Det er uaendret siden kritik 880 og venter paa Marcs ja.
- Statuslinjen paa 320 bryder til to linjer med cirklen hængende alene (`320x520-K1`), og braettet starter derfor paa y 148 ligegodt, men hovedet plus status fylder 148 + 40 px; intet er skjult, men det ser rodet ud.
- Paa 320 staar "Valg: Hvid, niveau 1" som foldet panel under knapraekken, og selve panelet er 253 px og ligger uden for vinduet (y 466-719 af 520): eleven ser ikke computer-niveauet uden at scrolle. Det er ok, fordi niveau 1 er standard.
- Laer skak paa 320: braettet starter paa y 235 (teksten oven over fylder 100 px), bunden af braettet er y 499 af 520, altsaa stadig inde (`320x520-I20` fra 898 er uaendret).

### Er mine seneste fund lukket? (kritik 898)

1. Hovedet paa 148 px: nej, aabent (venter paa Marcs ja).
2. Merge af ordre 890: ja, lukket. main er nu a27aa08. Braettet paa 1280 x 800 er 460 px (y 140-600), og den sorte gaade siger "Sort traekker / (vendt: du er sort)" paa 320 (`320x520-K3-gaade-sort.png`, taget ved foerste forsoeg) og paa 360 (`360x560-K3-gaade-sort.png`). Det er forstaaeligt for en 11-aarig; tallene 1-8 staar stadig oppefra og ned og bogstaverne h-a fra venstre, men noten forklarer det. Lukket.
3. Statuslinjen paa 320 bryder til to linjer: nej, aabent (nu "g8-e7", ellers samme form).

Nyt fund (ikke i 898): paa 1280 x 800 er raekken under braettet igen rodet, naar aabningens navn staar der ("Dronningebondeparti" + "Hvad spiller man her?"): "Brikker og farver" ombrydes til tredje linje (y ca. 755-797 af 800, bunden er 3 px fra vinduets kant) og to knapper er skaaret i teksten. Det er praecis Bhishaks punkt fra 880 og 892 i ny form: 890 gav 17 px mere til braettet, men naeste tekstlinje tog dem igen.

## Testresultat

Ingen test koert (kun kritik). Maalinger: `outputs/kritik-903/elevtur.log` og `nyt.log`. Bemaerk at et par mine selectors er telefon-specifikke (`#strimmel-*`) og viser "skjult" paa 1280; paa 1280 staar de samme knapper i sidepanelet (`1280x800-B1`), og mit Giv op-klik paa 1280 i `nyt-903.mjs` ramte ikke (selectoren), saa Giv op-flowet er kun set paa 320 og 360.

## Hvad er naeste

Chaturangas tre ting (se foerste linje): (1) hovedet paa lav telefon (Marcs ja), (2) knapraekken paa 1280 x 800, (3) statuslinjen paa 320 x 520. Ranglistens punkter #1 (gennemse partiet, nu "Gennemse partiet" efter Giv op) og #2 (aabningsnavne, nu "Dronningebondeparti") er set paa skaerm og fungerer. Bhishak boer proeve naeste gang: Giv op og Nyt parti paa 1280, Laer skak hele vejen gennem de 32 trin, og et makker-parti med ur der loeber ud.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern. Et computerparti blev kun spillet fire klik (e2-e4, g1-f3) paa hver stoerrelse; uret loeb ikke ud; Laer skak kun set paa trin 1; Giv op paa 1280 ikke set (selector). Sort-foerst gaade paa 390 og 1280 er ikke set denne gang, kun 320 og 360 (set paa 390 i kritik 898). Ingen elevdata, intet net, ingen push, ingen aendring af skakken.

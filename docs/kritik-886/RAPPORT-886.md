Klar til klassen: ja, paa telefon og computer (skak main 50e6aab, inkl. ordre 873 og 879). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px goer stadig braettet lille paa lav telefon: 248 px paa 320 x 520 og 288 px paa 360 x 560, felter paa 31-36 px, under en fingers 44 px (skaerm: Spil, Mod en makker, 360 x 560, `outputs/kritik-886/360x560-A3-efter-2-traek.png`, braettet y 148-436; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever Marcs ja til nye navne, saa spoerg ham); (2) paa 1280 x 800 bruger braettet kun 443 px (y 140-583) og lader ca. 200 px staa tomme under knaprakken, mens tabellen med niveau, knapper og Traekliste staar hoejre side (skaerm: Spil, Mod computeren, `outputs/kritik-886/1280x800-E3-efter-giv-op-hel.png`; fil: braetstoerrelsen for lave computerskaerme i `src/styles.css`, tilfoejet i ordre 873; nu hvor knaprakken er i vinduet (Brikker og farver y 737-781) kan braettet vokse til ca. 480 px, tjek at raekken stadig er inde) ; (3) Gaaden vender braettet, naar sort skal traekke: tal 1-8 staar oppefra og ned, bogstaverne h til a fra venstre (skaerm: Gaader, foerste gaade, 360 x 560, `outputs/kritik-886/360x560-D1-gaade.png`, "Sort traekker (sort nederst)"); en 11-aarig, der lige har laert "e4 = bogstav e, raekke 4" i Laer skak, kan blive forvirret; fil: gaadevisningen i `src/gaader.js` (eller hvor braettet vendes) og `src/styles.css`; giv den foerste gaade en hvid-til-traek-stilling, eller skriv "Braettet er vendt, fordi du er sort" over braettet).

## Gren

`kritik-886` fra `main`. Skakken hentet med `git archive main` (50e6aab; foerste forsoeg ramte 9f58ac7 lige foer ordre 879 blev merget, det blev forkastet og alt er koert om) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts genbrugt fra 880: `docs/kritik-886/elevtur-886.mjs`, `slut-886.mjs`, `ekstra-886.mjs`, `laes-log-886.mjs`. Logs og skaermbilleder i `outputs/kritik-886/`. Laest: RAPPORT-873 og RAPPORT-879 ("Hvad aendret" og "Hvad er naeste"), ranglisten i MOD-LICHESS og foerste linje af min kritik 880. Nyt siden 880: ordre 873 (braet 21 rem paa lav computer, fold efter slut) og 879 (siden kortere efter Giv op, "Traen"-knap) er merget.

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det, der er leveret, er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa Spil vaelger eleven "Mod computeren" eller "Mod en makker" og faar straks braettet: 360 x 560 braet y 148-452 mod computeren og 148-436 mod en makker, med Fortryd / Hint / Giv op (459-503) eller uret (443-487) helt inde i vinduet; 320 x 520 braet 148-412 og knapper 419-463; 390 x 844 braet 228-602, knapper 609-653; alle "iVindue". Statuslinjen siger hvem der skal traekke ("Computeren spillede d7-d5. Din tur."), og felterne der er traekket fra og til er farvet. Laer skak trin 1 viser en groen ring paa e4 og en kort tekst; braettet staar hele vejen (235-515 paa 360). Gaader viser braettet (198-478 paa 360) med "Vis et hint" under. Eleven ser altid braettet og det, der skal trykkes paa, paa alle tre telefoner.

### Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Hovedet (fane-raekkerne) er 148 px, saa braettet er 248 px paa 320 og 288 paa 360. Uaendret siden 857; kraever Marcs ja.
- Efter Giv op er siden nu 1431 px paa 360 x 560 (var 1568 foer ordre 879; maalet under 1500 er naaet). Braettet, resultatet, "Gennemse partiet", "Nyt parti" og "Proev niveau 1 igen" staar oeverst i vinduet. Fortryd, Start forfra, Traekliste, Oev en aabning, Koordinater og Del staar stadig under vinduet, men kun som lukkede foldere; ikke en blokering.
- Makker med ur paa 320: uret "Hvid 5:00 / Fortryd / Giv op / Sort 5:00" er i vinduet (403-447), men Skakur-valget (Intet, 3+0 ... Frit) og "Valg"-folderen ligger under vinduet (450 og nedefter). Det er i orden efter valget er truffet.
- Gaade som sort: braettet er vendt (se nr. 3 i dommen).
- 320-telefonen: makker-braettet er lille (248 px, felter paa 31 px).

### Er mine seneste fund lukket?

Fra 880: nr. 2 (Brikker og farver halvt uden for vinduet paa 1280 x 800) er lukket i 873: raekken staar nu inde i vinduet (y 693-781 af 800), og Kongebondeparti staar over den. Nr. 3 (siden 1827 px efter Giv op) er lukket i 879 og 873: 1431 paa 360 x 560, 1296 paa 1280 x 800 (maalt paa min main). "Traen mere"-knappen i Laer skak var klippet paa 320 og 360 (min note til 879); ordre 879 har rettet den til "Traen: ...", ikke selv genmaalt, da jeg kun spillede trin 1. Nr. 1 (hovedet) er aabent og afventer Marc. Prisen for 873's rettelse: braettet paa 1280 x 800 er 443 px og lader plads tilbage; se nr. 2 i dommen.

## Testresultat

Headless Chromium, ingen fejl i scriptets koersel udover de klik der ikke fandt sidepanelets elementer paa 1280 (se graenser). Ingen tests af skakkens egen `npm test` (ikke min opgave).

## Hvad er naeste

Chaturanga: (1) faa Marcs ja til lavere hoved paa 320-360; (2) lad braettet paa 1280 x 800 vokse lidt (443 til ca. 480 px), hvis knaprakken stadig er inde i vinduet; (3) gaadens vendte braet: en forklaring eller en hvid-foerst foerste gaade. Ellers er skakken klar; laereren boer vide, at makker-braettet er lille paa en 320-telefon og at gaader kan vende braettet.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Paa 1280 x 800 fandt scriptet ikke "Giv op", "Vis et hint" og "Ja, giv op" (elementerne ligger i sidepanelet, ikke i strimlen), saa 1280-skaermbilledet `E3-efter-giv-op-hel` er midt i partiet, ikke efter Giv op; sidehoejden 1296 paa 1280 er maalt paa det. Gaade efter loest traek, "Traen"-knappen paa trin 20 og et helt parti er ikke spillet. Sidehoejde svinger med computerens traek. Kun syntetiske data. Betydning for Hara: ingen skrivning, ingen miljoevariabler roert.

Klar til klassen: ja (skak main 415fad9, inkl. ordre 885). De tre vigtigste ting Chaturanga retter naeste gang: (1) hovedet paa 148 px goer stadig braettet lille paa lav telefon: 248 px paa 320 x 520 og 288 px paa 360 x 560, felter paa 31-36 px, under en fingers 44 px (skaerm: Spil, Mod en makker, 360 x 560, `outputs/kritik-892/360x560-A3-efter-2-traek.png`, braettet y 148-436; fil: hoved og faner i `src/styles.css` og `src/skak.template.html`; kraever Marcs ja til nye navne, saa spoerg ham); (2) paa 1280 x 800 er braettet stadig kun 443 px (y 140-583), og knaprakken under det ombrydes rodet: "Brikker og farver" staar alene paa en tredje linje, og i sidepanelet staar "Giv op" alene under Fortryd / Vis et hint / Start forfra (skaerm: Spil, Mod computeren, `outputs/kritik-892/1280x800-B1-computer-traek.png`; fil: braetstoerrelse og knaprakke for computerskaerme i `src/styles.css`; lad braettet vokse til ca. 480 px og hold raekken paa to linjer, eller saet Giv op ved siden af de tre andre); (3) statuslinjen paa 320 x 520 bryder til to linjer ("Computeren spillede d7-d5. / Din tur.") med den lille cirkel haengende alene til venstre under hovedet, og det skubber braettet ned (skaerm: Spil, Mod computeren, efter et traek, `outputs/kritik-892/320x520-B1-computer-traek.png`; fil: statuslinjen `#status` i `src/styles.css` og `src/skak.template.html`; kortere tekst ("d7-d5. Din tur.") eller cirklen inde i teksten).

## Gren

`kritik-892` fra `main`. Skakken hentet med `git archive main` (415fad9) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts genbrugt fra 886: `docs/kritik-892/elevtur-892.mjs`, `slut-892.mjs`, `ekstra-892.mjs`, `laes-log-892.mjs`. Logs og skaermbilleder (57 filer) i `outputs/kritik-892/`. Laest: RAPPORT-885 og RAPPORT-879 ("Hvad aendret" og "Hvad er naeste"), ranglisten i `docs/MOD-LICHESS.md` og foerste linje af min kritik 886. Nyt siden 886: kun ordre 885 (Start forfra skjules efter partiets slut paa telefon, knaprakken maalt inde i vinduet paa tre computerskaerme).

## Hvad aendret

Ingen aendring i skakken (kun kritik). Det, der er leveret, er dommen og maalingerne.

### Kan en 11-aarig komme i gang uden hjaelp, og ser eleven altid braettet og det, der skal trykkes paa?

Ja. Paa Spil vaelger eleven "Mod computeren" eller "Mod en makker" og faar straks braettet: 360 x 560 braet y 148-452 mod computeren og 148-436 mod en makker, med Fortryd / Hint / Giv op (459-503) eller uret Hvid 5:00 / Fortryd / Giv op / Sort 5:00 (443-487) helt inde i vinduet. 320 x 520: braet 148-412, knapper 419-463, ur 403-447. 390 x 844: braet 228-602, knapper 609-653. Paa 1280 x 800 staar braettet y 140-583 med Brikker og farver inde i vinduet. Statuslinjen siger hvem der skal traekke, og felterne der er traekket fra og til er farvet gule. Laer skak ("Jeg er ny") trin 1: lektionsteksten er oeverst, braettet y 235-515 paa 360 med en groen ring paa e4; efter rigtigt svar staar "Rigtigt! Det er e4: linje e, raekke 4." og en stor "Videre"-knap oeverst (164-208). Trin 20 og 23 er loest paa 320 og 360: braettet staar stille (235-499 / 235-515), besked og Videre kommer. Gaader: braettet y 198-478 paa 360 med "Vis et hint" (484-528) under; fem af fem scenarier havde braet og knap i vinduet paa alle tre telefoner (se `elevtur.log`).

### Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Hovedet (fane-raekkerne) er 148 px, saa braettet er 248 px paa 320 og 288 paa 360. Uaendret siden 857; kraever Marcs ja.
- Statuslinjen paa 320 bryder til to linjer og cirklen staar alene (se nr. 3 i dommen). Paa 360 og 390 er den paa een linje.
- Efter Giv op (360 x 560): braettet, "Gennemse partiet", "Nyt parti" og "Proev niveau 1 igen" staar oeverst, og "Start forfra" er nu skjult som 885 lovede. Sidehoejden er 1431 (samme som 886; 885 rykkede den ikke). Fortryd, Traekliste og Del ligger stadig under vinduet som lukkede foldere.
- Makker med ur paa 320: uret er i vinduet, men Skakur-valget og "Valg"-folderen ligger under vinduet (y 450+). Det er i orden efter valget.
- Computer paa 320-390: "Valg: Hvid, niveau 1"-folderen begynder ved y 466-506 og er delvist under vinduet (iVindue false); eleven ser den lukkede overskrift, og den kraever en scroll for at aendre niveau. Ok, men en 11-aarig der vil skifte niveau skal vide at trykke paa den.
- Paa 1280 x 800 er siden 1436 px hoej under et computerparti; Trækliste og Del kraever scroll.

### Er mine seneste fund lukket?

Fra 886: nr. 3 (gaaden vendte braettet, da sort skulle traekke, med tal oppefra og ned) er lukket for den foerste gaade: den er nu en stilling hvor hvid traekker ("Hvid traekker", tal 8 oeverst, 1 nederst, bogstaver a-h fra venstre; `360x560-D1-gaade.png`). Jeg har ikke spillet mig frem til en gaade hvor sort traekker, saa om andre gaader stadig vender braettet uden forklaring er ikke maalt. Nr. 2 (braettet paa 1280 x 800 paa 443 px) er aabent; 885 maalte kun knaprakken og aendrede intet, og braettet er stadig 443 (y 140-583). Nr. 1 (hovedet) er aabent og afventer Marc. Fra 885's eget punkt: Start forfra er vaek efter Giv op paa 360 (set paa `360x560-E2-efter-giv-op-top.png`), og "Nyt parti" staar ved braettet. Scriptet kunne ikke trykke "Start forfra" i partiet for at se den komme tilbage efter Nyt parti, og ikke genmaale Fortryd efter slut (se graenser). "Traen"-knappen paa trin 20 (879) er maalt: ingen klip paa 320 og 360 i `ekstra.log`.

## Testresultat

Headless Chromium, ingen fejl i scriptkoerslen udover klik der ikke fandt elementer: paa 1280 fandt scriptet ikke `#strimmel-giv-op`, `#strimmel-hint`, `#spil-valg-resume` (strimlen findes kun paa telefon; Giv op og Vis et hint ligger i sidepanelet med andre ids), og "Mod computeren"/"Start forfra"/"Vis et hint" blev ikke fundet i ekstra-scriptet paa en af visningerne. Ingen koersel af skakkens egen `npm test` (ikke min opgave).

## Hvad er naeste

Chaturanga: (1) faa Marcs ja til lavere hoved paa 320-360 (faner paa een raekke); (2) 1280 x 800: lad braettet vokse fra 443 til ca. 480 px og ret knapraekken saa "Brikker og farver" og "Giv op" ikke staar alene; (3) kort statuslinjen paa 320 saa den holder sig paa een linje. Ellers er skakken klar til klassen. Laereren boer vide: makker-braettet er lille paa en 320-telefon, og en gaade hvor sort traekker vender muligvis braettet (ikke genproevet).

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern; "en 11-aarigs oejne" er min tolkning. Et helt parti er ikke spillet, og makker-partiet er kun spillet to traek. Fortryd efter slut, Nyt parti-genvejen og en gaade som sort er ikke proevet; 1280-scripts mangler sidepanelets ids (Giv op, Vis et hint), saa 1280 efter Giv op er maalt paa sidehoejden (1296 fra 886-logikken, nu 1436 midt i partiet), ikke set paa skaermbillede. Sidehoejden svinger med computerens traek. Kun syntetiske data; ingen rigtige navne. Betydning for Hara: ingen skrivning, ingen miljoevariabler roert.

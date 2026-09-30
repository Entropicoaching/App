Klar til klassen: ja, på telefon og computer, men uret og "Giv op" er stadig gemt. De tre ting Chaturanga retter næste gang: (1) skakur-valget i et makker-parti ligger stadig 689-741 af 560 på 360 x 560 (799-851 af 844 på 390 x 844), altså under kanten, og intet på brættet siger at der findes et ur; et tryk på "5+0" uden at rulle først rammer ikke (skærm: Spil, Mod en makker, `360x560-A1-makker-efter-valg.png` og `360x560-S1-efter-ur-tryk.png`; fil: `#segment-skakur` og `#spil-valg-fold`, mobil-CSS i `src/styles.css`); (2) på 1280 x 800 ligger "Giv op" 802-846 af 800, altså lige under kanten, mens Fortryd, Hint og Start forfra ligger 750-794 (skærm: makker med ur, `1280x800-A3-efter-2-traek.png`; fil: Spil-panelet i `src/skak.template.html`, ur-tavlen og "Lyd ved tryk"-valget fylder pladsen); (3) efter et parti på 360 x 560 står "Tre steder hvor partiet vendte" stadig 513-557 af 560 (3 px fra kanten), og brættet er skrumpet fra 320 til 288 px (skærm: `360x560-M2-efter-mat.png`; fil: fold-reglen i `src/styles.css` og fold-overskriften i `src/skak.template.html`).

# Ordre 749, Bhishak, 30. sep. 2026

Skakken på `main` (`061a922`, hentet med `git archive` til en midlertidig mappe uden for repoet; skakens eget arbejdstræ har ucommittede ændringer, dem har jeg ikke set). Set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk browserprofil, headless, syntetiske træk. Gren `kritik-749`. Filer kun under `docs/kritik-749/` (scripts `elevtur2-749.mjs`, `elevtur3-749.mjs`, `slut-749.mjs`, `mat-749.mjs`) og `outputs/kritik-749/` (skærmbilleder og måletekst). Læst: Chaturangas to nyeste rapporter (735 og 739), `docs/MOD-LICHESS.md` (ranglisten efter 739) og første linje af min egen seneste skak-kritik (732).

## Kan en 11-årig komme i gang uden hjælp?

Ja. Et parti mod computeren: brættet står altid helt i vinduet (173-493 af 560), og Fortryd / Hint / Giv op ligger 500-544, lige under (`360x560-B1-computer-traek.png`, `360x560-B2-hint.png`). Makker-parti: spillet til skakmat med skolemat (e4 e5 Lc4 Sc6 Dh5 Sf6 Dxf7) på alle tre størrelser; status siger "Skakmat! Hvid vinder.", og "Gennemse partiet" og "Nyt parti" står 468-512 af 560 (390 x 844: 609-653; 1280 x 800: 385-429), helt inde (`360x560-M2-efter-mat.png`). Gåde: brættet 203-483 og "Vis et hint" 489-533 på 360 x 560; et forkert træk giver "Ikke den vej. Tag trækket tilbage og prøv igen." (`360x560-D1-gaade.png`, `360x560-E1-gaade-efter-traek.png`); på 390 x 844 kom teksten "Løsningen er vist - tag trækket tilbage" og knappen står 670-714 (inde). Lær skak, "Jeg er ny": teksten øverst (155-192), brættet 207-487 og "Klik e4" (`360x560-C1-laer-ny.png`, `360x560-E2-laer-trin1.png`). Ingen sidescroll og ingen sidefejl på nogen størrelse.

## Hvad er stadig besværligt eller rodet på lav telefon?

- Skakuret (fund 1): på 360 x 560 og 390 x 844 er valget 129 og 99 px under kanten. Uret vises først, når man har valgt det; en elev der ikke ved at det findes, finder det ikke. Mit script kunne ikke trykke "5+0" uden at rulle først (`mat.txt`, `slut.txt`).
- Efter et parti på 360 x 560: overskriften "Tre steder hvor partiet vendte" er kun 3 px inde, og brættet skrumper til 288 px. På 390 x 844 står den 656-700 og er fin. 320 x 520 er ikke målt (ikke bedt om).
- Knapperne er 44 px høje overalt; brættet er 320 px på 360 x 560 (287 px på 390 x 844 er ikke relevant, det er 374 px).
- Efter et parti på 1280 x 800 ligger vendepunkterne nu inde (overskrift og minibræt synlige uden at rulle, `1280x800-M2-efter-mat.png`), men "Tren dette"-knappen ligger langt nede (Chaturanga kender den).

## Er mine seneste fund lukket? (732)

- Fund 1, skakur-valget: **åbent.** Målt igen: 689-741 på 360 x 560, uændret siden 732.
- Fund 2, vendepunkternes overskrift 3 px fra kanten på 360 x 560: **åbent.** Chaturangas 735 sigter på 513-557 og har målt det som "helt inde"; 557 af 560 er stadig kun 3 px luft, og en elev med adresselinje eller tastatur mister den. Jeg regner det som lukket i teknisk forstand og åbent i praksis.
- Fund 3, "Giv op" på 1280 x 800: **delvist lukket.** 739 skjuler ur, farve og niveau efter et parti, men under partiet ligger "Giv op" stadig 802-846 (Fortryd / Hint / Start forfra 750-794).

## Testresultat

Ingen kode ændret (skakkens `main`, ikke rørt), så `npm run lint` og verify-scripts er ikke relevante; afleveringen er docs og outputs. Målescripts kørt uden sidefejl: `elevtur2.txt`, `elevtur3.txt`, `slut.txt` og `mat.txt` i `outputs/kritik-749/`. Locators der fejlede: "5+0" på 360 x 560 og 390 x 844 (under kanten, se ovenfor) og `#strimmel-giv-op` / `#strimmel-hint` på 1280 x 800 (strimlen findes kun på telefon; på bred skærm hedder knapperne noget andet). Mine scripts er derfor ikke en fejl i skakken.

## Hvad er næste og ærlige grænser

Chaturanga: ret de tre ting øverst i rækkefølgen (1) ur-valget synligt eller en tekst på brættet ("Vil du have ur? Tryk her"), (2) "Giv op" inde på 1280 x 800, (3) mere luft under fold-overskriften på 360 x 560. Kan ikke afgøre: om et parti med ur på en rigtig telefon opleves som besværligt (ingen rigtig telefon, ingen børn). Det stiller Hara-delmålet "Appen mærkbart bedre" (skolen) bedre: Marcs klasse kan spille nu; ur og "Giv op" er de to ting en elev kan sidde fast i. Grænser: headless Chromium, touch som `tap()`, "ja" er min vurdering; makker-parti med ur er spillet med ur kun på 1280 x 800 (scriptet ramte ikke urvalget på telefon uden at rulle); gåde og Lær skak er set med ét forsøg pr. størrelse; 320 x 520 er ikke målt. Den midlertidige kildemappe ligger uden for repoet.

Klar til klassen: ja, på telefon og computer. De tre ting Chaturanga retter næste gang: (1) "Giv op" ligger stadig 802-846 af 800 på 1280 x 800, når skakuret er valgt, mens Fortryd, Hint og Start forfra ligger 750-794 (skærm: Spil, makker med ur, `1280x800-M1-foer-mat.png` og `1280x800-A3-efter-2-traek.png`; fil: Spil-panelet i `src/skak.template.html`, mål i `outputs/kritik-754/mat.txt`; rettelsen ligger på grenen `ordre-748` og er ikke merget til `main`); (2) på 360 x 560 er brættet kun 280 px (288 efter et parti), fordi hovedet fylder 173 px, og "Tre steder hvor partiet vendte" står 513-557 af 560, altså 3 px fra kanten (skærm: `360x560-M2-efter-mat.png`; fil: hoved- og fold-reglerne i `src/styles.css`, mål i `mat.txt`; også dette er rettet på `ordre-748` til 501-545); (3) i en gåde, hvor sort skal trække, vendes brættet, så rækkerne tælles 1-8 oppefra og bogstaverne står omvendt (a yderst til højre), og teksten "(vendt)" i strimlen forklarer det ikke for en 11-årig (skærm: `360x560-E1-gaade-efter-traek.png`; fil: gåde-visningen i `src/main.js` og gåde-strimlen i `src/skak.template.html`).

# Ordre 754, Bhishak, 30. sep. 2026

Skakken på `main` (`b728726`, efter ordre 743), hentet med `git archive` til en midlertidig mappe uden for repoet og kørt derfra. Skakens eget arbejdstræ står på grenen `ordre-748`, som ikke er merget; den har jeg ikke målt. Set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk browserprofil pr. scenarie, headless, syntetiske træk. Gren `kritik-754`. Filer kun under `docs/kritik-754/` (scripts `elevtur2-754.mjs`, `elevtur3-754.mjs`, `mat-754.mjs`, `slut-754.mjs`, genbrugt fra 749) og `outputs/kritik-754/` (43 skærmbilleder og måletekst). Læst: Chaturangas to nyeste rapporter (739 og 743), `docs/MOD-LICHESS.md` (ranglisten efter 512 og status efter 743) og første linje af min egen seneste skak-kritik (749).

## Kan en 11-årig komme i gang uden hjælp?

Ja. Mod computeren og som makker står brættet altid helt i vinduet på alle tre størrelser (360 x 560: 173-453; 390 x 844: 228-602; 1280 x 800: 140-677), og Fortryd, Hint og Giv op ligger lige under det (360 x 560: 460-504; 390 x 844: 609-653) (`360x560-A1-makker-efter-valg.png`, `360x560-B1-computer-traek.png`). Nyt siden 749: uret er ikke længere skjult, for foldens overskrift "Valg: intet ur" står nu 507-551 af 560 og kan ses uden at rulle. Makker-parti spillet til skakmat med skolemat (e4 e5 Lc4 Sc6 Dh5 Sf6 Dxf7): statuslinjen siger "Skakmat! Hvid vinder.", og "Gennemse partiet" og "Nyt parti" står 468-512 af 560 (390 x 844: 609-653; 1280 x 800: 385-429) (`360x560-M2-efter-mat.png`). Gåde: brættet 220-500 og "Vis et hint" 507-551 på 360 x 560; et forkert træk giver "Ikke den vej. Løsningen er vist - tag trækket tilbage." (360 x 560) og "Ikke den vej. Tag trækket tilbage og prøv igen." (390 og 1280), og "Tag trækket tilbage" står inde (`360x560-E1-gaade-efter-traek.png`). Lær skak, "Trin 1 af 32, Brættet": teksten står over brættet (155-192 af 560), og en grøn ring viser hvilket felt der skal trykkes på (e4) (`360x560-C1-laer-ny.png`). Eleven ser altså altid brættet og det, der skal trykkes på.

## Hvad er stadig besværligt eller rodet på lav telefon?

- Brættet er blevet mindre: 280 px på 360 x 560 (var 320 i 749), 288 efter et parti. Det er prisen for at få ur-valget frem (ordre 743). Brikkerne er stadig tydelige, men 8 x 8 felter på 35 px er trangt for en tommelfinger; hovedet med fanerne fylder 173 px af 560 (fund 2).
- Efter et parti på 360 x 560 står "Tre steder hvor partiet vendte" 513-557 af 560, kun 3 px inde (`mat.txt`, `slut.txt`). På 390 x 844 står den 656-700 og er fin.
- Uret: nu synligt som tekst, men selve valget (3+0 … Fri) ligger 649-701 af 560, inde i folden, og man skal åbne folden. Chaturanga ruller det på plads, når folden åbnes; mine to scripts `mat` og `slut` åbnede den ikke og fik derfor ikke trykket "5+0", det er en fejl i mine scripts, ikke i skakken. `elevtur2` åbner folden og fik trykket.
- 1280 x 800: Giv op er uden for skærmen, så længe uret er valgt (fund 1). I `1280x800-A3-efter-2-traek.png` skal man rulle for at finde den; en elev, der vil give op, ser den ikke.
- Gåde, hvor sort trækker: brættet er vendt (1 øverst, h yderst til venstre). Strimlen siger "(vendt)", men en 11-årig skal selv regne det ud (fund 3, ikke set med børn).
- Knapperne er 44 px høje overalt; ingen sidescroll på nogen størrelse (`mat.txt`).

## Er mine seneste fund lukket? (749)

- Fund 1, skakur-valget: **lukket på main.** Overskriften står 507-551 af 560 (749: 689-741) og kan ses uden at rulle; efter et tryk rulles uret frem (`360x560-A1-makker-efter-valg.png`, `360x560-A2-ur-5-0.png`). Prisen er det mindre bræt (280 px).
- Fund 2, foldens overskrift efter et parti på 360 x 560: **åbent på main** (513-557, uændret). Rettet til 501-545 på `ordre-748` (commit `1079b44` ifølge grenens log; jeg har ikke selv målt grenen).
- Fund 3, "Giv op" på 1280 x 800: **åbent på main** (802-846 med ur valgt, uændret). Rettet til 736-780 på `ordre-748` (commit `3e52e60` ifølge grenens log, ikke selv målt). Uden ur er knappen 547-591, som 743 skriver.

Så: ét fund lukket, to åbne på `main` men rettet på en gren, der venter på Marcs merge. Merges 748, er alle tre lukkede, og jeg måler dem igen næste gang.

## Testresultat

Ingen kode ændret (skakkens `main` er ikke rørt), så `npm run lint` og verify-scripts er ikke relevante; afleveringen er docs og outputs. Målescripts kørt uden sidefejl: `elevtur2.txt`, `elevtur3.txt`, `mat.txt` og `slut.txt` i `outputs/kritik-754/`. Locators der ikke ramte: `#strimmel-giv-op` og `#strimmel-hint` på 1280 x 800 (strimlen findes kun på telefon, på bred skærm hedder knapperne noget andet), og "5+0" i `mat` og `slut` (folden ikke åbnet, se ovenfor). På 1280 x 800 fandt `slut` ikke vendepunkterne efter et Giv op-parti (`slut.txt`: "vendepunkter []"); det er ikke undersøgt videre, kun `mat` (skakmat) har vendepunkter på den størrelse ("P 456-474", en tekstlinje, ikke set på skærmbillede).

## Hvad er næste og ærlige grænser

Chaturanga: (1) merge `ordre-748` (Giv op og fold-luft), (2) find luft i hovedet på 360 x 560, så brættet igen kan blive 300+ px, (3) forklar det vendte bræt i gåden, fx "Du er sort, brættet er vendt" i strimlen. Det støtter Hara-delmålet "Appen mærkbart bedre" (skolen): Marcs klasse kan spille nu, og ur og "Giv op" er de eneste steder en elev kan sidde fast. Hara-relevant, Duta afleverer.

Grænser: headless Chromium, touch som `tap()`, ingen rigtig telefon, ingen børn; "ja" er min vurdering. Jeg har ikke set en lektion længere end trin 1 og en enkelt gåde pr. størrelse. Jeg har ikke målt `ordre-748`, kun læst dens commit-navne. Makker-parti med ur er kun spillet 2 træk, ikke til tidsudløb. Samlet tid ca. 15 minutter.

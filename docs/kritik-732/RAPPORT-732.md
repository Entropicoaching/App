Klar til klassen: ja, paa telefon og computer; det der staar tilbage er smaat. De tre ting Chaturanga retter naeste gang: (1) skakur-valget i et makker-parti ligger stadig 689-741 paa 360 x 560, ude af syne under braettet (siden 1751 px hoej), saa en elev der vil have ur skal rulle for at finde det, og et tryk uden at rulle foerst rammer ikke (skaerm: Spil, Mod en makker, `360x560-A1-makker-efter-valg.png` og `360x560-S1-efter-ur-tryk.png`; fil: `#segment-skakur`, `#spil-valg-fold`, mobil-CSS i `src/styles.css`); (2) efter et parti paa 360 x 560 staar "Tre steder hvor partiet vendte" 513-557 af 560, kun 3 px fra kanten, og braettet er skrumpet fra 320 til 288 px (skaerm: Sort gav op, `360x560-S3-partiet-slut.png`; fil: fold-overskriften i `src/skak.template.html` og fold-reglen i `src/styles.css`); (3) paa 1280 x 800 kan jeg ikke se "Giv op" i Spil-panelet uden at rulle: kun Fortryd, Vis et hint og Start forfra ses, og panelet er over 800 px hoejt med ur, tavle og lyd (skaerm: makker med ur, `1280x800-A3-efter-2-traek.png`; fil: `src/skak.template.html` Spil-panelet).

# Ordre 732, Bhishak, 30. sep. 2026

Skakken paa `main` (`ddd915f`, hentet med `git archive`, ikke roert). Set som en 11-aarig paa 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk browserprofil, headless, syntetiske traek. Gren `kritik-732`. Filer kun under `docs/kritik-732/` (scripts `elevtur2-732.mjs`, `elevtur3-732.mjs`, `slut-732.mjs`) og `outputs/kritik-732/` (skaermbilleder og maaletekst).

## Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet altid helt i vinduet (173-493 foer partiet, 173-461 efter), og det der skal trykkes paa er synligt: Fortryd / Hint / Giv op ligger 500-544, lige under braettet (`360x560-B2-hint.png`). Med uret staar Hvid-ur, Fortryd, Giv op og Sort-ur i EN raekke (`360x560-A3-efter-2-traek.png`), og "Giv op" beder om bekraeftelse (`360x560-A4-giv-op.png`). Gaade: braet 198-478 og "Vis et hint" 484-528 (`360x560-D1-gaade.png`); et forkert traek giver "Ikke den vej. Tag trækket tilbage og prøv igen." Lær skak, "Jeg er ny": trin 1 af 32 med teksten oeverst, braet 207-487 og en groen ring paa e4, saa eleven ser hvad der skal trykkes (`360x560-C1-laer-ny.png`). 390 x 844 og 1280 x 800 er rummelige overalt (`390x844-*`, `1280x800-*`). Efter Sort giver op staar "Gennemse partiet" og "Nyt parti" 468-512 paa 360 x 560 (`360x560-S3-partiet-slut.png`).

## Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Skakur-valget (fund 1 ovenfor): det er den eneste vej til ur, og det ligger 129 px under kanten. Ingen tekst paa braettet siger, at der findes et ur.
- Efter et parti: overskriften er lige inde (3 px), men et lidt hoejere fold-gab eller mindre luft vil skubbe den ud igen; braettet er 32 px mindre (288) end under partiet.
- Paa 1280 x 800: Spil-panelet er langt. Ur-tiderne staar midt paa siden, men "Giv op" fandt jeg ikke uden at rulle (mit script ramte ikke knappen; skaermbilledet viser den heller ikke i vinduet).
- Kun "Vis et hint" og "Fortryd" i gaaden er tydelige; "(vendt)" i gaader med Sort har jeg ikke set igen her.

## Er mine seneste fund lukket? (725)

- Fund 2, Fortryd/Giv op under uret: **lukket.** Uret og knapperne staar nu i samme raekke 500-544 (foer Fortryd/Giv op 550-594 af 560).
- Fund 3, Lær skak paa 360 x 560: **lukket.** Teksten staar oeverst, braettet 207-487 fylder vinduet, ring paa foerste felt (foer 175 px synligt).
- Fund 1, skakur-valget: **aabent.** Maalt igen: 689-741 (uaendret), men et tryk scroller ikke lige saa slemt som foer: braettet blev staaende i vinduet (173-493) i min maaling. Valget er stadig kun synligt efter rul.
- Vendepunkter efter et langt parti: **lukket** paa 360 x 560 (513-557, jf. ordre 735); ikke maalt paa 320 x 520 og ikke efter et langt makker-parti paa 30+ traek (kun efter et kort parti med Giv op).

## Testresultat

Ingen kode aendret, saa `npm run lint` og verify-scripts er ikke relevante; aflevering er docs og outputs. Maalescripts koert uden sidefejl: `tur2.txt`, `tur3.txt`, `slut.txt` i `outputs/kritik-732/`. To locators fejlede ("ikke tryk" paa 5+0 paa 360 x 560, "Giv op" paa 1280 x 800); det staar i `slut.txt`.

## Hvad er naeste og aerlige graenser

Chaturanga: ret de tre ting oeverst i den raekkefoelge. Har det betydning for Hara (Appen maerkbart bedre / skolen)? Det stoetter Marcs klasse: skakken kan bruges nu; ur-fundet er det eneste, en elev paa en lav telefon kan sidde fast i. Graenser: headless Chromium, touch som `tap()`, ingen rigtig telefon, ingen boern; "ja" er min vurdering. Jeg spillede et parti mod computeren kun med to traek og hint (ikke et helt parti); makker-parti med ur og giv op er spillet igennem paa 360 og delvist paa 1280. 320 x 520 er ikke maalt (ikke bedt om). Det midlertidige kildetrae ligger uden for repoet.

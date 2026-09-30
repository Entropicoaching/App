Klar til klassen: ja, paa telefon og computer (skak main 58f7ab7, uaendret siden kritik 846; ordre 845 er ikke merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) efter Giv op er resultatsiden stadig 2059 px paa 360 x 560, og "Laer af dine fejl" staar to gange (knap under braettet og kort i sidepanelet) og "Tre steder hvor partiet vendte" staar som overskrift uden liste under (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-852/360x560-E3-efter-giv-op-hel.png`; fil: `src/partitalui.js` og `src/styles.css`; vis een primaer knap og skjul den anden, og fjern overskriften naar listen er tom); (2) paa 1280 x 800 ligger raekken "Vend braettet / Tavle / Pile og streger / Hvad sker der" stadig under vindueskanten (y 787-831 af 800) (skaerm: Spil, Mod computeren, d4, `outputs/kritik-852/1280x800-B1-computer-traek.png`; fil: braetraekkens CSS i `src/styles.css`; goer braettet lidt mindre paa lave skaerme); (3) hovedet fylder 148 px paa 320-360 (titel + to raekker faner), saa braettet kun er 264-304 px bredt, og valget af ur skjules i folden "Skakur og valg" foer eleven har valgt (skaerm: Spil, Mod en makker, `outputs/kritik-852/360x560-A1-makker-efter-valg.png`; fil: hoved-markup i `src/skak.template.html`; hovedet kraever Marcs ja til nye fanenavne, og urvalget kan vaere en synlig linje).

## Gren

`kritik-852` fra `main`. Skakken hentet med `git archive main` (58f7ab7) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560, 390 x 844, mus paa 1280 x 800. Scripts: `docs/kritik-852/elevtur-852.mjs`, `slut-852.mjs`, `bund-852.mjs` (genbrugt fra 846). Skaermbilleder og maal-json i `outputs/kritik-852/`. Laest: RAPPORT-839 og RAPPORT-830, ranglisten i MOD-LICHESS, foerste linje af kritik 846. Skak-main er uaendret siden min sidste kritik (samme hash), saa der er intet nyt at vurdere ud over det, 839 rettede (Laer skak trin 13-18).

## Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet fra y=148 til 452 og er helt synligt i alle scenarier: parti mod computeren, makker-parti med ur, gaade og Laer skak trin 1. Under braettet ligger Fortryd / Vis et hint / Giv op (y 459-503, i vinduet), og i makker-partiet de to urknapper "Hvid 5:00" og "Sort 5:00" med Fortryd og Giv op imellem (skaerm `360x560-A3-efter-2-traek.png`). Gaadens hintknap ligger 484-528 paa 360 og 468-512 paa 320 (i vinduet). Laer skak trin 1 siger "Klik e4" og Videre staar oeverst (164-208). Paa 1280 er alt (Spil-panel med niveau, Giv op) synligt til hoejre for braettet. Der er ingen sidescroll.

## Hvad er stadig besvaerligt eller rodet paa lav telefon

- Efter Giv op: siden er 2059 px (320: 1805 efter 830 maalt; nu maalt paa 360). Under braettet: Gennemse parti / Nyt parti / "Traen Binding i biblioteket", saa vendepunkts-overskriften uden indhold, aabningsnavn, graf, "Laer af dine fejl" og "Oev denne aabning", og saa Spil-panelet, hvor "Laer af dine fejl" kommer en gang til som kort og en tredje gang som knap. En 11-aarig ser tre knapper med samme navn.
- Hovedet 148 px paa 320-360; braettet 264-304 px. Uret vises som strimmel foerst efter valg af 5+0; foer det er urvalget (y 596-648 paa 320 x 520, uden for vinduet) gemt i folden "Skakur og valg".
- 1280 x 800: knaprakken under braettet (Vend braettet, Tavle, Pile, Hvad sker der) staar 787-831 og er skjult uden scroll; aabningsnavnet og pilene er i vinduet (734-778).
- Braet-hop: efter 839 staar braettet stille i Laer skak trin 13-18 og (i main) ikke maalt for trin 19-27, hvor 845 er ikke merget.

## Er mine seneste fund lukket?

Nej, ingen af de tre fund fra 846 er lukket, og main er uaendret siden: (1) Giv op-siden 2059 px og dobbelt "Laer af dine fejl": aaben; (2) raekken paa 1280 under kanten: aaben (y 787-831); (3) hovedet 148 px og uret i folden: aaben (kraever Marcs ja; #29 ogsaa). Nyt: overskriften "Tre steder hvor partiet vendte" staar uden liste. Lukket siden foer: patt-rosen (839), tal efter Giv op (830).

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern. Paa 1280 fandt scriptet ikke knapperne med telefonens id'er (de bor i sidepanelet), saa 1280-tallene for Fortryd/Hint/Giv op og gaadens hint er ikke maalt af scriptet, kun set paa skaermbillederne. Gaaden efter forkert/rigtigt traek og et helt parti er ikke maalt (tilfaeldigt). Sidehoejden svinger med computerens traek. Jeg har ikke set 845 (ikke merget).

## Betydning for Hara

Ingen; kun skak-kritikken, ingen ny skrivning og ingen elevdata.

## Hvad er naeste

1. Skjul den dobbelte "Laer af dine fejl" og den tomme vendepunkts-overskrift efter Giv op paa telefon.
2. Goer braettet lidt mindre paa lave skaerme (1280 x 800), saa raekken under braettet er i vinduet.
3. Marcs ja til nye fanenavne, saa hovedet kan blive lavere, og urvalget som synlig linje i makker-partiet.

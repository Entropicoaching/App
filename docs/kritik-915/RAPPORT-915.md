Klar til klassen: nej (skak main bfcc54f, inkl. ordre 906 og 911). De tre vigtigste ting Chaturanga retter naeste gang: (1) en ny elev lander paa GAADER, ikke paa Spil eller Laer skak: frisk profil, alle tre stoerrelser, foerste skaerm er "Find det bedste traek" med en stilling med ti brikker, "Niveau: 0 af 10", en knap "Storm" og "Vis et hint", og ingen forklaring paa hvad en gaade er eller hvor man spiller et parti (skaerm: foerste indlaesning, 360 x 560, `outputs/kritik-915/360x560-E0-foerste-skaerm.png`; fil: den fane der vaelges ved opstart i `src/main.js` / `src/braet.js`, `skiftFane(...)`; aabn paa Spil eller Laer skak foerste gang, eller giv gaade-siden en linje "Saadan spiller du en gaade" og en synlig vej til Spil); (2) ordre 911 ("kun een Fortryd efter partiet") holder ikke ved skakmat i makker-partiet: efter skakmat staar der stadig to synlige "Fortryd", en under braettet (`#slut-fortryd`, y 453 paa 360, 603 paa 390) og en helt nede i sidepanelet (`#knap-fortryd`, y 823 paa 360, 1085 paa 390), og siden er 1356 / 1619 px hoej (skaerm: Spil, Mod en makker, skakmat efter f3 e5 g4 Dh4, `outputs/kritik-915/360x560-E1b-side.png`; fil: reglerne `body[data-spil-slut] ...` i `src/styles.css` omkring linje 2916-2942, hvor Fortryd-reglen ikke rammer makker-partiet; udvid den til alle sluttyper og begge tilstande, og kraev en test der taeller synlige Fortryd efter skakmat, tid ude og Giv op i baade makker og computer); (3) hint og koordinater er stadig for daarlige paa lav telefon: hintet siger kun "Ingen fare lige nu, spil dit plan." uden at vise en brik eller et felt (skaerm: Spil, Mod computeren, Hint, `outputs/kritik-915/360x560-B2-hint.png`; fil: hint-teksten og markeringen i `src/spil.js` og `src/styles.css`), og koordinaterne 8 og 1 ligger oven i taarnene i hjoernerne paa alle telefonbraetter (skaerm: `outputs/kritik-915/360x560-A3-efter-2-traek.png`; fil: felt-koordinaterne i `src/styles.css`).

## Gren

`kritik-915` fra `main`. Skakken hentet med `git archive main` (bfcc54f) til en midlertidig mappe og koert headless (Playwright, Chromium): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts i `docs/kritik-915/`: `elevtur-915.mjs` (genbrugt fra 908: makker med ur, computer + hint, Laer skak "Jeg er ny", gaade), `ekstra-915.mjs` (foerste skaerm, skakmat i makker, tid ude paa uret med Playwrights falske ur) og `maal2-915.mjs` (taeller synlige Fortryd og aflaeser foerste fane). Skaermbilleder og maalinger i `outputs/kritik-915/`. Laest: Chaturangas to nyeste rapporter (911 og 906), `docs/MOD-LICHESS.md` og foerste linje af min kritik 908. Kun syntetiske partier (f2-f3, e7-e5, g2-g4, Dd8-h4 og e2-e4).

## Hvad aendret

Jeg har kun kritiseret; skakken og appen er ikke rort. Siden 908 har Chaturanga lavet ordre 911 (en Fortryd efter partiets slut paa telefon; valgfolden lukkes ved slut) og 906 (knaprakke paa 1280 og statuslinje paa 320).

### Kan en 11-aarig komme i gang uden hjaelp, og ser eleven altid braettet og det, der skal trykkes paa?

Braettet ses altid: 248 px paa 320, 280 paa 360, 374 paa 390, 460 paa 1280, og det staar i vinduet i Spil, Gaader og Laer skak paa alle stoerrelser (`maal-915.json`). Trykmaal er fine: knapraekken under braettet er 44 px hoej, ur-felterne er store, og Giv op spoerger foerst "Ja, giv op / Annuller" (`360x560-A4-giv-op.png`). Et makker-parti med ur kan startes med tre tryk, uret vises som to store felter (Hvid / Sort) med det aktive felt fyldt, og ved tid ude staar "Tiden er gaaet for sort. Hvid vinder paa tid." oeverst, uret bliver roedt og "Nyt parti" er stort og orange (`360x560-F1-tid-ude.png`). Skakmat siger "Skakmat! Sort vinder." med "Gennemse partiet" og "Nyt parti" i samme raekke.
Det, der ikke er godt: eleven kommer ikke i gang UDEN hjaelp, fordi den foerste skaerm er en gaade (fund 1). En elev der ikke ved hvad "Niveau: 0 af 10" eller "Storm" er, ser ingen vej til at spille et parti ud over fanen Spil, og "Undervisning" staar som et understreget link uden for fane-raekkerne, der ligner tekst og ikke en knap. Lektionen i Laer skak er derimod god: trin 1 af 32, "Braettet: Felterne har navne ... Klik e4." med en groen ring paa e4 er noget en 11-aarig kan goere alene (`360x560-C1-laer-ny.png`).

### Hvad er stadig besvaerligt eller rodet paa lav telefon?

- Hovedet (titel + seks faner i to raekker) fylder 143-147 px af 520-560 og goer braettet lille paa 320 og 360; uaendret siden 908 og kraever Marcs ja til nye navne, saa det er ikke en fejl men det staar stadig.
- Dobbelt Fortryd efter skakmat i makker (fund 2) og en lang side efter partiet: 1356 px paa 360 og 1619 paa 390. "Tre steder hvor partiet vendte", "Laer af dine fejl", "Oev en aabning" og "Koordinater" ligger som overskrifter under braettet, saa en elev skal scrolle forbi dem; "Nyt parti" staar dog oppe ved braettet (`360x560-E1b-side.png`).
- Hint (`360x560-B2-hint.png`) viser ingen brik eller felt, kun en linje tekst.
- Koordinaterne (8 ... 1 og a-h) ligger i hjoernefelterne og overlapper taarnene paa a8 og a1 paa alle telefonbraetter (`360x560-A3-efter-2-traek.png`).
- Gaader: braettet er 280 px og "Vis et hint" staar helt i bunden af 560 (y 484-528); stillingen har ti brikker og der staar hverken hvem der skal vinde eller hvad opgaven er, fx "mat i 2" (`360x560-D1-gaade.png`).
- 1280 x 800: knaprakken er ikke laengere skaaret, men "Brikker og farver" staar stadig alene paa anden linje under braettet (`1280x800-B1-computer-traek.png`).

### Er mine seneste fund lukket? (kritik 908)

- Fund 1 (hovedet paa 148 px): nej, uaendret (kraever Marcs ja).
- Fund 2 (knaprakken paa 1280 x 800): delvist. Knapperne er ikke skaaret, men "Brikker og farver" staar stadig alene paa anden linje.
- Fund 3 (to Fortryd efter Giv op): 911 siger lukket for Giv op mod computeren; jeg har ikke selv gentaget den i denne ordre. For skakmat i makker-partiet er den IKKE lukket: begge Fortryd er stadig synlige (fund 2 ovenfor).

## Testresultat

Ingen tests at koere for min del, for jeg roerer ikke skakken. Maalinger: `outputs/kritik-915/maal-915.json` (bounding boxes for braet og knapper paa 320, 360, 390 og 1280 i fire scenarier) og konsollinjer fra `maal2-915.mjs`: foerste fane = Gaader paa 360 og 390 med tom localStorage; synlige Fortryd efter skakmat i makker: to paa begge stoerrelser. Ca. 50 skaermbilleder i `outputs/kritik-915/`. Scripts koerte uden fejl; "kunne ikke trykke"-linjerne paa 1280 er mine egne scripts, der ledte efter mobile knap-id'er (`#strimmel-*`), som ikke findes paa 1280, og er ikke en fejl i skakken.

## Hvad er naeste

1. Aabn paa Spil eller Laer skak foerste gang (eller forklar gaaden), og gor "Undervisning" til en rigtig knap.
2. Ret dobbelt-Fortryd for ALLE sluttyper og begge tilstande, med en test der taeller synlige knapper.
3. Hint der peger paa en brik/et felt, koordinater der ikke ligger under brikkerne, og "Brikker og farver" ind paa foerste raekke paa 1280.
Chaturanga boer proeve en frisk profil paa en rigtig telefon og se hvor eleven trykker foerst; hovedets hoejde afventer stadig Marcs ja.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon og ingen boern, ingen touch-latens og intet rigtigt tastatur. Uret der loeber ud er testet med Playwrights falske ur, ikke i real tid. Computer-partiet er kun spillet et par traek (d4), Giv op mod computeren er ikke gentaget, og skakmat er kun set i makker-partiet. Storm, Opstil, Bibliotek og Taktik er ikke set i denne ordre. "Hvad en 11-aarig forstaar" er mit eget skoen, ikke maalt paa et barn. Ingen elevdata, intet net, ingen push. Arbejdet har ikke betydning for Hara.

Klar til klassen: nej (skak main c787b5e, inkl. ordre 914). De tre vigtigste ting Chaturanga retter naeste gang: (1) en ny elev lander stadig paa GAADER: frisk profil, 360 x 560 og 390, foerste skaerm er "Find det bedste traek", "Niveau: 0 af 10", "Storm" og "Vis et hint", uden en linje om hvad en gaade er og uden en synlig vej til at spille et parti (skaerm: `outputs/kritik-922/360x560-E0-foerste-skaerm.png`; fil: opstartsfanen i `src/main.js` / `skiftFane(...)`; aabn paa Spil eller Laer skak foerste gang, eller giv gaade-siden en stor knap "Spil et parti"); (2) hintet viser stadig ingen brik: mod computeren efter 1. d4 d5 staar der kun "Ingen fare lige nu, spil dit plan." og intet felt lyser (skaerm: `outputs/kritik-922/360x560-B2-hint.png`; fil: hint-teksten og markeringen i `src/spil.js` og `src/styles.css`; marker altid en brik eller et felt, ogsaa naar der ikke er fare); (3) koordinaterne ligger stadig oven i brikkerne i hjoernerne paa telefon: "1" og "a" oven i hvid taarn, "8" oven i sort taarn (skaerm: `outputs/kritik-922/360x560-A3-efter-2-traek.png` og `360x560-E1-skakmat-makker.png`; fil: felt-koordinaterne i `src/styles.css`; flyt dem vaek fra brikken eller skjul dem paa telefon).

## Gren
`kritik-922` fra `main` i entropi-app-kritik. Skakken: `C:\Users\Entropi\Desktop\skak` main c787b5e, hentet med `git archive` til en midlertidig mappe (intet aendret i skak). Scripts `docs/kritik-922/elevtur-922.mjs`, `ekstra-922.mjs`, `maal2-922.mjs` (genbrugt fra 915, samme scenarier), logs og skaermbilleder i `outputs/kritik-922/`. Laest: Chaturangas RAPPORT-914 og 911 (Hvad aendret / Hvad er naeste), `docs/MOD-LICHESS.md` og foerste linje af min egen 915.

## Hvad jeg goer (elevens tur)
Headless Chromium, frisk profil pr. scenarie: 320 x 520, 360 x 560, 390 x 844 (touch/tap) og 1280 x 800 (mus). Et parti mod computeren (1. d4, hint), et makker-parti med ur (5+0, to traek, Giv op; 3+0 med skakmat; tid der loeber ud), en gaade og lektion 1 af "Laer skak" fra "Jeg er ny".

## Dom paa de tre spoergsmaal
**Kan en 11-aarig komme i gang uden hjaelp?** Delvis. Vaelger eleven selv "Spil", er det nemt: to store valg, braettet oeverst, en raekke Fortryd / Hint / Giv op under braettet, og partiet kan spilles uden at scrolle paa 360 (braet 288-304 px, knapper y 441-501 af 560). "Laer skak" er tydeligst: "Trin 1 af 32 / Braettet", en kort tekst og en groen ring paa e4. Men en ny elev lander paa Gaader og faar ingen forklaring; det maa laereren sige hoejt hver gang.

**Ser eleven altid braettet og det, der skal trykkes paa?** Ja for braettet: det er oeverst paa alle fire stoerrelser, ogsaa efter skakmat og tid ude (skaerme E1 og F1). Knapraekken er inde i vinduet paa 360 og 390. Paa 320 x 520 slutter knapraekken ved y 458 af 520, men "Valg"-folden staar under fold (y 461-714). Efter skakmat staar "Fortryd / Gennemse partiet / Nyt parti" i een raekke, og Nyt parti er tydeligt. Paa 1280 er braettet 481 px og hele knapraekken inde.

**Er mine seneste fund (915) lukket?**
- 915 nr. 2 (to Fortryd efter skakmat i makker-partiet): LUKKET. Efter skakmat er kun `#slut-fortryd` synlig (360: y 453, 390: y 603; de fire andre er skjult). Siden er 1184 / 1447 px mod 1356 / 1619 foer.
- 915 nr. 1 (foerste skaerm er Gaader): AABEN, uaendret (foerste fane "Gaader", frisk profil, 360 og 390).
- 915 nr. 3 (hint uden felt; koordinater oven i taarnene): AABEN, uaendret.
- Nyt siden 915: braettet 481 px paa 1280 og aabningsnavn skjult efter slut paa telefon (914) virker; intet nyt brud fundet.

## Hvad er stadig besvaerligt paa lav telefon
- Foerste skaerm (se ovenfor): det stoerste hul for en klasse, der aabner siden paa egen telefon.
- Hint: teksten alene hjaelper ikke en 11-aarig; brikken/feltet skal lyse.
- Koordinater i hjoernerne overlapper taarnene. Paa gaaden med sort til traek er braettet vendt, og bogstaverne staar omvendt (h g f e ...) uden forklaring.
- Ur-valget (Intet / 3+0 ... Frit) er en tung raekke lige under braettet i makker-partiet paa 320-360, og "Valg"-folden i computer-partiet ligger under fold (y 461 og 504 af 520 / 560): man skal rulle for at skifte niveau.
- Uafklaret: "Laer skak"-teksten skifter laengde, saa braettet hopper (908 / 914 nr. 3); jeg har kun set trin 1.
- Hovedet paa lav telefon (faner i to raekker) staar stadig; Chaturanga venter paa Marcs ja.

## Testresultat
Ingen tests koert af mig og intet aendret i skakken. Maalinger: `outputs/kritik-922/maal-922.json`, `elevtur.log`, `ekstra.log`, `maal2.log`.

## Hvad er naeste (til Chaturanga)
1. Aabn paa Spil eller Laer skak foerste gang (eller en "Spil et parti"-knap paa Gaader).
2. Hint der altid lyser en brik/et felt.
3. Koordinaterne ud af hjoernerne paa telefon.
Bagefter: "Valg"-folden og ur-raekken paa 320-360, og Laer skak-hoejden. Bhishak proever igen paa: frisk profil paa 360 (foerste skaerm), hint efter 1. d4 d5, og hjoernerne i A3 og E1.

## Aerlige graenser
Headless Chromium, ingen rigtig telefon og ingen boern; kun syntetiske data. Kun trin 1 af Laer skak og een gaade (kun foerste skaerm, intet forkert traek proevet). Hint set kun mod computeren efter 1. d4 d5; i andre stillinger kan det vise et felt. Storm og klassens turnering ikke set. Afleveringen med hoest.mjs blev afvist af tilladelsessystemet og er ikke koert. Ingen betydning for Hara.

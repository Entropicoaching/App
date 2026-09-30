Klar til klassen: ja (skak main ac51904, inkl. ordre 936). De tre vigtigste ting Chaturanga retter naeste gang: (1) Nyt parti staar stadig sidst og Fortryd foerst i resultatkortet paa telefon: paa 360 og 390 er raekken Fortryd, Gennemse partiet, Nyt parti (skaerm: `outputs/kritik-946/360x560-M3-giv-op-slut.png`; maal: `elevtur-946.txt` "M3 knapper"; fil: `slut-nyt-parti` / `slut-fortryd` i `src/skak.template.html`, og testen fra ordre 896 der fastlaaser raekkefoelgen), mens 1280 nu er rigtig; (2) Laer skak flytter stadig braettet 13 px ned paa 360 x 560 ved overgangen fra "Kongen" til "Dronningen" (242 -> 255; skaerm: `outputs/kritik-946/360x560-L-trin7.png`; maal: `laer-946.txt`; fil: `forudmaalBoksHoejde` i `src/laerskak.js`; 390 og 1280 staar stille); (3) foerste skaerm paa 360 er Gaader med et vendt braet (sort traekker, h-a nedenunder) og siden er 2447 px hoej, saa en ny elev ser "Spil et parti" men ikke at "Spil" er fanen til computeren (skaerm: `outputs/kritik-946/360x560-E0-foerste.png`; fil: landingsfane i `src/skak.template.html`, valget er Marcs).

## Dom
Ja, klar til klassen. En 11-aarig paa 360 x 560 og 390 (touch) og 1280 (mus) kan starte et parti mod computeren, et makker-parti med ur, en gaade og Laer skak uden hjaelp; braettet er altid synligt, og det der skal trykkes paa (Start, felterne, Videre, Giv op) kunne alle trykkes i scriptet. Ingen sidefejl (`pageerror-946.mjs`, tre koersler paa 360: ingen). Resten er finpudsning, ikke blokkere.

## Hvad jeg goer
Skakken hentet med `git archive main` til en midlertidig mappe og koert derfra (ingen aendring i skakken). Scripts i `docs/kritik-946/` (`elevtur-946.mjs`, `laer-946.mjs`, `hint-946.mjs`, `pageerror-946.mjs`), headless Chromium, frisk profil pr. scenarie, touch paa 360 og 390, mus paa 1280. Syntetiske partier (e2-e4, d4-d5, Giv op). Skaermbilleder og maal: `outputs/kritik-946/`. Ordre 940 (Laer skak-forudmaaling, Nyt parti-raekken) ligger paa Chaturangas gren og ikke paa main, og er derfor ikke vurderet.

## Kan en 11-aarig komme i gang, og ser eleven braettet?
- Computer: Spil -> Start -> e2, e4 -> computeren svarer e7-e5, status "Din tur". Hele braettet er i vinduet (top 147 paa 360). Hint virker (marker paa b1, forklaring "Kan hvids springer paa b1 komme i spil?"), paa 360 og 1280; `outputs/kritik-946/*-H1-hint-efter-e4.png`.
- Makker med ur (5+0): efter to traek er tidsvalget vaek paa 360, 390 og 1280 (fund fra 932 lukket). Uret staar under braettet, og man kan se og trykke paa det; paa 360 er de store ure delvist under vinduets kant og skal scrolles til (`360x560-M2-ur-efter-2-traek.png`; siden er 1893 px hoej).
- Gaade: braettet staar vendt (sort traekker), og en elev der aldrig har set det skal taenke sig om; "Vis et hint" og "Spil et parti" er synlige uden scroll paa 360.
- Laer skak (nyt niveau, 12-14 trin): rigtigt/forkert-beskeden er tydelig (roed tekst, stjerner paa braettet); knappen "Videre" fandtes hver gang.

## Hvad er stadig besvaerligt paa lav telefon
- Resultatkortet efter Giv op paa 360: Fortryd staar til venstre og den fyldte "Nyt parti" til hoejre (`360x560-M3-giv-op-slut.png`). Ordre 936 flyttede kun raekken paa 1280 (Nyt parti, Gennemse, Fortryd); telefonen er uaendret med vilje, men det er dér eleverne sidder.
- Laer skak paa 360: braettet hopper 242 -> 255 ved "Kongen" -> "Dronningen"; en elev der trykker hurtigt kan ramme forkert felt. Ordre 931 fik det ned, men ikke til nul.
- Hovedet er 90 px paa 360 og 134 px paa 390; det er Marcs ja-punkt (nr. 1 paa ranglisten) og uaendret.
- Siderne er lange (1893-2447 px paa 360) med meget under braettet.

## Er mine seneste fund lukket?
Fra 938:
1. Tidsvalget under uret: LUKKET (936; segmentet er ikke synligt efter to traek paa alle tre bredder).
2. Laer skak, braettet flytter sig: DELVIST (360: stadig to toppe, 242 og 255; 390 og 1280 lukket).
3. Resultatkort, Nyt parti foerst: LUKKET paa 1280 (Nyt parti, Gennemse, Fortryd), AABENT paa 360 og 390.

## Hara og aerlige graenser
Hara: intet i denne ordre kraever aendring eller levering udover selve rapporten; ingen Supabase, ingen miljoevariabler rort.
Graenser: kun headless Chromium, ingen rigtig telefon, ingen boern; 320 og 1024 ikke maalt; kun de foerste 12-14 Laer skak-trin af 32; Chaturangas gren med ordre 940 er ikke koert, saa jeg ved ikke om punkt 2 og 3 allerede er rettet dér. Mit hint-script ramte i foerste koersel et forkert id (`#knap-hint`); rettet til `#knap-spil-hint`, og maalene ovenfor er fra den rettede koersel.

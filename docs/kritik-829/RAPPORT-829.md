Klar til klassen: ja, på telefon og computer (skak main 6cf7380). De tre vigtigste ting Chaturanga retter næste gang: (1) efter Giv op mod computeren er siden 2415 px lang på 360 x 560 (var 2188), analysen (graf, "Nøjagtighed 51 % / 93 %", "Bukke 1") fylder alt mellem brættet og Spil-valgene, og selve resultatkortet ligger nederst, mens kortets tekst ("Brikken stod i fare og blev ikke reddet") og analysens tal siger to forskellige ting (skærm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, Ja giv op, `outputs/kritik-829/360x560-E3-efter-giv-op-hel.png`; fil: `src/partianalyse.js` og `src/spil.js`; skjul tallene "Nøjagtighed" og de tre tæller-rækker for niveau 1-2 og efter Giv op, og ryk "Tre steder hvor partiet vendte" bag en fold); (2) på 1280 x 800 er rækken under brættet klippet: åbningsnavnet ("Dronningebondeopening..." skæres af mod knappen "Hvad spiller man her?") og knapperne "Pile og streger: til" og "Hvad sker der" er skåret over i højre kant og ligger i bunden af vinduet, så eleven ikke ser dem (skærm: Spil, Mod computeren, d4, `outputs/kritik-829/1280x800-B1-computer-traek.png`; fil: `src/styles.css` og `src/skak.template.html`; lad rækken ombryde og giv åbningsnavnet egen linje); (3) hovedet (titel og to rækker faner) fylder stadig 148 px af 560 på 360 x 560, så brættet først begynder ved 148, og i Lær skak ligger brættet nu 253-533 (tekstkort og "Videre" over brættet), så nederste række kun har 27 px til kanten (skærm: `outputs/kritik-829/360x560-A2-ur-5-0.png` og `360x560-F1-laer-trin1-loest.png`; fil: `src/skak.template.html`, `src/laer.js`, `src/styles.css`; kræver Marcs ja til nye fanenavne; hold tekstkortet til to linjer).

## Gren

`kritik-829` fra `main`. Skakken hentet med `git archive main` fra `C:\Users\Entropi\Desktop\skak` (6cf7380, ordre 821 er merget; Chaturangas arbejdstræ har uafleverede ændringer, som jeg ikke har set) og kørt headless (Playwright, touch på 360 x 560 og 390 x 844, mus på 1280 x 800). Scripts: `docs/kritik-829/elevtur-829.mjs`, `slut-829.mjs` og `hint-829.mjs`; skærmbilleder, `maal-829.json` og udskrifter i `outputs/kritik-829/`. Kun syntetiske data, skakken er ikke ændret. Læst: Chaturangas RAPPORT-821 og RAPPORT-816 ("Hvad ændret", "Hvad er næste"), MOD-LICHESS og første linje af min RAPPORT-825 ("Klar til klassen: ja, på telefon og computer").

## Hvad jeg gjorde

Som en 11-årig: et parti mod computeren (e4 Nf3 Bc4 Nc3, hint, Giv op med bekræftelse), et makker-parti med ur 5+0 (e4 e5, Giv op), Lær skak fra "Jeg er ny" (trin 1 løst) og en gåde med hint. Målt på 360 x 560, 390 x 844 og 1280 x 800.

## Kan en 11-årig komme i gang uden hjælp?

Ja. Spil viser to store valg, "Mod computeren" og "Mod en makker". På 360 x 560 står brættet ved 148-452, og Fortryd og Giv op ligger lige under (459-503); i makker-partiet står begge ure på samme række, og folden hedder "Skakur og valg: ur 5+0". Efter Giv op står nu "Hvid gav op. Sort vinder." over brættet, og "Gennemse partiet" og "Nyt parti" ligger lige under brættet på 360 (skærm `360x560-H3-efter-giv-op-top.png`), så eleven ser hvad der kan trykkes på. I Lær skak står "Trin 1 af 32", en grøn ring og "Videre" (183-227) i vinduet. Gåden viser "Find det bedste træk" og "Vis et hint" under brættet (198-478); hintet virker ("Hint: se den fremhævede brik", både på 360 og 1280). På 1280 er Giv op, hint og Nyt parti i højre kolonne og brættet 140-677. Eleven ser altid brættet og det, der skal trykkes på.

## Hvad er stadig besværligt eller rodet på lav telefon

- Efter Giv op er siden 2415 px lang, og alt under brættet er analyse. Resultatkortet ligger nederst under Spil-valgene, og "Nøjagtighed 51 % / 93 %" og "Bukke 1" efter et parti, der kun blev givet op, er svære at forstå (fund 1).
- Hovedet på 148 px (fund 3).
- Lær skak: tekstkort og "Videre" over brættet lægger brættet ved 253-533; nederste række har 27 px luft.
- På 1280 er rækken under brættet klippet, se fund 2. På 360 er den ikke klippet.
- Valget af ur ligger stadig under kanten på 360 x 560, men urene ved brættet ses, så det blokerer ikke.

## Er mine seneste fund lukket?

825 fund 1 (resultatkort efter Giv op nederst): delvist lukket; "Gennemse partiet" og "Nyt parti" og en klar linje over brættet er nu øverst på 360, men kortet med årsagen ligger stadig nederst, siden er blevet længere (2415 mod 2188), og analysen står stadig med tal. 825 fund 2 (hovedet 148 px): åbent, venter på Marcs ja. 825 fund 3 (Lær skak skubber brættet): ikke lukket; brættet ligger nu 253-533 mod 207-487, og nederste række ligger dermed 27 px fra kanten. Ordre 821 blok 1 (ur ruller i syne) og blok 2 (Videre skubber ikke brættet i trin 7-12) er ikke målt af mig; kun trin 1 er prøvet.

## Ærlige grænser

Headless Chromium, ingen rigtig telefon, ingen børn. Mit første script ramte ikke hint og Giv op på 1280, fordi selektorerne fandt en skjult knap; `hint-829.mjs` viste, at knapperne findes og virker. Uret er ikke kørt ned, mat og remis er ikke spillet, gåden er set og hint prøvet, men ikke løst, og kun trin 1 af 32 i Lær skak er prøvet, ikke trin 7-12 fra ordre 821 eller 320 x 520. Computerens træk varierer. Chaturangas arbejdstræ (`skak.html`, `src/spil.js`, `src/styles.css` ændret, ikke committet) er ikke vurderet, kun det committede. Leveringen med hoest.mjs er forsøgt til sidst; se afleveringen.

## Betydning for Hara

Ingen.

## Hvad ændret
Kun filer under `docs/kritik-829/` og `outputs/kritik-829/`: elev-scripts, skærmbilleder, måletal og denne rapport. Intet i skakken er ændret.

## Testresultat
Ingen kode-test (kritik). Scripts kørte headless mod skak main (6cf7380): 360 x 560 og 390 x 844 touch, 1280 x 800 mus; hint og Giv op virker på 360 og 1280.

## Hvad er næste
Chaturanga retter de tre ting i første linje: analysen efter Giv op nedkortet og kortet øverst, rækken under brættet på 1280 ombrudt, og hoved og Lær skak-kort så brættet får luft (kræver Marcs ja til nye fanenavne).

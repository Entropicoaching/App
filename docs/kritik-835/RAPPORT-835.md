Klar til klassen: ja, paa telefon og computer (skak main 6cf7380). De tre vigtigste ting Chaturanga retter naeste gang: (1) efter Giv op mod computeren er siden stadig 2173 px lang paa 360 x 560 (var 2415), resultatkortet ("Du gav op mod niveau 1. Du stoppede selv.") ligger nederst under Spil-valgene, og oeverst staar "Ingen store fejl at vise" og "Noejagtighed 95 % / 87 %" for et parti, eleven selv gav op (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, Ja giv op, `outputs/kritik-835/360x560-E3-efter-giv-op-hel.png`; fil: `src/partianalyse.js` og `src/spil.js`; skjul noejagtighed og de tre taeller-raekker paa niveau 1-2 og efter Giv op, og flyt resultatkortet op under "Proev niveau 1 igen"); (2) paa 1280 x 800 er raekken under braettet stadig klippet: aabningsnavnet skaeres af ("Dronningebondep" mod knappen "Hvad spiller man her?"), "Hvad sker der" er skaaret over i hoejre kant, og raekken ligger i bunden af vinduet (skaerm: Spil, Mod computeren, d4, `outputs/kritik-835/1280x800-B1-computer-traek.png` og `1280x800-A3-efter-2-traek.png`; fil: `src/styles.css` og `src/skak.template.html`; lad raekken ombryde og giv aabningsnavnet egen linje); (3) hovedet (titel og to raekker faner) fylder stadig 148 px af 560 paa 360 x 560 og paa 320 x 520, saa braettet foerst begynder ved 148 og Giv op/Fortryd ligger ved 419-463 med kun urvalget under (skaerm: `outputs/kritik-835/320x520-A1-makker-efter-valg.png` og `360x560-A3-efter-2-traek.png`; fil: `src/skak.template.html`, `src/styles.css`; kraever Marcs ja til nye fanenavne).

## Gren

`kritik-835` fra `main`. Skakken hentet med `git archive main` (6cf7380, ordre 821 er merget; ordre-824 ligger paa Chaturangas gren og er ikke i main, saa jeg har ikke set den) til en midlertidig mappe og koert headless (Playwright: touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800). Scripts: `docs/kritik-835/elevtur-835.mjs`, `slut-835.mjs`, `laer-835.mjs` (den sidste er Chaturangas 821-script, tilpasset og koert mod main); skaermbilleder, maal og udskrifter i `outputs/kritik-835/`. Laest: RAPPORT-821 og RAPPORT-816 ("Hvad aendret", "Hvad er naeste"), MOD-LICHESS og foerste linje af min RAPPORT-829 ("Klar til klassen: ja, paa telefon og computer"). Kun syntetiske data; skakken er ikke aendret.

## Hvad jeg gjorde

Som en 11-aarig: parti mod computeren (e4 Nf3 Bc4 Nc3, hint, Giv op med bekraeftelse), makker-parti med ur 5+0 (e4 e5), en gaade, og Laer skak fra "Jeg er ny": trin 1 og trin 7-12 loest med tryk paa 320, 360, 390 og 1280.

## Kan en 11-aarig komme i gang uden hjaelp?

Ja. Spil giver to store valg, "Mod computeren" og "Mod en makker". Paa 320 og 360 staar braettet ved 148-412 (320) og 148-452 (360), og Fortryd og Giv op ligger lige under; i makker-partiet staar Hvid-ur, Fortryd, Giv op og Sort-ur paa een raekke, og folden hedder "Skakur og valg: ur 5+0" (skaerm `360x560-A3`). Efter Giv op staar "Hvid gav op. Sort vinder." over braettet, og "Gennemse partiet", "Nyt parti" og "Proev niveau 1 igen" ligger lige under det, uden at eleven skal rulle (`360x560-E2`). I Laer skak staar "Trin N af 32" og "Videre" i vinduet. Gaaden viser "Find det bedste traek" og "Vis et hint" under braettet (198-478 paa 360). Paa 1280 er alt i hoejre kolonne. Eleven ser altid braettet og det, der skal trykkes paa.

## Hvad er stadig besvaerligt eller rodet paa lav telefon

- Efter Giv op: 2173 px lang side, analyse med tal (95 % / 87 %, "Unoejagtigheder 1") efter et parti, der blev opgivet; resultatkortet nederst (fund 1).
- Hovedet paa 148 px (fund 3); paa 320 x 520 er braettet kun 264 px bredt, og urfolden ligger under Giv op.
- Gaaden vender braettet, naar sort skal traekke (bogstaverne staar h-a); der staar "Sort traekker (sort nederst)", men det er nyt for en 11-aarig.
- Paa 1280 er raekken under braettet klippet (fund 2), og "Kongebondeparti"/aabningsnavnet skaeres.

## Er mine seneste fund lukket?

829 fund 1 (analyse og resultatkort efter Giv op): delvist; siden er kortere (2173 mod 2415), og "Du stoppede selv"-teksten staar nu konsekvent, men kortet ligger stadig nederst og tallene staar stadig der. 829 fund 2 (raekken paa 1280): aaben, uaendret. 829 fund 3 (hovedet 148 px, Laer skak): hovedet aabent, venter paa Marcs ja; Laer skak trin 1-12 skubber ikke braettet over kanten: 320 x 520 trin 8, 9 og 12 har bund 519 af 520, trin 7-12 paa 360 bund 515-535 af 560 (trin 7 og 12: 535, 25 px luft), 390 og 1280 uden problem. Ordre 821 blok 2 er altsaa bekraeftet. Ordre 821 blok 1 (urvalget ruller i syne paa 320 og 360): ikke maalt rent; mit script vaelger 5+0 gennem folden og maalte ikke rulningen, men uret virker og begge ure ses ved braettet.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern. Paa 1280 ramte min elevtur ikke Giv op og Hint (skjulte knapper med samme id i mobil-raekken, samme som i 829), og gaadens hint blev ikke trykket af `slut-835`; 829 viste at hint virker, men jeg har ikke gentaget det. Uret er ikke koert ned, mat og remis er ikke spillet, gaaden er ikke loest, Laer skak trin 13-32 er ikke gennemgaaet. Computerens traek varierer. Chaturangas ordre 824 (ikke merget) er ikke vurderet. Ingen elevdata, ingen netkald. Leveringen med hoest.mjs blev afvist af tilladelsessystemet og er IKKE koert; se afleveringen.

## Betydning for Hara

Ingen.

## Hvad aendret

Kun filer under `docs/kritik-835/` og `outputs/kritik-835/`: elev-scripts, skaermbilleder, maal og denne rapport. Intet i skakken er aendret.

## Testresultat

Ingen kode-test (kritik). Headless mod skak main (6cf7380): Laer skak trin 7-12 loest paa 320, 360, 390 og 1280 uden sidescroll og uden at braettet gaar over kanten; elevtur, Giv op og gaade paa 320/360/390/1280.

## Hvad er naeste

Chaturanga retter de tre ting i foerste linje: analysen efter Giv op nedkortet og kortet oeverst, raekken under braettet paa 1280 ombrudt med aabningsnavnet paa egen linje, og hoved og Laer skak-kort saa braettet faar luft (kraever Marcs ja til nye fanenavne). Derefter Laer skak trin 13-18.

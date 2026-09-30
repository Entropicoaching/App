Klar til klassen: ja, paa telefon og computer (skak main edcb03f, ordre 824 er nu merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) efter Giv op mod computeren er siden 2179 px lang paa 360 x 560 (uaendret siden 835: 2173), resultatkortet "Du gav op mod niveau 1" ligger nederst under Spil-valgene, og oeverst staar "Noejagtighed 95 % / 90 %" og tre taeller-raekker for et parti eleven selv gav op (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-841/360x560-E3-efter-giv-op-hel.png`; fil: `src/partianalyse.js` og `src/spil.js`; skjul tal og taellere efter Giv op og paa niveau 1-2, flyt kortet op under "Proev niveau 1 igen"); (2) paa 1280 x 800 er raekken under braettet stadig klippet: aabningsnavnet skaeres af ("Dronningebondep" mod knappen "Hvad spiller man her?"), og "Hvad sker der" skaeres i hoejre kant, raekken med Vend braettet/Tavle/Pile ligger under vindueskanten (skaerm: Spil, Mod computeren, d4, `outputs/kritik-841/1280x800-B1-computer-traek.png`; fil: braetraekkens CSS og markup i `src/main.js`/`skak.html`; lad navnet have egen linje og raekken ombryde); (3) hovedet fylder 148 px paa lav telefon (titel + to raekker faner), saa braettet paa 320 x 520 kun er 264 px bredt; gaaden viser braettet spejlvendt (h-a) naar sort traekker, og "sort nederst" er nyt for en 11-aarig (skaerm: Gaader paa 320 x 520, `outputs/kritik-841/320x520-D1-gaade.png`; fil: `src/gaader.js` og hoved-markup i `skak.html`; hovedet kraever Marcs ja til nye fanenavne).

## Gren

`kritik-841` fra `main`. Skakken hentet med `git archive main` (edcb03f) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts: `docs/kritik-841/elevtur-841.mjs`, `slut-841.mjs`, `laer-841.mjs` (mine 835-scripts, koert paa ny). Laest: Chaturangas RAPPORT-824 og -821 ("Hvad aendret", "Hvad er naeste"), MOD-LICHESS (ranglisten) og foerste linje af min RAPPORT-835. Skaermbilleder og udskrifter i `outputs/kritik-841/`. Kun syntetiske data; skakken er ikke aendret.

## Hvad jeg gjorde

Som en 11-aarig: parti mod computeren (d4 / e4 Nf3 Bc4 Nc3, hint, Giv op med bekraeftelse), makker-parti med ur 5+0 (e4 e5), en gaade, og Laer skak fra "Jeg er ny": trin 1 og trin 7-12 loest med tryk paa alle fire stoerrelser.

## Kan en 11-aarig komme i gang uden hjaelp?

Ja. Spil giver to store valg, og efter start staar braettet oeverst med ure, Fortryd og Giv op paa een raekke (360 x 560: Hvid 5:00, Fortryd, Giv op, Sort 5:00, folden hedder "Skakur og valg: ur 5+0", `360x560-A3`). Efter Giv op staar "Hvid gav op. Sort vinder." over braettet og "Gennemse partiet", "Nyt parti", "Proev niveau 1 igen" lige under det (`360x560-E3`). I Laer skak staar trinnet oeverst og braettet under (`320x520-C1`), og "Videre" ligger i vinduet efter loesning. Gaaden viser "Find det bedste traek" og "Vis et hint" under braettet. Paa 1280 ligger alt i to kolonner. Eleven ser altid braettet og det, der skal trykkes paa.

## Hvad er stadig besvaerligt eller rodet paa lav telefon

- Efter Giv op: 2179 px lang side, analyse med tal og resultatkort nederst (fund 1).
- Hovedet paa 148 px; braettet paa 320 x 520 er 264 px bredt (fund 3).
- Gaade med sort: braettet vendes (h-a), og "Niveau: 0 af 10" og "Storm" fylder en raekke oppe ved braettet.
- Laer skak trin 7, 9 og 12 paa 320 x 520: braettet slutter ved 519 af 520 (ingen luft); paa 360 x 560 har trin 7 og 12 25 px luft (535 af 560). Ingen sidescroll, intet gaar over kanten.
- Paa 1280 er raekken under braettet klippet (fund 2).

## Er mine seneste fund lukket?

835 fund 1 (analyse og resultatkort efter Giv op): aabent, i praksis uaendret (2179 mod 2173 px); 824 lukkede kun den tomme fold ("Ingen store fejl"), ikke tallene og kortets placering. 835 fund 2 (raekken paa 1280): aabent, uaendret. 835 fund 3 (hovedet 148 px): aabent, venter paa Marcs ja. Ordre 824 blok 2 (Laer skak trin 1 med Videre): bekraeftet, trin 1 har titel, braet og besked uden at skubbe braettet. Ordre 821 blok 2 (trin 7-12): stadig bekraeftet (tal ovenfor). 824 blok 1 (skjult tom fold efter Giv op): set, ingen tom overskrift i `360x560-E3`.

## Aerlige graenser

Headless Chromium, ingen rigtig telefon, ingen boern. Paa 1280 ramte scripts ikke Giv op og Hint (skjulte knapper med samme id i mobilraekken; Giv op ses dog i `1280x800-B1`), og gaadens hint blev ikke trykket paa 360 og 1280. Uret er ikke koert ned, mat og remis ikke spillet, gaaden ikke loest, Laer skak trin 13-32 ikke gennemgaaet. Computerens traek varierer. Ingen elevdata, ingen netkald. Skakkens testsuite er ikke koert (kritik). Leveringen med hoest.mjs blev afvist af tilladelsessystemet og er IKKE koert.

## Betydning for Hara

Ingen.

## Hvad aendret

Kun filer under `docs/kritik-841/` og `outputs/kritik-841/`. Intet i skakken er aendret.

## Testresultat

Ingen kode-test (kritik). Headless mod skak main (edcb03f): elevtur, Giv op, gaade og Laer skak trin 7-12 paa 320, 360, 390 og 1280 uden sidescroll.

## Hvad er naeste

Chaturanga retter de tre ting i foerste linje: analysen efter Giv op nedkortet og kortet oeverst, raekken under braettet paa 1280 ombrudt, og hoved/gaadevisning med Marcs ja. Derefter Laer skak trin 13-18.

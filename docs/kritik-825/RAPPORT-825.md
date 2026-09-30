Klar til klassen: ja, på telefon og computer (skak main 9a7231c). De tre vigtigste ting Chaturanga retter næste gang: (1) efter Giv op ligger resultatkortet "Du gav op mod niveau 1. Du stoppede selv." nederst på en side på 2188 px på 360 x 560, under Spil-valgene, så eleven ikke ser det, og over analysen står "Ingen store fejl at vise" med tomt rum (skærm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, Ja giv op, `outputs/kritik-825/360x560-E3-efter-giv-op-hel.png`; fil: `src/spil.js` og `src/partianalyse.js`; flyt kortet op lige under brættet og skjul overskriften, når der intet er at vise); (2) hovedet (titel og to rækker faner) fylder stadig 148 px af 560 på 360 x 560, så brættet først begynder ved 148 (skærm: `outputs/kritik-825/360x560-A2-ur-5-0.png`; fil: `src/skak.template.html` og `src/styles.css`; kræver Marcs ja til nye fanenavne); (3) i Lær skak skubber tekstkort og "Videre" brættet ned til 207-487 på 360 x 560, så rækken 1 rører kanten (skærm: Lær skak, Jeg er ny, trin 1 løst, `outputs/kritik-825/360x560-F1-laer-trin1-loest.png`; fil: `src/laer.js` og `src/styles.css`; hold tekstkortet til to linjer).

## Gren

`kritik-825` fra `main`. Skakken hentet med `git archive main` fra `C:\Users\Entropi\Desktop\skak` (9a7231c; ordre 809, 816 og 821 er merget) og kørt headless (Playwright, touch på 360 x 560 og 390 x 844, mus på 1280 x 800). Scripts: `docs/kritik-825/elevtur-825.mjs` og `slut-825.mjs`; skærmbilleder og `maal-825.json` i `outputs/kritik-825/`. Kun syntetiske data, skakken er ikke ændret. Læst: Chaturangas RAPPORT-816 og RAPPORT-812, MOD-LICHESS (ranglisten efter 816) og første linje af min RAPPORT-813.

## Hvad jeg gjorde

Som en 11-årig: et parti mod computeren (e4 Nf3 Bc4 Nc3, hint, Giv op med bekræftelse), et makker-parti med ur 5+0 (e4 e5, Giv op-dialogen), Lær skak fra "Jeg er ny" (trin 1 løst) og en gåde. Målt på 360 x 560, 390 x 844 og 1280 x 800.

## Kan en 11-årig komme i gang uden hjælp?

Ja. Spil viser to store valg, "Mod computeren" og "Mod en makker". På 360 x 560 står brættet ved 148-452 og Fortryd, Hint og Giv op lige under (459-503). I makker-partiet står begge ure (Hvid 5:00, Sort 5:00) på samme række, og folden hedder nu "Skakur og valg: ur 5+0" og kan ses i kanten. Giv op spørger "Giv op? Modstanderen vinder partiet." med "Ja, giv op" og "Annuller". I Lær skak står "Trin 1 af 32", "Klik e4", en grøn ring, og "Videre" (183-227) er i vinduet. Gåden viser "Find det bedste træk", brættet 198-478 og "Vis et hint" under. Eleven ser altid brættet og det, der skal trykkes på.

## Hvad er stadig besværligt eller rodet på lav telefon

- Efter Giv op er siden 2188 px lang på 360. Resultatkortet ligger under Spil-valgene, og "Ingen store fejl at vise" står over tomt rum (fund 1).
- Hovedet på 148 px (fund 2).
- Lær skak: tekstkort, "Videre" og bræt fylder så meget, at brættet ligger 207-487 og rækken 1 rører kanten (fund 3).
- Selve valget af ur (620-672) ligger stadig under kanten på 360 x 560, men urene ved brættet ses, så det blokerer ikke længere.
- Analysen viser "Nøjagtighed 96 % / 68 %" og "Bukke" efter et parti, der kun blev givet op; det er svært for en 11-årig at forstå.

## Er mine seneste fund lukket?

813 fund 1 (Du tabte / tomt spørgsmål): næsten lukket; kortet siger nu "Du gav op ... Du stoppede selv", men overskriften "Ingen store fejl at vise" står stadig over tomt rum. 813 fund 2 (skakur under kanten): delvist lukket; folden hedder "Skakur og valg", urene ses, valget er stadig under kanten. 813 fund 3 (hovedet 148 px): åbent, venter på Marcs ja.

## Ærlige grænser

Headless Chromium, ingen rigtig telefon, ingen børn. På 1280 x 800 fandt mit script ikke Giv op og Hint (knapperne har andre navne på computer), så computerens slutkort er ikke set. Gåden er set, ikke løst, og hint-knappen ikke trykket (scriptets selektor ramte ikke). Uret er ikke kørt ned, mat og remis er ikke spillet, kun trin 1 af 32 i Lær skak er prøvet, og trin 7-12 fra ordre 821 er ikke set. Computerens træk varierer. Leveringen med hoest.mjs blev afvist af tilladelsessystemet og er ikke kørt.

## Betydning for Hara

Ingen.

Klar til klassen: ja, på telefon og computer (main, ab07b56, ordre 805 merget; ordre 809 ligger på grenen `ordre-809` og er ikke merget). De tre vigtigste ting Chaturanga retter næste gang: (1) efter Giv op i et længere parti står stadig "Du tabte mod niveau 1" i det røde kort, lige under tallene "100 % nøjagtighed, 0 fejl", og "Vil du se, hvad du kunne have gjort?" er en overskrift med tomt rum under sig (skærm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-813/360x560-L2b-giv-op-langt-hel.png`; fil: `src/partianalyse.js` og `src/spil.js`; "Du gav op" ligger på `ordre-809`: merge den, og skjul overskriften, når der ikke er noget at svare med); (2) skakur-valget ligger under kanten på 360 x 560 (620-672 mod vindue 560), og folden under brættet hedder stadig "Valg: intet ur", så en 11-årig ikke ved, at uret gemmer sig der (skærm: Spil, Mod en makker, `outputs/kritik-813/360x560-A1-makker-efter-valg.png`; fil: `src/skak.template.html` og `src/main.js`, folden `#spil-valg-fold`; navnet "Skakur og valg" ligger på `ordre-809`; åbn folden som standard i makker-parti); (3) hovedet (titel og to rækker faner) fylder 148 px af 560 på 360 x 560, så brættet først begynder ved 148 (skærm: alle `360x560-*.png`, fx `360x560-A3-efter-2-traek.png`; fil: `src/skak.template.html` og `src/styles.css`; kræver Marcs ja til nye fanenavne).

## Gren

`kritik-813` fra `main`. Skakken hentet med `git archive main` fra `C:\Users\Entropi\Desktop\skak` (ab07b56) til en midlertidig mappe og kørt derfra headless (Playwright, touch på 360 x 560 og 390 x 844, mus på 1280 x 800). Scripts: `docs/kritik-813/elevtur-813.mjs` og `laengere-813.mjs`; udskrifter og skærmbilleder i `outputs/kritik-813/`. Kun syntetiske data, skakken er ikke ændret. Læst: Chaturangas RAPPORT-809 og RAPPORT-805, `docs/MOD-LICHESS.md` (ranglisten) og første linje af min seneste skak-kritik (808).

## Hvad jeg gjorde

Som en 11-årig: et parti mod computeren (d4, hint, senere e4 Nf3 Bc4 Nc3 og Giv op), et makker-parti med ur 5+0 (e4 e5, Giv op), første trin i "Lær skak" fra "Jeg er ny" og en gåde. Alt på 360 x 560, 390 x 844 og 1280 x 800.

## Kan en 11-årig komme i gang uden hjælp?

Ja. Spil-fanen viser to store valg, "Mod computeren" og "Mod en makker". På 360 x 560 står brættet ved 148-452, og Fortryd, Hint og Giv op ligger 459-503 lige under det, så eleven ser både brættet og det, der skal trykkes på. I Lær skak står "Trin 1 af 32" med teksten "Klik e4" og en grøn ring om feltet. I gåden står "Find det bedste træk", brættet er helt synligt (198-478), og "Vis et hint" ligger 484-528. Hintet i partiet svarer i klart sprog ("Ingen fare lige nu, spil dit plan."). Ingen sidescroll på nogen skærm. På 1280 x 800 er uret, knapperne og Giv op inde i vinduet, så 754's fund om Giv op er stadig lukket.

## Hvad er besværligt eller rodet på lav telefon

- Efter et parti er siden lang (over 1.700 px på 360): brættet, to sæt knapper ("Gennemse partiet", "Nyt parti", "Prøv niveau 1 igen"), analysen og til sidst det røde resultatkort langt nede. Kortet siger "Du tabte" efter Giv op, og det passer ikke til "0 fejl" (fund 1).
- Skakuret er under kanten på 360 x 560 (fund 2).
- Hovedet fylder over en fjerdedel af skærmen (fund 3).
- "Vil du se, hvad du kunne have gjort?" står med tomt rum under sig, når motoren ikke finder fejl (595-655 mod vindue 560 uden fuld side).
- I Lær skak ligger "Vend brættet" og "Pile og streger: til" lige under brættet på 360 x 560 og er delvis under kanten; de hører ikke hjemme i trin 1 for en, der er ny.

## Er mine seneste fund lukket?

808 fund 1 (Du tabte / tomt spørgsmål): nej på main. Rettet på `ordre-809`, ikke merget. 808 fund 2 (skakur under kanten): nej på main; navnet er rettet på `ordre-809`, pladsen er uændret. 808 fund 3 (hovedet 148 px): åbent, venter på Marcs ja. Det hurtigste: merge `ordre-809` til main, så lukkes to af tre.

## Ærlige grænser

Headless Chromium, ingen rigtig telefon, ingen børn. Makker-partiet er kun spillet to træk, og uret er ikke kørt ned. Gåden er set, ikke løst; lektionen er kun prøvet på trin 1 af 32. Kun Giv op i et længere parti er set; mat og remis er ikke spillet. Computeren spillede svage træk på niveau 1, så analysen kan variere. Jeg har ikke prøvet grenen `ordre-809`, da ordren siger, at kun main skal vurderes. Afleveringen med `hoest.mjs --aflever` blev afvist af auto-klassificeren og er ikke kørt. Betydning for Hara: ingen.

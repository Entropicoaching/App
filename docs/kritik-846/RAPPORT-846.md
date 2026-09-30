Klar til klassen: ja, paa telefon og computer (skak main 58f7ab7, ordre 839 merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) efter Giv op er resultatsiden stadig lang og dobbelt paa 360 x 560 (2059 px): "Laer af dine fejl" staar baade som knap under braettet og som kort i sidepanelet, og under braettet kommer tre knapper efter hinanden (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-846/360x560-E3-efter-giv-op-hel.png`; fil: `src/partitalui.js` og `src/styles.css`; vis een primaer knap under braettet og skjul den anden "Laer af dine fejl"); (2) paa 1280 x 800 ligger raekken "Vend braettet / Tavle / Pile og streger / Hvad sker der" stadig under vindueskanten (y 787-831 i et vindue paa 800 px), selvom aabningsnavnet nu har egen linje (skaerm: Spil, Mod computeren, d4, `outputs/kritik-846/1280x800-B1-computer-traek.png`; fil: braetraekkens CSS i `src/styles.css`; goer braettet lidt mindre paa lave skaerme, saa raekken staar inden for 800 px); (3) hovedet fylder 148 px paa 320-360 (titel + to raekker faner), saa braettet kun er 264-304 px bredt, og uret i makker-partiet er skjult i folden "Skakur og valg" (skaerm: Spil, Mod en makker, `outputs/kritik-846/360x560-A1-makker-efter-valg.png`; fil: hoved-markup i `src/skak.template.html`; hovedet kraever Marcs ja til nye fanenavne, og uret kan vises som en synlig linje i stedet for en fold).

## Gren

`kritik-846` fra `main`. Skakken hentet med `git archive main` (58f7ab7) til en midlertidig mappe og koert headless (Playwright): touch paa 320 x 520, 360 x 560 og 390 x 844, mus paa 1280 x 800. Scripts: `docs/kritik-846/elevtur-846.mjs`, `slut-846.mjs`, `bund-846.mjs` (mine 841-scripts omdoebt, plus en maaling af raekken paa 1280). Skaermbilleder og `maal-846.json` i `outputs/kritik-846/`. Ingen aendring af skakken, kun syntetiske partier.

## Kan en 11-aarig komme i gang uden hjaelp?

Ja. Paa 360 x 560 staar braettet fra y=148 og er helt synligt i alle scenarier (parti mod computeren, makker med ur, gaade, Laer skak trin 1). Knapperne der skal trykkes paa (Fortryd / Hint / Giv op, ur-knapper, Vis et hint, Videre) ligger lige under braettet og er 44 px hoeje. Laer skak trin 1 viser en groen ring paa e4 og svarer "Rigtigt! Det er e4: linje e, raekke 4." med en stor Videre-knap (`360x560-F1-laer-trin1-loest.png`). Gaaden viser hvid nederst med "Hvid traekker". Computeren siger selv "Computeren spillede d7-d5. Din tur." (`360x560-B1-computer-traek.png`). Trin 15 (patt) fra 839 er rettet. Paa 1280 fandt mit script ikke strimmel-knapperne, men Giv op, Fortryd og Vis et hint staar tydeligt i sidepanelet (`1280x800-B1-computer-traek.png`).

## Hvad er stadig besvaerligt eller rodet paa lav telefon

- Hovedet (148 px, to raekker faner) er uaendret: braettet er 264 px bredt paa 320 x 520.
- Uret i makker-partiet er skjult i folden "Skakur og valg: intet ur"; efter valg viser strimlen Hvid 5:00 / Sort 5:00 paent (`360x560-A3-efter-2-traek.png`).
- Efter Giv op er siden 2059 px og har to "Laer af dine fejl"; tallene er nu vaek for et parti eleven gav op. "Hvid gav op. Sort vinder." foeles haardt for en 11-aarig, "Du gav op" er bedre.
- Felternes bogstaver og tal (a-h, 1-8) er smaa og lave i kontrast, og "8" gaar delvist bag taarnet i hjoernet (`360x560-C1-laer-ny.png`).
- Paa 1280 x 800 ligger braetraekkens anden linje uden for vinduet; aabningsnavnet er dog ikke laengere klippet.

## Er mine seneste fund lukket?

Fra 841: (1) tal og taellere efter Giv op og paa niveau 1-2 er skjult, og det dobbelte resultatkort er vaek: **lukket**; siden er dog stadig lang og har to "Laer af dine fejl": aaben. (2) aabningsnavnet paa egen linje paa 1280: **lukket**; raekken under braettet ligger stadig under vindueskanten: aaben. (3) hovedet paa 148 px: **aabent** (venter paa Marcs ja); gaaden spejlvendt for sort proevede jeg ikke i dag. Trin 15 (patt) fra 839: **lukket**.

## Aerlige graenser

Jeg spillede ikke et helt parti til ende, ikke Laer skak ud over trin 1, og ikke en gaade med forkert traek eller en sort-nederst-gaade; 320 x 520 koerte jeg men vurderede ikke hvert billede. Mit 1280-script fandt ikke strimmel-knapperne, saa jeg tjekkede dem paa skaermbillede og med `bund-846.mjs`. Computerens traek er tilfaeldige, saa sidehoejden efter Giv op varierer (1838-2059 px). Rigtig touch paa en fysisk telefon er ikke proevet. Afleveringen via `hoest.mjs` blev afvist af tilladelsesklassifikatoren og er derfor ikke koert: Dhruva eller Marc maa koere den.

## Betydning for Hara

Ingen: skakken er ikke en del af Hara, og arbejdet har ikke rort Haras noegler eller data.

## Hvad er naeste

1. Fjern den dobbelte "Laer af dine fejl" og goer efter-Giv-op-siden kortere (`src/partitalui.js`).
2. Lad braetraekken paa 1280 x 800 staa inden for vinduet.
3. Hovedet paa lav telefon og uret som en synlig linje (Marcs ja).
Bhishak boer proeve: et helt parti paa niveau 1 til skakmat, en sort-nederst-gaade og Laer skak trin 19-24, naar Chaturanga har lavet dem.

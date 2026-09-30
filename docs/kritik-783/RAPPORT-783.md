Klar til klassen: ja, på telefon og computer; men de tre ting fra 777 er ikke lukket i main, fordi Chaturangas ordre 779 ligger på grenen `ordre-779` og ikke er merget. De tre ting Chaturanga retter næste gang: (1) få 779 ind i main, og flyt hint-svaret op i skærmbilledet: på main står "Hint" mod computeren stadig 1188 px nede på 360 x 560 (og 1339 på 390 x 844), og i statuslinjen sker der intet (skærm: Spil, Mod computeren, 1. e4 e5, tryk Hint, `main-360x560-1-hint.png`; fil: `visSpilHint` i `src/spil.js`, `#spil-hint-besked` i `src/skak.template.html`); (2) efter "Giv op" står der stadig "Motoren fandt intet træk, hvor du tabte meget. Godt spillet!", og lige under den en gammel hint-linje, "Ingen tydelig fare eller svaghed at pege på lige nu.", i et parti der er slut (skærm: Spil, Mod computeren, giv op, `main-1280x800-3-efter-giv-op.png`; fil: teksten omkring linje 774 i `src/spil.js`, og hint-linjen ryddes ikke, når partiet slutter); (3) to lyd-afkrydsninger har næsten samme navn på main ("Lyd: træk, skak og partislut" i Spil og "Lyd ved tryk og lav tid" i skakur-valget), men 779 omdøber kun den første til "Lyd i partiet (træk, skak, slut)", og den anden hedder det samme, så eleven stadig ikke kan se, hvilken der er hvilken (skærm: Spil, Mod en makker, åbn valgfolden, `main-360x560-5-makker-fold-aaben.png`; fil: `#skakur-lyd` og `#spil-lyd` i `src/skak.template.html`).

# Ordre 783, Bhishak, 30. sep. 2026

Vurderet: skakken på `main` (efedfaa, ordre 775 er sidste merge), hentet med `git archive` og kørt lokalt fra en midlertidig mappe. Til sammenligning har jeg kørt `ordre-779` (179423f) på samme måde, kun for at se, hvad der mangler. Ingen ændring i skakken. Kun syntetiske data (tomme profiler).

## Kan en 11-årig komme i gang uden hjælp?

Ja. Målt på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk profil hver gang:

- **Parti mod computeren.** "Spil", "Mod computeren", e2-e4: brættet står øverst på alle tre (360: 148-452, 390: 228-602, 1280: 140-677) og computeren svarer med e7-e5 og en tydelig "Din tur." Knapperne Fortryd, Hint og Giv op er 44 px høje under brættet på telefon.
- **Makker-parti med ur.** Valgfolden "Valg: intet ur" er synlig uden at rulle (360: 506-550). Åbner man den, rulles siden, men brættet er stadig inde (16-320) og ur-valget er inde (504-556), så 762's fund er lukket. Ur-knapperne er 46 x 44 px og intet er afskåret. Efter 5+0 og to træk står uret ("Hvid 5:00") lige under brættet på telefon. Måling: `udskrift-fund-main.txt`.
- **Gåde.** Brættet og "Hvid trækker / Find det bedste træk." er synlige på alle tre; Hint giver først den fremhævede brik ("Hint: se den fremhævede brik."), og et andet tryk viser trækket. Ingen sidefejl.
- **Lær skak, "Jeg er ny".** Trin 1 "Brættet" siger "Klik e4" med en grøn ring på e4; efter trykket kommer "Rigtigt!" og "Videre ›" (360: 183-227, brættet 254-534, altså alt i billedet), og trin 2 "Kongen" starter med en opgave. Trin 2's tekst er lang for en 11-årig ("saml alle stjernerne - på så få træk som muligt", "færrest mulige: 4"), men den kan læses.
- **Efter giv op på 360.** Brættet, "Hvid gav op. Sort vinder.", "Gennemse partiet", "Nyt parti" og "Prøv niveau 1 igen" står alle i første skærmbillede (`main-360x560-3-efter-giv-op.png`). Det er godt.

## Hvad er stadig besværligt eller rodet på lav telefon?

- **Hint mod computeren (fund 1 fra 777, stadig åbent på main).** Trykket giver ingen synlig forskel: statuslinjen siger stadig "Computeren spillede e7-e5. Din tur.", og svaret "Ingen tydelig fare eller svaghed at pege på lige nu." står 1188 px nede (560-vinduet er 560 høj). På 779-grenen står svaret i statuslinjen ("Ingen fare lige nu, spil dit plan."), hvilket løser det, men der er også en kopi 1188 px nede, som ingen ser; den er ufarlig.
- **Efter giv op (fund 3 fra 777, stadig åbent, også på 779).** På 1280 står "Godt spillet!" under "Tre steder hvor partiet vendte", efter en opgivelse i træk 1, og under den et gammelt hint-svar. På 360 ligger "Tre steder ..." 595-635, under kanten, og teksten var tom på min måling; jeg har ikke set, hvad en elev får at læse dér, så det er ikke vurderet.
- **To lyd-afkrydsninger med næsten samme navn** (se punkt 3 øverst): en elev på 1280 ser "Lyd: træk, skak og partislut" i panelet, og de andre lyd-valg er gemt i valgfolden.
- Ellers er lav telefon rimelig: ingen sidescroll på nogen af de tre størrelser, og ingen knapper under 44 px på 360 og 390 (1280 har 40 px-knapper, men det er mus).

## Er mine seneste fund lukket? (777)

| Fund fra 777 | På main | På ordre-779 |
|---|---|---|
| 1. Hint gør ingenting, man kan se | Nej, svaret står 1188 px nede | Ja, svaret står i statuslinjen |
| 2. To lyd-afkrydsninger med næsten samme navn | Nej | Delvist: den ene er omdøbt til "Lyd i partiet (træk, skak, slut)", den anden hedder stadig "Lyd ved tryk og lav tid" |
| 3. "Godt spillet!" efter at have givet op | Nej | Nej, teksten er uændret |

Fund fra 762 (valgfold, hjælpeknapper, kalibrering) er lukket i 760, 767, 770, 773 og 775; det har jeg genset (valgfolden, ur-knapperne og gåde-skærmen).

## Testresultat

Kørt med Playwright headless mod en `git archive`-kopi af main og af ordre-779; ingen sidefejl (`pageerror`) i noget scenarie. Scripts: `docs/kritik-783/fund-783.mjs` (den rene måling af hint, lyd, giv op og ur), `elevtur-783.mjs`, `elevtur2-783.mjs`, `hint-783.mjs`, `slut-783.mjs`. Udskrifter og skærmbilleder i `outputs/kritik-783/`. **De ældre scripts (elevtur, elevtur2, hint, slut) er gamle 777-scripts med selektorer, der ikke rammer alt på 1280 (fx `#strimmel-*` findes kun på telefon); deres "kunne ikke trykke"-linjer er scriptets, ikke skakkens. De pålidelige måler er `main-*` og `779-*` fra `fund-783.mjs`.**

## Hvad er næste og ærlige grænser

- Chaturanga: merge 779, og ret så de tre ting øverst (giv-op-teksten, den gamle hint-linje efter partiets slut, det andet lyd-navn). Alle tre er små.
- Jeg har ikke spillet et helt parti til mat, ikke prøvet en rigtig telefon, ikke målt lyd, og ikke kørt Storm eller "Klassens turnering". Ur-nedtælling og lav-tid-lyd er ikke vurderet.
- Har arbejdet betydning for Hara? Nej.

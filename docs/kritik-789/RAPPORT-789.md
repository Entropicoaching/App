Klar til klassen: ja, på telefon og computer. De tre ting Chaturanga retter næste gang: (1) hint-linjen "Ingen fare lige nu, spil dit plan." står stadig i et parti, der er slut, og Giv op-spørgsmålet "Vil du se, hvad du kunne have gjort?" står under kanten på telefon (skærm: Spil, Mod computeren, giv op, `main-360x560-3-efter-giv-op.png` og `main-360x560-3b-efter-giv-op-hel.png`; fil: `src/spil.js`, hint-teksten ryddes ikke ved partiets slut, se linje 418 og 605 for hvor den ryddes ellers); (2) Lær skak trin 2 "Kongen" giver stadig tre ting på én gang: kongen, ringen og en stjernejagt med tællere (skærm: Lær skak, Jeg er ny, e4, Videre; fil: `src/laerforloeb.js` linje 38-45); (3) "Tre steder hvor partiet vendte" viser "100 % / 100 %", nuller og en tom graf efter et parti på ét træk, hvilket er forvirrende for en elev (skærm: `main-360x560-3b-efter-giv-op-hel.png`; fil: vendepunkt-visningen i `src/spil.js`; vis en kort tekst i stedet, når der er for få træk).

# Ordre 789, Bhishak, 30. sep. 2026

Vurderet: skakken på `main` (dbb0fab, med 779 og 782 merget), hentet med `git archive` og kørt headless i Playwright fra en midlertidig mappe. Ingen ændring i skakken. Kun syntetiske data (tomme profiler). Scripts: `docs/kritik-789/fund-789.mjs` og `elevtur-789.mjs`; udskrifter og skærmbilleder i `outputs/kritik-789/`.

## Kan en 11-årig komme i gang uden hjælp?

Ja. Målt på 360 x 560, 390 x 844 (touch) og 1280 x 800 (mus):

- **Parti mod computeren.** Brættet står øverst på alle tre (360: 148-452, 390: 228-602, 1280: 140-677), og Fortryd, Hint og Giv op er 44 px høje lige under brættet på telefon.
- **Makker med ur.** Valgfolden "Valg: intet ur" er synlig uden at rulle (360: 506-550). Åbnes den, rulles siden 132 px på 360, men brættet (16-320) og ur-valget (504-556) er stadig inde. Efter 5+0 og to træk står "Hvid 5:00" under brættet (360: 459-503). Ur-knapper er 46 x 44 px (390: 51 x 44).
- **Gåde.** Brættet og "Hvid trækker" er synlige på alle tre; hint-knappen står under brættet på telefon (360: 484-528).
- **Lær skak, "Jeg er ny".** Trin 1 siger "Klik e4" med en grøn ring; brættet står 207-487 på 360, alt i billedet.
- **Hint mod computeren.** Svaret står nu i statuslinjen over brættet (360: 101-144, "Ingen fare lige nu, spil dit plan."). Lukket.

## Hvad er stadig besværligt eller rodet på lav telefon?

- **Efter Giv op (360 x 560).** Brættet, "Hvid gav op. Sort vinder.", "Gennemse partiet", "Nyt parti" og "Prøv niveau 1 igen" er i første skærmbillede; det er godt. Men "Tre steder hvor partiet vendte" ligger 595-655, under kanten (vindue 560), så den nye tekst om at se, hvad man kunne have gjort, ses ikke uden at rulle. På 1280 står den synligt (508-574).
- **Gammel hint-linje i et slut-parti.** I hele-siden-billedet står "Ingen fare lige nu, spil dit plan." stadig nederst i Spil-panelet efter "Du tabte mod niveau 1".
- **Tom analyse efter et parti på ét træk:** "100 % / 100 %", nul unøjagtigheder og en tom mørk graf, uden forklaring.
- **Lær skak trin 2** er uændret (se dommen).
- Ellers rimeligt: ingen knapper under 44 px på telefon (1280 har 40 px, men det er mus).

## Er mine seneste fund lukket? (783)

| Fund | På main nu |
|---|---|
| 1. Hint mod computeren står 1188 px nede | Ja: svaret står i statuslinjen (779 er merget). Kopien 1188 px nede er ufarlig |
| 2. "Godt spillet!" efter Giv op og gammel hint-linje | Halvt: teksten er rettet (782) og synlig på 1280, men hint-linjen står stadig, og spørgsmålet er under kanten på telefon |
| 3. Trin 2 "Kongen" for mange ting på én gang | Nej, uændret |
| (777) to lyd-navne | Ja: "Lyd i partiet (træk, skak, slut)" og "Lyd fra uret (tryk, lav tid)" |

## Testresultat

Ingen sidefejl i scripts på nogen størrelse. Scriptets "kunne ikke trykke"-linjer på 1280 (`#strimmel-*`, `#spil-valg-fold summary`) er scriptets, ikke skakkens: de elementer findes kun på telefon. De pålidelige målere er `main-*`-linjerne i `outputs/kritik-789/udskrift-fund-main.txt`.

## Hvad er næste og ærlige grænser

- Chaturanga: de tre ting i dommen; alle er små. Nr. 1: ryd hint-linjen ved partiets slut, og lad vendepunkternes tekst stå over folden på telefon.
- Ikke gjort: et helt parti til mat eller tabt på tid, Storm, Klassens turnering, lyd, en rigtig telefon eller rigtige børn. Ur-nedtælling er ikke vurderet. Trin 2 i Lær skak er vurderet fra kildefilen og 783-skærmbilledet, ikke spillet igen.
- Har arbejdet betydning for Hara? Nej.
- Aflevering til Hara (`hoest.mjs --aflever`) blev afvist af tilladelsessystemet og er ikke kørt; rapporten er committet på kritik-789.

Klar til klassen: ja, på telefon og computer (main, dc725c9). De tre vigtigste ting Chaturanga retter næste gang er de samme som i 796, fordi de rettelser, der findes (ordre 795), ligger på grenen `ordre-795` og ikke er merget til main: (1) spørgsmålet "Vil du se, hvad du kunne have gjort?" står under kanten efter Giv op på 360 x 560 (595-655 mod vindue 560) og 390 x 844 (777-837 mod 844), og efter et kort parti svarer folden "Partiet var for kort til en analyse" (skærm: Spil, Mod computeren, e4, Giv op, `main-360x560-3b-efter-giv-op-hel.png`; fil: `src/spil.js` og `src/partitalui.js`, skjul spørgsmålet under seks halvtræk); (2) efter et parti står "Gennemse partiet" og "Nyt parti"/"Prøv niveau 1 igen" to gange på telefon, og under Gennemse står tre valg en 11-årig ikke skal bruge lige efter et tab (skærm: samme billede; fil: slut-kortet i `src/skak.template.html` og `src/spil.js`; ét sæt knapper); (3) "Forhåndstræk" er afkrydset som standard blandt lyd-valgene i Spil (skærm: samme billede, feltet under "Lyd i partiet"; fil: `src/forhaandui.js` linje 9 og 15; slå fra som standard eller flyt under Avanceret). Gør først: merge 795 til main.

# Ordre 802, Bhishak, 30. sep. 2026

## Gren

`kritik-802` fra `main`. Ingen push. Commits: se git log på grenen.

Vurderet: skakken på `main` (dc725c9, 791 merget, 795 ikke), hentet med `git archive` til en midlertidig mappe og bygget der. Den byggede `skak.html` er identisk med den i main (samme md5), så filen klassen henter er ajour. Kørt headless i Playwright, frisk profil pr. scenarie. 360 x 560 og 390 x 844 med touch, 1280 x 800 med mus. Kun syntetiske data. Scripts: `docs/kritik-802/elevtur-802.mjs`, `fund-802.mjs`, `laer-gaade-802.mjs`. Udskrifter og skærmbilleder i `outputs/kritik-802/`.

## Kan en 11-årig komme i gang uden hjælp?

Ja. Brættet er i første skærmbillede i alle fire prøver, og det, der skal trykkes på, står lige under eller over det.

- **Parti mod computeren.** Brættet ligger 148-452 på 360, 228-602 på 390 og 140-677 på 1280. Fortryd, Hint og Giv op er 44 px høje under brættet på telefon. Hint-svaret står i statuslinjen over brættet ("Ingen fare lige nu, spil dit plan.").
- **Makker med ur.** "Valg: intet ur" er synligt uden at rulle (360: 506-550). Ur-knapperne er 46 x 44 (390: 51 x 44). Efter 5+0 og to træk står "Hvid 5:00" og "Sort 5:00" under brættet (360: 459-503); brættet er stadig i første skærm.
- **Gåde.** Brættet og "Hvid trækker." er synlige; "Vis et hint" står under brættet på telefon (360: 484-528).
- **Lær skak, "Jeg er ny".** Trin 1 "Brættet" siger "Klik e4"; trin 2 "Kongen" har én sætning og tre stjerner, brættet i første skærm (360: 223-503).

## Hvad er stadig besværligt eller rodet på lav telefon?

- **Efter Giv op på 360 x 560** er Nyt parti (455-499) i første skærm, men "Vil du se, hvad du kunne have gjort?" ligger under kanten, og svaret bagefter er "Partiet var for kort" (fund 1).
- **Dobbelte knapper og små valg** efter et parti (fund 2). Siden er ca. 1900 px lang; Nyt parti er i første skærm, så det er rod og ikke en spærring.
- **Forhåndstræk til som standard** (fund 3): en elev kan få et træk spillet, hun ikke selv så komme.
- **Ur-valget** ligger 620-672 på 360, under kanten, indtil folden åbnes; "Valg: intet ur" viser dog, at der er et valg. Åbnes folden, rulles siden 132 px, men brættet (16-320) er stadig inde.
- **Hint-kopien** i besked-elementet ligger 1188 px nede (uændret, ufarlig, da svaret står i statuslinjen).
- Ingen knapper under 44 px på telefon (1280: 40 px, mus). Ingen sidefejl i Lær skak og gåde.

## Er mine seneste fund lukket? (796)

| Fund | På main nu |
|---|---|
| 1. Giv op-spørgsmålet under kanten / passer ikke til "for kort" | Nej, uændret (595-655 på 360; 777-837 på 390). Rettet på `ordre-795` (`RAPPORT-795.md`), ikke merget |
| 2. Dobbelte knapper og tre små valg efter et parti | Nej på main; 795 blok 2 samler dem på grenen (ikke prøvet af mig, ikke merget) |
| 3. Forhåndstræk til som standard | Nej; 795 nævner det selv som næste punkt |

Ingen af de tre er lukket på main. Jeg har ikke kørt `ordre-795`, fordi ordren siger main.

## Hvad ændret

Ingen ændring i skakken (kun kritik). Leveret: dommen i første linje, vurderingen ovenfor, tre scripts i `docs/kritik-802/` og skærmbilleder og udskrifter i `outputs/kritik-802/`.

## Testresultat

Ingen sidefejl på 360, 390 og 1280. Scriptets "kunne ikke trykke"-linjer på 1280 (`#spil-valg-fold`, `#spil-valg-resume`, `#strimmel-*`) er scriptets, ikke skakkens: de elementer findes kun på telefon. Linjen med `data-square="undefined"` er gåde-scriptet, der ikke fandt en brik at flytte. Skærmbilleder: `main-*-3b-efter-giv-op-hel.png`, `*-A3-efter-2-traek.png`, `*-B1-computer-traek.png`, `*-C1-laer-ny.png`, `*-E-laer-trin2-kongen.png`, `*-D1-gaade.png`.

## Hvad er næste

- Chaturanga: merge 795 til main, tjek så at fund 1-3 er væk på 360 x 560 og 390 x 844, og genbyg `skak.html`.
- Har arbejdet betydning for Hara? Nej.

## Ærlige grænser

- **Ikke gjort:** et helt parti til mat eller tabt på tid, ur-nedtælling, Storm, en gåde med forkert træk (mit script fandt ingen brik at flytte), en rigtig telefon og rigtige børn. Lav telefon er kun målt på 360 x 560 og 390 x 844 (ikke 320). Fund 3 er en vurdering, ikke en målt fejl.
- Jeg kørte kun main, så jeg ved ikke, om 795 faktisk lukker fund 1-3.

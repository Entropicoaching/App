Klar til klassen: ja, på telefon og computer. De tre vigtigste ting Chaturanga retter næste gang: (1) spørgsmålet "Vil du se, hvad du kunne have gjort?" efter Giv op står stadig under kanten på 360 x 560 (595-655 mod vindue 560), og efter et kort parti svarer folden bagefter "Partiet var for kort til en analyse", så spørgsmål og svar passer ikke sammen (skærm: Spil, Mod computeren, e4, Giv op, `main-360x560-3b-efter-giv-op-hel.png`; fil: `src/spil.js` linje 784-788 og `src/partitalui.js` linje 152-170: skjul spørgsmålet, når partiet er under seks halvtræk); (2) efter et parti på telefon står knapperne dobbelt: "Gennemse partiet" og "Nyt parti"/"Prøv niveau 1 igen" både under brættet og i det røde kort længere nede, og under "Gennemse" står tre små valg (Vend brættet, Pile og streger, Brikker og farver), som en 11-årig ikke har brug for lige efter et tab (skærm: samme billede; fil: slut-kortet i `src/skak.template.html` og `src/spil.js`; vis kun ét sæt knapper); (3) "Forhåndstræk: vælg dit træk, mens modstanderen tænker" er slået til som standard og står blandt lyd-valgene i Spil, så en elev kan få et træk spillet, hun ikke selv ser komme (skærm: `main-360x560-3b-efter-giv-op-hel.png`, afkrydsningsfeltet under "Lyd i partiet"; fil: `src/forhaandui.js` linje 9 og 15, "til som standard"; slå det fra som standard i klassen, eller flyt det ind under Avanceret).

# Ordre 796, Bhishak, 30. sep. 2026

## Gren

`kritik-796` fra `main`. Ingen push. Commits: se git log på grenen.

Vurderet: skakken på `main` (43919f6, med 787 og 791 merget), hentet med `git archive` til en midlertidig mappe og bygget der (`node scripts/build.mjs`), fordi `skak.html` i main endnu ikke er genbygget efter 791. Kørt headless i Playwright. Ingen ændring i skakken. Kun syntetiske data (tomme profiler). Scripts: `docs/kritik-796/elevtur-796.mjs`, `fund-796.mjs`, `laer-gaade-796.mjs`, `gaade-forkert-796.mjs`; udskrifter og skærmbilleder i `outputs/kritik-796/`. 360 x 560 og 390 x 844 med touch, 1280 x 800 med mus.

## Kan en 11-årig komme i gang uden hjælp?

Ja. Brættet er altid i første skærmbillede, og det, der skal trykkes på, står lige under eller over det.

- **Parti mod computeren.** Brættet står øverst (360: 148-452, 390: 228-602, 1280: 140-677). Fortryd, Hint og Giv op er 44 px høje under brættet på telefon. Hint-svaret står i statuslinjen over brættet (360: 101-144, "Ingen fare lige nu, spil dit plan.").
- **Makker med ur.** "Valg: intet ur" er synligt uden at rulle (360: 506-550). Åbnes folden, rulles siden 132 px, men brættet (16-320) og ur-valget (504-556) er stadig inde. Ur-knapperne er 46 x 44 (390: 51 x 44). Efter 5+0 og to træk står "Hvid 5:00" under brættet (360: 459-503).
- **Gåde.** Brættet og "Hvid trækker" / "Find det bedste træk." er synlige på alle tre; "Vis et hint" står under brættet på telefon (360: 484-528).
- **Lær skak, "Jeg er ny".** Trin 1 "Brættet" siger "Klik e4"; efter e4 og Videre kommer trin 2 "Kongen" med én sætning ("Kongen går ét felt ad gangen. Tryk på kongen og gå hen til stjernerne."), tre stjerner, "Stjerner: 0 af 3" og brættet i første skærm (360: 223-503; 390: 314-688). Det er nu let.

## Hvad er stadig besværligt eller rodet på lav telefon?

- **360 x 560 efter Giv op.** Brættet, "Hvid gav op. Sort vinder.", "Gennemse partiet", "Nyt parti" og "Prøv niveau 1 igen" er i første skærm. Spørgsmålet i foldens overskrift ligger 573-595 i hele-siden-billedet og er dermed under kanten (vindue 560). På 1280 står teksten synligt (508-574).
- **Kort parti.** Analysen viser nu en tekst i stedet for "100 % / 100 %" og en tom graf, men teksten ("Partiet var for kort til en analyse. Spil et par træk mere...") står lige under spørgsmålet, der lokker til at åbne den (fund 1).
- **Dobbelte knapper og små valg** efter et parti (fund 2). Siden er ca. 1900 px lang på 360; det, eleven skal bruge (Nyt parti), er i første skærm, så det er rod og ikke en spærring.
- **Ur-valget** ligger 620-672 på 360, under kanten, indtil folden åbnes; "Valg: intet ur" viser dog, at der er et valg. Uændret og acceptabelt.
- **Gåde med sort:** brættet vendes med bogstaverne omvendt og "Sort trækker (sort nederst)". Korrekt skak, men uforklaret for et barn; ingen fejl.
- Ingen knapper under 44 px på telefon (1280 har 40 px, men det er mus). Ingen sidefejl i scripts (`udskrift-laer-gaade.txt`).

## Er mine seneste fund lukket? (789)

| Fund | På main nu |
|---|---|
| 1. Hint-linjen står i et slut-parti | Ja: 791 rydder den; efter Giv op står kun "Hvid gav op. Sort vinder." og "Du tabte mod niveau 1." (`main-360x560-3b-efter-giv-op-hel.png`) |
| 1b. Giv op-spørgsmålet under kanten på telefon | Nej, uændret på 360 (595-655) og 390 (777-837 mod vindue 844, altså kun lige inde i kanten); nu fund 1 |
| 2. Trin 2 "Kongen" tre ting på én gang | Ja: 787, se ovenfor |
| 3. "100 % / 100 %" og tom graf efter kort parti | Ja: 791 viser en tekst; men se fund 1 |
| (783) hint 1188 px nede | Kopien står stadig 1188 px nede (besked-elementet), ufarlig, da svaret står i statuslinjen |

## Hvad ændret

Ingen ændring i skakken (kun kritik). Leveret: dommen i første linje, vurderingen ovenfor, fire scripts i `docs/kritik-796/` og 52 skærmbilleder og fem udskrifter i `outputs/kritik-796/`.

## Testresultat

Ingen sidefejl på 360, 390 og 1280 i Lær skak og gåde. Scriptets "kunne ikke trykke"-linjer på 1280 (`#spil-valg-fold`, `#strimmel-*`) er scriptets, ikke skakkens: de elementer findes kun på telefon. De pålidelige målere er `main-*`-linjerne i `udskrift-fund-main.txt`. Skærmbilleder: `main-*-3*-efter-giv-op*.png`, `*-A*-makker*.png`, `*-B*-computer*.png`, `*-C1-laer-ny.png`, `*-E-laer-trin2-kongen.png`, `*-D1-gaade.png`.

## Hvad er næste

- Chaturanga: de tre ting i dommen; alle er små. Nr. 1 først.
- Har arbejdet betydning for Hara? Nej. Aflevering (`hoest.mjs --aflever`) kørte, men indbakken er fuld (25 ubehandlede forslag); forslaget ligger i `outputs/hoest-venter/ordre-bhishak.json` og sendes ved næste merge.

## Ærlige grænser

- **Ikke gjort:** en gåde med forkert træk (mit script ramte en anden gåde end den, jeg havde regnet med, og trækket er ikke en gyldig prøve, se `360x560-G-gaade-forkert-traek.png`); et helt parti til mat eller tabt på tid; ur-nedtælling; Storm; en rigtig telefon og rigtige børn. Forhåndstræk er set som afkrydset i skærmbilledet, men ikke prøvet af en elev; fund 3 er en vurdering, ikke en målt fejl. Lav telefon er kun målt på 360 x 560 og 390 x 844 (ikke 320).
- `skak.html` i main mangler en genbygning efter 791 (den byggede jeg selv i en temp-mappe); tjek at Chaturanga genbygger den, før klassen henter filen.

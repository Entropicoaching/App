skakken klar til at Marc anbefaler den til eleverne: ja

Chaturangas 523 lukker de fire punkter, der betød noget for en elev alene med telefonen: K1 (computeren er ét tryk væk, over brættet), K2 (et parti i gang forsvinder ikke), K3 (remis og "*" analyseres) og K5 (ét ord, "Spyd"). K6 er halvt væk, fordi den, der vælger computeren, ikke ser bordfeltet. K4 og K7-K10 er ikke lavet, fordi Chaturanga ikke kunne læse min 517-rapport. De er stadig små. Koordinattræningen virker på en telefon: navnet på feltet, uret og hele brættet står på én skærm, og en elev når 25-27 felter på 30 sekunder. Ét nyt lille fund (K11): en stoppet storm siger "Ingen rekord endnu … sæt den første!" efter 15 løste gåder.

# Kritik 530, blok 2: skakken efter Chaturangas 523, som en elev på 12 år på telefonen

Bhishak, 27. sep 2026. Ordre 530 fra Dhruva via Marc. Planet school.

**Grundlag:** `skak` main @ `e460aa7` (523 merget; grenen `soendag` er den samme). `outputs/RAPPORT-523.md` og `skak.html` er læst. `skak.html` er åbnet som file://, som når man dobbeltklikker. Intet i skak er rørt.

**Sådan:** `outputs/kritik-530/skak-530.mjs` → `skak-530.json` og `K-*.png`, **19/19** tjek grønne.
- **Browser:** headless Chromium uden net. 360 px (skærm 780 høj) og 390 px (844) med touch, 1280 med mus som kontrol.
- **Eleven er et script, som i 517:** tager mat i 1, ellers det største slag, ellers skak, ellers et tilfældigt træk. Eleven trykker sig frem med fanen, knapperne og felterne.
- **Koordinaterne:** eleven trykker rigtigt i 8 af 10 tryk og ellers på et nabofelt (en typisk forveksling af linje eller række), med ca. 0,9 s mellem trykkene. Det er to rigtige runder på 30 s, fra hvid og fra sort. Eleven ruller ned til Start som et menneske og trykker med fingeren uden automatisk rul.

## En søndag med telefonen

1. **Spil første gang:** over brættet står "Hvem vil du spille mod?" med "Mod computeren" og "Mod en makker" (44 px høje) og "Niveau 1 er for begyndere. Niveau og farve står under brættet." Kortet står fra 202 til 357 px på 390 og fra 202 til 409 px på 360, så det ses uden at rulle (`K-390-1-spil-foerste-gang.png`, `K-360-1-spil-foerste-gang.png`). Et tryk på "Mod computeren", og kortet går væk. På 1280 er der intet kort.
2. **Et parti mod niveau 3:** 25 træk, så gav eleven op. Analysen kom med nøjagtighed og "Lær af dine fejl" ("Du spillede 4. Sb5 - en bukke (??)"). Det virker som i 517.
3. **Næste dag (genindlæsning):** Spil står stadig på "Mod computeren", niveau 3, uden kort.
4. **Et parti i gang, og så en vens parti:** "Indlæs partiet? Det nuværende parti i Spil forsvinder." "Annuller" lader partiet være, og "Ja, indlæs" indlæser.
5. **PGN:** remis (1/2-1/2) og "*" bliver analyseret. En tekst uden træk siger "Fandt ingen træk i teksten." Lichess-partiet med "ven123" mod "elev2014" står stadig som "Du / Hvid / Sort" (`K-390-3-lichess-analyse.png`).
6. **Find feltet (koordinater):** se nedenfor.
7. **Stormen:** startkortet står 886-895 px nede, under skærmens kant. Stormen er stoppet efter 25 s med 14-17 løste gåder, og slutkortet viser temaerne ("Mat i 2: 4 af 6 gik galt", "Træn: Spyd"), ikke gåderne selv (`K-390-6-storm-slut.png`).

Intet net, ingen JS-fejl og ingen vandret rulning på nogen bredde.

## K1-K10 efter 523

| K | Alvor (517) | Nu | Status |
|---|---|---|---|
| K1 | middel | Startkortet står over brættet og kan ses uden at rulle på 360 og 390. Et tryk vælger computeren. Valget og niveauet huskes efter en genindlæsning. Intet kort på 1280 | **lukket** |
| K2 | middel | "Indlæs parti" spørger, når et parti er i gang. Annuller lader partiet være | **lukket** |
| K3 | lav | Remis og "*" analyseres. En tekst uden træk siger "Fandt ingen træk i teksten." | **lukket** |
| K4 | lav | Navnene fra PGN vises ikke: tabellen siger "Du / Hvid / Sort", og "ven123" og "elev2014" står ingen steder | åben (ikke lavet i 523) |
| K5 | lav | "Spyd" overalt, hvor eleven kan se det, også stormens "Træn: Spyd". "Spid" findes kun som intern nøgle | **lukket** |
| K6 | lav | "Bord nr." står kun i "Mod en makker". Den, der vælger computeren på startkortet, ser det ikke. Spiller eleven mod en søskende, står det der stadig | delvis (lukket af K1 for computeren) |
| K7 | lav | Stormens startkort står 886 px nede på 360 (skærm 780) og 895 px på 390 (844) | åben |
| K8 | lav | Forklaringen siger "Sammenlign med dine egne partier." men ikke, at tallet ikke kan sammenlignes med lichess. På 390 fik eleven 76 % med 3 bukke og computeren 89 % | åben |
| K9 | lav | Slutkortet viser temaerne med "Træn: …" og ikke de missede gåder | åben |
| K10 | lav | "Lær af dine fejl"-brættet har 0 koordinater, og hovedbrættet har 16 | åben |

## Koordinattræningen (#13)

| Hvad | 360 | 390 |
|---|---|---|
| Hvor | "Find feltet (koordinater)" er en fold i Spil under "Øv en åbning", 1721 px nede på en ny side og 2968 px efter et parti med analyse (2,2-3,8 skærme) | samme (1699 / 2926 px) |
| Feltets navn | 35 px, fed, over brættet til venstre, med uret og "Fundet: N" til højre | samme |
| Brættet | 310 px, felter på 38 px, ingen bogstaver og tal | 340 px, felter på 42 px |
| Én skærm | Navnet, brættet og Start fylder 457 px. Efter tryk på Start står navnet 310 px og brættets bund 669 px nede på en skærm på 780 | 487 px; 344 / 733 på 844 |
| Runde fra hvid | 26 felter, 7 forkerte: "Tiden er gået: 26 felter (7 forkerte tryk). Ny rekord som hvid!" | 27 felter, 6 forkerte |
| Runde fra sort | 27 felter, 6 forkerte. h1 står øverst til venstre | 26 felter, 7 forkerte |

- Hvert rigtigt tryk tæller, forkerte tryk tælles, og feltet bliver stående. Det samme felt kom aldrig to gange i træk efter et rigtigt tryk.
- Rekorden står efter en genindlæsning ("Rekord: 26 som hvid, 27 som sort."), og partiet i Spil er urørt.
- Lukkes folden midt i en runde, stopper runden.
- Et tryk markerer kun feltet kort. Der hænger ingen farve ved bagefter (prøvet med touch).
- **Det, en elev kan snuble over:** Start står under brættet. Når folden åbnes på en telefon, er Start under skærmens kant (2315 px mod skærmens bund 2071 på 360), så eleven skal rulle ned for at starte. Derefter står det hele på skærmen. Folden ligger langt nede i Spil. Det er samme sted som "Øv en åbning" og er ikke et fund i sig selv, men en elev finder den ikke uden at få den vist.
- **Dom over koordinattræningen:** den virker, og den kan anbefales. Den er tættere på lichess' "Coordinates" end noget andet i appen.

## Nyt fund

| K | Alvor | Hvad | Ret |
|---|---|---|---|
| K11 | lav | En storm, der stoppes med "Stop", tæller ikke som rekord (`nyStormRekord`). Slutkortet siger så "Stormen er stoppet. Du løste 15 gåder." og straks under: "Ingen rekord endnu på denne enhed - sæt den første!" En elev på 12 tror, at de 15 ikke blev talt | Én sætning ved en stoppet storm: "En stoppet storm tæller ikke som rekord. Lad uret løbe ud næste gang." |

## Dom

**skakken klar til at Marc anbefaler den til eleverne: ja.**
- Det, der kunne få en elev til at give op (K1 og K2), er rettet.
- Resten er små ting, som en elev lever fint med. Ingen af dem mister et parti eller giver et forkert svar.
- Koordinattræningen er en god grund mere til at anbefale den.

## Ærlige grænser

- **Kun headless Chromium på Windows.** Ingen rigtig iPhone eller Android: touch er Playwrights, og skrifttypen er Windows'.
- **Eleven er et script, ikke et barn.** 8 af 10 rigtige med 0,9 s mellem trykkene er mit gæt på en elev på 12. En elev, der tænker længere, når færre felter.
- **Stormen er stoppet efter 25 s** og ikke kørt til uret løb ud. Derfor K11.
- **Ikke prøvet:** forhåndstræk, lyd, briksæt, biblioteket, klassens time og lærersiden. De er ikke ændret i 523.
- Ingen rigtige elever og intet net.

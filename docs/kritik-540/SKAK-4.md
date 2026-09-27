skakken stadig klar til eleverne: ja

Chaturangas 533 lukker alle syv åbne punkter fra min 530: K4, K6, K7, K8, K9, K10 og K11. Det holder også på 360 px og med touch, som 533 selv ikke målte. De missede stormgåder er det bedste nye: en elev kan åbne hver gåde og se stillingen, en grøn pil og hele løsningen. Alle 9 løsninger, jeg åbnede, står på en stilling, eleven selv fik, og hver linje er lovlig. De 4 mat-gåder ender i mat. Ét nyt lille fund (K12): efter en hel storm med 15 fejl er slutkortet 1,9 skærme langt på 360, og "Ny storm" står nederst.

# Kritik 540, blok 2: skakken efter Chaturangas 533, som en elev på 12 år på telefonen

Bhishak, 27. sep 2026. Ordre 540 fra Dhruva via Marc.

**Grundlag:** `skak` main @ `3048e71`. Det er 533 (`e4c49be`) og 538 merget oven på. Chaturangas træ står på en anden gren (`gaader-lichess`) og har filer, der ikke er i git. Derfor er `skak.html` hentet fra main med `git archive` til en midlertidig mappe og åbnet som file://. Intet i `skak` er rørt. Læst: `outputs/RAPPORT-533.md`, `docs/MOD-LICHESS.md` (status efter 533), `outputs/533/browser-533.mjs`, min egen 530.

**Sådan:** `outputs/kritik-540/skak-540.mjs` → `skak-540.json` og `K-*.png`, **18/18** tjek grønne.
- **Browser:** headless Chromium uden net. 360 px (skærm 780 høj) og 390 px (844) med touch, 1280 med mus som kontrol.
- **Eleven er samme script som i 517 og 530:** tager mat i 1, ellers det største slag, ellers skak, ellers et tilfældigt træk. Eleven trykker sig frem med fanen, knapperne og felterne.
- **Stormen kører to gange pr. bredde:**
  - stoppet efter 25 s (K11)
  - til uret er ude, 3 minutter plus bonustid (K9)
- 533's eget browsertjek kørte på 390 og 1280 med klik. 360 og touch er nye her.

## En søndag med telefonen

1. **Spil:** startkortet → "Mod computeren", niveau 3 som hvid, 25 træk, så giver eleven op. Tabellen siger "Du / Computeren". Forklaringen af nøjagtigheden slutter nu med "Tallet kan ikke sammenlignes med lichess, og efter et afgjort parti stiger det." (K8)
2. **Lær af dine fejl:** brættet har a-h og 8-1 i kanten (skrift 12,5 px på telefonen). I et parti, hvor eleven havde sort, er det vendt: h-a og 1-8. Eleven trykker d8 og e7 med fingeren og får "Rigtigt! De7 er motorens bedste træk." (K10, `K-360-4-laer-fejl-sort.png`)
3. **En vens lichess-parti** ("ven123" mod "elev2014"):
   - tabellen og resuméet siger "ven123" og "elev2014", også efter en genindlæsning
   - når partiet deles igen, har PGN'et `[White "ven123"]` og `[Black "elev2014"]` (K4, `K-360-2-navne-lichess.png`)
4. **Et langt navn og "?"** ("Storebror der altid vinder over mig" mod "?"): "Storebror der altid…" og "Sort". Tabellen holder på 360 (K4, `K-360-3-navne-langt.png`).
5. **Navnene følger ikke med, hvor de ikke hører til:**
   - et parti uden navne giver "Hvid / Sort"
   - et nyt makkerparti, der åbner som lichess-partiet (1. e4 e5 2. Sf3) og ender i mat, giver "Hvid / Sort"
6. **Mod en søskende** ("Mod en makker"):
   - "Klassens turnering" står som en lukket fold (44 px), og "Bord nr." kan ikke ses
   - eleven åbner folden og skriver 7, og efter en genindlæsning er folden åben med 7
   - når tallet er slettet, er folden lukket igen efter en genindlæsning
   - mod computeren er der ingen fold (K6)
7. **Gåder:** "Storm" står øverst til højre i linjen over brættet og kan ses uden at rulle (se K7 nedenfor). Et tryk ruller til stormens startkort, og "Dagens storm" får fokus.
8. **Stormen, stoppet efter 25 s:** "Stormen er stoppet. Du løste 13 gåder." og straks under: "En stoppet storm tæller ikke som rekord. Lad uret løbe ud næste gang." (K11, `K-360-6-storm-stoppet.png`)
9. **Stormen, til uret er ude:**
   - 360: "Tiden er gået! Du løste 11 gåder.", 15 forkerte træk og 15 knapper under "Se løsningen på gåderne, der gik galt"
   - 390: 19 gåder løst, 15 forkerte
   - 1280: 22 gåder løst, 15 forkerte
   - Et tryk på en knap åbner løsningen lige under den, og et tryk mere lukker den (K9, `K-360-7-storm-loesning.png`)

Intet net, ingen JS-fejl og ingen vandret rulning på nogen bredde.

## K4 og K6-K11 efter 533

| K | Alvor (517/530) | Nu | Status |
|---|---|---|---|
| K4 | lav | Navnene fra PGN står i tabellen, i resuméet og i PGN'et, når partiet deles igen, og huskes efter en genindlæsning. Et langt navn klippes til 20 tegn, og "?" bliver "Sort". Et parti uden navne, et nyt makkerparti og et parti mod computeren får ikke navnene | **lukket** |
| K6 | lav | Mod computeren er der intet bordfelt. Mod en makker hjemme står "Klassens turnering" som en lukket fold. Den er åben, når et bord er sat, og lukket igen, når det er slettet | **lukket** |
| K7 | lav | "Storm" (44 × 69 px) står 228-272 px nede på 360 og 390, over brættet (287 px). Den ses uden at rulle. Startkortet er 908 px nede (360) før trykket og øverst på skærmen efter. "Dagens storm" får fokus. På 1280 er der ingen knap | **lukket** |
| K8 | lav | "Tallet kan ikke sammenlignes med lichess, og efter et afgjort parti stiger det." står i forklaringen på alle bredder | **lukket** |
| K9 | lav | Slutkortet har en knap pr. missede gåde ("Gåde 4: Mat i 2", 44 px). Løsningen viser stillingen vendt mod den, der trak, med koordinater, en grøn pil og hele linjen på dansk. Se tjekket nedenfor | **lukket** (se K12) |
| K10 | lav | "Lær af dine fejl" har bogstaver og tal og vender med sort. Et tryk-træk på det lille bræt bedømmes stadig | **lukket** |
| K11 | lav | En stoppet storm siger "En stoppet storm tæller ikke som rekord. Lad uret løbe ud næste gang." og ikke "Ingen rekord endnu" | **lukket** |

**Tjek af løsningerne (K9).** For hver åbnet løsning læser scriptet brikkerne på løsningsbrættet og hvem der trækker, og spiller linjen igennem med chess.js.
- Alle 9 åbnede løsninger (3 pr. bredde, fra den hele storm) står på en stilling, eleven selv fik i stormen.
- Hver linje er lovlig til sidste træk.
- De 4 med "Mat i 2" i navnet ender i mat. Eksempler:
  - 390: "Hvid trækker. Løsningen: 28. Td8+ Se8 29. Txe8#"
  - 360: "Sort trækker. Løsningen: 22... Te1+ 23. Td1 Txd1#"
- Spyd, binding og gaffel ser ud som det, de hedder. Eksempler:
  - 360: "Tg5+ Kf4 Txg1"
  - 390: "Dd8+ Df8 Te8"
  - 1280: "e4 Dd3 exf5"
- Tallene passer sammen: antallet af knapper = "N forkerte træk" = summen af "x af y gik galt" (15 på alle tre bredder).
- Brættet i løsningen er 276 px på 360 og 300 px på 390 og står inden for skærmen.

## Nyt fund

| K | Alvor | Hvad | Ret |
|---|---|---|---|
| K12 | lav | **Slutkortet er langt efter en hel storm.** Med 15 missede gåder er listen 749 px, og hele slutkortet 1471 px på 360 (1,9 skærme). "Ny storm" og "Tilbage til gåderne" står under listen. Stormen er lavet til at blive spillet igen og igen, og en elev, der vil igen med det samme, skal rulle forbi 15 knapper. Chaturanga nævner det selv under ærlige grænser i 533 | Vis de første 5 og "Vis alle 15", eller flyt "Ny storm" op over listerne |

## Dom

**skakken stadig klar til eleverne: ja.**
- Alle syv åbne punkter fra 530 er lukket, også på den mindste telefon og med touch.
- Den nye løsning på missede gåder giver rigtige svar, og det er den slags, en elev lærer af.
- K12 er pænhed og intet, der giver et forkert svar eller mister et parti.

## Ærlige grænser

- **Kun headless Chromium på Windows.** Ingen rigtig iPhone eller Android: touch er Playwrights, og skrifttypen er Windows'.
- **Eleven er et script, ikke et barn.** Stormens tal (11-22 løst) afhænger af scriptets træk og af tiden mellem trykkene, og de ændrer sig fra kørsel til kørsel. Tjekkene afhænger ikke af dem.
- **Et træk, der ikke blev taget:** i stormen blev et træk, som eleven trykkede, nogle gange ikke taget (0-1 gang pr. storm i sidste kørsel, på 360). Scriptet prøver så et andet træk efter 2,5 s. I en tidligere kørsel skete det så tit, at eleven kun nåede 9 træk på 3 minutter, før jeg lagde det nye forsøg ind. Jeg kan ikke sige, om det er brættet, der ikke tager et tryk, mens modstanderens svar vises, eller mit script, der trykker for tidligt. Det er ikke et fund, men værd at se efter på en rigtig telefon.
- **Løsningerne:** kun 9 åbnede løsninger er kontrolleret. Rokade og en passant indgår ikke i stillingen, jeg læser fra brættet. Ingen af de 9 linjer brugte dem.
- **Ikke set:** 538 (skriv feltets navn, hvor står brikken, øv enhver åbningslinje, åbningsbiblioteket) ligger på main, men er ikke en del af denne ordre og er ikke vurderet. Heller ikke lærerarket, klassens storm og turneringen.
- Ingen rigtige elever og intet net. "ven123", "elev2014" og "Storebror …" er opdigtede.

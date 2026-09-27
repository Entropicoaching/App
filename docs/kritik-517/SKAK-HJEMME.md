skakken hjemme god nok til at anbefale til en elev: ja (fund K1-K10; K1 og K2 bør rettes først, ingen af dem stopper en elev)

# Kritik 517, blok 2: skakken som en elev på 12 år en søndag

Bhishak, 27. sep 2026. Ordre 517 fra Dhruva via Marc. Planet school, spor skakbrættet.

**Grundlag:** `skak.html` på `main` @ `61f0dd6` (501, 506, 509 og 512 er merget). Filen er åbnet som en elev gør: dobbeltklikket (file://), uden net og med et tomt lager. Intet i `skak` er rørt.

**Kørslen:**
- **Browser:** headless Chromium på 390 px med touch (tap) og 1280 px med mus.
- **Eleven er et script** (`outputs/kritik-517/skak-517.mjs`). Rækkefølgen i hvert træk:
  1. mat i 1
  2. ellers det største slag (80 %)
  3. ellers skak (50 %)
  4. ellers et tilfældigt træk
- **Sådan trykker eleven:** gennem faner, knapper og felter, som en elev gør. Ingen FEN er sat udefra.
- **Tallene:** står i `skak-517.json` (18 tjek, alle grønne), og skærmbillederne er `K-*.png`.
- **Computeren trækker tilfældigt:** partierne er forskellige fra kørsel til kørsel. Derfor tjekker jeg adfærd og ikke præcise tal.

## Søndagen

1. **Åbner siden.**
   - Siden starter i Gåder med "Vi finder dit niveau: 0 af 10" (`K-390-1-start.png`). Det er venligt: en gåde med det samme.
   - En elev, der vil spille, trykker på Spil.
2. **Spil mod computeren.**
   - Spil står på **Mod en makker**.
   - På 390 er "Mod computeren" 901 px nede, og skærmen er 844 px. Eleven ser et bræt med "Hvid trækker." og kan begynde at spille mod sig selv uden at opdage det (K1).
   - Når "Mod computeren" er valgt, kommer niveau og farve.
   - Jeg spillede niveau 3 som hvid, med tryk på 390 og klik på 1280. Computeren svarede på 1,3-1,4 s (median, inklusive mine tryk).
   - I den gemte kørsel gav eleven op efter 70 træk på 390 og blev sat mat efter 38 på 1280. I tidligere kørsler blev eleven sat mat efter 17-18 og 52 træk.
   - "Start forfra" spørger "Det nuværende parti forsvinder", og det er godt.
3. **Efter partiet: analysen og nøjagtigheden.**
   - På 0,8-2,5 s står der under brættet:
     - grafen
     - "Nøjagtighed 79 % / 83 %"
     - ?!/?/?? for Du og Computeren
     - "Tre steder hvor partiet vendte"
     - "Lær af dine fejl"
   - Det hele passer på 390 uden vandret rul (`K-390-2-analyse.png`).
   - "Lær af dine fejl" stiller elevens egen bukke op: "Find et bedre træk. Du spillede 6. Sxd6+ - en bukke (??)." (`K-390-3-laer-fejl.png`).
   - Det er det tætteste, skakken her er på lichess, og det virker.
4. **Gennemse partiet.**
   - ◀ tre gange viser "Du ser 16. Ke2 (træk 31 af 34)", og ⏭ går tilbage til slutstillingen.
   - På 1280 virker pil højre.
5. **Del og indlæs (PGN).**
   - "Kopiér partiet" lægger et PGN med syv koder i udklipsholderen, og beskeden peger på lichess' "Importer parti".
   - "Gem som fil" giver `skak-2026-09-27.pgn`.
   - Et parti fra lichess ("Share & export", med `[%clk]` og `[%eval]` i kommentarer) blev indlæst med samme slutstilling som chess.js. Det gav:
     - navnet "Italiensk parti: Giuoco Pianissimo"
     - graf og nøjagtighed (`K-390-4-lichess-pgn.png`)
   - En sidevariant springes over.
   - Danske bogstaver (Sf3, Lb5) virker.
   - "2. Ke3" siger "Træk 2. Ke3 er ikke et lovligt træk i stillingen."
   - Men se K2, K3 og K4.
6. **Forhåndstræk.**
   - Jeg spillede i rigtig tid, uden testur, mod niveau 1 og 8. Jeg lagde næste træk, så snart mit eget var trukket.
   - Computeren svarer på 0,6-1,9 s, så en elev når det.
   - Forhåndstrækket blev lagt og spillet 2 af 2 gange på begge niveauer og begge bredder.
   - Den blå linje "Forhåndstræk: … Annullér" står under brættet (`K-390-5-forhaand.png`).
7. **Storm.**
   - På 390 ligger stormens startkort 915 px nede, under dagens gåde (K7). "Tilfældig storm" starter med det samme.
   - Uret står over brættet (`K-390-6-storm.png`), og "−10 s" står ved et forkert træk.
   - Eleven løste 13-21 gåder.
   - Slutkortet siger "Ny rekord på denne enhed!", "Flest rigtige i træk", "Sværeste løste gåde" og "Her gik det galt - træn det i biblioteket" med én knap pr. tema (`K-390-7-storm-resultat.png`).

**Stabilitet:** intet net, ingen JS-fejl og ingen vandret rulning på 390 og 1280 i hele søndagen.

## Fund

| Fund | Alvor | Hvad | Hvem |
|---|---|---|---|
| K1 | middel | Spil står på "Mod en makker". På 390 er "Mod computeren" under skærmens kant (901 px, skærmen 844). En elev, der vil spille mod computeren, ser et bræt og "Hvid trækker." og spiller mod sig selv | Chaturanga |
| K2 | middel | "Indlæs parti" erstatter et parti mod computeren, der er i gang, uden at spørge, og skifter til "Mod en makker". "Start forfra" spørger. En elev, der vil vise en ven sit lichess-parti midt i et parti, mister partiet | Chaturanga |
| K3 | lav | Et parti fra PGN med remis (1/2-1/2) eller "*" får ingen analyse, og siden siger ikke hvorfor. Kun 1-0 og 0-1 bliver analyseret. På lichess kan ethvert parti analyseres | Chaturanga |
| K4 | lav | Spillernes navne fra PGN (White/Black) vises ikke. Tabellen siger "Hvid" og "Sort", og et parti fra lichess mister "ven123" og "elev2014" | Chaturanga |
| K5 | lav | To ord for samme motiv: "Spyd" på gådernes og stormens knapper og "Spid" i biblioteket ("Træn: Spid" på stormens slutkort, "Spiddet var rigtigt!") | Chaturanga |
| K6 | lav | Klassens "Bord nr." og "Til klassens turnering: tallet på bordets seddel" står i Spil hjemme. Det er støj for en elev alene | Chaturanga |
| K7 | lav | På 390 står stormens startkort 915 px nede, under dagens gåde og niveau-testen. Man skal vide, at stormen findes | Chaturanga |
| K8 | lav | Nøjagtigheden smigrer et tabt parti. Eleven med 5 bukke og 6 fejl fik 79 %, og computeren på niveau 3 fik 83 % med 6 bukke. Det er lichess' formel: når partiet er afgjort, koster en bukke næsten intet i vinderchance. Forklaringslinjen siger ikke, at tallet ikke kan sammenlignes med lichess (512's rapport siger det, siden gør ikke) | Chaturanga |
| K9 | lav | Stormens slutkort viser temaerne, der gik galt, men ikke gåderne selv. På lichess kan man trykke på hver gåde, man missede, og se løsningen | Chaturanga |
| K10 | lav | "Lær af dine fejl"-brættet har ingen koordinater, mens hovedbrættet har. "Du spillede 6. Sxd6+" skal findes uden a-h og 1-8 | Chaturanga |

## Hvad virker

- **Det hele kører fra én fil uden net.** Ingen fejl i en hel søndag på begge bredder.
- **Analysen efter partiet** (graf, nøjagtighed, ?!/?/??, vendepunkter, Lær af dine fejl) er på plads på to sekunder og kan læses på en telefon.
- **PGN ud og ind virker med lichess i begge retninger.** Kommentarer, ur, sidevarianter og danske bogstaver giver ingen problemer.
- **Forhåndstræk kan faktisk bruges mod computeren.** Den tænker længe nok.
- **Stormen er klar og sjov:** uret, "−10 s", rekorden og træning pr. tema.

## Hvad forvirrer

- **K1:** hvor spiller man mod computeren?
- **K2:** hvor blev mit parti af?
- **K5:** spyd eller spid?
- **K6:** hvilket bord?
- **K8:** 79 % i et parti, jeg tabte stort.

## Stadig langt fra lichess

- **Gåderne:**
  - ca. 6.000 gåder og 12 temaer, mod millioner og 60+ på lichess
  - venter på Marcs ja til én hentning af lichess' CC0-database (#3 i MOD-LICHESS)
- **Motoren er dybde 4, ikke Stockfish:**
  - vurderinger, ?!/?/?? og nøjagtighed er grove
  - computeren på niveau 3 laver selv 6 bukke i et parti
- **Ingen spil mod andre på nettet:** et link til et parti kræver en server. Det er valgt fra, og det er rigtigt for skolen.
- **Ingen åbningsudforsker:** 123 åbningsnavne mod ca. 3.000.
- **Stormen husker ikke de missede gåder** (K9), og der er ingen dags- eller ugerekord ud over "på denne enhed".

## Anbefaling

Ja, jeg kan anbefale den til en elev hjemme. En 12-årig kan spille mod computeren, se hvor det gik galt, prøve at finde det bedre træk, dele partiet med en ven eller læreren og tage en storm, uden at noget går i stykker.

K1 og K2 er de to, en elev vil møde. Begge er små at rette:
- **K1:** husk sidste valg og sæt "Mod computeren" øverst på telefonen.
- **K2:** samme bekræftelse som "Start forfra".

## Ærlige grænser

- **Eleven er et script, ikke et barn.** Det spiller grådigt og tilfældigt. Et rigtigt barn læser mere, prøver andre knapper og bliver træt.
- **Kun headless Chromium på Windows,** ikke Safari på en iPad eller en rigtig telefon.
- **Udklipsholderen er læst med browserens tilladelse.** På en skole-pc kan den være spærret.
- **Computeren trækker tilfældigt:** partierne, nøjagtigheden og stormens tal skifter fra kørsel til kørsel. Jeg angiver spænd fra tre kørsler (tjekkene er kørt på den sidste), og tjekkene måler kun adfærd.
- **Forhåndstræk blev prøvet mod computeren,** ikke i lyn mod en makker på ét bræt (det gjorde 512's eget tjek).
- **Lyd, briksæt, biblioteket og klassens time er ikke prøvet** i denne ordre.

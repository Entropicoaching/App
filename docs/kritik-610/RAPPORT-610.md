Ordre 610: to kritikker. Mål dit billede efter Yantras 601 og 608, og skakken efter Chaturangas 604 (Bhishak)

**Domme:**
- **Mål dit billede stadig klar til sitet: ja.** Setu skal kopiere den nye udgave nu.
- **Skakken stadig klar til Marcs klasse: ja.**

## Gren

Grenen er `kritik-610`, lavet fra `main` @ `2044063` (merge af kritik-603) i `entropi-app-kritik`. Ingen push, ingen merge og ingen sub-agenter. Filer kun under `docs/kritik-610/` og `outputs/kritik-610/`.

- Commit 1 `774d4b0` kritik 610 blok 1: Mål dit billede efter Yantras 601 og 608
- Commit 2: kritik 610 blok 2, skakken efter Chaturangas 604 og denne rapport. Hashen står i `git log`.

Målt på:
- **Løftmodellen:** `main` `f3e0200`. 608 blev merget, mens jeg målte. Før 608 var den `207d4ec` (601 alene).
- **Sitet:** `vaerktoejer` `c9fc559`.
- **Skakken:** `main` `246fe59` (604 merget).

Alt er hentet med `git archive`, og ingen af de tre træer er rørt.

## Hvad ændret

Intet i appen, løftmodellen, sitet eller skakken. Kun mine målinger og dokumenter.

### Blok 1: Mål dit billede (`docs/kritik-610/MAAL.md`)

- **Fra dag 91, 608:**
  - **M1 er lukket.** Der er 0 mørke felter i miniaturerne, og tegnet pixel for pixel er de 601's med felterne taget ud (0 % dækket). Stregerne for momentarmene skader ikke.
  - **M4 er lukket.** Mine ubrugelige filer fra 603 giver nu noten, en fil med forkert størrelse får ikke længere klik på forkerte steder, og en umulig dato smides væk. Noten er klar nok, og noten om "en nyere udgave" er rigtig at have.
- **Fra dag 90, 601:**
  - **Punkt 1, en telefon:** en urørt fil holder, også med ekstra metadata og med målingen flyttet. En fil, der er skrevet om, er lavet til JPEG eller har mistet sine ekstra dele, åbnes stille. Siden kan ikke se sporet, og det står på siden.
  - **M5 (lav, nyt):** en urørt fil uden `.png` i navnet og uden typen `image/png` åbnes stille som et foto, fordi siden ser på navn og type og ikke på filens første bytes.
  - **Punkt 2, teksten:** den er tydelig og den samme som i 603.
  - **Punkt 3, før og efter:** datoen står ved begge billeder, og Byt er let at finde.
  - **M6 (lav, nyt):** åbnes filerne i omvendt rækkefølge, står datoerne baglæns, og hver forskel har omvendt fortegn, uden at siden siger noget.
- `maal-610.mjs`: 17/17. Google Chrome 154 headless på 390 med touch og 1280 med mus, uden net, og 36 filåbninger uden JS-fejl.

### Blok 2: skakken (`docs/kritik-610/SKAK.md`)

- **To rigtige uger,** alt spillet med tryk på 360, 390 og 1280: "denne uge / sidste uge" står rigtigt ved Find feltet, Italiensk parti og de kendte partier. Mandag i uge 2 står uge 1 som "sidste uge".
  - Kun ugens nummer gemmes.
  - Nytår er intet problem.
  - Koden er den samme med og uden ugerne.
- **S7 (middel, nyt):**
  - Find feltet er på tid, men ugen måler procent. 8 → 18 felter giver "100 % mod 100 %" uden ros.
  - Dobbelt så mange felter med 2 fejl giver ""Find feltet" gik lidt ned denne uge: 91 % mod 100 % sidste uge. Øv det igen."
- **S8 (lav):** "i 20 forsøg" er 18 felttryk. "1 koordinatøvelse" er ikke elevens ord.
- **Lærersiden:** 25 koder, lukket fold, 2,9-3,8 skærme. Folden er nederst og let at finde, men dens overskrift siger ikke hvilke temaer (S9, lav).
- `skak-610.mjs`: 16/16. 0 netkald og 0 JS-fejl.

## Testresultat

| Kommando | Resultat |
|---|---|
| `node outputs/kritik-610/maal-610.mjs` | 17/17 grønne |
| `node outputs/kritik-610/skak-610.mjs` | 16/16 grønne |
| `node outputs/kritik-610/verify-kritik-610.mjs --blok 1` | grøn |
| `node outputs/kritik-610/verify-kritik-610.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

**Undervejs var mine egne tjek røde tre gange.** Alle tre var fejl i mine tjek, ikke i siderne:
- Git archive gav CRLF, så mit tjek af bænkens linjer fandt 2 "andre" linjer.
- Den første afkortede fil var skåret over i billedet, så der var ingen måling at finde.
- 608 blev merget midt i målingen, så scriptet er stillet om, og alt er kørt igen på `f3e0200`.

## Hvad er næste

**Setu:** kopiér nu fra løftmodellens `main` `f3e0200` til sitet (`vaerktoejer`), i én kopi:
- `dist/maal-billede/` hel, med `miniaturer/`
- `dist/tre-loeft/tre-loeft.js` og `dist/min-krop/min-krop.js` (W7)
- `dist/baenk-figurer/index.html` (BA1)
- intet andet

Mål bagefter i sitets kopi, at alle 8 miniaturer indlæses.

**Yantra** (ingen af dem stopper kopien), i rækkefølge:
1. **M5:** `laesFil` skal bruge `erPng(bytes)` i stedet for type og navn. Det er én linje.
2. **M6:** står Før's gemte dato efter Efter's, så sig det og peg på Byt.
3. **M2:** bænkens figurside.
4. **M3:** `deadlift-animation.js`.

**Chaturanga:**
1. **S7:** giv de tre koordinatøvelser et mål for fart (felter pr. runde) i "denne uge / sidste uge" og i sætningen. Procenten må ikke sige "gik ned", når antallet gik op.
2. **S8:** navnet i stedet for "koordinatøvelse", og tæl pr. slags eller fjern tallet.
3. **S5** fra hans egen rangliste.
4. **S9,** hvis Marc vil.

**Marc:**
- Prøv én gang på en rigtig iPhone: Gem i Mål dit billede → Arkivér i Fotos → Vælg billede → Fotobibliotek. Står der "Gemt måling åbnet", holder Fotos filen.
- Intet valg venter fra denne kritik.

**Hara:** ingen af de to kritikker rører coaching-appen (delmålet "Appen mærkbart bedre"). Blok 1 ligger på sporet "kropsmodel til teknikfeedback i de tre løft": Mål dit billede er nu klar til sitet med M1 og M4 lukket.

## Ærlige grænser

- **Ingen telefon:**
  - Mål dit billede er målt i headless Google Chrome 154 og skakken i Playwrights Chromium, begge på Windows. Touch er Playwrights.
  - Om iPhones Fotos og Android-vælgeren beholder målingen, er ikke målt. Mine filvarianter er gæt på, hvad de gør.
- **Uret er falsk:** "to rigtige uger" er to mandage på Playwrights ur.
- **Kun syntetiske data:** flader, modellens egne stillinger, én elev spillet af mig og 25 opdigtede koder.
- **Hvad en træner eller en 12-årig forstår**, er min vurdering, ikke prøvet på nogen.
- **Kun mine egne scripts:** Yantras og Chaturangas tests er ikke kørt.
- **608 blev merget, mens jeg målte.** Alt i blok 1 er kørt igen på `f3e0200`, og verify tjekker, at løftmodellens `main` stadig står der.
- **Grænserne:** ingen push, ingen merge og ingen sub-agenter. Løftmodellen, sitet og skakken er ikke rørt.

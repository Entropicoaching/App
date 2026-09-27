Ordre 540: to kritikker, squat-artiklen efter Setus 534 og skakken efter Chaturangas 533 (Bhishak)

- **squat-artiklen klar naar Marc har valgt: ja.** Kapitel 3's tabel og kapitel 7 er de samme som løftmodellens tal, og U12 og U15 siger det, kilderne siger. Der er fire små tekstfund (U17-U20).
- **skakken stadig klar til eleverne: ja.** 533 lukker K4 og K6-K11, også på 360 px med touch. Der er ét nyt lille fund (K12).

## Gren

`kritik-540` fra `main` @ `3cbeb4c` i `entropi-app-kritik`. Filer kun under `docs/kritik-540/` og `outputs/kritik-540/`. Intet er pushet eller merget, og der er ikke brugt sub-agenter.

| Commit | Hvad |
|---|---|
| `d5c03d2` | Blok 1: squat-artiklen (`SQUAT.md`, `squat-540.mjs`, `S-*.png`, `verify-kritik-540.mjs`) |
| (denne) | Blok 2: skakken (`SKAK-4.md`, `skak-540.mjs`, `K-*.png`) og denne rapport. Commit-beskeden starter med "kritik 540 blok 2" |

**Kun læst, ikke rørt:**
- sitets `udgivelse-squat-min-krop` @ `9390990`, med `git archive`. `entropi-coaching-site-wt2` står stadig på `vaerktoejer`
- løftmodellens main @ `ca860bf`, med `git show`
- `skak` main @ `3048e71`, med `git archive`. Træet står på `gaader-lichess` med Chaturangas filer, der ikke er i git

## Hvad ændret

**Blok 1, squat-artiklen (`docs/kritik-540/SQUAT.md`):**
- **Kapitel 3's tabel** på siden, 35 rækker i fem stillinger på 390 og 1280, er den samme som `outputs/anatomi/tal-balanceret-lowbar.json`. Tekstens 11 sætninger med tal og de fire billedtekster er rigtige.
- **Kapitel 7:** de seks momenttabeller (24 rækker) og 27 tal i tekst og billedtekster er de samme som `outputs/fejl-marc/tal.json` og `outputs/fejlbilleder/tal-balanceret-lowbar.json`. Arme og momenter for begge kroppe er de samme som `docs/REFERENCEKROPPE.md`.
- **U12** er rigtig i alle tre sætninger. **U15** er den samme som `squat-litteratur.md`, kilde 4: 25 løftere, 0,09 m/s ved sticking point og 49° fra lodret.
- **Stilen:** 0 tankestreger, 0 `[MARC`, 0 atletnavne, ingen vandret rulning, 0 JS-fejl.
- **Nye fund, alle lave:**
  - **U17:** folden i kapitel 7 siger "hvert fejlbillede" er den balancerede krop.
  - **U18:** folden siger "seks registrerede fejlbilleder", men modellen har otte.
  - **U19:** kapitel 6 siger 183 cm og 120 kg uden "antaget", og U12 nævner ikke kapitel 6 og 8.
  - **U20:** "Min krop viser …" kan læses som Marcs egen krop.

**Blok 2, skakken (`docs/kritik-540/SKAK-4.md`):**
- **Lukket:**
  - **K4:** navnene fra PGN, også når partiet deles igen og efter en genindlæsning. Lange navne klippes, og navnene følger ikke med til andre partier.
  - **K6:** "Klassens turnering" står som en lukket fold hjemme og er åben, når et bord er sat.
  - **K7:** "Storm" står over brættet på 360 og 390 og kan ses uden at rulle.
  - **K8:** lichess-sætningen står i forklaringen.
  - **K9:** de missede stormgåder kan åbnes. 9 åbnede løsninger står på stillinger, eleven fik, alle linjer er lovlige, og mat-gåderne ender i mat.
  - **K10:** "Lær af dine fejl" har koordinater og vender med sort.
  - **K11:** en stoppet storm siger, at den ikke tæller som rekord.
- **Nyt fund, lavt:**
  - **K12:** efter en hel storm med 15 fejl er slutkortet 1,9 skærme langt på 360, og "Ny storm" står nederst.

**Betydning for Hara** (coaching-planeten). Squat-artiklen er på vej til entropicoaching.dk (sporet om løft-artikler), og med blok 1 er tallene kontrolleret mod kilden, før Marc siger ja. Skakken hører til skolen og ikke til coaching.

## Testresultat

- `node outputs/kritik-540/squat-540.mjs`: **24/24** tjek grønne. Siden er @ `9390990`, og løftmodellen @ `ca860bf`.
- `node outputs/kritik-540/skak-540.mjs`: **18/18** tjek grønne (skak @ `3048e71`, 360/390/1280 og to storme pr. bredde, ca. 15 minutter).
  - Tre tidligere kørsler fejlede på mine egne tjek:
    - et felt i en lukket `<details>` talte som synligt
    - to gange fandt scriptet ingen synlige knapper efter den hele storm. Jeg troede først, det var bonustiden, og gav eleven 330 s. Men årsagen var, at eleven hang, når et træk ikke blev taget
  - Alle tre er rettet i scriptet, ikke i skak.
- `node outputs/kritik-540/verify-kritik-540.mjs --blok 1`: grøn (før commit 1). `--blok 2`: grøn (før commit 2). Begge kører `npm run lint`, som er grøn.

## Hvad er næste

- **Marc:**
  - vælger de ni punkter fra Setus 528/534 (U2, U5, U6, U7, U8, U10, U11, U13, N1/V8)
  - siger ja til squat-artiklen
- **Setu (sitet, `udgivelse-squat-min-krop`):**
  - retter U17-U20 i samme commit som Marcs valg eller lige før. U19 hænger sammen med U5 og U6, fordi kapitel 6's sætning om kroppen og dens første linje er de samme steder. Forslagene står i `SQUAT.md`.
  - kører derefter `UDGIV-SQUAT.ps1` som i 534
- **Chaturanga (skak):**
  - K12, hvis det er let: vis de første 5 missede gåder og "Vis alle", eller flyt "Ny storm" op
  - ser efter, om et tryk på brættet i stormen kan gå tabt, mens modstanderens svar vises. Det er ikke et fund, se ærlige grænser i `SKAK-4.md`
  - intet andet venter fra mig. Det næste fra `MOD-LICHESS.md` er hans eget
- **Bhishak:**
  - et gentjek af 538 (koordinattræningens to nye øvelser og "Øv en åbning" med alle linjer), når Dhruva vil have det
  - Mål dit billede @ `6d3129e` på `vaerktoejer` er stadig kun set af mig i 536

## Ærlige grænser

- **Løftmodellen er ikke regnet igen.** Artiklen er sammenholdt med de tal, den har skrevet på main. Hales er kun kontrolleret gennem abstraktets citat i `squat-litteratur.md`.
- **Squat-artiklen:** kun kapitel 3 og 7 og U12/U15 er læst mod kilden.
- **Skak:** kun K4 og K6-K11 er vurderet. 538 er ikke vurderet.
- **Browser:** kun headless Chromium på Windows. Ingen rigtig telefon.
- **Eleven er et script.** Stormens tal ændrer sig fra kørsel til kørsel, men tjekkene gør ikke. Et træk i stormen blev nogle gange ikke taget (se `SKAK-4.md`).
- Ingen rigtige elever eller atleter, intet net, ingen push og ingen merges.

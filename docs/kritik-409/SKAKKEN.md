# Ordre 409, blok 2: skakken

Bibliotekets øvelser tjekket fagligt. Skak `main` e56842f, kun læst (kopi via
`git archive`). Der er ingen Stockfish på maskinen, så "motoren" er en dybere
søgning end generatoren brugte:

- `outputs/kritik-409/skak-409.mjs <skak-kopi> 4` → `outputs/kritik-409/skak-409.json`
  (ca. 45 min). For hver kompetence 3 tilfældige øvelser (fast frø 409):
  lovlig stilling, facit kan spilles, alle alternative træk, tema.
  - Materiale-taktik: skak-kopiens egen alfa-beta (`scripts/taktiksoegning.mjs`)
    på **dybde 4** + rolig-søgning (generatoren brugte dybde 3). Både første og
    andet elevtræk.
  - Mat i 1 / mat i 2: alle mattræk / `findMatgivendeTræk(2)`, fuldstændigt.
  - Oppositionen og slutspillene: den fuldstændige tremandsløser (retrograd, eksakt).
  - Hele banken for de billige tjek: antal mattræk og patt-fælder i alle
    mat-i-1-øvelser, rokade-grunden i alle 8.
- `outputs/kritik-409/stopmatten-409.mjs` → `S-*.png`: "Stop matten" i browseren.
- `outputs/kritik-409/kasse.mjs`: "kasse-eleven" i tårn mod konge (blok 1).

## Resultat pr. kompetence (3 tilfældige hver)

| Kompetence | Stikprøve | Lovlig | Entydig | Tema | Bemærkning |
|---|---|---|---|---|---|
| Rokér i tide | ro1, ro4, ro8 | ja | ja (1 lovlig rokade) | se S3 | Hele banken: i 3 af 8 (ro1-ro3) er den anden vej spærret af egne brikker - der er intet at vælge |
| Dronningemat | dm04, dm06, dm08 | ja | ja | ja (D giver mat) | Hele banken: 1 mattræk i alle 8; dm01 har 7 patt-fælder, dm06 har 4 |
| Tårnmat | tm01, tm03, tm04 | ja | ja | ja | 1 mattræk i alle 8 |
| Mat i 1 (D+T) | 063On, 0O8vI, 0Gomm | ja | ja | ja (D/T) | 1 mattræk i alle 10 |
| Baglinjemat | 0L7ju, 0CLrY, 0TWfR | ja | ja | ja (konge på bagerste række, mat på den) | 1 mattræk i alle 10 |
| Kvælningsmat | 0O4JU, 0NRqp, 05V0f | ja | ja | ja (S, alle nabofelter egne brikker) | 1 mattræk i alle 10 |
| Slå den ubeskyttede | u07, u09, u12 | ja | ja (+3, næstbedste +0/+1) | ja | |
| Gaffel m. springer | 0K0hW, 0QN9N, 01Yjm | ja | ja (+3 til +6) | ja (Sxe6+ K+T, Sd6+ K+T, Sg5+ K+L) | 2. træk entydigt |
| Gaffel m. andre | 0JnUQ, 02Km7, 03kMc | ja | ja | ja (Lxf6+, Le6+, Tg3+) | |
| Binding | 0OuMr, 0Ahyx, 0QzKs | ja | ja (+4/+5) | ja (manuelt set) | 0QzKs tog 6 min at søge |
| Spid | 0J1zL, 0BtUA, 0ErbV | ja | ja | ja (Th2+, Txg3+, Tc8+) | |
| Afdækket angreb | 0VCp7, 09CIl, 03CF0 | ja | 1. træk ja | ja | 03CF0: 2. træk har et alternativ (f3, +2 mod facit +3), som appen afviser |
| Red din brik | f06, f11, f12 | ja | ja: appens liste = de sikre træk på dybde 4 (12/12, 4/4, 7/7) | ja | |
| **Stop matten** | sm04, sm06, sm07 (+ alle 8 på dybde 4) | ja | "ja" efter reglen (præcis de træk der stopper mat i 1) | **nej, se S1** | Godtagne svar der taber materiale |
| Mat i 2 | 0CJD3, 0GAjm, 0S5Mf | ja | ja (ét træk tvinger mat i 2, ingen mat i 1) | ja | |
| Dronning mod konge | dk1, dk2, dk4 | ja | - | ja | Perfekt: 6-8 træk mod appen (grænse 20) |
| Tårn mod konge | tk3, tk5, tk6 | ja | - | ja | Perfekt: 6-11 træk mod appen (grænse 35); løseren: højst 14 mod perfekt forsvar |
| Oppositionen | op03, op04, op07 (+ alle 8) | ja | ja: begge hvide træk er det ENESTE der vinder, i alle 8 | se S4 | |

Kort: **bankens stillinger er lovlige og har den løsning de siger**. De tre
fejl er ikke "forkert facit", men hvad appen lærer eleven.

## Fund

**S1 - "Stop matten" godtager (og peger på) træk der giver materiale væk.**
Reglen er "alle træk der stopper mat i 1". Dybde 4 over alle otte
(`outputs/kritik-409/stopmatten-dybde4.txt`; fed = taber mindst 3 mere end det bedste):

| Øvelse | Godtaget (materiale efter 4 halvtræk) | Bedste |
|---|---|---|
| sm01 | Tb8 (-1), h5 (0), h6 (0) | h6 |
| sm02 | f5 (0), **Kg7 (-3)** | f5 |
| sm03 | **Td3+ (-6)**, **Te2 (-5)**, d4 (0) | d4 |
| sm04 | Td8 (0), Te8 (-1), g6 (0) | Td8 |
| sm05 | Kh3 (0), Kh5 (0) | Kh5 |
| sm06 | Te8 (0), g6 (0) | Te8 |
| sm07 | **Dg4+ (-12: dronningen slås af f5 eller Df4)**, S4f3 (-2), S2f3 (-2) | S4f3 |
| sm08 | **Tc6 (-6)**, Te7 (0), d4 (0) | Te7 |

**4 af 8** (sm02, sm03, sm07, sm08) godtager et træk der taber mindst 3. Værre: "Vis et hint" og pilen
efter to fejl viser `godeFoerste[0]`, og i **sm03, sm07 og sm08** er det netop
tabstrækket (Td3+, Dg4+, Tc6). Målt i browseren: pilen går Dd1-g4 med teksten
"Hint: pilen viser trækket. Kan du se hvorfor det virker?", og Dg4+ giver
"Løst! Matten er stoppet." (`S-sm07-hint-pil.png`, `S-sm07-d1g4.png`,
`S-sm03-*.png`). En 10-årig lærer at give dronningen væk for at stoppe en mat.

**S2 - Lær skak har to ulovlige stillinger** (maskinel gennemgang af alle 32
trin): trin 3 "Dronningen" `7k/8/8/8/3Q4/8/8/4K3 w` (Dd4 giver skak til Kh8,
hvid i træk) og trin 23 "Princip: tårne på åbne linjer" `k7/8/8/8/8/8/1P6/R3K3 w`
(Ta1 giver skak til Ka8). I begge kan eleven slå kongen; i trin 3 målt: kongen
forsvinder og appen siger "Rigtigt!" (blok 1, `E-33`). `test/bibliotek.test.js`
tjekker bibliotekets øvelser, ikke Lær skaks FEN'er.

**S3 - Rokade: 3 af 8 er uden valg.** I ro1-ro3 står springer/løber/dronning
på den anden side, så kongen slet ikke kan trækkes derhen; opgaven "Kun den
ene vej er lovlig - hvilken?" er et ét-svars-spørgsmål. De 5 andre (angrebet
felt: d1 af Td8 osv.) er gode og forklares ordentligt bagefter.

**S4 - Oppositionen: facit er rigtigt, hintet er forkert og øvelserne er ens.**
I 7 af 8 er andet træk SIDELÆNS (Kc4-b4, Kd5-e5 ...), men hint2 siger "Gå nu frem
ved siden af ham". Og op01/op03/op05 er samme manøvre forskudt, op02/op04/op08
ligeså: 8 øvelser, reelt 3 mønstre. Øvelsen slutter før bonden er flyttet, så
eleven ser aldrig "nu kommer bonden igennem".

**S5 - Dronningemat lærer ikke patt, selv om forklaringen advarer.** dm01 har
7 træk der giver patt, dm06 har 4. Spiller eleven et af dem, siger hintet "Det
var ikke skak ..." - ikke "Det er patt, uafgjort". Den vigtigste fejl i
dronningemat bliver aldrig navngivet i øvelserne (kun i slutspillet).

**S6 - Afdækket 03CF0, andet træk:** f3 vinder +2 mod facits +3; appen
afviser det som forkert ("Rigtigt træk! Slå nu det mål ..."). Lille, niveau 3.

## Rækkefølgen for en begynder

Oversigten viser kategorierne i fast rækkefølge: Brikkerne → Åbning (Rokér) →
Matmønstre (1,1,1,2,2) → Taktik (1,2,2,2,2,**3**) → Forsvar (**1**,2) →
Regn frem (**3**) → Slutspil (2,**3**,2). Problemer:

1. **"Red din brik" (niveau 1) står som nr. 15 af 18**, efter afdækket angreb
   (niveau 3). For en begynder hører "hvad hænger hos mig" lige efter "hvad
   hænger hos ham" (Slå den ubeskyttede). Det er den vigtigste vane i børneskak.
2. **Tårn mod konge (3) står før Oppositionen (2)**, og **Mat i 2 (3) før
   Dronning mod konge (2)**.
3. **Rokér i tide** står som den første træningskompetence, men 3 af 8 er
   uden valg (S3). Den passer bedre efter "Stop matten" ("få kongen i sikkerhed").
4. BIBLIOTEK.md siger "Brikkerne → Matmønstre 1-2 → Taktik 1-2 → Forsvar →
   resten", men siden viser Åbning før Mat og blander niveau 1-3 i hver kategori.
   Taktikstiens `forud`-kæde (fx gaffel kræver ubeskyttet) bruges ikke.

**Forslag (en "sti" over kategorierne, uden at låse noget):**
Mat i 1 (D+T) → Dronningemat → Tårnmat → Slå den ubeskyttede → Red din brik →
Baglinjemat → Gaffel m. springer → Stop matten → Rokér i tide → Gaffel m. andre
→ Dronning mod konge → Binding → Spid → Kvælningsmat → Oppositionen → Mat i 2
→ Tårn mod konge → Afdækket.

## Er tårnmat i 35 træk mod motoren for svært for en 10-årig?

- **Grænsen i sig selv er rimelig:** løseren siger højst 14 træk mod perfekt
  forsvar, perfekt spil mod appens forsvar bruger 6-11. Der er 21-29 træk til overs.
- **Men eleven spiller ikke perfekt.** En "kasse-elev" (kender metoden, kigger
  ét svar frem, lader ikke tårnet hænge, giver ikke patt) mod appens forsvar:
  **18, 12, 35+, 35+, 16, 10** træk (tk1-tk6). To af seks slår grænsen, og det
  er ikke fordi eleven gør noget forkert, men fordi kongen kravler rundt i
  hjørnet (tk3, tk4) - præcis som en rigtig 10-årig.
- **Det der gør det for svært er kravet, ikke grænsen:** 3 vundne *i træk*, og
  ét tab nulstiller. De seks stillinger går i ring, så den der har svært ved
  tk3 og tk4, møder dem hver tredje parti. I blok 1: "2 af 3 i træk" to gange,
  så nulstillet. Ca. 7 partier og 150 egne træk før det sidder.
- **Dom: ja, for svært som "sidder"-krav for en 10-årig i en skoletime.**
  Forslag: grænse 50 (den rigtige 50-træksregel, som eleven alligevel skal
  lære), "3 af de sidste 4" i stedet for "3 i træk", og et trin før: 3-4
  "gør kassen mindre"-øvelser (ét træk, facit) fra stillinger med kongen på
  kanten, så metoden trænes før hele partiet. Dronning mod konge i 20 er fin.

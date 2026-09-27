fejlgenkendelsen klar til sitet: nej

Tallene holder, så længe kameraet står som i Yantras måling, og siden er rolig: falsk alarm under 2 % for alle syv regler og alle seks kamerapladser med omhyggelige klik (højst 3,3 % med typiske), og Marcs gulvbillede giver intet. Men to ting kan lære en atlet noget forkert:
- **L1 (høj):** et billede taget, lige efter at stangen har sluppet gulvet, giver "Ligner: hoften stiger først" på modellens egen, rigtige bane. Kameraet står, hvor vejledningen siger (i hoftehøjde).
- **L2 (middel):** når siden ikke kan tjekke billedet, står der intet. Vejledningen siger samtidig, at intet betyder "ligner ikke".

Begge er små rettelser. Når de er lavet, er mit svar ja.

# Kritik 536, blok 1: "Ligner: <fejl>" i Mål dit billede (Yantra 520 og 535)

Bhishak, 27. sep 2026. Ordre 536 fra Dhruva via Marc. Planet coaching, spor kropsmodel-til-teknikfeedback.

**Grundlag:** `entropi-loeftmodel-dhruva` main @ `6d3129e`. Både 520 (dødløft og bænk, dag 72) og 535 (squattens to fejl, dag 75) er merget. Hentet med `git archive` til en midlertidig mappe. Jeg har læst `docs/RAPPORT-dag-72.md`, `-75.md`, `src/maalBilledeFejl.js`, `src/fejlgenkendelseMaaling.js` og `dist/maal-billede/`. Intet træ er rørt, og intet er merget.

**Målingerne:**
- `outputs/kritik-536/fejl-536.mjs` → `fejl-536.json`. Siden regnet i node med Yantras egne funktioner (`maal`, `genkendFejl`, `kropsBilleder`). Hans fem kroppe og hans normale og fejlbehæftede stillinger er stillet op i 3D og fotograferet med mit pinhole-kamera fra 511/521/530.
  - Dybderne er som i 530: markørerne på den nære side, det nære nav 70-75 cm ude.
  - Klikfejlen er min fra 511 (omhyggelig og typisk).
  - Der er 60 billeder pr. stilling, krop og kamera.
- `outputs/kritik-536/side-536.mjs` → `side-536.json` og `S-*.png`: siden headless uden net på 360 og 390 med touch og 1280 med mus. **9/9** tjek grønne.
- **Kun syntetiske figurer** (tegnede, mærket SYNTETISK) og Marcs eget gulvbillede fra 462 med Yantras 498-klik og mine 494-klik.

## Falsk alarm og overset med seks kamerapladser

Yantras tabel har et kamera vinkelret uden perspektiv. Her er seks pladser mere. Tallene er falsk alarm / overset i % med omhyggelige klik (typiske i parentes). "Hånd" er telefonen holdt i 140 cm og vippet ned mod hoften, som mange filmer.

| Regel | Vinkelret, hoftehøjde | 30 cm højere, vippet | Hånd 140 cm | Lavt 45 cm | 2 m | 50 cm ved siden af | 5° skråt | 10° skråt |
|---|---|---|---|---|---|---|---|---|
| Hoften stiger først | 0 / 1 (0 / 5) | 0 / 4 | 0 / 3 | 0 / 2 | 0 / 2 | 0 / 1 | 0 / 2 | 0 / 1 (0 / 11) |
| Stangen glider frem | 0 / 4 (0 / 17) | 0 / 1 | 0 / 2 | 0 / 5 | 0 / 3 | 0 / 0 | 0 / 9 | 0 / 25 (0 / 43) |
| Stangen for højt / albuen | 0 / 19 (0,4 / 19) | 0 / 20 | 0 / 19 | 0 / 18 | 0 / 20 | 0 / 16 | 0,1 / 15 | 0,4 / 15 (1,3 / 15) |
| Kun knæene, bunden | 0 / 1 (0 / 4) | 0,2 / 0 | **1,7 / 0 (3,3 / 5)** | 0 / 1 | 0,2 / 0 | 0,3 / 0 | 0 / 0 | 0 / 1 |
| Hoften tilbage, bunden | 0 / 3 (0,3 / 12) | 0 / 8 | **0 / 17 (0 / 21)** | 0 / 4 | 0 / 5 | 0 / 5 | 0 / 4 | 0 / 4 |
| Kun knæene, sticking point | 0,3 / 32 (0,4 / 48) | 1,2 / 35 | **3,2 / 58 (3,1 / 65)** | 0,2 / 30 | 0,1 / 29 | 0,6 / 31 | 0,3 / 27 | 0,1 / 30 |
| Hoften tilbage, sticking point | 0 / 1 (0 / 5) | 0 / 0 | 0 / 1 | 0 / 0 | 0 / 0 | 0 / 1 | 0 / 0 | 0 / 2 |

- **Mine tal med kameraet vinkelret er Yantras** (dag 75: fx "kun knæene" ved sticking point 34,6 % overset, bænken 0,2 % falsk). Hans måling holder.
- **Perspektivet flytter ikke vinklerne meget.** Kun når telefonen er over hoften og vippet ned, hælder skinnebenet mere frem i billedet: +2° ved 30 cm højere, +3,2° med telefonen i hånden, målt på modellens egen bund. Det giver op til 3 % falsk "kun knæene" og flere oversete "hoften tilbage". Vejledningen siger allerede "i hoftehøjde". Det er nok, og det er ikke en stopper.
- **Stangens to regler** bliver aldrig falske med det fjerne nav, heller ikke 10° skråt. Prisen er, at "stangen glider frem" overses i 25 % (typisk 43 %) ved 10°.
- **Bænken:** de 20 %, der overses uden klikfejl, er "albuen helt ude" hos 160 cm. Det er med vilje (dag 75). Står kameraet mere end ca. 55 cm ved siden af stangen, går bænkens regel i stå, fordi navene skilles ("kameraet står skråt"). Det er forsigtigt og ikke farligt.

## L1: "hoften stiger først" lige efter at stangen slipper gulvet (høj)

Fasevagten ved gulvet regner stangens højde delt med knæets med **det nære nav**. Tærsklen er 0,15 over modellen, "ca. 8 cm stang". Uden perspektiv holder det: ved 8 cm er forholdet 0,157, og siden tier. Men det nære nav står ca. 60 cm nærmere kameraet end kroppen. Med kameraet i hoftehøjde, som vejledningen siger, står navet derfor lavere i billedet. Modellens egen stilling ved gulvet får forholdet −0,30, ikke 0.

Billederne er modellens egen bane fra gulvet mod knæhøjde, altså en rigtig udførelse. Banen er lagt lineært mellem de to faser, da siden ikke har noget imellem (178 cm, kamera 3 m i 75 cm):

| Stangen over gulvet | Forholdet, fladt | Med perspektiv (nært nav) | Stangens midte (begge nav) | Skinneben / knæ mod modellen | "Ligner: hoften stiger først" (omhyggelig) |
|---|---|---|---|---|---|
| 0 cm | 0 | −0,30 | −0,03 | 0° / −0,5° | 0 % |
| 5 cm | 0,10 | −0,17 | 0,08 | 2,1° / 7,6° | 0,3 % |
| 8 cm | 0,16 | −0,09 | 0,14 | 3,4° / 12,7° | 0,7 % |
| 12 cm | 0,24 | 0,01 | 0,22 | 5,1° / 19,5° | **13 %** |
| 16 cm | 0,31 | 0,11 | 0,30 | 6,8° / 26,3° | **45 %** |
| 20 cm | 0,39 | 0,21 (vagten stopper) | 0,38 | | 0 % |

- **Uden klikfejl** giver 16,5-17,5 cm "Ligner" både med og uden det fjerne nav. Vagten bruger det nære nav, også når begge er klikket.
- **På siden**, med 390 og 16,5 cm, står der: *"Ligner: hoften stiger først. Skinnebenet står ca. 7° mere lodret og knæet er ca. 27° mere strakt end i modellens udførelse med samme krop; sådan står modellens figur, når knæene strækkes, før stangen slipper gulvet."* (`S-390-l1-hoften-foerst.png`, også 360 og 1280).
- **Det er sætningen, coachen kopierer,** og den siger det modsatte af sandheden: stangen har sluppet gulvet, og atletens bane er modellens. Dag 72 siger selv, at "et billede lidt senere i videoen er det naturlige valg".
- **Ret:** når begge nav er klikket, skal vagten regne på stangens midte. Så er modellens stilling −0,03, og vagten stopper ved ca. 9 cm, som tænkt. Uden det fjerne nav er der to veje:
  - tærsklen sænkes til ca. −0,15, så siden hellere tier (et kamera i 45 cm giver −0,13 ved gulvet),
  - eller reglen kræver det fjerne nav, som stangens regler gør.

  Yantras spørgsmål 2 ("er 8 cm en god nok vagt?") er ja i et fladt billede og nej i et foto.

## L2: intet på skærmen betyder to ting (middel)

- Når kameraet eller fasen er usikker, er boksen skjult. Kun `data-status` ved hvorfor.
- Vejledningen siger begge dele: "Er kameraet eller fasen usikker …, står der intet", og straks efter "Står der intet, betyder det kun, at billedet ikke ligner fejlfigurerne over målefejlen." Den sidste sætning er den, en coach husker.
- **Hvor ofte det sker:**
  - **Knæene ud (tæer ud, bred fodstilling).** Knæet er drejet ud mod kameraet om linjen hofte-ankel. Lårets hældning i billedet ændrer sig, og bundens fasevagt stopper modellens egen bund i 42 % af billederne ved 20° og 89 % ved 30°. På siden (`S-390-l2-intet.png`) er status "usikker-fase", og intet synligt nævner det.
  - **Telefonen i hånden:** 39 % af "kun knæene" ved sticking point bliver ikke tjekket.
  - **Billedet 10 % over bunden:** 59 % af de normale bundbilleder.
- **Ret:** én stille linje, når reglen findes, men ikke kan tjekkes, fx "Ligner: ikke tjekket (hoften står for højt til, at billedet er fra bunden)". Grundene findes allerede i `genkendRegel`. Og den sidste sætning i vejledningen skal sige "Står der 'ingen', …".

## L3: high bar og sko med hæl giver "kun knæene" (middel)

- Siden sammenligner squatten med modellens low bar.
- **Modellens egen high bar** har skinnebenet 3° mere frem og torsoen 12° mere oprejst (bunden), så værnet (torsoen) stopper intet.
- **Sko med hæl:** jeg har vippet skinnebenet a grader frem om anklen, med låret og torsoen uændret. En hæl på ca. 2 cm under en fod med ca. 19 cm fra hæl til fodballe vipper foden ca. 6°, men hvor meget skinnebenet følger med, er ikke målt.

| Skinnebenet vippet | Low bar: bunden / sticking point | High bar: bunden / sticking point |
|---|---|---|
| 0° | 0 / 0 % | 0,2 / 0,7 % |
| 2° | 0,2 / 1,2 % | 4 / 5 % |
| 4° | 1,7 / 12 % | **17 / 25 %** |
| 6° | 17 / 34 % | **57 / 55 %** |

- **På siden** (high bar, 6°, `S-390-l3-kun-knaeene.png`) står der: *"Skinnebenet hælder ca. 9° mere frem end i modellens bund med samme krop og low bar; sådan står modellens figur, når knæene går frem og hoften bliver under stangen, og dér letter hælen i modellen."*
- **Grænsen under sætningen er ærlig:** "sko med hæl lægger også skinnebenet frem, og billedet har intet punkt på hælen". Men sætningens sidste led, "og dér letter hælen i modellen", er det, en atlet i vægtløftersko læser om sin egen hæl, som står fladt.
- **Ret:**
  - flyt "dér letter hælen i modellen" fra sætningen til grænsen,
  - og giv siden et valg, "High bar / sko med hæl", der sammenligner med modellens high bar og skjuler "kun knæene" (eller hæver tærsklen med ca. 6°).
- Knæene ud giver aldrig "hoften tilbage" (0 % op til 40°) og højst 1 % "kun knæene". Det besvarer Yantras spørgsmål 2 om den brede fodstilling. Prisen er L2: siden tier.

## Yantras spørgsmål (dag 72 og 75)

1. **Knæet alene (Marcs gulvbillede):**
   - Knæene drejet ud forklarer det ikke: 40° ud giver kun knæet +12° og skinnebenet −4° (`fejl-536.json`, B).
   - Marcs +24° knæ og 4° skinneben ligner mest en højere hofte i starten, eller et billede taget lidt efter at stangen slap (L1-tabellen: 12-16 cm giver +20-26° knæ og 5-7° skinneben). Ét billede kan ikke skille de to.
   - Skinnebenets 7° er den rigtige vagt, og knæets tærskel skal ikke afhænge af skivens kontrol.
   - Mine egne 494-klik giver det samme: knæ +20,5°, skinneben +2,6°, intet "Ligner".
2. **Fasen:**
   - Gulvet: se L1. Vagten er for løs i et foto.
   - Squattens bund (lårets hældning ±8°) og sticking point (±0,1) er gode. Et billede 5 % over bunden eller ±8 % om sticking point giver aldrig falsk alarm (højst 1 %). Længere væk tier siden oftere, men giver stadig ingen falske fund.
   - "Hoften tilbage" bliver fundet 81-99 %, når billedet er 8-16 % under sticking point, men kun 15-82 %, når det er 8-16 % over (fasevagten tier).
3. **Bænken fra siden:** "stangen for højt eller albuen helt ude" med begge figurer er ærligt. Et albuepunkt fra siden kan ikke se albuen ud til siden, så lad være.
4. **Stangens regler kræver det fjerne nav:** ja, behold det. Med navet er der ingen falsk alarm, heller ikke 10° skråt. Uden navet flytter hver grad skråt det nære nav 1,4 cm (min E2), og tærsklen er 4 cm.
5. **Sætningerne:**
   - 38 sætninger for fem kroppe og syv regler, højst 37 ord. Ingen nævner muskel, styrke, skade, fare, "forkert", "bør" eller "du".
   - De kan sendes, med to undtagelser: L1's "før stangen slipper gulvet" og L3's "dér letter hælen".
   - En lille (L4): sætningen siger altid "med samme krop", også uden Min krop, hvor modellen er gennemsnittet for højden.
6. **Et rigtigt klip med en kendt fejl** har jeg heller ikke. Marcs gulvbillede giver intet, som det skal.

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| L1 | høj | Dødløft ved gulvet: vagten bruger det nære nav, og i et foto fra hoftehøjde tillader den stangen ca. 18 cm over gulvet. Modellens egen bane 12-16 cm oppe giver "Ligner: hoften stiger først" i 13-45 % af billederne (45 % ved 16 cm), og sætningen siger "før stangen slipper gulvet" | Stangens midte, når begge nav er klikket; uden navet tærskel ca. −0,15 eller kræv navet |
| L2 | middel | Usikker fase eller kamera giver en tom plads, og vejledningen siger, at tom betyder "ligner ikke". Knæene 30° ud: 89 % af normale bundbilleder tjekkes ikke | Én linje "ikke tjekket (grund)"; ret vejledningens sidste sætning |
| L3 | middel | High bar og sko med hæl: 17-57 % falsk "kun knæene" ved 4-6°; sætningen siger "dér letter hælen i modellen" | Hælen ud af sætningen; valget "High bar / sko med hæl" |
| L4 | lav | "med samme krop" også uden Min krop | "med samme højde", når Min krop mangler |
| L5 | lav | Telefonen i hånden (140 cm, vippet) lægger skinnebenet 3° frem: op til 3 % falsk "kun knæene" og 58 % oversete ved sticking point | Vejledningen siger allerede hoftehøjde; evt. "ikke i hånden" |

## Det der virker

- Modellens egne stillinger, fem kroppe, alle kameraer: højst 0,6 % falsk alarm (3,3 % med telefonen i hånden). Der er ingen falske alarmer ved skråt kamera eller tæt kamera, og ingen i stangens regler.
- Boksen er inden for skærmen på 360, 390 og 1280, figurerne hentes fra `../squat-figurer/` og `../loeft-fejl/`, intet gemmes, intet net og ingen JS-fejl.
- Marcs gulvbillede giver intet "Ligner", med både Yantras og mine klik.
- Tonen: én sætning i modellens sprog, retning og tal, ingen dom over atleten, og grænsen står i boksen.

## Ærlige grænser

- **Kun syntetiske figurer og Marcs ene gulvbillede.** Intet rigtigt løft med en kendt fejl.
- **Klikfejlen er min antagelse fra 511,** ikke målt.
- **Dødløftets bane mellem gulv og knæhøjde er en lineær overgang** mellem modellens to faser, ikke modellens egen bane (siden har ingen). Et rigtigt træk strækker ofte knæene hurtigere i starten, så L1 er snarere for lille end for stor.
- **Knæene ud er en drejning om linjen hofte-ankel** med hofte og ankel på plads. **Hælen er skinnebenet vippet** med låret og torsoen uændret. Begge er mine modeller, ikke målt på løftere.
- **Pinhole uden linseforvrængning,** dybderne er antagelser (i JSON).
- **Kun headless Chromium på Windows,** ikke en rigtig telefon.
- **Ingen atletdata** ud over Marcs eget klip, og skærmbillederne er tegnede figurer.

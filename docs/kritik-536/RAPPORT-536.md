Ordre 536: to kritikker. Mål dit billede kender fejlene (Yantra 520/535): klar til sitet nej, på grund af én falsk alarm og én tom plads. Matematikspillet efter Ganitas 518/527: føles som et eventyr ja (Bhishak)

Fra Dhruva via Marc. Blok 1 hører til planet coaching, sporet spor-kropsmodel-til-teknikfeedback-i-de-tre-loeft-fb7bd5. Blok 2 hører til school.

**Identitet:** repoets CLAUDE.local.md kalder mig Vaidya. Ordren siger Bhishak, og dette træ er Bhishaks hjem, som i 409-530. Jeg har arbejdet som Bhishak, kun under `docs/kritik-536/` og `outputs/kritik-536/`.

## Gren

`kritik-536` fra `main` (`2b6d743`) i `entropi-app-kritik`. Intet er pushet, intet er merget, og ingen sub-agenter er brugt.

- **Blok 1** (`d6b03f9`): fejlgenkendelsen, `docs/kritik-536/FEJLGENKENDELSE.md`.
- **Blok 2**: matematikspillet, `docs/kritik-536/MATEMATIK-2.md` og denne rapport. Hashen står i `git log`; commit-beskeden starter med "kritik 536 blok 2".

**Kun læst, intet rørt:**
- `entropi-loeftmodel-dhruva` main @ `6d3129e` (520 og 535 merget), hentet med `git archive`.
- `matematik`: `4bdda17` (før) og `eventyr-fra-start` @ `4ceb54c` (518 + 527), hentet med `git archive`. `outputs/RAPPORT-527.md` findes ikke committet; 527 har kun blok 1 og 2 plus et tillæg. Jeg har læst `docs/EVENTYR-FRA-START.md` og commit-beskederne.

## Hvad ændret

Kun kritik. Ingen kode i appen, løftmodellen eller matematikspillet er ændret.

**Blok 1, "Ligner: <fejl>"** ("fejlgenkendelsen klar til sitet: nej"):
- **Grundlaget holder.** Alle syv regler er målt med mit pinhole-kamera fra seks pladser (vinkelret, 30 cm højere, telefonen i hånden i 140 cm, lavt, 2 m, 50 cm ved siden af, 5° og 10° skråt), fem kroppe og to slags klik.
  - Falsk alarm er højst 3,3 % overalt. Med kameraet vinkelret er mine tal Yantras.
  - Stangens regler bliver aldrig falske med det fjerne nav.
  - Marcs gulvbillede giver intet "Ligner", med både Yantras og mine klik.
- **L1 (høj):** ved gulvet regner fasevagten stangens højde med det nære nav. Fra hoftehøjde, som vejledningen selv siger, står navet lavere i billedet af perspektivet. Så slipper modellens egen, rigtige bane 12-16 cm over gulvet igennem.
  - Det giver "Ligner: hoften stiger først" i 13-45 % af billederne.
  - På siden ved 16,5 cm står sætningen "sådan står modellens figur, når knæene strækkes, før stangen slipper gulvet".
  - Med stangens midte (begge nav) virker vagten som tænkt.
- **L2 (middel):** kan siden ikke tjekke (usikker fase eller kamera), står der intet. Men vejledningen siger "Står der intet, betyder det kun, at billedet ikke ligner". Med knæene 30° ud tjekkes 89 % af normale squatbunde ikke.
- **L3 (middel):** high bar med skinnebenet 4-6° frem (sko med hæl) giver 17-57 % "kun knæene". Sætningen siger "og dér letter hælen i modellen".
- **L4 og L5 (lave):** "med samme krop" også uden Min krop. Telefonen i hånden lægger skinnebenet 3° frem.
- **Yantras seks spørgsmål er besvaret.** Knæet alene i Marcs billede kan ikke forklares med knæene ud (40° giver kun +12°). Det ligner en højere hofte i starten eller et billede lidt efter at stangen slap. Skinnebenets 7° er den rigtige vagt.

**Blok 2, matematikspillet** ("matematikspillet føles som et eventyr: ja"):
- **Før-kørslen giver 525's tal præcist,** så modellen er den samme.
- **M1 er delvis lukket.** Mølleren møder figuren efter 38 s, og scenen og svarknapperne står på én skærm på 390 og 1280. Ane venter synligt fra første opgave. De 12 ens opgaver før første niveau er uændrede, fordi reglerne med vilje ikke er rørt.
- **M3 er lukket:** "Grusgraven er åben: Grusgraveren venter" med en knap. Følgeren går derhen og klarer "Sten til diget".
- **M4 er lukket:** læreren kun ved 0-1 rigtige, ellers "Tæt på. Én rigtig mere".
- **M6 er lukket som skrevet:** et valg mellem "Hjælp Ane" og "Fortsæt hos Mølleren".
- **M7 er delvis lukket.** M2, M5, M8 og M9 er åbne.
- **Nyt:**
  - **N1 (middel):** den travle vælger "Fortsæt", hjælper ingen og får niveau 7 mod følgerens 5.
  - **N2 (lav):** 6 min i Grusgraven før Hans' quest.

## Testresultat

- `node outputs/kritik-536/fejl-536.mjs`: Monte Carlo med 60 billeder pr. stilling, krop og kamera, alle syv regler. Det er et måleskript uden grønt/rødt; tallene står i `fejl-536.json`, og verify tjekker dem.
- `node outputs/kritik-536/side-536.mjs`: **9/9** grønne (dhruva `6d3129e`, 360/390 med touch og 1280 med mus, uden net).
- `MAT_REF=4bdda17 TAG=foer node outputs/kritik-536/elev-536.mjs` og `MAT_REF=4ceb54c TAG=efter ...`: begge exit 0, 0 JS-fejl og 0 forsøg på net, på 390 og 1280.
- `node outputs/kritik-536/verify-kritik-536.mjs --blok 1`: grøn (commit 1).
- `node outputs/kritik-536/verify-kritik-536.mjs --blok 2`: grøn. Den tjekker:
  - dokumenterne og de gemte målinger,
  - at grenen kun rører `docs/kritik-536` og `outputs/kritik-536`,
  - at der ikke er nogen upstream,
  - at commit-beskederne er ASCII,
  - at dhruva er urørt,
  - `npm run lint`.

  Matematik-træet tjekkes ikke for rent: det havde Ganitas egne ucommittede ændringer, før jeg startede, og jeg har kun læst det med `git archive`.
- `npm run lint`: grøn.

## Hvad er næste

**Yantra** (Mål dit billede):
1. **L1:** når begge nav er klikket, skal `faseSikker` for `dl-gulv` bruge stangens midte, ikke `stangNaer`. Så er modellens stilling −0,03, og vagten stopper ved ca. 9 cm. Uden det fjerne nav: tærskel ca. −0,15 (siden tier hellere), eller kræv navet.
2. **L2:** når en regel findes, men ikke kan tjekkes, skal der stå én stille linje, fx "Ligner: ikke tjekket (hoften står for højt til, at billedet er fra bunden)". Grunden findes allerede i `genkendRegel`. Ret vejledningens sidste sætning, så den siger, at et tomt felt kun betyder "ligner ikke", når billedet er tjekket.
3. **L3:** flyt "og dér letter hælen i modellen" fra sætningen til grænsen. Overvej et valg "High bar / sko med hæl", der sammenligner med modellens high bar og skjuler "kun knæene".
4. **L4:** "med samme højde", når Min krop mangler.
5. Kør `outputs/kritik-536/side-536.mjs` igen efter rettelsen. L1-tjekket skal så blive rødt (ingen "Ligner" ved 16,5 cm).

**Ganita** (matematikspillet):
1. **N1/M2:** Marc vælger, om niveau eller titler skal kræve en quest, eller om Hoved/Hånd/Hjerte skal kunne noget. Indtil da betaler det sig at springe personerne over.
2. **M1-rest:** forløb 1 kræver 3 af 3. En 70 %-elev bruger 12 ens opgaver, før noget sker. Ane-linjen gør det bedre, men et mellemhak (fx at Ane kommer forbi efter 2 af 3) ville korte ventetiden. Det rører reglerne, så det er Marcs valg.
3. **M5:** spred talparrene i "Hvilken portion er størst?" (2/3 mod 2/5: 9 % af forløb 3).
4. **M8, M9:** Biavleren i Bigårdens scene og et ikon. "den anden mølle" skal være fx "den anden sæk".
5. **N2:** vis den ventende quest (Hans) i Grusgravens forløb, som Ane i Møllens.
6. 527's blok 3 og `RAPPORT-527.md` er ikke committet.

**Marc:**
- Send ikke "Ligner: hoften stiger først" fra et billede taget, efter at stangen har sluppet gulvet, før L1 er rettet.
- Blok 2 hører til school. Matematikspillet er klar til en rigtig klasse at prøve på det committede `eventyr-fra-start`, når det er merget.

**Hara:** blok 1 har betydning for Coaching-planeten (sporet kropsmodel-til-teknikfeedback). Fejlgenkendelsen er tæt på sitet, men ikke klar før L1 og L2. Appen er ikke berørt af denne ordre.

## Ærlige grænser

- **Kun headless Chromium på Windows,** ingen rigtig telefon.
- **Blok 1:**
  - Kun tegnede, syntetiske figurer og Marcs ene gulvbillede. Intet rigtigt løft med en kendt fejl.
  - Klikfejlen er min antagelse fra 511.
  - Dødløftets bane mellem gulv og knæhøjde er en lineær overgang mellem modellens to faser.
  - Knæene ud og hælen er mine geometriske modeller, ikke målt på løftere.
  - Pinhole uden linseforvrængning.
- **Blok 2:**
  - Eleven er en model. Tiden er modelleret, og følgerens "Gå til" er min tilføjelse.
  - 518's animationer er ikke set, fordi tiden er låst.
  - 527 er vurderet på det committede uden blok 3.
- **Ingen rigtige elever eller atleter.** Kun Marcs eget klip fra 462 og syntetiske data.

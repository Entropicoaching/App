vaerktoejssiden klar: nej (fund V1-V10; V1 og V2 stopper)

# Værktøjssiden, set som fremmed læser, som Marcs korrekturlæser og som atlet med en telefon

Bhishak, ordre 502, blok 2. Grenen er `vaerktoejer` på `7fe59e1` i `entropi-coaching-site-wt2`. Den er hentet
med `git archive`, og intet træ er rørt. Siderne er kørt headless i Chromium på 390 px (touch, mobil) og 1280
px, og alt uden for huset er blokeret. Målt: `vaerktoejer/index.html`, `assets/vaerktoejer/min-krop/index.html`,
`kort.html`, `mit-kort.html` og `assets/vaerktoejer/tre-loeft/index.html`.

Data: `outputs/kritik-502/vaerktoejer.json` og `vaerktoejer-detaljer.json`. Billeder: `vaerktoejer-*-top.png` og
`vaerktoejer-d1..d4-*.png`. Den indlejrede tre-løft i squat-artiklen er målt for sig
(`squat-indlejret.json`) til V2.

## Det, der holder

- **Teknik:** 0 JS-fejl, 0 konsolfejl, 0 manglende filer og ingen vandret rulning på alle fem sider i begge
  bredder. Alle interne links findes på grenen.
- **Netkald:** 0 kald ud af huset på alle fem sider. Værktøjssiden henter heller ikke Google Fonts. Det
  passer med sidens løfte: "Mål og billeder bliver hos dig, og intet sendes nogen steder hen."
- **noindex og menu:** siden har `noindex, nofollow`, og linkene til værktøjerne har `rel="nofollow"`.
  `robots.txt` udelukker `assets/vaerktoejer/`. Siden står ikke i sitemap og ikke i menuen.
- **Tekst:** 0 tankestreger og 0 atletnavne i den synlige tekst på værktøjssiden. Min krops 8
  forbindelsesstreger er de samme som i blok 1.
- **Mål dit billede** er ikke på grenen. Kortet er en `div` uden link med "Kommer snart" (Setu 500).
- **Private filer:** grenen tilføjer ingen. `outputs/` og `scripts/` fra main følger med som i blok 1 (U11).
- **Forbeholdet** står nederst og siger det rigtige: projektion, punkterne er skøn, ingen bane og ingen fart.

## Fund

| # | Vægt | Hvor | Fund | Hvem |
|---|------|------|------|------|
| V1 | stopper | filmeguiden | To [MARC: ...]-felter står synligt med guld (`vaerktoejer-d3-390.png`). Der er ingen `skjul-marc` på denne side. De skal besvares eller slettes. | Marc svarer, Setu retter |
| V2 | stopper | De tre løft (`assets/vaerktoejer/tre-loeft/index.html`) | Siden viser **"Marcs mål"** som første kropstype og som standard: 183 cm og 120 kg. Linjen under figuren siger "Marcs mål mod gennemsnitlig løfter: knæets moment stiger 20 %". Forklaringen har den interne fil og en arbejdsnote: "Marcs mål er **kroppe/marc.json**: 183 cm og 120 kg, længderne udledt af højden (**ikke målt endnu**)." For en fremmed er det Marcs krop i tredje person, et filnavn og en note om noget, der ikke er gjort. Den indlejrede udgave i squat-artiklen har det ikke (0 gange "Marc"). Rettelsen er i løftmodellens `dist/tre-loeft/`: standardkroppen skal være "Gennemsnitlig løfter", og Marcs krop skal ud eller hedde "Coachens mål", hvis Marc vil beholde den. Linjen om `kroppe/marc.json` skal ud. | Marc vælger, Yantra retter, Setu kopierer |
| V3 | bør, før Mål dit billede kommer | filmeguiden, punkt 01 og 04 | **Skiven dækker et målepunkt i alle fire faser, guiden nævner.** Filmet lige fra siden står den nære skive (45 cm, dvs. 22,5 cm rundt om stangen) foran alt, der ligger inden for 22,5 cm af stangen. I **squattens bund** ligger stangen på ryggen lige under skulderen, så skulderen er bag skiven. I **dødløftet ved gulvet** står stangen 22,5 cm oppe over midtfoden, så midtfod og ankel er bag skiven. I **dødløftet i knæhøjde** står knæet ved stangen og er bag skiven. I **bænkpresset med stangen på brystet** ligger skulderen under stangen og er bag skiven. Det sidste spørger det andet [MARC]-felt om. Min kritik 494 (B9) fandt den skjulte fod i Marcs eget startbillede. Yantras greb var at klikke foden i et senere billede fra samme kamera, men det står ikke i guiden. Guiden skal sige det: lad kameraet stå stille og film hele løftet, og hent det skjulte punkt fra et andet billede, eller sig ærligt, hvilket punkt der er et skøn. | Yantra vælger grebet, Setu skriver |
| V4 | bør | filmeguiden, punkt 04 | "En fuld skive er 45 cm i diameter." Det gælder 20 og 25 kg skiver og bumperskiver. En 15 kg jernskive er ca. 40 cm, og en 10 kg jernskive ca. 32 cm. Løfter atleten med mindre skiver yderst, bliver skalaen forkert, uden at det ses. Skriv "en 20 eller 25 kg skive" eller "en skive på 45 cm". Punktet skal også læses igen efter Yantras B1 (kroppens længder som skala), som Setu 500 skriver. | Setu |
| V5 | bør | filmeguiden, punkt 01 og 02 | Guiden er skrevet til squat og dødløft. "Hold telefonen lodret" passer ikke til bænkpres, hvor løfteren ligger ned, og der er et liggende billede bedre. "I hoftehøjde" giver heller ikke mening på bænken, hvor højden bør være bænkens eller stangens. Det kan være én linje: "Til bænkpres: telefonen ned på siden, i bænkens højde." Det andet [MARC]-felt spørger om det samme, så svaret kan skrives ind her. | Marc svarer, Setu skriver |
| V6 | Marc | hele siden | Siden hedder "Tre værktøjer", og halvdelen handler om Mål dit billede: kortet og hele filmeguiden. Værktøjet er "Kommer snart". En atlet med en telefon kan læse guiden, men ikke bruge den her. Der er to veje. Filmeguiden kan vente, til Mål dit billede er på. Eller den kan skrives om til "Sådan filmer du dit løft til din coach", som atleter kan bruge i dag (appens videocoach og indbakke). | Marc |
| V7 | lille | De tre løft og Min krop | Ingen af værktøjerne har et link tilbage til værktøjssiden eller sitet. Kortene åbner i samme fane, så telefonens tilbageknap er den eneste vej. En linje "Til værktøjerne" øverst ville hjælpe. Den skal ligge i løftmodellen, hvis hashen skal passe (Setu 500). | Yantra, Setu |
| V8 | Marc | stierne | Min krop ligger i `assets/min-krop/` på squat-grenen og i `assets/vaerktoejer/min-krop/` her. Merges begge, ligger de samme fire filer to steder, og en rettelse skal laves to gange. Setu 491 punkt 3 er stadig åbent. | Marc vælger sti, Setu flytter |
| V9 | lille | overskrift og kort | "Tre værktøjer fra løftmodellen": en fremmed ved ikke, hvad "løftmodellen" er, og kun to af de tre virker. Etiketten "Kommer snart" er 9,3 px på 390. Forslag: "Værktøjer. Regnet med den samme model som artiklerne." | Marc |
| V10 | lille | De tre løft og squat-artiklen | V2 forklarer blok 1's U12. Kapitel 7's to første fejlbilleder har samme tal som De tre løfts "Marcs mål" i bunden: hofte 21,7 cm, knæ −23,0 cm og moment 435,1/497,0/155,9 Nm. Artiklens "anden referencekrop" er altså Marcs højde og vægt (183 cm, 120 kg). Samtidig skriver kapitel 7 "Referencekroppen er ikke en måling af en rigtig atlet". Det er rigtigt nok om længderne, som er udledt af højden, men læseren får det ikke at vide. | Yantra giver ordlyden, Setu skriver |

## Filmeguiden for en atlet med en telefon

Jeg har læst de fem punkter og slutlinjen som en atlet, der står i et fitnesscenter med en telefon og vil
bruge billedet i Mål dit billede.

- **Rigtigt og brugbart:** fra siden og vinkelret, stativ eller kasse i stedet for en makker, lidt længere
  væk og zoom ind mod perspektivet, lys fra kameraets side og ikke modlys. Det er korte linjer i hverdagssprog,
  og hvert punkt har en grund. Slutlinjen om at stoppe i fasen og tage et skærmbillede kan en atlet gøre på
  begge telefontyper.
- **Mangler, så billedet faktisk kan måles:** den skjulte skulder, fod eller knæ (V3), skivens størrelse (V4)
  og bænkpresset (V5).
- **Mindre ting, der kan komme med i samme omgang:**
  - "Zoom ind" er optisk på telefoner med et 2x- eller 3x-kamera. På andre telefoner er det digitalt, og
    billedet bliver grovere. "Brug 2x, hvis telefonen har det" er nok.
  - Et skærmbillede af en afspillet video kan have afspilningsknapper hen over kroppen. Skriv "sæt videoen
    på pause og skjul knapperne, før du tager skærmbilledet".
  - Et billede midt i bevægelsen er ofte uskarpt. Skriv "vælg et billede, hvor stangen er skarp".
- **Rækkefølgen** er god. Punkt 04 bør rykke op som punkt 02, når V3 og V4 er skrevet ind, fordi skiven er
  det, atleten skal tænke på først.

Dommen er, at filmeguiden er rigtig i det, den siger, men at en atlet, der følger den ordret, i alle fire
faser får et billede, hvor ét af de seks punkter er skjult.

## Hvad der skal til for et ja

V1 og V2 skal lukkes. Siden er noindex og ude af menuen, så den kan merges uden at blive set, men den må ikke
linkes fra artiklerne eller menuen, før V1 og V2 er lukket. V3-V5 skal være skrevet ind, før Mål dit billede
kommer på, eller før guiden bliver en guide til coachen (V6). V6 og V8 er Marcs valg.

Maal dit billede stadig klar til sitet: ja

**Ja, og Setu skal kopiere 630 nu.** Yantras 627 og 630 gør, hvad de siger:
- M18 er lukket.
- M19 er lukket: tabeller uden ændring har nu guld i 6-12 %, mod 41-59 % før.
- M20 er lukket.
- Gem ugerne med tallene giver ét PNG med samme guld som siden og ingen måling.

Mine fire nye fund er alle lave (M23-M26), og ingen af dem stopper kopien. M21 og M22 står stadig. Ingen af dem gør et tal forkert.

**Setu kopierer fra løftmodellens `main` (`2ccb0bb`):** `dist/maal-billede/` hel, som Yantra siger.
- Sitets `vaerktoejer` (`1169b5f`) er stadig blob for blob `4ca0c63` i alle syv mapper. Setus 625 er ikke committet.
- Mod `main` er kun `maal-billede/index.html` og `maal-billede.js` anderledes. Miniaturerne, `tre-loeft`, `min-krop` og `baenk-figurer` er de samme.
- Jeg har prøvet kopien, som den bliver (sitet med `main`'s `maal-billede/` lagt ind). Se blok 2 i `RAPPORT-632.md`.

# Kritik 632, blok 1: Mål dit billede efter Yantras 627 og 630

Bhishak, 28. sep. 2026. Ordre 632.

**Løftmodellen:** `entropi-loeftmodel-dhruva` `main` @ `2ccb0bb` (merge af ordre-630, og før den ordre-627 `c266353`), hentet med `git archive`. Intet træ er rørt. `docs/RAPPORT-dag-95.md` og `-96.md` er læst.

**Sitet:** `entropi-coaching-site-wt2` `vaerktoejer` @ `1169b5f`. Jeg har målt i sitets kopi med `main`'s `dist/maal-billede/` lagt oven i.

## Hvad jeg målte

`outputs/kritik-632/maal-632.mjs` gav **19/19** (`maal-632.json`, `.log`, `M-*.png`).

Opsætning:
- Google Chrome 154 headless: 390 med touch, 1280 med mus. Alt net uden for den lokale server er afbrudt. 0 netkald og 0 JS-fejl.
- **Filerne:** én måling er gemt med sidens egen Gem-knap. Min egen PNG-skriver (fra 610) har skrevet klik, dato, højde og fase om, så det giver én uge pr. fil.
- **Klikfejlen:** Yantras antagelse (E8), som i 628.
- Kun syntetiske målinger. Billederne er grå flader.
- **Monte Carlo:** 2.000 forsøg pr. linje gennem sidens egen `ugeTabel`, nu med `markerGuld`. Skalaen er sidens krop. Frøene er de samme som i 628.
  - Regningen er tjekket mod siden: fem forsøg med 12 uger givet siden som filer gav samme antal guld og samme antal "over" (0/0, 5/6, 0/0, 6/8, 5/8).
  - Uden det fjerne nav, som i 628.

## Yantras punkter (dag 95 og 96)

### 1. M19 på siden: min Monte Carlo med den nye regel

SAMME stilling alle uger, altså ingen ændring:

| | 2 uger | 8 uger | 12 uger |
|---|---|---|---|
| guld et sted, 3 runder (628, gammel regel) | 9,2 % | 40,9 % | 49,6 % |
| **guld et sted, 3 runder (nu)** | **0 %** | **5,6 %** | **8,6 %** |
| **guld et sted, 1 runde (nu)** | **0 %** | **8,2 %** | **11,6 %** |
| en enkelt uge over grænsen et sted (uden guld), 3 runder | 9,2 % | 39,7 % | 47,9 % |

**Holder det 6-12 %? Ja.** Tallene er præcis dem, jeg forudsagde i 628 for "to i træk". Yantras egne 4,0-8,2 % (med skiven som skala) ligger lidt lavere.
- Knap en tredjedel af den falske guld (2,9 af 8,6 %) er en række med mindst tre guldceller i samme retning. Det er den ældste uges egen klikfejl, som alle ugerne deler.
- Et billede af den ældste uge, der er klikket skævt, kan altså stadig give en række i guld. "Men ikke aldrig" på siden er ærligt.

**Findes hoften stadig?** Hoften er 5 cm højere fra uge 5 (15 px):

| | guld et sted | guld i hoftens række | over grænsen i hoftens række (gammel regel) |
|---|---|---|---|
| 12 uger, 3 runder | **94,2 %** | 77,5 % | 94,9 % |
| 8 uger, 3 runder | 84,5 % | 62,3 % | 89,3 % |
| 12 uger, 1 runde | 56,1 % | **37,5 %** | 75,5 % |
| 12 uger, 3 runder, hoften glider 0 → 5 cm | 74,7 % | 53,5 % | 81,2 % |

- **Med 3 runder: ja, 94 %**, som jeg sagde i 628.
- **Med 1 runde koster reglen meget (M25):** en hofte, der går 5 cm op og bliver der i otte uger, står kun i guld i sin egen række i 38 % af tabellerne. Før reglen var den over grænsen i 76 %.
  - 5 cm ligger tæt på grænsen med én runde. Reglen kræver, at to naboer begge klarer grænsen.

### 2. En enkelt uge over grænsen

Otte uger med 1 runde uden klikfejl (som Yantras skærmbilleder). Hoften er 13 cm oppe i uge 3 alene og i uge 6-8:
- Uge 3 står "79,2 cm +12,4 cm" uden guld og uden ≈ (`data-over`). Uge 6-8 står i guld. Det er rigtigt på 390 og 1280.
- **Er almindelig skrift uden ≈ klar nok? Nej (M23).**
  - Cellen har samme farve (`rgb(237,234,226)`) og vægt (400) som tallet over den. Den eneste forskel fra "inden for målefejlen" er, at et lille ≈ mangler.
  - En hofte, der springer 13 cm op i én uge, står altså lige så stille som 0 cm. En træner, der skimmer efter guld, ser den ikke.
  - I PNG'et er det det samme: ingen linje under.
  - Tabellen har en enkelt uge over grænsen et sted i 40-58 % af tabellerne uden ændring. Mærket må derfor ikke råbe. Men det skal ses.
- **Ret (Yantra):** et svagt mærke, fx ordet "1 uge" med lille grå skrift under forskellen, og "over grænsen, 1 uge" i almindelig farve i PNG'et. Så kan en træner skelne "intet" fra "noget, der kan være et tilfælde".

### 3. Den nyeste uge

Hoften er 13 cm oppe kun i den nyeste uge (8 uger, 390):
- **Sætningen over tabellen** siger "Efter: … hoften højere (ca. 12 cm) …".
- **Den nyeste celle** står uden guld, og tabellen har 0 guld.
- Monte Carlo (12 uger, 3 runder, 5 cm kun i den nyeste): sætningen nævner hoften i 60,9 %, og hoftens celle er i guld i 1,6 %.
  - Når det er de to nyeste uger, er cellen i guld i 43,5 %.

**Er det forvirrende? Ja, lidt (M24, lav).** Sætningen er den nyeste mod den ældste, og guldet er "to i træk". De måler forskellige ting og siger derfor forskelligt om samme uge. Uge 1 med guld har træneren ikke haft endnu.
- **Ret (Yantra):** når den nyestes forskel står uden guld, tilføj til sætningen: "Den nyeste uge står ikke i guld: kun én uge over grænsen indtil videre."

### 4. M20: "forskel fra 3. aug. 2026"

- **Den faste celle** siger "Mål / forskel fra 3. aug. 2026" (11,7 px). Den står stadig til venstre, når tabellen er rullet helt ud på 390. Den ældste kolonne er så ude af syne.
- **Uden datoer** siger den "forskel fra den ældste".
- **I PNG'et** har hver blok "Mål, forskel fra 3. aug. 2026".

**Er det nok? Ja.** Datoen står det sted, øjet går hen, når det leder efter rækkens navn. Det behøver ikke stå under hver dato.

### 5. M18's ordlyd

Kørt på 390 og 1280:

| Start | Efter Byt | Efter Byt igen |
|---|---|---|
| omvendt (uge 8 før, uge 1 efter): "Før er gemt senere end efter; tryk Byt …" og advarslen | "Før og efter er byttet, så det ældste billede nu er før." Advarslen er væk | "tryk Byt" og advarslen igen |
| rigtig: intet om Byt | "tryk Byt" og advarslen | "Før og efter er byttet, så det ældste billede nu er før.", ingen advarsel |

- **Er ordlyden klar? Ja.** Den siger, hvad der er sket, og hvad resultatet er.
- **Er "tryk Byt" rigtigt, når træneren selv har byttet til den forkerte rækkefølge? Ja.** Det er nu forkert, og noten og advarslen er enige.
- Den sidste celle (rigtig → Byt → Byt) er sand, men lidt mærkelig: træneren har blot trykket to gange. Det skader ikke.

### 6. Det gemte PNG for ugerne

- **Størrelsen:** 8 uger giver 1200 × 2648 px i to blokke. 12 uger giver 1200 × 3714 px i tre blokke.
- **Indholdet:**
  - ingen måling i filen (`enTr` mangler)
  - filnavnet er `maal-dl-gulv-uger-2026-09-21.png`
  - samme guld som siden: 9 "over grænsen, 2 uger i træk" = 9 guldceller
- **Kan en atlet læse det på en telefon? Kun med zoom (M26, lav).**
  - Vist i fuld bredde på 390 px er billedet 861 px højt, altså én skærm.
  - Men cellernes tal er 7,8 px, noterne 6,8 px og titlen 11,1 px. Sidens mindste er 11,7 px.
  - Med to fingre er det fint at læse (`M-390-632-uger-gemt-paa-telefon.png`). Det er sådan, man ser et billede i en chat.
- **Er fire uger pr. blok rigtigt? Ja.** Fem kolonner fylder 1200 px. Flere uger giver mindre skrift.
- **Skal den ældste gentages i hver blok? Nej.** "Mål, forskel fra 3. aug. 2026" i hver blok (M20) gør blok 2 læselig alene.
- **Ret (Yantra), hvis det skal kunne læses uden zoom:** celletal på 30 px og noterne på 26 px, eller tre uger pr. blok.
- **"over grænsen, 2 uger i træk" på to linjer** koster en ekstra linje i hver guldcelle, men den er læselig. En kortere linje, fx "2 uger i træk", ville spare en linje pr. guldcelle.

### 7. "Ca. 5 % pr. forskel"

**Er det ærligt? Det er for højt, men det er den forsigtige side.**
- Min Monte Carlo giver 2,2 % af cellerne over grænsen med 3 runder, og 2,7-3,0 % med 1 runde.
- "ca. 2 af dem" (35 celler) er 0,8-1,0 i snit.
- Da tallet får træneren til at stole mindre på en enkelt celle, er det ikke skadeligt.
- Rådet "Læs en forskel, der går igen uge efter uge" er nu det, siden selv gør med guldet. Det er et råd, siden godt må give, for det handler om målingen, ikke om løftet.
- **Valgfrit:** "ca. 2-3 %" og "ca. 1 af dem".

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M18 | lukket | Byt skriver noten om; noten og advarslen er enige i alle seks tilfælde. | |
| M19 | lukket | Guld et sted uden ændring: 5,6 % (8 uger) og 8,6 % (12 uger) med 3 runder, 8,2-11,6 % med 1 runde; hoften 5 cm fundet i 94 %. | |
| M20 | lukket | "forskel fra 3. aug. 2026" i den faste celle, også rullet ud, og i hver blok i PNG'et. | |
| M23 | lav | En enkelt uge over grænsen skilles fra "inden for" kun ved et manglende ≈. 13 cm i én uge står lige så stille som 0 cm, også i PNG'et. | Yantra: et svagt mærke, fx "1 uge" i lille grå skrift under forskellen, og "over grænsen, 1 uge" i almindelig farve i PNG'et. |
| M24 | lav | Den nyeste uge alene: sætningen siger "hoften højere", men cellen står uden guld. | Yantra: sætningen siger, når den nyestes forskel ikke er i guld: "Den nyeste uge står ikke i guld: kun én uge over grænsen indtil videre." |
| M25 | lav | Med 1 runde står en hofte, der går 5 cm op og bliver der, kun i guld i sin egen række i 38 % af tabellerne (76 % før reglen). Med 3 runder 78 %. | Yantra: Uger siger det selv, fx "Klik hver uges billede 3 gange; med 1 runde når guldet sjældnere frem." |
| M26 | lav | Det gemte PNG i fuld bredde på en telefon: tal 7,8 px, noter 6,8 px. Det kræver zoom. | Yantra, valgfrit: 30 px i cellerne og 26 px i noterne, eller tre uger pr. blok. |
| M21 | lav | Står fra 628: en anden højde på siden bruges tavst. | Yantra |
| M22 | lav | Står fra 628: "samme kameraplads" i hver celle. | Yantra |

"Ca. 5 %" (punkt 7) er en valgfri rettelse, ikke et fund.

**Ingen af dem stopper Setus kopi.**

## Ærlige grænser

- **Ingen telefon:** headless Chrome 154 på Windows med Playwrights touch.
  - Sidelæns rul med en finger er ikke prøvet. Jeg har sat `scrollLeft`.
  - PNG'et er ikke åbnet i Fotos på en iPhone. Skriftens størrelse er regnet fra 1200 px vist i 390 css-px.
- **Klikfejlen er Yantras antagne, ikke målt på en træner.** Er rigtige klik værre, bliver den falske guld flere, og M25 bliver mindre.
- **Tallene er uden det fjerne nav.** Kun dødløft ved gulvet med sidens krop som skala. Squat og bænk er ikke målt.
- **Filerne er skrevet om af mig,** ikke gemt af en træner uge for uge.
- **Hvad en træner forstår** (M23, M24) er min vurdering, ikke prøvet på en træner.
- **Kørt:** kun mine egne scripts. Ikke Yantras suite.
- **Grænserne:** ingen rigtige atleter eller klip. Løftmodellen og sitet er ikke rørt.

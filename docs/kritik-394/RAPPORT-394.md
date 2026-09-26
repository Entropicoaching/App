Ordre 394

# Rapport: squat-opslagsværket med alle Yantras rettede figurer, den sidste læsning før Marc (Bhishak)

**Klar til Marc: nej**, fordi to steder i teksten stadig siger noget andet end tabellen ved siden af (N4 i kapitel 6, N3 i kapitel 3). Figurerne er klar: F1-F4, F6 og F7 er lukket. De to rettelser er ren tekst, ca. et kvarter for Setu. Derefter er dommen ja, og læseguiden herunder kan bruges uændret.

Har arbejdet betydning for Hara: **ja, for Coaching-planeten**, sporet med løft-artikler på entropicoaching.dk. Dommen afgør, om Marcs squat-artikel kan gå til ham. Det er ikke delmålet "Appen mærkbart bedre", for appen er ikke rørt.

## Gren

`kritik-394` fra `main` (`dc39052`) i `entropi-app-wt2`, tre commits:

| Blok | Commit | Indhold |
|---|---|---|
| 1 | `9a49ee8` | `scripts/kritik-394.mjs`, `verify:kritik-394` i `package.json`, `FIGURER-394.md` og figurbillederne |
| 2 | `6313cf3` | `ARTIKEL-394.md`, teksten med åbne folde og 72 skærmbilleder af artiklen |
| 3 | se `git log -1` | Fuld kørsel, `KRITIK-squat-388.md` og denne rapport |

Ingen push og ingen merge. Sitet (`entropi-coaching-site-wt2`, `squat-opslag-11` = `7356445`) er kun læst via `git archive`.

## Hvad ændret

- **Kun i app-wt2, intet i sitet.**
- `scripts/kritik-394.mjs` er min `kritik-384.mjs` i den udgave, Setu kørte i sitet som `scripts/kritik-386.mjs` på `squat-opslag-11`. Den udgave har samme måling plus A1-A7 og K6, og Q1/Q2/Q7 læses fra `alt` og billedernes egne mærker, da der ikke er inline-SVG længere.
- Ændringer i forhold til Setus udgave:
  - Grenen er fast (`squat-opslag-11`), og løftmodellen er `5b83412`.
  - Al skrivning går til `outputs/kritik-394/` gennem en stikontrol.
  - `--ud` og `--rev` er fjernet.
- **Valg:** ordren siger "filer kun under docs/ og outputs/", men kræver også `npm run verify:kritik-394`. Scriptet ligger derfor i `scripts/`, og `package.json` har fået én linje. Sådan gjorde jeg også i 384 og 392.
- `docs/kritik-394/`:
  - `FIGURER-394.md` (blok 1);
  - `ARTIKEL-394.md` (blok 2);
  - `KRITIK-squat-388.md` (dom og fundliste);
  - denne rapport.
- `outputs/kritik-394/` fylder ca. 16 MB:
  - 54 figurbilleder og 5 af panel og vælger i brug;
  - 72 skærmbilleder af artiklen på 390;
  - teksten med åbne folde, `figurer.txt`, `maalinger.json` og `resultat.txt`.

## Testresultat

- `npm run verify:kritik-394`: kører rent mod `squat-opslag-11` `7356445`. Output i `outputs/kritik-394/resultat.txt`.
  - **Lukket (mekanisk):** Q1-Q16, Q18-Q20, A1-A7 og K6. A4: 6 rækker × 5 celler mod `tal.json` (5b83412) giver 0 forskelle.
  - **Åben:** Q21. Kapitel 6's knapper er 32 px høje.
  - **Venter:** Q17 og Q22 (Marc).
- Stil: 0 tankestreger, 0 "man skal", 0 udråbstegn og 0 interne navne. Forbeholdet står sidst.
- 0 konsolfejl og ingen vandret rulning på 390.
- Egennavne: kun forskere, regelbogen og Instagram. **0 atletnavne.**
- `npm run lint`: grønt.
- **Min læsning (ikke scriptets):**
  - Figurer lukket: F1, F2, F3, F4, F6 og F7.
  - Stadig åbne: F5, F8 og F10. F9 er delvis.
  - Nye fund: N4 (vigtigt), N3 og N5 (irriterer), N1, N2 og N6 (kosmetisk).
  - Fund, tal og steder står i `KRITIK-squat-388.md`.

## Hvad er næste

**Dommen er nej. Rettes før Marc (Setu, en ordre, ca. et kvarter, kun tekst i `artikel-squat.html`):**
1. **N4, kapitel 6 under tabellen.**
   - "Ved knæhøjde siger tabellen nej på knæet og torsoen. Knæet er 76,5° ... den største afvigelse i løftet" skrives om, så det handler om torsoen (45,2° mod 52,7°, nej). Knæet er upålideligt.
   - "et 'ja' i tabellen er en svag enighed" får et eksempel, der findes i tabellen, fx hoften ved knæhøjde (± 5,3°, ja).
2. **N3, kapitel 3, folden "Bækkenet er ikke sit eget led".** 83° bliver 89°, og 105° bliver 107°.
3. Samtidig, hvis Setu vil:
   - **N5:** "vokser mest i anden halvdel" bliver fx "kommer foran hoften i første halvdel og fordobles i anden".
   - **N6:** "Stangen sænker næsten farten" bliver "Stangen går næsten i stå".

**Kan vente, og er ikke til Marc:**
- F5 og N1 (mærker oven i hinanden) er Yantras.
- F8, N2 og Q21 (små tekster og knapper på telefonen) er Setus.
- F9 og F10 (balde, hoved, vælgerens figur) er Yantras.

**Når 1 og 2 er rettet:**
- En ny læsning er ikke nødvendig. `npm run verify:kritik-394` med `REV` sat til den nye gren viser, at resten ikke er flyttet.
- Et opslag i teksten viser, at N3 og N4 er væk.

Derefter får Marc denne læseguide.

**Læseguide til Marc (10 minutter på telefonen), når N3 og N4 er rettet.** Åbn `artikel-squat.html` fra grenen:
1. **Kapitel 1, 3 min.**
   - Rul gennem de syv figurer. Ligner opstilling og lockout en rigtig lowbar-lockout for dig? Torsoen er 14°, knæet låst, og stangen står 3 cm bag midtfoden.
   - Læs "Momentet" under nedtur og bund.
2. **Kapitel 5, 2 min.** Se de fire stangfigurer. Ligner front squat (albuerne) og safety bar (åg, håndtag, skive) det, du ser i salen?
3. **Kapitel 7, 3 min.**
   - Læs "Ankelgrænsen stopper skinnebenet" og "Stangen foran midtfod".
   - Giver guld mod blå og tabellerne mening for en coach?
4. **Kapitel 6, 1 min.** Åbn "De fem stillinger som stillbilleder" og se det stiplede knæ. Læs de to afsnit under tabellen.
5. **Til sidst, 1 min.** Find de 10 gule `[MARC: ...]`-bokse og "Kommer"-boksen. Spørgsmålene står også i `RAPPORT-388.md` i sitet, klar til at kopiere. Dine svar lukker Q17 og Q22.

## Ærlige grænser

- **"Ligner en squat" er min dom som læser af billederne, ikke en måling.** Jeg har set alle 27 figurer på 390 og udvalgte på 1280. Alle kapitel 1-, 5- og 7-figurer og to af kapitel 6's fem stillbilleder har jeg set enkeltvis.
- **F5's overlap** er målt i SVG'ens koordinater for good morning (guldets grundlinje y 339,5, blåt hænger fra y 336,1). For ankelgrænsen er det kun set på skærmbilledet.
- **Good morning:** "ved samme skulderhøjde" ser ud til, at blåt ligger lidt højere i billedet. Jeg har ikke målt det og regner det ikke som fund.
- **Skærmbillederne:**
  - Sidens klæbende topbjælke ligger oven på toppen af nogle elementbilleder. Det er et artefakt, ikke en fejl på siden.
  - `figurer.txt` giver kapitel 6's fem stillbilleder bredden 0 px, fordi de måles før foldningen. Billederne selv er fine.
  - Canvas-tekst (F8) er skønnet fra billedet, ikke målt.
- **Alvoren og dommen "nej" er mit valg.** N3 og N4 er små. Men ordren siger, at Marc ikke skal bruge tid på det, en kritiker kan finde, og N4 står lige der, hvor læseguiden sender ham hen.
- Kapitel 6 nævner Marcs egne mål og klip (183 cm, 120 kg, 270 kg). Det er forfatteren, ikke en atlet, og det stod der også i 384.
- **outputs/kritik-394/** fylder ca. 16 MB i det offentlige repo, ligesom 384's bevis.
- **Arbejdstræet:** de fem ikke-sporede billeder i `outputs/kritik-skole*/` lå der før ordren. Jeg har ikke rørt dem.
- Ingen push, ingen merge, ingen atletdata, ingen sub-agenter, og intet er skrevet i sitet eller i løftmodellen.

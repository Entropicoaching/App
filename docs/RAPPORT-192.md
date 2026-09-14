# Rapport — ordre 192: kortlægningen står på skuldre

## Gren + commit-hashes

Gren `kortlaegningen-bredere`, forgrenet fra `main` (`e04a771`, som allerede
havde ordre 188 mergét ind, jf. `git log --oneline -3 main` ved start).

- `6b02193` — commit 1: hent free-exercise-db, oversæt til vores muskelgrupper
- `f78197d` — commit 2: dansk aliastabel til den genererede kortlægning
- `06328a5` — commit 3: kobl den genererede kortlægning ind i `slaaOevelseOp`
- (denne rapport er commit 4, se hash i `git log` efter commit)

## Hvad blev ændret

**Commit 1.** `scripts/byg-muskelkort.mjs` henter
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (The
Unlicense, bekræftet via GitHubs license-API) mod ét fast commit-SHA
(`a859101d…`, ikke `main`) og skriver `src/volume/muskelkort.generet.json`:
kun `category` "strength" (431 af 876), kun udstyr Marcs atleter bruger
(barbell, dumbbell, cable, machine, kropsvægt, kettlebell, elastik), kildens
muskler oversat til `MUSKELGRUPPER` med samme PRIMÆR/MEDVIRKENDE-vægtning
muskelkort.js allerede bruger. Fem muskler uden sikker 1:1-oversættelse
(hamstrings, mavemuskler, underarme, traps, midt-ryg, plus adductors/
abductors/neck) er udeladt og talt, ikke gættet på — se `_meta` i den
genererede fil. Ny `npm run byg:muskelkort` genkører scriptet.

**Commit 2.** `DANSK_ALIAS` i samme script: 126 danske øvelsesnavne, én
linje pr. øvelse, der peger på kildens engelske navn. Scriptet validerer
hvert alias mod den filtrerede kilde og dropper (med tælling) et alias hvis
mål ikke overlevede filtreringen — i denne kørsel slog alle 126 korrekt op.

**Commit 3.** `src/volume/muskelkort.js`s `slaaOevelseOp` slår nu op i tre
lag: Marcs rettelse (uændret fra ordre 185) → den indbyggede kortlægning
(RAA_KORT, kurateret, uændret) → den genererede (commit 1+2), engelsk navn
direkte eller via `danskAlias`. Den indbyggede vinder altid over den
genererede ved samme øvelse. `kendteOevelser()` er bevidst IKKE udvidet —
den dækker stadig kun de 26 indbyggede, så den eksisterende testsuite i
`src/volume/*.test.js` (41 tests) er uændret og grøn, som beviset for at de
er urørte. Fire nye tests dækker commit 3's egen ordre (engelsk fra
genereret, dansk fra genereret via alias, stadig-ukendt, rettelse vinder
over alt).

**Commit 4 (denne).** Målt dækning og bundle-vækst (se nedenfor), og
`docs/VOLUMEN.md` udvidet med et afsnit om kilden, dens grænse, og at Marcs
rettelse stadig vinder altid.

## Testresultat

- `npm run lint`: grøn.
- `node --test` på alle 19 testfiler i `src/`: **188/188 grønne** (45 i
  `src/volume/`, heraf 4 nye fra commit 3).
- Alle 32 `verify:*`-scripts (inkl. `verify:n8n`): **grønne**.
- `npm run e2e`: **grøn** ("atlet → coach, ende-til-ende", 26,3s).
- `npm run build`: grøn. Bundle-vækst målt ved at bygge `main` og
  `kortlaegningen-bredere` hver for sig: Dashboard-chunken (hvor
  `muskelkort.js` indgår) voksede fra 266,50 KB til 320,43 KB — **+53,93 KB**
  ukomprimeret (gzip +6,61 KB), **under ordrens 60 KB-grænse**. Ingen
  yderligere beskæring af udstyrstyper var nødvendig.

**Målt dækning** (script kørt mod `slaaOevelseOp` + mockens seed, ikke
committet — se metoden i `docs/VOLUMEN.md`s nye afsnit):
- Kendte øvelser FØR (kun indbygget): **26**.
- Kendte øvelser EFTER (indbygget + genereret + dansk alias, distinkte
  opslagsnavne): **570** — en udvidelse på **544**.
- Mockens loggede øvelser (`e2e/fixtures.mjs`): kun **1** unikt navn
  ("Squat"), som allerede var kendt FØR ordren. Kendt FØR = 1/1, kendt EFTER
  = 1/1 — **ingen ændring målbar på selve mocken**, fordi mockens
  øvelsesdata er for tyndt til at vise bredden. Det er kortets egen
  optælling (26 → 570), ikke mock-tallet, der viser effekten af ordren.

## Hvad er næste

- Den genererede liste er ikke udtømmende for isolationsøvelser uden en
  gruppe i vores model (mave, underarme, traps, midt-ryg, hamstrings som
  isoleret gruppe) — en fremtidig ordre kunne tilføje disse
  `MUSKELGRUPPER`-nøgler og køre scriptet igen for at hente dem med.
  `_meta.udeladteMuskler` i den genererede fil siger præcis hvor mange
  øvelser det ville åbne for.
- Dansk-alias-tabellen dækker 126 af de 431 genererede øvelser — resten slår
  kun op på deres engelske navn. Flere aliaser kan tilføjes i
  `DANSK_ALIAS` uden at røre resten af scriptet.
- `scripts/byg-muskelkort.mjs` er pinnet til ét commit-SHA — en fremtidig
  gentagelse med en nyere SHA vil kræve en ny kørsel og et nyt review af
  diff'en (kilden kan ændre navngivning/klassificering over tid).

## Ærlige grænser

- **"shoulders" → anteriorDeltoid er kildens egen grovere gruppering, ikke
  vores.** free-exercise-db skelner ikke forreste/midterste/bageste skulder
  — en genereret post der rammer `anteriorDeltoid` betyder "kilden mener
  denne øvelse rammer skulderen", ikke nødvendigvis specifikt den forreste
  del, til forskel fra de indbyggede bænkpres/skulderpres-poster hvor det ER
  efterprøvet. Dokumenteret i `docs/VOLUMEN.md`, ikke gemt.
- **Mock-tallet beviser intet i sig selv.** E2E-mockens eneste øvelse
  ("Squat") var allerede kendt før ordren — den tynde seed-data kan ikke
  vise bredden ordren faktisk giver. Dækningstallet (26 → 570) kommer fra at
  spørge kortet selv, ikke fra en observeret ændring i mockens outputs.
  Ærligt, men et svagere bevis end ordren nok håbede på.
- **Genereret data har ingen kilde-linje pr. gruppe** (til forskel fra den
  indbyggede RAA_KORT, hvor hver linje har en `kilde`-tekst). Det var et
  bevidst valg for at holde bundle-væksten under 60 KB — 431 øvelser × en
  kilde-sætning pr. linje ville have kostet langt mere end 60 KB. Kilden er
  i stedet dokumenteret ét sted (`_meta` i den genererede fil + VOLUMEN.md),
  ikke pr. linje.
- **79 af kildens 876 øvelser er helt udeladt** fordi ALLE deres muskler
  falder i en udeladt gruppe (typisk mavemuskler/hamstrings/underarme) — de
  vises hverken som kendte eller med en delvis, sandsynligvis misvisende
  gruppeliste.
- Ingen ny runtime-afhængighed, intet netværkskald i appen (kun scriptet, som
  kun en udvikler kører), ingen Supabase-ændring, `src/Dashboard.jsx` og
  `e2e/` er urørt. Ingen push.

## Delmål (Hara)

Intet Delmål i hovedblokken for denne ordre (ordren angav ikke ét).

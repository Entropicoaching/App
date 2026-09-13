# Rapport — Ordre 177: hvor lander volumen henne? Første version

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`volumen-pr-muskelgruppe`, forgrenet fra `main` (`f5a09a4`). Fem commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `42ea6cf` | `src/volume/muskelkort.js` — hvilke muskelgrupper en øvelse rammer, med ærlige vægte |
| 2 | `c63b9ea` | `src/volume/beregn.js` — sæt pr. muskelgruppe pr. uge, rene funktioner |
| 3 | `4062627` | `src/dashboard/VolumenKort.jsx` — kortet på atletsidens "Oversigt"-fane |
| — | `aad61fd` | Rettelse: forkert afsnitshenvisning i én kildekommentar fra commit 1 (`(e)-(g)` → `(e)-(i)`), ingen tal ændret |
| 4 | `8d09f23` | `docs/VOLUMEN.md` — hvad tallene betyder, skrevet til Marc |

Arbejdstræet er rent efter hver commit. Ingen push, ingen produktions-Supabase,
ingen migration, ingen atletdata (kun mockens attrapatlet "Testatlet").

## Hvad blev ændret

**Commit 1.** For hver øvelse appen (i denne første version) kender, en
liste af muskelgrupper med andel 1,0 (primær) eller 0,5 (medvirkende) —
ingen andre tal. Gruppenavnene for knæ-/hofte-/rygstrækkere, læggen,
brystmuskel, forreste skulder og triceps er taget **ordret** fra
`entropi-loeftmodel/src/muscles.js`, så de to modeller taler samme sprog
senere (ordrens egen instruks). To nye grupper — `lats` og `biceps` —
er tilføjet for trækøvelser (roning, nedtræk, pull-up, chins), som
løftmodellen ikke dækker; de har ingen biomekanisk kilde og er mærket
"skoen" med begrundelse, ligesom løftmodellens egen konvention kræver.
~30 øvelser er kortlagt (squat-, dødløft- og bænkpres-familierne samt
trække-/isolationsøvelser); alt andet falder til `kendt:false`.

**Commit 2.** `beregnVolumenPrUge(saet, opts)`: rene funktioner, ingen
Supabase/UI. Ugenøgle er **kalenderuge** (ISO 8601, mandag-søndag) for
logget dato — ikke appens programuge (`weeks.week_number`), fordi
coachens spørgsmål handler om hvornår kroppen faktisk blev belastet, ikke
om programstrukturen (bevidst valg, noteret her). Sæt markeret
`skipped:true` tælles aldrig. To tal pr. gruppe: "direkte" (kun
andel 1,0-sæt) og "i alt" (vægtet med alle andele). Testet mod
e2e-mockens egen attrapatlet (`e2e/fixtures.mjs`'s `buildSeed`), ikke
egen opdigtet data — de tre loggede squat-sæt derfra lander korrekt på
knæ (3/3), hofte (3/3), ryg (0/1,5) og læg (0/1,5).

**Commit 3.** `VolumenKort.jsx`: en lille tabel i "Oversigt"-fanen på
atletsiden — ingen graf-bibliotek, ingen ny afhængighed. Rækker er
muskelgrupper (kun dem der reelt har data i vinduet), kolonner er de
seneste seks uger (nyeste til venstre), celler er "direkte/i alt". En
"Ukendt øvelse"-række vises altid når der er ukendte sæt i vinduet —
aldrig skjult. Øverst står linjen ordren krævede ordret: "Sæt er ikke
belastning. Tallene tæller gennemførte sæt, vægtet efter hvad øvelsen
belaster." `Dashboard.jsx` henter nu `athleteLogs` for `oversigt`-fanen
(samme kald `program`/`analyse`/`log` allerede brugte).

**Commit 4.** `docs/VOLUMEN.md`, én side, skrevet til Marc: hvad de to
tal betyder, hvad de ikke betyder (intensitet, nærhed til failure,
delvise reps, isolering mod flerledsøvelser — ingen af delene er med),
hvorfor "Ukendt øvelse" vises i stedet for at blive gættet på, og hvordan
man retter en forkert kortlægning i `muskelkort.js`.

## Testresultat

**npm run lint:** rent.
**node --test (alle .test.js under src/):** 160/160 grønne, inkl. de 17 nye
(9 i `muskelkort.test.js`, 8 i `beregn.test.js`).
**npm run e2e:** GRØN — "atlet → coach, ende-til-ende", 24,5s (kørt efter
`Dashboard.jsx`-ændringen, ingen regression i coach-flowet).
**npm run build:** grøn, ingen kompileringsfejl fra det nye kort.
**Alle 31 `verify:*`-scripts + `verify:n8n`:** 31/32 grønne. Den ene der
fejler (`verify:auth-logout-role-switch`) fejler på et regex-tjek af
`App.jsx`'s `onRecheckRole`-syntaks — en fil denne gren **ikke har rørt**.
Bekræftet ved at sammenligne `git show main:src/App.jsx` mod scriptets
egen regex: fejlen findes allerede på `main` (`f5a09a4`), før denne
ordre. Ikke rettet her, da det er uden for ordrens omfang (ingen ordre om
at røre `App.jsx`/auth-flowet) — nævnes til Marc/Dhruva som en
præ-eksisterende brist, ikke noget ordre 177 forårsagede.

## Hvad er næste

- Kortlægningen dækker ~30 øvelser. Vokser "Ukendt øvelse"-linjen i
  praksis, er næste skridt at tilføje flere poster i `muskelkort.js` —
  ikke at bygge en ny mekanisme.
- Næste naturlige skridt (næste ordre, ikke denne): den visuelle model
  ordren nævner som formålet bagved — "modellen skal vise det visuelt" —
  kan nu bygge oven på `beregn.js`'s tal og løftmodellens fælles
  gruppenavne.
- Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
  bedre"): coachen kan nu for første gang se hvor programmeret volumen
  faktisk lander i kroppen ("20 sæt quads ugentlig"), ikke kun hvilke
  øvelser der er skrevet ind. Første version, bevidst snæver.

## Ærlige grænser

- **Kortlægningen i `muskelkort.js` er ufuldstændig med vilje.** ~30
  øvelser er kortlagt; ni muskelgrupper findes i taxonomien
  (knæ-/hofte-/rygstrækkere, læggen, brystmuskel, forreste skulder,
  triceps, lats, biceps). Skuldre ud over forreste skulder (sidehæv,
  bagerste skulder), mave, underarme/greb og isoleret hamstring/læg er
  IKKE kortlagt — de øvelser falder til "Ukendt øvelse" i kortet, hvilket
  er den bevidste, synlige grænse ordren bad om, ikke en fejl.
- **De fleste andele under 1,0 for ikke-hovedløft er "skoen" med kort
  begrundelse, ikke litteratur.** Kun squat/dødløft/bænkpres-familiens
  tal læner sig på `entropi-loeftmodel/docs/muskler-litteratur.md`;
  resten (roning, curls, split squat osv.) er anatomisk almindelig
  viden, eksplicit mærket som sådan i hver linje.
- **Ugen er kalenderuge, ikke programuge** — en atlet der logger et sæt
  mandag efter midnat lokal tid kan i sjældne tilfælde få det talt med i
  "forkert" uge, fordi kalenderdatoen læses som `logged_at.slice(0,10)`
  (samme konvention Dashboard.jsx allerede bruger andre steder) uden
  egen tidszone-korrektion. Dokumenteret i `beregn.js`, ikke skjult.
- **`verify:auth-logout-role-switch` fejler**, men på `main` allerede —
  se Testresultat. Ikke undersøgt til bunds (hvorfor regex'en er ude af
  trit med `App.jsx`), da det ligger uden for denne ordre.
- **En arbejdsfejl undervejs, rettet med det samme:** jeg kørte ved en
  fejl `git checkout main -- .` for at undersøge om testfejlen ovenfor var
  ny eller gammel, hvilket midlertidigt lagde `main`'s version af
  `Dashboard.jsx` ind i arbejdstræet (kun den fil — ingen nye filer blev
  ramt). Opdaget straks via `git status`, rettet med
  `git checkout HEAD -- src/Dashboard.jsx` før noget blev committet. En
  ældre, ikke-mine stash (`"pre-existing koe-regel edits"`) lå allerede i
  stash-listen og er urørt. Nævnes her for gennemsigtighed, ikke fordi
  noget gik tabt.
- Har ikke bygget den visuelle model ordren selv peger frem mod — kun
  oversættelsen (kortlægning + regnestykke + et lille tabel-kort), som
  ordren selv afgrænsede denne omgang til.

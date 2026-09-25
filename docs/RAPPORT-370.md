**main kan pushes: ja** (efter merge. Intet af det nye er aktivt, før Marc siger ja til n8n-import og migration.)

# Rapport: ordre 370, Coach Briefing skarpere (tre blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Coach Briefing blev testet på 7 syntetiske atleter, der hver har noget en coach skal fange. I dag fanger den 2 af 6. Ingen af de to linjer siger, hvad Marc skal gøre, og den ene peger den forkerte vej. Efter ordren fanger den 6 af 6, hver med tal, uge og én konkret handling, i rækkefølgen smerte → fravær → afvigelse fra plan → fremgang. Alt er afprøvet på opdigtede atleter. Intet er kørt mod produktion.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): **ja**. Det er Marcs egen formulering af målet ("skarpere Coach Briefing"), og den er nu bygget og testet. Den bliver "i drift", når Marc siger ja til de to trin under "Hvad er næste".

## Gren

Gren `briefing-skarpere`, forgrenet fra `main` (`7409552`).

- `3d01f58` blok 1: syntetiske atlet-uger, v1-reglerne som ren JS, FOER
- `ee51322` blok 2: v2-regler og -tekst, coach-prioritering i n8n, migration (ikke kørt), tests
- denne commit: blok 3: EFTER, negation i smerteord, denne rapport

Træet er rent efter denne commit. Ingen push, ingen migration kørt, ingen n8n-import, ingen atletdata. VideoCoach og upload-flowet er ikke rørt.

## Hvad ændret

**Blok 1: hvad siger den i dag** (`outputs/briefing-370/FOER.md`)
- `test/fixtures/briefing/`: 7 opdigtede atleter × 8 uger i tabellernes form (`weeks`/`sessions`/`exercise_logs`/`readiness_logs`/`personal_records`): A squat står stille, B RPE +1,5, C knæsmerte, D mister 2 pas, E PR, F intet, G modstridende data.
- `src/coachBriefingRules.js` · `detectSignalsV1`: en tro port af `training-signals-v1.sql`. Porten er bekræftet række for række mod den ægte SQL i PGlite: 35/35 ens.
- `scripts/briefing-370.mjs`: kører n8n-flowets egne kode-noder (hentet fra `7409552`) på signalerne.
- Hovedfund: v1's stagnationsregel kalder et plateau lige efter fremgang for "+3,7 % fremgang". Der findes ingen detektor for smerte, fravær på pasniveau eller PR. Signaler har ingen handling. Stagnation giver én række pr. løft, men opgavenøglen er atlet+detektor, så løftene overskriver hinanden.

**Blok 2: skarpere regler og tekst**
- `detectSignalsV2` (ren funktion). Hvert signal har `headline` = fundet med tal og `detail` = handlingen (også i `metrics.action`):
  - `pain` (ny): smerteord i pas-kommentar i denne eller sidste uge → alert med kropsdel, uge, pas og løft. Kommentaren citeres aldrig. Ellers giver ømhed ≥4/5 3 af 7 dage context.
  - `missed_sessions` (ny): seneste afsluttede uge, ≥2 pas uden log → alert med uge, datoer og hvilke pas.
  - `stagnation`: plateau = ≥3 uger uden ny top (>0,5 %). Stiger topsættets RPE → alert, fx "Squat stået stille 3 uger (140×5 siden uge 5), RPE 8→9 mod plan 8" → "Overvej deload eller en variation". v1's faldregel er bevaret. Der er ét signal pr. atlet.
  - `rpe_drift`: v1's tærskler, men nævner det tungeste løft og siger hvor meget der skal sænkes.
  - `data_conflict` (ny): RPE under plan, men trætte check-ins → "Øg ikke belastningen endnu" i stedet for v1's "træner lettere".
  - `pr` (ny): appens egen `personal_records` de sidste 7 dage, med forrige bedste.
  - `dropout`: v1-regel med skarpere tekst.
- `n8n/build-coach-briefing.code` + `coach-briefing-v1.json` (`Build briefing`): rang smerte 0, fravær 1, afvigelse 2, besked/video 3, PR 4, og alert før context inden for samme rang. Signalets handling vises som guldlinje, også i "Næste opgave". Navnet gentages ikke foran fundet. Emnet får "· først: <navn> (<label>)". `priorityVersion` = `coach-order-v2`. Ved dublet-nøgler vinder den vigtigste. Et v1-signal uden `action` vises som før, så rækkefølgen af import og migration er ligegyldig.
- `n8n/verify-workflows.mjs`: to forventninger er opdateret (tekst og `priorityVersion`), og der er en ny blok, der tjekker coach-rækkefølgen, handlingslinjen, at navnet ikke gentages, og at v1-signaler stadig vises.
- `src/coachPriority.js`: kun labels for de 4 nye detektorer (verify kræver, at mail og app bruger samme labels).
- `supabase/migrations/20260925120000_training_signals_v2.sql`: **NY fil, IKKE KØRT, kræver Marcs ja** (står øverst). Samme funktionsnavn og samme kolonner som v1, så RPC, app og `coach_signal_actions` virker uændret. v1's `ok`/`insufficient`-rækker til appen er bevaret (33 = 33). To små formateringsfunktioner er tilføjet.
- `scripts/briefing-370-sql-paritet.mjs`: kører v1-SQL og v2-migrationen i PGlite på de syntetiske atleter og sammenligner med JS.

**Blok 3: før/efter** (`outputs/briefing-370/EFTER.md`)
- Side om side pr. atlet med én linje om, hvad Marc nu ville gøre anderledes.
- Fundet under blok 3 og rettet: "Ingen smerter i dag" indeholder "smert" og ville have givet et smerte-alert. `mentionsPain` fjerner nu negationer ("ingen/uden/ikke … smerte/ondt", "smertefri") i både JS og SQL. Atlet F har fået sådan en kommentar som regressionstest.

## Testresultat

- `node --test src/coachBriefingRules.test.js src/coachBriefingSeen.test.js`: **19/19 grønne**. Heraf 12 nye: én pr. syntetisk atlet (A-G, hver tjekker både v1 og v2), prioritering, n8n-noden med samme rangtabel og rækkefølge, ferie, ét stagnationssignal pr. atlet og negationer.
- `node n8n/verify-workflows.mjs`: **OK**.
- `npm run lint`: **grøn**. `npm run verify:coach-priority`: **OK**.
- `node scripts/briefing-370-sql-paritet.mjs` (kræver `npm i --no-save @electric-sql/pglite@0.2`): **PARITET OK**. v1-SQL = JS-port på 35/35 rækker, v2-migration = `detectSignalsV2` på 6/6 fyrende rækker, og `metrics.action` = `detail` overalt.

## Hvad er næste

Marc skal sige ja til to ting. Rækkefølgen er ligegyldig, men begge skal til, før forskellen ses:
1. **Migrationen**: kør `supabase/migrations/20260925120000_training_signals_v2.sql` (erstatter kroppen af `entropi_training_signals_v1`, tilføjer `entropi_briefing_num`/`entropi_briefing_kg`). Først efter det får appen og mailen de nye linjer. Tilbagerulning: kør `supabase/sql/training-signals-v1.sql` igen.
2. **n8n-import** af `n8n/coach-briefing-v1.json` (kun noden `Build briefing` er ændret) til den eksisterende workflow-id, og derefter aktivering som i dag.

**Sådan ser Marc forskellen i næste uges briefing:** hvert signal i "Kræver dit blik" har en handling som undertekst ("Kontakt i dag …", "Sænk squat ~5 % …"), og hvis mailen kommer, står der i emnet, hvem der er først, og hvorfor ("· først: <atlet> (Smerte)").

Forslag til en senere ordre: appens egen rækkefølge (`coachPriority.js`: alert 0 / context 3) har endnu ikke smerte → fravær → afvigelse. Mailen har den. Det er en lille ændring, men den ligger uden for denne ordres rammer.

## Ærlige grænser

- **Skemaet er antaget, ikke verificeret mod prod.** Migrationen antager `sessions(week_id, title, session_order, athlete_comment)`, `exercises(session_id)`, `readiness_logs(logged_date, energy, soreness_level, sore_zones)` og `personal_records(created_at)`, udledt af appens egne kald. Paritetstesten kører på tabeller bygget efter den antagelse. Den beviser SQL-logikken og syntaksen i Postgres, ikke at kolonnerne hedder sådan i prod. Første kørsel bør ske på en Supabase-gren.
- **Appen har intet smerte-felt.** "Smerte" er et nøgleord i pas-kommentaren (plus høj ømhed). Nævnes smerte kun i en besked eller slet ikke, fanger briefingen det ikke. Nøgleord kan også fejle i begge retninger ud over de negationer, der er dækket. Et rigtigt smerte-felt i check-in ville være mere sikkert.
- **Fravær tæller kun afsluttede uger.** Mistede pas i den igangværende uge ses først mandag, fordi det ikke er verificeret, hvordan `weekday` mapper til en dato.
- **Tærsklerne er sat efter coach-logik og afprøvet på 7 syntetiske atleter, ikke kalibreret på rigtige data:** plateau ≥3 uger og <0,5 %, RPE-stigning ≥0,5, trætte check-ins ≥ halvdelen. v1-kommentaren sagde "stagnation aldrig alert (offseason = fladt forventet)". v2 giver kun alert, når RPE samtidig stiger, men en bevidst vedligeholdelsesfase med stigende RPE vil også blive markeret.
- **Tidligere kvitteringer kan dukke op én gang igen.** `coach_signal_actions` genkender et kvitteret signal på `severity + metrics`, og v2 tilføjer felter til `metrics`. Et signal, Marc har kvitteret for under v1, vil derfor blive vist én gang til efter migrationen.
- **Mailens emne siger stadig "har ventet et døgn"**, også for dagens alerts. Det er bevaret, fordi verify og Frame fallback-noden bygger på den tekst. Den nye del ("· først: …") er det, der gør emnet brugbart.
- **Små forskelle mellem JS og SQL uden for fixturerne:** rækkefølgen af ømhedszoner (SQL alfabetisk) og tie-break mellem to løft med præcis samme RPE-afvigelse. Det påvirker ikke de 7 atleter.
- **Afvigelse fra "Læs KUN":** for at kunne sige, hvad briefingen siger i dag, skulle `supabase/sql/training-signals-v1.sql` læses (der bor reglerne; flowet viser kun `headline`/`detail`). Derudover `n8n/verify-workflows.mjs`, som skal holdes grøn, detektor-label-kæden i `src/coachPriority.js` og målrettede grep i `AthleteView.jsx`/`Dashboard.jsx` for at kende kolonnenavne (`readiness_logs`, `sessions`, `personal_records`). Der er ikke læst mere end det.
- PGlite blev installeret med `--no-save` i scratchpad og kun kopieret midlertidigt ind i `node_modules` under kørslen. `package.json` og lockfilen er ikke ændret.

main kan pushes: ja

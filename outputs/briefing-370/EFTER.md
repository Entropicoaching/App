# Coach Briefing EFTER (ordre 370, blok 3)

Samme 7 syntetiske atleter som i [FOER.md](FOER.md), nu med den nye briefing. Ingen rigtige atletdata.

**Sådan er det kørt:** `detectSignalsV2()` i `src/coachBriefingRules.js` → n8n-flowets egne kode-noder fra arbejdstræet (`Keep unresolved backup items` + `Build briefing`), kørt lokalt. Genskab med `node scripts/briefing-370.mjs --dump efter`. Den nye SQL (`supabase/migrations/20260925120000_training_signals_v2.sql`, **ikke kørt**) er kørt i PGlite (Postgres i hukommelsen) på de samme atleter og giver præcis de samme 6 linjer som JS-funktionen (`scripts/briefing-370-sql-paritet.mjs`: "PARITET OK").

## Side om side

"Mail" er det, der står i rækken (label · resumé, handlingslinje i guld). "App" er titel/undertekst i "Kræver dit blik".

| Atlet | FØR | EFTER | Hvad Marc nu ville gøre anderledes |
| --- | --- | --- | --- |
| **C** knæsmerte | *intet* | **Smerte (alert, nr. 1):** "melder ondt i knæet (pas-kommentar, uge 7, Pas 3 med squat); ømhed ≥4/5 i Ben 2 af de sidste 7 dage" → *Kontakt i dag, før næste squat-pas. Skift til en smertefri variant og lavere vægt, indtil det er afklaret* | Skriver til C i dag og ændrer næste squat-pas, i stedet for at opdage det ved næste check-in, efter at C har squattet på et ondt knæ. |
| **D** mister to pas | *intet* | **Fremmøde (alert, nr. 2):** "mistede 2 af 3 pas i uge 7 (14.-20. sep.): Pas 2, Pas 3" → *Skriv i dag og spørg hvorfor, før næste uge lægges. Er tiden problemet, så gør ugen til 2 pas* | Spørger hvorfor, før næste uge lægges, og tilpasser antallet af pas, i stedet for at sende endnu en uge med 3 pas, som D ikke når. |
| **A** squat står stille | *intet* (v1 regnede plateauet som "+3,7 % fremgang") | **Udvikling (alert, nr. 3):** "Squat stået stille 3 uger (140×5 siden uge 5), RPE 8→9 mod plan 8" → *Overvej deload eller en variation (fx pause- eller tempo-squat) i næste blok* | Planlægger deload eller en squat-variation nu, i stedet for at lægge endnu en uge med +2,5 kg på et plateau med stigende RPE. |
| **B** RPE +1,5 over plan | "Atlet B: træner tungere end planlagt · snit-afvigelse 1.66 RPE over 3 uger (48 sæt)" | **RPE (alert, nr. 4):** "RPE i snit +1,7 over plan de sidste 3 uger (48 sæt); mest på Squat +2,0" → *Sænk squat ~5 % næste uge, og spørg til søvn, stress og restitution* | Sænker squat-belastningen ~5 % og spørger ind, i stedet for selv at skulle finde det løft, der trækker, i loggen. |
| **G** modstridende data | App: "Atlet G: træner lettere end planlagt / snit-afvigelse -1.00 RPE …" (inviterer til at øge) | **Datatjek (context, kun app):** "modstridende data: RPE i snit -1,0 under plan (3 uger, 48 sæt), men ømhed ≥4/5 eller energi ≤2/5 i 3 af 4 check-ins" → *Øg ikke belastningen endnu: afklar, om RPE logges rigtigt, eller om træthed bliver skjult* | Lader være med at øge belastningen og spørger G, hvordan RPE logges, i stedet for at skrue op på en atlet, der er træt. |
| **E** PR på bænk | *intet* | **PR (context, sidst, kun app):** "PR på Bænk 100×3 (22. sep.; før 97,5×3)" → *Anerkend det i en kort besked; planen virker, ingen ændring nødvendig* | Sender en kort "godt gået" samme uge, i stedet for at PR'en går ubemærket hen. |
| **F** intet at bemærke (kommentar: "Ingen smerter, knæet føles stærkt") | *intet* | *intet*. Negationen giver ikke et smerte-signal | Ingenting. Det er rigtigt, og briefingen larmer ikke. |

## Hele mailen, før og efter

| | FØR | EFTER |
| --- | --- | --- |
| Emne | Coach Briefing: 1 ting har ventet et døgn | Coach Briefing: 4 ting har ventet et døgn · først: Atlet C (Smerte) |
| Rækker | 1. RPE · Atlet B · "Atlet B: træner tungere end planlagt · snit-afvigelse 1.66 RPE over 3 uger (48 sæt)" | 1. Smerte · C · … → handling<br>2. Fremmøde · D · … → handling<br>3. Udvikling · A · … → handling<br>4. RPE · B · … → handling |
| Prioritet | "alerts først" (kun én) | smerte → fravær → afvigelse fra plan → beskeder/videoer → fremgang |
| Navn | står to gange (rækkens navn + "Atlet B: …") | én gang |

Mailen er stadig en sikkerhedsline. Den tager kun alerts med, så G (datatjek) og E (PR) står i appen, ikke i mailen. Det er med vilje: de kræver ikke handling i dag.

## Målt mod de fire krav

| Krav | FØR (2 linjer af 6 mulige) | EFTER (6 linjer af 6 mulige) |
| --- | --- | --- |
| Specifik: løft, tal, uge | delvis på begge (tal, men intet løft og ingen uge) | alle 6 nævner løft eller kropsdel, tal (vægt×reps, RPE, sæt, pas) og uge eller dato |
| Handlingsrettet | 0 af 2; G peger den forkerte vej | 6 af 6 har én konkret handling |
| Prioriteret | ingen rangorden mellem signaler | smerte og fravær først, fremgang sidst; testet i både ren funktion og n8n-noden |
| Ny | uændret: 3-dages-undertrykkelse + kvittér/udsæt | uændret (virker allerede), og nu ét stagnationssignal pr. atlet i stedet for én række pr. løft, der overskrev hinanden |

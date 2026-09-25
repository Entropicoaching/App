# Coach Briefing FØR (ordre 370, blok 1)

Hvad briefingen siger **i dag** (main `7409552`) om 7 syntetiske atleter. Ingen rigtige atletdata: atleterne, vægtene og kommentarerne er opdigtede (`test/fixtures/briefing/`).

**Sådan er det kørt:** reglerne i `supabase/sql/training-signals-v1.sql` (frafald, stagnation, RPE-drift) er porteret én til én til `detectSignalsV1()` i `src/coachBriefingRules.js`. Derefter kommer RPC'ens filter (kun `alert`/`context` sendes videre), og til sidst n8n-flowets egne kode-noder `Keep unresolved backup items` + `Build briefing`, hentet fra `7409552:n8n/coach-briefing-v1.json` og kørt lokalt. Genskab tallene med `node scripts/briefing-370.mjs --dump`.

Briefingen har to overflader:
- **Appen** ("Kræver dit blik" / Coach Briefing-fanen) viser alle `alert`- og `context`-signaler: titel = `headline`, undertekst = `detail`.
- **Mailen** (n8n) er en sikkerhedsline. Den tager kun `alert`-signaler med og viser `label · navn · headline · detail`.

Fixture-ugen: 3 pas pr. uge (man/ons/fre), 18 sæt, 8 uger fra 3. aug. "I dag" er fredag 25. sep. 2026, og uge 8 er i gang.

## Pr. atlet: hvad den siger, og vurdering

De fire krav: **S** = specifik (nævner løft, tal og uge), **H** = handlingsrettet (hvad Marc gør nu), **P** = prioriteret (det vigtigste først), **N** = ny (ikke noget Marc lige har set).

| Atlet | Hvad der faktisk skete | App i dag | Mail i dag | S | H | P | N |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Squat står stille på 140×5 i 3 uger. Topsættets RPE stiger 8 → 8,5 → 9 mod plan 8 | *intet* | *intet* | – | – | – | – |
| B | RPE ligger +1,5 over plan i 3 uger (squat +2) | "Atlet B: træner tungere end planlagt" / "snit-afvigelse 1.66 RPE over 3 uger (48 sæt)" | RPE · Atlet B · "Atlet B: træner tungere end planlagt · snit-afvigelse 1.66 RPE over 3 uger (48 sæt)" | delvis | nej | ja | ja |
| C | Skrev i uge 7, at knæet gør ondt i bunden af squat. Ømhed 5/5 og 4/5 i Ben to dage i denne uge | *intet* | *intet* | – | – | – | – |
| D | Mistede pas 2 og 3 i uge 7 | *intet* | *intet* | – | – | – | – |
| E | PR på bænk 100×3 mandag (før 97,5×3) | *intet* | *intet* | – | – | – | – |
| F | Intet at bemærke | *intet* | *intet* | ja (korrekt tavs) | – | – | – |
| G | Logger RPE 1 under plan, men 3 af 4 check-ins siger ømhed 5/5 og energi 1-2/5 | "Atlet G: træner lettere end planlagt" / "snit-afvigelse -1.00 RPE over 3 uger (48 sæt)" | *intet* (context er kun i appen) | delvis | nej, og vildledende | – | ja |

Hele mailen for de 7 atleter: emnet er **"Coach Briefing: 1 ting har ventet et døgn"** med én række (B). Appen har to rækker (B alert, G context).

## Vurdering linje for linje

**A: tavs, selvom der er noget.** Stagnationsreglen sammenligner snittet af de 3 seneste ugers bedste e1RM med de 3 foregående uger. En atlet, der steg til 140 og så sidder fast der, ser derfor ud som fremgang: reglen regner "Squat e1RM 158→163 kg (+3.7%)" og giver `ok`, så RPC'en sender intet. Reglen kan kun sige `context` ved et *fald* på mindst 5 %, og den er skrevet til aldrig at sige `alert`, så stagnation når aldrig mailen. RPE-stigningen på topsættet drukner i snittet over alle 48 sæt (+0,08). Det her er præcis Marcs eksempel ("squat stået stille 3 uger, RPE stiger"), og briefingen fanger det ikke.

**B: fanget, men ikke til at handle på.**
- *S delvis*: tallet 1.66 og "3 uger (48 sæt)" er med, men ikke *hvilket* løft der trækker op (squat +2, resten +1,5). Tallet står med punktum og to decimaler ("1.66"), hvor en dansk coach skriver "+1,7".
- *H nej*: der står ikke, hvad Marc skal gøre (sænke belastningen? spørge til søvn og stress?).
- *P ja*: det er det eneste i mailen og kommer derfor først.
- *N ja*.
- I mailen står navnet to gange ("Atlet B" og så "Atlet B: træner …"), fordi `headline` allerede har navnet med.

**C: tavs om smerte.** Der findes ingen smerte-detektor. Appen har intet "smerte"-felt. Det nærmeste er `readiness_logs.soreness_level` (1-5, muskelømhed) + `sore_zones` (Ben/Ryg/Skuldre/Arme/Core) og `sessions.athlete_comment`. Ingen af delene læses af briefingen. Det vigtigste, en coach skal vide i en uge, kommer slet ikke frem.

**D: tavs om fravær.** Frafaldsreglen kigger på sæt pr. uge over 30 dage mod normen og kræver et fald under 0,65× normen. To mistede pas i én uge trækker snittet ned til 14,0 mod norm 18 (0,78×) og giver `ok`. Der findes ingen regel, der tæller planlagte pas mod gennemførte. "Mistede 2 af 3 pas i uge 7" siges aldrig.

**E: tavs om fremgang.** Der findes ingen PR-detektor. Stagnationsreglen regner "Bænk i fremgang" (`ok`), men `ok` sendes ikke videre. `personal_records`, som appen selv skriver, læses ikke. En coach vil gerne sige "godt gået" samme uge.

**F: korrekt tavs.** Det er godt. Mailen sendes slet ikke, når intet er galt.

**G: fanget, men forkert læst.** "Træner lettere end planlagt" inviterer til at øge belastningen. Check-ins i samme 3 uger siger det modsatte (ømhed 5/5, energi 1-2/5 i 3 af 4). Enten er RPE-loggen forkert, eller også skjules træthed. Reglen ser ikke check-ins, så linjen er specifik om tallet men vildledende om handlingen. Den er kun `context` og når derfor ikke mailen.

## Tværgående fund

1. **Prioritering:** alle træningssignaler er sidestillede ("alerts først, så ældste besked/video"). Der er ingen rangorden mellem smerte, fravær, afvigelse fra plan og fremgang, og tre af de fire kategorier findes ikke som signal.
2. **Ét signal pr. detektor pr. atlet, men stagnation giver én række pr. løft.** Opgavenøglen er `signal-<atlet>-<detektor>`, så med to løft i stagnation beholder n8n kun det sidst sete (dublet-fjernelsen er en `Map`), og det er tilfældigt, hvilket løft Marc ser.
3. **Handling mangler for signaler.** Beskeder og videoer har en handlingslinje ("Svar de ulæste beskeder"). Signaler har ingen, med den begrundelse at `detail` allerede er handlingsrettet, men det er den ikke: `detail` er et tal.
4. **Emnet** siger "1 ting har ventet et døgn", også når tingen er et alert fra i dag. Det fortæller ikke, hvad eller hvem det handler om.
5. **Ny:** 3-dages-undertrykkelsen (`mentionedAt`) og `coach_signal_actions` (kvitteret/udsat) fungerer og holder gentagelser ude. Det er ikke der, problemet ligger.

**Samlet:** af 6 atleter med noget at sige (A-E, G) fanger briefingen 2. Ingen af de to linjer siger, hvad Marc skal gøre, og den ene (G) peger den forkerte vej. Smerte, fravær og PR mangler helt.

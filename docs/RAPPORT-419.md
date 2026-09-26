Ordre 419

# En uge som atlet på telefonen: fem irritationer fundet, de tre største rettet

**Kort:** Jeg har gennemført en hel uge som syntetisk atlet: headless, 390 px, mod
e2e-mocken, 4 pas med squat, bænk, dødløft og tilbehør. Atleten loggede sæt, sprang et
over, rettede et tal, fortrød et sæt, satte RPE og en note, så historik og fremgang og
uploadede en video. Alle tryk er talt. De fem største irritationer står i
`docs/ATLETENS-UGE.md`, og I1–I3 er rettet på Dagens pas-kortet. Ugen gik fra 79 til 61
tryk og fra 4 til 1 rulning, anslået ca. 112 s → 86 s. Atleten skal ikke længere forlade
Dagens pas for at skrive RPE, en note eller en vurdering af passet.

**Hara (Coaching, delmål "Appen mærkbart bedre"):** Det er netop de små ting, som en
atlet møder hver træningsdag. Vægtfeltet står nu på coachens anbefalede vægt i stedet
for et lettere tal fra et andet pas. RPE og note kan sættes på selve kortet. Passet
slutter med ét tryk for "hvordan gik det". Coachen får dermed rigtig RPE, noter og
vurderinger. Før blev den planlagte RPE gemt stille, og vurderingen lå gemt i Program.

## Gren

`atletens-uge` fra `main` @ `da89c90` (414 er merget). Grenen fandtes allerede fra
ordre 268. Den var helt merget i main (ingen egne commits), så jeg nulstillede den til
main med `git checkout -B`. Tre commits:

- `0fb63b6` blok 1: målingen (`outputs/419/uge.mjs`, `uge-faelles.mjs`), billeder og tal
  før rettelsen (`outputs/419/foer/`) og `docs/ATLETENS-UGE.md` med I1–I5.
- `2de069a` blok 2: I1–I3 rettet, efter-målingen (`outputs/419/efter/`), før/efter i
  `docs/ATLETENS-UGE.md`.
- blok 3 (commit efter `2de069a`): build, offline-bevis og denne rapport.

Intet er pushet. Der er ingen kald mod prod, ingen migration og ingen atletdata.

## Hvad ændret

**I1: vægtfeltet starter på coachens anbefalede vægt.** Før stod feltet på "sidste gang",
det seneste pas med øvelsen. For squat var det lørdagens lette volumenpas (92,5), mens
kortet sagde "Anbefalet: 100kg". Det kostede 11 +/−-tryk om ugen, og et Godkendt uden at
se efter gemte et forkert tal.
- `src/setLogDefaults.js` `defaultSetWeight`: ny `coachWeight`. Rækkefølgen er nu tastet
  → coachens anbefalede → sidste gang → appens forslag. Der er en ny test i
  `src/setLogDefaults.test.js`.
- `src/athlete/DagensPasCard.jsx`: giver `ex.recommended_weight` som `coachWeight`.
  Øvelser uden anbefaling bruger sidste gang som før.
- `e2e/dagens-pas-historik.spec.mjs` (ordre 293) låste den gamle rækkefølge og forventer
  nu coachens 80 i stedet for 95. Den viser stadig, at forudfyldningen kører igen, når
  historikken kommer (reps 4 → 5).

**I2: RPE og note på kortet.** RPE-boksen lignede en knap, men var død, og den planlagte
RPE blev gemt som den faktiske. En rigtig RPE og en note krævede 7 tryk og 1 rulning via
Program-fanen.
- `DagensPasCard.jsx`: `RPE 8 ▾` er en knap, der åbner en række med 5,5–10 (samme skala
  som Program). "+ note" i vægtrækken åbner et notefelt med fokus. Begge skriver i
  sættets `logInputs` (`rpe`, `note`), som `logSet` allerede gemte. Uden valg gemmes den
  planlagte RPE som før. Data og skema er uændrede.
- Resultat: 4 tryk (RPE, 9, + note, Godkendt), 0 rulninger, og atleten bliver på kortet.

**I3: passet spørger, hvordan det gik.** Før skiftede kortet direkte til næste pas, og
"Træningsfeedback" lå kun nederst i Program.
- `HjemTab.jsx` finder passet, hvis sidste sæt lige er logget fra kortet, og som ingen
  vurdering har (læst fra `allWeeks`). `DagensPasCard.jsx` viser én linje øverst:
  "Dag 1 — Squat er klaret. Hvordan gik det? 1–5 · spring over".
- `saetSkrivning.js` `saveFeedback(sessionId, direkte)`: tager nu en vurdering direkte og
  returnerer true/false. Skrivningen af `athlete_rating` er den samme som fra Program.
  Fejler den, bliver linjen stående med den kendte fejlbesked. `AthleteView.jsx` giver
  `saveFeedback` videre til `HjemTab`. Det er den eneste ændring dér.
- Resultat: 1 tryk i stedet for 4 tryk + 1 rulning. Linjen forsvinder, når første sæt i
  næste pas logges.

Coachens sider er ikke rørt.

## Testresultat

- `npm run lint`: grøn.
- `node --test src/*.test.js`: 323 af 323 grønne, heraf 1 ny (I1).
- `npm run build`: grøn (`outputs/419/koersel-build.txt`).
- **Offline-beviset fra 397/406/414** (`node outputs/414/offline-bevis.mjs` med
  `BEVIS_UD=outputs/419/offline-bevis`): grønt i alle tre scenarier, ingen konsolfejl
  (`outputs/419/koersel-offline-bevis.txt`, `outputs/419/offline-bevis/bevis-*.json`).
  - `tid`: `[1,1,1,1]`, hvert sæt med tiden fra "Godkendt".
  - `haenger`: `[1,1,1,0]`, sæt 2 vist som ventende efter 8 485 ms, køen sendt af sig
    selv efter 18,9 s.
  - `fortryd-doer`: `[1,0,0,0]`, køen har sletningen lige efter fortryd.

  Intet i Dagens pas uden net er gået i stykker.
- **Ugen, målt** (`node outputs/419/uge.mjs`): grøn før og efter. 38 rækker, 1 sprunget
  over, sæt 3 i dødløft med `note: "ryg stram"` og `rpe_actual: 9`, Dag 4 med
  `athlete_rating: 4` (efter) og ingen konsolfejl.

  | | Før | Efter |
  |---|---|---|
  | Tryk i ugen | 79 | 61 |
  | Rulninger | 4 | 1 |
  | +/− for at nå anbefalet vægt | 11 | 0 |
  | RPE + note på et sæt | 1 dødt + 7 tryk, 1 rul | 4 tryk |
  | Vurdering af passet | 4 tryk, 1 rul | 1 tryk |
  | Anslået tid for ugens handlinger | ~112 s | ~86 s |
- `verify:*` der rører atletens visning, alle grønne: `athlete-training-inputs`,
  `athlete-reps-per-set-mobile`, `athlete-tap-targets`, `athlete-first-day-flow`,
  `athlete-write-failures`, `athlete-read-failures`, `athlete-jargon-explained`,
  `athlete-silent-fails-5`, `athlete-silent-fail-visibility`, `athlete-self-service`,
  `athlete-onboarding`, `athlete-onboarding-guide`, `athlete-readiness-draft`,
  `athlete-rest-timer-drift`, `atletens-uge`, `atletens-uge-holder`, `ugen-faar-dato`.
- e2e, grønne: `dagens-pas-historik`, `dagens-pas`, `ret-saet`, `saet-nu`, `atlet-uge` og
  `rolig-forside`. Den sidste gik rød på den første udgave, fordi "+ note" i reps-rækken
  brækkede linjen ved 360 px og skubbede chips under folden (805 > 780). Knappen står
  nu i vægtrækken, og chips-bunden er 745 som på main. E2e-kørslerne overskriver
  gemte billeder i `outputs/314`, `320`, `330` og `ugen-faar-dato`. Dem har jeg sat
  tilbage med `git checkout`.

## Hvad er næste

**Det kan Marc mærke på sin egen telefon efter push** (log ind som en testatlet eller
kig over skulderen på en atlet):
1. Vægtfeltet i Dagens pas står på det tal, du har skrevet som "Anbefalet", og ikke på
   sidste gangs tal. Står der intet anbefalet, er det sidste gang som før.
2. Boksen `RPE 8 ▾` ved reps kan trykkes og giver 5,5–10. "+ note" står til højre i
   vægtrækken. Begge følger sættet, når der trykkes Godkendt.
3. Efter sidste sæt i et pas spørger kortet: "… er klaret. Hvordan gik det? 1–5". Ét
   tryk, og vurderingen står hos dig som før fra Program.
4. I din visning kommer der flere rigtige RPE-tal, noter og vurderinger. Selve visningen
   er ikke ændret.

Tjek ét punkt selv: Kopierer du uger uden at rette "Anbefalet", starter atleten nu på
det gamle anbefalede tal og ikke på sidste gang. Er det tit tilfældet, så sig til, så
kan feltet i stedet bruge det største af de to.

**I4 og I5 (ikke rettet):**
- **I4, Fremgang:** Tallet står med ca. 7 px skrift og er skåret af ved grafens kant
  ("117 kg e1"). Der står ingen ændring. Forslag: en linje over grafen i normal størrelse,
  "Squat e1RM 117 kg · +7 kg siden uge 36", og etiketten holdt inden for grafen. Det er
  en lille ordre i `src/athlete/FremgangTab.jsx`.
- **I5, video:** Efter "Send" står to kvitteringer oven i hinanden, og ingen af dem kan
  læses. Forslag: kun "Video modtaget ✓ …". Det hører til en VideoCoach-ordre
  (`public/videocoach.html`).
- Også set: ret-panelet brækker midt i reps-kontrollerne ved 390 px, pauselinjen kører
  videre efter passets sidste sæt, og "vis / ret" bliver stående foldet ud på tværs af
  øvelser.

## Ærlige grænser

- **Alt er målt mod e2e-mocken, headless**, ikke på en telefon og ikke mod prod.
  Tidsangivelserne er maskintid (klik til næste tilstand) plus en regnet menneske-tid
  (1,2 s pr. tryk, 1,5 s pr. rulning, 0,3 s pr. tegn). Menneske-tiden er ikke målt.
- **De 4 pas er gennemført på samme kalenderdag.** "Sidste gang" vælges på samme måde
  i en rigtig uge (seneste pas med øvelsen), så I1 gælder. Men pauselinjen mellem pas
  og ugestrimlens "i dag" ser anderledes ud end på fire forskellige dage.
- **I1 ændrer en tidligere beslutning** (ordre 280/293: sidste gang før planens tal), og
  jeg har rettet Bhishaks e2e-spec til det. Hvor tit Marcs "Anbefalet" er forældet, kan
  jeg ikke se uden prod-data. Se "Hvad er næste".
- **Vurderingslinjen fylder ca. 75 px** på første sæt i næste pas. Ved 390 × 844 står
  Godkendt da delvis bag pauselinjen: 50 af 60 px er synlige, og knappen kan trykkes.
  Linjen forsvinder efter første sæt eller "spring over".
- **Fejlvejen for vurderingen** (ingen net → fejlbesked, linjen bliver) er læst i koden,
  ikke kørt i browseren. RPE og note fra kortet uden net er heller ikke kørt. De går i de
  felter, køen allerede sendte (`note`, `rpe_actual`), men offline-beviset sætter ingen
  RPE.
- Vurderingen er kun målt i pas 4. Linjen kommer også efter pas 1–3, og der har scriptet
  ikke trykket på den.
- Jeg har ikke kørt hele `npm run e2e` (run-all), kun de seks specs, der rører Dagens pas
  og forsiden, og ikke `verify:kritik-403` denne gang.

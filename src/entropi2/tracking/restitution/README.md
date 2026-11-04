# Restitution (frakoblet)

Ren model `buildRestitution(snapshot, { enabled: true })` og stateless React-visning
`RestitutionOverview({ enabled, snapshot, onRetry? })`. Begge returnerer `null`,
medmindre `enabled === true`; snapshot læses ikke ved OFF. Ingen entry-point,
flagændring, query, lagring, programændring eller ny databasekontrakt.

## Inputkontrakt

Værten skal allerede have lovlig adgang til én atlets data. Den leverer et fuldt,
fejlfrit snapshot med `status: 'ready'`, `complete: true`, `dailySource:
'readiness_logs'`, `athleteId`, `endDate` (sidste afsluttede danske kalenderdag),
`readinessRows` og `exerciseLogs`. Begge arrays kræves, højst 10000 rækker hver.
`complete` bekræfter begge læsninger og deres fulde 14-dages periode; fejl,
sidebegrænsning, uafsluttet paginering og delvise data må aldrig markeres komplette.
`status: 'loading'` giver ventetekst; alle øvrige utilstrækkelige transportkontrakter
giver generisk fejl. Ingen fejltekst fra input vises. Tomme komplette arrays er
gyldige og giver “For lidt data”. Der leveres ingen læseadapter i denne billet.

Eksisterende produktionsfelter:

- `readiness_logs`: `athlete_id`, `logged_date`, `sleep_hours` (tal 0–24),
  `energy`, `stress`, `soreness_level` (heltal 1–5). Ingen `score`-afledning eller
  antaget søvnkvalitet. Hvert felt har uafhængig dækning; manglende/ugyldigt er ukendt.
- `exercise_logs`: `athlete_id`, `id`, `exercise_id`, `set_number`, `logged_at`,
  `weight`, `reps_completed`, `skipped`; `_optimistic` er klientens foreløbige markør.
  Værten leverer autoritative udførte sæt, aldrig planlagte sæt. Kg og udførte
  gentagelser parses med appens eksisterende `parseInputNumber`; intet RPE kræves.

Alle rækker skal tilhøre `athleteId`; identitetsblanding giver fejl. Datoer valideres
med appens kalenderhjælpere; zonede tidsstempler konverteres til Europe/Copenhagen.
Der læses intet implicit ur. Duplikerede dagsformdatoer giver fejl. Eksakte
træningskopier tæller én gang; konflikter i sætid eller øvelsesposition, ufuldstændig
sætidentitet og ugyldige mål forhindrer belastningssammenligningen. Konflikter
kontrolleres før datofiltrering. Foreløbige/oversprungne rækker udelades.

## Grundlag og forsigtige grænser

De sidste 7 afsluttede dage kræver mindst fire gyldige målinger af **hvert** af
søvn, energi, stress og ømhed samt en komplet dagsform på en af de sidste to dage.
Træning deles i to sammenhængende, ikke overlappende 7-dages vinduer. Hvert vindue
kræver mindst to forskellige registrerede træningsdage. Belastning er summen af kg ×
udførte gentagelser; den foregående sum skal være positiv. Ingen data er ukendt,
ikke nul eller dokumenteret hvile. Uden dette grundlag er niveauet `null` og status
`insufficient` (“For lidt data”), også hvis enkelte mål ser lave ud.

Med tilstrækkeligt grundlag bruges disse enkle produktgrænser for ugegennemsnit:

- `lav`: søvn <6 timer, energi ≤2/5, stress ≥4/5 **eller** ømhed ≥4/5.
- `god`: søvn ≥7 timer, energi ≥4/5, stress og ømhed ≤2/5, og den seneste
  registrerede belastning ≤1,2 × de foregående 7 dage.
- Ellers `ok`. Belastningsstigning alene giver aldrig `lav`.

Grænserne er ikke klinisk validerede; status er et forsigtigt registreringsoverblik,
ingen måling af fysiologisk restitution, risikomodel eller årsagspåstand.
Skift i øvelser og registreringsdækning kan ændre belastningstotalen.

## Visning og afprøvning

Atlet og en fremtidig autoriseret coach-vært får samme lille visning: status først,
periode og kort forbehold. Én native, lukket `details` indeholder målinger med
antal/7 dage, seneste komplette dato, begge belastningssummer, forholdet, huller,
udeladelser og de præcise grænser. Scope-CSS, fleksibel bredde, én kolonne på små
skærme, tastaturfokus og native controls med mindst 44 px højde. Ingen særlige
coach-handlinger eller persondata eksponeres af modellen.

Alle `.test.mjs` opdages af appens eksisterende `npm test`-runner. Rene modeltests
og uafhængige literal-cases importerer faktiske moduler. Syntetiske elementtests
bruger kun den fastlåste offentlige testfixture og er ikke React/layoutbevis.
`RestitutionOverview.test.mjs` bruger rigtig React og ReactDOM; uden pakkerne er
dens tre tests eksplicit SKIP. Dhurva skal køre disse uden SKIP samt fuld suite og
build i den afhængighedsklare integration. Ingen installation her.

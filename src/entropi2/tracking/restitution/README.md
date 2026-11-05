# Restitution og coachens Analyse-fane

Ren model `buildRestitution(snapshot, { enabled: true })` og stateless React-visning
`RestitutionOverview({ enabled, snapshot, onRetry? })`. Begge returnerer `null`,
medmindre `enabled === true`; snapshot læses ikke ved OFF. Ingen flagændring, lagring, programændring eller ny databasekontrakt.
Coach-koblingen beskrives nedenfor; selve modellen og bladvisningen laver ingen IO.

## Inputkontrakt

Værten skal allerede have lovlig adgang til én atlets data. Den leverer et fuldt,
fejlfrit snapshot med `status: 'ready'`, `complete: true`, `dailySource:
'readiness_logs'`, `athleteId`, `endDate` (sidste afsluttede danske kalenderdag),
`readinessRows` og `exerciseLogs`. Begge arrays kræves, højst 10000 rækker hver.
`complete` bekræfter begge læsninger og deres fulde 14-dages periode; fejl,
sidebegrænsning, uafsluttet paginering og delvise data må aldrig markeres komplette.
`status: 'loading'` giver ventetekst; alle øvrige utilstrækkelige transportkontrakter
giver generisk fejl. Ingen fejltekst fra input vises. Tomme komplette arrays er
gyldige og giver “For lidt data”. Coach-adapteren sikrer denne kontrakt med egne afgrænsede læsninger.

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

Atletens eksisterende bladvisning og den autoriserede coach-vært genbruger samme model: status først,
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

## Kobling til Analyse (TRACK-KOBL-RESTITUTION2)

`AnalyseTab.jsx` genbruger den eksisterende Entropi 2/LazyBoundary-scope fra
ugeevalueringen. Kun `enabled === true`, et eksisterende klientobjekt og samme
coach/valgte atlet giver en lazy `CoachRestitution`. Den står umiddelbart under
Søvn og før eksport. OFF importerer eller monterer ikke restitution-koblingen.

`hasRestitutionData` bruger de gamle grafarrays som et tilstedeværelsessignal:
mindst ét gyldigt søvn-/dagsformfelt i de sidste 7 afsluttede dage samt mindst én
ikke foreløbig/oversprunget træningslog i de sidste 14 afsluttede dage, begge for
den valgte atlet. Ingen `score`, søvnkvalitet eller planlagt træning erstatter dem.

`coachRestitutionData.mjs` henter kun de ovennævnte produktionskolonner fra
`readiness_logs` og `exercise_logs` med atletfilter og periode. Hver kilde har et
loft på 1000 rækker; nås loftet, vises fejl, aldrig en delvis beregning. Zonede
træningstidsstempler overhentes ved UTC-kanterne, hvorefter modellen anvender
præcise danske datoer. Numeriske sætid normaliseres til strenge. Fremmede rækker,
transportfejl og ugyldige snapshots giver generisk fejl uden rå fejltekst.

Coach ser en native, lukket “Restitution (7-14 dage)”. Ved åbning vises den
forsigtige status eller “For lidt data”, periode og forbehold uden årsagspåstande.
Datagrundlag og grænser er yderligere foldet. Teksten omtaler atletens svar og
restitution; titlen gentages ikke inde i folden. Bekræftet fravær af en af
kilderne skjuler hele sektionen. Fejl skjules ikke som tomme data; genforsøg
starter en ny læsning. Klient-, coach-, atlet-, dato- og genforsøgsskift invaliderer
resultater synkront; forsinkede svar kan ikke erstatte det aktuelle scope.
Atletens eksisterende visning ændres ikke.

`coachRestitution.react.test.mjs` bruger rigtig React/ReactDOM og appens eksisterende
JSX-testadapter; den opdages af `npm test`. Uden pakker er dens fire prøver eksplicit
SKIP. De syntetiske integrationsprøver importerer den faktiske AnalyseTab og
restitutionsmodulerne med de fastlåste elementfixtures; de er supplerende, ikke
ReactDOM- eller visuelt layoutbevis. Dhurva skal køre fuld `npm test` og build ved
fletning; ingen pakker installeres og ingen fuld suite/build køres i worker-kopien.

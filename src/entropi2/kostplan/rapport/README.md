# Kostrapport til coachen

Ren model og React-visning med en betinget kobling under coachens kostplan.
`../coach/PortalPlan.mjs` viser en lukket Kostrapport, når en komplet,
coach-/atlet-/datobundet `nutritionRead` indeholder reel kostlog i rapportugen.
Den nuværende `kostMaalKobling.mjs` sender ikke sådan en kvittering til
planeditoren. Derfor er rapporten fortsat skjult i det aktuelle produktflow;
der er ikke oprettet en ny læsning eller opdigtet planhistorik. Se leverancens
ADAPTER.md for kontrakten og den resterende værtkobling uden for denne zone.
Ingen I/O, klokke, lagring, aktivering eller andre writes. `enabled` skal være
bogstaveligt `true`; ellers returneres `null` før øvrige props læses.

`buildNutritionReport({ enabled, athleteId, date, plans, mealLogs, weightLogs })`
fra `nutritionReport.mjs` dækker mandag–søndag omkring `date`. Datoer er eksplicitte
atletlokale `YYYY-MM-DD`, fra 1900-01-01 til 9999-12-24. Dage efter `date` vises
som kommende og indgår ikke i summer. Ukendt eller fejlet indlæsning må ikke
sendes som tomme lister: alle tre arrays skal være færdighentede.

- `plans`: uforanderlige historiske snapshots fra `../plan.mjs`:
  `schema: 'entropi2-kostplan/v1'`, `id`, `athleteId`, `coachId`, `createdOn`,
  `status`, `dailyTargets: {kcal,protein,carb,fat}`, `activated: {by,on}` og
  `archived: {by,on}` eller null. Kladden tæller aldrig som aktiveret plan.
  Aktivering gælder fra `on` inklusive; arkivering til `on` eksklusive. En plan
  aktiveret og arkiveret samme dag får derfor ingen rapportdage. Snapshotmålet
  skal være det gældende mål for perioden; mutable, aktuelle mål må ikke bruges
  til at rekonstruere historien. Manglende historik vises som manglende plan.
  Overlap giver synlig konflikt og ukendte mål, aldrig vilkårligt valg af plan.
- `mealLogs`: appens måltidsrækker med `id`, `athlete_id`, `date`, `meal`, `kcal`,
  `protein`, `carb`, `fat`. Identiske måltider med forskellige id'er tæller begge;
  gentagne id'er i rapportens logvindue er en kontraktfejl. Bekræftelsesrækker
  `[appData2-day-v1]` tæller ikke som måltider. Næringsværdier er kcal/gram;
  eksisterende parser håndterer komma/punktum. Manglende/ugyldige værdier gør kun
  det pågældende næringsstof ukendt. Defekt id/navn gør hele rækken ukendt.
- `weightLogs`: eksisterende `weightTrend`-kontrakt: `athlete_id`, `logged_at`
  (lokal dag), `weight` (kg), `created_at` (normaliseret ISO-tid). Seneste valide
  måling pr. dato vinder som i den eksisterende model. Min. tre forskellige
  vejedage kræves i hver syvdagesperiode for sammenligning. De to vinduer slutter
  `date` og syv dage tidligere. Ugyldige/fremtidige målinger udelades; manglende
  dage udfyldes ikke. Trend er observation, uden vurdering eller kostforslag.

Anden atlet filtreres fra før beregning. Adapteren skal stadig håndhæve adgang;
filtreringen erstatter ikke autorisation. Ugyldig planhistorik eller manglende
read-arrays giver `TypeError`, som caller skal vise med fejltilstanden.

En dag uden log har `totals: null` pr. næringsstof, aldrig nul. Kendte nuller i
en faktisk log er derimod 0. Ugesummer og procenter sammenligner præcis de
loggede dage med deres mål. Et manglende/overlappende mål på en logget dag gør
ugens sammenligningsmål og procent ukendt for det næringsstof. En ukendt logværdi
gør ugens registrerede total ukendt for det stof. Der vises ingen opdigtet
delvis sum. Ugens antal dage uden log vises separat. En log er ikke bevis for,
at hele dagen er registreret. Procenten begrænses ikke til 100. Summering sker
før visning; kun formatteringen afrunder til én decimal. Numerisk overflow
giver null frem for Infinity.

`reportView.mjs` eksporterer samme visning som `nutritionReportView(h, props)`,
så portalen og React-komponenten deler præcis den samme markup og formattering.
`KostrapportCoach({ enabled, state, report, onRetry })` har `loading`, `error`
og `ready`. Caller beregner `report` med modellen og erstatter hele snapshot ved
atlet-/datoskift. Ingen gamle snapshots må blive stående som `ready` under et
nyt read. Coachen ser ugens fire næringsstoffer, logdækning og vægt ved siden af
hinanden på brede skærme; mobil lægger dem under hinanden. Dage og vejninger
ligger i native `<details>`. Fejl vises som alert; en valgfri retry-knap bruger
callerens callback. Atletvisningen er uændret.

Prøver er almindelige `.test.mjs` og opdages af appens `npm test`. De rigtige
React-prøver importerer `react` og `react-dom/server` direkte uden skip eller
erstatning. `viewFixture`-prøverne bruger en særskilt, eksplicit syntetisk loader
til hermetisk strukturkontrol uden installeret React; de erstatter ikke React-
gaten. Dhurva kører fuld suite og build ved fletning.

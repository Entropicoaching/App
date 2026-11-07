# Kostrapport til coachen

Coachens eksisterende Kost & mål → `PortalPlan` → `ActiveReport` viser de
seneste syv dage uden at åbne editoren. Den bruger værtens færdige, præcist
coach-/atlet-/datobundne kostkvittering og kræver som før mindst én reel kostlog.
`startActiveReport` læser nu `planAdapter.loadDailyReferences({ coachId, isCurrent })`
og bygger `buildDailyPlanNutritionReport`; den bruger ikke `loadActive()` som
historik. Manglende plan eller historiklæsning skjuler ikke kendt registreret kost.
Fejlet/afkortet historik giver ukendte referencer og en genforsøgsknap. Scope-/klient-/
kvitteringsskift og cleanup skjuler straks gamle resultater. OFF er bevaret.

Den nye læsekontrakt er `entropi2-kostplan:daily-reference/v1`: `athleteId`, `date`,
`from`, `through`, `state` (`ready`/`unavailable`), `reason` og præcis syv daterede
`days`. Hver dag har `state` (`approved`/`unknown`/`conflict`), `reason`, `planId`,
`versionId`, `targets: {kcal,protein,carb,fat}`. Kun `approved` har identiteter og
muligt kendte portionssummer. Ukendte næringsstoffer forbliver null; kendt nul
bevares. Ugyldige eller forkert scopede referencer afvises af rapportmodellen.

Læsningen bruger kun de tre eksisterende RLS-scopede `kostplan_v1_*`-tabeller i
den aktuelle coachklient. Den må kun kaldes fra den eksisterende coachkontekst;
et `coachId` er scope, ikke ny autorisation. SQL-kopien giver den nuværende
ansvarlige coach adgang til alle atletens planer, versioner og godkendelser,
inklusive arkiverede planer. Atletens begrænsede RLS-visning er ikke en komplet
coachhistorik. Installeret schema og faktisk adgang er ikke verificeret her.

- Højst fire sekventielle læsninger: planer med `valid_from <= date`, deres
  versioner, deres godkendelser samt genkontrol af planstatus. Ingen pagination,
  baggrundsfanout, cache af historik, ny RPC eller writes. Hver læsning bruger
  `limit(501)` og `count: 'exact'`; 501 rækker, manglende count eller count forskellig
  fra returneret antal giver `unavailable`. En lavere server-sidegrænse kan derfor
  ikke ligne komplet historik. Der accepteres højst 500 rækker pr. tabel.
- Godkendelser har SQL-primary-key **`version_id`**, ikke `id`. Valg følger
  `effective_from`, derefter faktisk `approved_at` med mikrosekunder. Ved identisk
  tidspunkt inden for samme plan er stigende `version_no` stabilt via SQL-værnet.
  Identisk dato/tid på tværs af planer er konflikt; tilfældige UUID'er afgør aldrig
  historisk rækkefølge. Snapshotportioner summeres med den eksisterende model,
  aldrig med det aktuelle katalog eller profilmål.
- En reference kan tidligst bruges på både versionsdatoen og godkendelsens lokale
  kalenderdag i **Europe/Copenhagen**, som også er SQL-kontraktens tidszone.
  Senere godkendte tilbageførte versioner omskriver derfor ikke tidligere dage.
  Fremtidige og ikke-godkendte versioner bidrager ikke. Før første godkendelse
  eller uden læsbar godkendt version er dagsreferencen eksplicit ukendt.
- SQL har status `arkiveret`, men **ingen arkiveringstid eller historisk
  statusledger**. Når den ellers valgte reference er arkiveret, er dens berørte
  dage ukendte. En ældre plan genoplives ikke ved at fjerne den arkiverede.
  En senere entydigt godkendt reference kan igen bruges fra sin gældende dag.
- Identitets-/relationsfejl, dubletter, modstridende metadata, ulæselige snapshots,
  godkendt parent uden synlig godkendelse, ændret parent ved genkontrol samt
  læse-/adgangsfejl giver `unavailable`, aldrig opdigtet tom historik. Annullering
  standser næste læsning og publicerer intet. De separate REST-læsninger er ikke
  en atomisk databasetransaktion; genkontrollen opdager ændrede planstatusser,
  men giver ingen generel serialiserbar snapshotgaranti.

Rapporten viser planportioner, **ikke fysiologisk mål eller behov**. Procenten for
perioden bliver ukendt, hvis en logget dag mangler reference for næringsstoffet.
Kendte registreringer bevares; en ulogget dag bliver aldrig nulindtag. Ukendt
reference eller makro kan ikke erstattes af dagens plan eller profilens mål.
Kompatibilitetsindgangen `buildActivePlanNutritionReport` accepterer stadig en
valideret aktuel plan, men uden eksplicit daglig historik leverer den ukendte
referencer. Den gamle bagudprojektion er fjernet.

Den separate, ældre, rene lifecycle-rapport nedenfor er uændret i sin kontrakt og
bruges ikke som erstatning for SQL-historik. Ingen nye flags, schemafelter,
ordinationer, tærskler eller automatisk aktivering er indført.

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

# Månedsrapport til coachen

Frakoblet, rent læsemodul. Importér `buildMonthReport` fra `monthReportModel.mjs`
eller React-komponenten `CoachMonth` fra `CoachMonth.mjs`. Begge kræver eksplicit
`enabled: true`; OFF læser ikke snapshot. Ingen eksisterende filer ændres.

## Snapshot-kontrakt

`{status: 'ready', complete: true, athleteId, endDate, dailyRows, exerciseLogs,
mealRows, weightRows, sessions}`. Loading bruger `{status: 'loading'}`; alt andet,
herunder delvise/fejlede læsninger, giver fejl. Komponentens valgfrie `onRetry`
kaldes kun ved brugerens tryk. Kaldende lag ejer coach-adgang, samtykker, læsning,
normalisering og sikring af komplet dækning. Modulet er ikke en adgangskontrol.

Alle rækker skal have samme `athlete_id` (= athletes.id, aldrig user_id).
`endDate` er sidste afsluttede danske kalenderdag, YYYY-MM-DD, eksplicit valgt af
kaldende lag. Rapporten dækker [endDate−27, endDate], i fire 7-dages perioder.
Datoer nær år 0000 afvises, så de eksisterende modulers interne vinduer er gyldige.
Hver samling har højst 10.000 rækker; ingen sparse arrays. Tomme arrays betyder
vellykket komplet læsning uden registreringer. Manglende arrays betyder fejl.

- dailyRows: kanonisk athlete_manual-projektion med logged_date, sleep_hours,
  energy (1–5), stress (1–5), soreness (0–10), evt. readiness_score (0–100).
  Legacy soreness_level konverteres aldrig. Datoer skal være entydige.
- exerciseLogs: appens exercise_logs-kontrakt med logged_at, weight i kg,
  reps_completed, exercises.name, evt. exercises.sessions.weeks.block_name,
  skipped, _optimistic. Stabilt id eller exercise_id + heltals-set_number kræves.
  Set-position er en programmeret øvelsesinstans, ikke en katalogøvelse.
  `reference_e1rm` skal være en uafhængigt valgt reference, kendt på sættets dato,
  i kg og for præcis samme variant. Modulet estimerer aldrig denne reference.
  Optimistiske sæt filtreres fra. Identiske kopier tælles én gang; modstridende
  id/position/navn/reference giver fejl. Ugyldige målinger bevarer ukendt volumen.
- mealRows: date, meal, kcal, protein, carb, fat som i nutritionTrend.
  Ingen mål bruges bagudrettet. Et registreret måltid beviser ikke en komplet dag.
- weightRows: logged_at som kalenderdato, weight som i weightTrend.
  Flere rækker samme dato afvises; vægtgennemsnit kræver mindst fire datoer.
- sessions: eksplicit, komplet projektion af pas og deres planstatus for perioden:
  id, day (dansk kalenderdato), planned (boolean), completed (boolean).
  ID skal være unikt. completed må kun være sand efter bekræftet gennemførelse;
  sætlogs eller kalenderplacering er ikke bevis. Ingen databasekontrakt opfindes:
  dette er en adapterprojektion. Ekstra pas har planned=false.
  Optimistiske rækker i alle ikke-sæt-samlinger afvises.

Ingen cyklusfelter eller andre private ekstradata læses eller returneres.
Kaldende lag bør kun levere de nævnte felter. Output er en whitelist.

## Beregning og visning

Genbruger buildAthleteOverview (volumen, kost, vægt, dagsform), buildStrengthTrend,
weeklyDataBasis og weeklyIntensity fra de flettede moduler. Kalenderuge-output
begrænses/opsummeres inden for hvert af rapportens fire præcise vinduer; den
ældste deluge tabes ikke, heller ikke ved en slutdato midt på ugen.

Styrke er bedste e1RM i hvert vindue fra eksisterende hovedløftsregler, Epley
kg × (1 + reps/30); varianter forbliver adskilte. Ingen 12-ugers hældning eller
kalenderugeflag genbruges som et 28-dages signal. Volumen er kg × gennemførte reps.
Intensitetsandele har klassificerede sæt som nævner; ukendte sæt vises særskilt.
Dagsformsfelter og vægt kræver mindst fire kendte dage pr. vindue. Kostgennemsnit
har registrerede kostdage som nævner. Huller udfyldes aldrig med nul.
Kvalitet: gyldige, manglende og ugyldige datoer pr. domæne. Readiness_score er et
særskilt felt og må ikke forveksles med dækningen ved de fire dagsformsfelter.

Tre enkle beskrivende flag: styrkefald >5 % fra højeste af fire vinduer (alle fire
målt), energi ≤2/5 i alle fire vinduer (mindst fire dage i hvert), og <75 %
gennemførte planlagte pas i et vindue. Hvert flag har regel, periode og rå
aggregerede måleværdier; ingen diagnose, anbefalet dosering eller programændring.

Visningen har periode, flag, styrkeserier og pas synligt. Øvrige domæner og
flaggrundlag ligger i native details/summary med mindst 44 px trykflade. Én
kolonne, tekstombrydning og ingen faste bredder. Tom, loading og fejl er adskilt.

## Prøver

`node --test src/entropi2/tracking/maaned/*.test.mjs` eller appens `npm test`.
CoachMonth.test.mjs bruger rigtig React/ReactDOM og springer eksplicit over, hvis
disse pakker mangler i den offentlige kopi. Dette er en udestående merge-gate,
ikke et grønt React-resultat. view.synthetic.test.mjs importerer den faktiske
komponent gennem en snæver testloader; den er kun en strukturel host-elementprøve,
ikke React, browser, accessibility-audit eller visuel layoutverifikation.

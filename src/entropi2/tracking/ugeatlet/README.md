# Ugen i korte træk · Entropi Coach

Ny, ukoblet atletvisning. `AthleteWeek` fra `AthleteWeek.mjs` modtager
`{ enabled, snapshot, onRetry? }`. Kun `enabled === true` aktiverer kortet.
Den rene `buildAthleteWeek(snapshot, { enabled })` fra `athleteWeekModel.mjs`
har samme OFF-kontrakt. Ingen læsning af snapshot i OFF, ingen clock, net,
storage, callbacks ved render, ændringer i input eller skriveadgang.

Snapshot er en allerede autoriseret, normaliseret projektion for én atlet,
ikke en databaseadapter. Denne billet tilføjer ingen indlæsning eller kobling.

```js
{
  status: 'ready', // eller loading/error; payload læses ikke i disse tilstande
  complete: true, // alle kilder fuldt hentet, ingen afkortning/ventende synk
  athleteId: 'synthetic-athlete', // profil-id, ikke login-id
  endDate: '2026-11-07', // sidste AFSLUTTEDE kalenderdag i Europe/Copenhagen
  sessions: [], daily: [], nutritionDays: [],
  strength: null // eller valgt løft nedenfor
}
```

Alle rækker har `athleteId` og `day` som gyldig `YYYY-MM-DD` i atletens
København-kalender. Modellen vælger inklusivt `[endDate - 6 dage, endDate]`.
Det er syv afsluttede dage, ikke nødvendigvis mandag–søndag. Adapteren skal
konvertere timestamps før kaldet; ingen UTC-slicing. Blandede identiteter,
ugyldige datoer, manglende arrays, dubletter og ugyldige målinger i vinduet
giver `error`, aldrig et tilsyneladende tomt resultat. Ældre/fremtidige rækker
udelades efter validering af dato/ejerskab. Højst 10.000 rækker pr. array.

- `sessions`: `{ athleteId, day, id, planned: boolean, completed: boolean }`.
  Én række pr. dateret pasforekomst, stabilt unikt id i perioden. Kun
  autoritativt bekræftet gennemførelse må blive `completed: true`.
  Planlagte og ekstra gennemførte pas vises hver for sig i datagrundlaget.
  Sætlogger bruges aldrig til at gætte gennemførte pas.
- `daily`: `{ athleteId, day, source: 'athlete_manual', sleepHours, energy }`.
  Søvn: tal 0–24 timer; energi: heltal 1–5. Manglende værdier: null/udeladt.
  Én række pr. dato, uafhængig dækning pr. felt. Mindst fire datoer for
  gennemsnit. Dagsform betyder selvrapporteret energi; ingen samlet score.
  Adapteren projekterer readiness-felter; de skrives ikke til trackingtabeller.
- `strength`: `null` eller `{ exerciseId, variantId, label, sets: [...] }`.
  `label` skal navngive løft OG variant, fx `Squat · testvariant`.
  Sæt: `{ athleteId, day, id, exerciseId, variantId, unit: 'kg', kg, reps,
  confirmed: boolean, skipped: boolean, warmup: boolean }`.
  Alle sæt skal høre til det valgte løft og varianten. Ingen rangering på tværs
  af øvelser. Bedste sæt har højest Epley-estimat `kg * (1 + reps/30)` blandt
  bekræftede arbejdssæt med positiv vægt og 1–10 gentagelser. Opvarmning,
  oversprungne/ventende sæt og manglende målinger udelades. Ved lighed:
  højeste vægt, tidligste dato, derefter id. UI viser faktiske kg × reps;
  estimatet og udvælgelsesreglen er foldet. Kg 0–100.000; reps 0–10.000
  heltal valideres, men kun det ovennævnte interval er kvalificeret.
- `nutritionDays`: `{ athleteId, day, complete: boolean, kcal, proteinG,
  kcalTarget, proteinTargetG, targetVersion }`. Én normaliseret række pr. dag,
  kun atletens egne registreringer. `complete: true` kræver bekræftet hel
  kostdag, ikke blot et måltid eller en kvittering. Mål skal være gældende
  netop den dato med dokumenteret målversion; aktuelle mål må ikke kopieres
  bagud. Null/udeladt er ukendt. Energi 0–100.000 kcal; protein 0–10.000 g;
  mål positivt tal inden for samme øvre grænse. Målversion: 1–160 tegn.
  Kun komplette dage med kendt værdi, positivt mål og målversion indgår i
  hver sammenligning. Procent er sum indtag / sum mål på de samme datoer,
  ikke gennemsnit af daglige procenter. Ingen ekstrapolation til manglende
  dage, ingen vurdering af om mere energi/protein er bedre. Ingen minimums-
  dækning for beskrivende kosttal; antal dage vises altid.

Kun de anførte felter læses/projekteres; cyklus og andre metadata må ikke
sendes til kortet. De bruges ikke, selv hvis de fejlagtigt medfølger. Ingen
rå HTML. Labels og målversioner er tekst, som React escaper.

Testfilerne opdages af appens `scripts/test.mjs`. Model- og syntetiske prøver
importerer de faktiske moduler. Den snævre syntheticReactLoader bruges kun
til host-elementtræet og er ikke React/DOM-evidens. `AthleteWeek.react.test.mjs`
bruger rigtig React og react-dom/server uden loader; de fire prøver skal
afvikles uden skip i Dhurvas eksisterende afhængighedsmiljø før fletning.

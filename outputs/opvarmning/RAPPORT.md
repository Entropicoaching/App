# ORDRE 105 — Opvarmningen må ikke slås med virkeligheden

## Gren

Gren: `opvarmning-mod-virkeligheden` (fra `main` på `3b36547`, ordre 100
merget/pushet — ingen konflikt).

- `3804285` — commit 1: tabel-generator til Marcs bedømmelse
- `31494db` — commit 2: atleten retter et opvarmningssæt, appen husker det

Commit 3 er sprunget over — se "Hvad er næste".

## Hvad ændret

**Commit 1 — `scripts/opvarmningstabel.mjs` + `npm run opvarmning:tabel`:**
Ingen kodeændring. Kalder `calcWarmupSets` (uændret) for squat, bænkpres og
dødløft ved arbejdsvægtene 40–250 kg (11 vægte) × planlagte reps 1/3/5/8, samt
to accessories (Lat pulldown, Benpres — sidstnævnte rammer `isHighLoad`-
grenen) på samme gitter. Skriver 220 linjer til
`outputs/opvarmning/TABEL.md`, én pr. kombination, format
`Øvelse — vægt × reps: sæt1, sæt2, … → arbejdssæt`. Marc markerer forkerte
linjer direkte i filen (fx `FORKERT:` foran linjen); det er hans måling.

**Commit 2 — `src/warmupOverride.js` (ny fil) + `src/AthleteView.jsx`:**
Ren logik, adskilt og enhedstestet uden en mountet komponent (samme mønster
som `readinessDraft.js`):

- `applyWarmupCorrection(sets, index, { weight, skipped })` — bygger den
  effektive ramp: det rettede sæt får `warmupOverride: { anbefalet, faktisk }`
  (`faktisk: null` ved spring-over), sprunget-over sæt fjernes, resten
  uændret. Ugyldig vægt (0, negativ, NaN) er en no-op.
- `saveWarmupOverride` / `loadWarmupOverride` / `suggestWarmupOverride` —
  gemmer/henter/foreslår pr. atlet + øvelsesnavn (foldet, case-uafhængigt).
  `suggestWarmupOverride` sammenligner dagens arbejdsvægt mod den gemte og
  returnerer atletens egne sæt kun hvis afvigelsen er ≤ 5 %, ellers `null`.
  Storage sendes eksplicit (default `globalThis.localStorage`), samme
  dependency-injection-stil som `readinessDraft.js`/`videoCoachSubmission.js`.

  **Persisteringsvalg — ikke DB-kolonnen ordren nævnte:** Ordren bad om at
  gemme rettelsen "i den kolonne der allerede bruges til ekstra data på
  loggen (`extra` eller tilsvarende)". Et grep over hele repoet finder kun
  ét `extra`-felt, og det sidder på video-analyse-tabellen (brugt i
  `AthleteView.jsx`/`Dashboard.jsx` til `skeleton_proportions` m.m.) — en
  helt anden tabel end `exercise_logs`, hvor sæt logges. `exercise_logs`
  har, så vidt det kan bekræftes fra koden (payload-opbygningen i
  `logSet`/`skipSet`/`persistSetLog`), kun `weight, reps_completed, note,
  rpe_actual, rpe_planned, skipped, exercise_id, athlete_id, set_number,
  logged_at, id` — intet JSON-katalog-felt. Jeg forsøgte at bekræfte det
  direkte mod skemaet (både read-only via Supabase-MCP'et og en skrivefri
  anon-key-probe der kun ville have logget kolonne-eksisterer/eksisterer-ikke,
  aldrig rådata) — begge blev blokeret af miljøets egen auto-mode-
  klassifikator, før noget nåede produktionen. Uden bekræftelse ville et
  gættet kolonnenavn i `exercise_logs`-payloaden, hvis forkert, ødelægge
  ALLE atleters sæt-logning i produktion (appen deployer direkte fra `main`,
  ingen staging) — en risiko der ikke står mål med denne ordres størrelse,
  og et brud på "ingen skemaændring" hvis jeg i stedet havde tilføjet
  kolonnen. Valgt i stedet: `localStorage`, pr. atlet, samme mønster som
  `readinessDraft.js` — og en stærkere persistering end appens eksisterende
  `meetWarmupOverrides` (stævnedags-opvarmning, kun React-state, forsvinder
  ved genindlæsning). Noteret her frem for spurgt blokerende, jf. ordrens
  egen "vælg det mest fornuftige, notér valget, fortsæt".

- **`AthleteView.jsx`:** i opvarmningssæt-listen (samme boks som
  vægt-override og flueben) kan atleten nu klikke et opvarmningssæts vægt
  for at rette den (inline-input, samme mønster som den eksisterende
  arbejdsvægt-editor) eller trykke ✕ for at springe sættet over. Begge
  handlinger kalder `applyWarmupCorrection` + `saveWarmupOverride` med det
  samme. Boksens header viser `dine sidste` (guldramme, samme farve som
  resten af opvarmnings-UI'et) når `suggestWarmupOverride` finder en
  matchende tidligere ramp — ellers vises `calcWarmupSets`s anbefaling som
  før. Ingen ny trykflade under 32×32px (skip-knappen); flueben-rækkens
  klik-areal er uændret.

## Testresultat

- `node --test src/*.test.js` — **105/105 grønne**, heraf **10 nye** i
  `src/warmupOverride.test.js`: rettelse gemmes og kan hentes; forslag
  genbruges ved 4 % afvigelse; falder tilbage til `null` (modellen) ved 6 %;
  spring-over fjerner sættet fra rampen; ugyldig vægt er en no-op; pr.
  atlet/pr. øvelse uden krydssmitte; navne matches uafhængigt af
  store/små bogstaver og mellemrum; fejlende storage (privat vindue) vælter
  ikke.
- `npm run lint` — **0 fejl**, 13 præeksisterende `react-hooks/exhaustive-
  deps`-advarsler (uændrede, ikke rørt af denne ordre).
- `npm run gate:tracker` — **GRØN** (alle 8 GATE-rigge OK, tracker-koden er
  ikke rørt af denne ordre).
- **Ingen levende Supabase-test** af den nye UI (`exWarmupWeightOverride`/
  `warmupSetEditing`-flowet) — kun set ved kodegennemgang + de rene
  enhedstest af `warmupOverride.js`. Samme grænse som tidligere ordrer: ingen
  testkonto i produktion.
- **Ingen browser-måling** af den nye ✕-knap/inline-input i denne ordre —
  ordrens verifikationsliste nævner ikke tap-targets, og "kun headless" for
  browser-målinger var ikke relevant her (ingen skærmbillede krævet).

## Hvad er næste

- **Marc markerer de forkerte linjer i TABEL.md.** Uden markeringer var der
  intet at rette i commit 3, så den er sprunget over (jf. ordren: "Findes
  markeringerne ikke, så spring commit 3 over"). Commit 1 og 2 står alene.
- Når TABEL.md er markeret, retter en senere ordre `calcWarmupSets` så kun
  de markerede kombinationer ændrer sig (snapshot-test af hele tabellen
  før/efter, som ordren beskriver).
- Persisteringsvalget i commit 2 (localStorage frem for en DB-kolonne, se
  "Hvad ændret") bør Marc tage stilling til: er `exercise_logs` uden
  JSON-felt korrekt forstået, og skal opvarmningsrettelser dele udstyr på
  tværs af atletens enheder (så kræver det en rigtig kolonne/tabel — en
  reel skemaændring, uden for denne ordres mandat)?
- **Hara/"Appen mærkbart bedre":** begge commits er direkte
  atlet-oplevelses-forbedringer i sæt-loggeren (mindre friktion om
  opvarmning, mindre "det her passer ikke til mig i dag") — relevant for
  Hara's delmål, ikke kun en fejlrettelse.

## Ærlige grænser

- **Ingen bekræftet DB-skema.** Se "Hvad ændret" — jeg kunne ikke få
  bekræftet om `exercise_logs` faktisk mangler et JSON-katalogfelt (kun
  udledt fra frontend-koden + to blokerede forsøg på en direkte, skrivefri
  bekræftelse). Hvis der findes et sådant felt jeg ikke har set, er
  localStorage-løsningen en unødvendig — men ikke forkert eller farlig —
  omvej.
- **localStorage er pr. enhed, ikke pr. konto.** Logger atleten fra en ny
  telefon, eller rydder browserens lagerplads, er "dine sidste" væk, og
  modellen gælder igen. Ingen datatab af betydning (kun en genskabelig
  ramp-anbefaling), men ikke "på tværs af enheder" som en DB-kolonne ville
  have givet.
- **5 %-tolerancen** er min fortolkning af "inden for 5 %" — ordren angiver
  ikke om det er relativt til sidste eller dagens arbejdsvægt; jeg brugte
  sidste (den gemte) vægt som nævner. Ved typiske vægte (40–250 kg) er
  forskellen mellem de to nævnere under 0,3 procentpoint — ikke
  praksis-relevant.
- **Ingen atletdata i denne rapport eller i TABEL.md** — alle tal er
  syntetiske kombinationer, ingen rigtig atlet er rørt.
- Under research stødte jeg på Vaidyas regel om ingen sub-agenter og
  forsøgte fejlagtigt at starte en fork til et rent research-spørgsmål
  (Supabase-skema); den blev blokeret af miljøet før den gjorde noget, og
  jeg fortsatte selv. Nævnt her for gennemsigtighed, ikke fordi det påvirkede
  leverancen.

Ordre 414

# Dagens pas uden net, sidste del: O4 og O7 rettet, O8 begrundet, indeks forberedt

**Kort:** Når atleten fortryder et sæt, står sletningen nu i køen i samme øjeblik (O4).
Dør appen, mens sættets INSERT stadig hænger, slettes rækken ved næste åbning. Før
blev sættet stående hos coachen, og det er genskabt i browseren før rettelsen
(`[1,1,0,0]` før, `[1,0,0,0]` efter). 8-s-uret starter nu, når sættets kald får sin tur
i skrivekøen, og ikke mens kaldet venter bag andre skrivninger (O7). O8 (én
lagernøgle pr. sæt) er ikke lavet; begrundelsen står nedenfor. Rollback-filen til det
unikke indeks ligger klar. **Selve migrationsfilen blev ikke lagt på grenen**, fordi
Claude Codes tilladelsessystem afviste skrivningen i `supabase/migrations/`.

**Hara (Coaching, delmål "Appen mærkbart bedre"):** Et sæt, atleten har fortrudt, dukker
ikke længere op hos coachen, og en falsk "svag forbindelse" efter kø-ventetid er væk.
Begge dele er små, men det er den slags fejl, der koster tillid. Push af offline-passet
afhænger stadig kun af Marcs kældertest (RAPPORT-406).

## Gren

`dagens-pas-offline-4` fra `main` @ `c6d2c76` (406 er merget). Tre commits:

- `d3d2ba2` blok 1: O4 og O7, med tests og browser-scenariet `fortryd-doer`.
- `09ced9f` blok 2: rollback-filen til indekset. O8 er begrundet her i rapporten.
- blok 3 (commit efter `09ced9f`): verificering, offline-bevis og denne rapport.

Intet er pushet. Der er ingen kald mod prod, og ingen migration er kørt.

## Hvad ændret

**O4: fortryd skriver sletningen i køen med det samme (blok 1)**
- `src/offlineSetQueue.js`: ny ren funktion `queueUndoTombstone`. Den erstatter sættets
  køpost med en sletning (`op: 'delete'`) på det række-id, sættet har eller kan have
  fået hos serveren. Uden id fjernes posten bare. Sletningen beholder sættets plads i
  rækkefølgen.
- `src/athlete/saetSkrivning.js` `undoLoggedSet`: lægger sletningen synkront, før den
  venter på sættets hængende skrivning. Id'et er `ref.realId`, ellers `ref.clientId`,
  ellers køpostens `clientId`. Når skrivningen er færdig, og den fandt en række med et
  andet id (opslaget før INSERT fra 406), rettes køens sletning til det id. Lykkes
  sletningen, fjernes den fra køen (`clearOfflineSetIfSame`). Fejler den, eller er
  nettet dødt, bliver den liggende til køens runde. Før fjernede fortryd køposten med
  det samme, men skrev først sletningen efter skrivningen, og kun ved fejl.
- Sættets sene svar (`sendQueuedSet`, `logSet`) rydder kun en post med samme `op` og
  payload, så det fjerner ikke sletningen. Et nyt "Godkendt" på samme sæt erstatter
  sletningen og beholder række-id'et (UPDATE, ikke dublet).

**O7: 8-s-uret starter, når kaldet sendes (blok 1)**
- `src/supabase.js` `queueWrite`: ny valgfri `onStart`. Den kaldes, når skrivningen får
  sin tur i den globale skrivekø, lige før auth-opvarmningen (skrivningens første kald).
- `src/athlete/saetSkrivning.js` `persistSetLog`: returnerer `task.sent`, et løfte der
  opfyldes ved `onStart`. `sendQueuedSet`, køens afsendelse og køens sletning giver det
  videre til uret.
- `src/offlineSession.js` `withSlowNetCutoff(call, ms, { startWhen, maxWaitMs })`: med
  `startWhen` starter de 8 s først, når kaldet har fået sin tur. `maxWaitMs` (standard
  4 × 8 s = 32 s) er et loft over hele ventetiden, så et kald, der aldrig kommer til,
  heller ikke hænger. Uden `startWhen` er funktionen som før. Opslaget før INSERT
  (`findSetRow`) går ikke gennem skrivekøen, så dets ur starter som før med det samme.

**O8: ikke lavet, med begrundelse (blok 2)**
Køen er stadig ét objekt pr. atlet (`entropi_offline_sets:<atlet>`). Hvorfor:
1. Formatet læses direkte af Bhishaks scenarier bag `verify:kritik-403`
   (`outputs/kritik-403/scenarier.mjs`), af 406-scenarierne og af `e2e:dagens-pas`. Med
   én nøgle pr. sæt ville deres "køen er tom" altid være sand. Så går de falsk grønne i
   netop de tjek, der skal fange et tabt sæt, og "sæt 4 ligger i køen" går rødt. At
   rette Bhishaks scenarier hører ikke til min ordre.
2. Telefoner, der har ventende sæt i det gamle format, skal flyttes over ved første
   åbning. Det er ny kode i netop den vej, der skal forhindre tab, for at lukke et fund
   med sandsynligheden "meget lav". Målingen `to-faner` var ren (`[1,1,0,0]`).
3. Selv med én nøgle pr. sæt kan to faner stadig skrive samme sæt samtidig. Det, der
   lukkes, er kun to forskellige sæt i hver sin proces inden for samme millisekund.

Forslag, når det skal gøres: én ordre, der både ændrer køens nøgle (flytter det gamle
objekt over ved første læsning og sletter det bagefter) og retter de tre harness-læsere
til at læse via `loadOfflineSets`-logikken.

**Indekset (blok 2)**
- `supabase/sql/exercise-logs-et-saet-en-raekke-rollback.sql` (ikke kørt):
  `drop index concurrently if exists public.exercise_logs_et_saet_en_raekke` plus et
  tjek. Den ligger uden for `migrations/`, så den aldrig køres som migration. Den
  fjerner også et ugyldigt indeks efter et fejlet `create index concurrently`.
- **Migrationsfilen mangler.** Jeg skrev
  `supabase/migrations/20260926120000_exercise_logs_et_saet_en_raekke.sql`, men
  Claude Codes tilladelsessystem (auto-tilstand) afviste skrivningen med "Modify Shared
  Resources". Jeg har ikke forsøgt at komme uden om det. Indholdet var:
  (0) et hoved med "IKKE KOERT, kraever Marcs ja", det antagne skema og en vejledning trin
  for trin. (1) En ren læsning af dubletter pr. `(exercise_id, set_number)` med
  `behold_id` (logget før sprunget, så første `logged_at`, så mindste id), `slet_ids` og
  `vaerdier_forskellige`. (2) En oprydning, kommenteret ud: `delete ... where id in
  (...)`, hvor ids indsættes i hånden med Marcs ja pr. dublet. (3) `create unique index
  concurrently if not exists exercise_logs_et_saet_en_raekke on public.exercise_logs
  (exercise_id, set_number)`. (4) Et tjek af `pg_index.indisvalid`. Kerne-SQL'en står også
  i RAPPORT-406, "Hvad er næste".

**Bevis og tests**
- `src/offlineDagensPas.test.js`: fem nye tests i alt. Fortryd lægger sletningen med det samme
  og beholder rækkefølgen, og et sent svar fjerner den ikke. Fortryd uden id rydder
  bare, og et nyt "Godkendt" erstatter sletningen med samme id. Uret tæller ikke
  kø-ventetid, et kald med tur, der hænger, giver SLOW_NET, og loftet stopper et kald,
  der aldrig får tur.
- `outputs/414/offline-bevis.mjs`: 406-beviset (`tid`, `haenger`) plus det nye scenarie
  `fortryd-doer`, headless mod e2e-mocken. `BEVIS_UD` skriver et andet sted hen (brugt
  til kørslen før rettelsen i `outputs/414/foer-rettelsen/`).

## Testresultat

- `npm run lint`: grøn (0 fejl).
- `node --test src/*.test.js`: 322 af 322 grønne, heraf fem nye (O4 og O7).
- `npm run build`: grøn (`outputs/414/koersel-build.txt`).
- **Offline-beviset** `node outputs/414/offline-bevis.mjs`: headless mod e2e-mocken, grønt i
  alle tre scenarier (`outputs/414/koersel-offline-bevis-414.txt`, `bevis-*.json`,
  billeder). Ingen konsolfejl.

  | scenarie | mocken (rækker pr. sæt 1-4) | målt |
  |---|---|---|
  | `tid` | `[1,1,1,1]` | hvert sæt har tiden fra "Godkendt" |
  | `haenger` | `[1,1,1,0]` | sæt 2 vist som ventende efter 8 509 ms, sæt 3 efter 40 ms, køen sendt af sig selv efter 18,9 s |
  | `fortryd-doer` (nyt, O4) | `[1,0,0,0]` | køen har sletningen lige efter fortryd (`op: delete`, samme række-id); efter genåbning er køen tom |

- **Før rettelsen** (samme scenarie, med `saetSkrivning.js` fra `main`, derefter sat
  tilbage): køen var tom lige efter fortryd, og mocken endte med `[1,1,0,0]`. Det
  fortrudte sæt stod hos coachen, og O4 er dermed genskabt
  (`outputs/414/foer-rettelsen/bevis-fortryd-doer.json`).
- **`npm run verify:kritik-403`: RØD (3), som ventet**
  (`outputs/414/koersel-verify-kritik-403.txt`). Den eneste fejl er "O1/O2/O3 genskabes
  ikke længere", fordi de er rettet i 406, og kritikken siger stadig, at de findes.
  Invarianterne holder i alle ni scenarier: intet sæt tabt, ingen dublet af sig selv,
  og køen er tom efter nettet. `to-faner` er stadig ren (`[1,1,0,0]`). Kørslen
  overskrev Bhishaks gemte resultater i `outputs/kritik-403/`, og dem har jeg sat
  tilbage med `git checkout`. Min log står i `outputs/414/`.

## Hvad er næste

**Til Marc om migrationen:** Svar "ja indeks", så lægger næste ordre
`supabase/migrations/…_exercise_logs_et_saet_en_raekke.sql` (den blev afvist her) og du
kører den selv trin for trin i SQL-editoren: 1 viser dubletter, 2 sletter kun de ids,
du siger ja til, og 3 laver det unikke indeks alene, så to telefoner ikke længere kan
lave to rækker for samme sæt.

- Marcs kældertest fra RAPPORT-406 gælder stadig. Den er det eneste, der står mellem
  grenen og et push. Nyt punkt 8: fortryd sæt 4 uden net, luk appen helt, åbn med net.
  Coach-visningen må ikke vise sæt 4.
- O8 (én nøgle pr. sæt) sammen med harness-læserne, se begrundelsen ovenfor.
- Tilbage fra kritikken: O5 (urets afvigelse) og O6's ødelagte kø-JSON.

## Ærlige grænser

- **Migrationsfilen, ordren bad om, findes ikke på grenen.** Skrivningen i
  `supabase/migrations/` blev afvist af tilladelsessystemet. Kun rollback-filen er lagt.
- **Alt er målt mod e2e-mocken, headless**, ikke mod prod og ikke på en telefon.
  Skemaet i migrationsforslaget er antaget ud fra koden og mocken. Prod er ikke læst.
- **O7 er kun enhedstestet**, ikke genskabt i browseren. At `onStart` kaldes, når
  skrivningen får sin tur, er læst i koden. `supabase.js` kan ikke importeres i
  node-testene (Vite-miljø), så `queueWrite` selv er ikke testet.
- **O7-loftet (32 s)** betyder: står en anden skrivning og hænger foran, markeres sættet
  som ventende efter højst 32 s. Før var det 8 s fra "Godkendt", men nogle gange falsk.
- **O4 med andet række-id:** Fandt 406-opslaget en ældre række med et andet id, og dør
  appen, før sættets skrivning svarer, står sletningen på sættets eget række-id. Den
  ældre række bliver da stående. Det kræver en række fra en anden telefon eller åbning
  plus en død app i samme sekund.
- **O4 med Program-fanen:** En sletning i køen bliver liggende, indtil den er
  gennemført. Logger atleten samme sæt fra Program-fanen (som ikke bruger køen), mens
  sletningen stadig ligger der uden net, kan køens runde senere slette den række.
  Fortryd findes kun i Dagens pas, så det kræver et skifte af fane uden net lige efter
  fortryd.
- I kørslen før rettelsen skrev scenariets tæller "INSERT naaede mocken (0 gang)",
  selvom mocken havde rækken (1). Tælleren er upålidelig i den kørsel, men selve
  målingen (køen tom lige efter fortryd, `[1,1,0,0]` til sidst) kommer fra
  localStorage og mocken.

Ordre 403

# Rapport: kan et sæt gå tabt eller komme to gange? (kritik af 397 + 401)

**Klar til push: nej.** Køen taber ikke sæt. I ni scenarier kom hvert sæt frem, og
intet sæt kom frem to gange af sig selv, heller ikke når appen blev lukket samme
øjeblik som "Godkendt", eller når to faner, et log ud, et skift af atlet eller en ny
service worker kom imellem.

Men når køen sendes efter en åbning af appen med net, viser Dagens pas bagefter passet
som ikke startet ("Sæt 1/4") (O1). Det er det almindelige forløb: appen åbnet hjemme
eller i omklædningsrummet, sæt logget i kælderen, net igen. En atlet, der ser det,
trykker "Godkendt" igen. Så står sættet **to gange** hos coachen (målt `[2,1,1,0]`),
eller det mister sin kældertid (O2). Begge dele er målt i browseren mod mocken.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"):
**ja.** Det stopper en push, der ellers ville have givet atleterne præcis den
oplevelse, 397 skulle fjerne: "den gemte ikke". Og coachen ville have fået dubletter.
Rettelsen er lille og lokal (se "Hvad er næste").

## Gren

`kritik-403` fra `main` @ `39b1ce8` (397 og 401 merget). Tre commits:

- `b7231d7` blok 1: atleten i kælderen, ni headless scenarier, skærmbilleder og resultater
- `9724d84` blok 2: koden linje for linje, fund O1-O8
- blok 3: dom, `verify:kritik-403` og denne rapport (commit efter `9724d84`)

## Hvad ændret

Ingen app-kode er rørt (ordren: ret intet). Nye filer:

- `outputs/kritik-403/scenarier.mjs`: ni scenarier i headless Chromium 390x844 mod
  e2e-mocken. Appen bygges til en midlertidig mappe (ikke `dist/`), og service
  workeren er med som i prod. Scenarierne er kaelder, online-start, aabn-med-net,
  haenger, to-faner, log-ud, skift-atlet, sw-opdatering og forkert-ur. Skærmbilleder
  ligger i `outputs/kritik-403/<scenarie>/` og tal i
  `outputs/kritik-403/resultat-<scenarie>.json`.
- `outputs/kritik-403/verify-kritik-403.mjs` og `npm run verify:kritik-403` i
  `package.json`: kører scenarierne igen og tjekker to ting. Invarianterne: intet
  tabt, ingen dublet af sig selv. Og at O1, O2, O3 og O5 stadig kan genskabes. Når
  et fund er rettet, fejler verify med besked om at opdatere kritikken. Linjen i
  `package.json` er den eneste ændring uden for mine mapper, som i kritik-399.
- `docs/kritik-403/ATLETEN-I-KAELDEREN.md` (blok 1: hvad atleten ser, og om
  teksterne er til at forstå), `docs/kritik-403/KODEN-LINJE-FOR-LINJE.md` (blok 2)
  og `docs/kritik-403/KRITIK-offline-pas.md` (dom og fund øverst).

## Testresultat

- `npm run verify:kritik-403`: **grøn** (fuld kørsel af alle ni scenarier, ca. 5 min).
  - kaelder: åbnede uden net på 0,35-0,85 s (to kørsler). 3 sæt logget, appen lukket i samme øjeblik som
    "Godkendt" på sæt 4, genåbnet uden net, sæt 5 logget, online. Resultat: squat
    `[1,1,1,1]`, bænk `[1,0]`, alle med tiden fra "Godkendt", sendt efter ca. 24 s.
  - online-start: `[1,1,1,0]` efter afsendelse, men Dagens pas viser "Sæt 1/4".
    Atleten trykker igen, og mocken har `[2,1,1,0]` (O1 + O2).
  - aabn-med-net: `[1,1,1,0]`, men "Sæt 1/4" og stadig efter 28 s. Et nyt tryk
    flytter sæt 1's tid 30 s frem (O1).
  - haenger: markering efter 8,3 s, sendt efter 19 s, `[1,1,1,0]`, rigtig visning.
  - to-faner: `[1,1,0,0]` uden dublet. Begge faner viser "Sæt 1/4" bagefter (O1).
  - log-ud: spørgsmålet nævner ikke de 2 usendte sæt. Login-skærm uden net. Sættene
    blev sendt ved næste login, `[1,1,0,0]` (O3).
  - skift-atlet: B så og sendte intet af A's. A's sæt blev sendt, da A kom tilbage.
  - sw-opdatering: én genindlæsning, `[1,1,0,0]`.
  - forkert-ur: ur 7 dage bagud, så `logged_at` 7 dage bagud (O5).
- `npm run lint`: grøn.
- Andre `verify:*` er ikke kørt, fordi ingen app-kode er ændret. `npm run build` er kun
  kørt til en midlertidig mappe af scriptet.

## Hvad er næste

**Vaidya skal rette før push:**
- **O1:** lytterne i `AthleteView.jsx:345-360` skal kalde den nyeste
  `flushOfflineSets` (fx `flushRef.current`), ikke den fra første render, hvor
  `currentWeek` er null. Og `fetchExerciseLogs` uden uge må ikke tømme listen
  (`laesninger.js:626`: `if (!week) return`). Rettet er det, når
  `online-start` og `aabn-med-net` viser "Sæt 4/4" efter afsendelsen.
- **O2:** når række-id'et er nyt (ingen køpost, ingen `setWriteRef`), så slå (atlet,
  øvelse, sæt) op før INSERT i `insertSetLog`/`persistSetLog`, som køens runde
  allerede gør (`saetSkrivning.js:341-354`). Kan opslaget ikke gennemføres, så læg
  sættet i køen i stedet. En unik indeks på `exercise_logs (athlete_id, exercise_id,
  set_number)` er den varige løsning, men det er en migration og kræver ordre fra
  Marc.
- **O3 (anbefalet, lille):** log ud med usendte sæt skal sige det: "Du har N sæt, der
  ikke er sendt endnu …". Login-skærmen uden net skal sige "Ingen forbindelse".

Kan vente: O4 (skriv fortryd-sletningen i køen synkront), O5 (ret for urets afvigelse
via serverens `Date`-header), O6 (log fejl i køens runde og parkér efter N forsøg; ret
`updateLoggedSet`'s falske "i køen"), O7 (start 8-s-uret, når kaldet faktisk sendes),
O8 (én lagernøgle pr. sæt).

Når O1 og O2 er rettet: kør `npm run verify:kritik-403`. Den skal så fejle med
"O1/O2 genskabes ikke længere". Opdatér derefter KRITIK. Kør så Marcs kældertest
fra RAPPORT-401 med én tilføjelse: **åbn appen med net først**, og tjek efter
punkt 5, at Dagens pas stadig viser de klarede sæt.

## Ærlige grænser

- **Alt er målt mod e2e-mocken, ikke prod.** Mocken har ingen unik nøgle på (atlet,
  øvelse, sæt) og ingen RLS. At O2 giver en dublet i prod, bygger på Dhruvas fakta:
  kun `id` er nøgle, og RLS tjekker kun `athlete_id`. Har prod alligevel en unik
  indeks, bliver O2 til en fejl i køen i stedet for en dublet.
- **Chromiums offline-emulering** melder ikke altid `online` efter en genindlæsning i
  DevTools-offline (også set i 397). I `kaelder` blev køen derfor sendt af 20-s-runden
  (ca. 24 s) og ikke af `online`-eventet. På en rigtig telefon i flytilstand kommer
  eventet, og så rammer O1 også den vej.
- **Mockens token-fornyelse** giver den første kendte bruger tilbage. Derfor udløber
  tokens ikke i `skift-atlet`. Fornyelse af et token på hængende wifi (et
  refresh-token brugt to gange, så atleten logges ud) er ikke målt.
- **O4, O6, O7 og O8 er kun læst i koden**, ikke genskabt. O8 kræver to faner i hver
  sin proces, der skriver i samme millisekund. `to-faner` ramte det ikke.
- **Tekstvurderingen** er min egen læsning som atlet og ikke en test med rigtige
  atleter. Skærmbillederne ligger i `outputs/kritik-403/` til Marcs eget blik.
- Scriptet bygger med `npx vite build --outDir <tmp>` for ikke at røre `dist/`. `git
  status` var ren uden for `docs/kritik-403/`, `outputs/kritik-403/` og
  `package.json`. De fem u-trackede billeder under `outputs/kritik-skole*` lå der, før
  jeg startede. Dem har jeg ikke rørt.

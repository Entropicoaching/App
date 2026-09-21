# Rapport — ordre 285: mandagsrunden holder også med tredive atleter (tre blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `mandagsrunden`, forgrenet fra `afvigelsen-oeverst` (`e62605a`) — 281 var
ikke merget ind i `main` da arbejdet startede (`main` stod på `42e3502`),
som ordren selv anviste for det tilfælde. Tre kodecommits + denne rapport
som fjerde. Arbejdstræet er rent. Ingen migration, ingen ny afhængighed,
ingen push. `src/AthleteView.jsx` er ikke rørt.

## Hvad ændret

**Blok 1** (`bd9f1a5`): Målte 281's afvigelsesliste med 30 atleter (10
skredet, 10 på sporet, 10 ingen plan), headless mod `vite`-dev,
telefon-profil (390×844, 4× CPU-nedsat) — `scripts/maal-mandagsrunden.mjs`,
fuldt facit i `docs/MAAL-285.md`. Fandt reelt dobbeltarbejde: `Dashboard.jsx`
regnede `currentWeekNo`/`athleteWeeks.find()` to gange pr. atlet pr. render
(sorteringens forbiberegning og selve rækkens `programLine`, hver for sig).
Rettet uden datamodel-ændring: regnes nu én gang pr. atlet, gemt i en ny
`currentWeekByAthleteId`-opslagstabel og genbrugt i rækkevisningen. Ingen
målbar hastighedsforskel ved 30 atleter — flaskehalsen er 42 batch-API-kald
plus `vite`-devs ubundlede moduler, ikke JS-beregningen — men rettelsen
fjerner ægte duplikeret logik, samme princip som `afvigelseByAthleteId`
allerede satte for selve afvigelsen.

**Blok 2** (`7bacd21`): `scripts/verify-mandagsrunden-tilstande.mjs`, seks
scenarier mod den ægte, ubyggede app: ingen atleter, én atlet, atleter uden
plan, en atlet der ikke har logget i tre uger, et meget langt navn, og en
uge hvor ingen har logget noget. Alle seks allerede korrekt håndteret af
277/281's batch-forespørgsler og rene beregning — ingen fejl fundet, kun
bevist. Wired ind i `npm run proever` via `package.json` (scriptet selv
læser `verify:*`, ingen ændring af `proever.mjs` nødvendig for dette blok).

**Blok 3** (`e203f01`): `e2e/coach-mandagsrunden.spec.mjs` — coachen
sorterer 20 atleter efter afvigelse (kræver reel rulning ved 390×844), går
ind på de tre øverste én ad gangen fra hver sin rulleposition (40px, 160px,
90px) og tilbage. Fandt en reel fejl undervejs: `window.scrollY` blev
nulstillet af browseren ved "← Tilbage til atleter", fordi profilvisningen
ofte er kortere end den rullede liste. Rettet i `Dashboard.jsx`: rullepositionen
gemmes i en ref ved `openProfile`, gendannes i en `useEffect` når `view`
bliver `'list'` igen. Prøven venter på det faktiske udfald — uændret
DOM-rækkefølge og identisk `scrollY` før/efter, ikke antaget. Wired ind som
niende e2e-række i `scripts/proever.mjs` og som `npm run
e2e:coach-mandagsrunden`.

## Testresultat

- **`npm run lint`:** rent.
- **`npm run e2e:coach-mandagsrunden`, kørt enkeltvis:** GRØN — "sorterer
  20 atleter efter afvigelse, går ind på de tre øverste én ad gangen og
  tilbage, sorteringen og rullepositionen holder hele vejen."
- **`npm run proever`, én samlet, ubrudt kørsel:** 72/74 grønne, 2 fejl, 0
  sprunget over. Alle 27 enhedstests og alle 34 `verify:*`-scripts grønne
  (inklusive blok 2's egen `verify:mandagsrunden-tilstande`, 12,8s). Alle
  ni e2e-rækker grønne undtagen to: `athlete-film-et-saet.mjs` og
  `atlet-uge.spec.mjs`. Blok 3's egen `coach-mandagsrunden.spec.mjs` GRØN
  (3,7s).
- **De to fejl, undersøgt — ingen af dem denne ordres kode:**
  `athlete-film-et-saet.mjs` fejlede kun i den fælles kørsel med tomt
  output; kørt igen alene lige efter: GRØN første forsøg — samme
  maskinbelastnings-flakiness RAPPORT-281 allerede navngav (delt, travl
  maskine, ikke koden). `atlet-uge.spec.mjs` fejlede med "Gem skulle
  oprette præcis én ny video_analyses-række, 0 !== 1" — ord for ord samme
  kendte, allerede navngivne fejl fra RAPPORT-269 og RAPPORT-281, ikke
  rørt her (rører ikke denne ordres filer).

**Én linje pr. blok:** Blok 1 klaret — dobbeltarbejdet var reelt men
usynligt ved 30 atleter; rettet alligevel. Blok 2 klaret — seks
"ikke-pæne" tilstande bevist rigtige, ingen fejl fundet. Blok 3 klaret —
en reel rulleposition-fejl fundet og rettet, prøven grøn.

## Hvad er næste

1. Samme ikke-løste, navngivne miljøproblem som 269/281:
   `atlet-uge.spec.mjs`s video-gem-fejl på `main`, uden for denne ordres
   filer. Rammer enhver ordre der kører `npm run proever` fuldt.
2. 869ms til første visning af atletlisten (blok 1's måling ved 30 atleter)
   er domineret af 42 uafhængige batch-API-kald, ikke JS-beregning — en
   rigtig reduktion kræver at slå flere af Dashboardets forespørgsler
   sammen til færre rundture, en større ændring end denne ordres "mindst
   mulige ting".
3. For Hara (Coaching-planeten, delmål "Appen mærkbart bedre for
   atleterne"): mandagsrunden — 281's sorterede liste — holder nu bevist
   med tredive atleter: ingen dobbeltarbejde tilbage i renderen, alle seks
   "ikke-pæne" tilstande viser noget brugbart i stedet for at ligne en
   fejl, og rullepositionen forsvinder ikke længere når coachen går ind på
   en atlet og tilbage — det sidste var en reel bug, ikke kun en måling.

**Tre linjer til Marc:** Mandagsrunden (klik dig gennem listen, atlet for
atlet) tager stadig omkring 870ms til den er synlig og hakker ikke ved
rulning, uanset om du har 3 eller 30 atleter — det du oplevede før er ikke
blevet langsommere, og den lille dobbeltberegning der lå i koden er fjernet
under motorhjelmen. Det der stod i vejen, og som nu er væk: hvis du rullede
ned i listen, klikkede ind på en atlet og gik tilbage, hoppede listen op
til toppen igen — den ruller nu tilbage til nøjagtig der du var. Ingen af
listens seks "tomme" eller "underlige" tilstande (ingen atleter, én atlet,
ingen plan, tre ugers stilhed, meget langt navn, en helt stille uge)
ligner længere en fejl.

## Ærlige grænser

- Blok 1's måling er lokal `vite`-dev mod en mock, telefon-CPU-nedsat —
  ikke mod produktion eller ægte Supabase-latens (samme grænse som
  `docs/KAEDEN-281.md` selv satte for bundtvægten).
- Rettelsen i blok 1 er bevist renlighed (fjerner ægte duplikeret arbejde),
  ikke bevist hastighed ved denne skala — se `docs/MAAL-285.md`s egen
  "Ærligt"-sektion for hvorfor forskellen ikke er målbar.
- `athlete-film-et-saet.mjs`s fejl i den fælles `proever`-kørsel er ikke
  dybere undersøgt end at bekræfte den er flaky (grøn ved gentagelse), ikke
  en reproducerbar fejl.
- `atlet-uge.spec.mjs`s fejl er hverken rettet her eller undersøgt dybere
  end at bekræfte teksten matcher den allerede navngivne, kendte fejl.
- Ikke afprøvet mod produktion — kun mod den lokale mock/e2e og `npm run
  dev`.

## Aflevering

`node C:\Users\Entropi\Documents\Codex\2026-08-15\entropi-digital-assistent\work\entropi-personligt-dashboard\skills\hara\hoest.mjs docs\RAPPORT-285.md --fra-ordre C:\Users\Entropi\Desktop\ordrer\ORDRE-Bhishak.md --aflever --navn Bhishak

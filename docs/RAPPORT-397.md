# Rapport: ordre 397, Dagens pas virker i kælderen

Atleten kan nu åbne appen uden net, se Dagens pas og logge sæt. Hvert sæt
sendes præcis én gang, når nettet kommer igen. Det gælder også, når
telefonen har lukket appen i baggrunden, når login-tokenet er udløbet, og
når svaret på en skrivning går tabt undervejs. Online ser appen ud som før:
11/11 atletskærme er pixel-identiske med `main`.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
bedre"): **ja.** Det rammer lige præcis den fejl, der fik en Adaptiv-tester
til at stoppe ("den gemte ikke"), og det sker i atleternes almindelige uge i
centret. Før: uden net ved åbning var skærmen hvid eller viste login, og et
sæt kunne blive gemt to gange, hvis et svar gik tabt. Nu: Dagens pas står der
på ca. 0,35 s fra telefonen, sættene får "sendes når du har net", og de
sendes én gang hver.

## Gren

Gren `dagens-pas-offline`, forgrenet fra `main` (`dc39052`, 387 merget). 3 commits:

- Blok 1: `960768f` design og risiko, `docs/OFFLINE-PAS.md`
- Blok 2: `2a24d3b` implementering (ingen migration)
- Blok 3: bevis-script, skærmbilleder, pixel-sammenligning og denne rapport

## Hvad ændret

**Blok 1.** `docs/OFFLINE-PAS.md` beskriver designet: hvad der skal virke
uden net, hvad der ikke skal, service worker og cache, øjebliksbillede af
Dagens pas, login uden net, køen (rækkefølge, dubletter, konflikt med
coachens ændringer, idempotens), markeringen, en risikotabel og testplanen.

**Blok 2.**
- `public/sw.js`: hashede filer (`/assets/*`) hentes cache-first. Et hashet
  filnavn ændrer sig aldrig. Cachen holder højst 120 filer. Navigation er
  stadig network-first, så nye deploys når frem. Uden net falder den tilbage
  til den cachede forside. Supabase-kald røres ikke, så ingen atletdata eller
  tokens ligger i Cache Storage.
- `src/athlete/offlineSnapshot.js` (ny): atletrækken, den aktive uge og
  ugens sæt gemmes i `localStorage` pr. login-bruger efter hver vellykket
  hentning. Øjebliksbilledet bruges uden net, når læsningen fejler, eller
  efter 8 s uden svar. Det slettes ved log ud.
- `src/offlineSession.js` (ny) + `App.jsx`: login uden net. Den gemte session
  bruges kun, når auth-js ikke kunne nå serveren og sessionen derfor stadig
  ligger i storage, og kun hvis rollehukommelsen siger "athlete". Et rigtigt
  log ud rydder storage først. Modulet holder også styr på, om nettet reelt
  virker: et kald der fejler på nettet, tæller som offline, indtil et kald
  lykkes. Det er nødvendigt, fordi `navigator.onLine` siger `true` på wifi
  uden internet. Det så vi selv i testen.
- `src/athlete/saetSkrivning.js`:
  - **Idempotens med en eksisterende nøgle.** Hvert sæt får et UUID fra
    klienten som `exercise_logs.id` (primærnøglen). Det samme id bruges ved
    hvert forsøg. Kommer et INSERT frem to gange, afviser databasen det andet
    med `23505`, og klienten laver en UPDATE af samme række.
  - **Uden net forsøges ingen skrivning.** Sættet ligger allerede i køen, så
    markeringen kommer med det samme, og skrivekøen hænger ikke bag et
    auth-refresh, der ellers prøver i ~25 s.
  - **Afsendelse:** køen sendes i den rækkefølge sættene blev logget, én
    afsendelse ad gangen. En post fjernes kun, hvis den stadig er den, der
    blev sendt, så en "ret" midt i en afsendelse ikke går tabt.
  - **Coachen har slettet øvelsen** (`23503`): sættet flyttes til en
    "kunne ikke sendes"-liste, som atleten ser med vægt × reps. Det slettes
    aldrig af sig selv.
  - **Fortryd uden net** lægger en sletning i køen med sættets id, så et
    INSERT der nåede frem i sidste øjeblik ikke bliver til et spøgelsessæt.
  - Et sæt logget uden net kan rettes.
- `src/athlete/laesninger.js`: øjebliksbilledet gemmes og bruges. Ventende
  sæt lægges oven på hentede logs, så et offline-sæt aldrig ser ulogget ud.
- `DagensPasCard.jsx`: "· ☁ sendes når du har net" står ved hvert ventende
  sæt og i den sammenfoldede linje. Linjen "N sæt gemt lokalt" vises nu også,
  når passet er færdigt. Før forsvandt den med det sidste sæt. Parkerede sæt
  har deres egen linje.
- `athlete/IngenForbindelse.jsx` (ny): én rolig linje under topbaren på alle
  faner, fx "Ingen forbindelse. Dagens pas og dine sæt virker; resten
  opdateres, når du har net. Program fra kl. 14.36." De røde "kunne ikke
  hentes"-toasts vises ikke uden net.
- `AthleteView.jsx`: køen sendes ved `online`, når et kald lykkes igen, og
  hvert 20. sekund, mens der ligger sæt og venter. Er appen startet fra
  øjebliksbilledet, hentes alt igen, når nettet kommer.
- `supabase.js`: `signOutHard` rydder øjebliksbilledet. Køen af usendte sæt
  bliver liggende. Fetch-indpakningen melder nettets tilstand.
- `e2e/mock-supabase.mjs`: primærnøglen er nu unik, som i Postgres (409 og
  `23505`). Ellers ville mocken skjule netop de dubletter, der skal
  forhindres.
- Ingen migration. Ingen fil med "IKKE KØRT", fordi designet ikke kræver en.

## Testresultat

- **Bevis** (`node outputs/397/offline-bevis.mjs`, `outputs/397/bevis.json`,
  grøn). Appen er bygget mod e2e-mocken, aldrig prod, og kører headless i
  Chromium på 390x844 (mobil, DSF 2) med service worker:
  1. Online: log ind; service workeren styrer siden og har 6 app-filer i
     cache. Sæt 1 logges online. (`01-online-foer-passet.png`)
  2. Nettet slås fra (DevTools offline), access-token gøres udløbet, og siden
     genindlæses. Det svarer til, at iOS har dræbt appen. **Dagens pas (sæt
     2/4) står der på 351 ms** uden login-skærm og med linjen "Ingen
     forbindelse …". (`02-offline-dagens-pas.png`)
  3. Sæt 2, 3 og 4 logges uden net. Sæt 2 og 3 viser "sendes når du har net".
     "3 sæt gemt lokalt" står stadig, efter passet er færdigt. Der blev
     forsøgt 0 skrivninger af sæt. (`03`, `04-offline-markering-pr-saet.png`,
     `05-offline-passet-faerdigt-tre-venter.png`)
  4. Nettet slås til. Det første INSERT når mocken, men svaret "tabes"
     (route.fetch + abort). Køen tømmes af sig selv, og markeringerne
     forsvinder. (`06-online-igen-sendt.png`)
  5. **Mocken har præcis én række pr. sæt: [1, 1, 1, 1].** Sæt 2–4 har deres
     klient-id som række-id og de rigtige tal. Efter nettet kom: 4 POST og
     1 PATCH. Den ekstra POST er genforsøget efter det tabte svar, afvist med
     409 og lavet om til en PATCH af samme række. De to konsolfejl i
     `bevis.json` er netop det tabte svar og den 409.
  6. Genindlæst online: ingen offline-linje, intet ventende.
     (`07-online-genindlaest.png`)
- **Online uændret:** atletens 11 hovedskærme er taget med 387's script på
  `main` (FØR) og på grenen (EFTER), og alle 11 er 0 % pixel-afvigelse
  (`outputs/397/pixel-foer-atlet-efter-atlet.json`).
- `npm run lint` grøn. `npm run build` grøn.
- Enhedstests: `node --test src/*.test.js`: 311 bestået, 0 fejlet. Heraf er
  `src/offlineDagensPas.test.js` ny: klient-id, rækkefølge, "fjern kun hvis
  samme", parkering, overlay, øjebliksbillede, login uden net.
- `verify:*` der rører atletvisningen, alle grønne: athlete-write-failures,
  athlete-read-failures, athlete-silent-fails-5,
  athlete-silent-fail-visibility, auth-logout-role-switch,
  athlete-training-inputs, athlete-first-day-flow, athlete-tap-targets,
  athlete-onboarding, athlete-onboarding-guide, athlete-self-service,
  athlete-rest-timer-drift, athlete-readiness-draft,
  athlete-reps-per-set-mobile, athlete-jargon-explained,
  athlete-password-reset, atletens-uge, atletens-uge-holder, ugen-faar-dato,
  progression-state.
- e2e grønne: `e2e:dagens-pas` (herunder 293's "fanen lukket 1 s efter
  Godkendt"), `e2e:ret-saet` (herunder offline-"ret"), `e2e:saet-nu`,
  `e2e:rolig-forside`, `e2e:dagens-pas-historik`, `e2e:check-in` og hele
  `npm run e2e` (atlet → coach, med `fejl.spec`'s offline-test).

## Hvad er næste

**Til Marc: test i kælderen efter push.** Brug din egen testatlet og ikke en
rigtig atlet:
1. Åbn appen med net, så forsiden vises (det varmer cachen op). Deployet
   giver én automatisk genindlæsning (ny service worker); det er forventet.
2. Gå ned i kælderen eller slå flytilstand til. Luk appen helt (swipe den
   væk), og åbn den igen fra hjemmeskærmen. Forvent Dagens pas og linjen
   "Ingen forbindelse …", ikke login og ikke en hvid skærm.
3. Log 2–3 sæt med "Godkendt". Forvent "sendes når du har net" og "N sæt
   gemt lokalt".
4. Test også "wifi uden internet": centrets wifi med dårligt signal eller en
   hotspot uden data. Det er det svære tilfælde, fordi telefonen tror den er
   online.
5. Gå op i net igen. Inden for ca. 20 s skal markeringerne forsvinde. Tjek i
   coachens visning, at hvert sæt står der én gang.
6. Log ud og ind igen på samme telefon, og tjek at intet er væk.

Senere: coachen kunne få et flag på sæt, der blev logget offline og sendt
senere. Tidsstemplet (`logged_at`) er i dag afsendelsestidspunktet, ikke
løftetidspunktet (se grænser).

## Ærlige grænser

- **Idempotensen forudsætter, at `exercise_logs.id` er UUID uden
  begrænsning på, hvem der sætter det.** Det passer med mocken og alle
  eksisterende id'er, men jeg har ikke læst prod-skemaet: ingen kald mod
  prod. Afviser databasen et medsendt id (`22P02`/`42804`), falder koden
  tilbage til INSERT uden id med opslag-før-indsæt, som før. Blokerer en
  RLS-politik, at klienten sætter id, ville sættene blive liggende i køen og
  ikke gå tabt. Det bør Marc se, når han tester (punkt 5).
- **`logged_at` er afsendelsestidspunktet.** Sæt der sendes efter passet,
  får den senere tid. Klienten sætter ikke `logged_at` (det gjorde den heller
  ikke før), og jeg har ikke ændret det, fordi det rører coachens analyser.
- **iOS kan slette en hjemmeskærms-apps lagrede data efter 7 dage uden
  brug** (ITP). Et sæt logget uden net og ikke sendt inden for 7 dage kan
  derfor gå tabt. Appen sender ved hver åbning med net.
- **Kun det der har været hentet, er offline:** forsiden og hvad atleten har
  åbnet før. Andre faner uden net er tomme med den rolige linje, eller viser
  LazyBoundary's "Prøv igen", hvis koden aldrig er hentet. Øjebliksbilledet
  har kun den aktive uge.
- **Første gang efter deploy:** en telefon skal have åbnet appen én gang med
  net efter deployet, før filerne er i den nye cache.
- **Chromium-emuleringen** meldte `navigator.onLine = true` efter
  genindlæsning i DevTools-offline. Beviset kørte derfor den svære
  "wifi uden internet"-vej, som jeg har tilføjet (fejlede kald markerer
  nettet som dødt). Ren flytilstand, hvor browseren melder offline, er ikke
  målt i browseren. Den bruger en kortere vej: øjebliksbilledet vises
  straks, uden at serveren prøves.
- **Wifi der hænger i stedet for at fejle:** dør kald først på 12 s-timeouten
  i stedet for med det samme, vises Dagens pas efter højst 6 s (App.jsx),
  ikke 0,35 s.
- **PR-fejring** sker ikke for sæt, der sendes senere fra køen. Sættet
  gemmes, men PR-tjekket kører kun ved logning med net. Det er ikke nyt: en
  fejlet PR-læsning har altid betydet "ingen fejring".
- **Parkerede sæt** (coachen har slettet øvelsen) vises for atleten, men
  sendes ikke til coachen af sig selv. Atleten skal skrive tallene.
- Service workeren er ny, så alle eksisterende brugere får én genindlæsning
  efter deployet (`controllerchange`, som ved enhver sw-ændring).
- Jeg har læst ud over "Læs KUN"-listen, fordi det var nødvendigt for
  login uden net og testen: `src/App.jsx`, `src/supabase.js`,
  `src/offlineSetQueue.js`, `src/appUpdate.js`, `src/roleCache.js`,
  `src/athleteReadGuard.js`, `AthleteView.jsx` (ny tilstand), auth-js'
  `GoTrueClient` (hvornår sessionen fjernes fra storage), `e2e/mock-supabase.mjs`
  og 387's måle-/skærmbilledescripts. e2e- og verify-kørslerne overskrev
  committede skærmbilleder i `outputs/314`, `320`, `330` og
  `ugen-faar-dato`; de er sat tilbage med `git checkout`.

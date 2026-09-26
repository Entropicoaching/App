Ordre 401

# Rapport: Dagens pas uden net, del 2

Et sæt, der logges kl. 17:10 og sendes kl. 18:30, står nu som 17:10 hos
coachen. Telefonen på centrets wifi uden internet hænger ikke længere på et
sæt. Efter højst 8 s står sættet som "sendes når du har net", og de næste sæt
går direkte i køen. Køen sender selv, når nettet virker igen, og hvert sæt
kommer frem præcis én gang. Det gælder også, når det første kald nåede frem,
men svaret ikke kom tilbage.

Betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): **ja.**
Det lukker de to huller, 397 selv pegede på, før Marc kan stole på passet i
kælderen. Tidspunkterne bestemmer, hvilken dag og uge coachen ser et sæt i.
Wifi uden internet er det almindelige tilfælde i centret, ikke flytilstand.

## Gren

`dagens-pas-offline-2` fra `main` (1a297ca, 397 merget).

- `5f1e78b` blok 1: sættet beholder tidspunktet for "Godkendt"
- `024866d` blok 2: et kald der hænger, regnes som offline efter 8 s
- blok 3: denne rapport og beviserne (commit efter `024866d`)

## Hvad ændret

**Blok 1: rigtig tid.**
- `src/athlete/saetSkrivning.js`: `logSet` lægger `logged_at` (tidspunktet for
  "Godkendt") i payloaden. Payloaden er den samme, som lægges i køen, så et
  sæt, der sendes senere, beholder sin tid. Er sættet allerede logget, beholder
  det sin første tid, både ved en ny "Godkendt" og ved "ret"
  (`updateLoggedSet`). En rettelse flytter altså ikke sættet i tid.
- `src/offlineSetQueue.js`: `queuedPayloadWithTime` giver køposter fra før 401
  (uden `logged_at`) det tidspunkt, de kom i køen, og det er samme øjeblik som
  "Godkendt". `flushOfflineSets` sender med den.
- Sortering: coachens atletvisning (`dashboard/laesninger.js`
  `fetchAthleteLogs`), aktivitet, uge-status, Fremgang og atletens historik
  sorterer allerede på `logged_at`. Det har jeg tjekket, og der var intet at
  ændre. Når tiden er rigtig, er rækkefølgen den, sættene blev løftet i.
  Inden for én øvelse viser coachens sessionsvisning sættene efter
  sætnummer, som før.
- `e2e/mock-supabase.mjs`: kun kommentaren er rettet. Mocken beholdt allerede
  en medsendt `logged_at`, ligesom Postgres.

**Blok 2: wifi uden internet.**
- `src/offlineSession.js`: `withSlowNetCutoff(kald, 8000)` returnerer
  `SLOW_NET`, hvis serveren ikke har svaret inden for 8 s. Samtidig huskes
  nettet som dødt (`markNetworkFailure`, samme tilstand som 397's fejlede
  kald).
- `src/athlete/saetSkrivning.js`: et sæt i køen (Dagens pas' "Godkendt" og
  "ret") sendes gennem `sendQueuedSet`, som bruger den grænse. Rammer
  sættet grænsen, vises det som ventende, og det næste sæt forsøger slet
  ikke nettet (397's `seemsOffline`). Det oprindelige kald kører videre. Når
  det frem, fjernes køposten. Ellers sender køen sættet igen med samme
  række-id, og databasen afviser dubletten (23505 → PATCH af samme række).
  Køens runder (`flushOfflineSets`) har også grænsen på opslag, afsendelse og
  sletning, så en runde ikke hænger.
- `src/supabase.js`: `queueWrite` har fået `giveUpIf`. For sæt i køen stopper
  genforsøgene, når nettet er kendt dødt. Før stod ét hængende sæt-kald og
  holdt alle skrivninger tilbage i op til ca. 50 s (4 forsøg à 12 s). Program-
  fanens Log-knap og alle andre skrivninger virker som før.

**Blok 3.** `outputs/401/offline-bevis.mjs` er 397's bevis udvidet med de to
tilfælde. Skærmbilleder ligger i `outputs/401/tid/` og `outputs/401/haenger/`,
og tallene i `bevis-tid.json` og `bevis-haenger.json`.

## Testresultat

- `node outputs/401/offline-bevis.mjs` (headless Chromium 390x844 mod
  e2e-mocken, service worker som i prod): **GRØN, begge scenarier.**
  - **tid** (397-forløbet): appen genåbnes uden net med udløbet token, og
    sæt 2-4 logges. Nettet kommer 11 s senere, og ét svar går tabt. Mocken
    har én række pr. sæt `[1,1,1,1]`. Hver række har `logged_at` = tidspunktet
    for "Godkendt" (inden for 1,5 s) og ligger mindst 6 s før afsendelsen.
    Sorteret på `logged_at` (nyeste først) er rækkefølgen `[4,3,2,1]`.
  - **haenger**: `navigator.onLine` er true, og alle kald hænger, men sæt 2's
    INSERT når mocken. Sæt 2 vises som "gemt lokalt" efter 8495 ms, og Dagens
    pas går videre til sæt 3 med det samme. Sæt 3 vises som ventende efter
    38 ms, uden noget kald. Begge sæt har "sendes når du har net". Nettet
    virker igen uden 'online'-event, og køen sender selv efter 18,9 s (runden
    kører hvert 20. s). Mocken har én række pr. sæt `[1,1,1,0]`, så sæt 2 er
    ikke dubleret. Begge sæt har deres række-id og godkendt-tid.
- `node --test src/offlineDagensPas.test.js`: 13/13 (4 nye: tid i køen, tid
  i overlay, hængende kald → SLOW_NET, hurtigt svar går uændret igennem).
- `npm run lint`: rent. `npm run build`: grøn.
- `verify:athlete-write-failures`, `e2e:dagens-pas`, `e2e:ret-saet`,
  `e2e:dagens-pas-historik`: alle grønne. Kørslerne overskrev de committede
  skærmbilleder i `outputs/320`. Dem har jeg sat tilbage med `git checkout`.

## Hvad er næste

**Til Marc: test i kælderen efter push.** Brug din testatlet, ikke en rigtig
atlet.
1. Åbn appen med net, så forsiden vises. Deployet giver én automatisk
   genindlæsning.
2. Gå ned i kælderen på centrets wifi (wifi til, intet internet). Log sæt 1
   med "Godkendt", og skriv klokkeslættet ned. Forvent, at du kan logge næste
   sæt med det samme, og at sæt 1 senest efter ca. 8 s står med "sendes når
   du har net".
3. Log 2 sæt mere med et par minutters pause. De skal få markeringen med det
   samme.
4. Luk appen helt (swipe den væk), og åbn den igen stadig uden net. Forvent
   Dagens pas og de tre ventende sæt, ikke login.
5. Vent mindst 10 min, og gå så op i net. Inden for ca. 20 s skal
   markeringerne forsvinde.
6. I coachens visning: hvert sæt står der én gang, med kælder-klokkeslættene
   fra punkt 2-3 (ikke tidspunktet for punkt 5) og i den rækkefølge, du
   løftede dem.

Senere: et diskret flag hos coachen på sæt, der blev sendt senere, hvis
coachen vil vide det.

## Ærlige grænser

- **Tiden er telefonens ur.** Går telefonens ur forkert, står sættet med den
  forkerte tid. Før var det serverens ur. Moderne telefoner stiller uret
  selv, så det burde ikke ske i praksis, men jeg har ikke lagt et værn ind.
- **Sæt logget før 401 og stadig i køen** får tidspunktet, hvor de kom i køen.
  Det er samme øjeblik som "Godkendt", så i praksis rigtigt. Et sæt, der
  allerede står på serveren med afsendelsestiden, bliver ikke rettet.
- **8 s er et valg.** Et meget langsomt, men virkende net (over 8 s pr.
  kald) regnes også som offline. Sættet sendes så via køen, typisk inden
  for 20 s, og markeringen vises imens. Intet går tabt, men atleten kan se
  "sendes når du har net" et øjeblik på et net, der faktisk virker.
- **Køen opdager nettet hvert 20. sekund**, fordi der ikke kommer en
  'online'-event, når browseren aldrig troede, den var offline. Målt i
  beviset: 18,9 s. Et andet kald, der lykkes (fx en genhentning), sender køen
  med det samme.
- **Første sæt på hængende wifi** venter de 8 s. Knappen og næste sæt er fri
  med det samme, så det er kun markeringen, der kommer efter 8 s.
- **Program-fanens egen Log-knap** har ikke fået grænsen. Den har ingen kø og
  viser en fejl som før (låst af `verify:athlete-write-failures`). Det samme
  gælder spring over, auto-udfyld og feedback.
- **"Fortryd" på et sæt, mens wifi hænger**, sletter i baggrunden uden
  8 s-grænsen. Kaldet prøver som før i op til ca. 50 s, og så lægges
  sletningen i køen. Skærmen venter ikke på det, men andre skrivninger står
  bag det i den tid. Det er ikke rørt i 401.
- Wifi uden internet er målt i Chromium med ruter, der hænger. En rigtig
  telefon på et rigtigt net er ikke målt, derfor kældertesten ovenfor.
- Prod-skemaet (`logged_at` må sættes af klienten, `id` er uuid, RLS tjekker
  kun `athlete_id`) er ordrens fakta fra Dhruva. Jeg har ikke kaldt prod.
- Jeg har læst ud over "Læs KUN"-listen, fordi det var nødvendigt:
  `src/dashboard/laesninger.js`, `src/dashboard/atletHandlinger.js`,
  `src/fremgangLogs.js` og `src/athlete/laesninger.js` (for at tjekke, hvor der
  sorteres på `logged_at`), `e2e/fixtures.mjs` og `src/AthleteView.jsx` (hvor
  køen prøver igen).

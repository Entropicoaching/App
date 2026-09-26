# Ordre 403, blok 2: koden linje for linje

Jeg har læst køen (`src/offlineSetQueue.js`), afsendelsen og genforsøgene
(`src/athlete/saetSkrivning.js`), idempotensen (`insertSetLog`), timeouten
(`src/offlineSession.js` `withSlowNetCutoff`, `src/supabase.js` `fetchWithTimeout` og
`queueWrite`), og hvor køen startes (`src/AthleteView.jsx`) og læses
(`src/athlete/laesninger.js`). Linjenumrene er fra `main` @ `39b1ce8`.

For hvert sted har jeg spurgt tre ting. Kan et sæt **tabes**, **komme to gange** eller
**få forkert tid**? Og **sluges en fejl i stilhed**? Fund markeret "bevist" er
genskabt i browseren (blok 1). "Læst" betyder, at fundet kun er læst i koden.

## O1: Dagens pas tømmes, når køen er sendt (bevist, sandsynlighed høj)

**Hvor.** `src/AthleteView.jsx:345-360` registrerer `flushOfflineSets` på `online` og
`entropi:forbindelse` og kalder den ved start. Effekten har kun `[athlete?.id]` som
afhængighed. Funktionen, der bliver hængende, er derfor den fra den render, hvor
`athlete` først blev sat. `laesninger.js:128` sætter `athlete`, før `fetchProgram`
(`:482`) når at sætte `currentWeek`, så i den lukning er `currentWeek` **null**.
Kommentaren på `:359` ("alle friske ved kald") passer ikke.
`saetSkrivning.js:371` slutter hver afsendelse med `fetchExerciseLogs(athlete.id,
currentWeek)`. Med `null` rammer den `laesninger.js:626`: ingen øvelses-id'er, så
`setExerciseLogs([])`.

**Hvornår.** Hver gang køen sendes via `online`, via `entropi:forbindelse` (et kald
lykkes igen) eller ved app-start, når appen blev åbnet med net. Det gælder også
genindlæsningen efter en ny service worker og login efter log ud. Kun når appen er
startet fra øjebliksbilledet (uden net), er lukningen frisk, for der sættes `athlete` og
`currentWeek` i samme render (`laesninger.js:52-58`). Det er den vej, 397's og 401's
beviser gik. På hængende wifi var det held: 20-s-runden (frisk lukning) startede før den
forældede, og `flushInFlight` stoppede den forældede.

**Konsekvens.** Sættene ER gemt, men Dagens pas viser "Sæt 1/4" og intet klaret. Det
bliver ved, indtil noget andet henter igen. Målt: stadig efter 28 s. Atleten tror, at
passet er væk, og trykker "Godkendt" igen:
- Er sættet sendt i denne åbning af appen, kender `setWriteRef` rækken. Så bliver det
  en UPDATE med `logged_at = nu` (`saetSkrivning.js:133`, `existing` findes ikke mere):
  **sættet mister sin kældertid** (målt: flyttet 30 s). Vægt og reps overskrives med
  det, der står i felterne.
- Er sættet logget i en **tidligere** åbning, får det et nyt række-id
  (`saetSkrivning.js:196`), og så bliver det et nyt INSERT: **sættet står to gange hos
  coachen** (målt: `[2,1,1,0]`), se O2.
- "Fortryd sidste sæt" står stadig på skærmen ved siden af "Sæt 1/4" og fortryder det
  sidste sæt, atleten loggede før afsendelsen. Det er ikke det, skærmen ser ud til at
  tilbyde.

Fejlen er ikke ny i 397/401: lukningen og `fetchExerciseLogs(…, currentWeek)` stammer
fra 280/293 og blev flyttet i 373. Men 397 gjorde køen til hovedvejen for "Godkendt"
og tilføjede `entropi:forbindelse`. Nu rammer den efter hvert pas uden net.

**Forslag.**
1. Lad lytterne kalde den nyeste funktion (`flushRef.current = flushOfflineSets` i
   hver render, og `() => flushRef.current()` i lytterne), eller læs `currentWeek` og
   `exerciseLogs` fra refs i `flushOfflineSets`.
2. `fetchExerciseLogs` uden uge må ikke tømme listen (`if (!week) return` før
   `setExerciseLogs([])`).
3. En e2e, der åbner appen MED net, logger uden net, går online og tjekker "Sæt N/4"
   bagefter. Mine scenarier `online-start` og `aabn-med-net` gør det.

## O2: den direkte afsendelse laver en ny række, når skærmen ikke kender den (bevist via O1, sandsynlighed middel)

**Hvor.** `saetSkrivning.js:196` vælger række-id: køposten, `setWriteRef`, ellers et
**nyt** UUID. `persistSetLog` (`:83-103`) laver en UPDATE kun, hvis `realExisting` står
i `exerciseLogs`, og ellers går `insertSetLog` (`:57`) direkte til INSERT med det nye
id. Kun køens runde slår rækken op først (`:341-354`). Idempotensen (23505) beskytter
kun mod genforsøg med **samme** id. Ifølge Dhruvas fakta har prod ingen unik nøgle
på (atlet, øvelse, sæt).

**Hvornår.** Når skærmens `exerciseLogs` mangler en række, der findes på serveren: O1,
en anden fane eller telefon, der har logget sættet online (fanen her har gammel
tilstand), eller et øjebliksbillede fra før sættet blev sendt.

**Konsekvens.** Sættet står to gange hos coachen. Det tæller dobbelt i tonnage og
e1RM-kurver.

**Forslag.** Når id'et er nyt (ingen køpost, ingen `setWriteRef`), så slå (atlet,
øvelse, sæt) op før INSERT, som køen allerede gør. Kan opslaget ikke gennemføres, så
læg sættet i køen i stedet for at gætte. Den varige løsning er en unik indeks på
`exercise_logs (athlete_id, exercise_id, set_number)`, men det er en migration og
kræver ordre, og eksisterende dubletter skal ryddes først.

## O3: log ud med usendte sæt (bevist, sandsynlighed lav-middel)

**Hvor.** `src/athlete/Ramme.jsx:120`: "Log ud af Entropi? Du skal logge ind igen for at
fortsætte." Spørgsmålet nævner ikke køen. `supabase.js:210-226` lader køen ligge
(`entropi_offline_sets:<atlet-id>`), og den sendes kun, når **samme atlet** logger ind
**på samme telefon** (`AthleteView.jsx:348-349`).

**Konsekvens.** Logger atleten ud i kælderen, lander de på login-skærmen uden net og
kan ikke komme ind igen. Der står intet om, at der ikke er forbindelse. Skifter
atleten telefon, låner de en telefon ud og logger ud, eller rydder iOS lagret efter 7
dage (397's grænse), så **når sættene aldrig coachen**, og ingen får det at vide.

**Forslag.** Er `countOfflineSets > 0`, så skal spørgsmålet sige det: "Du har 2 sæt,
der ikke er sendt endnu. De sendes næste gang du logger ind på denne telefon. Log ud
alligevel?" Helst skal log ud vente, til køen er tom, når der er net. Login-skærmen
bør sige "Ingen forbindelse", når `navigator.onLine` er false eller kaldet fejler på
nettet.

## O4: fortryd kan efterlade et spøgelsessæt (læst, sandsynlighed lav)

**Hvor.** `undoLoggedSet` fjerner køposten med det samme (`saetSkrivning.js:389`), men
skriver først sletningen i køen (`:401`, `:405`), når kæden bag sættets egen
skrivning er færdig (`:392-393`). På hængende wifi kan den kæde vente op til ca. 12 s
(med giveUpIf), og selve sletningen (`:402`) kører uden `giveUpIf` og uden 8-s-grænse
i op til ca. 50 s (401's egen grænse).

**Konsekvens.** Dør appen i det vindue, og nåede det hængende INSERT frem, er der
hverken en køpost eller en sletning. Så står sættet, som atleten fortrød, hos
coachen.

**Forslag.** Skriv sletningen i køen **synkront** (før kæden), når der findes et
række-id. Giv sletningen `giveUpIf: seemsOffline` og `withSlowNetCutoff` som
afsendelsen.

## O5: tiden er telefonens ur (bevist, sandsynlighed lav)

**Hvor.** `saetSkrivning.js:133` (`new Date()` ved "Godkendt") og
`offlineSetQueue.js:103` (`queuedAt`). Serveren overskriver ikke en medsendt
`logged_at`.

**Konsekvens.** Med uret 7 dage bagud står sættene i sidste uge hos coachen (målt:
`logged_at` 2026-09-19 for sæt løftet 2026-09-26). Tabt eller dubleret bliver intet.

**Forslag.** Mål telefonens afvigelse fra serverens `Date`-header på et vellykket kald
(`fetchWithTimeout` ser svaret). Er afvigelsen over nogle minutter, så ret
`logged_at` med den ved afsendelse. Alternativt: send `logged_at` kun, når sættet
faktisk har ligget i køen, og ellers lad serveren sætte `now()`.

## O6: fejl der sluges i stilhed (læst, sandsynlighed lav)

- `saetSkrivning.js:352` og `:359-365`: en fejl i køens runde, der hverken er "offline"
  eller 23503 (fx 401/JWT, RLS 42501, en check-constraint), giver `continue` **uden
  log**. Posten bliver i køen for evigt, og atleten ser "☁ sendes når forbindelsen er
  tilbage" på et net, der virker. Coachen får intet at vide. Forslag:
  `logFrontendError` pr. fejlkode. Efter fx 5 fejlede runder skal posten parkeres
  synligt som ved 23503.
- `saetSkrivning.js:444-458` (`updateLoggedSet`): kan `saveOfflineSet` ikke gemme
  (fuld lagerplads), og fejler skrivningen, siger koden "ligger i offline-køen" og
  beholder rettelsen på skærmen. Men den ligger ingen steder, så rettelsen er tabt
  uden besked. (`logSet` gør det rigtigt: den viser fejl og ruller tilbage.)
- `offlineSetQueue.js:14-24`: er køens JSON ødelagt, læses den som `{}`, og det næste
  `saveOfflineSet` overskriver hele køen med ét sæt. Det kræver ødelagt lagerplads, så
  det er meget usandsynligt. Forslag: læg den ødelagte streng til side i stedet for
  at overskrive.
- `saetSkrivning.js:113-117`: et sent svar med fejl efter SLOW_NET ignoreres. Det er
  i orden, fordi posten bliver i køen.

## O7: 8-s-grænsen tæller ventetid i skrivekøen med (læst, sandsynlighed lav, intet tab)

**Hvor.** `withSlowNetCutoff(write)` (`saetSkrivning.js:111`, `:357`) starter uret, når
kaldet oprettes, men `queueWrite` (`supabase.js:262-283`) er én global kæde. Står en
anden skrivning forrest og hænger (fx en fortryd-sletning uden `giveUpIf`, O4), så
rammer sættet de 8 s uden selv at have prøvet nettet.

**Konsekvens.** Nettet markeres som dødt (`markNetworkFailure`), "Forbindelsen er
svag" og "sendes når du har net" vises på et net, der virker, og sættet sendes via
køen op til 20 s senere. Intet tabes.

**Forslag.** Start uret, når kaldet faktisk går i gang (inde i `queueWrite`'s `run`),
eller giv alle skrivninger bag et sæt `giveUpIf`.

## O8: to faner kan overskrive hinandens kø (læst, sandsynlighed meget lav)

**Hvor.** `saveOfflineSet`, `clearOfflineSet` og `parkOfflineSet` læser hele køen,
ændrer den og skriver den tilbage (`offlineSetQueue.js:26-58`, `:124-137`). To faner
i hver sin proces kan i sjældne tilfælde skrive oven i hinanden, og så forsvinder en
post.

**Konsekvens.** Et sæt kan forsvinde fra køen, før det er sendt. I blok 1's `to-faner`
skete det ikke: B genbrugte A's række-id fra den delte kø, og mocken havde `[1,1,0,0]`.

**Forslag.** Én nøgle pr. sæt (`entropi_offline_sets:<atlet>:<nøgle>`) i stedet for ét
objekt. Så rører en skrivning kun sit eget sæt.

## Det der holder

- **Køen før skrivningen** (`saetSkrivning.js:197-199`, i klik-handleren før første
  `await`): bevist i `kaelder`, hvor appen blev lukket i samme øjeblik som
  "Godkendt".
- **Samme række-id ved hvert forsøg**, og 23505 bliver til UPDATE af egen række
  (`:66-77`): bevist i 397/401 og i `to-faner` og `sw-opdatering` her.
- **Opslag før INSERT i køens runde** (`:341-354`): det, der gør gensending efter et
  tabt svar sikkert.
- **"Fjern kun hvis samme"** (`offlineSetQueue.js:69-78`): en rettelse midt i en
  afsendelse går ikke tabt.
- **Én runde ad gangen, og hvert skridt har en 8-s-grænse**: runden kan ikke hænge.
- **Kø pr. atlet-id**: atlet B så intet af A's sæt og sendte dem ikke med sin
  session (`skift-atlet`).
- **Tid fra "Godkendt"** bevares gennem køen og genstart (`kaelder`: alle 5 rækker har
  køpostens `logged_at`).

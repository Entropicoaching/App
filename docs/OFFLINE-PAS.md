# Dagens pas uden net (ordre 397, blok 1: design og risiko)

Mål: atleten kan se dagens program og logge sæt i en kælder uden net, og
intet sæt går tabt eller bliver sendt to gange. Når nettet er der, må intet
ændre sig for atleten.

## Hvad der findes i forvejen (og hvad der mangler)

| Del | I dag | Hul |
|---|---|---|
| Lokal kø for sæt | `src/offlineSetQueue.js` (ordre 280/293): "Godkendt" i Dagens pas lægger sættet i `localStorage` FØR skrivningen og fjerner det ved succes; `flushOfflineSets` sender igen ved app-åbning og på `online`. | (1) Uden net venter hver skrivning på `queueWrite`s 4 forsøg bag et token-refresh, der selv prøver i ~25 s, så markeringen "sendes når du har net" kommer sent, og skrivekøen står fast. (2) Et INSERT der nåede frem, men hvis svar gik tabt, prøves igen af `queueWrite` som et nyt INSERT: dublet. (3) Et sæt hvis øvelse coachen har slettet imens, fejler for evigt uden at atleten får det at vide. |
| Service worker | `public/sw.js`: navigationer network-first med offline-fallback til den cachede HTML. | JS/CSS-chunks caches ikke. Åbnes appen uden net, kommer HTML'en, men bundtet kan ikke hentes: hvid skærm. |
| Dagens program | Hentes fra Supabase ved hver åbning. | Uden net: fejltoast og intet program. |
| Login | Sessionen ligger i `localStorage`. | Er access-token udløbet (1 t), prøver auth-js at forny; uden net giver `getSession()` `null`, og appen viser login-skærmen. |
| Markering | Én linje under Dagens pas: "☁ N sæt gemt lokalt". | Ingen markering pr. sæt; linjen kommer først efter de fejlede forsøg. |

## Hvad der skal virke uden net

1. Appen åbner (også efter at telefonen har dræbt den i baggrunden).
2. Forsiden viser Dagens pas for den aktive uge, som den så ud sidst appen
   havde net, med de sæt der allerede er logget (fra serveren eller i køen).
3. "Godkendt", "ret" og "fortryd sidste sæt" virker. Sættet vises som logget
   med det samme, med en lille markering "sendes når du har net".
4. Når nettet kommer, sendes hvert ventende sæt præcis én gang, markeringen
   forsvinder, og forsiden henter frisk data.

## Hvad der ikke skal virke uden net

Alt andet (Program-, Kost-, Besked-, Volumen-, Fremgang-, Stævne-fanerne,
parathed, VideoCoach, PR-fejring). Det må gerne være tomt eller vise sidst
kendte indhold, men i stedet for røde fejltoasts viser appen én rolig linje
øverst på alle faner: "Ingen forbindelse. Dagens pas og dine sæt virker; resten
opdateres, når du har net." Røde "kunne ikke hentes"-toasts undertrykkes, så
længe browseren melder offline. En fane hvis kode aldrig er hentet, viser sin
eksisterende "Prøv igen" (LazyBoundary).

PR-detektion kræver en læsning af `personal_records` og springes stille over
uden net (sættet selv er gemt). Det er ikke nyt: en fejlet PR-læsning har
altid betydet "ingen fejring".

## Caching af appen (service worker)

`public/sw.js` udvides, samme fil, samme registrering:

- **Hashede assets (`/assets/*`) = cache-first.** Filnavnene indeholder
  byggets hash, så en fil med et givet navn ændrer sig aldrig. Første gang en
  chunk hentes (online), gemmes den i `entropi-assets-v1`; derefter tages den
  fra cachen. Cachen beskæres til de nyeste 120 filer, så gamle deploys ikke
  ophobes.
- **Navigationer: uændret network-first** (så en ny deploy altid når frem).
  Fallback uden net: den cachede kopi af samme URL, ellers af `/`.
- **Supabase-kald røres ikke af service workeren.** De går til et andet
  domæne; ingen atletdata eller tokens havner i Cache Storage.
- Ny service worker ⇒ én genindlæsning efter næste deploy for eksisterende
  brugere (`controllerchange` i `appUpdate.js`), som ved enhver sw-ændring.
  Det er også den genindlæsning, der gør at chunks derefter går gennem den nye
  cache.

Kun chunks der har været hentet, er offline. Forsiden (AthleteView og dens
hjælpe-chunks) hentes ved hver åbning og er derfor altid med. En fane atleten
aldrig har åbnet, er ikke.

## Caching af dagens program (øjebliksbillede)

Nyt modul `src/athlete/offlineSnapshot.js` (rene funktioner, storage kan
sprøjtes ind, samme mønster som `offlineSetQueue.js`):

- Nøgle `entropi_offline_pas:<auth-bruger-id>` i `localStorage` (bruger-id,
  fordi det er det eneste appen kender, før atletrækken er hentet).
- Indhold: atletrækken, den aktive uge (med sessioner og øvelser) og ugens
  sæt-logs, plus tidspunkt. Kun den aktive uge, ikke hele programmet: det er
  "dagens pas", og det holder størrelsen lille (typisk 10–40 kB).
- Skrives efter hver vellykket `fetchProgram` / `fetchExerciseLogs` for
  atletens egen visning (aldrig i coachens forhåndsvisning).
- Læses, når `fetchAthlete` fejler, eller straks, når browseren melder
  offline. Er der intet øjebliksbillede, opfører appen sig som i dag.
- Ryddes ved log ud (`signOutHard`), så en delt telefon ikke beholder den
  forrige atlets program. (Køen af ventende sæt ryddes IKKE ved log ud: den
  er atletens egne usendte sæt og sendes næste gang atleten logger ind.)
- Ved langsomt net (browseren siger online, men intet svar inden 8 s) vises
  øjebliksbilledet, og det rigtige svar erstatter det, når det kommer. Normalt
  net svarer langt under 8 s, så online ændres intet.

## Login uden net

`src/offlineSession.js` læser den gemte Supabase-session direkte fra
`localStorage` (samme nøgle som auth-js). App.jsx bruger den kun når ALLE tre
gælder: (a) auth-js har ingen gyldig session nu, (b) sessionen ligger stadig i
storage, og (c) rollehukommelsen (`roleCache.js`) siger "athlete" for netop
den bruger. Auth-js fjerner selv sessionen fra storage, når fornyelsen afvises
af serveren (tilbagekaldt, logget ud et andet sted); den beholder den kun ved
netværksfejl. Så (b) betyder "vi kunne ikke nå serveren", ikke "sessionen er
død". Den gemte session giver ingen ny adgang: den bruges kun til at vide
hvilket øjebliksbillede der skal vises, og kald med et udløbet token afvises
af Supabase og ender i køen. Når nettet kommer, fornyer auth-js tokenet
(`TOKEN_REFRESHED`), og App.jsx skifter til den rigtige session.

Hvornår: straks hvis `navigator.onLine === false`; ellers når `getSession()`
er færdig uden session, eller når App.jsx's eksisterende 12 s-sikkerhedsnet
rammer (i dag viser det "Kunne ikke indlæse").

Coachen er ikke med (rollehukommelsen skal sige "athlete").

## Kø af sæt og afsendelse

Køen er den eksisterende: ét objekt pr. atlet, én post pr. sæt-nøgle
`<exercise_id>_<set_number>` med den seneste payload. Ændringer:

1. **Idempotens med en eksisterende unik nøgle: rækkens primærnøgle.**
   Første gang et sæt logges, danner klienten et UUID (`crypto.randomUUID`)
   og sender det som `exercise_logs.id` i INSERT. Id'et gemmes i køposten og
   genbruges ved hvert genforsøg, også efter genstart af appen, og hvis sættet
   rettes eller logges igen efter "fortryd". Kommer INSERT'et frem to gange,
   afviser databasen nummer to med `23505` (unik-brud); klienten slår så
   rækken op på (atlet, øvelse, sæt-nr.) og laver en UPDATE med den seneste
   payload. Resultat: højst én række pr. sæt, seneste værdi vinder. Ingen
   migration: `id` er primærnøgle i forvejen, og kolonnen er UUID (samme
   format i mocken og i alle eksisterende rækker).
   Afviser databasen det medsendte id (`22P02`/`42804`, hvis kolonnen mod
   forventning ikke er UUID), prøves samme INSERT én gang uden id, med det
   eksisterende opslag-før-indsæt som værn.
2. **Uden net forsøges intet.** Melder browseren offline, returnerer
   skrivningen straks "offline" i stedet for at stå i `queueWrite`s kø bag et
   auth-refresh. Sættet ligger allerede i køen; markeringen vises med det
   samme.
3. **Rækkefølge.** Køen sendes i den rækkefølge sættene blev logget
   (`queuedAt`), én ad gangen. Pr. sæt-nøgle serialiserer den eksisterende
   `setWriteRef`-kæde, så en "ret" aldrig overhaler sit eget INSERT. Mellem
   forskellige sæt er rækkefølgen ligegyldig for databasen (hver række er
   selvstændig), men sekventiel afsendelse gør loggen i coachens visning
   kronologisk.
4. **Samtidige afsendelser.** `online`, app-åbning og en genindlæsning kan
   starte flush to gange. En lås i modulet (én flush ad gangen pr. fane)
   plus idempotensen i punkt 1 dækker også to faner/to enheder.
5. **Dubletter ved tabt svar** (INSERT nåede frem, svaret gjorde ikke): næste
   forsøg bruger samme id ⇒ `23505` ⇒ UPDATE. Før denne ordre blev det en
   dublet, når `queueWrite` prøvede igen inden for de ~4 s.
6. **Konflikt: coachen har ændret ugen imens.**
   - Øvelsen findes stadig (coachen har rettet vægt/reps/sæt): sættet sendes
     som logget. Det atleten faktisk løftede er sandheden; coachen ser det.
   - Øvelsen er slettet (`23503`, fremmednøgle-brud): sættet kan ikke gemmes.
     Det flyttes fra køen til en "kunne ikke sendes"-liste (samme storage,
     egen nøgle), bliver aldrig slettet af sig selv, logges til
     `frontend_errors`, og Dagens pas viser: "N sæt kunne ikke sendes, fordi
     coachen har ændret øvelsen. Skriv til din coach." med vægt × reps, så
     atleten kan give tallene videre.
   - Alle andre fejl (netværk, 5xx, udløbet token, RLS-hikke) bliver liggende
     i køen og prøves igen ved næste `online`/åbning.
7. **Fortryd uden net.** Fortryd fjerner posten fra køen (som i dag). Har
   sættet muligvis nået serveren (vi har et id, men intet bekræftet svar),
   lægges en sletning med det id i køen i stedet, så en række der kom frem i
   sidste øjeblik ikke bliver et spøgelsessæt. Logges sættet igen, erstattes
   sletningen af en ny log med SAMME id (punkt 1), altså INSERT-eller-UPDATE.

## Hvordan atleten ser at et sæt venter

- Pr. sæt i Dagens pas: ved siden af det loggede sæt står "gemt" (som i dag,
  kort), eller, hvis det ligger i køen, en lille "☁ sendes når du har net".
- Linjen under kortet ("☁ N sæt gemt lokalt, sendes når forbindelsen er
  tilbage") bliver, og tæller nu med det samme uden net.
- Topbanneret "Ingen forbindelse …" (se ovenfor).
- Når køen er tom, forsvinder alt uden en ekstra besked (som i dag).
- Online ændres intet: et sæt der lykkes med det samme, får aldrig
  "sendes"-markeringen (samme regel som 293: linjen må ikke blinke).

## Risiko: hvad kan gå tabt, og hvordan det forhindres

| Risiko | Forhindret af |
|---|---|
| Fanen dræbes, før skrivningen er færdig | Køposten skrives FØR skrivningen (293), nu med id; sendes ved næste åbning. |
| Dublet ved tabt svar / to flush på én gang / to faner | Klient-UUID som primærnøgle ⇒ `23505` ⇒ UPDATE; lås pr. fane. |
| Coachen sletter øvelsen imens | `23503` ⇒ "kunne ikke sendes"-liste, synlig for atleten, aldrig slettet stille. |
| `localStorage` fuld eller slået fra (privat vindue) | `saveOfflineSet` returnerer `false`; så falder "Godkendt" tilbage til den gamle adfærd (online-skrivning, fejl vises). Der vises ikke "gemt" for noget der ikke er gemt. |
| iOS rydder data for en hjemmeskærms-app der ikke er åbnet i 7 dage (ITP) | Kan ikke forhindres i en web-app. Risikoen gælder kun sæt der både er logget uden net OG ikke sendt inden for 7 dage; appen sender ved hver åbning med net. Står i rapportens grænser. |
| Log ud på en delt telefon | Øjebliksbilledet ryddes; ventende sæt bliver (de hører til en atlet-id og sendes kun med den atlets login, RLS). |
| Forkert atlet ser data | Øjebliksbilledet er nøglet på auth-bruger-id og bruges kun for den bruger, der har sessionen på enheden. |
| Gammelt program vises | Øjebliksbilledet viser sit tidspunkt i offline-linjen ("program fra kl. 17:42"); det erstattes ved første svar fra serveren. |
| Et udløbet token sendes | Supabase afviser (401); sættet bliver i køen; auth-js fornyer, når nettet kommer. |
| En ny service worker cacher noget forkert | Kun `/assets/*` (uforanderlige, hashede filer) og HTML (network-first som før). Ingen API-svar, ingen `version.json`. |

## Test (blok 3)

Headless Chromium 390x844 mod den byggede app og e2e-mocken
(`e2e/mock-supabase.mjs`, aldrig prod). Mocken får en realistisk
primærnøgle-regel (samme id to gange ⇒ 409/`23505`), så dubletter ville ses.
Forløb: åbn online (varmer service worker og øjebliksbillede), slå nettet fra
(DevTools offline), genindlæs, se Dagens pas, log tre sæt, se markeringerne,
slå nettet til, tæl POST'er og rækker pr. sæt i mocken: præcis én række pr.
sæt.

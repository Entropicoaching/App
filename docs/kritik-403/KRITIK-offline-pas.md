# Kritik: Dagens pas uden net (397 + 401)

**Klar til push: nej, fordi** Dagens pas viser passet som "Sæt 1/4" og intet klaret,
hver gang køen sendes efter en åbning med net (O1). Det tryk, en atlet så naturligt
gør, lægger et sæt to gange hos coachen eller flytter sættets tid (O2). Selve køen
taber ikke sæt: i alle ni scenarier nåede hvert sæt frem, og intet sæt kom frem to
gange af sig selv.

## Fund

| # | Fund | Bevis | Sandsynlighed | Konsekvens | Skal rettes før push |
|---|---|---|---|---|---|
| **O1** | Når køen sendes via `online`, `entropi:forbindelse` eller app-start, kører en forældet `flushOfflineSets` med `currentWeek = null`. Den slutter med `fetchExerciseLogs(id, null)`, og så tømmes `exerciseLogs`. Dagens pas viser "Sæt 1/4", også 28 s senere. `AthleteView.jsx:345-360`, `saetSkrivning.js:371`, `laesninger.js:626` | bevist: `online-start`, `aabn-med-net`, `to-faner`, `log-ud`, `sw-opdatering` | **høj** (efter hvert pas uden net, hvor appen blev åbnet med net) | Atleten tror, sættene er væk. Trykker de igen, får sættet ny tid (målt +30 s) eller en dublet (O2) | **ja** |
| **O2** | Når id'et er nyt, går den direkte afsendelse til INSERT uden opslag. Kender skærmen ikke rækken, bliver det en ny række. Prod har ingen unik nøgle på (atlet, øvelse, sæt). `saetSkrivning.js:196`, `:57`, `:83-103` | bevist via O1: `[1,1,1,0]` → `[2,1,1,0]` | middel | Sættet står to gange hos coachen og tæller dobbelt i tonnage og e1RM | **ja** (opslag før INSERT; unik indeks kræver migration og ordre) |
| **O3** | Log ud nævner ikke usendte sæt. Køen sendes kun, når samme atlet logger ind på samme telefon. Log ud uden net låser atleten ude, uden at der står "ingen forbindelse". `Ramme.jsx:120`, `supabase.js:210-226` | bevist: `log-ud`, `skift-atlet` | lav-middel | Sæt når aldrig coachen ved skift af telefon, udlånt telefon eller iOS-oprydning efter 7 dage | anbefalet (én tekst og ét tjek) |
| **O4** | Fortryd fjerner køposten med det samme, men skriver først sletningen, når sættets hængende skrivning er færdig. Dør appen imens, og nåede INSERT'et frem, så bliver sættet stående. `saetSkrivning.js:389`, `:392-405` | læst | lav | Et sæt, atleten fortrød, står hos coachen | nej |
| **O5** | `logged_at` er telefonens ur, og intet værn. `saetSkrivning.js:133`, `offlineSetQueue.js:103` | bevist: `forkert-ur` (7 dage bagud giver 7 dage forkert hos coachen) | lav | Sættet står i forkert dag eller uge | nej |
| **O6** | Fejl der sluges: køens runde laver `continue` uden log ved andre fejl end offline og 23503, så "sendes når forbindelsen er tilbage" står for evigt på et net, der virker. `updateLoggedSet` siger "i køen", selv når `saveOfflineSet` fejlede. En ødelagt kø-JSON overskrives. `saetSkrivning.js:352`, `:359-365`, `:444-458`, `offlineSetQueue.js:14-24` | læst | lav | Et sæt eller en rettelse når aldrig frem, og ingen får det at vide | nej (logning anbefalet) |
| **O7** | 8-s-grænsen tæller ventetid i den globale skrivekø med. `saetSkrivning.js:111`, `:357`, `supabase.js:262-283` | læst | lav | Falsk "svag forbindelse" og op til 20 s forsinkelse. Intet tab | nej |
| **O8** | Køen er ét objekt, der læses, ændres og skrives tilbage. To faner i hver sin proces kan i sjældne tilfælde overskrive hinanden. `offlineSetQueue.js:26-58` | læst (`to-faner` var ren: `[1,1,0,0]`) | meget lav | En køpost kan forsvinde, før den er sendt | nej |

Detaljer, linje for linje: `docs/kritik-403/KODEN-LINJE-FOR-LINJE.md`. Hvad atleten
ser: `docs/kritik-403/ATLETEN-I-KAELDEREN.md`.

## Hvad der holder (prøvet på at få det til at gå galt)

- **Appen lukket i samme øjeblik som "Godkendt"**: sættet lå i køen og blev sendt
  (`kaelder`).
- **5 sæt, genåbning uden net og så online**: squat `[1,1,1,1]` og bænk `[1,0]`. Alle
  rækker har tiden fra "Godkendt" (`kaelder`).
- **Hængende wifi**: markering efter 8,3 s, sendt efter 19 s, `[1,1,1,0]` (`haenger`).
- **To faner uden net, der logger samme sæt**: samme række-id fra den delte kø, ingen
  dublet (`to-faner`).
- **Ny service worker og ny build med sæt i køen**: én genindlæsning, ingen dublet,
  intet tab (`sw-opdatering`).
- **Skift atlet**: B så intet af A's sæt og sendte dem ikke. A's sæt blev sendt, da A
  loggede ind igen (`skift-atlet`).

## Verificering

`npm run verify:kritik-403` kører de ni scenarier igen og holder resultatet op mod
denne side. Grøn betyder to ting. Invarianterne holder: intet sæt tabt, og ingen
dublet, uden at atleten selv trykker igen. Og O1, O2, O3 og O5 kan stadig genskabes.
Er et fund rettet, fejler verify med "O1 genskabes ikke længere". Så skal denne side
opdateres, og det er meningen.

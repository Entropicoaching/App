# Ordre 403, blok 1: atleten i kælderen

Alt er kørt headless i Chromium, 390x844 (mobil, DSF 2), mod e2e-mocken. Appen er
bygget fra `main` (397 og 401 merget), og service workeren er med som i prod. Der er
ingen kald mod prod. Seed: e2e-fixturen med en ekstra øvelse (Bænkpres, 2 sæt), så
der kan logges 5 sæt. I `skift-atlet` er der en fiktiv atlet B.

Script: `outputs/kritik-403/scenarier.mjs`. Tal pr. scenarie ligger i
`outputs/kritik-403/resultat-<navn>.json` og skærmbilleder i `outputs/kritik-403/<navn>/`.

## Hvad atleten ser, scenarie for scenarie

| Scenarie | Hvad der skete | Rækker i mocken | Dom |
|---|---|---|---|
| **kaelder**: åbnet uden net, 3 sæt, appen lukket midt i sæt 4, genåbnet, sæt 5, online | Åbnede på 0,85 s. Sæt 4 overlevede, at appen blev lukket samme øjeblik, som der blev trykket. Efter genåbning stod der "Baenkpres Sæt 1/2" og "4 sæt gemt lokalt". Da nettet kom, var køen sendt efter 23,7 s. | squat [1,1,1,1], bænk [1,0], alle med tiden fra "Godkendt" | **Holder** |
| **online-start**: åbnet med net, sæt 1, genåbnet med net, sæt 2, nettet væk, sæt 3, nettet tilbage | Køen blev sendt rigtigt. Derefter viste Dagens pas **"Sæt 1/4"**, som om intet var logget. Atleten trykker "Godkendt" igen, og sæt 1 står nu **to gange**. | [1,1,1,0], efter nyt tryk **[2,1,1,0]** | **O1** |
| **aabn-med-net**: 3 sæt uden net, appen lukket, åbnet igen hjemme med net | Sendt rigtigt, men Dagens pas viser **"Sæt 1/4"** og viser det stadig 28 s senere. Et nyt tryk laver ingen dublet her, fordi id'et stadig er i hukommelsen, men **sæt 1 får ny tid**, 30 s efter kældertiden. | [1,1,1,0] | **O1** |
| **haenger**: wifi uden internet, derefter virker nettet igen uden 'online' | Sæt 2 blev markeret efter 8,3 s og sendt efter 19 s. Dagens pas viste det rigtige sæt (4/4), fordi 20-s-runden kom først. | [1,1,1,0] | Holder (heldigt, se O1) |
| **to-faner**: to faner, begge uden net, A logger sæt 1+2, B logger "sæt 1" | B brugte samme række-id fra den delte kø, så der kom ingen dublet. Efter afsendelsen viste **begge faner "Sæt 1/4"**. | [1,1,0,0] | Holder for data, O1 i visningen |
| **log-ud**: 2 sæt i køen, log ud uden net | Spørgsmålet var "Log ud af Entropi? Du skal logge ind igen for at fortsætte." Der står **intet om de 2 usendte sæt**. Derefter kommer login-skærmen uden net, og atleten kan ikke komme ind igen. Køen ligger stadig på telefonen og blev sendt ved næste login med net, men så viste Dagens pas "Sæt 1/4". | [1,1,0,0] | **O3**, plus O1 |
| **skift-atlet**: A har 2 sæt i køen, logger ud, B logger ind | B så intet af A's sæt, og A's sæt blev ikke sendt under B's login. De blev sendt, da A loggede ind igen. | A [1,1,0,0], B 0 | Holder, men se O3 (logger A aldrig ind igen på den telefon, sendes sættene aldrig) |
| **sw-opdatering**: ny sw.js og version.json, mens 2 sæt ligger i køen | Siden genindlæste én gang. Køen blev sendt uden dubletter, men bagefter viste Dagens pas "Sæt 1/4". | [1,1,0,0] | Holder for data, O1 i visningen |
| **forkert-ur**: telefonens ur 7 dage bagud | Sættene står i mocken med `logged_at` 7 dage tilbage, altså i sidste uge hos coachen. | [1,1] | **O5** |

## Er teksterne til at forstå?

- "Ingen forbindelse. Dagens pas og dine sæt virker; resten opdateres, når du har
  net." er rolig og præcis. "Program fra kl. 15.09" er kryptisk. Atleten kan ikke
  vide, at det betyder "sidst hentet kl. 15.09". Forslag: "Programmet er fra
  kl. 15.09".
- "☁ 5 sæt gemt lokalt — sendes når forbindelsen er tilbage" og "· ☁ 1 sendes når du
  har net" er forståelige. De bruger to ord for det samme ("forbindelse" og "net").
  Det er småt, men ét ord ville være roligere.
- På hængende wifi står der "Forbindelsen er svag." Det passer.
- **Ingen tekst forklarer "Sæt 1/4" efter afsendelsen.** Atleten ser et pas, der er
  startet forfra, uden hint om, at sættene faktisk er gemt. Det er den farligste
  skærm i hele forløbet (O1).
- **Log ud nævner ikke usendte sæt** (O3). Login-skærmen uden net siger ikke, at der
  er ingen forbindelse. Atleten kan kun prøve og få en fejl.

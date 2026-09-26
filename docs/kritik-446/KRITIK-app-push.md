# KRITIK: appen før Marcs push (397–439 samlet)

Main `dd68c77` (397–439 merget, ikke pushet), målt som atlet i kælderen og som coach på telefonen. Målingerne står i
`ATLET-446.md` og `COACH-446.md`, og tallene i `outputs/kritik-446/`. Alt er kørt headless mod e2e-mocken med
syntetiske brugere. Atleten er på en ældre telefon (Slow 4G, 4× CPU, 390 px).

## Fund

**A1. Tomt vægtfelt efter genåbning uden net giver 0 kg-sæt** (alvorlig)
- Hvad sker der: atleten lukker appen i kælderen og åbner den igen uden net. På øvelser uden "Anbefalet" står
  vægtfeltet så tomt ("kg"), selvom kortet selv skriver "senest 25kg × 10". Godkendt gemmer 0 kg.
- Målt: 5 af 38 sæt i ugen (Rows 2–3, Triceps 1–3).
- Konsekvens: coachen ser "0kg × 10" med grøn bjælke, tonnagen i "din uge" er forkert, og Fremgang ser ikke
  sættene.
- Årsag: forudfyldningen (`DagensPasCard.jsx`, `lastHeaviestSet(exerciseHistory…)`) bruger kun historikken fra
  serveren, og den gemmes ikke på telefonen. Ugens egne sæt i køen, som kortet viser som "senest", bruges ikke.
  Godkendt tager også imod et tomt felt.

**A2. "Spring over" virker ikke uden net** (alvorlig)
- Hvad sker der: kortet bliver stående på sættet med en kort fejlbesked ("Sættet kunne ikke springes over").
  Atleten kommer kun videre ved at godkende et sæt, der ikke blev lavet.
- Konsekvens: coachen ser det som lavet ("10/10 sæt"). Et sæt, der springes over på grund af smerte, er netop det,
  433 gjorde synligt for coachen.
- Årsag: `skipSet` (og `skipExercise`) skriver direkte med `runGuardedWrite` og går ikke gennem offline-køen, som
  Godkendt gør.

**A3. Vurderingen af passet går tabt uden net** (middel)
- Hvad sker der: "Hvordan gik det? 1–5" giver "Feedbacken blev ikke gemt". Linjen bliver stående, men efter en
  genåbning er den væk.
- Målt: pas 1 og 2 fik aldrig en vurdering. "din uge" viser "–", og coachens ★ bygger kun på pas 4.
- Årsag: `saveFeedback` har ingen kø, og spørgsmålet findes kun i hukommelsen (`lastLoggedSet`).

**A4. Falsk rekord, når den gamle top ligger uden for de hentede rækker** (alvorlig, afhænger af prod)
- Hvad sker der: 439 regner "bedst før" ud fra de nyeste 4000 sæt. Ligger atletens top længere tilbage, fejres
  et almindeligt sæt: "Ny rekord: Squat e1RM 117 kg" mod en gammel 128. Det sker på kortet, i "din uge" og i
  Fremgang.
- Målt: med en top 130 uger tilbage (over 4000 sæt) fejres det falsk. Med en top 60 uger tilbage fejres intet,
  men med Supabases standardloft "Max rows" på 1000 fejres det falsk igen.
- Konsekvens: står prod på 1000, rammer det enhver atlet med mere end ca. 7 måneders historik (ca. 33 vægtsæt om
  ugen), hvis toppen er ældre end det, fx efter en skade eller et deload.
- Prod's indstilling er ikke læst.

**A5. `personal_records` passer ikke med rekorderne** (middel)
- Rekorder sat uden net kommer aldrig i tabellen: den gamle PR-registrering kører kun, når serveren svarer i samme
  tryk, ikke når køen sender.
- Med net giver den dubletter, når næste sæt logges, før registreringen er færdig. Målt: 72,5 × 6 står 2–3 gange,
  og 95 × 6, 85 × 4 og 140 × 3 står 2 gange hver.
- Konsekvens: coachens PR-tidslinje mangler kælderens bænkpres-rekorder og viser dubletterne, mens atleten ser 7
  rigtige rekorder i Fremgang. Det samme gælder "Dine rekorder" bag "Mere" (439's egen grænse).

**A6. Dobbelttryk på "Kopiér seneste uge" giver to uger** (middel)
- Målt: på telefonen (250 ms mellem trykkene) blev der oprettet to "uge 132" med samme startdato, hver med 4 pas og
  12 øvelser. Kopien tog 7,9 s.
- Årsag: `copyWeek` har ingen spærre, mens den kører.
- Ét tryk på 1280 giver én uge, som det skal.

**A7. Coachens telefon siger "0 af 4 pas · Ingen logs" i ca. 5 s** (lav)
- Målt: efter login på den droslede telefon står atleten som "Ingen logs" fra 3,8 s til 8,7 s, før den skifter til
  "4 af 4 pas · I dag".
- En coach, der kigger hurtigt, får et forkert svar i stedet for "henter".

**A8. Coachen ser UTC-datoen** (lav)
- Log ("2026-09-26") og PR-tidslinjen ("26 sep 2026") bruger `logged_at.slice(0, 10)`. Sæt logget mellem 00.00 og
  02.00 dansk sommertid står derfor på dagen før.
- Atleten ser "27. sep" i Fremgang. Det sker kun ved træning efter midnat.

**A9. Tung historik gør Dagens pas ca. 2 s langsommere** (lav til middel)
- Målt, median af 3 åbninger med 4940 sæt i historikken: brugbart efter 3,3 s før 439 og 5,3 s efter.
- Historik-kaldet er 623 kB ved hver åbning og færdigt efter 7,7 s. Samlet hentes 1,4 MB mod 0,77 MB før.
- Med let historik (114 sæt) er der ingen forskel.
- Logges første sæt, før grundlaget er hentet (ca. 2,6 s efter brugbart), fejres en rekord ikke.

## Det, der holder

- **Intet sæt tabt og ingen dubletter:** 38/38 sæt, også når appen lukkes uden net og igen midt i afsendelsen.
- **Rigtig tid:** alle sæt har tiden fra "Godkendt" (0,0–0,2 s), også de 17, der blev sendt senere.
- **Rekorder:** hver rekord fejres én gang, også uden net og hen over genåbninger. Fremgang og "din uge" viser dem
  én gang hver.
- RPE og noter fra kælderen når frem.
- Genåbnet uden net står Dagens pas på rigtigt sæt uden login-skærm.
- Én video-kvittering.
- Coachens Log viser et sprunget sæt (med net) ærligt, og hvert sæt står én gang.
- "Kræver dit blik" viser atletens ugelinje og videoen.

klar til push: nej, fordi kælderen, som er det, pushet lover atleterne, stadig giver stille forkerte data hos coachen (A1: 0 kg-sæt, A2: et sprunget sæt står som lavet, A3: vurderinger forsvinder), og fordi 439's rekordfejring kan være falsk for atleter med lang historik (A4), så længe prod's "Max rows" ikke er tjekket. A1–A3 er små rettelser i få filer (saetSkrivning.js, DagensPasCard.jsx); resten kan vente til efter pushet.

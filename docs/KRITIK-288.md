# Kritik af app-main før push (ordre 292, om ordre 288)

Kritiker: Bhishak. Grundlag: `main` = `e4ecc56` (280, 281, 284, 285 samlet). Intet er rettet. Alt er kørt headless (Chromium) mod den lokale mock og ubuildet vite, på 390×844 og 360×780 med touch, CPU både normal og 4× langsommere. Skærmbilleder ligger i `outputs/kritik-288/` (filnavnene står ved hvert fund). Data er fiktive.

## Anbefaling: push ikke endnu, fordi én fejl er sikker og én er uafklaret

1. **Sikker fejl (bloker):** i Dagens pas starter plus/minus på reps fra 0 fra sæt 2 og frem. Ét tryk på "1 rep mere" i sæt 2 viser 1, ikke 5; "1 rep mindre" viser 0. Det er præcis den knap 280 er bygget om. Marc rammer den inden for et minut på telefonen. Rettelsen er en enkelt linje (se F1).
2. **Uafklaret (bloker, hvis den holder):** Fremgang henter al historik med `.limit(4000)` sorteret stigende (F2). Hvis Supabase-projektets "Max rows" står på standarden 1000, mister en atlet med mere end 1000 sæt sine NYESTE sæt, og kurven ender i fortiden. Fremgang er bygget til at vise måneder tilbage, så det er netop de atleter med mest historik der rammes. Det tager ét kig i Supabase at afgøre (Project Settings → API → Max rows). Mocken håndhæver ingen grænse, så jeg kan ikke se det herfra.

Resten af fundene (F3–F14) kan rettes efter push. Coach-siden (281 og 285) holdt i alle prøver: ingen fund der bør stoppe push.

Marcs to-minutters tjek på telefonen, efter push eller før: (a) log sæt 1 med "Godkendt", tryk så "+" ved reps i sæt 2, og se om der står 5 eller 1; (b) åbn Fremgang på din egen konto og se om Squat-kurven ender i dag eller i sommer.

## Fund, sorteret efter alvor

Alvor: **bloker push** / **ret efter push** / **kosmetisk**.

### Bloker push

**F1. Reps-knapperne starter fra 0 fra sæt 2 og frem** (280). Bloker push.
- Hvad: sæt 1 er fint (4 → 3 → 5). I sæt 2, 3 og 4 viser feltet 4 (ordinationens nederste tal), men et tryk på "1 rep mere" giver 1 og "1 rep mindre" giver 0. Trykker atleten så "Godkendt", logges 0 eller 1 rep. Målt ved 360 og 390, se linje "efter ÉT tryk … reps = 1 (forventet 5)" i kørslen.
- Skærmbillede: `atlet-390-05-plusminus.png` (reps står på 0 efter et tryk på minus), `atlet-360-14-saet-raekke-brudt.png`.
- Mistænkt fil: `src/AthleteView.jsx:331` (`stepRepsBy`): `stepReps(p[key]?.reps ?? repsValue, delta)`. `??` fanger kun null/undefined. `nextAthleteSetInput` (`src/athleteTrainingInputs.js:17-27`) sætter bevidst `reps: ''` på næste sæt, så `p[key].reps` er tom streng, `??` vælger den, og `stepReps('')` starter på 0. Feltet viser 4 fra `repsDefault`, men trinnet læser aldrig det. `||` i stedet for `??` ville rette det.
- Hvorfor prøverne ikke fangede den: `setLogDefaults.test.js` tester `stepReps` alene; fejlen sidder i kaldstedet, og `dagens-pas.spec.mjs` bruger ingen reps-knapper.

**F2. Fremgang kan miste de nyeste sæt** (284). Bloker push, hvis Max rows er lav. Ikke testet, kode-mistanke.
- Hvad: `fetchFremgangLogs` henter uden datogrænse, `.order('logged_at', { ascending: true }).limit(4000)`. Når grænsen (eller Supabases egen max-rows, standard 1000) rammes, er det de ældste rækker der bliver, og de nyeste falder væk uden fejl. Kurven stopper så på den sidste uge inden for de første N sæt. Én aktiv atlet logger groft 80–100 sæt om ugen, så 1000 nås på 10–12 uger.
- Mistænkt fil: `src/AthleteView.jsx:1716-1731` (grænsen står på linje 1726).
- Mocken har ingen række-grænse, så ingen prøve kan se det. Den tilsvarende tonnage-hentning (linje 1970) har en datogrænse på 84 dage og er ikke ramt.
- Afklaring: Marc slår Max rows op. Er den ≥ atletens antal sæt (eller sat op), er fundet lukket. Ellers skal hentningen sorteres faldende (og vendes bagefter) eller pagineres.

### Ret efter push

**F3. Første øvelse forudfyldes med planen, ikke med "sidste gang"** (280, blok 1). Ret efter push (høj).
- Hvad: kortet viser "Sidste gang: 95kg × 5" og "Anbefalet: 80kg", men vægtfeltet står på 80 og reps på 4 (også efter 2,5 sekunder). Anden øvelse (Bænkpres) forudfyldes rigtigt med sidste gang, 67,5 kg. 280-rapporten siger at sidste gang vinder; det gælder kun de øvelser der åbnes efter at historikken er hentet.
- Skærmbillede: `atlet-390-02-dagens-pas.png` (øverst: hint 95, felt 80), `atlet-390-06-squat-faerdig.png` (Bænkpres: hint 67,5, felt 67,5).
- Mistænkt fil: `src/AthleteView.jsx:246-264`. Effekten kører kun når `[øvelse-id, sætnummer]` skifter, og på første åbning er `exerciseHistory` endnu ikke hentet, så `lastHeaviestSet` giver null. Den kører aldrig igen, når historikken ankommer.
- Hvorfor prøven ikke fangede den: `dagens-pas.spec.mjs` har ingen historik i sin seed.

**F4. Vægt- og reps-rækken brydes over to linjer** (280). Ret efter push (høj, det er første skærm efter login).
- Hvad: rækken er `[−][80][+] × [−][reps][+] [RPE]` i en flex-række med `flexWrap: 'wrap'`, ca. 460 px bred i en ca. 314 px bred kortflade. Ved både 390 og 360 står `×` og reps-"−" sidst på linje 1, mens reps-feltet og reps-"+" står på linje 2. Reps-knapperne er skilt fra deres felt, og `×` hænger.
- Skærmbillede: `atlet-390-05-plusminus.png`, `atlet-360-14-saet-raekke-brudt.png` (geometri ved 360: reps-"−" x=263,y=363; reps-felt x=38,y=423).
- Mistænkt fil: `src/AthleteView.jsx:360-410`.

**F5. Et sæt "Godkendt" uden net er ikke gemt lokalt før efter ca. 4 sekunder** (280, blok 4). Ret efter push.
- Hvad: køen i `localStorage` skrives først efter at `queueWrite` har brugt alle fire forsøg (målt: "gemt lokalt" dukker op efter 3,7 s, mod en mock der afviser med det samme; mod et rigtigt, dårligt net med 12 s timeout pr. forsøg bliver vinduet længere). Lukkes fanen i vinduet, er sættet væk: jeg trykkede "Godkendt" offline, lukkede fanen efter 1 s, åbnede appen online igen: mocken havde 1 række (ikke 2), køen var tom, og passet stod på "Sæt 2/4" igen. Atleten havde set bekræftelsen og pausen. Sættet er altså ikke "aldrig tabt", som 280 påstår.
- Skærmbillede: `atlet-390-13-efter-kill-genaabning.png`.
- Mistænkt fil: `src/AthleteView.jsx:2256-2266` (`saveOfflineSet` kaldes først i fejlgrenen). Skriv til køen FØR skrivningen, fjern den ved succes.
- Grænse: jeg lukkede fanen med `page.close()`. En rigtig telefon sætter oftere appen på pause end dræber den; hvor tit et OS dræber en baggrundsfane midt i de 4 sekunder, har jeg ikke målt.

**F6. Fremgang-grafen: label klippet i kanten og skrift på 5–6 px** (284). Ret efter push.
- Hvad: labelen "94 kg e1RM" ender som "94 kg e1"; med tre cifre ("158 kg e1RM", som de fleste squats vil give) ender den som "158 kg e" (målt: 11 viewBox-enheder uden for tegningen). Selve tallet ses, "e1RM" gør ikke. Ugelabels og "135×5" er 5,5 px ved 390 og 5,0 px ved 360 (viewBox 400 skaleret 0,79 / 0,71), altså ulæselige.
- Skærmbilleder: `atlet-390-09-fremgang-squat.png`, `probe-360-15-fremgang-3-cifret.png`.
- Mistænkt fil: `src/athlete/FremgangTab.jsx:57-83` (`PR = 46`, `fontSize` 7 og 8).

**F7. Trykflader under 44 px i nye flader** (280, 284). Ret efter push.
- Fremgang: øvelsesknapperne Squat/Bænk/Dødløft er 29 px høje, variantknapperne (Squat/Frontsquat) 22 px høje, øvelsesvælgeren 38 px. Pause-linjens luk-kryds er 32×32 (280). Coach: sorteringsknappen "Navn" er 38 px bred (281; høj nok).
- Ikke fra disse ordrer, men set: "Denne uge/Sidste uge/Hele forløbet" 29 px, "kg"-feltet og "Log" i Forsiden 36/27 px, dagsknapperne i ugestrimlen 42×53 ved 360, "✎" i coachens periodisering 15 px bred.
- Skærmbillede: `atlet-390-09-fremgang-squat.png`.
- Mistænkt fil: `src/athlete/FremgangTab.jsx:146-174`, `src/AthleteView.jsx:502` (`aria-label="Skjul pausetimer"`).

**F8. Pause-linjen sidder fast 54 px over bunden, men navigationen er højere** (280, med 284's syvende fane). Ret efter push.
- Hvad: navigationen er 59 px høj (ved 360×780, normal tekst), pause-linjen har `bottom: 54px`, så de nederste 5 px af pause-linjen ligger under navigationen. Ved 125 % tekststørrelse 13 px, ved 150 % 24 px: "89s" skæres over og navigationens labels flyder sammen ("PROGRAMVOLUMENFREMGANG"). Syv faner giver 51 px pr. fane ved 360.
- Skærmbilleder: `atlet-360-21-stor-tekst-16px.png`, `…-20px.png`, `…-24px.png`.
- Mistænkt fil: `src/AthleteView.jsx:489`. Sidder navigationen bagved, er kun store-tekst-brugere ramt hårdt; 5 px er der altid.

### Kosmetisk

**F9. Coach: forældet rulleposition efter at have forladt Forside via bundnavigationen** (285). Kosmetisk.
- Hvad: efter at have været inde på en atlet fra rulleposition 900 og tilbage (holder: 900 → 900), forlod jeg Forside via "Coach Briefing" og kom tilbage via "Forside". Listen står på 900 i stedet for øverst, så "Kræver dit blik" og toppen er ude af syne. Effekten ruller til den gemte position ved ETHVERT skift til `view === 'list'`, ikke kun ved "Tilbage til atleter".
- Skærmbillede: `coach-probe-390-02-forside-efter-briefing.png`.
- Mistænkt fil: `src/Dashboard.jsx:457-459`. 285-prøven dækker kun ind/ud af en atlet.

**F10. Coach: sorteringsknapper vises selv uden atleter.** Kosmetisk. `probe-390-19-coach-ingen-atleter.png` ("0 aktive", "Navn/Afvigelse denne uge", "Ingen aktive atleter"). Ikke forkert, men rodet for en ny coach.

**F11. Coach: afvigelseslinjen bryder med et hængende "·".** Kosmetisk. "Planlagt 20 sæt · 2000 kg — gennemført 0 sæt · 0 kg ·" og så "Ingen logs" på næste linje (`coach-tredive-390-03-sorteret-30.png`). Lange navne (2 af 30 i prøven) afkortes med "…" som tiltænkt.

**F12. "Ny personlig rekord"-toasten dækker headerens Konto-knap** i nogle sekunder (`atlet-390-06-squat-faerdig.png`). Kosmetisk, forbigående.

**F13. Fremgang viser "SQUAT" to gange** (én hovedknap og én variantknap) når en variant findes (`atlet-390-09-fremgang-squat.png`). Kosmetisk, men kan læses som en fejl.

**F14. Konsollen:** ingen sidefejl i nogen prøve. Kun `ERR_INTERNET_DISCONNECTED` fra min egen offline-prøve. Ikke et fund, kun noteret.

## Hvad holdt (målt, ikke gættet)

- Ingen vandret overflow i nogen af de 48 skærmbilleds-tjek ved 390 eller 360. Bundfrihøjde over de faste bjælker mindst 55 px ved sidens bund.
- Coach (281, 285): sortering efter afvigelse holder efter ind/ud på tre atleter; med 30 atleter holder rulleposition (700 → 700, 800 → 800, og 2132 → 2132 i den udvidede liste "Vis alle 30"), sortering og udvidet tilstand. "Uden plan" står nederst. Længste navn afkortes pænt.
- Hastighed (mock, headless, dobbelt-rAF-måling, så gulvet er ca. 30 ms): "Godkendt" til næste sæt plus pause 30 ms; sortér 30 atleter 27–31 ms; ind/ud på atlet 28–44 ms, også ved 4× CPU-drosling; ingen long tasks. Fremgang åbnes på 330 ms, uændret ved 4×, dvs. ikke CPU-bundet (lazy-chunk plus hentning). Atletprofilen er fuldt indlæst efter 372 ms med to kald (`weeks`, `exercise_logs`).
- Tomme tilstande: atlet med program men uden logs ("Ingen logninger endnu.", Squat valgt), atlet uden program (samme tekst), øvelse uden logs via vælgeren, coach med 0 og 1 atlet. Ingen ser forkerte ud.
- Reps-trin i sæt 1, vægttrin i alle sæt, "Fortryd", pausen, og at "Godkendt" uden net til sidst leverer sættet, når nettet er tilbage (køen tømmes).

## Hvad jeg IKKE kunne teste

- Rigtig telefon: iOS Safari, PWA-tilstand, sikkerhedsområde nederst (athlete-navigationen har ingen `env(safe-area-inset-bottom)`, coachens har; `viewport-fit=cover` findes ikke i `index.html`), tastaturet der åbner og skubber layoutet, sollys, handsker. Kun Chromium; ingen WebKit.
- Produktion: Supabase Max rows (F2), rigtige datamængder, rigtig latens. Mocken svarer på millisekunder, så F5's vindue og Fremgangs 330 ms er nedre grænser.
- Rigtige atleter med lange historikker (og dermed F2), atleter med flere pas samme dag, beskeder/videoer/badges i coachens rækker (seeden har kun planer og logs).
- Coach på iPad og desktop (ordren bad om telefonprofil), VideoCoach, check-in og Volumen (uden for denne ordre).
- Skærmlæser og tilgængelighedsgennemgang ud over trykflader og tekststørrelse.
- Tastefejl fra rigtige tommelfingre: "Godkendt" ved en fejl, dobbelttryk, hurtige tryk under 4× CPU.

Mit værktøj: overlap- og trykflade-tjek kørt som ét script i scratchpad (ikke committet, jf. ordren). Overlap-tjekket gav i første omgang mange falske alarmer (indhold der ruller ind under faste bjælker); jeg har kun medtaget fund jeg har set på skærmbillede eller målt direkte.

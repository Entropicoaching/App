**main kan pushes: ja**

# Rapport — ordre 293: Bhishaks blokerende fund rettet, så app-main kan pushes (tre blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Det Marc mærker på telefonen efter push

1. **Reps-knapperne** i Dagens pas starter nu fra det tal feltet viser, også i sæt 2, 3 og 4. Sæt 2 viser 4, ét tryk på "1 rep mere" giver 5, ikke 1.
2. **Første øvelse** står på "sidste gang" (fx 95 kg × 5), så snart historikken er hentet, i stedet for at hænge på planens 80/4. Har man allerede trykket plus/minus eller tastet, bliver det stående.
3. **"Godkendt" uden net:** sættet ligger i den lokale kø med det samme, ikke først efter ca. 4 sekunder. Lukkes eller dræbes appen lige efter tryk, er sættet der, når appen åbnes igen (præcis én gang).
4. **Fremgang** viser altid de nyeste sæt. En atlet med mere historik end Supabases række-grænse mister de ældste uger, ikke de nyeste.

## Gren

Gren `kritik-rettet-293`, forgrenet fra `main` (`33230af`).

- `29a7d3d` blok 1: F1 (reps-trin) og F2 (Fremgang henter faldende)
- `6f2294c` blok 2: F3 (forudfyldning når historikken ankommer) og F5 (kø før skrivning)
- denne commit: `proever.mjs` får den nye prøve som nr. 11, og denne rapport (blok 3)

Arbejdstræet er rent. Ingen push, ingen migration, ingen ny tabel, ingen ny afhængighed, ingen atletdata, ingen skrivning mod Supabase. `Dashboard.jsx` og coach-e2e er ikke rørt.

## Hvad ændret

**F1 (`AthleteView.jsx`, `setLogDefaults.js`).** `stepRepsBy` brugte `??`, som ikke fanger tom streng, så et sæt 2+ hvor state står på `''` (bevidst, se `nextAthleteSetInput`) startede trinnet fra 0. Kaldstedet er trukket ud som `stepRepsInInputs(inputs, key, shownInput, shownReps, delta)`; tomt falder tilbage på det tal feltet viser. Testen står på kaldstedet (sæt 2 bygget med `nextAthleteSetInput`, ét tryk plus giver ordinationens tal + 1), ikke kun på `stepReps`.

**F2 (`src/fremgangLogs.js`, nyt).** Forespørgslen henter nu `ascending: false` med den samme grænse (4000), og listen vendes bagefter, så Fremgang får den samme kronologiske rækkefølge som før. Ingen paginering og ingen ny datogrænse. En falsk klient i testen opfører sig som PostgREST med "Max rows" og viser: rammes grænsen, falder de ældste sæt væk, de nyeste er med, og kurven (`heaviestSetPerWeek`) er uændret for alle under grænsen.

**F3 (`AthleteView.jsx`, `setLogDefaults.js`).** Forudfyldnings-effekten i Dagens pas kører nu også, når `exerciseHistory` er hentet. Beslutningen er en ren funktion, `autoFillSetInput`: et felt atleten har trykket eller tastet i (`touchedRef`) røres aldrig, heller ikke hvis atleten har tømt det igen; et felt der stadig står præcis som effektens egen tidligere forudfyldning (`autoFilledRef`) byttes ud (planens tal → sidste gang); alt andet (fx tastet i Program-fanen) bliver stående. Note og RPE bevares.

**F5 (`AthleteView.jsx`).** `logSet` med `localFallback` (Dagens pas' "Godkendt") lægger sættet i køen lige FØR `persistSetLog`, og succes fjerner det igen (som før). Tælleren "☁ N sæt gemt lokalt" røres stadig først ved en fejlet skrivning, så linjen ikke blinker ved hver vellykket skrivning. Én følge af at køen nu står før skrivningen: en post kan høre til et sæt serveren allerede har taget imod (appen døde, før svaret kom tilbage). `flushOfflineSets` slår derfor rækken op på (atlet, øvelse, sætnummer) før genafspilning, så den bliver en UPDATE og ikke en dublet; kan opslaget ikke gennemføres, ligger posten i køen til næste forsøg.

**Prøver.**
- `setLogDefaults.test.js` (+10), `fremgangLogs.test.js` (ny, 5).
- `dagens-pas.spec.mjs`: F1-trin i sæt 2 (plus, minus, minus, plus i den ægte app). F5: skrivningen holdes tilbage i browseren, køen læses fra `localStorage` straks efter tryk (må ikke være tom, mocken må endnu ikke have rækken, "gemt lokalt" må ikke vises), slippes, og køen skal være tom igen. Derefter en dræbt fane: net væk, "Godkendt", fanen lukkes efter 1 s, appen åbnes igen i samme kontekst, og sæt 3 ligger i mocken præcis én gang og køen er tom.
- `dagens-pas-historik.spec.mjs` (ny, `npm run e2e:dagens-pas-historik`, prøve nr. 11 i `proever.mjs`): historik-hentningen holdes tilbage, så feltet først står på 80/4 og derefter går til 95/5; et felt der er trykket (82,5/5) eller tastet (70) før historikken kommer, bliver stående.
- Hver ny e2e-prøve blev kørt mod den gamle kode og fejlede: F1 `'1' !== '5'`, F3 timeout på at vente på 95, F5 "sæt 1 skal ligge i den lokale kø med det samme". Derefter grønne mod rettelsen.

## Testresultat

- `npm run lint`: ren. `npm run build`: grøn.
- Enhedstests (`node --test` pr. fil, alle 32 `*.test.js` under `src/` og `public/`): 354 af 354 grønne.
- Én ubrudt `npm run proever`, port 8991 tjekket først (ingen lyttende proces, kun TIME_WAIT): **80 af 80 grønne** (0 fejl, 0 sprunget over). Det er 32 enhedstestfiler, 37 `verify:*` og 11 e2e, herunder `dagens-pas.spec.mjs` (nu med F1 og F5), `dagens-pas-historik.spec.mjs`, `fremgang.spec.mjs`, `atlet-uge.spec.mjs`, `coach-afvigelse.spec.mjs` og `coach-mandagsrunden.spec.mjs`. Ingen "kendt fejl".
- `verify:ugen-faar-dato` overskrev igen tre sporede skærmbilleder i `outputs/ugen-faar-dato/`; jeg gendannede dem med `git checkout`, så de ikke er med i grenen.

## Hvad er næste

- **F1: rettet.** Reps-trinnet starter fra det viste tal; kaldstedet er testet og e2e-målt i sæt 2.
- **F2: rettet.** Hentningen er faldende og vendt, så en grænse koster de ældste sæt, ikke de nyeste; testet mod en simuleret Max rows. Om Supabase-projektets Max rows faktisk er 1000 har jeg ikke set (ingen adgang til produktion), men det afgør ikke længere, om de nyeste sæt er med.
- **F3: rettet.** Første øvelse skifter fra planens tal til "sidste gang", når historikken ankommer, og røres aldrig, hvis atleten har trykket eller tastet.
- **F5: rettet.** Sættet ligger i køen før skrivningen; vinduet på ca. 4 sekunder er væk; dublet-risikoen ved genafspilning er lukket med et opslag først.
- Bhishaks F4 og F6–F13 er ikke rørt i denne ordre.
- Dhruva merger, Marc pusher (push = deploy). Efter push: prøv de fire ting øverst på en rigtig telefon mod produktion.

For Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): de to fund, Marc ville ramme inden for et minut på telefonen (reps-knapperne) og den uafklarede risiko for at Fremgang ender i fortiden, er rettet og bevist headless. Det fjerner den sidste grund til at holde 280/281/284/285 uden for live.

## Ærlige grænser

- **F2 flytter, hvad der falder væk, men fjerner ikke grænsen.** Har en atlet flere sæt end Supabases "Max rows" (standard 1000), viser Fremgang de nyeste 1000, og de ældste uger mangler i kurven uden en besked. Det var ordrens valg (ingen paginering, ingen ny datogrænse). Det er ca. 10–12 ugers logning for en meget aktiv atlet, ikke måneder.
- **F5: "straks" er målt i browseren, ikke på en telefon.** Køen læses fra `localStorage` umiddelbart efter tryk, og fanen dræbes med `page.close()`. Hvor tit et rigtigt OS afbryder appen midt i en skrivning, og om `localStorage` når disken i det sekund, har jeg ikke målt. Kan `localStorage` slet ikke skrives (privat vindue, fuld lager), er der som før ingen kø, og sættet er kun beskyttet af selve genforsøgene.
- **F5: dublet-beskyttelsen er kun målt for det ene tilfælde**, hvor skrivningen aldrig nåede serveren (afvist forbindelse). Tilfældet "serveren tog imod, svaret gik tabt, fanen døde" er dækket af opslaget i `flushOfflineSets`, men ikke fanget af en prøve, fordi mocken ikke kan tabe et svar efter at have gemt. Køen flusher stadig kun ved app-åbning og `online`-eventet (som før).
- **F3: `touchedRef` husker et trykket sæt, så længe Dagens pas-kortet lever.** Trykker man plus og minus tilbage til det samme tal, regnes feltet stadig som rørt og får ikke sidste-gang-værdien. Det er valgt frem for at risikere at overskrive noget atleten har gjort.
- **Kun de fire fund.** Bhishaks F4 (vægt/reps-rækken brydes), F6–F8 og resten er urørt. F4 er stadig "ret efter push (høj)".
- Alt er kørt headless mod mock-Supabase og lokal vite, ikke på en rigtig telefon og ikke mod produktion.

main kan pushes: ja

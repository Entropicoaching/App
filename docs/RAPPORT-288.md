**main kan pushes: ja**

# Rapport — ordre 288: app-main samlet og klar til Marcs push (tre blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Det Marc ser på telefonen efter push

1. **Atlet, sæt uden tastatur:** i Dagens pas står næste sæts vægt og reps allerede udfyldt (sidste gang, ellers planen); store plus/minus-knapper justerer (2,5 kg / 1 rep), og ét tryk på "Godkendt" gemmer sættet og starter pausen. Ingen tastatur, ingen bekræftelse.
2. **Atlet, sæt uden net:** mister telefonen forbindelsen midt i et sæt, står der "☁ N sæt gemt lokalt — sendes når forbindelsen er tilbage", og sættet sendes selv, når appen åbnes igen eller nettet vender tilbage.
3. **Atlet, fremgang på en øvelse:** ny fane "Fremgang". Squat, bænk og dødløft står som ét-tryks-knapper øverst; man ser tungeste sæt pr. uge og det beregnede e1RM som kurve. Varianter (fx frontsquat) får deres egen kurve og blandes ikke med hovedløftet. En øvelse uden logninger siger "Ingen logninger endnu."
4. **Coach, afvigelsen øverst:** atletlisten kan sorteres på "Afvigelse denne uge": størst afvigelse øverst, atleter uden plan samlet nederst. Grå/grøn, ingen rød og ingen tal.
5. **Coach, mandagsrunden:** gå ind på en atlet fra listen og tilbage, og både sorteringen og rullepositionen står, som du forlod dem, også med 30 atleter.

## Gren

Gren `app-samlet-21sep`, forgrenet fra `main` (`4fb7487`, 280 og 281 merget af Dhruva 21. sep). `main` er forfader til grenen, så Dhruva kan fast-forwarde.

- `edcf5f6` merge af `fremgang-paa-oevelsen` (ordre 284), blok 1
- `5cae478` merge af `mandagsrunden` (ordre 285), blok 1
- `ca89a44` test: `atlet-uge.spec.mjs` venter på video-rækken fra Node-siden, blok 2
- denne commit: rapporten, blok 3

Arbejdstræet er rent. Ingen push, ingen migration, ingen ny tabel, ingen ny afhængighed, ingen atletdata. `codex/ordre-284-pilot` og `codex/ordre-284-test-output` er ikke rørt og ikke merget.

## Hvad ændret

**Blok 1.** Begge merges gav konflikt i de samme to filer, `package.json` og `scripts/proever.mjs`. Konflikterne var rent additive (hver gren tilføjede sin egen prøve på samme sted), så begge hensigter overlever: 280's tastaturløse logning og 284's Fremgang-fane, og de to prøver bag dem. Prøverne står nu som nr. 8 `coach-afvigelse` (281), nr. 9 `fremgang` (284) og nr. 10 `coach-mandagsrunden` (285), med tilsvarende `e2e:*`-scripts. Ingen konflikt var uafgørlig, så "vælg 284's udgave"-reglen blev ikke brugt. `AthleteView.jsx` (280 + 284) og `Dashboard.jsx` (281 + 285) flettede uden konflikt, og de to grenes prøver er grønne sammen (se nedenfor).

**Blok 2.** Én ubrudt `npm run proever`, port 8991 tjekket først (ingen lyttende proces, kun TIME_WAIT). Den ene fejl, `atlet-uge.spec.mjs` ("Gem skulle oprette præcis én ny video_analyses-række / 0 !== 1"), er den samme fejl som 269, 281, 284 og 285 hver har kaldt et "kendt miljøproblem". Den er rettet, og årsagen lå i testen: `page.waitForFunction` med en async prædikat kom tilbage ca. 12 ms efter klikket på Gem med en tom `video_analyses`-tabel (målt med tidsstempler), så næste assert læste tabellen, før uploaden var færdig. Rækken kom først bagefter. Testen poller nu mock-tabellen fra Node (60 s) i stedet. Appen var i orden. Ingen ny funktionalitet.

**Blok 3.** Denne rapport.

## Testresultat

- `npm run lint`: ren. `npm run build`: grøn.
- Enhedstests (`node --test` på alle 30 `src/**/*.test.js`): 332 af 332 grønne.
- De 23 `verify:*` der rører atlet, coach, auth, uge og mandagsrunden: alle grønne.
- Ubrudt `npm run proever`: 77 af 78 grønne. Den ene fejl var `atlet-uge.spec.mjs` (se ovenfor). Blandt de grønne: `athlete-film-et-saet.mjs`, `coach-afvigelse.spec.mjs`, `fremgang.spec.mjs`, `coach-mandagsrunden.spec.mjs`, `verify:mandagsrunden-tilstande`.
- Efter rettelsen: `atlet-uge.spec.mjs` grøn to gange i træk, alene.

## Hvad er næste

1. Dhruva fast-forwarder `main` fra `app-samlet-21sep`. Marc pusher (push = deploy).
2. Efter push: kig på de fem linjer øverst på en rigtig telefon mod produktion. Alt her er bevist headless mod mock, ikke mod produktion.
3. Offline-køen (280) flusher kun ved app-åbning og `online`-eventet, ingen baggrunds-retry. Kendt fra 280, ikke ændret her.

For Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): fire færdige atlet- og coach-ordrer (280, 281, 284, 285) har ligget uden for `main` siden fredag. Med denne gren er de samlet, bevist sammen og klar til at blive live på én gang. Samtidig er den gamle "kendte" `proever`-fejl, som rammede alle ordrer siden 269, fjernet, så næste ordres `npm run proever` ikke længere starter med en rød række, der ikke er dens egen.

## Ærlige grænser

- `npm run proever` blev kørt én gang, som ordren sagde. Den blev ikke kørt igen efter testrettelsen, så "77/78, og den ene grøn alene to gange" er facit, ikke "78/78 i én kørsel". Rettelsen rører kun testen, ikke appen.
- Målt er hvad der skete (svar efter ca. 12 ms, tom tabel), ikke hvorfor Playwright returnerer sådan for den async prædikat. Det samme mønster står i `athlete-film-et-saet.mjs` (linje 163), og den var grøn i denne kørsel, så jeg har ikke rørt den. Fejlen jeg ikke kunne genskabe, er den flaky `athlete-film-et-saet.mjs` fra 285 (der stod kun "tomt output"). Jeg kan hverken bekræfte eller afvise, at den har samme årsag.
- `verify:ugen-faar-dato` overskriver tre sporede skærmbilleder i `outputs/ugen-faar-dato/` hver gang det køres. Jeg gendannede dem med `git checkout`, så de ikke kommer med i grenen; det er en bivirkning i scriptet, ikke rettet.
- Alt er kørt headless mod mock-Supabase og lokal vite. Intet er set på en rigtig telefon eller mod produktion, og der er ikke skrevet noget til Supabase.

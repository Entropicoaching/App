Ordre 456

# Klar til Marcs push: Bhishaks A1-A9 rettet

Bhishak (446) sagde "klar til push: nej". Kælderen holdt på det vigtigste, men tre småting gav
stille forkerte data hos coachen (A1-A3), og rekordfejringen kunne lyve for atleter med lang
historik (A4). Alle ni fund er rettet og målt igen med Bhishaks egne scenarier: samme
syntetiske atlet, samme ældre telefon (Slow 4G, 4x CPU, 390 px) og samme e2e-mock. Hans
uændrede verify er nu **rød på præcis fundene** (de genskabes ikke), og kopien med de nye
forventninger er grøn.

| Fund | 446 (main `dd68c77`) | Nu (grenen) |
|---|---|---|
| A1 vægtfelt efter genåbning uden net | tomt, 5 sæt gemt som 0 kg | "25" (ugens seneste sæt), 0 sæt med 0 kg |
| A2 Spring over uden net | fejlbesked, sættet måtte godkendes | virker; coachen ser "1 sprunget over" i pas 2 |
| A3 vurdering uden net | tabt (pas 1 og 2: –) | når frem: [4, 3, –, 4] |
| A4 falsk rekord ved lang historik | fejret (top uden for 4000 / loft 1000) | ingen fejring i 3 af 3; alle 4290 rækker på 6 sider, også med loft 1000 |
| A5 personal_records | kælderens rekorder mangler, dubletter | 7 fejrede = 7 rækker, ingen dubletter |
| A6 dobbelttryk på "Kopiér seneste uge" | 2 uger | 1 uge (knappen er spærret 250 ms efter) |
| A7 coachens forside mens den henter | "0 af 4 pas · Ingen logs" i ca. 5 s | aldrig "Ingen logs" eller "0 af 4 pas" |
| A8 dato i Log og PR-tidslinjen | UTC ("2026-09-26") | dansk tid og dansk dato ("27. sep 2026") |
| A9 Dagens pas med tung historik (median) | 3363 → 5300 ms efter 439 | 3363 (før 439) → **3312 ms**; historikken hentes bagefter, 5 kB |

## Gren

`klar-til-push` fra `main` (`f11501f`, 446 og 450 merget). Ikke pushet.
- blok 1: `4902c48` A1-A3 (og skrivedelen af A5, se Ærlige grænser)
- blok 2: `3849d8d` A4-A6
- blok 3: commit efter `3849d8d` med A7-A9, verificeringen og denne rapport

Én verificeringskommando pr. blok: `node outputs/456/verify-456.mjs 1|2|3` (`npm run verify:456`).
Målingerne køres med `node outputs/456/byg-456.mjs` og derefter `uge-456.mjs`, `graense-456.mjs`,
`coach-456.mjs` og `tid-456.mjs`. Hver kørsel står i `outputs/456/koersel-*.txt`.

## Hvad ændret

**Blok 1, kælderen (A1-A3).**
- **A1** (`DagensPasCard.jsx`, `laesninger.js`, `offlineSnapshot.js`):
  - Vægten forudfyldes fra ugens seneste sæt på samme øvelse (også et sæt i køen), når
    historikken ikke er hentet.
  - Historikkens seneste sæt gemmes i øjebliksbilledet og vises igen uden net.
  - Godkendt med tomt vægtfelt på en vægtøvelse spørger først ("Vægtfeltet er tomt ...
    tryk Godkendt igen for at gemme uden vægt"). Kropsvægtøvelser (Planke, Pull-ups)
    spørges ikke.
- **A2** (`saetSkrivning.js`): "Spring over" og "spring øvelsen over" går gennem samme lokale
  kø som Godkendt, med `skipped: true` og tiden for trykket. Et ventende spring kan fortrydes
  (som "Fortryd sidste sæt").
- **A3** (`saetSkrivning.js`, `offlineSetQueue.js`):
  - Vurderingen af passet lægges i en lokal kø og sendes, når der er net, også efter en
    genåbning.
  - Ventende vurderinger vises i ugen ("din uge" og coachens linje).
- Kan telefonens lager ikke tage posten, skrives der direkte som før (samme garde og samme
  fejlbesked).

**Blok 2, rekorderne og kopien (A4-A6).**
- **A4** (`fremgangLogs.js`, `laesninger.js`, `rekordIndeks.js`):
  - Rekord-indekset og Fremgang henter hele historikken side for side (range, `logged_at`
    og `id` faldende), til en side kommer tom tilbage. Så afskærer Supabase' "Max rows"
    ikke længere "bedst før", uanset hvad prod står på.
  - Indekset er nu version 2, så et indeks fra 450, der kan være bygget af en afskåret
    historik, bygges forfra.
  - Indtil alle sider er hentet, fejres intet.
- **A5** (`saetSkrivning.js`, `personalRecords.js`):
  - `personal_records` skrives fra de samme rekorder, der fejres, først når sættet er hos
    serveren, også når køen sender det senere.
  - Rækken ligger i en lille lokal kø, til den er skrevet. Lukkes appen midt i
    afsendelsen, kommer den med ved næste åbning.
  - Der skrives én gang pr. (øvelse, vægt, reps).
  - Den gamle "baseline"-række ved første sæt på en øvelse skrives ikke mere.
  - Gamle dubletter vises én gang i coachens PR-tidslinje og i "Dine rekorder".
- **A6** (`programHandlinger.js`, `ProgramTab.jsx`, `Dashboard.jsx`): "Kopiér seneste uge"
  er spærret, mens kopien kører, og viser "Kopierer ugen …".

**Blok 3 (A7-A9).**
- **A7** (`ForsideView.jsx`, `Dashboard.jsx`): før ugens logs er hentet, står rækken som
  "Uge 131 · Styrke · 4 pas · henter …" i stedet for "0 af 4 pas · Ingen logs".
- **A8** (`danskDato.js`, `LogTab.jsx`, `AnalyseTab.jsx`, `dashboard/laesninger.js`):
  - Log og PR-tidslinjen bruger dagen i dansk tid (Europe/Copenhagen), og Log viser
    "27. sep 2026".
  - Forsidens "sidst logget" regnes i hele dage. Før gav et sæt i dag før kl. 12
    "-1d siden"; det så jeg i målingen.
- **A9**: ingen ny kode. 450 flyttede historikken til efter Dagens pas og henter kun det nye.
  456's sider holder det sådan (målt nedenfor).
- **Test-infrastruktur**:
  - e2e-mocken kan nu `offset` og et simuleret "Max rows" (`createMockSupabase(seed,
    { maxRows })`).
  - To statiske tjek (`verify:athlete-write-failures` F6 og `verify:athlete-silent-fails-5`
    G14) læser nu `gemRekordRaekke`, hvor PR-skrivningen er flyttet hen. Baseline-kravet er
    fjernet sammen med baseline-rækken.
  - `verify:456` er lagt i `package.json`.
- **Målingerne i `outputs/456/`** er kopier af Bhishaks scripts. Hans egne filer i
  `outputs/kritik-446/` er ikke rørt. Ændringer i kopierne, hver skrevet øverst i filen:
  - skriver i `outputs/456` og bygger i egen temp-mappe;
  - venter på rekord-indekset (450) i stedet for `rekordFoer`;
  - loftet efterlignes i mocken i stedet for ved at skrive `limit=4000` om;
  - historik-kaldet genkendes også som sider;
  - dobbelttrykket er nu to tryk på samme skærmpunkt (se Ærlige grænser);
  - der er to nye tjek for A7/A8.

## Testresultat

- **Bhishaks verify, uændret, mod de nye målinger**
  (`koersel-verify-kritik-446-original.txt`): **rød**, med præcis fundene:
  - A-tid: "kun -51 ms langsommere" og "historik-kaldet er ikke længere > 500 kB";
  - A-rekord (130 uger og loft 1000);
  - A-spring, A-vurdering, A-felt (to linjer), A-pr (fem linjer) og A-kopi.

  Mod hans egne målinger er den stadig grøn (`koersel-verify-kritik-446-bhishak.txt`).
- **`verify-456` (kopien med nye forventninger)**: blok 1, 2 og 3 grønne.
- **Atletens kælder-uge** (`uge-456`, tung historik, 130 uger):
  - Alle 15 tjek er OK: 38/38 sæt, ingen dubletter og rigtig tid.
  - Hver af de 7 rekorder er fejret én gang, og RPE og note kom frem.
  - Spring over, vægtfeltet, 0 kg, vurderingerne og personal_records er OK.
  - Ingen konsolfejl og intet vandret rul.
- **Grænsen** (`graense-456`): top for 130 og 60 uger siden, uden loft og med loft 1000.
  I alle tre kørsler er "bedst før" squat e1RM 128, alle 4290 rækker er hentet på 6 sider,
  og der er ingen fejring.
- **Coachen** (`coach-456`, 390 og 1280 px): alle tjek OK.
  - Forsiden viser 4 af 4 pas og aldrig "Ingen logs"/"0 af 4 pas".
  - "Kræver dit blik" og noten står, som de skal.
  - Log viser begge spring og dansk dato. PR-tidslinjen har kælderens rekorder.
  - Én ny uge ved dobbelttryk.
- **Tid** (`tid-456`, median af 3 genåbninger, ældre telefon):

  | Historik | Før 439 (`412f2c1`) | Nu |
  |---|---|---|
  | let (114 sæt) | 945 ms | 962 ms |
  | tung (4940 sæt) | 3363 ms | 3312 ms |

  Nu er historikken færdig efter 1,7 s (let) og 3,8 s (tung), efter Dagens pas, og er 5 kB.
- `npm run lint`: grøn. `npm run build`: grøn.
- Enhedstests: 376/376. Nye tests dækker vurderings- og rekordkøen, siderne med loft
  1000/4000/250, en fejl midt i siderne, dublet-rydningen og dansk dato/dage.
- Offline-beviserne:
  - 439's blok 3 (offline-rekord én gang) er grøn.
  - 414's tid, hænger og fortryd-dør er grønne.
  - Deres JSON ligger i `outputs/456/koersel-*`. Filerne i `outputs/414` og `outputs/439`
    er gendannet efter kørslen.
- VideoCoach: 12 af 13 `verify:videocoach-*` er grønne i første kørsel.
  - `verify:videocoach-clip` var rød to gange på tidsgrænsen (1,12x og 1,15x mod 1,1x, hver
    gang på et andet klip) og grøn i tredje kørsel (1,07x og 1,08x).
  - Det er samme støj som i 450. `public/` er ikke rørt. Alle tre kørsler står i
    `koersel-videocoach-clip.txt`.
- `verify:athlete-write-failures`, `-silent-fails-5`, `-training-inputs`, `-tap-targets`,
  `-silent-fail-visibility`, `verify:coach-inbox-flow` og `-priority`: grønne.

## Hvad er næste

**Til Marc, før pushet, i Supabase:** åbn prod-projektet under Settings → API og se, hvad
**"Max rows"** står på.
- Efter 456 giver en lav værdi ikke længere falske rekorder, for appen henter side for side.
  Den koster kun flere kald første gang.
- Står den under 100, så sig til: så bliver første opbygning af rekorderne mange kald for
  en atlet med lang historik.
- Jeg har ikke læst den (ingen kald mod prod).

**Pushet og kældertesten:**
1. Merge `klar-til-push` til `main` og push. Det er deployet (397-456 går ud på én gang).
2. Åbn appen som atlet på din egen telefon med net, og vent på "Dagens pas". Første åbning
   bygger rekorderne forfra (indeks version 2), og indtil da fejres intet.
3. Gå i kælderen (flytilstand), log et helt pas, spring ét sæt over, og giv passet en
   vurdering.
4. Luk appen helt midt i passet, åbn den igen uden net, og se, at vægtfeltet er udfyldt.
5. Tag nettet igen, og se, at "gemt lokalt"-linjen forsvinder.
6. Som coach, på telefonen:
   - Log skal vise hvert sæt én gang, springet som "sprunget over" og vurderingen.
   - Datoen skal være i dag på dansk.
7. Som coach: PR-tidslinjen skal have kælderens rekorder én gang hver. Tryk to gange hurtigt
   på "Kopiér seneste uge": der må kun komme én uge (slet den bagefter).
8. Går noget galt: send et skærmbillede. Grenen kan rulles tilbage med en revert af de tre
   commits.

**Til Marc om repoet (fra 446, stadig åbent):** `CLAUDE.local.md` er committet og ligger i
det offentlige repo. Det er ikke rørt her.

**For Hara** (Coaching, delmål "Appen mærkbart bedre"): det, Bhishak kaldte "nej", er rettet.
- Kælderen giver ikke længere stille forkerte data hos coachen: ingen 0 kg-sæt, spring
  står som spring, og vurderingerne når frem.
- Rekordfejringen lyver ikke for atleter med lang historik, uanset prod's "Max rows".
- Med Marcs push og kældertest er dette det skridt, der gør appen mærkbart bedre for
  atleterne.

## Ærlige grænser

- **Alt er målt headless mod e2e-mocken,** ikke på en rigtig telefon og ikke mod prod.
  "Ældre telefon" er Chromiums drosling, og offline er `setOffline` plus CDP (som i 446).
- **Dobbelttrykket er målt anderledes end i 446.** Bhishak brugte `click()` to gange.
  Playwright venter på, at knappen er aktiv igen, så med spærren kom "andet tryk" først,
  når den første kopi var færdig (målt: 2 uger).
  - Det er ikke et dobbelttryk, så kopien trykker to gange på samme skærmpunkt med 250 ms
    imellem.
  - Knappen var spærret ("Kopierer ugen …", disabled) ved andet tryk.
  - En coach, der med vilje trykker igen, når kopien er færdig, får stadig en uge til.
- **A5's skrivedel ligger i commit 1** (samme funktioner som A2/A3 i `saetSkrivning.js`),
  ikke i commit 2.
  - Dubletter i prod's `personal_records` slettes ikke, de vises kun én gang.
  - Der skrives ingen baseline-række mere ved første sæt på en øvelse. Coachens briefing
    (`detectPr`) ser derfor kun rigtige rekorder og startmaks.
  - Et rekordsæt, der fortrydes, efter at rækken er skrevet, lader rækken stå.
- **Vurderinger i køen** har ingen egen "gemt lokalt"-linje. Det gælder også "Træningsfeedback"
  i Program-fanen, som nu også går gennem køen.
- **A7:** under hentningen står rækken kort som "Intet aktivt program" (390 px, før ugerne er
  hentet). Det er samme slags fund som A7, og det er ikke rettet.
  - Fejler hentningen af ugens logs, bliver "henter …" stående til næste opdatering.
- **A8** er rettet i Log, PR-tidslinjen og forsidens "sidst logget". Andre steder bruger
  stadig UTC-dagen: Analyse-fanens øvrige kort, AI-rapporten, stævnefanen og kalenderens
  dage. Målingen kørte ca. kl. 04-05 dansk tid, så UTC og dansk dag var ens. Enhedstesten
  dækker kl. 01.30.
- **A4:** hele historikken hentes nu også, når Fremgang åbnes. Der er ingen grænse på 4000
  mere, og over 200 sider giver en fejl i stedet for et halvt svar. Første opbygning af
  indekset er 6 kald for 4290 sæt.
- **Tidsmålingen** er på min maskine, mod `412f2c1` bygget i en temp-mappe. For at bygge den
  skulle jeg bruge Windows' `tar` i PATH for den ene kommando, fordi Git Bash' tar ikke kan
  læse `C:\`. Der er ingen git-handlinger på andre grene.
- **Offline-beviserne** fra 414 og 439 skriver i deres egne mapper. Jeg kopierede deres JSON
  til `outputs/456` og gendannede deres filer med `git checkout` (kun de filer, kørslen havde
  overskrevet).

# RAPPORT-126 — de tre røde på main, og de sidste 39 px

## Gren

`roede-paa-main`, fra `main` (`eb4971d`, ordre 121+124 og 123 merget). Tre commits:

- `f133de6` — docs(roede-paa-main): diagnose de tre røde verify-scripts på main
  (commit 1, ingen rettelser)
- `715c34c` — fix: grønt på den rigtige måde for de røde verify-scripts (commit 2)
- `5f2d409` — fix: løft søvntimer-feltet og logins email/adgangskode til 44px
  (commit 3)

Ét ekstra dokument uden for de tre commits' kernearbejde: `docs/ROEDE-PAA-MAIN.md`
(commit 1) med den fulde diagnose.

## Hvad ændret

**Commit 1 — diagnose (ingen kodeændring):**
Kørte de tre navngivne scripts mod `main` og fandt via `git log -S`, `git show` og en
`git worktree` på den commit der indførte den første test:

1. `verify:athlete-first-day-flow` — **(b) forældet test**. Hash'en der pinner
   `calcReadinessScore`-blokken var korrekt da testen blev skrevet (bekræftet ved at
   køre den mod netop den commit i en worktree), men to senere, bevidste ordrer
   ændrede præcis det stykke kode: ordre 64 (commit `8fa3058`, oversat fejlbesked +
   `frontend_errors`-log) og ordre 76 (commit `34064aa`, rydder parathedsudkastet
   efter et bekræftet gem).
2. `verify:athlete-read-failures` — **(b) forældet test**. `fetchReadiness` har nu
   tre garderede læsninger, ikke to — ordre 100 (commit `6dfd214`) lagde en
   14-dages-historik-læsning til for "sat op mod eget snit"-kortet. Testen blev
   aldrig opdateret.
3. `verify:auth-logout-and-role-switch` — **(c) miljøproblem**. Ren tekstsammenligning
   mod en bogstavelig `\n`-delstreng, men denne Windows-checkout har
   `core.autocrlf=true` og filerne ligger derfor med `\r\n`. Bekræftet ved at
   normalisere linjeskift i en kopi og se hele scriptet bestå uændret.

**Commit 2 — grønt på den rigtige måde:**
- `scripts/verify-athlete-first-day-flow.mjs`: hash'en er opdateret til den
  nuværende, bevidst ændrede kildetekst (LF-normaliseret ved sammenligning); en
  kommentar forklarer hvilke to ordrer der ændrede den og hvorfor testens formål
  (lås mod FREMTIDIGE utilsigtede ændringer) stadig holder.
- `scripts/verify-athlete-read-failures.mjs`: forventet antal garderede læsninger i
  `fetchReadiness` rettet fra 2 til 3, og der er tilføjet samme
  "sat-efter-bekræftet-svar"-tjek for den tredje (historik-)læsning som de to
  andre allerede havde.
- `scripts/verify-auth-logout-and-role-switch.mjs`: normaliserer nu `\r\n` → `\n` på
  alle fem indlæste kildefiler før de bogstavelige match. Testens indhold er
  uændret — den tester stadig præcis det samme, bare uafhængigt af
  linjeskift-stil.
- Samme CRLF-rodårsag ramte også `n8n/verify-workflows.mjs` (ikke en af de tre
  navngivne, fundet under "alle verify:* skal være grønne"-kravet): normaliseret på
  samme måde.
- **Ingen** test slettet, ingen grænse sænket, ingen skip.

**Commit 3 — de sidste trykflader:**
Kun padding ændret, ikke skriftstørrelse, farve eller layout:
- `src/Auth.jsx`: email- og adgangskodefeltets lodrette padding `0.65rem` →
  `0.85rem` (var 340×39px / 310×39px, nu ~45px).
- `src/AthleteView.jsx`: check-in's søvntimer-felt (placeholder "timer") lodret
  padding `0.5rem` → `0.7rem` (var 90×39px, nu ~45px).
- `scripts/maal-app.mjs`: check-in-harnessens kopi af samme inputstil holdt i sync
  med den ægte kilde (harnessen bruger en bogstavelig kopi af AthleteView.jsx's
  inline-stil, jf. filens egne kommentarer) — ellers ville `maal:app` have målt den
  gamle, ikke den rettede, kode.

Padding-værdierne er fundet ved at måle i en headless Chromium (samme
`playwright`-runtime som `maal-app.mjs` selv bruger) i stedet for at gætte ud fra
CSS-boksmodellen i hovedet.

## Testresultat

- `npm run lint`: 0 fejl, 13 pre-eksisterende advarsler (uændret React
  Hook-`exhaustive-deps`-advarsler i `AthleteView.jsx`/`Dashboard.jsx`, ikke rørt).
- Alle 30 `verify:*`-scripts (inkl. `verify:n8n`): **grønne** på grenen.
- `npm run maal:app`: 0 trykflader under 44px på alle tre profiler (iPhone 13,
  Android 360×740, Desktop 1280×800) for Login, Dagens pas, Sæt-logger, Opvarmning
  og Check-in. Eneste tilbageværende "trykflader<44px" i målingen: Desktop ·
  Videocoach-forside (3, uændret) — Bhishaks desktop-knapper, som ordren
  eksplicit undtager. Før/efter-tal og skærmbilleder i
  `outputs/maal-app/EFTER.md`.

## Hvad er næste

- De to trykflader er lukket; ingen kendte resterende <44px-flader uden for den
  undtagne videocoach-desktop-forside.
- Hvis en fremtidig ordre rører `fetchReadiness` eller `calcReadinessScore` igen,
  skal `verify-athlete-first-day-flow.mjs`'s hash opdateres bevidst (samme mønster
  som denne ordre) — ikke omgås.
- CRLF/LF-normaliseringen er kun lagt ind i de to scripts der faktisk fejlede af
  den grund. Andre `verify:*`-scripts der gør rå tekstmatch er ikke gennemgået for
  samme sårbarhed, da de i dag er grønne — ingen grund til at røre kode der virker.

## Ærlige grænser

- Ordre 76's præcise commit for G12-rettelsen (`34064aa`) har ikke et eksplicit
  "Ordre N" i commit-beskeden; ordre-nummeret (76) er udledt fra
  `scripts/verify-athlete-readiness-draft.mjs`'s egen header-kommentar
  ("ORDRE 76 — … G12: …"), som blev tilføjet i samme commit — ikke gættet, men
  heller ikke en direkte "Ordre 76, commit X/Y"-linje i selve commit-beskeden.
  Ordre 64 for F6+F7 (commit `8fa3058`) står derimod eksplicit i commit-beskeden.
- Padding-værdierne (0.85rem / 0.7rem) er valgt for komfortabel margin over 44px
  (målt 45.1–45.4px afrundet), ikke det teoretisk mindst mulige tal — en smule
  mere sikkerhedsmargin end absolut nødvendigt, for at stå robust på tværs af de
  tre profiler.
- `verify:n8n`'s CRLF-fix var ikke navngivet i ordren, men samme rodårsag som
  commit 2's tredje fund; rettet fordi ordren kræver at ALLE `verify:*` er grønne
  på grenen, ikke kun de tre navngivne.
- Har ikke rørt `videocoach.html` eller Bhishaks arbejdsområde
  (`entropi-app-wt2`).

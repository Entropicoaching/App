# De tre røde på main — hvorfor, og hvad de er

Kørt mod `main` (`eb4971d`), ORDRE 126 commit 1. Ingen rettelser i dette dokument —
kun diagnose. Alle tre er fundet ved at læse fejlen, `git log -S`/`git show` mod den
angivne funktion, og i ét tilfælde en `git worktree` på den commit der indførte testen
for at bekræfte at den rent faktisk var grøn dengang.

## 1. `verify:athlete-first-day-flow` — (b) forældet test

**Hvad den tester:** At førstedagsflowets navigation (scroll til parathedskortet)
ikke ved et uheld har ændret selve parathedsberegningen/-persistensen. Det sidste
sikres ved at hash'e kildeteksten for `calcReadinessScore` … `fetchProgram` og
sammenligne mod en fast SHA-256 (`CC214A5B…`).

**Hvad den fejler på:** Hash-mismatch. `git worktree add` på `4c3c6ac` (commit der
indførte scriptet, 31/7-2026) viser at testen VAR grøn dengang — hash'en var korrekt
for den daværende kildetekst. Diff mellem den daværende og nuværende
`calcReadinessScore`-blok viser to reelle, senere ændringer af netop det stykke kode
testen låser:

- `saveReadiness` viser nu en oversat fejlbesked og logger detaljen til
  `frontend_errors` i stedet for at vise Supabases rå fejlbesked — besluttet i
  **ordre 64, commit 3/3** (commit `8fa3058`, "F6+F7 - PR-baseline og parathedsfejl
  skjuler ikke fejlen").
- Et bekræftet gemt svar rydder nu det lokale parathedsudkast
  (`clearReadinessDraft`) — besluttet i **ordre 76** (commit `34064aa`, "G12 -
  parathedsformularen overlever nu en lukket fane").

**Konklusion:** Testen er forældet — den pinner en kodetekst fra før to senere,
bevidste ordrer ændrede netop den kode. Ikke en reel fejl i appen.

## 2. `verify:athlete-read-failures` — (b) forældet test

**Hvad den tester:** At `fetchReadiness` har præcis to garderede (`runGuardedRead`)
læsninger — dagens og sidste parathed — og at hver sætter sin tilstand først efter et
bekræftet svar.

**Hvad den fejler på:** `fetchReadiness` har nu **tre** garderede læsninger, ikke to.
Den tredje (`hist`/`setReadinessHistory`, op til 14 forudgående dage) er tilføjet med
kommentaren "ORDRE 100: op til 14 forudgående dage — grundlaget for 'sat op mod dit
eget snit' og for den lille 14-dages-kurve", commit `6dfd214` ("feat(readiness):
14-dages kurve under svaret (ordre 100 · commit 2)").

**Konklusion:** Testen er forældet — den blev ikke opdateret da ordre 100 lagde en
tredje garderet læsning ind i samme funktion. Ikke en reel fejl i appen (den nye
læsning er selv korrekt garderet: `if (!histOk) return` før `setReadinessHistory`).

## 3. `verify:auth-logout-and-role-switch` — (c) miljøproblem

**Hvad den tester:** Ren kildetekst-verifikation af `signOutHard()` i
`src/supabase.js` — bl.a. at `window.location.reload()` står UMIDDELBART efter
(uden for) `signOutHardCore(...)`-kaldets lukkende parentes, ved at søge efter
den bogstavelige delstreng `)\n  window.location.reload()`.

**Hvad den fejler på:** `src/supabase.js` (og faktisk alle kildefiler i repoet) ligger
på disken med CRLF-linjeskift (`git config core.autocrlf` = `true` globalt på denne
maskine → Git konverterer LF i repoet til CRLF ved checkout på Windows). Den
bogstavelige delstreng scriptet søger efter indeholder et `\n`, men filen har `\r\n`
på det sted, så `indexOf` fejler — selvom koden semantisk er helt korrekt.
Bekræftet: normaliseres alle fem indlæste filers `\r\n` til `\n` før scriptets øvrige
kørsel, består HELE scriptet uændret (ingen andre afvigelser).

**Konklusion:** Miljøproblem, ikke en app-fejl og ikke en forældet test — scriptets
antagelse om LF-linjeskift holder ikke på en Windows-checkout med
`core.autocrlf=true`. Rettes ved at gøre scriptets fil-læsning robust over for CRLF
(normalisere ved indlæsning), ikke ved at ændre brugerens globale Git-konfiguration
(ville påvirke andre repos/arbejdstræer, bl.a. Bhishaks `entropi-app-wt2`).

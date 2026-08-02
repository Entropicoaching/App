# Subscription shadow-migration — sikker blocker-evidens

Status: **BLOCKED_SAFE / ingen SQL kørt**
Dato: 2026-08-02
Tilladt mål: `maxhsefxbrvsgolscqwh` og intet andet.

## Beslutning

Den eksplicitte shadow-only migrationsautorisation er registreret, men den kan
ikke bruges endnu: worktreet har ingen aktiv, verificerbar binding eller
operator-auth til det tilladte shadow-projekt. At gætte eller genbruge den
eksisterende 1:1-konfiguration ville kunne ramme et andet projekt, så eksekvering
er stoppet før første databasekald.

## Verificeret evidens (ingen secrets udskrevet)

- `config/subscription-shadow-binding.json` fastlåser den eneste tilladte ref til
  `maxhsefxbrvsgolscqwh`.
- `.env.local` mangler alle tre `VITE_SUB_SUPABASE_*`-værdier.
- Den eksisterende generelle `VITE_SUPABASE_URL` indeholder ref
  `dsqgaxwgtcbqgphsofav`, som **ikke** er det tilladte shadow-projekt.
- Der findes en generel Supabase secret lokalt, men dens projekt-tilhørsforhold
  kan ikke bevises uden at afsløre/bruge den. Den blev derfor ikke anvendt.
- Supabase CLI, `psql`, projekt-link og databaseforbindelse mangler i dette
  worktree.
- `npm run verify:subscription-shadow-backend`: **PASS** (11 DRAFT-filer,
  statisk kontrakt).
- `npm run verify:subscription-shadow-behavioral-qa`: **PASS** (7 cases,
  statisk pakke; ingen databaseadfærd bevist).
- `npm run test:subscription-shadow-binding`: **PASS** (4/4 fail-closed tests).
- `npm run verify:subscription-shadow-binding`: **FAIL som forventet** med
  `VITE_SUB_SUPABASE_PROJECT_REF is missing`.

## Eneste handling der åbner næste kørsel

Bind en autentificeret, projektafgrænset Supabase-operator til **præcis**
`maxhsefxbrvsgolscqwh` i denne opgave/worktree, og læg projektets tre
`VITE_SUB_SUPABASE_*`-værdier i den lokale, git-ignorerede `.env.local` uden at
indsætte nøgler i chat eller dokumenter. Bindingen skal vise projekt-ref'en
maskinelt; en løs secret uden dokumenteret ref accepteres ikke.

Når det er gjort, kan Codex fortsætte uden ny scopebeslutning: først den samlede
readiness-gate, derefter read-only databaseidentitet/baseline og kun derefter de
reviewede DRAFT-filer.

## Fastlåst eksekveringsrunbook efter unblock

1. Kør `npm run verify:subscription-shadow-readiness`; stop ved andet end PASS.
2. Verificér gennem den autentificerede operator, at forbindelsens projekt-ref
   er præcis `maxhsefxbrvsgolscqwh`. Stop ved enhver tvivl eller reference til
   produktion.
3. Tag read-only før-baseline: samlet antal policies i `public`, samlet antal
   `SECURITY DEFINER`-funktioner i `public`, eksisterende `sub_%`-objekter og
   Advisor-baseline. Stop hvis schemaet er uventet.
4. Bekræft at den eksisterende produktdependency `public.athletes` findes uden
   at oprette/kopiere 1:1-schema eller roller. Kør **ikke**
   `shadow-fixture-existing-products.DRAFT.sql` eller
   `shadow-fixture-test-users.DRAFT.sql` under denne autorisation.
5. Kør kun disse filer, én gate ad gangen og uden at åbne klienten mellem dem:
   `sub-01` → `sub-02` → `sub-03` → `sub-04` → `sub-05` → `sub-06` → `sub-07`
   → `sub-08` → `sub-09` → `sub-10` → `sub-11`.
6. Stop øjeblikkeligt ved første fejl. `sub-11` skal committe uden exception.
7. Tag samme read-only efter-baseline og registrér delta. Kildekontrakten
   indeholder 9 nye tabeller, 12 `entropi_sub_*` policies og 17 funktioner; den
   faktiske database-delta skal forklares mod før-baselinen, ikke blot antages.
8. Kør privilege- og adfærdsgates fra
   `subscription-shadow-behavioral-qa-runbook.md`. Ingen invitation eller pilot
   åbnes før alle gates er grønne.

## Database- og rollback-status

- SQL-filer anvendt: **0/11**.
- Databasekald: **0**.
- Før-counts: **ikke hentet** (ingen verificeret shadow-forbindelse).
- Efter-counts: **ikke hentet**.
- Produktionsændringer: **ingen**.
- 1:1-schema/roller/testbrugere: **ikke oprettet**.
- Rollback: **ikke nødvendig**, fordi intet blev kørt. Der findes ikke en
  reviewet down-migration i pakken; en eventuel senere fejlet shadow-kørsel skal
  fryses og håndteres som en særskilt, eksplicit autoriseret shadow-only
  rollback/reset — aldrig med improviseret SQL.

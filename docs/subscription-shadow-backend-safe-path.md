# Subscription shadow-backend — sikker pilotsti

Status 2026-08-01: lokal DRAFT-kontrakt. Ingen migration er kørt, ingen konto er
oprettet, ingen invitation er sendt, og Auth/produktion er ikke ændret.

Dette dokument er autoritativt for backend-pilotstien og erstatter direkte
`INSERT`/`UPDATE`-eksempler for entitlements og assignments i ældre planer.

## Ufravigelige grænser

- Kun det isolerede shadow-projekt `maxhsefxbrvsgolscqwh` må senere bruges.
- Klienten må aldrig skrive `sub_entitlements`, `sub_programs` eller
  `sub_assignments`, hverken direkte eller gennem en klient-eksekverbar RPC.
- `profiles` og `profiles.role` indgår ikke i subscription-autorisation.
- En publiceret programversion ændres aldrig. En rettelse er en ny
  `(slug, version)`-række i en reviewet DRAFT-migration.
- Workouts og sæt gemmes atomisk mod assignmentens konkrete `program_id`.
- Et uge-2-forslag er et separat evidensobjekt. Accept ændrer hverken programmet,
  assignmenten eller historiske logs.

## DRAFT-rækkefølge

Kørsel er en senere, særskilt og autoriseret shadow-opgave. Rækkefølgen er
`sub-01` til `sub-11`; shadow-klienten må ikke åbnes mellem trinnene.

- `01–06`: entitlements, medlemspræferencer, katalog, assignments, workouts og
  grundhardening.
- `07`: publiceret versions-immutabilitet og service-only assignment.
- `08`: service-only aktivering af inviteret, bekræftet og indlogget medlem.
- `09`: service-only uge-2-forslag og eksplicit, ejerbundet beslutnings-RPC.
- `10`: atomisk workout+sæt-RPC og forseglet historik.
- `11`: fail-closed assertions for privileges, policies og fravær af
  `profiles.role`-autorisation.

## Præcis pilotsti

1. En autoriseret Auth-operatør opretter og sender senere én e-mailinvitation i
   shadow. Det sker uden for disse SQL-filer. Åben signup forbliver lukket.
2. Testeren accepterer invitationen, bekræfter e-mailen og logger ind. Login
   giver ingen member-adgang af sig selv.
3. En server/service-operatør kalder derefter
   `sub_controlled_activate_invited_member(request_id, auth_user_id, email,
   valid_until)`. Funktionen kræver `auth.users.invited_at`,
   `email_confirmed_at`, et login efter invitationen og eksakt normaliseret
   e-mailmatch. Den skriver et tidsbegrænset entitlement med
   `source='pilot_invite'`. Samme request er idempotent; et eksisterende
   entitlement fra enhver kilde overskrives ikke.
4. En reviewet DRAFT-seed opretter den konkrete programversion. Piloten vælger
   eksplicit `slug` + `version`; aldrig “seneste”. `sub-07` låser indhold og
   proveniens efter publicering.
5. Service-operatøren kalder
   `sub_controlled_shadow_assign_program(request_id, auth_user_id,
   program_version_id, match_input, 'shadow-pilot-manual')`. Tier kontrolleres
   server-side. Samme request returnerer samme assignment; ændrede argumenter
   med genbrugt request-id afvises.
6. Klienten læser eget entitlement, assignment og den eksakte version. Et
   afsluttet pas sendes som ét payload til `sub_persist_completed_workout_v1`.
   Funktionen udleder bruger og `program_id`, validerer assignment, dag og alle
   øvelser, skriver workout+sæt i samme transaktion og forsegler payloadet.
   Samme `client_id` + samme payload er idempotent; ændret payload afvises.
7. Efter to kvalificerende, afsluttede eksponeringer kan service-opgaven oprette
   ét forslag med `sub_controlled_create_week_two_proposal`. DRAFT-reglen kræver
   samme assignment/version/øvelse, alle planlagte sæt ved toppen af repmålet,
   RPE ≤ 7, samme vægt og præcis +2,5 kg.
8. Testeren vælger eksplicit via `sub_decide_week_two_proposal_v1`: `accept`,
   `keep` eller `manual_review`. Kun forslagets ejer kan beslutte. Accept er en
   append-only event; `undo_accept` kan senere fortryde den. Den effektive status
   læses via `sub_my_week_two_proposal_state_v1`; kun seneste `accept` tillader
   den foreslåede vægt i næste eksponering.

## Verifikationsgates

Før nogen shadow-kørsel:

```powershell
node scripts/verify-subscription-shadow-backend.mjs
```

Den lokale gate skal være grøn og bekræfter 11 DRAFT-filer, forbudte
klientrettigheder, service-only kontrollerede funktioner, invitation/login-gates,
uge-2-evidens og atomisk workout-persistens. Den parser ikke PostgreSQL og
erstatter derfor ikke en isoleret shadow-test.

Efter en senere, autoriseret DRAFT-kørsel skal alle disse gates være grønne:

1. `sub-11-shadow-contract-gate.DRAFT.sql` committer uden exception.
2. `anon` og `authenticated` har ingen INSERT/UPDATE/DELETE/TRUNCATE på
   entitlement, program, assignment, invitation-audit, forslag, beslutninger,
   workouts eller sæt.
3. Kun `sub_decide_week_two_proposal_v1`,
   `sub_my_week_two_proposal_state_v1`, `sub_persist_completed_workout_v1`,
   `sub_current_tier` og `sub_my_access_v1` er klient-eksekverbare; de er alle
   bundet til `auth.uid()`.
4. Uinviteret, ubekræftet eller ikke-indlogget Auth-bruger får ingen entitlement.
5. Free kan ikke få member-program; selvvalgt `profiles.role` ændrer intet.
6. Genbrug af request/client-id med samme payload er idempotent; med andet
   payload fejler det lukket. Parallel assignment efterlader én aktiv række.
7. Forkert assignment/program/dag/øvelse eller ét ugyldigt sæt efterlader ingen
   delvis workout.
8. Bruger B kan ikke læse eller beslutte på bruger A's program, workout, forslag
   eller beslutning.
9. Et accepteret uge-2-forslag efterlader hash/indhold for programversionen,
   assignmenten og evidens-workouts uændret.
10. Supabase Advisor må ikke få nye security/performance findings mod den
    registrerede shadow-baseline.

Stop straks ved forkert project-ref, enhver produktionstilknytning, en rød gate,
ændret baseline, klient-write på de tre produkt-state-tabeller, cross-user data
eller delvis/ændret historik. Ingen invitation må sendes før alle gates er
dokumenteret grønne.

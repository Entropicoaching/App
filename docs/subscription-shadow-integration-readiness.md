# Subscription shadow-pilot: integration readiness

Status 2026-08-02: browserklienten er lokalt integration-ready og fail-closed.
Ingen migration, databasewrite, Auth-bruger, invitation, login, betaling, deploy
eller produktionsændring er udført.

## Den konkrete pilotindgang

`subscription.html` bygger `src/subscription/main.jsx`. Indgangen opretter kun
en Supabase-klient, når URL, deklareret project-ref og anon/publishable key
består `validatePilotConfig`. Den bruger sin egen storage key
`entropi-sub-auth`, ingen service worker og ingen kode fra 1:1-klienten.

Efter login åbnes ingen programtabeller, før `sub_my_access_v1()` returnerer
`member`. Programmet læses kun gennem brugerens aktive RLS-bundne assignment.
Et afsluttet pas skrives udelukkende gennem
`sub_persist_completed_workout_v1`; klienten sender aldrig `user_id` eller
`program_id` og har ingen direkte insert/upsert/update/delete-metode.

## Lokale gates

Følgende gate er den samlede lokale indgang:

```powershell
npm run verify:subscription-shadow-readiness
```

Den stopper først ved forkert/manglende binding og fortsætter derefter med
backendkontrakt, klientkontrakt, alle subscription-tests og pilotbuild. Den
foretager ingen netværks- eller databasehandling.

Aktuel stopgrund: den eksisterende `.env.local` har ikke de tre
`VITE_SUB_SUPABASE_*`-værdier. Det er korrekt fail-closed adfærd. Hemmelige
nøgler må ikke tilføjes til dokumenter eller commits.

## Præcise shadow-migrationer før en rigtig pilot

En senere, særskilt autoriseret shadow-kørsel kræver i denne rækkefølge:

1. `sub-01-entitlements.DRAFT.sql`
2. `sub-02-members.DRAFT.sql`
3. `sub-03-programs.DRAFT.sql`
4. `sub-04-assignments.DRAFT.sql`
5. `sub-05-workouts.DRAFT.sql`
6. `sub-06-hardening.DRAFT.sql`
7. `sub-07-program-version-and-assignment-guard.DRAFT.sql`
8. `sub-08-invited-member-activation.DRAFT.sql`
9. `sub-09-week-two-proposals.DRAFT.sql`
10. `sub-10-workout-persistence-guard.DRAFT.sql`
11. `sub-11-shadow-contract-gate.DRAFT.sql`

`sub-03` er nu den reviewede, maskinverificerede seed for den låste pilotflade:
full gym, målene Styrke / Styrkeløft, niveauerne Nybegynder / Øvet og 2/3/4
dage (4 dage kun Øvet). Den indeholder seks konkrete, immutable versioner og
dækker de ti tilladte goal/level/day-spor. `sub-02` og `sub-04` fastholder den
samme flade for hhv. præferencer og assignmentens oprindelige match-input.
Efter `sub-07` må publicerede rækker ikke rettes eller slettes.

Backend-runbooken `subscription-shadow-backend-safe-path.md` er autoritativ for
aktivering, assignment, workoutpersistens og uge-2-events. Alle migrations er
fortsat DRAFT og må ikke køres mod produktion.

## Eneste menneskelige autorisationsport

En ejer med adgang til Supabase skal i dashboardet bekræfte, at
`maxhsefxbrvsgolscqwh` er det isolerede subscription-shadowprojekt, kopiere
projektets publishable/anon key til lokal `.env.local` og eksplicit godkende en
senere shadow-only migrationskørsel. Først når den samlede readiness-gate og
den efterfølgende RLS-QA er grønne, må den første invitation overvejes.

Stop ved enhver anden project-ref, rød gate, uventet eksisterende schema,
cross-user data, direkte klientwrite eller afvigelse i Advisor-baselinen.

# Migration: `exercise_muscle_overrides` (ordre 209)

Én ny tabel: coachens rettelser til muskel-kortlægningen (i dag i browserens
`localStorage`, se `src/volume/rettelser.js` og `docs/VOLUMEN.md`) flytter til
Supabase, så en rettelse Marc laver ét sted gælder alle hans enheder.

## Hvad Marc godkender

Læs `20260915-exercise_muscle_overrides.sql` (samme mappe). Kort fortalt:

- **Ny tabel, intet eksisterende rørt.** `create table if not exists`, ingen
  `alter` på nogen eksisterende tabel/kolonne.
- **Hvad den gemmer:** pr. coach, pr. øvelse — normaliseret nøgle, det
  oprindelige øvelsesnavn, og gruppe/andel-listen (samme facon appen allerede
  bruger), unik pr. (coach, øvelse).
- **RLS:** kun coachen selv kan læse eller skrive sine egne rækker (samme
  mønster som `coach_signal_actions`, `supabase/sql/coach-signal-actions-v1.sql`).
  Ingen atlet-adgang — der findes ingen atlet-facing volumen-visning i appen i
  dag (se rapportens commit 4), så der er intet der ville bruge den endnu.
- **Ingen ny afhængighed, ingen ændring af appens adfærd før migrationen er
  kørt** — appens kode (denne ordres commit 2) prøver tabellen ved kørsel og
  falder stille tilbage til `localStorage` hvis den ikke findes endnu.

## Hvad Dhruva kører (efter Marcs eksplicitte ja)

Kør SQL-filen `20260915-exercise_muscle_overrides.sql` mod produktions-Supabase
(samme vej som tidligere godkendte migrationer i dette repo — se fx ordre 38's
`supabase/sql/athlete-onboarding-guide-v1.sql` for præcedens). Filen er
selv-indeholdt (`begin`/`commit`), ingen andre filer skal køres samtidig.

## Hvad der sker i appen, før og efter

**Før migrationen er kørt (i dag, og i denne ordres commits):** Ret
kortlægning-vinduet gemmer og læser fra `localStorage`, uændret adfærd —
linjen "Gemmes på denne enhed" vises.

**Efter migrationen er kørt:** næste gang en coach åbner "Volumen pr.
muskelgruppe", finder appens ét billige opslag tabellen, og:

1. Findes der allerede lokale rettelser i den browser (fra før migrationen),
   flyttes de op til tabellen automatisk, én gang, markeret som flyttet
   lokalt (så de ikke forsøges flyttet igen).
2. Fremover læses og skrives rettelser mod tabellen — linjen skifter til
   "Gemmes på din konto", og en rettelse lavet på én enhed ses med det samme
   på Marcs andre enheder.

Ingen synlig ændring for atleten (ingen atlet-facing volumen-visning findes
endnu, se commit 4 i rapporten for ordre 209).

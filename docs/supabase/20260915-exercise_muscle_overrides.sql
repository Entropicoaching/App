-- ORDRE 209 — coachens rettelser til muskel-kortlægningen (src/volume/rettelser.js,
-- ordre 185/192), løftet fra browserens localStorage til en Supabase-tabel, så en
-- rettelse Marc laver ét sted gælder på alle hans enheder — og, hvis/når atletens
-- egen volumen-visning bygges (ordrens commit 4 fandt ingen i dag), atletens
-- visning af samme coachs rettelser.
--
-- IKKE ANVENDT PÅ PRODUKTION. Afventer Marcs eksplicitte godkendelse, før den køres
-- som Supabase-migration af Dhruva — se
-- docs/supabase/20260915-exercise_muscle_overrides.md for hvad der skal tjekkes
-- før/efter, og den præcise kommando.
--
-- Additiv migration: opretter kun en ny tabel + RLS. Ingen eksisterende
-- tabel/kolonne rørt, ingen eksisterende data ændres.

begin;

create table if not exists public.exercise_muscle_overrides (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,

  -- Normaliseret nøgle — samme normaliserOevelsesnavn() som src/volume/muskelkort.js
  -- altid har brugt til opslag. Det er DEN der afgør om to skrivemåder er "samme
  -- øvelse", ikke exercise_name.
  exercise_key text not null check (length(exercise_key) between 1 and 200),

  -- Navnet som coachen faktisk skrev ("Zercher squat", ikke "zercher squat") — til
  -- visning. rettelser.js/KortlaegningRedigering.jsx har altid vist dette; kun at
  -- gemme den normaliserede nøgle ville være en regression i UI'et.
  exercise_name text not null check (length(exercise_name) between 1 and 200),

  -- Samme facon som src/volume/rettelser.js's `grupper`:
  -- [{ gruppe: 'kneeExtensors', andel: 1 | 0.5 }, ...]. Andels-værdierne (kun
  -- PRIMÆR=1/MEDVIRKENDE=0.5) valideres på klienten, som localStorage-versionen
  -- altid har gjort — denne check er kun en strukturel kontrol af selve JSON-formen,
  -- ikke en fuld gengivelse af klientens valideringsregler.
  groups jsonb not null check (
    jsonb_typeof(groups) = 'array' and jsonb_array_length(groups) > 0
  ),

  set_by text not null default 'Marc',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exercise_muscle_overrides_coach_exercise_key unique (coach_id, exercise_key)
);

create index if not exists exercise_muscle_overrides_coach_idx
  on public.exercise_muscle_overrides (coach_id);

alter table public.exercise_muscle_overrides enable row level security;

revoke all on table public.exercise_muscle_overrides from anon;
grant select, insert, update, delete on table public.exercise_muscle_overrides to authenticated;

-- Samme mønster som coach_signal_actions (supabase/sql/coach-signal-actions-v1.sql):
-- kun coachen selv kan læse/skrive sine egne rækker. Ingen athlete-policy her endnu
-- — der findes ingen atlet-facing volumen-visning i appen i dag (se rapporten for
-- ordre 209, commit 4); en fremtidig sådan visning kræver enten en ny, snævert
-- scopet SELECT-policy (athlete ser kun rækker fra athletes.coach_id = sin egen
-- coach) eller en SECURITY DEFINER-funktion, ikke tilføjet her for ikke at åbne en
-- læsevej ingen kode bruger endnu.
drop policy if exists entropi_exercise_muscle_overrides_owner
  on public.exercise_muscle_overrides;

create policy entropi_exercise_muscle_overrides_owner
on public.exercise_muscle_overrides
for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

commit;

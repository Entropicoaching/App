-- Manual approval required. Never run by the application or this delivery.
begin;

create table public.home_exercise_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null references auth.users(id),
  exercises jsonb not null,
  created_at timestamptz not null default now(),
  constraint home_exercise_assignments_pair unique (athlete_id, coach_id),
  constraint home_exercise_assignments_payload check (
    jsonb_typeof(exercises) = 'object'
    and exercises ? 'problemId' and exercises ? 'exerciseIds'
    and jsonb_typeof(exercises->'problemId') = 'string'
    and length(exercises->>'problemId') between 1 and 200
    and jsonb_typeof(exercises->'exerciseIds') = 'array'
    and jsonb_array_length(exercises->'exerciseIds') between 1 and 4
    and octet_length(exercises::text) <= 10000
  )
);

-- The pair index also supports athlete reads; coach index supports coach scope.
create index home_exercise_assignments_coach_idx
  on public.home_exercise_assignments (coach_id);

alter table public.home_exercise_assignments enable row level security;
revoke all on table public.home_exercise_assignments from public, anon, authenticated;
grant select, insert, delete on table public.home_exercise_assignments to authenticated;
-- Upsert supplies these same columns; created_at and id cannot be rewritten.
grant update (athlete_id, coach_id, exercises) on public.home_exercise_assignments to authenticated;

-- Scope is immutable, including on the upsert update path. No privilege elevation.
create function public.home_exercise_assignment_scope_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $fn$
begin
  if new.id is distinct from old.id
     or new.athlete_id is distinct from old.athlete_id
     or new.coach_id is distinct from old.coach_id
     or new.created_at is distinct from old.created_at then
    raise exception 'home_exercise_assignment_scope_immutable' using errcode = '42501';
  end if;
  return new;
end;
$fn$;
revoke all on function public.home_exercise_assignment_scope_guard() from public, anon, authenticated;
create trigger home_exercise_assignment_scope_guard
  before update on public.home_exercise_assignments
  for each row execute function public.home_exercise_assignment_scope_guard();

-- Follow the pinned athletes.user_id / athletes.coach_id identity pattern.
-- Requiring the CURRENT coach prevents access retained by a former coach.
create policy home_exercise_assignments_select
  on public.home_exercise_assignments for select to authenticated
  using (exists (
    select 1 from public.athletes a
    where a.id = home_exercise_assignments.athlete_id
      and a.coach_id = home_exercise_assignments.coach_id
      and (a.user_id = (select auth.uid()) or a.coach_id = (select auth.uid()))
  ));

-- Only the assigned coach authors homework; the athlete can read it.
create policy home_exercise_assignments_insert
  on public.home_exercise_assignments for insert to authenticated
  with check (coach_id = (select auth.uid()) and exists (
    select 1 from public.athletes a
    where a.id = home_exercise_assignments.athlete_id
      and a.coach_id = home_exercise_assignments.coach_id
  ));

create policy home_exercise_assignments_update
  on public.home_exercise_assignments for update to authenticated
  using (coach_id = (select auth.uid()) and exists (
    select 1 from public.athletes a
    where a.id = home_exercise_assignments.athlete_id
      and a.coach_id = home_exercise_assignments.coach_id
  ))
  with check (coach_id = (select auth.uid()) and exists (
    select 1 from public.athletes a
    where a.id = home_exercise_assignments.athlete_id
      and a.coach_id = home_exercise_assignments.coach_id
  ));

create policy home_exercise_assignments_delete
  on public.home_exercise_assignments for delete to authenticated
  using (coach_id = (select auth.uid()) and exists (
    select 1 from public.athletes a
    where a.id = home_exercise_assignments.athlete_id
      and a.coach_id = home_exercise_assignments.coach_id
  ));

commit;

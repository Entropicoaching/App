-- Entropi subscription shadow migration 05: workout history and set log.
-- DRAFT ONLY. Do not run against production. Validate in maxhsefxbrvsgolscqwh first.

create table public.sub_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.sub_assignments(id),
  program_id uuid not null references public.sub_programs(id),
  day_id text not null,
  client_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_id),
  check (completed_at is null or completed_at >= started_at)
);

create table public.sub_workout_sets (
  id bigint generated always as identity primary key,
  workout_id uuid not null references public.sub_workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  set_index integer not null check (set_index >= 1),
  reps integer check (reps between 1 and 100),
  weight_kg numeric check (weight_kg >= 0 and weight_kg <= 500),
  rpe numeric check (rpe >= 5 and rpe <= 10),
  logged_at timestamptz not null default now(),
  unique (workout_id, exercise_id, set_index)
);

create index sub_workouts_user_completed
on public.sub_workouts(user_id, completed_at desc);
create index sub_workout_sets_user_ex
on public.sub_workout_sets(user_id, exercise_id, logged_at desc);

alter table public.sub_workouts enable row level security;
alter table public.sub_workout_sets enable row level security;
revoke all on table public.sub_workouts from anon;
revoke all on table public.sub_workout_sets from anon;

-- Completed workouts are written only by sub-10's owner-bound RPC. Keeping
-- read-only policies from the first migration means there is no temporary
-- direct client-write window between sub-05 and sub-10.
create policy entropi_sub_workouts_read_own
on public.sub_workouts for select to authenticated
using (user_id = (select auth.uid()));

create policy entropi_sub_workout_sets_read_own
on public.sub_workout_sets for select to authenticated
using (user_id = (select auth.uid()));

-- A workout must point to the user's own assignment of the same immutable
-- program version. This prevents writing a log against a guessed programme UUID.
create function public.sub_enforce_workout_assignment()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  if new.assignment_id is null then
    raise exception 'Et træningspas kræver en programtildeling';
  end if;

  if not exists (
    select 1 from public.sub_assignments a
    where a.id = new.assignment_id
      and a.user_id = new.user_id
      and a.program_id = new.program_id
  ) then
    raise exception 'Programtildelingen matcher ikke dette træningspas';
  end if;

  if not exists (
    select 1 from public.sub_programs p
    where p.id = new.program_id
      and exists (
        select 1 from jsonb_array_elements(p.content -> 'sessions') s
        where s ->> 'id' = new.day_id
      )
  ) then
    raise exception 'Ukendt pas i programversionen';
  end if;
  return new;
end;
$$;
revoke execute on function public.sub_enforce_workout_assignment() from public, anon, authenticated;

create trigger entropi_sub_enforce_workout_assignment
before insert or update on public.sub_workouts
for each row execute function public.sub_enforce_workout_assignment();

-- The set log is constrained to the exercise list for the workout's selected
-- programme day. The app has no free-text exercises in this product slice.
create function public.sub_enforce_workout_set()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  if not exists (
    select 1
    from public.sub_workouts w
    join public.sub_programs p on p.id = w.program_id
    cross join lateral jsonb_array_elements(p.content -> 'sessions') s
    cross join lateral jsonb_array_elements(s -> 'exercises') e
    where w.id = new.workout_id
      and w.user_id = new.user_id
      and s ->> 'id' = w.day_id
      and e ->> 'id' = new.exercise_id
  ) then
    raise exception 'Øvelsen hører ikke til dette træningspas';
  end if;
  return new;
end;
$$;
revoke execute on function public.sub_enforce_workout_set() from public, anon, authenticated;

create trigger entropi_sub_enforce_workout_set
before insert or update on public.sub_workout_sets
for each row execute function public.sub_enforce_workout_set();

-- Shadow verification:
-- 1. User A cannot select, update, delete, or attach a set to User B's workout.
-- 2. A workout with a guessed member programme UUID is rejected unless User A
--    has an assignment for that exact version.
-- 3. A malformed day_id is rejected against the immutable JSON programme data.
-- 4. A set with an exercise outside the selected programme day is rejected.
-- 5. Free user logging works through the assigned start-2 programme and member
--    history still reads after their entitlement expires.

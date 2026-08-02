-- Entropi subscription shadow migration 10: atomic, immutable completed workout
-- persistence. DRAFT ONLY. Do not run against production.
-- Run only after sub-01 through sub-09 have passed in the isolated shadow.

begin;

alter table public.sub_workouts
  add column if not exists persisted_payload jsonb;

drop policy if exists entropi_sub_workouts_own on public.sub_workouts;
drop policy if exists entropi_sub_workout_sets_own on public.sub_workout_sets;

revoke insert, update, delete, truncate, references, trigger
on table public.sub_workouts, public.sub_workout_sets
from anon, authenticated;
grant select on table public.sub_workouts, public.sub_workout_sets to authenticated;

-- Once persisted_payload is sealed, neither the workout envelope nor its set rows
-- can be changed. The persistence RPC builds both in one transaction and seals
-- the parent only after every set has passed the sub-05 guards.
create function public.sub_enforce_persisted_workout_immutability()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  if old.persisted_payload is not null then
    raise exception 'Et synkroniseret træningspas er uforanderligt';
  end if;
  if old.user_id is distinct from new.user_id
     or old.assignment_id is distinct from new.assignment_id
     or old.program_id is distinct from new.program_id
     or old.day_id is distinct from new.day_id
     or old.client_id is distinct from new.client_id
     or old.started_at is distinct from new.started_at
     or old.completed_at is distinct from new.completed_at then
    raise exception 'Træningspassets identitet kan ikke omskrives';
  end if;
  if new.persisted_payload is null then
    raise exception 'Træningspasset kan kun forsegles';
  end if;
  return new;
end;
$$;

create trigger entropi_sub_persisted_workout_immutability
before update on public.sub_workouts
for each row execute function public.sub_enforce_persisted_workout_immutability();

create function public.sub_enforce_persisted_workout_set_immutability()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_workout_id uuid := new.workout_id;
begin
  if exists (
    select 1 from public.sub_workouts w
    where w.id = v_workout_id and w.persisted_payload is not null
  ) then
    raise exception 'Sæt i et synkroniseret træningspas er uforanderlige';
  end if;
  return new;
end;
$$;

create trigger entropi_sub_persisted_workout_set_immutability
before insert or update on public.sub_workout_sets
for each row execute function public.sub_enforce_persisted_workout_set_immutability();

create function public.sub_persist_completed_workout_v1(
  p_assignment_id uuid,
  p_day_id text,
  p_client_id text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_sets jsonb
)
returns uuid language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_user_id uuid := auth.uid();
  v_program_id uuid;
  v_existing_id uuid;
  v_existing_payload jsonb;
  v_persisted_payload jsonb;
  v_workout_id uuid;
begin
  if v_user_id is null or p_assignment_id is null
     or nullif(trim(p_day_id), '') is null
     or nullif(trim(p_client_id), '') is null
     or p_started_at is null or p_completed_at is null
     or p_completed_at < p_started_at or p_completed_at > now() + interval '5 minutes'
     or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'Ugyldigt eller ufuldstændigt afsluttet træningspas';
  end if;

  select a.program_id into v_program_id
  from public.sub_assignments a
  where a.id = p_assignment_id
    and a.user_id = v_user_id
    and a.assigned_at <= p_started_at
    and (a.ended_at is null or p_started_at <= a.ended_at);
  if not found then
    raise exception 'Programtildelingen var ikke gyldig ved passets start';
  end if;

  v_persisted_payload := jsonb_build_object(
    'assignment_id', p_assignment_id,
    'program_id', v_program_id,
    'day_id', p_day_id,
    'client_id', p_client_id,
    'started_at', p_started_at,
    'completed_at', p_completed_at,
    'sets', p_sets
  );

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_client_id, 3));

  select w.id, w.persisted_payload into v_existing_id, v_existing_payload
  from public.sub_workouts w
  where w.user_id = v_user_id and w.client_id = p_client_id;
  if found then
    if v_existing_payload is distinct from v_persisted_payload then
      raise exception 'Client-id er allerede brugt med et andet workout-payload';
    end if;
    return v_existing_id;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sets) as timing(logged_at timestamptz)
    where timing.logged_at is not null
      and (timing.logged_at < p_started_at or timing.logged_at > p_completed_at)
  ) then
    raise exception 'Et sæts tidspunkt ligger uden for træningspasset';
  end if;

  insert into public.sub_workouts (
    user_id, assignment_id, program_id, day_id, client_id,
    started_at, completed_at, persisted_payload
  ) values (
    v_user_id, p_assignment_id, v_program_id, p_day_id, p_client_id,
    p_started_at, p_completed_at, null
  ) returning id into v_workout_id;

  insert into public.sub_workout_sets (
    workout_id, user_id, exercise_id, set_index, reps,
    weight_kg, rpe, logged_at
  )
  select
    v_workout_id, v_user_id, x.exercise_id, x.set_index, x.reps,
    x.weight_kg, x.rpe, coalesce(x.logged_at, p_completed_at)
  from jsonb_to_recordset(p_sets) as x(
    exercise_id text,
    set_index integer,
    reps integer,
    weight_kg numeric,
    rpe numeric,
    logged_at timestamptz
  );

  if (select count(*) from public.sub_workout_sets s where s.workout_id = v_workout_id)
     <> jsonb_array_length(p_sets) then
    raise exception 'Ikke alle sæt blev gemt';
  end if;

  update public.sub_workouts
  set persisted_payload = v_persisted_payload
  where id = v_workout_id;

  return v_workout_id;
end;
$$;

revoke execute on function public.sub_enforce_persisted_workout_immutability()
from public, anon, authenticated;
revoke execute on function public.sub_enforce_persisted_workout_set_immutability()
from public, anon, authenticated;
revoke execute on function public.sub_persist_completed_workout_v1(uuid, text, text, timestamptz, timestamptz, jsonb)
from public, anon;
grant execute on function public.sub_persist_completed_workout_v1(uuid, text, text, timestamptz, timestamptz, jsonb)
to authenticated;

commit;

-- Shadow verification:
-- 1. authenticated cannot write either workout table directly.
-- 2. The RPC derives auth.uid() and program_id server-side, validates the exact
--    assignment/version/day/exercises, and writes workout + sets atomically.
-- 3. Repeating an identical client_id/payload returns one workout. Reusing the
--    client_id with changed data fails closed.
-- 4. A failed set leaves no partial workout. A sealed workout and its sets
--    reject later updates; client DELETE is denied by privilege and RLS.
-- 5. User B cannot read User A's persisted workout or set rows.

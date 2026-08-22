-- Progressionstilstand v1
-- En versionsstyret, coach-godkendt tilstand for forventet træningsprogression.
-- Kør ikke manuelt i produktion: den skal gennem normal migrationsreview først.

begin;

create table if not exists public.training_progression_states (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('approved', 'superseded')),
  source_week_id uuid not null references public.weeks(id) on delete restrict,
  target_week_id uuid references public.weeks(id) on delete set null,
  target_week_number integer not null check (target_week_number > 0),
  state jsonb not null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_progression_states_athlete_version_key unique (athlete_id, version),
  constraint training_progression_states_state_v1_check check (
    jsonb_typeof(state) = 'object'
    and state ->> 'schema_version' = '1'
    and jsonb_typeof(state -> 'program') = 'object'
    and jsonb_typeof(state -> 'expected_progression') = 'object'
    and jsonb_typeof(state -> 'last_decision') = 'object'
    and jsonb_typeof(state -> 'decision_history') = 'array'
    and jsonb_typeof(state -> 'next_decision') = 'object'
    and jsonb_typeof(state -> 'evidence') = 'object'
  )
);

create index if not exists training_progression_states_athlete_status_version_idx
  on public.training_progression_states (athlete_id, status, version desc);

-- Én gældende, godkendt tilstand pr. atlet. Historik bevares som superseded.
create unique index if not exists training_progression_states_one_approved_idx
  on public.training_progression_states (athlete_id)
  where status = 'approved';

alter table public.training_progression_states enable row level security;
revoke all on table public.training_progression_states from public, anon, authenticated;
grant select, insert, update on table public.training_progression_states to service_role;

create or replace function public.approve_training_progression_state(
  p_athlete_id uuid,
  p_state jsonb,
  p_source_week_id uuid,
  p_target_week_number integer,
  p_approved_by uuid
)
returns public.training_progression_states
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_version integer;
  v_state public.training_progression_states;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.athletes where id = p_athlete_id) then
    raise exception 'athlete_not_found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.weeks
    where id = p_source_week_id and athlete_id = p_athlete_id
  ) then
    raise exception 'source_week_not_found' using errcode = 'P0002';
  end if;
  if p_state is null
    or jsonb_typeof(p_state) <> 'object'
    or p_state ->> 'schema_version' <> '1'
    or jsonb_typeof(p_state -> 'program') <> 'object'
    or jsonb_typeof(p_state -> 'expected_progression') <> 'object'
    or jsonb_typeof(p_state -> 'last_decision') <> 'object'
    or jsonb_typeof(p_state -> 'decision_history') <> 'array'
    or jsonb_typeof(p_state -> 'next_decision') <> 'object'
    or jsonb_typeof(p_state -> 'evidence') <> 'object' then
    raise exception 'invalid_progression_state' using errcode = '22023';
  end if;

  -- Serielle versionsskift pr. atlet: to coach-klik kan ikke overskrive hinanden.
  perform pg_advisory_xact_lock(hashtextextended(p_athlete_id::text, 0));

  update public.training_progression_states
    set status = 'superseded', superseded_at = now(), updated_at = now()
    where athlete_id = p_athlete_id and status = 'approved';

  select coalesce(max(version), 0) + 1
    into v_version
    from public.training_progression_states
    where athlete_id = p_athlete_id;

  insert into public.training_progression_states (
    athlete_id, version, status, source_week_id, target_week_number, state, approved_by
  ) values (
    p_athlete_id, v_version, 'approved', p_source_week_id, p_target_week_number, p_state, p_approved_by
  )
  returning * into v_state;

  return v_state;
end;
$fn$;

revoke all on function public.approve_training_progression_state(uuid, jsonb, uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_training_progression_state(uuid, jsonb, uuid, integer, uuid)
  to service_role;

commit;

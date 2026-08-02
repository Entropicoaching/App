-- Entropi subscription shadow migration 09: persisted week-two proposals and
-- explicit member decisions. DRAFT ONLY. Do not run against production.
-- Run only after sub-01 through sub-08 have passed in the isolated shadow.

begin;

create table public.sub_week_two_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.sub_assignments(id),
  program_id uuid not null references public.sub_programs(id),
  exercise_id text not null,
  evidence_workout_ids uuid[] not null check (cardinality(evidence_workout_ids) = 2),
  current_weight_kg numeric not null check (current_weight_kg >= 0 and current_weight_kg <= 500),
  proposed_weight_kg numeric not null check (proposed_weight_kg >= 0 and proposed_weight_kg <= 500),
  rule_id text not null check (length(trim(rule_id)) between 1 and 100),
  rule_version integer not null check (rule_version >= 1),
  created_at timestamptz not null default now(),
  check (proposed_weight_kg = current_weight_kg + 2.5),
  check (rule_id = 'week-two-plus-2.5kg-rpe7' and rule_version = 1)
);

create table public.sub_week_two_decisions (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.sub_week_two_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null unique,
  decision text not null
    check (decision in ('accept', 'keep', 'manual_review', 'undo_accept')),
  decided_at timestamptz not null default now()
);

create index sub_week_two_proposals_user_created
on public.sub_week_two_proposals(user_id, created_at desc);

create index sub_week_two_decisions_proposal_id
on public.sub_week_two_decisions(proposal_id, id desc);

alter table public.sub_week_two_proposals enable row level security;
alter table public.sub_week_two_decisions enable row level security;

revoke all on table public.sub_week_two_proposals, public.sub_week_two_decisions
from public, anon, authenticated;

grant select on table public.sub_week_two_proposals, public.sub_week_two_decisions
to authenticated;

create policy entropi_sub_week_two_proposals_read_own
on public.sub_week_two_proposals for select to authenticated
using (user_id = (select auth.uid()));

create policy entropi_sub_week_two_decisions_read_own
on public.sub_week_two_decisions for select to authenticated
using (user_id = (select auth.uid()));

-- Published proposals are evidence records, not edits to the immutable program.
create function public.sub_enforce_week_two_proposal_immutability()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  raise exception 'Et oprettet uge-2-forslag er uforanderligt';
end;
$$;

create trigger entropi_sub_week_two_proposal_immutability
before update on public.sub_week_two_proposals
for each row execute function public.sub_enforce_week_two_proposal_immutability();

-- Service-only proposal creation. This narrow pilot rule requires two completed
-- exposures on the exact assignment/program/exercise, every planned set at the
-- top of the prescribed rep range, RPE <= 7, the same current weight, and an
-- increase of exactly 2.5 kg. Any broader rule is a new reviewed migration.
create function public.sub_controlled_create_week_two_proposal(
  p_request_id uuid,
  p_target_user_id uuid,
  p_assignment_id uuid,
  p_exercise_id text,
  p_evidence_workout_ids uuid[],
  p_current_weight_kg numeric,
  p_proposed_weight_kg numeric,
  p_rule_id text,
  p_rule_version integer
)
returns uuid language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_existing public.sub_week_two_proposals%rowtype;
  v_program_id uuid;
  v_exercise_matches integer;
  v_planned_sets integer;
  v_target_reps integer;
  v_passing_workouts integer;
  v_proposal_id uuid;
begin
  if p_request_id is null or p_target_user_id is null or p_assignment_id is null
     or nullif(trim(p_exercise_id), '') is null
     or cardinality(p_evidence_workout_ids) <> 2
     or p_evidence_workout_ids[1] = p_evidence_workout_ids[2]
     or p_current_weight_kg is null or p_proposed_weight_kg is null
     or p_proposed_weight_kg <> p_current_weight_kg + 2.5
     or p_rule_id is distinct from 'week-two-plus-2.5kg-rpe7'
     or p_rule_version is distinct from 1 then
    raise exception 'Ugyldigt eller ufuldstændigt uge-2-forslag';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 1));

  select * into v_existing
  from public.sub_week_two_proposals p
  where p.request_id = p_request_id;
  if found then
    if v_existing.user_id is distinct from p_target_user_id
       or v_existing.assignment_id is distinct from p_assignment_id
       or v_existing.exercise_id is distinct from p_exercise_id
       or v_existing.evidence_workout_ids is distinct from p_evidence_workout_ids
       or v_existing.current_weight_kg is distinct from p_current_weight_kg
       or v_existing.proposed_weight_kg is distinct from p_proposed_weight_kg
       or v_existing.rule_id is distinct from p_rule_id
       or v_existing.rule_version is distinct from p_rule_version then
      raise exception 'Request-id er allerede brugt med andre forslagsdata';
    end if;
    return v_existing.id;
  end if;

  select a.program_id into v_program_id
  from public.sub_assignments a
  where a.id = p_assignment_id
    and a.user_id = p_target_user_id
    and a.ended_at is null;
  if not found then
    raise exception 'Forslaget kræver brugerens aktive tildeling';
  end if;

  select
    count(*),
    max((e ->> 'sets')::integer),
    max(substring(e ->> 'reps' from '([0-9]+)[^0-9]*$')::integer)
  into v_exercise_matches, v_planned_sets, v_target_reps
  from public.sub_programs p
  cross join lateral jsonb_array_elements(p.content -> 'sessions') s
  cross join lateral jsonb_array_elements(s -> 'exercises') e
  where p.id = v_program_id
    and e ->> 'id' = p_exercise_id
  ;

  if v_exercise_matches <> 1 or v_planned_sets is null or v_target_reps is null then
    raise exception 'Programversionen har ikke præcis én kontrollerbar prescription for øvelsen';
  end if;

  select count(*) into v_passing_workouts
  from (
    select w.id
    from unnest(p_evidence_workout_ids) evidence(workout_id)
    join public.sub_workouts w on w.id = evidence.workout_id
    join public.sub_workout_sets ws
      on ws.workout_id = w.id and ws.exercise_id = p_exercise_id
    where w.user_id = p_target_user_id
      and w.assignment_id = p_assignment_id
      and w.program_id = v_program_id
      and w.completed_at is not null
    group by w.id
    having count(*) >= v_planned_sets
       and bool_and(ws.reps is not null and ws.reps >= v_target_reps)
       and bool_and(ws.rpe is not null and ws.rpe <= 7)
       and bool_and(ws.weight_kg is not null and ws.weight_kg = p_current_weight_kg)
  ) passing;

  if v_passing_workouts <> 2 then
    raise exception 'To sammenlignelige gennemførte eksponeringer er ikke dokumenteret';
  end if;

  insert into public.sub_week_two_proposals (
    request_id, user_id, assignment_id, program_id, exercise_id,
    evidence_workout_ids, current_weight_kg, proposed_weight_kg,
    rule_id, rule_version
  ) values (
    p_request_id, p_target_user_id, p_assignment_id, v_program_id, p_exercise_id,
    p_evidence_workout_ids, p_current_weight_kg, p_proposed_weight_kg,
    p_rule_id, p_rule_version
  ) returning id into v_proposal_id;

  return v_proposal_id;
end;
$$;

-- The member may decide only on its own proposal. Decisions are append-only:
-- acceptance never mutates sub_programs or sub_assignments. An accepted choice
-- can be reversed once with an explicit undo_accept event.
create function public.sub_decide_week_two_proposal_v1(
  p_request_id uuid,
  p_proposal_id uuid,
  p_decision text
)
returns bigint language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_existing public.sub_week_two_decisions%rowtype;
  v_latest_decision text;
  v_decision_id bigint;
begin
  if v_user_id is null or p_request_id is null or p_proposal_id is null
     or p_decision not in ('accept', 'keep', 'manual_review', 'undo_accept') then
    raise exception 'Ugyldig uge-2-beslutning';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_proposal_id::text, 2));

  select * into v_existing
  from public.sub_week_two_decisions d
  where d.request_id = p_request_id;
  if found then
    if v_existing.user_id is distinct from v_user_id
       or v_existing.proposal_id is distinct from p_proposal_id
       or v_existing.decision is distinct from p_decision then
      raise exception 'Request-id er allerede brugt med andre beslutningsdata';
    end if;
    return v_existing.id;
  end if;

  select p.user_id into v_owner_id
  from public.sub_week_two_proposals p
  join public.sub_assignments a
    on a.id = p.assignment_id and a.ended_at is null
  where p.id = p_proposal_id;
  if not found or v_owner_id is distinct from v_user_id then
    raise exception 'Uge-2-forslaget tilhører ikke den aktuelle bruger';
  end if;

  select d.decision into v_latest_decision
  from public.sub_week_two_decisions d
  where d.proposal_id = p_proposal_id
  order by d.id desc
  limit 1;

  if v_latest_decision is null and p_decision = 'undo_accept' then
    raise exception 'Der findes ingen accept at fortryde';
  elsif v_latest_decision is not null
        and not (v_latest_decision = 'accept' and p_decision = 'undo_accept') then
    raise exception 'Forslaget har allerede en afsluttende beslutning';
  end if;

  insert into public.sub_week_two_decisions (
    proposal_id, user_id, request_id, decision
  ) values (
    p_proposal_id, v_user_id, p_request_id, p_decision
  ) returning id into v_decision_id;

  return v_decision_id;
end;
$$;

-- Read the effective decision from the latest append-only event. Consumers may
-- use proposed_weight_kg only when latest_decision = 'accept'; undo_accept
-- returns the effective state to the immutable program prescription.
create function public.sub_my_week_two_proposal_state_v1(p_proposal_id uuid)
returns table(
  proposal_id uuid,
  assignment_id uuid,
  program_id uuid,
  exercise_id text,
  current_weight_kg numeric,
  proposed_weight_kg numeric,
  rule_id text,
  rule_version integer,
  latest_decision text,
  latest_decided_at timestamptz
)
language sql stable security definer
set search_path to pg_catalog, public as $$
  select
    p.id,
    p.assignment_id,
    p.program_id,
    p.exercise_id,
    p.current_weight_kg,
    p.proposed_weight_kg,
    p.rule_id,
    p.rule_version,
    d.decision,
    d.decided_at
  from public.sub_week_two_proposals p
  left join lateral (
    select wd.decision, wd.decided_at
    from public.sub_week_two_decisions wd
    where wd.proposal_id = p.id
    order by wd.id desc
    limit 1
  ) d on true
  where p.id = p_proposal_id
    and p.user_id = auth.uid()
$$;

revoke execute on function public.sub_enforce_week_two_proposal_immutability()
from public, anon, authenticated;
revoke execute on function public.sub_controlled_create_week_two_proposal(uuid, uuid, uuid, text, uuid[], numeric, numeric, text, integer)
from public, anon, authenticated;
grant execute on function public.sub_controlled_create_week_two_proposal(uuid, uuid, uuid, text, uuid[], numeric, numeric, text, integer)
to service_role;
revoke execute on function public.sub_decide_week_two_proposal_v1(uuid, uuid, text)
from public, anon;
grant execute on function public.sub_decide_week_two_proposal_v1(uuid, uuid, text)
to authenticated;
revoke execute on function public.sub_my_week_two_proposal_state_v1(uuid)
from public, anon;
grant execute on function public.sub_my_week_two_proposal_state_v1(uuid)
to authenticated;

commit;

-- Shadow verification:
-- 1. Only service_role can create a proposal; two qualifying workouts on the
--    exact active assignment/program/exercise are required.
-- 2. A proposal is a separate immutable row and never changes the published
--    program version, assignment or historical workout sets.
-- 3. The owner can read and explicitly accept/keep/request review through the
--    decision RPC; another authenticated user is rejected.
-- 4. Same request_id is idempotent. Reuse with changed data fails closed.
-- 5. An acceptance can only be reversed by a later explicit undo_accept event.

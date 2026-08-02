-- Entropi subscription shadow migration 12: Free/Member entitlement contract.
-- DRAFT ONLY. Never run against production. Forward-only remediation for
-- entropi-subscription-shadow / maxhsefxbrvsgolscqwh after sub-01 through sub-11.

begin;

-- Fail closed unless this is the exact retained sub-11 state reviewed on
-- 2026-08-02. The hashes are from pg_get_functiondef in the authorised shadow.
do $$
begin
  if (select count(*) from public.sub_programs) <> 6
     or exists (select 1 from public.sub_programs where slug = 'start-2')
     or md5(pg_get_functiondef('public.sub_decide_week_two_proposal_v1(uuid,uuid,text)'::regprocedure))
          <> '26745900faa5506e4c9cf771806be375'
     or md5(pg_get_functiondef('public.sub_my_week_two_proposal_state_v1(uuid)'::regprocedure))
          <> 'a2b77cc0827ffbec4e7145fdb50ba43d'
     or md5(pg_get_functiondef('public.sub_persist_completed_workout_v1(uuid,text,text,timestamptz,timestamptz,jsonb)'::regprocedure))
          <> 'fba56789913dc4db3c9349713a4e0728' then
    raise exception 'sub-12 preflight failed: shadow is not the reviewed sub-11 state';
  end if;
end;
$$;

-- Free has one fixed, immutable programme. It deliberately reuses the reviewed
-- two-day strength prescription rather than inventing a seventh prescription.
insert into public.sub_programs (
  slug, version, status, name, tagline, summary, progression_rule,
  days, min_equipment, levels, min_tier, content, published_at
)
select
  'start-2', 1, 'published', 'Start 2',
  'Fast gratis startprogram · 2 pas om ugen',
  'Det faste gratis startprogram. Ingen automatisk tilpasning eller logning i skyen.',
  'Programmet er fast. Nyt program, tilpasning og persisteret træningslog kræver aktiv member-adgang.',
  2, src.min_equipment, array['begynder', 'oevet']::text[], 'free',
  jsonb_set(src.content, '{templateId}', '"start-2"'::jsonb, false),
  now()
from public.sub_programs src
where src.slug = 'general-strength-2'
  and src.version = 1
  and src.status = 'published'
  and src.min_tier = 'member';

do $$
begin
  if (select count(*) from public.sub_programs where slug = 'start-2' and version = 1
       and status = 'published' and min_tier = 'free' and days = 2) <> 1 then
    raise exception 'sub-12 failed to create exactly one fixed free start-2 programme';
  end if;
end;
$$;

-- Active members may read only their exact assigned member version. Free users
-- see only start-2. A former member may still read an exact version that is
-- referenced by their own persisted workout history.
drop policy entropi_sub_programs_read_tier on public.sub_programs;
create policy entropi_sub_programs_read_tier
on public.sub_programs for select to authenticated
using (
  (status = 'published' and min_tier = 'free' and slug = 'start-2')
  or exists (
    select 1
    from public.sub_assignments a
    where a.program_id = sub_programs.id
      and a.user_id = (select auth.uid())
      and (
        public.sub_current_tier() = 'member'
        or exists (
          select 1 from public.sub_workouts w
          where w.user_id = (select auth.uid())
            and w.assignment_id = a.id
            and w.program_id = sub_programs.id
            and w.persisted_payload is not null
        )
      )
  )
);

-- Keep client-facing RPC names stable while moving their privileged bodies out
-- of the exposed API schema. Public wrappers are SECURITY INVOKER and enforce
-- the entitlement boundary before entering the narrow owner-bound helpers.
create schema sub_private;
revoke all on schema sub_private from public, anon;
grant usage on schema sub_private to authenticated;

alter function public.sub_decide_week_two_proposal_v1(uuid, uuid, text)
  set schema sub_private;
alter function sub_private.sub_decide_week_two_proposal_v1(uuid, uuid, text)
  rename to sub_decide_week_two_proposal_v1_impl;

alter function public.sub_my_week_two_proposal_state_v1(uuid)
  set schema sub_private;
alter function sub_private.sub_my_week_two_proposal_state_v1(uuid)
  rename to sub_my_week_two_proposal_state_v1_impl;

alter function public.sub_persist_completed_workout_v1(uuid, text, text, timestamptz, timestamptz, jsonb)
  set schema sub_private;
alter function sub_private.sub_persist_completed_workout_v1(uuid, text, text, timestamptz, timestamptz, jsonb)
  rename to sub_persist_completed_workout_v1_impl;

revoke execute on function sub_private.sub_decide_week_two_proposal_v1_impl(uuid, uuid, text)
  from public, anon;
revoke execute on function sub_private.sub_my_week_two_proposal_state_v1_impl(uuid)
  from public, anon;
revoke execute on function sub_private.sub_persist_completed_workout_v1_impl(uuid, text, text, timestamptz, timestamptz, jsonb)
  from public, anon;
grant execute on function sub_private.sub_decide_week_two_proposal_v1_impl(uuid, uuid, text)
  to authenticated;
grant execute on function sub_private.sub_my_week_two_proposal_state_v1_impl(uuid)
  to authenticated;
grant execute on function sub_private.sub_persist_completed_workout_v1_impl(uuid, text, text, timestamptz, timestamptz, jsonb)
  to authenticated;

create function public.sub_decide_week_two_proposal_v1(
  p_request_id uuid,
  p_proposal_id uuid,
  p_decision text
)
returns bigint language plpgsql security invoker
set search_path to pg_catalog, public, sub_private as $$
begin
  if not exists (
    select 1 from public.sub_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'member'
      and (e.valid_until is null or e.valid_until > now())
  ) then
    raise exception 'Aktivt medlemskab kræves for en ny uge-2-beslutning';
  end if;
  return sub_private.sub_decide_week_two_proposal_v1_impl(
    p_request_id, p_proposal_id, p_decision
  );
end;
$$;

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
language sql stable security invoker
set search_path to pg_catalog, public, sub_private as $$
  select * from sub_private.sub_my_week_two_proposal_state_v1_impl(p_proposal_id)
$$;

create function public.sub_persist_completed_workout_v1(
  p_assignment_id uuid,
  p_day_id text,
  p_client_id text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_sets jsonb
)
returns uuid language plpgsql security invoker
set search_path to pg_catalog, public, sub_private as $$
begin
  -- The check is intentionally evaluated at sync time. Backdating started_at,
  -- completed_at, assignment IDs or payload data cannot revive expired access.
  if not exists (
    select 1 from public.sub_entitlements e
    where e.user_id = (select auth.uid())
      and e.tier = 'member'
      and (e.valid_until is null or e.valid_until > now())
      and (e.valid_until is null or p_completed_at <= e.valid_until)
  ) then
    raise exception 'Aktivt medlemskab kræves for at gemme et nyt træningspas';
  end if;
  return sub_private.sub_persist_completed_workout_v1_impl(
    p_assignment_id, p_day_id, p_client_id,
    p_started_at, p_completed_at, p_sets
  );
end;
$$;

revoke execute on function public.sub_decide_week_two_proposal_v1(uuid, uuid, text)
  from public, anon;
revoke execute on function public.sub_my_week_two_proposal_state_v1(uuid)
  from public, anon;
revoke execute on function public.sub_persist_completed_workout_v1(uuid, text, text, timestamptz, timestamptz, jsonb)
  from public, anon;
grant execute on function public.sub_decide_week_two_proposal_v1(uuid, uuid, text)
  to authenticated;
grant execute on function public.sub_my_week_two_proposal_state_v1(uuid)
  to authenticated;
grant execute on function public.sub_persist_completed_workout_v1(uuid, text, text, timestamptz, timestamptz, jsonb)
  to authenticated;

-- Service-side plan/progression creation also fails closed after expiry.
create function public.sub_enforce_week_two_member_entitlement()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  if public.sub_effective_tier(new.user_id) <> 'member' then
    raise exception 'Aktivt medlemskab kræves for et nyt uge-2-forslag';
  end if;
  return new;
end;
$$;
revoke execute on function public.sub_enforce_week_two_member_entitlement()
  from public, anon, authenticated;
create trigger entropi_sub_week_two_member_entitlement
before insert on public.sub_week_two_proposals
for each row execute function public.sub_enforce_week_two_member_entitlement();

-- Resolve the three new unindexed-FK findings introduced by sub-09. The
-- proposal decision index remains because it covers its FK and latest-state
-- lookup; an empty pilot table is not a valid reason to remove that index.
create index sub_week_two_proposals_assignment_id
  on public.sub_week_two_proposals(assignment_id);
create index sub_week_two_proposals_program_id
  on public.sub_week_two_proposals(program_id);
create index sub_week_two_decisions_user_id
  on public.sub_week_two_decisions(user_id);

-- Final structural contract: public write/adaptation RPCs are invoker wrappers,
-- no public wrapper is anonymous, and free catalogue access is one fixed row.
do $$
begin
  if (select count(*) from public.sub_programs where status = 'published' and min_tier = 'free') <> 1
     or not exists (select 1 from public.sub_programs where slug = 'start-2' and min_tier = 'free')
     or exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
           'sub_decide_week_two_proposal_v1',
           'sub_my_week_two_proposal_state_v1',
           'sub_persist_completed_workout_v1'
         )
         and p.prosecdef
     )
     or has_function_privilege('anon', 'public.sub_persist_completed_workout_v1(uuid,text,text,timestamptz,timestamptz,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.sub_persist_completed_workout_v1(uuid,text,text,timestamptz,timestamptz,jsonb)', 'execute') then
    raise exception 'sub-12 final entitlement contract assertion failed';
  end if;
end;
$$;

commit;

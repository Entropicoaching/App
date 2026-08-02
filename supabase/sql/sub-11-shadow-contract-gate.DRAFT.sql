-- Entropi subscription shadow migration 11: final privilege boundary and
-- fail-closed contract assertions. DRAFT ONLY. Never run against production.
-- Run last; do not expose the shadow client unless this transaction commits.

begin;

revoke insert, update, delete, truncate, references, trigger
on table public.sub_entitlements, public.sub_programs, public.sub_assignments,
         public.sub_pilot_member_activations, public.sub_week_two_proposals,
         public.sub_week_two_decisions, public.sub_workouts,
         public.sub_workout_sets
from anon, authenticated;

revoke execute on function public.sub_effective_tier(uuid)
from public, anon, authenticated;
revoke execute on function public.sub_controlled_shadow_assign_program(uuid, uuid, uuid, jsonb, text)
from public, anon, authenticated;
revoke execute on function public.sub_controlled_activate_invited_member(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
revoke execute on function public.sub_controlled_create_week_two_proposal(uuid, uuid, uuid, text, uuid[], numeric, numeric, text, integer)
from public, anon, authenticated;

do $$
declare
  v_table text;
  v_function regprocedure;
  v_privilege text;
begin
  foreach v_table in array array[
    'public.sub_entitlements',
    'public.sub_programs',
    'public.sub_assignments',
    'public.sub_pilot_member_activations',
    'public.sub_week_two_proposals',
    'public.sub_week_two_decisions',
    'public.sub_workouts',
    'public.sub_workout_sets'
  ] loop
    foreach v_privilege in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege('anon', v_table, v_privilege)
         or has_table_privilege('authenticated', v_table, v_privilege) then
        raise exception 'Forbudt klient-write privilege % på %', v_privilege, v_table;
      end if;
    end loop;
  end loop;

  foreach v_function in array array[
    'public.sub_effective_tier(uuid)'::regprocedure,
    'public.sub_controlled_shadow_assign_program(uuid,uuid,uuid,jsonb,text)'::regprocedure,
    'public.sub_controlled_activate_invited_member(uuid,uuid,text,timestamptz)'::regprocedure,
    'public.sub_controlled_create_week_two_proposal(uuid,uuid,uuid,text,uuid[],numeric,numeric,text,integer)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_function, 'EXECUTE')
       or has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'Kontrolleret funktion er klient-eksekverbar: %', v_function;
    end if;
  end loop;

  if not has_function_privilege(
       'authenticated',
       'public.sub_current_tier()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.sub_my_access_v1()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.sub_decide_week_two_proposal_v1(uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.sub_persist_completed_workout_v1(uuid,text,text,timestamptz,timestamptz,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.sub_my_week_two_proposal_state_v1(uuid)',
       'EXECUTE'
     ) then
    raise exception 'En tilladt, ejerbunden klientfunktion mangler EXECUTE';
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename in (
        'sub_entitlements', 'sub_programs', 'sub_assignments',
        'sub_pilot_member_activations', 'sub_week_two_proposals',
        'sub_week_two_decisions', 'sub_workouts', 'sub_workout_sets'
      )
      and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'En beskyttet subscription-tabel har en klient-write policy';
  end if;

  if exists (
    with subscription_functions as materialized (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and left(p.proname, 4) = 'sub_'
        and p.prokind in ('f', 'p')
    )
    select 1
    from subscription_functions f
    where pg_get_functiondef(f.oid) ~* 'public[.]profiles|profiles[.]role'
  ) then
    raise exception 'Subscription-autorisation refererer profiles/role';
  end if;
end;
$$;

commit;

-- Passing this file proves only the structural boundary. The separate-user
-- behavioural gates in the runbook are still mandatory before any invitation.

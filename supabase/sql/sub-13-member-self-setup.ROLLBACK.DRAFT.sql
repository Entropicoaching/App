-- Entropi subscription shadow migration 13: data-preserving feature rollback.
-- DRAFT ONLY. Run only in entropi-subscription-shadow / maxhsefxbrvsgolscqwh.
-- Never run in production.
--
-- This disables new self-setup immediately while preserving member preferences,
-- active assignments and immutable programme history. Published setup versions
-- are retired, never edited or deleted. The expanded home/4-day constraints and
-- additive columns intentionally remain because narrowing them after pilot data
-- exists could invalidate retained rows.

begin;

revoke all on function public.sub_complete_my_program_setup_v1(uuid, jsonb, jsonb)
from public, anon, authenticated, service_role;
drop function public.sub_complete_my_program_setup_v1(uuid, jsonb, jsonb);

drop trigger if exists entropi_sub_enforce_setup_assignment_binding_v1
on public.sub_assignments;
drop function if exists public.sub_enforce_setup_assignment_binding_v1();

-- The sub-07 immutability trigger permits published -> retired and forbids all
-- content/provenance edits. Exact assigned retired versions remain readable via
-- the assignment/history branch of the catalogue RLS policy.
update public.sub_programs
set status = 'retired'
where slug like 'setup-v1-%'
  and version = 1
  and status = 'published'
  and content ->> 'setupSchemaVersion' = '1';

do $$
begin
  if to_regprocedure('public.sub_complete_my_program_setup_v1(uuid,jsonb,jsonb)') is not null
     or exists (
       select 1
       from public.sub_programs p
       where p.slug like 'setup-v1-%'
         and p.version = 1
         and p.status = 'published'
         and p.content ->> 'setupSchemaVersion' = '1'
     ) then
    raise exception 'sub-13 feature rollback did not disable new self-setup';
  end if;
end;
$$;

commit;

-- Recovery result: no new setup RPC calls are possible; existing assignments,
-- workouts, member rows and catalogue contents are retained. Re-enabling the
-- feature requires a reviewed forward migration, never ad-hoc row deletion.

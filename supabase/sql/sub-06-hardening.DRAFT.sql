-- Entropi subscription shadow migration 06: privilege assertions and hand-off checks.
-- DRAFT ONLY. Do not run against production. Run only after sub-01 through
-- sub-05 in the isolated shadow project maxhsefxbrvsgolscqwh.

-- Revoke the default PUBLIC execute grant from every new function. These are
-- repeated deliberately here as the final migration boundary: a later edit to
-- an earlier draft must not accidentally make an anonymous RPC available.
revoke execute on function public.sub_effective_tier(uuid) from public, anon, authenticated;
revoke execute on function public.sub_current_tier() from public, anon;
revoke execute on function public.sub_my_access_v1() from public, anon;
revoke execute on function public.sub_members_set_updated_at() from public, anon, authenticated;
revoke execute on function public.sub_enforce_assignment_write() from public, anon, authenticated;
revoke execute on function public.sub_enforce_workout_assignment() from public, anon, authenticated;
revoke execute on function public.sub_enforce_workout_set() from public, anon, authenticated;

-- Fail loudly if a future edit reintroduces an anonymous or cross-user tier path.
do $$
begin
  if has_function_privilege('anon', 'public.sub_current_tier()', 'execute')
     or has_function_privilege('anon', 'public.sub_my_access_v1()', 'execute')
     or has_function_privilege('authenticated', 'public.sub_effective_tier(uuid)', 'execute') then
    raise exception 'Entropi subscription function privilege hardening failed';
  end if;
end;
$$;

-- Run these read-only checks in the shadow SQL editor after the migration.
-- Record the results alongside the before-migration baseline; no existing policy
-- or SECURITY DEFINER function may disappear or change as part of this slice.
--
-- select count(*) from pg_policies where schemaname = 'public';
-- select count(*)
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.prosecdef;
--
-- select policyname, tablename
-- from pg_policies
-- where schemaname = 'public' and policyname like 'entropi_sub_%'
-- order by tablename, policyname;

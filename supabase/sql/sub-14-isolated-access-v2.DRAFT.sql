-- Entropi subscription shadow migration 14: isolated subscription access.
-- DRAFT ONLY. Run only in entropi-subscription-shadow / maxhsefxbrvsgolscqwh.
-- The browser needs only the effective subscription tier. This additive v2
-- endpoint has no dependency on any coaching or athlete domain.

begin;

create or replace function public.sub_my_access_v2()
returns table(tier text)
language sql stable security definer
set search_path to pg_catalog, public as $$
  select public.sub_current_tier()
$$;

revoke all on function public.sub_my_access_v2()
from public, anon, authenticated, service_role;
grant execute on function public.sub_my_access_v2()
to authenticated;

do $$
declare
  v_function regprocedure := 'public.sub_my_access_v2()'::regprocedure;
  v_source text;
begin
  select p.prosrc into v_source
  from pg_proc p
  where p.oid = v_function;

  if regexp_replace(v_source, '\s', '', 'g') <> 'selectpublic.sub_current_tier()'
     or not exists (select 1 from pg_proc p where p.oid = v_function and p.prosecdef)
     or has_function_privilege('public', v_function, 'EXECUTE')
     or has_function_privilege('anon', v_function, 'EXECUTE')
     or not has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'sub-14 isolated access contract failed';
  end if;
end;
$$;

commit;

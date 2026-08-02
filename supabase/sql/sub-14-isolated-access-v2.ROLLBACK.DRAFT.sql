-- Entropi subscription shadow migration 14: isolated access rollback.
-- DRAFT ONLY. Run only in entropi-subscription-shadow / maxhsefxbrvsgolscqwh.
-- Use only together with a client rollback to an earlier access contract.

begin;

revoke all on function public.sub_my_access_v2()
from public, anon, authenticated, service_role;
drop function public.sub_my_access_v2();

commit;

-- DRAFT rollback for the kostplan Set-maerke (ordre 1891); requires separate explicit approval.
-- Removes all kostplan_v1_seen rows. The coach then simply sees no Set-maerke, as before.
-- RESTRICT (no CASCADE): unexpected dependants abort the entire transaction.
begin;
drop policy kostplan_v1_seen_insert on public.kostplan_v1_seen;
drop policy kostplan_v1_seen_read on public.kostplan_v1_seen;
drop table public.kostplan_v1_seen;
commit;

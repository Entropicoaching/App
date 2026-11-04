-- DRAFT rollback for KOST-DATA1; requires separate explicit approval.
-- Removes ALL kostplan_v1 data. An approved recovery plan is required first.
-- RESTRICT (no CASCADE): unexpected dependants abort the entire transaction.
begin;
-- Remove cross-table policy dependencies BEFORE dropping any table (2BP01).
drop policy kostplan_v1_versions_read on public.kostplan_v1_versions;
drop policy kostplan_v1_versions_insert on public.kostplan_v1_versions;
drop policy kostplan_v1_approvals_read on public.kostplan_v1_approvals;
drop policy kostplan_v1_approvals_insert on public.kostplan_v1_approvals;
drop policy kostplan_v1_plans_read on public.kostplan_v1_plans;
drop policy kostplan_v1_plans_insert on public.kostplan_v1_plans;
drop policy kostplan_v1_plans_archive on public.kostplan_v1_plans;
drop trigger kostplan_v1_publish_approval on public.kostplan_v1_approvals;
drop trigger kostplan_v1_prepare_approval on public.kostplan_v1_approvals;
drop function public.kostplan_v1_publish_approval();
drop function public.kostplan_v1_prepare_approval();
drop table public.kostplan_v1_approvals;
drop table public.kostplan_v1_versions;
drop table public.kostplan_v1_plans;
drop function public.kostplan_v1_valid_meals(jsonb);
commit;

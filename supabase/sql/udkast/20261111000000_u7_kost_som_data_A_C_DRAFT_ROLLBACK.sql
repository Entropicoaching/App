-- UDKAST U7 (ordre 76): tilbagerulning af 20261111000000_u7_kost_som_data_A_C_DRAFT.sql.
-- Omvendt rækkefølge C, B, A i én transaktion. Ingen cascade: en uventet afhængighed standser
-- det hele, og intet er rullet tilbage. ALLE data i de nye tabeller går tabt (daterede mål,
-- søvn, smerte, vand, "færdig for i dag" og kostplaner). Appen falder tilbage til telefonens
-- localStorage og viser det samme som U6. Eksisterende tabeller røres ikke.
begin;

-- ===== C. Daterede kostmål =====
drop policy nutrition_targets_v1_insert on public.nutrition_targets_v1;
drop policy nutrition_targets_v1_read on public.nutrition_targets_v1;
drop table public.nutrition_targets_v1;

-- ===== B. Dagsdata =====
drop policy tracking_daily_v1_delete on public.tracking_daily_v1;
drop policy tracking_daily_v1_update on public.tracking_daily_v1;
drop policy tracking_daily_v1_insert on public.tracking_daily_v1;
drop policy tracking_daily_v1_read on public.tracking_daily_v1;
drop table public.tracking_daily_v1;

-- ===== A. Kostplan =====
-- Ordret fra 20261104211000_kostplan_v1_DRAFT_ROLLBACK.sql.
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

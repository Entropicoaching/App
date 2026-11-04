-- DRAFT rollback, manual approval only. Destructive: removes all new tracking data.
-- Export/retention decision must be approved before applying on a populated DB.
begin;
drop table public.tracking_cycle_v1;
drop table public.tracking_cycle_consent_v1;
drop table public.tracking_daily_v1;
drop trigger tracking_guard_athlete_identity_v1 on public.athletes;
drop function public.tracking_guard_athlete_identity_v1();
commit;

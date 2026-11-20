-- DRAFT: Entropi Coach / kostplan Set-maerke (ordre 1891). Written only; requires separate approval to run.
-- Prerequisites: the kostplan_v1 tables from 20261104211000_kostplan_v1_DRAFT.sql
-- (live since 20261108122354), public.athletes(id, user_id, coach_id), auth.uid(),
-- authenticated and anon roles. No existing table, policy, grant or data is changed.
-- One row per athlete and sent day version: a sent week is 7 day versions, so a
-- week has at most 7 rows and the athlete can never write a duplicate.
begin;

create table public.kostplan_v1_seen (
  athlete_id uuid not null references public.athletes(id),
  plan_id uuid not null,
  version_id uuid not null,
  seen_at timestamptz not null default now(),
  primary key (athlete_id, version_id),
  foreign key (plan_id, version_id) references public.kostplan_v1_versions(plan_id, id)
);
create index kostplan_v1_seen_version on public.kostplan_v1_seen (version_id);

alter table public.kostplan_v1_seen enable row level security;

-- The athlete reads own rows; the current coach reads rows for own athletes.
create policy kostplan_v1_seen_read on public.kostplan_v1_seen for select to authenticated
using (exists (
  select 1 from public.athletes a
  where a.id = kostplan_v1_seen.athlete_id
    and (a.user_id = (select auth.uid()) or a.coach_id = (select auth.uid()))
));
-- Only the athlete, only own rows, only a version the coach has sent (approved)
-- on a published plan of that athlete. seen_at is always set by the database.
create policy kostplan_v1_seen_insert on public.kostplan_v1_seen for insert to authenticated
with check (exists (
  select 1 from public.kostplan_v1_plans p
    join public.athletes a on a.id = p.athlete_id
    join public.kostplan_v1_approvals ap on ap.plan_id = p.id
  where p.id = kostplan_v1_seen.plan_id and a.id = kostplan_v1_seen.athlete_id
    and ap.version_id = kostplan_v1_seen.version_id and ap.athlete_id = a.id
    and a.user_id = (select auth.uid()) and p.status = 'godkendt'
));

-- Production gives new public tables everything for the API roles by default; take it back first.
revoke all on table public.kostplan_v1_seen from public, anon, authenticated;
grant select on table public.kostplan_v1_seen to authenticated;
grant insert (athlete_id, plan_id, version_id) on public.kostplan_v1_seen to authenticated;

commit;

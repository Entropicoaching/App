-- DRAFT: manual approval only. Not part of automatic migration application.
-- Requires public.athletes(id uuid, user_id uuid, coach_id uuid), auth.uid(),
-- roles authenticated/anon. Adds one identity guard trigger to athletes; no existing policy is changed.
begin;

-- Fail closed even if existing coach grants permit arbitrary athletes updates.
-- Invoker trigger: permit only the athlete's first self-claim from an unlinked row.
-- This also applies inside SECURITY DEFINER claim functions: auth.uid() is the caller.
-- A trusted maintenance connection with no user JWT can perform account linking.
create function public.tracking_guard_athlete_identity_v1() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if new.user_id is distinct from old.user_id
     and (auth.uid() is not null or current_user in ('authenticated', 'anon'))
     and (old.user_id is null
          and new.user_id = auth.uid()
          and auth.uid() is distinct from old.coach_id) is not true then
    raise exception 'Athlete login identity is not editable by clients' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.tracking_guard_athlete_identity_v1() from public, anon, authenticated;
create trigger tracking_guard_athlete_identity_v1
before update on public.athletes
for each row execute function public.tracking_guard_athlete_identity_v1();

create table public.tracking_daily_v1 (
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  logged_date date not null,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  pain smallint check (pain between 0 and 10),
  pain_location text check (length(pain_location) between 1 and 120 and length(btrim(pain_location)) > 0),
  source text not null default 'athlete_manual' check (source = 'athlete_manual'),
  primary key (athlete_id, logged_date),
  constraint tracking_daily_v1_not_empty check (
    num_nonnulls(sleep_quality, pain) > 0
  ),
  constraint tracking_daily_v1_pain_location check (
    (coalesce(pain, 0) > 0) = (pain_location is not null)
  )
);

-- Current grant, not inferred from saving an optional cycle entry.
-- A separate row per recipient prevents a replacement coach inheriting consent.
create table public.tracking_cycle_consent_v1 (
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  sharing_enabled boolean not null default false,
  primary key (athlete_id, coach_id)
);

create table public.tracking_cycle_v1 (
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  logged_date date not null,
  bleeding text not null check (bleeding in ('none', 'spotting', 'light', 'medium', 'heavy')),
  cycle_day smallint check (cycle_day between 1 and 120),
  note text check (length(note) <= 1000),
  source text not null default 'athlete_manual' check (source = 'athlete_manual'),
  primary key (athlete_id, logged_date)
);

-- Primary keys cover per-athlete date ranges and consent lookups.
create index tracking_daily_v1_date_idx on public.tracking_daily_v1 (logged_date, athlete_id);
create index tracking_cycle_consent_v1_coach_idx on public.tracking_cycle_consent_v1 (coach_id, athlete_id) where sharing_enabled;
-- No broad cycle-date index, aggregate table, view or SECURITY DEFINER bypass.

alter table public.tracking_daily_v1 enable row level security;
alter table public.tracking_daily_v1 force row level security;
alter table public.tracking_cycle_consent_v1 enable row level security;
alter table public.tracking_cycle_consent_v1 force row level security;
alter table public.tracking_cycle_v1 enable row level security;
alter table public.tracking_cycle_v1 force row level security;

revoke all on table public.tracking_daily_v1, public.tracking_cycle_consent_v1, public.tracking_cycle_v1 from public, anon, authenticated;
grant select, insert, delete on table public.tracking_daily_v1, public.tracking_cycle_consent_v1, public.tracking_cycle_v1 to authenticated;
-- Scope columns cannot be moved through UPDATE or ON CONFLICT DO UPDATE.
grant update (sleep_quality, pain, pain_location) on public.tracking_daily_v1 to authenticated;
grant update (sharing_enabled) on public.tracking_cycle_consent_v1 to authenticated;
grant update (bleeding, cycle_day, note) on public.tracking_cycle_v1 to authenticated;

create policy tracking_daily_v1_read on public.tracking_daily_v1 for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id
    and (a.user_id = (select auth.uid()) or a.coach_id = (select auth.uid()))));
create policy tracking_daily_v1_insert on public.tracking_daily_v1 for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id and a.user_id = (select auth.uid())));
create policy tracking_daily_v1_update on public.tracking_daily_v1 for update to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id and a.user_id = (select auth.uid())));
create policy tracking_daily_v1_delete on public.tracking_daily_v1 for delete to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id and a.user_id = (select auth.uid())));

-- Enabled consent is visible only to its current recipient (needed by cycle RLS).
-- Disabled/absent consent is indistinguishable to a coach.
create policy tracking_cycle_consent_v1_read on public.tracking_cycle_consent_v1 for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_cycle_consent_v1.athlete_id and (
    a.user_id = (select auth.uid()) or (
      a.coach_id = (select auth.uid()) and tracking_cycle_consent_v1.coach_id = (select auth.uid()) and sharing_enabled
    ))));
create policy tracking_cycle_consent_v1_insert on public.tracking_cycle_consent_v1 for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = tracking_cycle_consent_v1.athlete_id
    and a.user_id = (select auth.uid()) and a.coach_id = tracking_cycle_consent_v1.coach_id));
-- Owner can revoke/delete even after a change of coach.
create policy tracking_cycle_consent_v1_update on public.tracking_cycle_consent_v1 for update to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_cycle_consent_v1.athlete_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.athletes a where a.id = tracking_cycle_consent_v1.athlete_id
    and a.user_id = (select auth.uid()) and (not sharing_enabled or a.coach_id = tracking_cycle_consent_v1.coach_id)));
create policy tracking_cycle_consent_v1_delete on public.tracking_cycle_consent_v1 for delete to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_cycle_consent_v1.athlete_id and a.user_id = (select auth.uid())));

create policy tracking_cycle_v1_read on public.tracking_cycle_v1 for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_cycle_v1.athlete_id and (
    a.user_id = (select auth.uid()) or (
      a.coach_id = (select auth.uid()) and exists (
        select 1 from public.tracking_cycle_consent_v1 c
        where c.athlete_id = tracking_cycle_v1.athlete_id and c.coach_id = (select auth.uid()) and c.sharing_enabled
      )
    ))));
create policy tracking_cycle_v1_insert on public.tracking_cycle_v1 for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = tracking_cycle_v1.athlete_id and a.user_id = (select auth.uid())));
create policy tracking_cycle_v1_update on public.tracking_cycle_v1 for update to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_cycle_v1.athlete_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.athletes a where a.id = tracking_cycle_v1.athlete_id and a.user_id = (select auth.uid())));
create policy tracking_cycle_v1_delete on public.tracking_cycle_v1 for delete to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_cycle_v1.athlete_id and a.user_id = (select auth.uid())));

commit;

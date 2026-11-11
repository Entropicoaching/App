-- Generalprøve U1 til U8 (ordre 80): produktionens skema lige før kostplanens migration
-- 8. nov. 2026, genskabt i PGlite. Kun struktur, ingen rækker.
-- Kilde: læsende katalogudtræk fra Entropi Coach (dsqgaxwgtcbqgphsofav), optaget
-- 2026-11-08T12:19:45Z (COST-FRESH-CATALOG-RAW-20261108.json, Q1 til Q12).
-- Bevis for troskab: den migration, der faktisk blev kørt live 2026-11-08T12:23:54Z som version
-- 20261108122354 (live/20261108122354_kostplan_v1_identity_and_plans_20261107.sql), stopper ved
-- den mindste afvigelse i athletes' kolonner, regler, rettigheder, ejer, triggere, auth.uid() og
-- claim_athlete_profile_v3. Den kører igennem på dette skema (prøven kræver det).
-- Med: rollerne og deres BYPASSRLS, auth.users' rettigheder, Supabases standardrettigheder for nye
-- objekter, athletes, profiles og meal_logs. Øvrige live-tabeller (uger, pas, video osv.) er ikke
-- med; ingen af pakkerne A til D rører dem.
-- Køres som PGlites bruger postgres. Ærlig grænse: den er superbruger her; live er postgres ikke
-- superbruger, men har BYPASSRLS og ejer public-objekterne. Pakkerne bruger ingen superbrugerret.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role, postgres;
-- Q12: supabase_auth_admin=UC på auth.
grant usage, create on schema auth to supabase_auth_admin;
create table auth.users (id uuid primary key, email text);
alter table auth.users enable row level security;
create function auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;
create function auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$;
create function auth.email() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')) $$;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
alter function auth.email() owner to supabase_auth_admin;
alter table auth.users owner to supabase_auth_admin;
-- Q1: postgres=ar*wdDxtm/supabase_auth_admin på auth.users.
grant all on auth.users to postgres;

-- creatorDefaultAcl: nye tabeller, sekvenser og funktioner fra postgres i public får alt for API-rollerne.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'athlete',
  name text,
  email text,
  created_at timestamptz default now(),
  last_seen timestamptz,
  last_backup_at timestamptz
);

create table public.athletes (
  id uuid not null primary key default gen_random_uuid(),
  coach_id uuid,
  name text not null,
  email text,
  age integer,
  sex text,
  weight_class numeric,
  bodyweight numeric,
  height numeric,
  activity numeric default 1.55,
  goal text default 'maintain',
  status text default 'active',
  squat numeric default 0,
  bench numeric default 0,
  deadlift numeric default 0,
  kcal_target integer,
  protein_target integer,
  notes text,
  created_at timestamptz default now(),
  training_squat numeric default 0,
  training_bench numeric default 0,
  training_deadlift numeric default 0,
  user_id uuid,
  competition_date date,
  hidden boolean not null default false,
  vacation_until date,
  snooze_until date,
  onboarding_completed_at timestamptz,
  constraint athletes_coach_id_fkey foreign key (coach_id) references public.profiles(id) on delete cascade
);
create unique index athletes_user_id_identity_v3_uidx on public.athletes (user_id) where user_id is not null;
create index idx_athletes_coach_id on public.athletes (coach_id);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,
  date date not null default current_date,
  meal text not null,
  kcal integer default 0,
  protein integer default 0,
  carb integer default 0,
  fat integer default 0,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.athletes enable row level security;
alter table public.meal_logs enable row level security;

-- Q1: tabelrettighederne, som de står live.
revoke all on public.athletes, public.profiles from anon, authenticated;
grant select, insert, update, delete, maintain on public.athletes to anon, authenticated;
grant select, insert, truncate, references, trigger, maintain on public.profiles to anon, authenticated;
grant update (name, email, last_seen, last_backup_at) on public.profiles to authenticated;
-- Ikke med: det unikke indeks athletes_coach_email_identity_v3_uidx (dets WHERE kendes ikke ordret).

-- Q4: reglerne, ordret.
create policy athletes_delete on public.athletes for delete using (coach_id = (select auth.uid()));
create policy athletes_insert on public.athletes for insert with check (coach_id = (select auth.uid()));
create policy athletes_select on public.athletes for select using ((coach_id = (select auth.uid()))
  or (email = ((select auth.jwt()) ->> 'email')) or (user_id = (select auth.uid())));
create policy athletes_update on public.athletes for update using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));
create policy meal_logs_all on public.meal_logs
  using ((athlete_id in (select athletes.id from public.athletes where athletes.email = (select auth.email())))
    or (athlete_id in (select athletes.id from public.athletes where athletes.coach_id = (select auth.uid()))))
  with check ((athlete_id in (select athletes.id from public.athletes where athletes.email = (select auth.email())))
    or (athlete_id in (select athletes.id from public.athletes where athletes.coach_id = (select auth.uid()))));
create policy profiles_own on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Atletens eget login-krav, ordret som live (den live migration sammenligner teksten).
CREATE OR REPLACE FUNCTION public.claim_athlete_profile_v3()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_matches uuid[];
  v_athlete_id uuid;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Authenticated user with email required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'athlete'
  ) then
    raise exception 'Only an athlete profile can claim an athlete row';
  end if;

  if exists (
    select 1
    from public.athletes a
    where lower(btrim(a.email)) = v_email
      and a.user_id is not null
      and a.user_id <> v_user_id
  ) then
    raise exception 'Matching athlete profile is already linked to another user';
  end if;

  select array_agg(a.id order by a.id)
    into v_matches
  from public.athletes a
  where lower(btrim(a.email)) = v_email
    and (a.user_id is null or a.user_id = v_user_id);

  if coalesce(array_length(v_matches, 1), 0) = 0 then
    raise exception 'No unclaimed athlete profile matches this login';
  end if;
  if array_length(v_matches, 1) <> 1 then
    raise exception 'Athlete profile match is ambiguous; coach linking required';
  end if;

  v_athlete_id := v_matches[1];

  update public.athletes
  set user_id = v_user_id
  where id = v_athlete_id
    and (user_id is null or user_id = v_user_id);

  if not found then
    raise exception 'Athlete profile could not be claimed';
  end if;

  return v_athlete_id;
end
$function$;
revoke execute on function public.claim_athlete_profile_v3() from public, anon;
grant execute on function public.claim_athlete_profile_v3() to authenticated, service_role;

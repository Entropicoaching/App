-- Ordre 1508: MINIMALT skema til den lokale proeve (pglite). Prod-skemaet ligger ikke i
-- supabase/migrations (kun videocoach, progression og signals), saa de tabeller og kolonner
-- som entropi_training_signals_v1 laeser er genskabt her, ud fra hvad migrationerne og
-- coachBriefingRules-fixturerne bruger. Ingen data, ingen noegler, ingen forbindelse til live.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;

create table public.athletes (
  id uuid primary key, coach_id uuid, name text, hidden boolean default false,
  status text, vacation_until date, user_id uuid);
create table public.weeks (
  id uuid primary key, athlete_id uuid references public.athletes(id), week_number int,
  start_date date, block_name text, status text);
create table public.sessions (
  id uuid primary key, week_id uuid references public.weeks(id), title text,
  session_order int, athlete_comment text);
create table public.exercises (
  id uuid primary key, session_id uuid references public.sessions(id), name text,
  sets int, reps text, intensity text, exercise_order int);
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(), athlete_id uuid references public.athletes(id),
  exercise_id uuid references public.exercises(id), logged_at timestamptz, weight numeric,
  reps_completed int, rpe_planned numeric, rpe_actual numeric, skipped boolean default false);
create table public.readiness_logs (
  athlete_id uuid references public.athletes(id), logged_date date, energy int,
  soreness_level int, sore_zones jsonb);
create table public.personal_records (
  athlete_id uuid references public.athletes(id), exercise_name text, weight numeric,
  reps int, created_at timestamptz);

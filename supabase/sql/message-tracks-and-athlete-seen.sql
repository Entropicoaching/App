-- Opgave B — to beskedspor + "set af atlet" på delt video-feedback.
-- Anvendt på produktion 2026-07-25 via Supabase-migration
-- 'videocoach_message_tracks_and_athlete_seen'. Gemt her for versionsstyring.

-- 1) messages.category. Default bevarer alle eksisterende rækker som 'besked'.
alter table public.messages
  add column if not exists category text not null default 'besked'
  check (category in ('besked','teknik'));

-- 2) video_analyses.athlete_seen_at — hvornår atleten så den delte feedback
--    (coach-værdi: parity med messages.read_by_coach).
alter table public.video_analyses
  add column if not exists athlete_seen_at timestamptz;

-- 3) RLS: atleten må opdatere sine EGNE DELTE målinger.
drop policy if exists entropi_vc3_athlete_mark_seen on public.video_analyses;
create policy entropi_vc3_athlete_mark_seen on public.video_analyses
  for update to authenticated
  using (status = 'shared' and exists (
    select 1 from public.athletes a
    where a.id = video_analyses.athlete_id and a.user_id = auth.uid()))
  with check (status = 'shared' and exists (
    select 1 from public.athletes a
    where a.id = video_analyses.athlete_id and a.user_id = auth.uid()));

-- 4) ... men KUN athlete_seen_at må ændres af atleten. Service-role (agenten,
--    auth.uid()=null) og coachen for atleten går fri. updated_at udelades så
--    set_updated_at-triggeren ikke fælder tjekket. Navnet 'a_...' sikrer at
--    værnet kører FØR de øvrige BEFORE UPDATE-triggere.
create or replace function public.enforce_athlete_seen_only()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  if auth.uid() is null then return new; end if;
  if exists (select 1 from public.athletes a
             where a.id = old.athlete_id and a.coach_id = auth.uid())
  then return new; end if;
  if (to_jsonb(new) - 'athlete_seen_at' - 'updated_at')
     is distinct from (to_jsonb(old) - 'athlete_seen_at' - 'updated_at')
  then raise exception 'Kun athlete_seen_at kan opdateres af atleten'; end if;
  return new;
end $$;

drop trigger if exists a_enforce_athlete_seen_only on public.video_analyses;
create trigger a_enforce_athlete_seen_only
  before update on public.video_analyses
  for each row execute function public.enforce_athlete_seen_only();

-- 5) Udvid RPC'en så teknik-sporet kan vise "set"-status.
drop function if exists public.get_my_shared_video_analyses_v3(integer, integer);
create function public.get_my_shared_video_analyses_v3(p_limit integer default 50, p_offset integer default 0)
returns table(id uuid, lift text, variation text, load_kg numeric, rpe numeric,
  reps_count integer, analyzed_at timestamptz, bar_path jsonb, athlete_feedback jsonb,
  shared_at timestamptz, athlete_seen_at timestamptz)
language sql stable security definer set search_path to pg_catalog, public as $$
  select va.id, va.lift, va.variation, va.load_kg, va.rpe, va.reps_count,
    va.analyzed_at, va.bar_path, va.athlete_feedback, va.shared_at, va.athlete_seen_at
  from public.video_analyses va
  join public.athletes a on a.id = va.athlete_id
  where a.user_id = auth.uid() and va.status = 'shared'
  order by va.analyzed_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.get_my_shared_video_analyses_v3(integer, integer) from public;
revoke execute on function public.get_my_shared_video_analyses_v3(integer, integer) from anon;
grant execute on function public.get_my_shared_video_analyses_v3(integer, integer) to authenticated;

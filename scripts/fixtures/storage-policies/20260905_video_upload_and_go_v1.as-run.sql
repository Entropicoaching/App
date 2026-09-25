-- ALLEREDE KØRT PÅ PRODUKTION 2026-09-05, kør aldrig igen.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videocoach-uploads', 'videocoach-uploads', false, 524288000,
        array['video/mp4','video/quicktime','video/webm','video/x-m4v','video/3gpp'])
on conflict (id) do nothing;

alter table public.video_analyses
  add column if not exists video_path text,
  add column if not exists analysis_state text not null default 'complete';
alter table public.video_analyses
  drop constraint if exists video_analyses_analysis_state_check;
alter table public.video_analyses
  add constraint video_analyses_analysis_state_check
  check (analysis_state in ('awaiting_analysis', 'complete'));
create index if not exists video_analyses_awaiting_idx
  on public.video_analyses (athlete_id, created_at desc)
  where analysis_state = 'awaiting_analysis';

-- Fire policies på storage.objects, alle afgrænset til bucket_id = 'videocoach-uploads'
-- og til at (storage.foldername(name))[1] er et athletes.id:
--   vc_upload_athlete_insert_own  insert  athletes.user_id  = auth.uid()
--   vc_upload_athlete_select_own  select  athletes.user_id  = auth.uid()
--   vc_upload_coach_select        select  athletes.coach_id = auth.uid()
--   vc_upload_coach_delete        delete  athletes.coach_id = auth.uid()

-- FIXTURE (ordre 365): repoets 20260905-fil beskriver de fire policies kun i
-- kommentaren ovenfor. Her er de skrevet ud i den form der koerte i produktion
-- 5.-24. sep: samme tekst som rettelsen 20260923120000, men med ukvalificeret
-- `name` (RAPPORT-333: `where a.id::text = (storage.foldername(name))[1]`,
-- gengivet af Postgres som `storage.foldername(a.name)`).

create policy "vc_upload_athlete_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = (select auth.uid())
    )
  );

create policy "vc_upload_athlete_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = (select auth.uid())
    )
  );

create policy "vc_upload_coach_select"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(name))[1]
        and a.coach_id = (select auth.uid())
    )
  );

create
  policy "vc_upload_coach_delete"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(name))[1]
        and a.coach_id = (select auth.uid())
    )
  );

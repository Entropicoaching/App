-- ORDRE 1952 · coachen kan sende video for sin egen atlet (Marc 20. nov.: "1. ja gr det og 2 ja").
-- UDKAST. Køres af Dhurva i Supabase efter Marcs ja, aldrig af en agent. Rollback: samme navn med _ROLLBACK.
--
-- I dag tager tre steder kun imod atletens eget login (athletes.user_id = auth.uid()):
--   storage-policyen vc_upload_athlete_insert_own, rækkens policy entropi_vc3_athlete_insert_own_draft
--   og dublet-opslaget get_my_video_analysis_submission_identity_v3.
-- Her får coachen samme ret for en atlet, han coacher, med samme coach-tjek som resten af appen
-- (athletes.coach_id = auth.uid(), som entropi_vc3_coach_update og vc_upload_coach_select).
-- Atletens egne policies røres ikke. En fremmed atlet (coach_id er en anden) giver stadig nej.

begin;

-- 1. Klippet i reserven (Supabase-lageret): coachen må lægge et klip i sin atlets mappe.
drop policy if exists "vc_upload_coach_insert_own_athlete" on storage.objects;
create policy "vc_upload_coach_insert_own_athlete" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videocoach-uploads'
    and exists (select 1 from public.athletes a
      where a.id::text = (storage.foldername(objects.name))[1]
        and a.coach_id = (select auth.uid())));

-- 2. Rækken: samme tjekliste som atletens policy, men for coachens egen atlet.
drop policy if exists entropi_vc3_coach_insert_athlete_submission on public.video_analyses;
create policy entropi_vc3_coach_insert_athlete_submission
on public.video_analyses
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and client_analysis_id is not null
  and schema_version = 3
  and schema_v = 3
  and source_mode = 'athlete_submission'
  and status = 'draft'
  and coach_note is null
  and bias_note is null
  and exists (
    select 1
    from public.athletes a
    where a.id = video_analyses.athlete_id
      and a.coach_id = (select auth.uid())
  )
);

-- 3. Dublet-opslaget (samme klip sendt igen): coachen finder også sin egen afsendelse.
create or replace function public.get_my_video_analysis_submission_identity_v3(
  p_client_analysis_id uuid
)
returns table (
  id uuid,
  client_analysis_id uuid,
  athlete_id uuid,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select va.id, va.client_analysis_id, va.athlete_id, va.status::text, va.created_at
  from public.video_analyses va
  join public.athletes a on a.id = va.athlete_id
  where va.client_analysis_id = p_client_analysis_id
    and va.source_mode = 'athlete_submission'
    and va.created_by = (select auth.uid())
    and (a.user_id = (select auth.uid()) or a.coach_id = (select auth.uid()))
  limit 1
$function$;

revoke all on function public.get_my_video_analysis_submission_identity_v3(uuid)
  from public, anon;
grant execute on function public.get_my_video_analysis_submission_identity_v3(uuid)
  to authenticated;

commit;

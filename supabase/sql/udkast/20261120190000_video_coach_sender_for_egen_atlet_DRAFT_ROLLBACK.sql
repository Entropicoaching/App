-- ORDRE 1952 · ROLLBACK af 20261120190000_video_coach_sender_for_egen_atlet_DRAFT.sql.
-- Fjerner coachens to policies og sætter dublet-opslaget tilbage til atletens eget login
-- (som i 20260815123142_videocoach_athlete_draft_idempotency.sql). Rækker og klip, coachen
-- allerede har sendt, bliver liggende.

begin;

drop policy if exists "vc_upload_coach_insert_own_athlete" on storage.objects;
drop policy if exists entropi_vc3_coach_insert_athlete_submission on public.video_analyses;

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
    and a.user_id = (select auth.uid())
  limit 1
$function$;

revoke all on function public.get_my_video_analysis_submission_identity_v3(uuid)
  from public, anon;
grant execute on function public.get_my_video_analysis_submission_identity_v3(uuid)
  to authenticated;

commit;

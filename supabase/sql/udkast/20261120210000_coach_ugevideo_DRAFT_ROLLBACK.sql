-- ORDRE 1953 · rollback af 20261120210000_coach_ugevideo_DRAFT.sql.
-- Fjerner tabellen, dens policies og trigger. Klip i lageret slettes ikke her.
-- Lagerets policy vc_upload_coach_insert_own_athlete bliver stående, fordi ordre 1952 bruger samme policy
-- (Marc sagde ja til den 20. nov.). Skal den også væk, så kør 1952's rollback.

begin;

drop trigger if exists a_coach_week_videos_kun_set on public.coach_week_videos;
drop function if exists public.coach_week_videos_kun_set();
drop table if exists public.coach_week_videos;

commit;

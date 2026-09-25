-- ORDRE 333 · KØRT 24. sep 2026 17:45 af Dhruva (Supabase MCP), Marcs ja.
--
-- Fejlen (fra video_upload_and_go_v1, 5. sep, ORDRE 57): de fire storage-policies
-- skrev `(storage.foldername(name))[1]` INDE i `exists (select 1 from public.athletes a ...)`.
-- public.athletes har selv en kolonne `name`, så Postgres binder `name` til a.name
-- (atletens navn), ikke til storage.objects.name (objektets sti). Postgres' egen
-- gengivelse af policyen viser det: `storage.foldername(a.name)`. Betingelsen er
-- derfor aldrig sand: hver upload afvises (400, RLS), og coachen kan aldrig hente
-- en video. Bucketen har 0 objekter siden 5. sep.
--
-- Rettelsen kvalificerer kolonnen: objects.name. Samme bucket, samme fire navne,
-- samme roller og samme regler; kun kolonnereferencen ændres.

alter policy "vc_upload_athlete_insert_own" on storage.objects
  with check (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(objects.name))[1]
        and a.user_id = (select auth.uid())
    )
  );

alter policy "vc_upload_athlete_select_own" on storage.objects
  using (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(objects.name))[1]
        and a.user_id = (select auth.uid())
    )
  );

alter policy "vc_upload_coach_select" on storage.objects
  using (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(objects.name))[1]
        and a.coach_id = (select auth.uid())
    )
  );

alter policy "vc_upload_coach_delete" on storage.objects
  using (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(objects.name))[1]
        and a.coach_id = (select auth.uid())
    )
  );

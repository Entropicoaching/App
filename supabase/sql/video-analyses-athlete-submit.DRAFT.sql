-- Entropi VideoCoach: allow an authenticated athlete to submit only a draft
-- that belongs to their own athletes row. Coach review remains authoritative.
-- Prepared locally; do not run until the matching app/VideoCoach build is ready.

begin;

grant insert on table public.video_analyses to authenticated;

drop policy if exists entropi_vc3_athlete_insert_own_draft
  on public.video_analyses;

create policy entropi_vc3_athlete_insert_own_draft
on public.video_analyses
for insert
to authenticated
with check (
  created_by = auth.uid()
  and source_mode = 'athlete_submission'
  and status = 'draft'
  and athlete_id in (
    select a.id
    from public.athletes a
    where a.user_id = auth.uid()
  )
);

-- The original coach update policy only accepts rows created by the coach.
-- Athlete submissions must remain reviewable by that athlete's coach. The v3
-- trigger keeps created_by immutable, while this policy keeps coach ownership
-- scoped through athletes.coach_id.
drop policy if exists entropi_vc3_coach_update
  on public.video_analyses;

create policy entropi_vc3_coach_update
on public.video_analyses
for update
to authenticated
using (
  exists (
    select 1
    from public.athletes a
    where a.id = video_analyses.athlete_id
      and a.coach_id = auth.uid()
  )
)
with check (
  source_mode in ('coach_web', 'desktop_import', 'athlete_submission')
  and exists (
    select 1
    from public.athletes a
    where a.id = video_analyses.athlete_id
      and a.coach_id = auth.uid()
  )
);

commit;

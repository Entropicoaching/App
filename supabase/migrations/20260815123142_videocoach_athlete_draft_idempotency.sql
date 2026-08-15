-- VideoCoach: authenticated athletes may create their own draft. A narrow RPC
-- verifies idempotent retries without exposing the complete analysis row.

alter table public.video_analyses enable row level security;

-- Appen sender ikke created_by fra browseren. Databasen skal knytte rækken til
-- den autentificerede bruger, før INSERT-policyens WITH CHECK evalueres.
alter table public.video_analyses
  alter column created_by set default auth.uid();

-- Idempotensflowet kræver en entydig client_analysis_id. Stop migrationen
-- tydeligt ved historiske dubletter i stedet for at vælge en vilkårlig række.
do $duplicate_guard$
begin
  if exists (
    select 1
    from public.video_analyses
    where client_analysis_id is not null
    group by client_analysis_id
    having count(*) > 1
  ) then
    raise exception 'duplicate video_analyses.client_analysis_id values must be resolved before migration';
  end if;
end
$duplicate_guard$;

create unique index if not exists video_analyses_client_analysis_id_v3_uidx
  on public.video_analyses (client_analysis_id)
  where client_analysis_id is not null;

-- Browservalidering er kun UX. Nye/ændrede v3-rækker skal også afvises i
-- databasen, hvis en klient omgår broen. NOT VALID undgår at blokere rollout
-- på historiske legacy-rækker, men håndhæver kontrakten fremadrettet.
do $payload_constraint$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.video_analyses'::regclass
      and conname = 'video_analyses_v3_payload_bounds'
  ) then
    alter table public.video_analyses
      add constraint video_analyses_v3_payload_bounds check (
        coalesce(source_mode, '') <> 'athlete_submission'
        or coalesce((
          schema_version = 3
          and schema_v = 3
          and reps_count between 1 and 20
          and (load_kg is null or load_kg between 0 and 1000)
          and (rpe is null or rpe between 0 and 10)
          and (low_conf_pct is null or low_conf_pct between 0 and 100)
          and (position_quality_pct is null or position_quality_pct between 0 and 100)
          and jsonb_typeof(metrics) = 'object'
          and pg_column_size(metrics) <= 262144
          and case when jsonb_typeof(findings) = 'array'
            then jsonb_array_length(findings) <= 32 and pg_column_size(findings) <= 131072
            else false
          end
          and case when jsonb_typeof(rep_details) = 'array'
            then jsonb_array_length(rep_details) = reps_count
              and pg_column_size(rep_details) <= 131072
            else false
          end
          and (bar_path is null or (
            jsonb_typeof(bar_path) = 'object' and pg_column_size(bar_path) <= 262144
          ))
          and coach_note is null
          and bias_note is null
        ), false)
      ) not valid;
  end if;
end
$payload_constraint$;

grant insert on table public.video_analyses to authenticated;

drop policy if exists entropi_vc3_athlete_insert_own_draft
  on public.video_analyses;

create policy entropi_vc3_athlete_insert_own_draft
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
      and a.user_id = (select auth.uid())
  )
);

drop policy if exists entropi_vc3_athlete_select_own_draft
  on public.video_analyses;

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
      and a.coach_id = (select auth.uid())
  )
)
with check (
  source_mode in ('coach_web', 'desktop_import', 'athlete_submission')
  and exists (
    select 1
    from public.athletes a
    where a.id = video_analyses.athlete_id
      and a.coach_id = (select auth.uid())
  )
);

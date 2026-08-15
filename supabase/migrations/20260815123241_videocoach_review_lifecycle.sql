-- VideoCoach: enforce immutable identity and explicit review transitions.

create or replace function public.entropi_video_analysis_lifecycle_v3()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.schema_v = new.schema_version;

  if tg_op = 'UPDATE' then
    if new.client_analysis_id is distinct from old.client_analysis_id then
      raise exception 'client_analysis_id is immutable';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable';
    end if;
    if new.source_mode is distinct from old.source_mode then
      raise exception 'source_mode is immutable';
    end if;
    if new.athlete_id is distinct from old.athlete_id then
      raise exception 'athlete_id is immutable';
    end if;
    if not (
      new.status = old.status
      or (old.status = 'draft' and new.status in ('coach_approved', 'shared', 'invalid'))
      or (old.status = 'coach_approved' and new.status in ('shared', 'invalid'))
      or (old.status = 'shared' and new.status = 'invalid')
      or (old.status = 'invalid' and new.status = 'draft')
    ) then
      raise exception 'invalid VideoCoach status transition: % -> %', old.status, new.status;
    end if;

    -- En ny delingscyklus skal altid være ulæst for atleten. Ellers kan en
    -- tidligere athlete_seen_at overleve shared -> invalid -> draft -> shared.
    if new.status is distinct from old.status then
      new.athlete_seen_at = null;
    end if;
  elsif new.status = 'shared' then
    new.athlete_seen_at = null;
  end if;

  if new.status = 'draft' then
    new.approved_at = null;
    new.shared_at = null;
  elsif new.status = 'coach_approved' then
    if tg_op = 'INSERT' or old.status is distinct from new.status or new.approved_at is null then
      new.approved_at = now();
    end if;
    new.shared_at = null;
  elsif new.status = 'shared' then
    if new.approved_at is null then
      new.approved_at = now();
    end if;
    if tg_op = 'INSERT' or old.status is distinct from new.status or new.shared_at is null then
      new.shared_at = now();
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists video_analyses_lifecycle_v3
  on public.video_analyses;

create trigger video_analyses_lifecycle_v3
before insert or update on public.video_analyses
for each row execute function public.entropi_video_analysis_lifecycle_v3();

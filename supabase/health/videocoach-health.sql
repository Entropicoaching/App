-- VideoCoach-sundhedstjek (ordre 365). Kun SELECT, kun taellinger, ingen navne.
-- Koeres af Dhruva med Supabase MCP execute_sql (hele filen som query).
--
-- En raekke pr. dag (Europe/Copenhagen) for de sidste 14 dage:
--   objekter      = nye objekter i bucketen videocoach-uploads
--   indsendelser  = nye raekker i public.video_analyses
--   med_video     = heraf raekker med video_path (upload-sporet)
--   uden_objekt   = heraf raekker hvis video_path ikke findes i bucketen
-- Plus een raekke 'ADVARSEL' naar der er indsendelser med video uden objekt,
-- eller 0 objekter i de sidste 7 dage. Ingen advarsel = ingen ADVARSEL-raekke.
-- Baggrund: 5.-24. sep afviste policyerne hver upload og bucketen stod tom i 19 dage.

with days as (
  select (generate_series(
            (now() at time zone 'Europe/Copenhagen')::date - 13,
            (now() at time zone 'Europe/Copenhagen')::date,
            interval '1 day'))::date as day
),
objs as (
  select (o.created_at at time zone 'Europe/Copenhagen')::date as day, count(*) as n
  from storage.objects o
  where o.bucket_id = 'videocoach-uploads'
    and o.created_at >= now() - interval '15 days'
  group by 1
),
subs as (
  select (va.created_at at time zone 'Europe/Copenhagen')::date as day,
         count(*) as n,
         count(*) filter (where va.video_path is not null) as med_video,
         count(*) filter (
           where va.video_path is not null
             and not exists (
               select 1 from storage.objects o
               where o.bucket_id = 'videocoach-uploads'
                 and o.name = va.video_path
             )
         ) as uden_objekt
  from public.video_analyses va
  where va.created_at >= now() - interval '15 days'
  group by 1
),
per_day as (
  select d.day,
         coalesce(o.n, 0) as objekter,
         coalesce(s.n, 0) as indsendelser,
         coalesce(s.med_video, 0) as med_video,
         coalesce(s.uden_objekt, 0) as uden_objekt
  from days d
  left join objs o on o.day = d.day
  left join subs s on s.day = d.day
),
warn as (
  select
    sum(uden_objekt) as uden_objekt_14d,
    sum(objekter) filter (where day > (now() at time zone 'Europe/Copenhagen')::date - 7) as objekter_7d
  from per_day
)
select day::text as dag, objekter, indsendelser, med_video, uden_objekt, null::text as besked
from per_day
union all
select 'ADVARSEL', null, null, null, null,
       concat_ws('; ',
         case when w.uden_objekt_14d > 0
              then w.uden_objekt_14d || ' indsendelser med video uden objekt i bucketen (14 dage)' end,
         case when w.objekter_7d = 0
              then '0 objekter i videocoach-uploads de sidste 7 dage' end)
from warn w
where w.uden_objekt_14d > 0 or w.objekter_7d = 0
order by 1;

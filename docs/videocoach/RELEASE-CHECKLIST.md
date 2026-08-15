# VideoCoach v3 — sikker release

VideoCoach-koden og databasekontrakten skal udgives samlet. GitHub Pages-workflowet
kører **ikke** Supabase-migrationer, så et almindeligt push er ikke en fuld release.

## 1. Read-only preflight på produktion

Kør uden at ændre data og gem kun summer — aldrig atletdata:

```sql
select count(*) as duplicate_client_ids
from (
  select client_analysis_id
  from public.video_analyses
  where client_analysis_id is not null
  group by client_analysis_id
  having count(*) > 1
) duplicates;

select column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'video_analyses'
  and column_name = 'created_by';

select
  count(*) filter (where status in ('coach_approved', 'shared')) as reviewed,
  count(*) filter (
    where status in ('coach_approved', 'shared')
      and metrics is not null
      and not exists (
        select 1
        from jsonb_each(
          case when jsonb_typeof(metrics) = 'object' then metrics else '{}'::jsonb end
        ) metric
        where jsonb_typeof(metric.value -> 'confidence') = 'number'
          and (metric.value ->> 'confidence')::numeric >= 0.75
      )
  ) as reviewed_without_confident_metric
from public.video_analyses;

select baseline_version, count(*)
from public.athlete_baselines_v3
group by baseline_version
order by baseline_version;
```

Port: `duplicate_client_ids = 0`. De øvrige tal bruges til at godkende den
forventede v2-rebuild; v1-cachen slettes ikke af migrationen.

## 2. Schema-klon eller shadow først

Anvend de tre versionsstyrede migrationer i rækkefølge og verificér:

- atlet kan kun indsætte egen schema-v3 draft;
- samme `client_analysis_id` giver én række, også ved mistet svar og retry;
- coach kan godkende og dele, mens atleten ikke kan;
- ny delingscyklus nulstiller `athlete_seen_at`;
- `metrics = []` og tekst i `metric.value` aborterer ikke coach-review;
- v2-baseline medregner kun numerisk metric-confidence på mindst `0.75`.

## 3. Produktion kræver særskilt godkendelse

1. Få eksplicit godkendelse til produktionsmigrationen.
2. Anvend migrationerne før webdeploy.
3. Verificér read-only, at RPC, unique-index, RLS-policy og v2-baselines findes.
4. Deploy derefter app-buildet.
5. Smoke-test coach-, atlet- og offentlig version med testprofiler uden at ændre
   rigtige atletdata.

Rollback af app-buildet må ikke ledsages af blind sletning af databaseobjekter.
Den gamle v1-baseline bevares netop for sikker rollback og sammenligning.

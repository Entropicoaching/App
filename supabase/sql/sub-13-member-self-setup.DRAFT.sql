-- Entropi subscription shadow migration 13: owner-bound initial member setup.
-- DRAFT ONLY. Run only in entropi-subscription-shadow / maxhsefxbrvsgolscqwh.
-- Never run this file in production. It is additive: the six reviewed source
-- programmes are read but never updated, retired or deleted.
--
-- Required order: sub-01 through sub-12-tier-contract-remediation.
-- Data-preserving feature rollback lives in the separate
-- sub-13-member-self-setup.ROLLBACK.DRAFT.sql file.

begin;

-- Expand preferences to the product's two reviewed environments and allow the
-- reviewed 2/3/4-day lanes for both experience levels. Legacy rows remain
-- valid because setup-specific columns are nullable until this RPC completes.
alter table public.sub_members
  drop constraint if exists sub_members_equipment_check,
  drop constraint if exists sub_members_check,
  drop constraint if exists sub_members_equipment_v2_check,
  drop constraint if exists sub_members_setup_v1_check;

alter table public.sub_members
  add column if not exists goal text,
  add column if not exists squat_style text,
  add column if not exists deadlift_style text,
  add column if not exists baselines jsonb,
  add column if not exists setup_schema_version integer,
  add column if not exists baseline_policy_version integer,
  add column if not exists program_setup_completed_at timestamptz,
  add constraint sub_members_equipment_v2_check
    check (equipment in ('gym', 'home')),
  add constraint sub_members_setup_v1_check check (
    setup_schema_version is null
    or (
      setup_schema_version = 1
      and baseline_policy_version = 1
      and goal in ('general-strength', 'powerlifting-foundation')
      and level in ('begynder', 'oevet')
      and days_per_week in (2, 3, 4)
      and equipment in ('gym', 'home')
      and squat_style in ('high-bar', 'low-bar')
      and deadlift_style in ('conventional', 'sumo')
      and jsonb_typeof(baselines) = 'object'
      and program_setup_completed_at is not null
    )
  );

-- Migration-only catalogue builders. They are never callable by a client and
-- are dropped again before commit. The explicit role map is the reviewed
-- boundary between a gym framework and honest home exercise names/IDs.
create or replace function public.sub_setup_map_exercise_v1(
  p_exercise jsonb,
  p_equipment text,
  p_level text,
  p_squat_style text,
  p_deadlift_style text
)
returns jsonb language plpgsql immutable security definer
set search_path to pg_catalog, public as $$
declare
  v_role text := p_exercise ->> 'role';
  v_id text;
  v_name text;
  v_sets integer;
  v_target_rpe text;
  v_week_one_percent numeric;
  v_result jsonb;
begin
  if jsonb_typeof(p_exercise) <> 'object' or nullif(v_role, '') is null then
    raise exception 'Setup-kataloget indeholder en ugyldig øvelse';
  end if;

  if p_equipment = 'gym' then
    if v_role = 'squat-pattern' then
      if p_squat_style = 'high-bar' then
        v_id := 'high-bar-squat';
        v_name := 'High-bar squat';
      elsif p_squat_style = 'low-bar' then
        v_id := 'low-bar-squat';
        v_name := 'Low-bar squat';
      else
        raise exception 'Ukendt squat-variant';
      end if;
    elsif v_role = 'hinge-pattern' then
      if p_deadlift_style = 'conventional' then
        v_id := 'conventional-deadlift';
        v_name := 'Konventionel dødløft';
      elsif p_deadlift_style = 'sumo' then
        v_id := 'sumo-deadlift';
        v_name := 'Sumo dødløft';
      else
        raise exception 'Ukendt dødløftvariant';
      end if;
    else
      -- Assistance IDs remain exactly as reviewed. Names are canonicalised
      -- here so legacy mojibake can never enter a newly published setup row.
      v_id := p_exercise ->> 'id';
      v_name := case p_exercise ->> 'id'
        when 'barbell-bench-press' then 'Bænkpres'
        when 'chest-supported-row' then 'Chest-supported row'
        when 'romanian-deadlift' then 'Rumænsk dødløft'
        when 'dumbbell-incline-press' then 'Skrå håndvægtspres'
        when 'split-squat' then 'Split squat'
        when 'pause-squat' then 'Pausesquat'
        when 'close-grip-bench-press' then 'Smal bænkpres'
        when 'ab-wheel' then 'Ab wheel'
        when 'overhead-press' then 'Stående skulderpres'
        when 'lat-pulldown' then 'Lat pulldown'
        when 'lateral-raise' then 'Side laterals'
        else null
      end;
    end if;
  elsif p_equipment = 'home' then
    v_id := case v_role
      when 'squat-pattern' then
        case p_squat_style
          when 'high-bar' then 'home-goblet-squat'
          when 'low-bar' then 'home-box-squat'
          else null
        end
      when 'bench-pattern' then 'home-dumbbell-bench-press'
      when 'hinge-pattern' then
        case p_deadlift_style
          when 'conventional' then 'home-dumbbell-deadlift'
          when 'sumo' then 'home-dumbbell-sumo-deadlift'
          else null
        end
      when 'hinge-assistance' then 'home-dumbbell-rdl'
      when 'squat-assistance' then 'home-split-squat'
      when 'squat-variation' then 'home-split-squat'
      when 'lower-assistance' then 'home-reverse-lunge'
      when 'pull' then 'home-one-arm-row'
      when 'upper-press-variation' then 'home-dumbbell-floor-press'
      when 'bench-variation' then 'home-close-grip-push-up'
      when 'upper-press-assistance' then 'home-dumbbell-overhead-press'
      when 'vertical-pull' then 'home-band-pulldown'
      when 'upper-assistance' then 'home-lateral-raise'
      when 'core' then 'home-dead-bug'
      else null
    end;

    v_name := case v_id
      when 'home-goblet-squat' then 'Goblet squat'
      when 'home-box-squat' then 'Box squat med håndvægt'
      when 'home-dumbbell-bench-press' then 'Håndvægtsbænkpres'
      when 'home-dumbbell-deadlift' then 'Dødløft med håndvægte'
      when 'home-dumbbell-sumo-deadlift' then 'Sumo-dødløft med håndvægt'
      when 'home-dumbbell-rdl' then 'Rumænsk dødløft med håndvægte'
      when 'home-split-squat' then 'Split squat'
      when 'home-reverse-lunge' then 'Baglæns udfald'
      when 'home-one-arm-row' then 'Enarmet håndvægtsroning'
      when 'home-dumbbell-floor-press' then 'Floor press med håndvægte'
      when 'home-close-grip-push-up' then 'Smalle armstrækninger'
      when 'home-dumbbell-overhead-press' then 'Skulderpres med håndvægte'
      when 'home-band-pulldown' then 'Nedtræk med elastik'
      when 'home-lateral-raise' then 'Side laterals med håndvægte'
      when 'home-dead-bug' then 'Dead bug'
      else null
    end;
  else
    raise exception 'Ukendt udstyrsbane';
  end if;

  if nullif(v_id, '') is null or nullif(v_name, '') is null then
    raise exception 'Ingen reviewet øvelse for rolle % i %', v_role, p_equipment;
  end if;

  if p_level not in ('begynder', 'oevet') then
    raise exception 'Ukendt erfaringsbane';
  end if;

  v_sets := (p_exercise ->> 'sets')::integer;
  v_target_rpe := replace(p_exercise ->> 'targetRpe', U&'\00E2\20AC\201C', '–');
  v_week_one_percent := nullif(p_exercise ->> 'weekOnePercentOfEstimated1RM', '')::numeric;
  if p_level = 'begynder' then
    v_sets := least(v_sets, 2);
    v_target_rpe := '6';
    if v_role in ('squat-pattern', 'bench-pattern', 'hinge-pattern')
       and v_week_one_percent is not null then
      v_week_one_percent := round(greatest(0.5, v_week_one_percent - 0.025), 3);
    end if;
  end if;

  v_result := (p_exercise - 'id' - 'name' - 'equipment' - 'reps'
                            - 'targetRpe' - 'sets'
                            - 'weekOnePercentOfEstimated1RM'
                            - 'progressionPercent' - 'loadIncrementKg'
                            - 'maximumRealizedProgressionPercent'
                            - 'experienceLane' - 'equipmentLane'
                            - 'libraryVersion' - 'status' - 'roleClass'
                            - 'selection' - 'stylePreference'
                            - 'substitutionMode')
         || jsonb_build_object(
    'id', v_id,
    'name', v_name,
    'equipment', p_equipment,
    'sets', v_sets,
    'reps', replace(p_exercise ->> 'reps', U&'\00E2\20AC\201C', '–'),
    'targetRpe', v_target_rpe,
    'loadIncrementKg', case p_equipment when 'home' then 1 else 2.5 end,
    'maximumRealizedProgressionPercent', 0.03,
    'experienceLane', p_level,
    'equipmentLane', p_equipment,
    'libraryVersion', 2,
    'status', 'review',
    'roleClass', case
      when v_role in ('squat-pattern', 'bench-pattern', 'hinge-pattern') then 'main'
      else 'assistance'
    end,
    'selection', case
      when v_role in ('squat-pattern', 'hinge-pattern') then 'athlete-style-preference'
      else 'canonical-review-choice'
    end,
    'stylePreference', case
      when v_role = 'squat-pattern' then p_squat_style
      when v_role = 'hinge-pattern' then p_deadlift_style
      else null
    end,
    'substitutionMode', 'manual-only'
  );

  if v_week_one_percent is not null then
    v_result := v_result || jsonb_build_object(
      'weekOnePercentOfEstimated1RM', v_week_one_percent,
      'progressionPercent', 0.025
    );
  end if;

  return v_result;
end;
$$;

revoke execute on function public.sub_setup_map_exercise_v1(jsonb, text, text, text, text)
from public, anon, authenticated, service_role;

create or replace function public.sub_setup_build_content_v1(
  p_content jsonb,
  p_equipment text,
  p_level text,
  p_squat_style text,
  p_deadlift_style text,
  p_template_id text
)
returns jsonb language plpgsql immutable security definer
set search_path to pg_catalog, public as $$
declare
  v_sessions jsonb;
begin
  if jsonb_typeof(p_content) <> 'object'
     or jsonb_typeof(p_content -> 'sessions') <> 'array'
     or jsonb_array_length(p_content -> 'sessions') = 0 then
    raise exception 'Kildeprogrammet mangler reviewede pas';
  end if;

  select jsonb_agg(
           (s.session_json - 'exercises') || jsonb_build_object(
             'exercises', (
               select jsonb_agg(
                        public.sub_setup_map_exercise_v1(
                          e.exercise_json, p_equipment, p_level,
                          p_squat_style, p_deadlift_style
                        )
                        order by e.exercise_order
                      )
               from jsonb_array_elements(s.session_json -> 'exercises')
                    with ordinality as e(exercise_json, exercise_order)
             )
           )
           order by s.session_order
         )
    into v_sessions
  from jsonb_array_elements(p_content -> 'sessions')
       with ordinality as s(session_json, session_order);

  if v_sessions is null
     or exists (
       select 1
       from jsonb_array_elements(v_sessions) as sessions(session_json)
       where jsonb_typeof(session_json -> 'exercises') <> 'array'
          or jsonb_array_length(session_json -> 'exercises') = 0
     ) then
    raise exception 'Setup-kataloget kunne ikke bygge alle øvelser';
  end if;

  return (p_content - 'sessions' - 'equipment' - 'templateId'
                    - 'setupSchemaVersion' - 'baselinePolicyVersion'
                    - 'squatStyle' - 'deadliftStyle' - 'level'
                    - 'engineVersion' - 'exerciseCatalogueVersion'
                    - 'prescriptionLibraryVersion' - 'templateSchemaVersion')
         || jsonb_build_object(
              'sessions', v_sessions,
              'equipment', p_equipment,
              'templateId', p_template_id,
              'setupSchemaVersion', 1,
              'baselinePolicyVersion', 1,
              'engineVersion', 3,
              'exerciseCatalogueVersion', 2,
              'prescriptionLibraryVersion', 2,
              'templateSchemaVersion', 3,
              'level', p_level,
              'squatStyle', p_squat_style,
              'deadliftStyle', p_deadlift_style
            );
end;
$$;

revoke execute on function public.sub_setup_build_content_v1(jsonb, text, text, text, text, text)
from public, anon, authenticated, service_role;

-- Fail closed unless the six immutable member frameworks used as sources are
-- still present exactly once. start-2 is intentionally not a setup source.
do $$
begin
  if (
    select count(*)
    from public.sub_programs p
    where p.slug in (
      'general-strength-2', 'general-strength-3', 'general-strength-4',
      'powerlifting-foundation-2', 'powerlifting-foundation-3',
      'powerlifting-foundation-4'
    )
      and p.version = 1
      and p.status = 'published'
      and p.min_tier = 'member'
      and p.published_at is not null
      and jsonb_typeof(p.content -> 'sessions') = 'array'
      and jsonb_array_length(p.content -> 'sessions') = p.days
  ) <> 6 then
    raise exception 'sub-13 preflight failed: de seks immutable member-rammer mangler';
  end if;
end;
$$;

-- Six goal/day frameworks × two experience lanes × two environments × two
-- squat styles × two deadlift styles = 96 immutable setup versions. Level is
-- an immutable catalogue axis because beginner dose is deliberately lower.
-- Style axes remain explicit for home because they select honest variants.
with source_programmes as (
  select p.*
  from public.sub_programs p
  where p.slug in (
    'general-strength-2', 'general-strength-3', 'general-strength-4',
    'powerlifting-foundation-2', 'powerlifting-foundation-3',
    'powerlifting-foundation-4'
  )
    and p.version = 1
    and p.status = 'published'
    and p.min_tier = 'member'
),
equipment_axis(equipment, min_equipment) as (
  values ('gym'::text, 2), ('home'::text, 1)
),
level_axis(level) as (
  values ('begynder'::text), ('oevet'::text)
),
squat_axis(squat_style) as (
  values ('high-bar'::text), ('low-bar'::text)
),
deadlift_axis(deadlift_style) as (
  values ('conventional'::text), ('sumo'::text)
),
setup_catalogue as (
  select
    'setup-v1-' || src.slug || '-' || lvl.level || '-' || eq.equipment || '-'
      || sq.squat_style || '-' || dl.deadlift_style as slug,
    case src.content ->> 'goal'
      when 'general-strength' then 'Styrke '
      else 'Styrkeløft '
    end || src.days::text
      || case lvl.level when 'begynder' then ' · Nybegynder' else ' · Øvet' end
      || case eq.equipment when 'home' then ' · Hjemme' else ' · Full Gym' end
      || ' · ' || sq.squat_style || ' · ' || dl.deadlift_style as name,
    src.days::text || ' ugentlige '
      || case eq.equipment when 'home' then 'hjemmepas' else 'full-gym pas' end as tagline,
    case src.content ->> 'goal'
      when 'general-strength' then 'Generel styrke med hovedløft og balanceret assistance.'
      else 'Styrkeløftfundament med squat, bænkpres og dødløft som faste holdepunkter.'
    end as summary,
    'Et forslag kræver mindst to sammenlignelige eksponeringer; ved lav sikkerhed i startgrundlaget kræves tre. Forslaget skal ligge inden for programmets konkrete RPE-loft. Brugeren vælger eksplicit; ellers fastholdes belastningen.' as progression_rule,
    src.days,
    eq.min_equipment,
    lvl.level,
    eq.equipment,
    sq.squat_style,
    dl.deadlift_style,
    public.sub_setup_build_content_v1(
      src.content,
      eq.equipment,
      lvl.level,
      sq.squat_style,
      dl.deadlift_style,
      case eq.equipment
        when 'home' then (src.content ->> 'templateId') || '-home'
        else src.content ->> 'templateId'
      end
    ) as content
  from source_programmes src
  cross join level_axis lvl
  cross join equipment_axis eq
  cross join squat_axis sq
  cross join deadlift_axis dl
)
insert into public.sub_programs (
  slug, version, status, name, tagline, summary, progression_rule,
  days, min_equipment, levels, min_tier, content, published_at
)
select
  slug, 1, 'published', name, tagline, summary, progression_rule,
  days, min_equipment, array[level]::text[], 'member',
  content, now()
from setup_catalogue
on conflict (slug, version) do nothing;

-- Runtime catalogue assertions guard reruns as well as first execution. They
-- prove that the six frameworks became exactly 96 published lane/style bindings,
-- including the beginner four-day lane and a home-only exercise catalogue.
do $$
begin
  if (
    select count(*)
    from public.sub_programs p
    where p.slug like 'setup-v1-%'
      and p.version = 1
      and p.content ->> 'setupSchemaVersion' = '1'
  ) <> 96
  or exists (
    select 1
    from public.sub_programs p
    where p.slug like 'setup-v1-%'
      and p.version = 1
      and (
        p.status <> 'published'
        or p.min_tier <> 'member'
        or p.published_at is null
        or cardinality(p.levels) <> 1
        or p.levels <> array[p.content ->> 'level']::text[]
        or p.days not in (2, 3, 4)
        or jsonb_array_length(p.content -> 'sessions') <> p.days
        or p.content ->> 'equipment' not in ('gym', 'home')
        or p.content ->> 'squatStyle' not in ('high-bar', 'low-bar')
        or p.content ->> 'deadliftStyle' not in ('conventional', 'sumo')
        or p.content ->> 'baselinePolicyVersion' <> '1'
        or p.content ->> 'engineVersion' <> '3'
        or p.content ->> 'exerciseCatalogueVersion' <> '2'
        or p.content ->> 'prescriptionLibraryVersion' <> '2'
        or p.content ->> 'templateSchemaVersion' <> '3'
      )
  )
  or exists (
    select 1
    from public.sub_programs p
    cross join lateral jsonb_array_elements(p.content -> 'sessions') s
    cross join lateral jsonb_array_elements(s -> 'exercises') e
    where p.slug like 'setup-v1-%'
      and p.version = 1
      and p.content ->> 'equipment' = 'home'
      and (
        e ->> 'equipment' <> 'home'
        or left(e ->> 'id', 5) <> 'home-'
      )
  )
  or exists (
    select 1
    from public.sub_programs p
    cross join lateral jsonb_array_elements(p.content -> 'sessions') s
    cross join lateral jsonb_array_elements(s -> 'exercises') e
    where p.slug like 'setup-v1-%'
      and p.version = 1
      and (
        e ->> 'experienceLane' is distinct from p.content ->> 'level'
        or e ->> 'equipmentLane' is distinct from p.content ->> 'equipment'
        or e ->> 'libraryVersion' <> '2'
        or e ->> 'maximumRealizedProgressionPercent' <> '0.03'
        or e ->> 'substitutionMode' <> 'manual-only'
        or (p.content ->> 'equipment' = 'gym' and e ->> 'loadIncrementKg' <> '2.5')
        or (p.content ->> 'equipment' = 'home' and e ->> 'loadIncrementKg' <> '1')
        or (p.content ->> 'level' = 'begynder' and (
          (e ->> 'sets')::integer > 2 or e ->> 'targetRpe' <> '6'
        ))
        or (p.content ->> 'level' = 'oevet' and e ->> 'targetRpe' <> '6–7')
      )
  )
  or exists (
    select 1
    from public.sub_programs p
    cross join lateral jsonb_array_elements(p.content -> 'sessions') s
    cross join lateral jsonb_array_elements(s -> 'exercises') e
    where p.slug like 'setup-v1-%'
      and p.version = 1
      and e ->> 'role' in ('squat-pattern', 'bench-pattern', 'hinge-pattern')
      and (e ->> 'weekOnePercentOfEstimated1RM')::numeric is distinct from case
        when p.content ->> 'goal' = 'general-strength'
             and e ->> 'role' = 'squat-pattern'
          then case p.content ->> 'level' when 'begynder' then 0.700 else 0.725 end
        when p.content ->> 'goal' = 'general-strength'
             and e ->> 'role' = 'bench-pattern'
          then case p.content ->> 'level' when 'begynder' then 0.650 else 0.675 end
        when p.content ->> 'goal' = 'general-strength'
             and e ->> 'role' = 'hinge-pattern'
          then case p.content ->> 'level' when 'begynder' then 0.675 else 0.700 end
        when p.content ->> 'goal' = 'powerlifting-foundation'
             and e ->> 'role' = 'squat-pattern'
          then case p.content ->> 'level' when 'begynder' then 0.725 else 0.750 end
        when p.content ->> 'goal' = 'powerlifting-foundation'
             and e ->> 'role' = 'bench-pattern'
          then case p.content ->> 'level' when 'begynder' then 0.675 else 0.700 end
        else case p.content ->> 'level' when 'begynder' then 0.700 else 0.725 end
      end
  )
  or exists (
    select 1
    from public.sub_programs p
    cross join lateral jsonb_array_elements(p.content -> 'sessions') s
    cross join lateral jsonb_array_elements(s -> 'exercises') e
    where p.slug like 'setup-v1-%'
      and p.version = 1
      and (
        (e ->> 'role' = 'squat-pattern' and e ->> 'id' <> case
          when p.content ->> 'equipment' = 'home' and p.content ->> 'squatStyle' = 'high-bar' then 'home-goblet-squat'
          when p.content ->> 'equipment' = 'home' and p.content ->> 'squatStyle' = 'low-bar' then 'home-box-squat'
          when p.content ->> 'squatStyle' = 'high-bar' then 'high-bar-squat'
          else 'low-bar-squat'
        end)
        or
        (e ->> 'role' = 'hinge-pattern' and e ->> 'id' <> case
          when p.content ->> 'equipment' = 'home' and p.content ->> 'deadliftStyle' = 'conventional' then 'home-dumbbell-deadlift'
          when p.content ->> 'equipment' = 'home' and p.content ->> 'deadliftStyle' = 'sumo' then 'home-dumbbell-sumo-deadlift'
          when p.content ->> 'deadliftStyle' = 'conventional' then 'conventional-deadlift'
          else 'sumo-deadlift'
        end)
      )
  ) then
    raise exception 'sub-13 setup-katalogets immutable bindings er ugyldige';
  end if;
end;
$$;

-- The catalogue builders have served their only purpose. Dropping them keeps
-- the exposed API surface narrow; the immutable published rows remain.
drop function public.sub_setup_build_content_v1(jsonb, text, text, text, text, text);
drop function public.sub_setup_map_exercise_v1(jsonb, text, text, text, text);

-- Harden the shared set guard to the immutable prescription. A skipped set is
-- represented by omission, so fewer rows remain valid; a client can never add
-- set 3 to a beginner exercise whose concrete version prescribes two sets.
create or replace function public.sub_enforce_workout_set()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_match_count integer;
  v_planned_sets_text text;
begin
  select count(*), max(e ->> 'sets')
    into v_match_count, v_planned_sets_text
  from public.sub_workouts w
  join public.sub_programs p on p.id = w.program_id
  cross join lateral jsonb_array_elements(p.content -> 'sessions') s
  cross join lateral jsonb_array_elements(s -> 'exercises') e
  where w.id = new.workout_id
    and w.user_id = new.user_id
    and s ->> 'id' = w.day_id
    and e ->> 'id' = new.exercise_id;

  if v_match_count <> 1
     or coalesce(v_planned_sets_text, '') !~ '^[1-9][0-9]*$' then
    raise exception 'Øvelsen hører ikke entydigt til dette træningspas';
  end if;
  if new.set_index > v_planned_sets_text::integer then
    raise exception 'Sætindekset overstiger den immutable programrecept';
  end if;

  return new;
end;
$$;

revoke execute on function public.sub_enforce_workout_set()
from public, anon, authenticated, service_role;

-- Additional insert guard for setup-created assignments. The original sub-04
-- guard still enforces tier/goal/level/days/equipment for every assignment;
-- this trigger adds setup-schema, baseline-policy and exact style binding.
create or replace function public.sub_enforce_setup_assignment_binding_v1()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_content jsonb;
begin
  select p.content into v_content
  from public.sub_programs p
  where p.id = new.program_id;

  if new.assignment_source = 'member_self_setup_v1'
     and coalesce(v_content ->> 'setupSchemaVersion', '') <> '1' then
    raise exception 'Selvopsætning kræver en publiceret setup-version';
  end if;

  if coalesce(v_content ->> 'setupSchemaVersion', '') <> '1' then
    return new;
  end if;

  if new.assignment_source is distinct from 'member_self_setup_v1'
     or jsonb_typeof(new.match_input) <> 'object'
     or new.match_input ->> 'schemaVersion' <> '4'
     or new.match_input ->> 'setupSchemaVersion' <> '1'
     or new.match_input ->> 'baselinePolicyVersion' <> '1'
     or jsonb_typeof(new.match_input -> 'baselines') <> 'object'
     or new.match_input ->> 'level' is distinct from v_content ->> 'level'
     or new.match_input ->> 'squatStyle' is distinct from v_content ->> 'squatStyle'
     or new.match_input ->> 'deadliftStyle' is distinct from v_content ->> 'deadliftStyle'
     or new.match_input ->> 'equipment' is distinct from v_content ->> 'equipment' then
    raise exception 'Setup-tildelingen matcher ikke den immutable setup-version';
  end if;

  return new;
end;
$$;

revoke execute on function public.sub_enforce_setup_assignment_binding_v1()
from public, anon, authenticated, service_role;

drop trigger if exists entropi_sub_enforce_setup_assignment_binding_v1
on public.sub_assignments;
create trigger entropi_sub_enforce_setup_assignment_binding_v1
before insert on public.sub_assignments
for each row execute function public.sub_enforce_setup_assignment_binding_v1();

-- The only client entry point. It derives the owner from auth.uid(), selects
-- one immutable published version server-side and inserts at most one initial
-- assignment. It never accepts a user, program, tier or provenance parameter.
create or replace function public.sub_complete_my_program_setup_v1(
  p_request_id uuid,
  p_match_input jsonb,
  p_baselines jsonb
)
returns table(assignment_id uuid, program_id uuid, created boolean)
language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_user_id uuid := auth.uid();
  v_goal text;
  v_level text;
  v_days integer;
  v_equipment text;
  v_squat_style text;
  v_deadlift_style text;
  v_lift text;
  v_baseline jsonb;
  v_weight numeric;
  v_reps numeric;
  v_rpe numeric;
  v_canonical_baselines jsonb := '{}'::jsonb;
  v_canonical_match_input jsonb;
  v_assignment_match_input jsonb;
  v_program_slug text;
  v_program_count integer;
  v_program_id uuid;
  v_existing_id uuid;
  v_existing_user_id uuid;
  v_existing_program_id uuid;
  v_existing_match_input jsonb;
  v_existing_source text;
  v_existing_ended_at timestamptz;
  v_active_id uuid;
  v_assignment_id uuid;
begin
  if v_user_id is null or p_request_id is null then
    raise exception 'Login og request-id kræves for programopsætning';
  end if;

  if jsonb_typeof(p_match_input) <> 'object' then
    raise exception 'Programvalgene skal være ét JSON-objekt';
  end if;
  if (select count(*) from jsonb_object_keys(p_match_input)) <> 7
     or exists (
       select 1 from jsonb_object_keys(p_match_input) as keys(key)
       where key not in (
         'schemaVersion', 'goal', 'level', 'daysPerWeek', 'equipment',
         'squatStyle', 'deadliftStyle'
       )
     ) then
    raise exception 'Programvalgene har ukendte eller manglende felter';
  end if;

  if jsonb_typeof(p_match_input -> 'schemaVersion') <> 'number'
     or (p_match_input ->> 'schemaVersion')::numeric <> 4
     or jsonb_typeof(p_match_input -> 'goal') <> 'string'
     or jsonb_typeof(p_match_input -> 'level') <> 'string'
     or jsonb_typeof(p_match_input -> 'daysPerWeek') <> 'number'
     or jsonb_typeof(p_match_input -> 'equipment') <> 'string'
     or jsonb_typeof(p_match_input -> 'squatStyle') <> 'string'
     or jsonb_typeof(p_match_input -> 'deadliftStyle') <> 'string' then
    raise exception 'Programvalgenes typer eller schemaVersion er ugyldige';
  end if;

  v_goal := p_match_input ->> 'goal';
  v_level := p_match_input ->> 'level';
  v_days := (p_match_input ->> 'daysPerWeek')::integer;
  v_equipment := p_match_input ->> 'equipment';
  v_squat_style := p_match_input ->> 'squatStyle';
  v_deadlift_style := p_match_input ->> 'deadliftStyle';

  if v_goal not in ('general-strength', 'powerlifting-foundation')
     or v_level not in ('begynder', 'oevet')
     or v_days not in (2, 3, 4)
     or v_equipment not in ('gym', 'home')
     or v_squat_style not in ('high-bar', 'low-bar')
     or v_deadlift_style not in ('conventional', 'sumo') then
    raise exception 'Programvalgene ligger uden for de reviewede baner';
  end if;

  if jsonb_typeof(p_baselines) <> 'object' then
    raise exception 'Startgrundlaget skal være ét JSON-objekt';
  end if;
  if (select count(*) from jsonb_object_keys(p_baselines)) <> 3
     or exists (
       select 1 from jsonb_object_keys(p_baselines) as keys(key)
       where key not in ('squat', 'bench', 'deadlift')
     ) then
    raise exception 'Startgrundlaget kræver præcis squat, bænkpres og dødløft';
  end if;

  foreach v_lift in array array['squat', 'bench', 'deadlift'] loop
    v_baseline := p_baselines -> v_lift;
    if jsonb_typeof(v_baseline) <> 'object'
       or (select count(*) from jsonb_object_keys(v_baseline)) <> 3
       or exists (
         select 1 from jsonb_object_keys(v_baseline) as keys(key)
         where key not in ('weightKg', 'reps', 'rpe')
       )
       or jsonb_typeof(v_baseline -> 'weightKg') <> 'number'
       or jsonb_typeof(v_baseline -> 'reps') <> 'number'
       or jsonb_typeof(v_baseline -> 'rpe') <> 'number' then
      raise exception 'Startgrundlaget for % har ugyldige felter', v_lift;
    end if;

    v_weight := (v_baseline ->> 'weightKg')::numeric;
    v_reps := (v_baseline ->> 'reps')::numeric;
    v_rpe := (v_baseline ->> 'rpe')::numeric;
    if v_weight <= 0 or v_weight > 500
       or v_reps <> trunc(v_reps) or v_reps < 1 or v_reps > 12
       or v_rpe < 5 or v_rpe > 10 then
      raise exception 'Startgrundlaget for % skal være kg > 0 og <= 500, reps 1-12 og RPE 5-10', v_lift;
    end if;

    v_canonical_baselines := v_canonical_baselines || jsonb_build_object(
      v_lift,
      jsonb_build_object(
        'weightKg', v_weight,
        'reps', v_reps::integer,
        'rpe', v_rpe,
        'inputType', case
          when v_reps = 1 and v_rpe = 10 then 'one_rm'
          else 'heavy_set'
        end
      )
    );
  end loop;

  v_canonical_match_input := jsonb_build_object(
    'schemaVersion', 4,
    'goal', v_goal,
    'level', v_level,
    'daysPerWeek', v_days,
    'equipment', v_equipment,
    'squatStyle', v_squat_style,
    'deadliftStyle', v_deadlift_style
  );
  v_assignment_match_input := v_canonical_match_input || jsonb_build_object(
    'setupSchemaVersion', 1,
    'baselinePolicyVersion', 1,
    'baselines', v_canonical_baselines
  );

  -- Lock request-id first, then owner, in a fixed order. Exact retries across
  -- sessions and even a cross-owner request-id collision are serialised before
  -- either the global request index or per-owner active index is inspected.
  perform pg_advisory_xact_lock(
    hashtextextended('sub_complete_my_program_setup_v1:request:' || p_request_id::text, 12)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('sub_complete_my_program_setup_v1:owner:' || v_user_id::text, 13)
  );

  if public.sub_effective_tier(v_user_id) is distinct from 'member' then
    raise exception 'Aktivt medlemskab kræves for programopsætning';
  end if;

  v_program_slug := 'setup-v1-' || v_goal || '-' || v_days::text || '-'
                    || v_level || '-' || v_equipment || '-' || v_squat_style || '-'
                    || v_deadlift_style;

  select count(*) into v_program_count
  from public.sub_programs p
  where p.slug = v_program_slug
    and p.version = 1
    and p.status = 'published'
    and p.published_at is not null
    and p.min_tier = 'member'
    and p.days = v_days
    and p.levels = array[v_level]::text[]
    and p.content ->> 'goal' = v_goal
    and p.content ->> 'level' = v_level
    and p.content ->> 'equipment' = v_equipment
    and p.content ->> 'squatStyle' = v_squat_style
    and p.content ->> 'deadliftStyle' = v_deadlift_style
    and p.content ->> 'setupSchemaVersion' = '1'
    and p.content ->> 'baselinePolicyVersion' = '1';

  if v_program_count <> 1 then
    raise exception 'Præcis én publiceret setup-version kunne ikke vælges';
  end if;

  select p.id into v_program_id
  from public.sub_programs p
  where p.slug = v_program_slug
    and p.version = 1
    and p.status = 'published';

  -- Exact request replay returns the same active assignment. Any changed
  -- owner, programme, canonical input or provenance fails closed.
  select a.id, a.user_id, a.program_id, a.match_input,
         a.assignment_source, a.ended_at
    into v_existing_id, v_existing_user_id, v_existing_program_id,
         v_existing_match_input, v_existing_source, v_existing_ended_at
  from public.sub_assignments a
  where a.request_id = p_request_id;

  if found then
    if v_existing_user_id is distinct from v_user_id
       or v_existing_program_id is distinct from v_program_id
       or v_existing_match_input is distinct from v_assignment_match_input
       or v_existing_source is distinct from 'member_self_setup_v1' then
      raise exception 'Request-id er allerede brugt med andre setup-data';
    end if;
    if v_existing_ended_at is not null then
      raise exception 'Den oprindelige setup-tildeling er afsluttet og kan ikke genåbnes';
    end if;

    return query select v_existing_id, v_program_id, false;
    return;
  end if;

  select a.id into v_active_id
  from public.sub_assignments a
  where a.user_id = v_user_id
    and a.ended_at is null;

  if found then
    raise exception 'Medlemmet har allerede et aktivt program; selvopsætning erstatter det ikke';
  end if;

  -- Preferences and assignment are one transaction. If either write or either
  -- assignment trigger fails, neither state change is committed.
  insert into public.sub_members (
    user_id, goal, level, days_per_week, equipment,
    squat_style, deadlift_style, baselines,
    setup_schema_version, baseline_policy_version,
    onboarded_at, program_setup_completed_at, updated_at
  ) values (
    v_user_id, v_goal, v_level, v_days, v_equipment,
    v_squat_style, v_deadlift_style, v_canonical_baselines,
    1, 1, now(), now(), now()
  )
  on conflict (user_id) do update
  set goal = excluded.goal,
      level = excluded.level,
      days_per_week = excluded.days_per_week,
      equipment = excluded.equipment,
      squat_style = excluded.squat_style,
      deadlift_style = excluded.deadlift_style,
      baselines = excluded.baselines,
      setup_schema_version = excluded.setup_schema_version,
      baseline_policy_version = excluded.baseline_policy_version,
      onboarded_at = coalesce(public.sub_members.onboarded_at, excluded.onboarded_at),
      program_setup_completed_at = excluded.program_setup_completed_at,
      updated_at = now();

  insert into public.sub_assignments (
    user_id, program_id, match_input, request_id, assignment_source
  ) values (
    v_user_id, v_program_id, v_assignment_match_input,
    p_request_id, 'member_self_setup_v1'
  )
  returning id into v_assignment_id;

  if (
    select count(*)
    from public.sub_assignments a
    where a.user_id = v_user_id and a.ended_at is null
  ) <> 1 then
    raise exception 'Programopsætningen skabte ikke præcis én aktiv tildeling';
  end if;

  return query select v_assignment_id, v_program_id, true;
end;
$$;

revoke all on function public.sub_complete_my_program_setup_v1(uuid, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.sub_complete_my_program_setup_v1(uuid, jsonb, jsonb)
to authenticated;

-- Final structural assertions. Direct assignment writes stay denied; only the
-- owner-bound RPC is client-executable, and its trigger helper is not.
do $$
declare
  v_rpc regprocedure := 'public.sub_complete_my_program_setup_v1(uuid,jsonb,jsonb)'::regprocedure;
  v_guard regprocedure := 'public.sub_enforce_setup_assignment_binding_v1()'::regprocedure;
begin
  if not exists (
    select 1
    from pg_proc p
    where p.oid = v_rpc and p.prosecdef
  )
  or has_function_privilege('anon', v_rpc, 'EXECUTE')
  or not has_function_privilege('authenticated', v_rpc, 'EXECUTE')
  or has_function_privilege('authenticated', v_guard, 'EXECUTE')
  or has_table_privilege('authenticated', 'public.sub_assignments', 'INSERT')
  or has_table_privilege('authenticated', 'public.sub_assignments', 'UPDATE')
  or has_table_privilege('authenticated', 'public.sub_assignments', 'DELETE')
  or not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.sub_assignments'::regclass
      and t.tgname = 'entropi_sub_enforce_setup_assignment_binding_v1'
      and not t.tgisinternal
  ) then
    raise exception 'sub-13 final owner/write/setup-binding contract failed';
  end if;
end;
$$;

commit;

-- Shadow behavioural verification after authorised execution:
-- 1. A free/expired user and an anonymous call are rejected without writes.
-- 2. Each of the 96 goal/day/level/equipment/style choices selects exactly one row;
--    beginner four-day setup is accepted for gym and home.
-- 3. Exact request replay returns created=false and the same IDs. Changed
--    payload, reused request ID or a second request against an active assignment
--    fails without ending/replacing that assignment.
-- 4. kg <= 0, kg > 500, reps outside 1-12, RPE outside 5-10, missing/extra
--    baseline or match keys, strings for numeric fields and unknown enums fail.
-- 5. User B cannot read User A's member row or assignment. Neither user can
--    directly insert/update/delete assignments or mutate published programmes.

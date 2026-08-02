-- Entropi subscription shadow migration 03: immutable v1 pilot catalogue.
-- DRAFT ONLY. Do not run against production. Validate in the isolated shadow
-- project maxhsefxbrvsgolscqwh only after explicit authorisation.
--
-- Locked v1 surface:
-- - full gym only (min_equipment = 2 and content.equipment = "gym")
-- - goals: general-strength and powerlifting-foundation
-- - levels: begynder and oevet
-- - 2/3 days for both levels; 4 days only for oevet
--
-- Six immutable programme versions cover ten offered goal/level/day tracks.
-- Levels share a programme version because the reviewed v1 prescriptions do
-- not differ by level. A later prescription change is a new slug/version.

create table public.sub_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  name text not null,
  tagline text,
  summary text,
  progression_rule text not null,
  days integer not null check (days between 1 and 7),
  min_equipment integer not null check (min_equipment between 0 and 2),
  levels text[] not null,
  min_tier text not null default 'member' check (min_tier in ('free', 'member')),
  content jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (slug, version)
);

alter table public.sub_programs enable row level security;
revoke all on table public.sub_programs from anon;

create policy entropi_sub_programs_read_tier
on public.sub_programs for select to authenticated
using (
  status = 'published'
  and min_tier = 'member'
  and public.sub_current_tier() = 'member'
);

with pilot_catalogue as (
  select *
  from jsonb_to_recordset(
    $pilot_catalogue$
[
  {
    "slug": "general-strength-2",
    "version": 1,
    "name": "Styrke 2",
    "tagline": "2 ugentlige full-gym pas",
    "summary": "Generel styrke med hovedløft og balanceret assistance.",
    "progression_rule": "Efter to sammenlignelige eksponeringer ved toppen af repmålet og RPE højst 7 kan appen foreslå +2,5 kg. Brugeren vælger eksplicit; ellers fastholdes belastningen.",
    "days": 2,
    "min_equipment": 2,
    "levels": ["begynder", "oevet"],
    "min_tier": "member",
    "content": {
      "schemaVersion": 1,
      "goal": "general-strength",
      "equipment": "gym",
      "templateId": "general-strength-2",
      "sessions": [
        {"id":"a","name":"Pas A","exercises":[
          {"id":"high-bar-squat","name":"High-bar squat","role":"squat-pattern","sets":3,"reps":"5–7","rest":180,"targetRpe":"6–7","targetReps":6,"weekOnePercentOfEstimated1RM":0.725},
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"6–8","rest":180,"targetRpe":"6–7","targetReps":7,"weekOnePercentOfEstimated1RM":0.675},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"romanian-deadlift","name":"Rumænsk dødløft","role":"hinge-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"}
        ]},
        {"id":"b","name":"Pas B","exercises":[
          {"id":"conventional-deadlift","name":"Konventionel dødløft","role":"hinge-pattern","sets":2,"reps":"5–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"dumbbell-incline-press","name":"Skrå håndvægtspres","role":"upper-press-variation","sets":2,"reps":"8–10","rest":90,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"}
        ]}
      ]
    }
  },
  {
    "slug": "general-strength-3",
    "version": 1,
    "name": "Styrke 3",
    "tagline": "3 ugentlige full-gym pas",
    "summary": "Generel styrke med hovedløft og balanceret assistance.",
    "progression_rule": "Efter to sammenlignelige eksponeringer ved toppen af repmålet og RPE højst 7 kan appen foreslå +2,5 kg. Brugeren vælger eksplicit; ellers fastholdes belastningen.",
    "days": 3,
    "min_equipment": 2,
    "levels": ["begynder", "oevet"],
    "min_tier": "member",
    "content": {
      "schemaVersion": 1,
      "goal": "general-strength",
      "equipment": "gym",
      "templateId": "general-strength-3",
      "sessions": [
        {"id":"a","name":"Pas A","exercises":[
          {"id":"high-bar-squat","name":"High-bar squat","role":"squat-pattern","sets":3,"reps":"5–7","rest":180,"targetRpe":"6–7","targetReps":6,"weekOnePercentOfEstimated1RM":0.725},
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"6–8","rest":180,"targetRpe":"6–7","targetReps":7,"weekOnePercentOfEstimated1RM":0.675},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"b","name":"Pas B","exercises":[
          {"id":"conventional-deadlift","name":"Konventionel dødløft","role":"hinge-pattern","sets":2,"reps":"5–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"dumbbell-incline-press","name":"Skrå håndvægtspres","role":"upper-press-variation","sets":2,"reps":"8–10","rest":90,"targetRpe":"6–7"},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"c","name":"Pas C","exercises":[
          {"id":"pause-squat","name":"Pausesquat","role":"squat-variation","sets":2,"reps":"6–8","rest":120,"targetRpe":"6–7"},
          {"id":"close-grip-bench-press","name":"Smal bænkpres","role":"bench-variation","sets":2,"reps":"8–10","rest":90,"targetRpe":"6–7"},
          {"id":"romanian-deadlift","name":"Rumænsk dødløft","role":"hinge-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]}
      ]
    }
  },
  {
    "slug": "general-strength-4",
    "version": 1,
    "name": "Styrke 4",
    "tagline": "4 ugentlige full-gym pas",
    "summary": "Generel styrke med hovedløft og balanceret assistance.",
    "progression_rule": "Efter to sammenlignelige eksponeringer ved toppen af repmålet og RPE højst 7 kan appen foreslå +2,5 kg. Brugeren vælger eksplicit; ellers fastholdes belastningen.",
    "days": 4,
    "min_equipment": 2,
    "levels": ["oevet"],
    "min_tier": "member",
    "content": {
      "schemaVersion": 1,
      "goal": "general-strength",
      "equipment": "gym",
      "templateId": "general-strength-4",
      "sessions": [
        {"id":"lower-a","name":"Underkrop A","exercises":[
          {"id":"high-bar-squat","name":"High-bar squat","role":"squat-pattern","sets":3,"reps":"5–7","rest":180,"targetRpe":"6–7","targetReps":6,"weekOnePercentOfEstimated1RM":0.725},
          {"id":"romanian-deadlift","name":"Rumænsk dødløft","role":"hinge-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"},
          {"id":"ab-wheel","name":"Ab wheel","role":"core","sets":2,"reps":"8–15","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"upper-a","name":"Overkrop A","exercises":[
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"6–8","rest":180,"targetRpe":"6–7","targetReps":7,"weekOnePercentOfEstimated1RM":0.675},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"overhead-press","name":"Stående skulderpres","role":"upper-press-assistance","sets":2,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"lat-pulldown","name":"Lat pulldown","role":"vertical-pull","sets":2,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"lower-b","name":"Underkrop B","exercises":[
          {"id":"conventional-deadlift","name":"Konventionel dødløft","role":"hinge-pattern","sets":2,"reps":"5–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"pause-squat","name":"Pausesquat","role":"squat-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"},
          {"id":"ab-wheel","name":"Ab wheel","role":"core","sets":2,"reps":"8–15","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"upper-b","name":"Overkrop B","exercises":[
          {"id":"close-grip-bench-press","name":"Smal bænkpres","role":"bench-variation","sets":2,"reps":"8–10","rest":90,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"lateral-raise","name":"Side laterals","role":"upper-assistance","sets":2,"reps":"10–15","rest":90,"targetRpe":"6–7"},
          {"id":"lat-pulldown","name":"Lat pulldown","role":"vertical-pull","sets":2,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]}
      ]
    }
  },
  {
    "slug": "powerlifting-foundation-2",
    "version": 1,
    "name": "Styrkeløft 2",
    "tagline": "2 ugentlige full-gym pas",
    "summary": "Styrkeløftfundament med squat, bænkpres og dødløft som faste holdepunkter.",
    "progression_rule": "Efter to sammenlignelige eksponeringer ved toppen af repmålet og RPE højst 7 kan appen foreslå +2,5 kg. Brugeren vælger eksplicit; ellers fastholdes belastningen.",
    "days": 2,
    "min_equipment": 2,
    "levels": ["begynder", "oevet"],
    "min_tier": "member",
    "content": {
      "schemaVersion": 1,
      "goal": "powerlifting-foundation",
      "equipment": "gym",
      "templateId": "powerlifting-foundation-2",
      "sessions": [
        {"id":"a","name":"Pas A","exercises":[
          {"id":"high-bar-squat","name":"High-bar squat","role":"squat-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.75},
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"romanian-deadlift","name":"Rumænsk dødløft","role":"hinge-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"b","name":"Pas B","exercises":[
          {"id":"conventional-deadlift","name":"Konventionel dødløft","role":"hinge-pattern","sets":2,"reps":"3–5","rest":180,"targetRpe":"6–7","targetReps":4,"weekOnePercentOfEstimated1RM":0.725},
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"pause-squat","name":"Pausesquat","role":"squat-assistance","sets":2,"reps":"5–7","rest":120,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]}
      ]
    }
  },
  {
    "slug": "powerlifting-foundation-3",
    "version": 1,
    "name": "Styrkeløft 3",
    "tagline": "3 ugentlige full-gym pas",
    "summary": "Styrkeløftfundament med squat, bænkpres og dødløft som faste holdepunkter.",
    "progression_rule": "Efter to sammenlignelige eksponeringer ved toppen af repmålet og RPE højst 7 kan appen foreslå +2,5 kg. Brugeren vælger eksplicit; ellers fastholdes belastningen.",
    "days": 3,
    "min_equipment": 2,
    "levels": ["begynder", "oevet"],
    "min_tier": "member",
    "content": {
      "schemaVersion": 1,
      "goal": "powerlifting-foundation",
      "equipment": "gym",
      "templateId": "powerlifting-foundation-3",
      "sessions": [
        {"id":"a","name":"Pas A","exercises":[
          {"id":"high-bar-squat","name":"High-bar squat","role":"squat-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.75},
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"b","name":"Pas B","exercises":[
          {"id":"conventional-deadlift","name":"Konventionel dødløft","role":"hinge-pattern","sets":2,"reps":"3–5","rest":180,"targetRpe":"6–7","targetReps":4,"weekOnePercentOfEstimated1RM":0.725},
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"c","name":"Pas C","exercises":[
          {"id":"pause-squat","name":"Pausesquat","role":"squat-assistance","sets":2,"reps":"5–7","rest":120,"targetRpe":"6–7"},
          {"id":"close-grip-bench-press","name":"Smal bænkpres","role":"bench-variation","sets":2,"reps":"5–7","rest":90,"targetRpe":"6–7"},
          {"id":"romanian-deadlift","name":"Rumænsk dødløft","role":"hinge-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]}
      ]
    }
  },
  {
    "slug": "powerlifting-foundation-4",
    "version": 1,
    "name": "Styrkeløft 4",
    "tagline": "4 ugentlige full-gym pas",
    "summary": "Styrkeløftfundament med squat, bænkpres og dødløft som faste holdepunkter.",
    "progression_rule": "Efter to sammenlignelige eksponeringer ved toppen af repmålet og RPE højst 7 kan appen foreslå +2,5 kg. Brugeren vælger eksplicit; ellers fastholdes belastningen.",
    "days": 4,
    "min_equipment": 2,
    "levels": ["oevet"],
    "min_tier": "member",
    "content": {
      "schemaVersion": 1,
      "goal": "powerlifting-foundation",
      "equipment": "gym",
      "templateId": "powerlifting-foundation-4",
      "sessions": [
        {"id":"lower-a","name":"Underkrop A","exercises":[
          {"id":"high-bar-squat","name":"High-bar squat","role":"squat-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.75},
          {"id":"romanian-deadlift","name":"Rumænsk dødløft","role":"hinge-assistance","sets":2,"reps":"8–10","rest":120,"targetRpe":"6–7"},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"},
          {"id":"ab-wheel","name":"Ab wheel","role":"core","sets":2,"reps":"8–15","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"upper-a","name":"Overkrop A","exercises":[
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"overhead-press","name":"Stående skulderpres","role":"upper-press-assistance","sets":2,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"lat-pulldown","name":"Lat pulldown","role":"vertical-pull","sets":2,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"lower-b","name":"Underkrop B","exercises":[
          {"id":"conventional-deadlift","name":"Konventionel dødløft","role":"hinge-pattern","sets":2,"reps":"3–5","rest":180,"targetRpe":"6–7","targetReps":4,"weekOnePercentOfEstimated1RM":0.725},
          {"id":"pause-squat","name":"Pausesquat","role":"squat-assistance","sets":2,"reps":"5–7","rest":120,"targetRpe":"6–7"},
          {"id":"split-squat","name":"Split squat","role":"lower-assistance","sets":2,"reps":"8–12","rest":120,"targetRpe":"6–7"},
          {"id":"ab-wheel","name":"Ab wheel","role":"core","sets":2,"reps":"8–15","rest":90,"targetRpe":"6–7"}
        ]},
        {"id":"upper-b","name":"Overkrop B","exercises":[
          {"id":"barbell-bench-press","name":"Bænkpres","role":"bench-pattern","sets":3,"reps":"4–6","rest":180,"targetRpe":"6–7","targetReps":5,"weekOnePercentOfEstimated1RM":0.7},
          {"id":"close-grip-bench-press","name":"Smal bænkpres","role":"bench-variation","sets":2,"reps":"5–7","rest":90,"targetRpe":"6–7"},
          {"id":"chest-supported-row","name":"Chest-supported row","role":"pull","sets":3,"reps":"8–12","rest":90,"targetRpe":"6–7"},
          {"id":"lat-pulldown","name":"Lat pulldown","role":"vertical-pull","sets":2,"reps":"8–12","rest":90,"targetRpe":"6–7"}
        ]}
      ]
    }
  }
]
    $pilot_catalogue$::jsonb
  ) as p(
    slug text,
    version integer,
    name text,
    tagline text,
    summary text,
    progression_rule text,
    days integer,
    min_equipment integer,
    levels text[],
    min_tier text,
    content jsonb
  )
)
insert into public.sub_programs (
  slug, version, status, name, tagline, summary, progression_rule,
  days, min_equipment, levels, min_tier, content, published_at
)
select
  slug, version, 'published', name, tagline, summary, progression_rule,
  days, min_equipment, levels, min_tier, content, now()
from pilot_catalogue;

-- Shadow verification:
-- 1. Exactly six published versions exist and cover exactly ten
--    goal/level/day tracks: 2 x 2-day, 2 x 3-day and 2 x oevet-only 4-day.
-- 2. Every version is member-only, full-gym, and has days = session count.
-- 3. No row contains home/basic equipment or the removed level erfaren.
-- 4. Every exercise has stable id/name/role, positive sets/rest and a numeric
--    rep range so workout and week-two guards can inspect the immutable JSON.
-- 5. Authenticated users can select only published member rows when their
--    active entitlement resolves to member; no client can mutate the catalogue.

-- DRAFT: Entropi Coach / KOST-DATA1. Written only; requires separate approval to run.
-- Prerequisites: public.athletes(id, user_id, coach_id) are UUIDs; auth.uid();
-- authenticated and anon roles. The migration owner owns the new objects and
-- can read athletes. Application roles must not own these tables or bypass RLS.
-- No existing table, policy, grant or data is changed.
begin;

-- Exact food snapshot contract used by foedevarer/totals.mjs: {food, grams}.
-- JSON keeps meal/line ordering and makes the entire version append-only.
-- Nutrient keys encode units; absent/null is unknown, never an invented zero.
create function public.kostplan_v1_valid_meals(meals jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  meal jsonb;
  portion jsonb;
  food jsonb;
  nutrient record;
  field text;
begin
  if jsonb_typeof(meals) is distinct from 'array' then return false; end if;
  if jsonb_array_length(meals) > 30 or octet_length(meals::text) > 200000 then return false; end if;
  for meal in select value from jsonb_array_elements(meals) loop
    if jsonb_typeof(meal) is distinct from 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(meal) k where k not in ('name', 'portions'))
      or jsonb_typeof(meal->'name') is distinct from 'string'
      or length(meal->>'name') > 200 or not (meal->>'name' ~ '[^[:space:]]')
      or jsonb_typeof(meal->'portions') is distinct from 'array' then return false; end if;
    if jsonb_array_length(meal->'portions') not between 1 and 100 then return false; end if;
    for portion in select value from jsonb_array_elements(meal->'portions') loop
      if jsonb_typeof(portion) is distinct from 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(portion) k where k not in ('food', 'grams'))
        or jsonb_typeof(portion->'grams') is distinct from 'number' then return false; end if;
      if (portion->>'grams')::numeric <= 0 or (portion->>'grams')::numeric > 100000 then return false; end if;
      food := portion->'food';
      if jsonb_typeof(food) is distinct from 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(food) k where k not in
          ('id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source'))
        or (food->'basisGrams') is distinct from '100'::jsonb then return false; end if;
      foreach field in array array['id', 'name', 'preparation'] loop
        if jsonb_typeof(food->field) is distinct from 'string'
          or not (food->>field ~ '[^[:space:]]') then return false; end if;
      end loop;
      if jsonb_typeof(food->'source') is distinct from 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(food->'source') k where k not in ('citation', 'verification'))
        then return false; end if;
      foreach field in array array['citation', 'verification'] loop
        if jsonb_typeof(food->'source'->field) is distinct from 'string'
          or not (food->'source'->>field ~ '[^[:space:]]') then return false; end if;
      end loop;
      if jsonb_typeof(food->'nutrientsPer100g') is distinct from 'object' then return false; end if;
      for nutrient in select key, value from jsonb_each(food->'nutrientsPer100g') loop
        if nutrient.key not in ('energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fibreG',
          'ironMg', 'calciumMg', 'magnesiumMg', 'zincMg', 'potassiumMg', 'sodiumMg',
          'vitaminDUg', 'vitaminB12Ug', 'folateUg', 'leucineG') then return false; end if;
        if jsonb_typeof(nutrient.value) not in ('number', 'null') then return false; end if;
        if jsonb_typeof(nutrient.value) = 'number' and
          ((nutrient.value::text)::numeric < 0 or (nutrient.value::text)::numeric > 1000000000000)
          then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$$;
revoke all on function public.kostplan_v1_valid_meals(jsonb) from public, anon, authenticated;
-- Pure validator: needed for CHECK evaluation, no data access or definer rights.
grant execute on function public.kostplan_v1_valid_meals(jsonb) to authenticated;

create table public.kostplan_v1_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id),
  status text not null default 'forslag' check (status in ('forslag', 'godkendt', 'arkiveret')),
  valid_from date not null check (isfinite(valid_from)),
  created_at timestamptz not null default clock_timestamp()
);
create index kostplan_v1_plans_athlete on public.kostplan_v1_plans (athlete_id, valid_from);

create table public.kostplan_v1_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.kostplan_v1_plans(id),
  version_no integer not null check (version_no > 0),
  effective_from date not null check (isfinite(effective_from)),
  basis_as_of date not null check (isfinite(basis_as_of) and basis_as_of <= effective_from),
  -- Snapshot, not a live query. Unknown inputs are JSON null, never invented zeroes.
  -- No cycle/health data is fetched or copied by this migration.
  calculation_basis jsonb not null check (
    jsonb_typeof(calculation_basis) = 'object'
    and calculation_basis ?& array['weight_trend', 'training_volume', 'training_intensity',
      'food_log', 'readiness', 'competition_date']
    and octet_length(calculation_basis::text) <= 20000
  ),
  rationale text not null check (length(rationale) between 1 and 4000 and rationale ~ '[^[:space:]]'),
  goal text not null check (goal in ('bulk', 'vedligehold', 'cut')),
  -- Dimensionless 0..1; deliberately no automatic kcal conversion.
  intensity numeric not null check (intensity >= 0 and intensity <= 1),
  meals jsonb not null default '[]'::jsonb check (public.kostplan_v1_valid_meals(meals)),
  portion_guidance text check (portion_guidance is null or
    (length(portion_guidance) between 1 and 4000 and portion_guidance ~ '[^[:space:]]')),
  created_at timestamptz not null default clock_timestamp(),
  unique (plan_id, version_no),
  unique (plan_id, id)
);

-- Append-only approval ledger. The coach may correct a mistake immediately.
-- Only automatic adjustments are weekly-limited; both paths require the current
-- coach, the latest proposal, a rationale and the immutable food/input snapshots.
create table public.kostplan_v1_approvals (
  version_id uuid primary key,
  plan_id uuid not null,
  athlete_id uuid not null references public.athletes(id),
  coach_id uuid not null,
  approved_at timestamptz not null,
  week_start date not null,
  approval_kind text not null default 'coach' check (approval_kind in ('coach', 'automatic')),
  foreign key (plan_id, version_id) references public.kostplan_v1_versions(plan_id, id),
  check (week_start = date_trunc('week', approved_at at time zone 'Europe/Copenhagen')::date)
);
create unique index kostplan_v1_automatic_week on public.kostplan_v1_approvals
  (athlete_id, week_start) where approval_kind = 'automatic';
create index kostplan_v1_approvals_plan on public.kostplan_v1_approvals (plan_id);

alter table public.kostplan_v1_plans enable row level security;
alter table public.kostplan_v1_versions enable row level security;
alter table public.kostplan_v1_approvals enable row level security;

revoke all on table public.kostplan_v1_plans, public.kostplan_v1_versions,
  public.kostplan_v1_approvals from public, anon, authenticated;
grant select on table public.kostplan_v1_plans, public.kostplan_v1_versions,
  public.kostplan_v1_approvals to authenticated;
grant insert (id, athlete_id, valid_from) on public.kostplan_v1_plans to authenticated;
-- Only archiving is a direct UPDATE. Approval status is managed by the trigger.
grant update (status) on public.kostplan_v1_plans to authenticated;
grant insert (id, plan_id, version_no, effective_from, basis_as_of, calculation_basis,
  rationale, goal, intensity, meals, portion_guidance)
  on public.kostplan_v1_versions to authenticated;
grant insert (version_id, approval_kind) on public.kostplan_v1_approvals to authenticated;

create policy kostplan_v1_plans_read on public.kostplan_v1_plans for select to authenticated
using (exists (
  select 1 from public.athletes a where a.id = kostplan_v1_plans.athlete_id
    and (a.coach_id = (select auth.uid())
      or (a.user_id = (select auth.uid()) and kostplan_v1_plans.status = 'godkendt'))
));
create policy kostplan_v1_plans_insert on public.kostplan_v1_plans for insert to authenticated
with check (status = 'forslag' and exists (
  select 1 from public.athletes a where a.id = kostplan_v1_plans.athlete_id
    and a.coach_id = (select auth.uid())
));
create policy kostplan_v1_plans_archive on public.kostplan_v1_plans for update to authenticated
using (exists (
  select 1 from public.athletes a where a.id = kostplan_v1_plans.athlete_id
    and a.coach_id = (select auth.uid())
))
with check (status = 'arkiveret' and exists (
  select 1 from public.athletes a where a.id = kostplan_v1_plans.athlete_id
    and a.coach_id = (select auth.uid())
));

create policy kostplan_v1_versions_read on public.kostplan_v1_versions for select to authenticated
using (exists (
  select 1 from public.kostplan_v1_plans p join public.athletes a on a.id = p.athlete_id
  where p.id = kostplan_v1_versions.plan_id
    and (a.coach_id = (select auth.uid()) or (
      a.user_id = (select auth.uid()) and p.status = 'godkendt' and exists (
        select 1 from public.kostplan_v1_approvals ap
        where ap.version_id = kostplan_v1_versions.id
      )
    ))
));
create policy kostplan_v1_versions_insert on public.kostplan_v1_versions for insert to authenticated
with check (exists (
  select 1 from public.kostplan_v1_plans p join public.athletes a on a.id = p.athlete_id
  where p.id = kostplan_v1_versions.plan_id and a.coach_id = (select auth.uid())
    and p.status <> 'arkiveret' and kostplan_v1_versions.effective_from >= p.valid_from
));

create policy kostplan_v1_approvals_read on public.kostplan_v1_approvals for select to authenticated
using (exists (
  select 1 from public.kostplan_v1_plans p join public.athletes a on a.id = p.athlete_id
  where p.id = kostplan_v1_approvals.plan_id and a.id = kostplan_v1_approvals.athlete_id
    and (a.coach_id = (select auth.uid())
      or (a.user_id = (select auth.uid()) and p.status = 'godkendt'))
));
create policy kostplan_v1_approvals_insert on public.kostplan_v1_approvals for insert to authenticated
with check (coach_id = (select auth.uid()) and exists (
  select 1 from public.kostplan_v1_plans p join public.athletes a on a.id = p.athlete_id
  where p.id = kostplan_v1_approvals.plan_id and a.id = kostplan_v1_approvals.athlete_id
    and a.coach_id = (select auth.uid()) and p.status <> 'arkiveret'
));

-- Definer is confined to this new namespace. It verifies the CURRENT coach,
-- derives all approval metadata, and cannot be called as a Data API RPC.
create function public.kostplan_v1_prepare_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target record;
  last_version integer;
  last_effective date;
  last_approved timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Coach required' using errcode = '42501';
  end if;
  select p.id as plan_id, p.athlete_id, p.status, p.valid_from, v.version_no, v.effective_from, v.meals
    into target
  from public.kostplan_v1_versions v
  join public.kostplan_v1_plans p on p.id = v.plan_id
  join public.athletes a on a.id = p.athlete_id
  where v.id = new.version_id and a.coach_id = auth.uid();
  if not found then
    raise exception 'Version unavailable to current coach' using errcode = '42501';
  end if;
  -- Serialize approval decisions across all plans for this athlete, without
  -- writing or locking the existing athlete table. Prefix isolates this feature.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kostplan_v1:' || target.athlete_id::text, 0));
  -- Refresh authority and status after obtaining the athlete lock.
  select p.id as plan_id, p.athlete_id, p.status, p.valid_from, v.version_no, v.effective_from, v.meals
    into target
  from public.kostplan_v1_versions v
  join public.kostplan_v1_plans p on p.id = v.plan_id
  join public.athletes a on a.id = p.athlete_id
  where v.id = new.version_id and a.coach_id = auth.uid()
  for update of p;
  if not found then
    raise exception 'Version unavailable to current coach' using errcode = '42501';
  end if;
  if target.status = 'arkiveret' or target.effective_from < target.valid_from then
    raise exception 'Archived plan or invalid effective date' using errcode = '23514';
  end if;
  if jsonb_array_length(target.meals) = 0 then
    raise exception 'A plan needs meals before activation' using errcode = '23514';
  end if;
  if target.version_no <> (
    select max(v.version_no) from public.kostplan_v1_versions v where v.plan_id = target.plan_id
  ) then
    raise exception 'Approve the latest proposal only' using errcode = '23514';
  end if;
  select max(v.version_no) into last_version
  from public.kostplan_v1_approvals ap
  join public.kostplan_v1_versions v on v.id = ap.version_id
  where ap.plan_id = target.plan_id;
  if last_version is not null and target.version_no <= last_version then
    raise exception 'Approval must advance the version' using errcode = '23514';
  end if;
  if new.approval_kind = 'automatic' then
    select max(v.effective_from), max(ap.approved_at) into last_effective, last_approved
    from public.kostplan_v1_approvals ap
    join public.kostplan_v1_versions v on v.id = ap.version_id
    where ap.athlete_id = target.athlete_id;
    if last_effective is not null and (target.effective_from < last_effective + 7
      or clock_timestamp() < last_approved + interval '7 days') then
      raise exception 'Automatic adjustment must wait seven days and advance effective date'
        using errcode = '23514';
    end if;
  end if;
  new.plan_id := target.plan_id;
  new.athlete_id := target.athlete_id;
  new.coach_id := auth.uid();
  new.approved_at := clock_timestamp();
  new.week_start := date_trunc('week', new.approved_at at time zone 'Europe/Copenhagen')::date;
  return new;
end;
$$;

-- AFTER INSERT is intentional: ON CONFLICT DO NOTHING must have no status side
-- effect. The athlete advisory lock and partial automatic-week key guard the
-- weekly automation allowance across plans. Coach corrections remain immediate.
create function public.kostplan_v1_publish_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.kostplan_v1_plans set status = 'godkendt' where id = new.plan_id;
  return new;
end;
$$;
revoke all on function public.kostplan_v1_prepare_approval(),
  public.kostplan_v1_publish_approval() from public, anon, authenticated;
create trigger kostplan_v1_prepare_approval before insert on public.kostplan_v1_approvals
for each row execute function public.kostplan_v1_prepare_approval();
create trigger kostplan_v1_publish_approval after insert on public.kostplan_v1_approvals
for each row execute function public.kostplan_v1_publish_approval();

commit;

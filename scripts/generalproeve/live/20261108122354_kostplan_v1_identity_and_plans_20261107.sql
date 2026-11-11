-- DRAFT / KOST-IDENTITET-VAERN1. Separate explicit root approval required.
-- Synthetic verification only; no authorization to apply to any real database.
-- Only the new kostplan identity function/trigger may be created/removed.
-- Repeat UP accepts only an exact known installed pair; never repairs drift.

set local lock_timeout = '3s';
set local statement_timeout = '15s';
set local idle_in_transaction_session_timeout = '20s';
set local search_path = pg_catalog;
-- Serialize our UP/DOWN, then block concurrent athlete DML/DDL during catalog checks.
-- Both locks are bounded by lock_timeout; the transaction is atomic on failure.
select pg_advisory_xact_lock(17412026, 711230);
lock table public.athletes in share row exclusive mode;
do $migration$
declare
  phase integer;
  object_name text;
  function_count integer;
  trigger_count integer;
  removing constant boolean := false;
  expected_body constant text := $body$
begin
  if new.user_id is distinct from old.user_id
     and (auth.uid() is not null or current_user in ('authenticated', 'anon'))
     and (old.user_id is null
          and new.user_id = auth.uid()
          and auth.uid() is distinct from old.coach_id) is not true then
    raise exception 'Athlete login identity is not editable by clients' using errcode = '42501';
  end if;
  return new;
end;
$body$;
begin
  for phase in 0..1 loop

    -- R3: exact 2026-11-07 18:29:05 UTC observed prerequisites, in BOTH phases.
    -- Check before invoking auth.uid or issuing any guard DDL. Never repair drift.
    -- Definition equality is byte-exact: no whitespace/body normalization.
    if not exists (select 1 from pg_proc p join pg_language l on l.oid=p.prolang
        where p.oid=to_regprocedure('auth.uid()') and l.lanname='sql'
          and p.proowner=(select oid from pg_roles where rolname='supabase_auth_admin')
          and p.prorettype='pg_catalog.uuid'::regtype and not p.proretset
          and p.pronargs=0 and p.prokind='f' and p.provolatile='s'
          and not p.prosecdef and p.proconfig is null
          and pg_get_functiondef(p.oid)=E'CREATE OR REPLACE FUNCTION auth.uid()\n RETURNS uuid\n LANGUAGE sql\n STABLE\nAS $function$\n  select \n  coalesce(\n    nullif(current_setting(''request.jwt.claim.sub'', true), ''''),\n    (nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''sub'')\n  )::uuid\n$function$\n') then
      raise exception 'kost identity: exact pinned auth.uid definition differs';
    end if;
    -- Resolve relation/column identities in THIS database, never numeric OID pins.
    if (select count(*) from pg_constraint where conrelid=to_regclass('public.athletes')
          and conname='athletes_coach_id_fkey') <> 1
       or not exists (select 1 from pg_constraint k
        where k.conrelid=to_regclass('public.athletes') and k.conname='athletes_coach_id_fkey'
          and k.contype='f' and k.confrelid=to_regclass('public.profiles')
          and k.conkey=array[(select attnum from pg_attribute
            where attrelid=to_regclass('public.athletes') and attname='coach_id' and not attisdropped)]::smallint[]
          and k.confkey=array[(select attnum from pg_attribute
            where attrelid=to_regclass('public.profiles') and attname='id' and not attisdropped)]::smallint[]
          and k.confupdtype='a' and k.confdeltype='c' and k.confmatchtype='s'
          and k.convalidated and not k.condeferrable and not k.condeferred) then
      raise exception 'kost identity: exact pinned athletes coach FK differs';
    end if;

    if current_user <> 'postgres' or session_user <> 'postgres' or auth.uid() is not null
       or coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb <> '{}'::jsonb then
      raise exception 'kost identity: trusted postgres maintenance without user JWT required';
    end if;
    if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role','postgres')) <> 4
       or exists (select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
       or pg_has_role('anon','postgres','MEMBER') or pg_has_role('authenticated','postgres','MEMBER')
       or pg_has_role('anon','service_role','MEMBER') or pg_has_role('authenticated','service_role','MEMBER') then
      raise exception 'kost identity: role prerequisites differ';
    end if;
    if not exists (select 1 from pg_namespace where nspname='public')
       or not exists (select 1 from pg_namespace where nspname='auth')
       or not exists (select 1 from pg_proc where oid=to_regprocedure('auth.uid()') and prorettype='uuid'::regtype and not proretset)
       or not exists (select 1 from pg_proc where oid=to_regprocedure('auth.jwt()') and prorettype='jsonb'::regtype and not proretset)
       or not has_function_privilege('authenticated','auth.uid()','EXECUTE')
       or not has_function_privilege('anon','auth.uid()','EXECUTE')
       or not has_function_privilege('authenticated','auth.jwt()','EXECUTE')
       or not has_schema_privilege('authenticated','auth','USAGE')
       or not has_schema_privilege('authenticated','public','USAGE') then
      raise exception 'kost identity: auth helper prerequisites missing';
    end if;
    if not exists (select 1 from pg_class where oid=to_regclass('public.athletes') and relkind='r'
       and relowner=(select oid from pg_roles where rolname='postgres') and relrowsecurity and not relforcerowsecurity) then
      raise exception 'kost identity: athletes table/RLS/owner differs';
    end if;
    -- Resolve expected OIDs locally from trusted built-ins, never a foreign catalog's numbers.
    -- Compare schema/kind/modifier too: same-name enums/domains/custom types are drift.
    -- This runs in both phases, for UP, repeated UP and deliberate DOWN.
    if (select jsonb_agg(jsonb_build_object('name',a.attname,'type',t.typname,'notnull',a.attnotnull,
          'type_oid',a.atttypid,'type_schema',n.nspname,'type_kind',t.typtype,'typmod',a.atttypmod) order by a.attnum)
        from pg_attribute a join pg_type t on t.oid=a.atttypid
        join pg_namespace n on n.oid=t.typnamespace
        where a.attrelid='public.athletes'::regclass and a.attnum>0 and not a.attisdropped) is distinct from
       (select jsonb_agg(e.value || jsonb_build_object(
          'type_oid',to_regtype(format('pg_catalog.%I',e.value->>'type'))::oid,
          'type_schema','pg_catalog','type_kind','b','typmod',-1) order by e.ordinality)
        from jsonb_array_elements($json$[{"name":"id","type":"uuid","notnull":true},{"name":"coach_id","type":"uuid","notnull":false},{"name":"name","type":"text","notnull":true},{"name":"email","type":"text","notnull":false},{"name":"age","type":"int4","notnull":false},{"name":"sex","type":"text","notnull":false},{"name":"weight_class","type":"numeric","notnull":false},{"name":"bodyweight","type":"numeric","notnull":false},{"name":"height","type":"numeric","notnull":false},{"name":"activity","type":"numeric","notnull":false},{"name":"goal","type":"text","notnull":false},{"name":"status","type":"text","notnull":false},{"name":"squat","type":"numeric","notnull":false},{"name":"bench","type":"numeric","notnull":false},{"name":"deadlift","type":"numeric","notnull":false},{"name":"kcal_target","type":"int4","notnull":false},{"name":"protein_target","type":"int4","notnull":false},{"name":"notes","type":"text","notnull":false},{"name":"created_at","type":"timestamptz","notnull":false},{"name":"training_squat","type":"numeric","notnull":false},{"name":"training_bench","type":"numeric","notnull":false},{"name":"training_deadlift","type":"numeric","notnull":false},{"name":"user_id","type":"uuid","notnull":false},{"name":"competition_date","type":"date","notnull":false},{"name":"hidden","type":"bool","notnull":true},{"name":"vacation_until","type":"date","notnull":false},{"name":"snooze_until","type":"date","notnull":false},{"name":"onboarding_completed_at","type":"timestamptz","notnull":false}]$json$::jsonb) with ordinality e(value,ordinality))
       or exists (select 1 from pg_attribute where attrelid='public.athletes'::regclass and attnum>0
           and (attisdropped or attacl is not null or attgenerated<>'' or attidentity<>'')) then
      raise exception 'kost identity: exact pinned column types/nullability or column privileges differ';
    end if;
    if (select jsonb_agg(jsonb_build_object('policyname',policyname,'permissive',permissive,'roles',roles,
       'cmd',cmd,'qual',qual,'with_check',with_check) order by policyname)
       from pg_policies where schemaname='public' and tablename='athletes') is distinct from $json$[{"policyname":"athletes_delete","permissive":"PERMISSIVE","roles":["public"],"cmd":"DELETE","qual":"(coach_id = ( SELECT auth.uid() AS uid))","with_check":null},{"policyname":"athletes_insert","permissive":"PERMISSIVE","roles":["public"],"cmd":"INSERT","qual":null,"with_check":"(coach_id = ( SELECT auth.uid() AS uid))"},{"policyname":"athletes_select","permissive":"PERMISSIVE","roles":["public"],"cmd":"SELECT","qual":"((coach_id = ( SELECT auth.uid() AS uid)) OR (email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)) OR (user_id = ( SELECT auth.uid() AS uid)))","with_check":null},{"policyname":"athletes_update","permissive":"PERMISSIVE","roles":["public"],"cmd":"UPDATE","qual":"(coach_id = ( SELECT auth.uid() AS uid))","with_check":"(coach_id = ( SELECT auth.uid() AS uid))"}]$json$::jsonb then
      raise exception 'kost identity: exact pinned athletes policies differ';
    end if;
    -- R2 current contract: 2026-11-07 16:14:29 UTC catalog explicitly includes
    -- non-owner MAINTAIN for anon/authenticated/service_role; these are prerequisites,
    -- never privileges to grant. Ignore only implicit owner MAINTAIN, as before.
    -- All entries retain the observed postgres grantor and no grant options.
    if (select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(x.grantee),'privilege',x.privilege_type)
         order by pg_get_userbyid(x.grantee),x.privilege_type)
        from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
        where c.oid='public.athletes'::regclass and not (x.grantee=c.relowner and x.privilege_type='MAINTAIN'))
       is distinct from $json$[{"role":"anon","privilege":"DELETE"},{"role":"anon","privilege":"INSERT"},{"role":"anon","privilege":"MAINTAIN"},{"role":"anon","privilege":"SELECT"},{"role":"anon","privilege":"UPDATE"},{"role":"authenticated","privilege":"DELETE"},{"role":"authenticated","privilege":"INSERT"},{"role":"authenticated","privilege":"MAINTAIN"},{"role":"authenticated","privilege":"SELECT"},{"role":"authenticated","privilege":"UPDATE"},{"role":"postgres","privilege":"DELETE"},{"role":"postgres","privilege":"INSERT"},{"role":"postgres","privilege":"REFERENCES"},{"role":"postgres","privilege":"SELECT"},{"role":"postgres","privilege":"TRIGGER"},{"role":"postgres","privilege":"TRUNCATE"},{"role":"postgres","privilege":"UPDATE"},{"role":"service_role","privilege":"DELETE"},{"role":"service_role","privilege":"INSERT"},{"role":"service_role","privilege":"MAINTAIN"},{"role":"service_role","privilege":"REFERENCES"},{"role":"service_role","privilege":"SELECT"},{"role":"service_role","privilege":"TRIGGER"},{"role":"service_role","privilege":"TRUNCATE"},{"role":"service_role","privilege":"UPDATE"}]$json$::jsonb
       or exists (select 1 from pg_class c cross join lateral aclexplode(c.relacl) x
          where c.oid='public.athletes'::regclass and (x.grantor<>c.relowner or x.is_grantable)) then
      raise exception 'kost identity: pinned athletes table grants differ';
    end if;
    if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='claim_athlete_profile_v3') <> 1
       or not exists (select 1 from pg_proc where oid=to_regprocedure('public.claim_athlete_profile_v3()')
         and prosecdef and prorettype='uuid'::regtype and not proretset
         and proowner=(select oid from pg_roles where rolname='postgres')
         and replace(pg_get_functiondef(oid),E'\r\n',E'\n')=$rpc$CREATE OR REPLACE FUNCTION public.claim_athlete_profile_v3()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_matches uuid[];
  v_athlete_id uuid;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Authenticated user with email required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'athlete'
  ) then
    raise exception 'Only an athlete profile can claim an athlete row';
  end if;

  if exists (
    select 1
    from public.athletes a
    where lower(btrim(a.email)) = v_email
      and a.user_id is not null
      and a.user_id <> v_user_id
  ) then
    raise exception 'Matching athlete profile is already linked to another user';
  end if;

  select array_agg(a.id order by a.id)
    into v_matches
  from public.athletes a
  where lower(btrim(a.email)) = v_email
    and (a.user_id is null or a.user_id = v_user_id);

  if coalesce(array_length(v_matches, 1), 0) = 0 then
    raise exception 'No unclaimed athlete profile matches this login';
  end if;
  if array_length(v_matches, 1) <> 1 then
    raise exception 'Athlete profile match is ambiguous; coach linking required';
  end if;

  v_athlete_id := v_matches[1];

  update public.athletes
  set user_id = v_user_id
  where id = v_athlete_id
    and (user_id is null or user_id = v_user_id);

  if not found then
    raise exception 'Athlete profile could not be claimed';
  end if;

  return v_athlete_id;
end
$function$
$rpc$) then
      raise exception 'kost identity: exact pinned claim RPC differs';
    end if;
    -- Relevant profile types are prerequisites; timestamped public metadata and faithful
    -- fixtures are documented in the integration note. This script changes neither
    -- parent constraints nor helpers/RPC/ACL.
    if not exists (select 1 from pg_attribute where attrelid=to_regclass('public.profiles') and attname='id' and atttypid='uuid'::regtype and not attisdropped)
       or not exists (select 1 from pg_attribute where attrelid=to_regclass('public.profiles') and attname='role' and atttypid='text'::regtype and not attisdropped) then
      raise exception 'kost identity: claim profile prerequisites missing';
    end if;
    -- Allow only this exact pair and the unchanged original tracking pair.
    -- Unknown trigger/function/overload, disabled trigger or half-installed pair fails closed.
    if exists (select 1 from pg_trigger where tgrelid='public.athletes'::regclass and not tgisinternal
         and tgname not in ('kostplan_guard_athlete_identity_v1','tracking_guard_athlete_identity_v1')) then
      raise exception 'kost identity: unknown athletes user trigger';
    end if;
    foreach object_name in array array['kostplan_guard_athlete_identity_v1','tracking_guard_athlete_identity_v1'] loop
      select count(*) into function_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=object_name;
      select count(*) into trigger_count from pg_trigger where tgrelid='public.athletes'::regclass and tgname=object_name;
      if function_count=0 and trigger_count=0 then
        if phase=1 and object_name='kostplan_guard_athlete_identity_v1' and not removing then
          raise exception 'kost identity: postcondition missing pair';
        end if;
      elsif function_count=1 and trigger_count=1 then
        if not exists (select 1 from pg_proc p join pg_language l on l.oid=p.prolang
           where p.oid=to_regprocedure(format('public.%I()',object_name)) and l.lanname='plpgsql'
             and not p.prosecdef and not p.proleakproof and not p.proisstrict and not p.proretset
             and p.prokind='f' and p.provolatile='v' and p.proparallel='u' and p.pronargs=0
             and p.prorettype='trigger'::regtype and p.proconfig=array['search_path=pg_catalog']
             and p.procost=100 and p.prorows=0 and p.prosupport=0 and p.provariadic=0
             and p.pronargdefaults=0 and p.proargnames is null and p.proallargtypes is null
             and p.proargmodes is null and p.protrftypes is null and p.probin is null and p.prosqlbody is null
             and p.proowner=(select oid from pg_roles where rolname='postgres')
             and (p.prosrc=expected_body or (object_name='tracking_guard_athlete_identity_v1' and p.prosrc=replace(expected_body,E'\n',E'\r\n')))
             and (select count(*) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))=1
             and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
               where x.grantee<>p.proowner or x.privilege_type<>'EXECUTE' or x.is_grantable))
           or not exists (select 1 from pg_trigger t where t.tgrelid='public.athletes'::regclass and t.tgname=object_name
             and t.tgfoid=to_regprocedure(format('public.%I()',object_name)) and t.tgtype=19
             and t.tgenabled='O' and not t.tgisinternal and t.tgattr=''::int2vector and t.tgqual is null
             and t.tgnargs=0 and octet_length(t.tgargs)=0 and t.tgconstraint=0 and t.tgconstrrelid=0
             and not t.tgdeferrable and not t.tginitdeferred and t.tgoldtable is null and t.tgnewtable is null) then
          raise exception 'kost identity: colliding or drifted %',object_name;
        end if;
        if phase=1 and object_name='kostplan_guard_athlete_identity_v1' and removing then
          raise exception 'kost identity: rollback postcondition pair still installed';
        end if;
      else
        raise exception 'kost identity: partial or overloaded %',object_name;
      end if;
    end loop;

    if phase=0 then
      if to_regprocedure('public.kostplan_guard_athlete_identity_v1()') is null then
        execute 'create function public.kostplan_guard_athlete_identity_v1() returns trigger
          language plpgsql security invoker set search_path=pg_catalog as '
          || quote_literal(expected_body);
        revoke all on function public.kostplan_guard_athlete_identity_v1() from public,anon,authenticated,service_role;
        create trigger kostplan_guard_athlete_identity_v1 before update on public.athletes
          for each row execute function public.kostplan_guard_athlete_identity_v1();
      end if;
    end if;
  end loop;
end;
$migration$;

-- DRAFT: Entropi Coach / KOST-DATA1. Written only; requires separate approval to run.
-- Prerequisites: public.athletes(id, user_id, coach_id) are UUIDs; auth.uid();
-- authenticated and anon roles. The migration owner owns the new objects and
-- can read athletes. Application roles must not own these tables or bypass RLS.
-- No existing table, policy, grant or data is changed.


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



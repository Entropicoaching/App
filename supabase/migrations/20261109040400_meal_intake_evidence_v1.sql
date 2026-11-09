-- LOCAL DRAFT ONLY: no migration, activation or production command.
-- User-reported food reference; source strings are not server-attested facts.
-- Deliberately fails if any new object already exists. Old objects stay intact.
begin;

create function public.meal_intake_evidence_v1_macros(p_request jsonb)
returns integer[] language plpgsql immutable security invoker
set search_path = pg_catalog, public
as $$
declare
  f jsonb; n jsonb; s jsonb; k text; v jsonb; grams numeric;
  x double precision; fraction double precision; rounded double precision;
  result integer[] := '{}';
  -- Exact ECMAScript WhiteSpace + LineTerminator set used by trim/trimStart.
  -- Control members are still forbidden anywhere by the independent text check.
  ws constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  keys constant text[] := array['energyKcal','proteinG','carbohydrateG','fatG','fibreG',
    'ironMg','calciumMg','magnesiumMg','zincMg','potassiumMg','sodiumMg',
    'vitaminDUg','vitaminB12Ug','folateUg','leucineG'];
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object'
    or octet_length(p_request::text) > 20000 then
    raise exception 'intake_invalid_request' using errcode='22023';
  end if;
  if not (p_request ?& array['version','requestId','athleteId','date','grams','meal','food'])
    or (p_request - array['version','requestId','athleteId','date','grams','meal','food']) <> '{}'
    or p_request->'version' <> '1'::jsonb then
    raise exception 'intake_invalid_schema' using errcode='22023';
  end if;
  foreach k in array array['requestId','athleteId'] loop
    if jsonb_typeof(p_request->k) <> 'string'
      or (p_request->>k) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'intake_invalid_identity' using errcode='22023';
    end if;
  end loop;
  if jsonb_typeof(p_request->'date') <> 'string'
    or (p_request->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'intake_invalid_date' using errcode='22023';
  end if;
  -- Native cast rejects impossible calendar days. No locale-dependent dates.
  if (p_request->>'date')::date < date '1900-01-01'
    or (p_request->>'date')::date > date '9999-12-31' then
    raise exception 'intake_invalid_date' using errcode='22023';
  end if;
  if jsonb_typeof(p_request->'grams') <> 'number' then
    raise exception 'intake_invalid_grams' using errcode='22023';
  end if;
  grams := (p_request->>'grams')::numeric;
  if grams <= 0 or grams > 100000 or grams <> round(grams,6) then
    raise exception 'intake_invalid_grams' using errcode='22023';
  end if;
  if jsonb_typeof(p_request->'meal') <> 'string'
    or char_length(p_request->>'meal') > 512
    or btrim(p_request->>'meal',ws) = ''
    or (p_request->>'meal') ~ U&'[\0001-\001F\007F-\009F]'
    or ltrim(p_request->>'meal',ws) like '[appData2-day-v1]%' then
    raise exception 'intake_invalid_meal' using errcode='22023';
  end if;
  f := p_request->'food'; n := f->'nutrientsPer100g'; s := f->'source';
  if jsonb_typeof(f) <> 'object' or octet_length(f::text)>16384
    or not (f ?& array['id','name','preparation','basisGrams','nutrientsPer100g','source'])
    or (f - array['id','name','preparation','basisGrams','nutrientsPer100g','source']) <> '{}'
    or f->'basisGrams' <> '100'::jsonb
    or jsonb_typeof(n) <> 'object' or not (n ?& keys) or (n - keys) <> '{}'
    or jsonb_typeof(s) <> 'object' or not (s ?& array['citation','verification'])
    or (s - array['citation','verification']) <> '{}' then
    raise exception 'intake_invalid_food_schema' using errcode='22023';
  end if;
  foreach k in array array['id','name','preparation','citation','verification'] loop
    v := case when k in ('citation','verification') then s->k else f->k end;
    if jsonb_typeof(v) <> 'string' or btrim(v#>>'{}',ws) = ''
      or (v#>>'{}') ~ U&'[\0001-\001F\007F-\009F]'
      or char_length(v#>>'{}') > (case k when 'id' then 128 when 'citation' then 2048 else 256 end) then
      raise exception 'intake_invalid_food_text' using errcode='22023';
    end if;
  end loop;
  foreach k in array keys loop
    v := n->k;
    if v <> 'null'::jsonb then
      if jsonb_typeof(v) <> 'number' then
        raise exception 'intake_invalid_nutrient_type' using errcode='22023';
      end if;
      if (v#>>'{}')::numeric < 0 or (v#>>'{}')::numeric > 1e12 then
        raise exception 'intake_invalid_nutrient_bound' using errcode='22023';
      end if;
    end if;
  end loop;
  foreach k in array keys[1:4] loop
    if n->k = 'null'::jsonb then
      raise exception 'intake_unknown_macro' using errcode='22023';
    end if;
    -- BF98 nutritionValues/roundNutrition: positive Math.round plus its fixed
    -- 1024*Number.EPSILON tolerance. Same binary64 operation order as product.
    x := (n->>k)::double precision * (grams::double precision / 100::double precision);
    fraction := x - floor(x);
    rounded := case when fraction > 0 and fraction < 0.5
      and 0.5-fraction <= 2.2737367544323206e-13 then floor(x)+1 else floor(x+0.5) end;
    if rounded > 2147483647 then
      raise exception 'intake_macro_overflow' using errcode='22023';
    end if;
    result := array_append(result, rounded::integer);
  end loop;
  return result;
end;
$$;

-- Technical once-only identity, deliberately NO food/payload/date/timestamp.
-- Kept after meal deletion; athlete deletion removes its bindings by FK cascade.
create table public.meal_intake_requests_v1 (
  request_id uuid primary key,
  athlete_id uuid not null references public.athletes(id) on delete cascade
);
alter table public.meal_intake_requests_v1 enable row level security;
create policy meal_intake_requests_v1_read on public.meal_intake_requests_v1
for select to authenticated using (
  auth.uid() is not null and exists(select 1 from public.athletes a
    where a.id=meal_intake_requests_v1.athlete_id and a.user_id is not null
      and (a.user_id=auth.uid() or a.coach_id=auth.uid()))
);
create policy meal_intake_requests_v1_insert on public.meal_intake_requests_v1
for insert to authenticated with check (
  auth.uid() is not null and exists(select 1 from public.athletes a
    where a.id=meal_intake_requests_v1.athlete_id and a.user_id is not null
      and (a.user_id=auth.uid() or a.coach_id=auth.uid()))
);

create table public.meal_intake_evidence_v1 (
  meal_log_id uuid primary key references public.meal_logs(id) on delete cascade,
  request_id uuid not null unique check(request_id=meal_log_id),
  athlete_id uuid not null,
  date date not null,
  version integer not null check(version=1),
  food jsonb not null,
  grams numeric not null,
  meal text not null,
  kcal integer not null, protein integer not null, carb integer not null, fat integer not null,
  created_at timestamptz not null default now(),
  constraint meal_intake_evidence_v1_valid check (
    array[kcal,protein,carb,fat] = public.meal_intake_evidence_v1_macros(jsonb_build_object(
      'version',version,'requestId',request_id,'athleteId',athlete_id,'date',date,
      'food',food,'grams',grams,'meal',meal)))
);
alter table public.meal_intake_evidence_v1 enable row level security;

create policy meal_intake_evidence_v1_read on public.meal_intake_evidence_v1
for select to authenticated using (
  auth.uid() is not null and exists(select 1 from public.athletes a
    where a.id=meal_intake_evidence_v1.athlete_id and a.user_id is not null
      and (a.user_id=auth.uid() or a.coach_id=auth.uid()))
  and exists(select 1 from public.meal_logs m where m.id=meal_log_id
    and m.athlete_id=meal_intake_evidence_v1.athlete_id and m.date=meal_intake_evidence_v1.date)
);
-- INSERT RLS enforces UID binding; the mandatory BEFORE trigger enforces
-- NEW parent creation + exact tuple. An outer statement snapshot cannot rely
-- on seeing a parent just inserted by its own trigger in a policy subquery.
create policy meal_intake_evidence_v1_insert on public.meal_intake_evidence_v1
for insert to authenticated with check (
  auth.uid() is not null and exists(select 1 from public.athletes a
    where a.id=meal_intake_evidence_v1.athlete_id and a.user_id is not null
      and (a.user_id=auth.uid() or a.coach_id=auth.uid()))
);

-- The ONLY evidence creation boundary, including direct table INSERT.
-- Never infer creation from xmin, an existing parent, or a caller session marker.
create function public.meal_intake_evidence_v1_create_parent()
returns trigger language plpgsql volatile security invoker
set search_path = pg_catalog, public
as $$
declare values4 integer[];
begin
  -- Validate everything before reserving identity or writing the original table.
  values4 := public.meal_intake_evidence_v1_macros(jsonb_build_object(
    'version',new.version,'requestId',new.request_id,'athleteId',new.athlete_id,
    'date',new.date,'food',new.food,'grams',new.grams,'meal',new.meal));
  if new.meal_log_id is distinct from new.request_id
    or array[new.kcal,new.protein,new.carb,new.fat] is distinct from values4 then
    raise exception 'intake_invalid_pair' using errcode='22023';
  end if;
  if auth.uid() is null or not exists(select 1 from public.athletes a
    where a.id=new.athlete_id and a.user_id is not null
      and (a.user_id=auth.uid() or a.coach_id=auth.uid())) then
    raise exception 'intake_denied' using errcode='42501';
  end if;
  -- Plain unique INSERT: a used/retired UUID cannot create another parent.
  -- A direct ledger-only reservation can retire a UUID, never authorize adoption.
  insert into public.meal_intake_requests_v1(request_id,athlete_id)
    values(new.request_id,new.athlete_id);
  -- Plain original INSERT: every accepted evidence row creates its OWN new parent.
  -- Preexisting manual parents (even same tuple/no-op updated) cause rollback.
  -- Original email/coach RLS applies naturally to this INVOKER write.
  insert into public.meal_logs(id,athlete_id,date,meal,kcal,protein,carb,fat)
    values(new.meal_log_id,new.athlete_id,new.date,new.meal,
      values4[1],values4[2],values4[3],values4[4]);
  if not exists(select 1 from public.meal_logs m where m.id=new.meal_log_id
    and m.athlete_id=new.athlete_id and m.date=new.date and m.meal=new.meal
    and array[m.kcal,m.protein,m.carb,m.fat]=values4) then
    raise exception 'intake_denied' using errcode='42501';
  end if;
  new.created_at := now();
  return new;
end;
$$;
create trigger meal_intake_evidence_v1_create_parent
before insert on public.meal_intake_evidence_v1
for each row execute function public.meal_intake_evidence_v1_create_parent();

create function public.record_meal_intake_evidence_v1(p_request jsonb)
returns jsonb language plpgsql volatile security invoker
set search_path = pg_catalog, public
as $$
declare
  values4 integer[]; aid uuid; rid uuid; on_day date;
  e public.meal_intake_evidence_v1%rowtype; m public.meal_logs%rowtype;
begin
  -- Entire payload validated before any write, including retry calls.
  values4 := public.meal_intake_evidence_v1_macros(p_request);
  aid := (p_request->>'athleteId')::uuid; rid := (p_request->>'requestId')::uuid;
  on_day := (p_request->>'date')::date;
  if auth.uid() is null or not exists(select 1 from public.athletes a where a.id=aid
    and a.user_id is not null and (a.user_id=auth.uid() or a.coach_id=auth.uid())) then
    raise exception 'intake_denied' using errcode='42501';
  end if;
  -- Trigger reserves request + creates parent + inserts evidence atomically.
  -- The ledger's unique index waits for competing transactions. On duplicate,
  -- this subtransaction rolls back ALL attempted writes before checking the
  -- existing pair. A retired request has no pair and is always a conflict.
  begin
    insert into public.meal_intake_evidence_v1(meal_log_id,request_id,athlete_id,date,version,food,grams,meal,kcal,protein,carb,fat)
      values(rid,rid,aid,on_day,1,p_request->'food',(p_request->>'grams')::numeric,
        p_request->>'meal',values4[1],values4[2],values4[3],values4[4]);
  exception when unique_violation then
    null;
  end;
  select * into e from public.meal_intake_evidence_v1 where request_id=rid;
  select * into m from public.meal_logs where id=rid for share;
  if e.meal_log_id is null or m.id is null or e.athlete_id<>aid or e.date<>on_day
    or e.version<>1 or e.food<>p_request->'food' or e.grams<>(p_request->>'grams')::numeric
    or e.meal<>p_request->>'meal' or array[e.kcal,e.protein,e.carb,e.fat]<>values4
    or m.athlete_id is distinct from aid or m.date is distinct from on_day
    or m.meal is distinct from e.meal or array[m.kcal,m.protein,m.carb,m.fat] is distinct from values4 then
    raise exception 'intake_request_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('mealLog',to_jsonb(m),'evidence',to_jsonb(e));
end;
$$;

-- Defeat inherited project default table grants and default PUBLIC EXECUTE.
-- INVOKER requires these table permissions; no UPDATE/DELETE/TRUNCATE grant.
revoke all on table public.meal_intake_requests_v1 from public, anon, authenticated, service_role;
grant select, insert on table public.meal_intake_requests_v1 to authenticated;
-- Trigger EXECUTE is checked at CREATE TRIGGER, not runtime. App roles cannot
-- call a trigger function directly or create/disable triggers. No execute grant.
revoke all on function public.meal_intake_evidence_v1_create_parent() from public, anon, authenticated, service_role;
revoke all on table public.meal_intake_evidence_v1 from public, anon, authenticated, service_role;
grant select, insert on table public.meal_intake_evidence_v1 to authenticated;
revoke all on function public.meal_intake_evidence_v1_macros(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.meal_intake_evidence_v1_macros(jsonb) to authenticated;
revoke all on function public.record_meal_intake_evidence_v1(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_meal_intake_evidence_v1(jsonb) to authenticated;
commit;

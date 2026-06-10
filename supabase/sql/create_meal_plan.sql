-- ============================================================
-- create_meal_plan(p_payload jsonb)
--
-- Opretter en eller flere FULDE DAGS-madplaner for en atlet i ÉT kald,
-- atomisk (fejler noget, rulles alt tilbage). Hver "dag" gemmes som en
-- meal_template — atleten ser den under "Skabeloner" i Kost-fanen og kan
-- trykke "Log alt" for at logge hele dagen på én gang.
-- Kan valgfrit sætte atletens kcal/protein-mål samtidig.
--
-- Kost-pendant til create_program_week. Bygget til at Claude/agent kan
-- skubbe kostplaner ind uden Dashboard-UI'et.
--
-- Kaldes via PostgREST RPC med service_role-nøglen:
--   POST {SUPABASE_URL}/rest/v1/rpc/create_meal_plan
--   headers: apikey + Authorization: Bearer <service_role>
--   body: { "p_payload": { ...se nedenfor... } }
--
-- p_payload:
-- {
--   "athleteId": "uuid",
--   "kcalTarget": 3000,        // valgfrit — sætter athletes.kcal_target
--   "proteinTarget": 200,      // valgfrit — sætter athletes.protein_target
--   "days": [
--     { "name": "Dag 1 · 3000 kcal", "items": [
--         { "meal": "Havregryn 100g + skyr 200g", "kcal": 520, "protein": 38, "carb": 70, "fat": 9 },
--         { "meal": "Kylling 200g + ris 150g",     "kcal": 610, "protein": 55, "carb": 65, "fat": 12 }
--     ] }
--   ]
-- }
--
-- Makroer opgives PR. ITEM (samme form som meal_logs/meal_templates).
-- Tomme dage (ingen items) springes over. "name" defaulter til "Dagsplan N".
--
-- Kør HELE blokken i Supabase -> SQL Editor.
-- ============================================================

create or replace function public.create_meal_plan(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_athlete_id  uuid;
  v_kcal        int;
  v_protein     int;
  rec           record;
  v_items       jsonb;
  v_name        text;
  v_day_count   int := 0;
  v_item_total  int := 0;
begin
  v_athlete_id := nullif(p_payload->>'athleteId', '')::uuid;

  if v_athlete_id is null then
    raise exception 'athleteId mangler';
  end if;
  if not exists (select 1 from athletes where id = v_athlete_id) then
    raise exception 'athlete_not_found' using errcode = 'P0002';
  end if;

  -- Valgfrit: sæt kost-mål samtidig (kun de felter der er angivet)
  v_kcal    := nullif(p_payload->>'kcalTarget', '')::int;
  v_protein := nullif(p_payload->>'proteinTarget', '')::int;
  if v_kcal is not null or v_protein is not null then
    update athletes
       set kcal_target    = coalesce(v_kcal, kcal_target),
           protein_target = coalesce(v_protein, protein_target)
     where id = v_athlete_id;
  end if;

  -- Hver "dag" -> én meal_template med normaliserede items
  for rec in
    select d.value as day, d.ordinality as ord
    from jsonb_array_elements(coalesce(p_payload->'days', '[]'::jsonb))
         with ordinality as d(value, ordinality)
  loop
    -- Normalisér items: behold kun meal/kcal/protein/carb/fat, rund makroer til heltal
    select coalesce(jsonb_agg(jsonb_build_object(
             'meal',    coalesce(nullif(it->>'meal', ''), 'Måltid'),
             'kcal',    round(coalesce((it->>'kcal')::numeric, 0))::int,
             'protein', round(coalesce((it->>'protein')::numeric, 0))::int,
             'carb',    round(coalesce((it->>'carb')::numeric, 0))::int,
             'fat',     round(coalesce((it->>'fat')::numeric, 0))::int
           )), '[]'::jsonb)
      into v_items
    from jsonb_array_elements(coalesce(rec.day->'items', '[]'::jsonb)) as it;

    if jsonb_array_length(v_items) = 0 then
      continue;  -- spring tomme dage over
    end if;

    v_name := coalesce(nullif(rec.day->>'name', ''), 'Dagsplan ' || rec.ord);

    insert into meal_templates (athlete_id, name, items)
    values (v_athlete_id, v_name, v_items);

    v_day_count  := v_day_count + 1;
    v_item_total := v_item_total + jsonb_array_length(v_items);
  end loop;

  return jsonb_build_object(
    'athlete_id',     v_athlete_id,
    'days_created',   v_day_count,
    'items_total',    v_item_total,
    'kcal_target',    v_kcal,
    'protein_target', v_protein
  );
end;
$fn$;

-- Lås ude fra den offentlige anon-nøgle (den ligger i frontend!). Kun service_role må kalde.
revoke all on function public.create_meal_plan(jsonb) from public, anon, authenticated;
grant execute on function public.create_meal_plan(jsonb) to service_role;

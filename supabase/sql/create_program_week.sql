-- ============================================================
-- create_program_week(p_payload jsonb)
--
-- Opretter en hel træningsuge (uge -> sessioner -> øvelser) for en
-- atlet i ÉT kald, atomisk (fejler noget, rulles alt tilbage).
-- Funktionen tager den fulde "rige" JSON og oversætter selv til den
-- flade datamodel — ingen edge function nødvendig.
--
-- Kaldes via PostgREST RPC med service_role-nøglen:
--   POST {SUPABASE_URL}/rest/v1/rpc/create_program_week
--   headers: apikey + Authorization: Bearer <service_role>
--   body: { "p_payload": { ...se nedenfor... } }
--
-- p_payload:
-- {
--   "athleteId": "uuid", "week": 1, "blockName": "Blok 1", "coachNote": "...",
--   "sessions": [
--     { "day": "sunday", "label": "Sek bænk",
--       "exercises": [
--         { "name": "Pause bænk 3s",
--           "sets": [ {"reps":4,"weight":130}, ... ],
--           "rpeTarget": 7.5, "note": "..." } ] } ]
-- }
--
-- Mapping til datamodellen:
--   sets-array  -> sets (antal) ; ens reps -> "4", varierende -> "3-5"
--   tungeste sæt -> recommended_weight (top-sæt)
--   rpeTarget    -> intensity "RPE 7.5" (ellers exercise.intensity)
--   label        -> sessionens title ; day -> rækkefølge (ingen dag-kolonne)
--
-- Kør HELE blokken i Supabase -> SQL Editor.
-- ============================================================

create or replace function public.create_program_week(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_athlete_id     uuid;
  v_week_number    int;
  v_week_id        uuid;
  rec              record;
  v_session_id     uuid;
  v_ex             jsonb;
  v_sets           jsonb;
  v_reps_min       int;
  v_reps_max       int;
  v_weight_max     numeric;
  v_reps           text;
  v_intensity      text;
  v_set_count      int;
  v_ex_order       int;
  v_session_count  int := 0;
  v_exercise_count int := 0;
begin
  v_athlete_id  := nullif(p_payload->>'athleteId', '')::uuid;
  v_week_number := nullif(p_payload->>'week', '')::int;

  if v_athlete_id is null then
    raise exception 'athleteId mangler';
  end if;
  if not exists (select 1 from athletes where id = v_athlete_id) then
    raise exception 'athlete_not_found' using errcode = 'P0002';
  end if;

  insert into weeks (athlete_id, week_number, block_name, coach_note)
  values (
    v_athlete_id,
    v_week_number,
    nullif(p_payload->>'blockName', ''),
    nullif(p_payload->>'coachNote', '')
  )
  returning id into v_week_id;

  -- Sessioner: sortér efter ugedag (man=1..søn=7, ukendt sidst), behold input-rækkefølge ved uafgjort
  for rec in
    select s.value as sess,
           row_number() over (
             order by
               case lower(coalesce(s.value->>'day', ''))
                 when 'monday' then 1    when 'mandag' then 1
                 when 'tuesday' then 2   when 'tirsdag' then 2
                 when 'wednesday' then 3 when 'onsdag' then 3
                 when 'thursday' then 4  when 'torsdag' then 4
                 when 'friday' then 5    when 'fredag' then 5
                 when 'saturday' then 6  when 'lørdag' then 6 when 'lordag' then 6
                 when 'sunday' then 7    when 'søndag' then 7 when 'sondag' then 7
                 else 99
               end,
               s.ordinality
           ) - 1 as so
    from jsonb_array_elements(coalesce(p_payload->'sessions', '[]'::jsonb))
         with ordinality as s(value, ordinality)
  loop
    insert into sessions (week_id, title, session_order)
    values (v_week_id, coalesce(nullif(rec.sess->>'label', ''), 'Træning'), rec.so::int)
    returning id into v_session_id;
    v_session_count := v_session_count + 1;

    v_ex_order := 0;
    for v_ex in
      select value from jsonb_array_elements(coalesce(rec.sess->'exercises', '[]'::jsonb))
    loop
      v_sets      := coalesce(v_ex->'sets', '[]'::jsonb);
      v_set_count := jsonb_array_length(v_sets);

      select min((elem->>'reps')::int),
             max((elem->>'reps')::int),
             max((elem->>'weight')::numeric)
        into v_reps_min, v_reps_max, v_weight_max
      from jsonb_array_elements(v_sets) as elem;

      if v_reps_min is null then
        v_reps := nullif(v_ex->>'reps', '');           -- fallback hvis ingen sets-array
      elsif v_reps_min = v_reps_max then
        v_reps := v_reps_min::text;
      else
        v_reps := v_reps_min::text || '-' || v_reps_max::text;
      end if;

      if nullif(v_ex->>'rpeTarget', '') is not null then
        v_intensity := 'RPE ' || (v_ex->>'rpeTarget');
      else
        v_intensity := nullif(v_ex->>'intensity', '');
      end if;

      insert into exercises
        (session_id, name, sets, reps, intensity, note, recommended_weight, exercise_order)
      values (
        v_session_id,
        coalesce(nullif(v_ex->>'name', ''), 'Øvelse'),
        nullif(v_set_count, 0),
        v_reps,
        v_intensity,
        nullif(v_ex->>'note', ''),
        v_weight_max,
        v_ex_order
      );
      v_ex_order       := v_ex_order + 1;
      v_exercise_count := v_exercise_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'week_id',     v_week_id,
    'week_number', v_week_number,
    'sessions',    v_session_count,
    'exercises',   v_exercise_count
  );
end;
$fn$;

-- Lås ude fra den offentlige anon-nøgle (den ligger i frontend!). Kun service_role må kalde.
revoke all on function public.create_program_week(jsonb) from public, anon, authenticated;
grant execute on function public.create_program_week(jsonb) to service_role;

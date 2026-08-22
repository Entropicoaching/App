-- Fylder en allerede planlagt, tom programuge atomisk.
-- Periodiseringsplanen ejer dato, ugenummer og blok; denne RPC ejer kun
-- sessioner og øvelser. Den må aldrig overskrive en uge med indhold.

begin;

create or replace function public.fill_planned_program_week(
  p_week_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_athlete_id     uuid;
  v_week_number    int;
  v_week_id        uuid;
  v_target_athlete uuid;
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
  v_athlete_id := nullif(p_payload->>'athleteId', '')::uuid;
  if v_athlete_id is null then
    raise exception 'athleteId mangler';
  end if;

  -- Låser skallen, så to samtidige godkendelser ikke kan fylde den begge.
  select id, athlete_id, week_number
    into v_week_id, v_target_athlete, v_week_number
    from public.weeks
    where id = p_week_id
    for update;
  if not found then
    raise exception 'planned_week_not_found' using errcode = 'P0002';
  end if;
  if v_target_athlete <> v_athlete_id then
    raise exception 'planned_week_athlete_mismatch' using errcode = '42501';
  end if;
  if nullif(p_payload->>'week', '') is not null
    and (p_payload->>'week')::int <> v_week_number then
    raise exception 'planned_week_number_mismatch' using errcode = '22023';
  end if;
  if exists (select 1 from public.sessions where week_id = v_week_id) then
    raise exception 'planned_week_not_empty' using errcode = 'P0001';
  end if;

  -- Bevar periodiseringsplanens dato, blok og blokbeskrivelse.
  update public.weeks
    set coach_note = coalesce(nullif(p_payload->>'coachNote', ''), coach_note)
    where id = v_week_id;

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
    insert into public.sessions (week_id, title, session_order)
    values (v_week_id, coalesce(nullif(rec.sess->>'label', ''), 'Træning'), rec.so::int)
    returning id into v_session_id;
    v_session_count := v_session_count + 1;

    v_ex_order := 0;
    for v_ex in
      select value from jsonb_array_elements(coalesce(rec.sess->'exercises', '[]'::jsonb))
    loop
      v_sets := coalesce(v_ex->'sets', '[]'::jsonb);
      v_set_count := jsonb_array_length(v_sets);

      select min((elem->>'reps')::int),
             max((elem->>'reps')::int),
             max((elem->>'weight')::numeric)
        into v_reps_min, v_reps_max, v_weight_max
        from jsonb_array_elements(v_sets) as elem;

      if v_reps_min is null then
        v_reps := nullif(v_ex->>'reps', '');
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

      insert into public.exercises
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
      v_ex_order := v_ex_order + 1;
      v_exercise_count := v_exercise_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'week_id', v_week_id,
    'week_number', v_week_number,
    'sessions', v_session_count,
    'exercises', v_exercise_count,
    'planned_week', true
  );
end;
$fn$;

revoke all on function public.fill_planned_program_week(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fill_planned_program_week(uuid, jsonb) to service_role;

commit;

-- ============================================================
-- create_program_week — atomisk oprettelse af en hel træningsuge
-- (uge -> sessioner -> øvelser) i ét kald.
--
-- Kaldes af edge-funktionen "programs-weeks" via service role.
-- security definer + alle inserts sker i samme transaktion, så
-- hvis NOGET fejler, rulles HELE ugen tilbage (ingen halve uger).
--
-- Kør denne i Supabase -> SQL Editor (kør hele blokken én gang).
-- ============================================================

create or replace function public.create_program_week(
  p_athlete_id uuid,
  p_week_number int,
  p_block_name  text,
  p_coach_note  text,
  p_sessions    jsonb   -- [{ title, session_order, exercises:[{ name, sets, reps, intensity, note, recommended_weight, exercise_order }] }]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_id        uuid;
  v_session        jsonb;
  v_session_id     uuid;
  v_ex             jsonb;
  v_session_count  int := 0;
  v_exercise_count int := 0;
begin
  -- Atleten skal findes — ellers fejl (rulles tilbage automatisk)
  if not exists (select 1 from athletes where id = p_athlete_id) then
    raise exception 'athlete_not_found' using errcode = 'P0002';
  end if;

  insert into weeks (athlete_id, week_number, block_name, coach_note)
  values (p_athlete_id, p_week_number, nullif(p_block_name, ''), nullif(p_coach_note, ''))
  returning id into v_week_id;

  for v_session in
    select * from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb))
  loop
    insert into sessions (week_id, title, session_order)
    values (
      v_week_id,
      coalesce(nullif(v_session->>'title', ''), 'Træning'),
      coalesce((v_session->>'session_order')::int, v_session_count)
    )
    returning id into v_session_id;
    v_session_count := v_session_count + 1;

    for v_ex in
      select * from jsonb_array_elements(coalesce(v_session->'exercises', '[]'::jsonb))
    loop
      insert into exercises
        (session_id, name, sets, reps, intensity, note, recommended_weight, exercise_order)
      values (
        v_session_id,
        coalesce(nullif(v_ex->>'name', ''), 'Øvelse'),
        nullif(v_ex->>'sets', '')::int,
        nullif(v_ex->>'reps', ''),
        nullif(v_ex->>'intensity', ''),
        nullif(v_ex->>'note', ''),
        nullif(v_ex->>'recommended_weight', '')::numeric,
        coalesce((v_ex->>'exercise_order')::int, v_exercise_count)
      );
      v_exercise_count := v_exercise_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'week_id',     v_week_id,
    'week_number', p_week_number,
    'sessions',    v_session_count,
    'exercises',   v_exercise_count
  );
end;
$$;

-- Kun service role (edge-funktionen) må kalde den. Lås anon/authenticated ude.
revoke all on function public.create_program_week(uuid, int, text, text, jsonb) from public, anon, authenticated;

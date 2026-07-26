-- Entropi Coach Briefing v1.
-- Applied to production 2026-07-26 after Marc's explicit approval.
--
-- Read-only RPC for n8n. It returns only inbox metadata; message bodies and
-- video files never leave Supabase. Access is restricted to service_role.

create or replace function public.entropi_coach_briefing_v1(p_coach_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to pg_catalog, public
as $$
declare
  v_request_role text;
  v_previous_sub text;
  v_previous_claims text;
  v_messages jsonb := '[]'::jsonb;
  v_video_drafts jsonb := '[]'::jsonb;
  v_training_signals jsonb := '[]'::jsonb;
begin
  v_request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );

  if v_request_role <> 'service_role' then
    raise exception 'entropi_coach_briefing_v1 requires service_role';
  end if;

  if p_coach_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = p_coach_id
      and profile.role = 'coach'
  ) then
    raise exception 'unknown coach';
  end if;

  select coalesce(jsonb_agg(grouped.payload order by grouped.latest_at desc), '[]'::jsonb)
  into v_messages
  from (
    select
      max(message.created_at) as latest_at,
      jsonb_build_object(
        'athlete_id', athlete.id,
        'athlete_name', athlete.name,
        'track', case when coalesce(message.category, 'besked') = 'teknik' then 'teknik' else 'besked' end,
        'unread_count', count(*),
        'latest_at', max(message.created_at)
      ) as payload
    from public.messages message
    join public.athletes athlete on athlete.id = message.athlete_id
    where athlete.coach_id = p_coach_id
      and coalesce(athlete.hidden, false) = false
      and message.sender_role = 'athlete'
      and coalesce(message.read_by_coach, false) = false
    group by athlete.id, athlete.name,
      case when coalesce(message.category, 'besked') = 'teknik' then 'teknik' else 'besked' end
  ) grouped;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', analysis.id,
        'athlete_id', athlete.id,
        'athlete_name', athlete.name,
        'lift', analysis.lift,
        'variation', analysis.variation,
        'load_kg', analysis.load_kg,
        'reps_count', analysis.reps_count,
        'created_at', analysis.created_at
      )
      order by analysis.created_at desc
    ),
    '[]'::jsonb
  )
  into v_video_drafts
  from public.video_analyses analysis
  join public.athletes athlete on athlete.id = analysis.athlete_id
  where athlete.coach_id = p_coach_id
    and coalesce(athlete.hidden, false) = false
    and analysis.status = 'draft';

  -- The shared signal engine is scoped through auth.uid(). Temporarily set the
  -- request subject to the requested coach, call the canonical engine, and then
  -- restore the original claim before returning.
  v_previous_sub := current_setting('request.jwt.claim.sub', true);
  v_previous_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claim.sub', p_coach_id::text, true);
  perform set_config(
    'request.jwt.claims',
    (
      coalesce(nullif(v_previous_claims, '')::jsonb, '{}'::jsonb)
      || jsonb_build_object('sub', p_coach_id, 'role', 'service_role')
    )::text,
    true
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'athlete_id', signal.o_athlete_id,
        'athlete_name', signal.o_athlete_name,
        'detector', signal.o_detector,
        'severity', signal.o_severity,
        'headline', signal.o_headline,
        'detail', signal.o_detail,
        'metrics', signal.o_metrics
      )
      order by
        case signal.o_severity when 'alert' then 0 else 1 end,
        signal.o_athlete_name,
        signal.o_detector
    ),
    '[]'::jsonb
  )
  into v_training_signals
  from public.entropi_training_signals_v1() signal
  where signal.o_severity in ('alert', 'context')
    and not exists (
      select 1
      from public.coach_signal_actions action
      where action.coach_id = p_coach_id
        and action.athlete_id = signal.o_athlete_id
        and action.detector = signal.o_detector
        and (
          action.snoozed_until > now()
          or (
            action.signal_fingerprint is not null
            and action.signal_fingerprint::jsonb = jsonb_build_object(
              'severity', signal.o_severity,
              'metrics', coalesce(signal.o_metrics, '{}'::jsonb)
            )
          )
        )
    );

  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);

  return jsonb_build_object(
    'schema_version', 1,
    'generated_at', now(),
    'coach_id', p_coach_id,
    'unread_messages', v_messages,
    'video_drafts', v_video_drafts,
    'training_signals', v_training_signals
  );
exception
  when others then
    perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
    perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
    raise;
end;
$$;

revoke all on function public.entropi_coach_briefing_v1(uuid) from public;
revoke all on function public.entropi_coach_briefing_v1(uuid) from anon;
revoke all on function public.entropi_coach_briefing_v1(uuid) from authenticated;
grant execute on function public.entropi_coach_briefing_v1(uuid) to service_role;

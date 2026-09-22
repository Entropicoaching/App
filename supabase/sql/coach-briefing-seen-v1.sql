-- ORDRE 325 · commit 1 — "Set" på et punkt under "Kræver dit blik", og
-- entropi_coach_briefing_v1 (supabase/sql/coach-briefing-v1.sql) lærer om det.
--
-- IKKE KØRT af denne ordre. Dhruva kører først efter Marcs ja (samme
-- rækkefølge som coach-signal-actions-v1.sql og resolve-automation-alert-v1.sql).
--
-- Baggrund (docs/RAPPORT-325.md, RAPPORT-317 i entropi-n8n): n8n's Coach
-- Briefing-mail sender nu kun når noget under "Kræver dit blik" har ventet
-- over 48 timer, men RPC'en har intet "set"-felt — den kan derfor ikke se om
-- Marc allerede har set punktet i appen, kun hvor gammelt det er. Denne fil
-- lukker hullet: en ny tabel gemmer coach_id + punkt-nøgle + tidspunkt, og
-- RPC'en udvides så hvert punkt (besked, video-udkast, træningssignal)
-- bærer `point_key` og `seen_at`.
--
-- Additiv migration: opretter kun en ny tabel + RLS, og erstatter RPC'ens
-- krop (create or replace — samme funktionssignatur, samme adgang). Ingen
-- eksisterende data ændres.

create table if not exists public.coach_briefing_seen (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  point_key text not null check (length(point_key) between 1 and 200),
  seen_at timestamptz not null default now(),
  primary key (coach_id, point_key)
);

comment on table public.coach_briefing_seen is
  'Coach-only "set"-markering pr. punkt under "Kræver dit blik" (besked/video/signal). Punkt-nøglen er stabil for samme forekomst og ændrer sig når der reelt er noget nyt (se src/coachBriefingSeen.js). Læses af entropi_coach_briefing_v1 til n8n''s Coach Briefing-mail.';

alter table public.coach_briefing_seen enable row level security;

revoke all on table public.coach_briefing_seen from anon;
grant select, insert, update, delete on table public.coach_briefing_seen to authenticated;

drop policy if exists entropi_coach_briefing_seen_owner
  on public.coach_briefing_seen;

create policy entropi_coach_briefing_seen_owner
on public.coach_briefing_seen
for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

-- entropi_coach_briefing_v1, udvidet med point_key + seen_at pr. punkt.
-- Uændret: adgang (kun service_role), signalmotor-genbruget (sub/claims-swap),
-- filtreringen der allerede holder kvitterede/udsatte signaler ude af listen
-- (public.coach_signal_actions) — den beholdes, ny seen_at er blot en ekstra,
-- eksplicit markering for de punkter der stadig når igennem.
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

  -- Punkt-nøglen for beskeder er atlet+spor+dato (UTC-dato af seneste
  -- ulæste besked), samme afledning som coachBriefingPointKey() i appen
  -- (src/coachBriefingSeen.js): stabil for samme forekomst, men ny hvis en
  -- ulæst besked ankommer en ny kalenderdag, så en gammel "Set" ikke dæmper
  -- ægte nyt indhold for evigt.
  select coalesce(jsonb_agg(grouped.payload order by grouped.latest_at desc), '[]'::jsonb)
  into v_messages
  from (
    select
      grouped_msg.latest_at,
      jsonb_build_object(
        'athlete_id', grouped_msg.athlete_id,
        'athlete_name', grouped_msg.athlete_name,
        'track', grouped_msg.track,
        'unread_count', grouped_msg.unread_count,
        'latest_at', grouped_msg.latest_at,
        'point_key', grouped_msg.point_key,
        'seen_at', seen.seen_at
      ) as payload
    from (
      select
        athlete.id as athlete_id,
        athlete.name as athlete_name,
        case when coalesce(message.category, 'besked') = 'teknik' then 'teknik' else 'besked' end as track,
        count(*) as unread_count,
        max(message.created_at) as latest_at,
        'message-' || athlete.id::text || '-' ||
          (case when coalesce(message.category, 'besked') = 'teknik' then 'teknik' else 'besked' end) || '-' ||
          to_char((max(message.created_at) at time zone 'utc'), 'YYYY-MM-DD') as point_key
      from public.messages message
      join public.athletes athlete on athlete.id = message.athlete_id
      where athlete.coach_id = p_coach_id
        and coalesce(athlete.hidden, false) = false
        and message.sender_role = 'athlete'
        and coalesce(message.read_by_coach, false) = false
      group by athlete.id, athlete.name,
        case when coalesce(message.category, 'besked') = 'teknik' then 'teknik' else 'besked' end
    ) grouped_msg
    left join public.coach_briefing_seen seen
      on seen.coach_id = p_coach_id and seen.point_key = grouped_msg.point_key
  ) grouped;

  -- Video-udkast har allerede en stabil, entydig identitet: analysens id.
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
        'created_at', analysis.created_at,
        'point_key', 'video-' || analysis.id::text,
        'seen_at', seen.seen_at
      )
      order by analysis.created_at desc
    ),
    '[]'::jsonb
  )
  into v_video_drafts
  from public.video_analyses analysis
  join public.athletes athlete on athlete.id = analysis.athlete_id
  left join public.coach_briefing_seen seen
    on seen.coach_id = p_coach_id and seen.point_key = 'video-' || analysis.id::text
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

  -- Træningssignaler er allerede filtreret mod coach_signal_actions (kvitteret
  -- eller udsat signal når slet ikke hertil), så seen_at vil i praksis oftest
  -- være null her — punkt_nøglen og opslaget mod coach_briefing_seen er kun med
  -- for samme ensartethed på tværs af de tre punkttyper.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'athlete_id', signal.o_athlete_id,
        'athlete_name', signal.o_athlete_name,
        'detector', signal.o_detector,
        'severity', signal.o_severity,
        'headline', signal.o_headline,
        'detail', signal.o_detail,
        'metrics', signal.o_metrics,
        'point_key', 'signal-' || signal.o_athlete_id::text || '-' || signal.o_detector,
        'seen_at', seen.seen_at
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
  left join public.coach_briefing_seen seen
    on seen.coach_id = p_coach_id
    and seen.point_key = 'signal-' || signal.o_athlete_id::text || '-' || signal.o_detector
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

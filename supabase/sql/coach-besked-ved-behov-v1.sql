-- Ordre 1611: ingen daglig coachmail; coachen faar kun besked ved skade, sygdom
-- eller naar appens egen regel siger, at det er tid til deload/deintensivering.
-- Marc 17. nov.: "MORGEN MAIL GIVER INGEN MENING, DET BLIVER BARE SPAM. taenker det
-- skal end hvis man er skadet syg, eller deload? men ikke noget appen skal vurdere
-- andet end se om det er tid til deload/DEINTENSIFICERING."
--
-- IKKE KOERT. Marc koerer filen i Supabase SQL editor (migration kraever Marc).
--
-- Hvordan: n8n-flowet "Coach Briefing v1" kalder entropi_coach_briefing_v1 hver
-- time 12-21 og mailer, naar svaret har noget. Den gamle funktion omdoebes (bevares
-- til tilbageruldning), og en ny med samme navn og samme kontrakt svarer nu kun med
-- tre slags haendelser som 'alert'-signaler; beskeder og videoer sendes ikke mere:
--   * syg:   atleten har trykket "Jeg er syg" (besked med fast tekst, se
--            src/entropi2/meld/meldModel.mjs)
--   * pain:  atleten har trykket "Jeg er skadet" (samme vej)
--   * deload: appens egen stilstandsregel staar paa 'alert' for et loeft
--            (entropi_training_signals_v1, detector 'stagnation')
-- Ingen forslag, ingen "overvej": overskriften siger kun, hvad der er sket.
-- Hoejst een mail pr. atlet pr. haendelse: hver haendelse faar en noegle i
-- coach_besked_haendelser_v1 og sendes kun de foerste 2 doegn; n8n holder samme
-- atlet og slags tilbage i 3 doegn, saa haendelsen naevnes een gang.
-- Et deload-signal, der har vaeret vaek i 7 dage og kommer igen, er en ny haendelse.
-- Ingen n8n-aendring er noedvendig. Tilbageruldning: coach-besked-ved-behov-v1_ROLLBACK.sql.

begin;

create table if not exists public.coach_besked_haendelser_v1 (
  noegle text primary key,
  athlete_id uuid not null,
  haendelse text not null check (haendelse in ('syg', 'skadet', 'deload')),
  foerst_set timestamptz not null default now(),
  sidst_set timestamptz not null default now()
);
alter table public.coach_besked_haendelser_v1 enable row level security;
revoke all on public.coach_besked_haendelser_v1 from public, anon, authenticated;

alter function public.entropi_coach_briefing_v1(uuid) rename to entropi_coach_briefing_v1_daglig;
revoke all on function public.entropi_coach_briefing_v1_daglig(uuid) from public, anon, authenticated, service_role;

create function public.entropi_coach_briefing_v1(p_coach_id uuid)
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
  v_signals jsonb := '[]'::jsonb;
  v_nu timestamptz := now();
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
    select 1 from public.profiles profile
    where profile.id = p_coach_id and profile.role = 'coach'
  ) then
    raise exception 'unknown coach';
  end if;

  -- Deload laeses af appens egen motor, som er afgraenset med auth.uid().
  v_previous_sub := current_setting('request.jwt.claim.sub', true);
  v_previous_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claim.sub', p_coach_id::text, true);
  perform set_config('request.jwt.claims', (
    coalesce(nullif(v_previous_claims, '')::jsonb, '{}'::jsonb)
    || jsonb_build_object('sub', p_coach_id, 'role', 'service_role'))::text, true);

  with nu as (
    -- Syg og skadet: atletens egen melding fra knapperne (de sidste 2 doegn).
    select 'besked:' || message.id::text as noegle, athlete.id as athlete_id, athlete.name as athlete_name,
      case message.content when 'Meldt til coach: syg' then 'syg' else 'skadet' end as haendelse,
      null::text as loeft
    from public.messages message
    join public.athletes athlete on athlete.id = message.athlete_id
    where athlete.coach_id = p_coach_id
      and coalesce(athlete.hidden, false) = false
      and message.sender_role = 'athlete'
      and message.content in ('Meldt til coach: syg', 'Meldt til coach: skadet')
      and message.created_at > v_nu - interval '2 days'
    union all
    -- Deload: appens egen stilstandsregel paa 'alert' (samme motor som coachens indbakke).
    select 'deload:' || signal.o_athlete_id::text || ':' || lower(coalesce(signal.o_metrics ->> 'lift', '')),
      signal.o_athlete_id, signal.o_athlete_name, 'deload', nullif(signal.o_metrics ->> 'lift', '')
    from public.entropi_training_signals_v1() signal
    where signal.o_detector = 'stagnation' and signal.o_severity = 'alert'
  ),
  -- Ny noegle, eller et deload der har vaeret vaek i 7 dage: ny haendelse fra nu.
  kendt as (
    insert into public.coach_besked_haendelser_v1 as tidligere (noegle, athlete_id, haendelse, foerst_set, sidst_set)
    select distinct on (nu.noegle) nu.noegle, nu.athlete_id, nu.haendelse, v_nu, v_nu from nu
    on conflict (noegle) do update set
      foerst_set = case when tidligere.sidst_set < v_nu - interval '7 days' then v_nu else tidligere.foerst_set end,
      sidst_set = v_nu
    returning noegle, foerst_set
  ),
  valgt as (
    select distinct on (nu.athlete_id, nu.haendelse) nu.*
    from nu join kendt on kendt.noegle = nu.noegle
    where kendt.foerst_set > v_nu - interval '2 days'
    order by nu.athlete_id, nu.haendelse, nu.loeft
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'athlete_id', valgt.athlete_id,
      'athlete_name', valgt.athlete_name,
      'detector', case valgt.haendelse when 'skadet' then 'pain' else valgt.haendelse end,
      'severity', 'alert',
      'headline', valgt.athlete_name || ': ' || case valgt.haendelse
        when 'syg' then 'Meldt syg'
        when 'skadet' then 'Meldt skadet'
        else 'Tid til deload/deintensivering' || coalesce(' (' || valgt.loeft || ')', '') end,
      'detail', null,
      'metrics', '{}'::jsonb
    ) order by valgt.athlete_name, valgt.haendelse), '[]'::jsonb)
  into v_signals
  from valgt;

  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);

  return jsonb_build_object(
    'schema_version', 1,
    'generated_at', v_nu,
    'coach_id', p_coach_id,
    'unread_messages', '[]'::jsonb,
    'video_drafts', '[]'::jsonb,
    'training_signals', v_signals
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

commit;

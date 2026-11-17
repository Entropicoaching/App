-- Ordre 1613: coachmailen slukkes helt. Ingen ny tabel, ingen haendelser.
-- Marc 17. nov. 18:44: "jeg tjekker ikke rigtig mail pt". 18:45: "i virkeligheden
-- er det her noget jeg droefter med ai assistenten via skill i claude chat ved
-- weekly check in".
--
-- IKKE KOERT. Marc koerer filen i Supabase SQL editor (migration kraever Marc).
--
-- Hvordan: n8n-flowet "Coach Briefing v1" kalder entropi_coach_briefing_v1 hver
-- time 12-21 og sender kun, naar en af de tre lister har noget ("Keep unresolved
-- backup items" returnerer intet i produktion, naar alt er tomt). Den gamle
-- funktion omdoebes til entropi_coach_briefing_v1_daglig og bevares til
-- tilbageruldning; en ny med samme navn og samme kontrakt svarer altid tomt.
-- Ingen n8n-aendring er noedvendig. Tilbageruldning: coach-mail-sluk-v1_ROLLBACK.sql.

begin;

alter function public.entropi_coach_briefing_v1(uuid) rename to entropi_coach_briefing_v1_daglig;
revoke all on function public.entropi_coach_briefing_v1_daglig(uuid) from public, anon, authenticated, service_role;

create function public.entropi_coach_briefing_v1(p_coach_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public
as $$
declare
  v_request_role text;
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

  -- Altid tomt: n8n sender ingen mail.
  return jsonb_build_object(
    'schema_version', 1,
    'generated_at', now(),
    'coach_id', p_coach_id,
    'unread_messages', '[]'::jsonb,
    'video_drafts', '[]'::jsonb,
    'training_signals', '[]'::jsonb
  );
end;
$$;

revoke all on function public.entropi_coach_briefing_v1(uuid) from public;
revoke all on function public.entropi_coach_briefing_v1(uuid) from anon;
revoke all on function public.entropi_coach_briefing_v1(uuid) from authenticated;
grant execute on function public.entropi_coach_briefing_v1(uuid) to service_role;

commit;

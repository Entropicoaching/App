-- Ordre 1613 tilbageruldning: den gamle daglige briefing tilbage, som foer
-- coach-mail-sluk-v1.sql. Koeres kun, hvis Marc vil have mailen igen.

begin;

drop function public.entropi_coach_briefing_v1(uuid);
alter function public.entropi_coach_briefing_v1_daglig(uuid) rename to entropi_coach_briefing_v1;
revoke all on function public.entropi_coach_briefing_v1(uuid) from public;
revoke all on function public.entropi_coach_briefing_v1(uuid) from anon;
revoke all on function public.entropi_coach_briefing_v1(uuid) from authenticated;
grant execute on function public.entropi_coach_briefing_v1(uuid) to service_role;

commit;

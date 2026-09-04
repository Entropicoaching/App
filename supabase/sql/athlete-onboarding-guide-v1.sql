-- ORDRE 38 — klik-guide ved atletens foerste login.
-- IKKE ANVENDT PAA PRODUKTION. Afventer Marcs eksplicitte godkendelse, foer
-- den koeres som Supabase-migration (se rapporten for ORDRE 38 for kontekst).

-- 1) Hvornaar (hvis nogensinde) atleten har gennemfoert eller sprunget guiden
--    over. Server-side, saa tilstanden foelger brugeren paa tvaers af enheder
--    i stedet for kun den enhed hvor guiden foerst blev vist.
alter table public.athletes
  add column if not exists onboarding_completed_at timestamptz;

-- 2) RPC'en atleten selv kalder for at markere guiden som gennemfoert/sprunget
--    over. SECURITY DEFINER + auth.uid()-scoping i stedet for en aaben UPDATE-
--    policy paa athletes, saa vi ikke aabner andre kolonner for atlet-
--    skrivning (samme moenster som athlete_seen_at i
--    message-tracks-and-athlete-seen.sql). Idempotent: et gentaget kald (fx
--    spring-over efter allerede gennemfoert) aendrer intet.
create or replace function public.complete_athlete_onboarding_v1()
returns timestamptz
language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_completed_at timestamptz;
begin
  update public.athletes
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where user_id = auth.uid()
  returning onboarding_completed_at into v_completed_at;
  return v_completed_at;
end $$;
revoke execute on function public.complete_athlete_onboarding_v1() from public;
revoke execute on function public.complete_athlete_onboarding_v1() from anon;
grant execute on function public.complete_athlete_onboarding_v1() to authenticated;

-- ORDRE 301: "Markeret som set" for automatiseringsfejl i Indbakken.
-- Additiv: opretter kun en funktion. Ingen tabel, kolonne eller RLS-policy
-- aendres; public.automation_alerts findes allerede (n8n's Error Monitor
-- skriver metadata-raekker dertil, authenticated kan laese).
--
-- Funktionen saetter resolved_at = now() paa een uloest raekke. Den er
-- SECURITY DEFINER, fordi tabellen ikke giver authenticated skriverettighed;
-- til gengaeld kraever den at kalderen er coach (profiles.role = 'coach'),
-- saa en atlet ikke kan kvittere en fejl. Returnerer true hvis raekken blev
-- markeret nu, false hvis den ikke findes eller allerede var loest.
--
-- Skal ikke koeres uden Marcs ja (Dhruva koerer den). Appen fejler synligt og
-- pænt indtil funktionen findes.

begin;

create or replace function public.resolve_automation_alert_v1(alert_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resolved integer;
begin
  if auth.uid() is null then
    raise exception 'resolve_automation_alert_v1 requires an authenticated user';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'coach'
  ) then
    raise exception 'resolve_automation_alert_v1 requires a coach';
  end if;

  update public.automation_alerts alert
  set resolved_at = now()
  where alert.id = resolve_automation_alert_v1.alert_id
    and alert.resolved_at is null;

  get diagnostics v_resolved = row_count;
  return v_resolved > 0;
end
$$;

revoke execute on function public.resolve_automation_alert_v1(uuid) from public;
revoke execute on function public.resolve_automation_alert_v1(uuid) from anon;
grant execute on function public.resolve_automation_alert_v1(uuid) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.resolve_automation_alert_v1(uuid)', 'execute') then
    raise exception 'resolve_automation_alert_v1 is executable by anon';
  end if;

  if not has_function_privilege('authenticated', 'public.resolve_automation_alert_v1(uuid)', 'execute') then
    raise exception 'resolve_automation_alert_v1 is not executable by authenticated';
  end if;
end
$$;

commit;

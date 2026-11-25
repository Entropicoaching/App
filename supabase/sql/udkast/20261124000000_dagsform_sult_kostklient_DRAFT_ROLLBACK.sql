-- TILBAGERULNING ordre 2145, rettet i ordre 2172 (Marc 3. nov.: "ingen sletning").
-- Fjerner kun sult-kolonnen, og kun når ingen række har gemt sult. Findes der sult, stopper filen, og intet ændres.
-- Kolonnernes null-tilladelse gendannes ikke automatisk:
-- sæt not null igen først, når ingen række har tom motivation, stress eller soreness_level (kort Dagsform gemmer dem tomme).
begin;
do $$
declare
  har_sult boolean := false;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'readiness_logs' and column_name = 'hunger') then
    execute 'select exists (select 1 from public.readiness_logs where hunger is not null)' into har_sult;
  end if;
  if har_sult then
    raise exception 'readiness_logs.hunger har gemt sult; tilbagerulning stoppet, intet slettet';
  end if;
end $$;
alter table public.readiness_logs drop column if exists hunger;
-- Kun hvis ingen kort Dagsform er gemt:
-- alter table public.readiness_logs alter column motivation set not null;
-- alter table public.readiness_logs alter column stress set not null;
-- alter table public.readiness_logs alter column soreness_level set not null;
commit;

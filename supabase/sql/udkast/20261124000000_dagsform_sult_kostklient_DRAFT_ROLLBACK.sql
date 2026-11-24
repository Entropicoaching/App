-- TILBAGERULNING ordre 2145. Fjerner kun sult-kolonnen. Kolonnernes null-tilladelse gendannes ikke automatisk:
-- sæt not null igen først, når ingen række har tom motivation, stress eller soreness_level (kort Dagsform gemmer dem tomme).
begin;
alter table public.readiness_logs drop column if exists hunger;
-- Kun hvis ingen kort Dagsform er gemt:
-- alter table public.readiness_logs alter column motivation set not null;
-- alter table public.readiness_logs alter column stress set not null;
-- alter table public.readiness_logs alter column soreness_level set not null;
commit;

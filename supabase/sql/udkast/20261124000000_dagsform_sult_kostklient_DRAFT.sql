-- UDKAST ordre 2145 (Marc 24. nov.: kort Dagsform for kostklient: søvn, energi, sult og vægt). Køres kun efter Marcs ja.
-- Ligger i supabase/sql/udkast/, ikke i supabase/migrations/, så den deployes aldrig af sig selv. Ingen migration er kørt.
-- Appen gemmer i dag kun søvn og energi (readiness_logs.sleep_hours og energy). Sult findes ikke som kolonne.
-- 1) hunger: sult 1 (sulten hele dagen) til 5 (mæt og rolig), valgfri.
-- 2) motivation, stress og soreness_level må være tomme, så en kort Dagsform uden træningsspørgsmål kan gemmes uden opdigtede svar.
--    Tjek først i produktion, om kolonnerne allerede er tilladt som null (drop not null er uskadeligt, hvis de er).
-- RLS: readiness_logs har allerede rækkeregler for atleten (egne rækker) og coachen (egne atleter). Udkastet ændrer ingen policy,
-- slår RLS til (uskadeligt, hvis det allerede er det) og stopper, hvis tabellen mangler policies.
-- Tilbagerulning: 20261124000000_dagsform_sult_kostklient_DRAFT_ROLLBACK.sql
begin;

alter table public.readiness_logs enable row level security;

alter table public.readiness_logs
  add column if not exists hunger smallint check (hunger is null or hunger between 1 and 5);
alter table public.readiness_logs alter column motivation drop not null;
alter table public.readiness_logs alter column stress drop not null;
alter table public.readiness_logs alter column soreness_level drop not null;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'readiness_logs') then
    raise exception 'readiness_logs har ingen policies; stop, RLS skal gennemgås først';
  end if;
end $$;

commit;

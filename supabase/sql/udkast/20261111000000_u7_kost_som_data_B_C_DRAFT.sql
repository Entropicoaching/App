-- UDKAST U7 (ordre 76, rettet i ordre 80): migrationspakke B og C. Køres kun efter Marcs ja.
-- Ligger i supabase/sql/udkast/, ikke i supabase/migrations/, så den deployes aldrig af sig selv.
-- Pakke A (kostplanen) er IKKE med: den kørte live 8. nov. 2026 som migration 20261108122354
-- (kostplan_v1_identity_and_plans_20261107). Den gamle A_C-fil stoppede derfor på sin første
-- linje i produktionen ("function kostplan_v1_valid_meals already exists"), og dens
-- tilbagerulning ville have slettet de rigtige kostplaner. Generalprøven (ordre 80) fandt det.
-- Forudsætninger: public.athletes(id, user_id, coach_id) er uuid, auth.uid(), rollerne
-- authenticated og anon. Ejeren af migrationen ejer de nye objekter og kan læse athletes.
-- Ingen eksisterende tabel, policy, grant eller række ændres. athletes.kcal_target og
-- protein_target LÆSES kun, til de første daterede mål (C).
-- Ingen menstruationstabeller (tracking_cycle_*) tages med.
-- Tilbagerulning: 20261111000000_u7_kost_som_data_B_C_DRAFT_ROLLBACK.sql (C, B; ingen cascade).
-- Prøvet mod PGlite i src/entropi2/u7/u7Migration.sql.test.mjs og mod produktionens skema i
-- src/entropi2/generalproeve/generalproeve.sql.test.mjs.
begin;

-- ===== B. Dagsdata =====
-- Som tracking_daily_v1 i 20261103210000_tracking_v1_DRAFT.sql, med to ændringer:
-- 1) nye kolonner water_ml og kost_done_at (vand og "færdig for i dag" bliver data);
-- 2) smerte kan gemmes uden sted (0 til 10 er nok), og en række må bære kun vand eller kun
--    "færdig". Et sted kræver stadig smerte over 0.
-- Udkastets identitetsvagt på athletes tages ikke med: pakken ændrer ingen eksisterende tabel,
-- og de nye policies stoler på athletes.user_id præcis som readiness_logs gør i dag.
-- Atleten skriver egne rækker; atlet og coach læser. athlete_id og logged_date kan ikke
-- flyttes med UPDATE (kun kolonnerettigheder på dataenes kolonner).
create table public.tracking_daily_v1 (
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  logged_date date not null check (isfinite(logged_date)),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  pain smallint check (pain between 0 and 10),
  pain_location text check (pain_location is null or
    (length(pain_location) between 1 and 120 and length(btrim(pain_location)) > 0)),
  water_ml integer check (water_ml between 0 and 50000),
  kost_done_at timestamptz check (kost_done_at is null or isfinite(kost_done_at)),
  source text not null default 'athlete_manual' check (source = 'athlete_manual'),
  primary key (athlete_id, logged_date),
  constraint tracking_daily_v1_location_needs_pain check (pain_location is null or pain > 0)
);

alter table public.tracking_daily_v1 enable row level security;
alter table public.tracking_daily_v1 force row level security;
revoke all on table public.tracking_daily_v1 from public, anon, authenticated;
grant select, delete on table public.tracking_daily_v1 to authenticated;
grant insert (athlete_id, logged_date, sleep_quality, pain, pain_location, water_ml, kost_done_at)
  on public.tracking_daily_v1 to authenticated;
grant update (sleep_quality, pain, pain_location, water_ml, kost_done_at)
  on public.tracking_daily_v1 to authenticated;

create policy tracking_daily_v1_read on public.tracking_daily_v1 for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id
    and (a.user_id = (select auth.uid()) or a.coach_id = (select auth.uid()))));
create policy tracking_daily_v1_insert on public.tracking_daily_v1 for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id
    and a.user_id = (select auth.uid())));
create policy tracking_daily_v1_update on public.tracking_daily_v1 for update to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id
    and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id
    and a.user_id = (select auth.uid())));
create policy tracking_daily_v1_delete on public.tracking_daily_v1 for delete to authenticated
  using (exists (select 1 from public.athletes a where a.id = tracking_daily_v1.athlete_id
    and a.user_id = (select auth.uid())));

-- ===== C. Daterede kostmål =====
-- Kun nye rækker; ingen UPDATE eller DELETE. Det mål, der gjaldt en dag, er for hvert felt den
-- seneste række (effective_from, created_at) med effective_from <= dagen og feltet udfyldt.
-- Nøglen er id, ikke (athlete_id, effective_from): en rettelse samme dag er en ny række.
-- Coach skriver kcal, protein og vand. Atleten må kun skrive sit eget væskemål (som i dag på
-- telefonen). Ingen kan skrive bagud i tiden; set_by er altid den, der skriver.
create table public.nutrition_targets_v1 (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  effective_from date not null check (isfinite(effective_from)),
  kcal integer check (kcal between 1 and 20000),
  protein_g integer check (protein_g between 1 and 1000),
  water_ml integer check (water_ml between 500 and 8000),
  set_by uuid not null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  constraint nutrition_targets_v1_not_empty check (num_nonnulls(kcal, protein_g, water_ml) > 0)
);
create index nutrition_targets_v1_athlete on public.nutrition_targets_v1 (athlete_id, effective_from, created_at);

alter table public.nutrition_targets_v1 enable row level security;
alter table public.nutrition_targets_v1 force row level security;
revoke all on table public.nutrition_targets_v1 from public, anon, authenticated;
grant select on table public.nutrition_targets_v1 to authenticated;
grant insert (athlete_id, effective_from, kcal, protein_g, water_ml)
  on public.nutrition_targets_v1 to authenticated;

create policy nutrition_targets_v1_read on public.nutrition_targets_v1 for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = nutrition_targets_v1.athlete_id
    and (a.user_id = (select auth.uid()) or a.coach_id = (select auth.uid()))));
create policy nutrition_targets_v1_insert on public.nutrition_targets_v1 for insert to authenticated
  with check (set_by = (select auth.uid())
    and effective_from >= (clock_timestamp() at time zone 'Europe/Copenhagen')::date - 1
    and effective_from <= (clock_timestamp() at time zone 'Europe/Copenhagen')::date + 366
    and exists (select 1 from public.athletes a where a.id = nutrition_targets_v1.athlete_id
      and (a.coach_id = (select auth.uid())
        or (a.user_id = (select auth.uid()) and nutrition_targets_v1.kcal is null
          and nutrition_targets_v1.protein_g is null))));

-- Første daterede mål: athletes' nuværende kcal_target/protein_target gælder fra i dag.
-- Tidligere uger har intet dateret mål, så coachen ser intet sammenligningstal for dem.
-- Værdierne læses som tekst, så kolonnetypen (heltal, numeric eller tekst) ikke betyder noget;
-- alt uden for grænserne springes over i stedet for at standse migrationen.
insert into public.nutrition_targets_v1 (athlete_id, effective_from, kcal, protein_g, set_by)
select t.id, (clock_timestamp() at time zone 'Europe/Copenhagen')::date, t.kcal, t.protein_g, t.coach_id
from (
  select a.id, a.coach_id,
    case when a.kcal_target::text ~ '^[0-9]{1,5}([.][0-9]+)?$'
      and round(a.kcal_target::text::numeric) between 1 and 20000
      then round(a.kcal_target::text::numeric)::integer end as kcal,
    case when a.protein_target::text ~ '^[0-9]{1,4}([.][0-9]+)?$'
      and round(a.protein_target::text::numeric) between 1 and 1000
      then round(a.protein_target::text::numeric)::integer end as protein_g
  from public.athletes a
  where a.coach_id is not null
) t
where t.kcal is not null or t.protein_g is not null;

commit;

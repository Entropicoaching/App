-- IKKE KOERT. Rollback for
-- supabase/migrations/20260926120000_exercise_logs_et_saet_en_raekke.sql
-- (ORDRE 414). Ligger uden for migrations/, saa den ikke koeres som migration.
-- NB: selve migrationsfilen blev IKKE lagt paa grenen dagens-pas-offline-4
-- (skrivning i supabase/migrations/ blev afvist af Claude Codes
-- tilladelsessystem, se docs/RAPPORT-414.md). Denne fil haenger sammen med
-- den, naar den laegges.
--
-- Fjerner det unikke indeks igen (ogsaa et ugyldigt indeks efter et fejlet
-- "create index concurrently"). Koeres ALENE i SQL-editoren: "drop index
-- concurrently" kan ikke koere i en transaktion. Rører ingen raekker; en
-- oprydning i trin 2 kan ikke rulles tilbage herfra (de slettede dubletter er
-- vaek). Appen virker uaendret uden indekset (opslag foer INSERT, ordre 406).

drop index concurrently if exists public.exercise_logs_et_saet_en_raekke;

-- Tjek (ren laesning): skal give nul raekker.
select c.relname
from pg_class c
where c.relname = 'exercise_logs_et_saet_en_raekke';

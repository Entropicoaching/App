-- UDKAST U7 (ordre 76, rettet i ordre 80): tilbagerulning af 20261111000000_u7_kost_som_data_B_C_DRAFT.sql.
-- Omvendt rækkefølge C, B i én transaktion. Ingen cascade: en uventet afhængighed standser
-- det hele, og intet er rullet tilbage. ALLE data i de nye tabeller går tabt (daterede mål,
-- søvn, smerte, vand og "færdig for i dag"). Appen falder tilbage til telefonens localStorage
-- og viser det samme som U6. Kostplanen (live siden 8. nov.) og dens planer røres aldrig.
begin;

-- ===== C. Daterede kostmål =====
drop policy nutrition_targets_v1_insert on public.nutrition_targets_v1;
drop policy nutrition_targets_v1_read on public.nutrition_targets_v1;
drop table public.nutrition_targets_v1;

-- ===== B. Dagsdata =====
drop policy tracking_daily_v1_delete on public.tracking_daily_v1;
drop policy tracking_daily_v1_update on public.tracking_daily_v1;
drop policy tracking_daily_v1_insert on public.tracking_daily_v1;
drop policy tracking_daily_v1_read on public.tracking_daily_v1;
drop table public.tracking_daily_v1;

commit;

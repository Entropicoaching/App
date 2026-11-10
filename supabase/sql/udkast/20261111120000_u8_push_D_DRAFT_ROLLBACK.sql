-- UDKAST U8 (ordre 78): tilbagerulning af 20261111120000_u8_push_D_DRAFT.sql.
-- Omvendt rækkefølge D3, D2, D1 i én transaktion. Ingen cascade: en uventet afhængighed standser
-- det hele, og intet er rullet tilbage. ALLE push-adresser, tidspunkter og afsendelseslog går tabt.
-- Appen viser derefter det samme som U7 (push-kortet skjules), og edge-funktionen sender intet.
-- Eksisterende tabeller røres ikke.
begin;

-- ===== D3. Afsendelseslog =====
drop table public.push_log_v1;

-- ===== D2. Påmindelsestidspunkt =====
drop policy push_preferences_v1_delete on public.push_preferences_v1;
drop policy push_preferences_v1_update on public.push_preferences_v1;
drop policy push_preferences_v1_insert on public.push_preferences_v1;
drop policy push_preferences_v1_read on public.push_preferences_v1;
drop table public.push_preferences_v1;

-- ===== D1. Push-adresser =====
drop policy push_subscriptions_v1_delete on public.push_subscriptions_v1;
drop policy push_subscriptions_v1_update on public.push_subscriptions_v1;
drop policy push_subscriptions_v1_insert on public.push_subscriptions_v1;
drop policy push_subscriptions_v1_read on public.push_subscriptions_v1;
drop table public.push_subscriptions_v1;

commit;

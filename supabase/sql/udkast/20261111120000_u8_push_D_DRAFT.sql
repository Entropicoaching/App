-- UDKAST U8 (ordre 78): migrationspakke D, push. Køres kun efter Marcs ja.
-- Ligger i supabase/sql/udkast/, ikke i supabase/migrations/, så den deployes aldrig af sig selv.
-- Forudsætninger: auth.uid(), auth.users og rollerne authenticated, anon og service_role (Supabase-standard).
-- Slettes en bruger i auth.users, forsvinder brugerens rækker her også (on delete cascade).
-- Ingen eksisterende tabel, policy, grant eller række ændres eller læses.
-- Tre nye tabeller:
--   push_subscriptions_v1  telefonens push-adresse (endpoint og to offentlige nøgler fra browseren).
--   push_preferences_v1    atletens påmindelsestidspunkt og til/fra for påmindelse og coachsvar.
--   push_log_v1            hvad edge-funktionen u8-push har sendt; sikrer én påmindelse pr. dag og
--                          én besked pr. coachsvar. Kun service_role (edge-funktionen) kan se den.
-- RLS: en bruger ser, opretter, retter og sletter kun sine egne rækker. Coachen ser ingenting.
-- Tilbagerulning: 20261111120000_u8_push_D_DRAFT_ROLLBACK.sql (ingen cascade).
-- Prøvet mod PGlite i src/entropi2/u8/u8Migration.sql.test.mjs.
begin;

-- ===== D1. Push-adresser =====
-- user_id sættes af databasen (auth.uid()) og kan ikke sendes med fra appen.
-- Samme telefon kan have to brugere (fx coachens egen træning og en atlet); derfor er nøglen
-- (user_id, endpoint), og edge-funktionen sender kun til den nyeste række pr. endpoint.
create table public.push_subscriptions_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://[^[:space:]]+$' and length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}={0,2}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{21,24}={0,2}$'),
  user_agent text check (length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions_v1 enable row level security;
alter table public.push_subscriptions_v1 force row level security;
revoke all on table public.push_subscriptions_v1 from public, anon, authenticated;
grant select, delete on table public.push_subscriptions_v1 to authenticated;
grant select, insert, update, delete on table public.push_subscriptions_v1 to service_role;
grant insert (endpoint, p256dh, auth, user_agent) on public.push_subscriptions_v1 to authenticated;
grant update (endpoint, p256dh, auth, user_agent) on public.push_subscriptions_v1 to authenticated;
create policy push_subscriptions_v1_read on public.push_subscriptions_v1 for select to authenticated
  using (user_id = auth.uid());
create policy push_subscriptions_v1_insert on public.push_subscriptions_v1 for insert to authenticated
  with check (user_id = auth.uid());
create policy push_subscriptions_v1_update on public.push_subscriptions_v1 for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_v1_delete on public.push_subscriptions_v1 for delete to authenticated
  using (user_id = auth.uid());

-- ===== D2. Påmindelsestidspunkt =====
-- Ét tidspunkt pr. bruger i dansk tid, hvert kvarter mellem 06:00 og 22:00.
create table public.push_preferences_v1 (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  remind_at time not null default '19:00',
  reminders_on boolean not null default true,
  replies_on boolean not null default true,
  created_at timestamptz not null default now(),
  constraint push_preferences_v1_remind_at check (remind_at between '06:00' and '22:00'
    and extract(minute from remind_at)::int % 15 = 0 and extract(second from remind_at) = 0)
);
alter table public.push_preferences_v1 enable row level security;
alter table public.push_preferences_v1 force row level security;
revoke all on table public.push_preferences_v1 from public, anon, authenticated;
grant select, delete on table public.push_preferences_v1 to authenticated;
grant select, insert, update, delete on table public.push_preferences_v1 to service_role;
grant insert (remind_at, reminders_on, replies_on) on public.push_preferences_v1 to authenticated;
grant update (remind_at, reminders_on, replies_on) on public.push_preferences_v1 to authenticated;
create policy push_preferences_v1_read on public.push_preferences_v1 for select to authenticated
  using (user_id = auth.uid());
create policy push_preferences_v1_insert on public.push_preferences_v1 for insert to authenticated
  with check (user_id = auth.uid());
create policy push_preferences_v1_update on public.push_preferences_v1 for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_preferences_v1_delete on public.push_preferences_v1 for delete to authenticated
  using (user_id = auth.uid());

-- ===== D3. Afsendelseslog =====
-- Kun edge-funktionen (service_role). Rækken skrives FØR afsendelsen; den unikke nøgle gør, at
-- to samtidige kørsler aldrig sender den samme påmindelse eller det samme svar to gange. Nåede
-- beskeden ingen telefon på grund af en fejl, sletter funktionen rækken igen, så næste kørsel prøver.
create table public.push_log_v1 (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'reply')),
  ref text not null check (length(ref) between 1 and 100),
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
alter table public.push_log_v1 enable row level security;
alter table public.push_log_v1 force row level security;
revoke all on table public.push_log_v1 from public, anon, authenticated;
grant select, insert, delete on table public.push_log_v1 to service_role;

commit;

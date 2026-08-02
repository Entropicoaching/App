-- SHADOW PROJECT TEST FIXTURE ONLY. Never run against production.
-- The new shadow project is intentionally empty. These minimal objects recreate
-- only the subscription migration's existing-product dependencies, including
-- the known profiles.role weakness that the subscription slice must ignore.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'athlete'
);
alter table public.profiles enable row level security;
create policy profiles_own on public.profiles
for all to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade
);
alter table public.athletes enable row level security;
create policy shadow_athletes_read_own on public.athletes
for select to authenticated
using (user_id = (select auth.uid()));

-- Fixture-only baseline after this file: 2 policies, 0 SECURITY DEFINER
-- functions. The subscription migration adds 10 policies and 6 SECURITY
-- DEFINER functions, then must add no advisor issues.

-- Entropi subscription shadow migration 02: member preferences.
-- DRAFT ONLY. Do not run against production. Validate in maxhsefxbrvsgolscqwh first.
-- This table contains preferences only; it must never be used for entitlement
-- or coaching authorization.

create table public.sub_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  -- The shadow pilot deliberately has only two levels. A third value would
  -- make it possible to persist a preference that has no catalogue track.
  level text check (level in ('begynder', 'oevet')),
  days_per_week integer check (days_per_week between 2 and 4),
  -- Full gym is the only reviewed v1 environment.
  equipment text check (equipment = 'gym'),
  check (days_per_week in (2, 3) or (days_per_week = 4 and level = 'oevet')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sub_members enable row level security;
revoke all on table public.sub_members from anon;

create policy entropi_sub_members_read_own
on public.sub_members for select to authenticated
using (user_id = (select auth.uid()));

create policy entropi_sub_members_insert_own
on public.sub_members for insert to authenticated
with check (user_id = (select auth.uid()));

create policy entropi_sub_members_update_own
on public.sub_members for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- SECURITY INVOKER: the caller's RLS policy still governs the update.
create function public.sub_members_set_updated_at()
returns trigger language plpgsql
set search_path to pg_catalog, public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.sub_members_set_updated_at() from public, anon, authenticated;

create trigger entropi_sub_members_set_updated_at
before update on public.sub_members
for each row execute function public.sub_members_set_updated_at();

-- Shadow verification:
-- 1. User A can insert and update only a row with user_id = auth.uid().
-- 2. User B cannot select or update User A's row.
-- 3. User A cannot delete its row (no DELETE policy).
-- 4. Updating any field refreshes updated_at; it does not affect sub_entitlements.

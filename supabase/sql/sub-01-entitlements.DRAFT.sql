-- Entropi subscription shadow migration 01: entitlements and access lookup.
-- DRAFT ONLY. Do not run against production. Validate in maxhsefxbrvsgolscqwh first.

create table public.sub_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'member')),
  source text not null default 'manual'
    check (source in ('manual', 'trial', 'stripe', 'pilot_invite')),
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sub_entitlements enable row level security;
revoke all on table public.sub_entitlements from anon;

create policy entropi_sub_entitlements_read_own
on public.sub_entitlements for select to authenticated
using (user_id = (select auth.uid()));

-- Internal helper. It has no client execute grant: callers must not be able to
-- query a different user's entitlement.
create function public.sub_effective_tier(target_user_id uuid)
returns text language sql stable security definer
set search_path to pg_catalog, public as $$
  select coalesce(
    (select e.tier from public.sub_entitlements e
      where e.user_id = target_user_id
        and (e.valid_until is null or e.valid_until > now())),
    'free'
  )
$$;
revoke execute on function public.sub_effective_tier(uuid) from public, anon, authenticated;

create function public.sub_current_tier()
returns text language sql stable security definer
set search_path to pg_catalog, public as $$
  select public.sub_effective_tier(auth.uid())
$$;
revoke execute on function public.sub_current_tier() from public, anon;
grant execute on function public.sub_current_tier() to authenticated;

create function public.sub_my_access_v1()
returns table(tier text, has_coaching boolean)
language sql stable security definer
set search_path to pg_catalog, public as $$
  select
    public.sub_current_tier(),
    exists (select 1 from public.athletes a where a.user_id = auth.uid())
$$;
revoke execute on function public.sub_my_access_v1() from public, anon;
grant execute on function public.sub_my_access_v1() to authenticated;

-- Shadow verification:
-- 1. New authenticated user: select * from sub_my_access_v1() => free, false.
-- 2. Authenticated insert/update/delete on sub_entitlements => denied.
-- 3. select public.sub_effective_tier('<another-user-id>') as authenticated => denied.
-- 4. service_role inserts a member entitlement with valid_until; then
--    sub_effective_tier(target_user_id) => member when called by a trigger.

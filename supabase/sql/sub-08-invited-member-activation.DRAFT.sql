-- Entropi subscription shadow migration 08: invited member activation.
-- DRAFT ONLY. Do not run against production or use this file to create users,
-- send invitations, confirm email addresses or activate Auth providers.
-- Run only after sub-01 through sub-07 have passed in the isolated shadow.

begin;

create table public.sub_pilot_member_activations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  entitlement_valid_until timestamptz not null,
  auth_invited_at timestamptz not null,
  auth_login_at timestamptz not null,
  activated_at timestamptz not null default now(),
  check (entitlement_valid_until > activated_at),
  check (auth_login_at >= auth_invited_at)
);

alter table public.sub_pilot_member_activations enable row level security;
revoke all on table public.sub_pilot_member_activations from public, anon, authenticated;

-- Explicit deny-read policy keeps the service-only table fail-closed while
-- avoiding an RLS-enabled-with-no-policy advisor finding.
create policy entropi_sub_pilot_member_activations_deny_client_read
on public.sub_pilot_member_activations for select to authenticated
using (false);

-- Service-only activation after an external Auth invitation has been accepted
-- and the invited account has actually logged in. The provided email is used
-- only for an exact normalized comparison and is not stored in public tables.
create function public.sub_controlled_activate_invited_member(
  p_request_id uuid,
  p_target_user_id uuid,
  p_invited_email text,
  p_valid_until timestamptz
)
returns table(activation_id uuid, tier text, valid_until timestamptz)
language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_activation public.sub_pilot_member_activations%rowtype;
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_invited_at timestamptz;
  v_last_sign_in_at timestamptz;
begin
  if p_request_id is null or p_target_user_id is null
     or nullif(lower(trim(p_invited_email)), '') is null
     or p_valid_until is null or p_valid_until <= now() then
    raise exception 'Ufuldstændig eller udløbet pilotaktivering';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));

  select * into v_activation
  from public.sub_pilot_member_activations a
  where a.request_id = p_request_id;

  if found then
    if v_activation.user_id is distinct from p_target_user_id
       or v_activation.entitlement_valid_until is distinct from p_valid_until then
      raise exception 'Request-id er allerede brugt med andre aktiveringsdata';
    end if;
    return query
      select v_activation.id, 'member'::text,
             v_activation.entitlement_valid_until;
    return;
  end if;

  select u.email, u.email_confirmed_at, u.invited_at, u.last_sign_in_at
  into v_auth_email, v_email_confirmed_at, v_invited_at, v_last_sign_in_at
  from auth.users u
  where u.id = p_target_user_id;

  if not found then
    raise exception 'Auth-brugeren findes ikke';
  end if;
  if v_invited_at is null then
    raise exception 'Auth-brugeren er ikke oprettet via invitation';
  end if;
  if v_email_confirmed_at is null then
    raise exception 'Invitationens e-mail er ikke bekræftet';
  end if;
  if v_last_sign_in_at is null or v_last_sign_in_at < v_invited_at then
    raise exception 'Den inviterede bruger har ikke gennemført login';
  end if;
  if lower(trim(v_auth_email)) is distinct from lower(trim(p_invited_email)) then
    raise exception 'Invitationens e-mail matcher ikke Auth-brugeren';
  end if;

  perform 1 from public.sub_entitlements e where e.user_id = p_target_user_id;

  if found then
    raise exception 'Et eksisterende entitlement må ikke overskrives af pilotaktivering';
  end if;

  insert into public.sub_entitlements (
    user_id, tier, source, valid_until, updated_at
  ) values (
    p_target_user_id, 'member', 'pilot_invite', p_valid_until, now()
  )
  on conflict (user_id) do update
  set tier = excluded.tier,
      source = excluded.source,
      valid_until = excluded.valid_until,
      updated_at = now();

  insert into public.sub_pilot_member_activations (
    request_id, user_id, entitlement_valid_until, auth_invited_at, auth_login_at
  ) values (
    p_request_id, p_target_user_id, p_valid_until, v_invited_at, v_last_sign_in_at
  ) returning * into v_activation;

  return query
    select v_activation.id, 'member'::text,
           v_activation.entitlement_valid_until;
end;
$$;

revoke execute on function public.sub_controlled_activate_invited_member(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.sub_controlled_activate_invited_member(uuid, uuid, text, timestamptz)
to service_role;

commit;

-- Shadow verification:
-- 1. A normal/admin-created Auth user, an unconfirmed invitation and an invited
--    user who has not logged in are all rejected without an entitlement row.
-- 2. A matching invited + confirmed + logged-in Auth user receives one
--    time-bounded member entitlement with source = pilot_invite.
-- 3. Repeating the exact request_id returns the same activation. Reusing it
--    with another user or expiry fails closed.
-- 4. An existing entitlement from any source is never overwritten. Renewal or
--    replacement is a separate, reviewed operation.
-- 5. anon/authenticated cannot read the activation audit or execute the RPC.

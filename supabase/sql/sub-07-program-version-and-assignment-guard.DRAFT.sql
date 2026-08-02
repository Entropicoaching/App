-- Entropi subscription shadow migration 07: immutable program versions and
-- controlled assignment. DRAFT ONLY. Do not run against production.
--
-- Run only after sub-01 through sub-06 have passed in the shadow project.
-- This supersedes the temporary owner INSERT/UPDATE policies from sub-04: a
-- subscriber may read own assignments but never create, replace or end one.

begin;

drop policy if exists entropi_sub_assignments_insert_own on public.sub_assignments;
drop policy if exists entropi_sub_assignments_end_own on public.sub_assignments;

alter table public.sub_assignments
  add column if not exists request_id uuid,
  add column if not exists assignment_source text;

create unique index if not exists sub_assignments_request_id_unique
on public.sub_assignments(request_id)
where request_id is not null;

-- RLS is not the privilege boundary for TRUNCATE and service_role bypasses
-- RLS. Keep every client mutation privilege explicit at the final boundary.
revoke insert, update, delete, truncate, references, trigger
on table public.sub_entitlements, public.sub_programs, public.sub_assignments
from anon, authenticated;
grant select on table public.sub_entitlements, public.sub_programs, public.sub_assignments
to authenticated;

create or replace function public.sub_enforce_program_version_immutability()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    if old.published_at is not null or old.status in ('published', 'retired') then
      raise exception 'En publiceret programversion kan ikke slettes';
    end if;
    return old;
  end if;

  if old.published_at is not null or old.status in ('published', 'retired') then
    if old.slug is distinct from new.slug
       or old.version is distinct from new.version
       or old.name is distinct from new.name
       or old.tagline is distinct from new.tagline
       or old.summary is distinct from new.summary
       or old.progression_rule is distinct from new.progression_rule
       or old.days is distinct from new.days
       or old.min_equipment is distinct from new.min_equipment
       or old.levels is distinct from new.levels
       or old.min_tier is distinct from new.min_tier
       or old.content is distinct from new.content
       or old.published_at is distinct from new.published_at then
      raise exception 'En publiceret programversion er uforanderlig';
    end if;
    if old.status = 'retired' and new.status <> 'retired' then
      raise exception 'En retired programversion kan ikke genåbnes';
    end if;
    if old.status = 'published' and new.status not in ('published', 'retired') then
      raise exception 'En publiceret programversion kan kun pensioneres';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists entropi_sub_program_version_immutability on public.sub_programs;
create trigger entropi_sub_program_version_immutability
before update or delete on public.sub_programs
for each row execute function public.sub_enforce_program_version_immutability();

-- Internal-only command. It is deliberately not granted to authenticated or
-- anon. A server-side operator must provide a fresh request id for idempotency.
create or replace function public.sub_controlled_shadow_assign_program(
  p_request_id uuid,
  p_target_user_id uuid,
  p_program_version_id uuid,
  p_match_input jsonb,
  p_assignment_source text
)
returns uuid language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_existing_id uuid;
  v_program_tier text;
  v_program_status text;
  v_tier text;
  v_assignment_id uuid;
begin
  if p_request_id is null or p_target_user_id is null or p_program_version_id is null
     or p_match_input is null or nullif(trim(p_assignment_source), '') is null then
    raise exception 'Ufuldstændig kontrolleret tildelingsanmodning';
  end if;

  select id into v_existing_id
  from public.sub_assignments
  where request_id = p_request_id;
  if v_existing_id is not null then
    if not exists (
      select 1 from public.sub_assignments a
      where a.id = v_existing_id
        and a.user_id = p_target_user_id
        and a.program_id = p_program_version_id
        and a.match_input = p_match_input
        and a.assignment_source = p_assignment_source
    ) then
      raise exception 'Request-id er allerede brugt med andre tildelingsdata';
    end if;
    return v_existing_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));

  -- Recheck after the per-user lock. Concurrent retries with the same request
  -- id must return one result instead of racing into the unique index.
  select id into v_existing_id
  from public.sub_assignments
  where request_id = p_request_id;
  if v_existing_id is not null then
    if not exists (
      select 1 from public.sub_assignments a
      where a.id = v_existing_id
        and a.user_id = p_target_user_id
        and a.program_id = p_program_version_id
        and a.match_input = p_match_input
        and a.assignment_source = p_assignment_source
    ) then
      raise exception 'Request-id er allerede brugt med andre tildelingsdata';
    end if;
    return v_existing_id;
  end if;

  if jsonb_typeof(p_match_input) <> 'object' then
    raise exception 'Match-input skal være et JSON-objekt';
  end if;
  select min_tier, status into v_program_tier, v_program_status
  from public.sub_programs where id = p_program_version_id;
  if v_program_status is distinct from 'published' then
    raise exception 'Programversionen er ikke publiceret';
  end if;
  v_tier := public.sub_effective_tier(p_target_user_id);
  if v_program_tier = 'member' and v_tier <> 'member' then
    raise exception 'Programmet kræver aktivt medlemskab';
  end if;

  update public.sub_assignments
  set ended_at = now()
  where user_id = p_target_user_id and ended_at is null;

  insert into public.sub_assignments (
    user_id, program_id, match_input, request_id, assignment_source
  ) values (
    p_target_user_id, p_program_version_id, p_match_input, p_request_id, p_assignment_source
  ) returning id into v_assignment_id;
  return v_assignment_id;
end;
$$;

revoke execute on function public.sub_enforce_program_version_immutability() from public, anon, authenticated;
revoke execute on function public.sub_controlled_shadow_assign_program(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.sub_controlled_shadow_assign_program(uuid, uuid, uuid, jsonb, text) to service_role;

commit;

-- Shadow verification (run manually, with separate free/member users):
-- 1. authenticated cannot INSERT/UPDATE sub_assignments through the API.
-- 2. service procedure is idempotent for the same request_id and leaves one
--    active assignment after a replacement; a reused request_id with changed
--    arguments is rejected.
-- 3. free cannot receive a member program; self-set profiles.role changes nothing.
-- 4. service_role cannot modify content or provenance of a published program;
--    it cannot delete it and can only retire it.

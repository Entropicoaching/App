-- Entropi subscription shadow migration 04: program assignments.
-- DRAFT ONLY. Do not run against production. Validate in maxhsefxbrvsgolscqwh first.

create table public.sub_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.sub_programs(id),
  match_input jsonb not null,
  request_id uuid,
  assignment_source text,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= assigned_at)
);

create unique index sub_assignments_one_active
on public.sub_assignments(user_id) where ended_at is null;

create unique index sub_assignments_request_id_unique
on public.sub_assignments(request_id) where request_id is not null;

alter table public.sub_assignments enable row level security;
revoke all on table public.sub_assignments from anon;

create policy entropi_sub_assignments_read_own
on public.sub_assignments for select to authenticated
using (user_id = (select auth.uid()));

-- There is deliberately no authenticated INSERT, UPDATE or DELETE policy.
-- Assignments are product state and may only be changed by the controlled
-- service procedure introduced in sub-07.

-- This trigger is deliberately stricter than the RLS UPDATE policy: an owner
-- may only end an active assignment, never rewrite its program or match result.
create function public.sub_enforce_assignment_write()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
declare
  v_tier text;
  v_min_tier text;
  v_status text;
  v_program_goal text;
  v_program_equipment text;
  v_program_days integer;
  v_program_levels text[];
begin
  if tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id
       or old.program_id is distinct from new.program_id
       or old.match_input is distinct from new.match_input
       or old.request_id is distinct from new.request_id
       or old.assignment_source is distinct from new.assignment_source
       or old.assigned_at is distinct from new.assigned_at then
      raise exception 'En programtildeling kan ikke omskrives';
    end if;
    if old.ended_at is not null then
      raise exception 'En afsluttet programtildeling kan ikke genåbnes';
    end if;
    if new.ended_at is null then
      raise exception 'En aktiv programtildeling kan kun afsluttes';
    end if;
    return new;
  end if;

  -- Tier for the assigned user, never for the actor. This works for both an
  -- authenticated user and a controlled service_role assignment.
  v_tier := public.sub_effective_tier(new.user_id);
  select p.min_tier, p.status, p.content ->> 'goal', p.content ->> 'equipment',
         p.days, p.levels
    into v_min_tier, v_status, v_program_goal, v_program_equipment,
         v_program_days, v_program_levels
  from public.sub_programs p
  where p.id = new.program_id;

  if v_status is null then
    raise exception 'Ukendt programversion';
  end if;
  if v_status <> 'published' then
    raise exception 'Programversionen er ikke publiceret';
  end if;
  if v_min_tier = 'member' and v_tier <> 'member' then
    raise exception 'Programmet kræver medlemskab';
  end if;
  -- Bind the decision trail to the immutable catalogue version. This is
  -- intentionally independent of a mutable member preference row.
  if jsonb_typeof(new.match_input) <> 'object'
     or new.match_input ->> 'goal' is distinct from v_program_goal
     or coalesce(new.match_input ->> 'level', '') <> all(v_program_levels)
     or nullif(new.match_input ->> 'equipment', '') is distinct from v_program_equipment
     or coalesce(new.match_input ->> 'daysPerWeek', '') !~ '^[0-9]+$'
     or (new.match_input ->> 'daysPerWeek')::integer <> v_program_days then
    raise exception 'Match input does not match the concrete pilot programme version';
  end if;
  return new;
end;
$$;
revoke execute on function public.sub_enforce_assignment_write() from public, anon, authenticated;

create trigger entropi_sub_enforce_assignment_write
before insert or update on public.sub_assignments
for each row execute function public.sub_enforce_assignment_write();

-- Add the assigned-version access branch only after sub_assignments exists.
drop policy entropi_sub_programs_read_tier on public.sub_programs;
create policy entropi_sub_programs_read_tier
on public.sub_programs for select to authenticated
using (
  (status = 'published' and min_tier = 'free')
  or (status = 'published' and min_tier = 'member'
      and public.sub_current_tier() = 'member')
  or exists (
    select 1 from public.sub_assignments a
    where a.program_id = sub_programs.id
      and a.user_id = (select auth.uid())
  )
);

-- Shadow verification:
-- 1. No authenticated user can insert, update or delete an assignment, even
--    for itself and even when it knows a published program UUID.
-- 2. A service-role insert still rejects a member program for a free user.
-- 3. Assignment identity, program, provenance and match input cannot be
--    rewritten; the controlled sub-07 procedure may only set ended_at once.
-- 4. Retire an assigned program as service_role: only that assigned user can
--    still read its exact version through the final policy branch.

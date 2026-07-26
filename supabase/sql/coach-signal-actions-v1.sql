-- Coach-indbakke: synkroniseret "Set" / "Udsæt" for regelbaserede signaler.
-- Additiv migration: opretter kun en ny tabel + RLS. Ingen eksisterende data ændres.

create table if not exists public.coach_signal_actions (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  detector text not null check (length(detector) between 1 and 64),
  signal_fingerprint text,
  acknowledged_at timestamptz,
  snoozed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (coach_id, athlete_id, detector)
);

comment on table public.coach_signal_actions is
  'Coach-only handling state for rule-based training signals. A matching fingerprint stays acknowledged; snooze expires by timestamp.';

alter table public.coach_signal_actions enable row level security;

revoke all on table public.coach_signal_actions from anon;
grant select, insert, update, delete on table public.coach_signal_actions to authenticated;

drop policy if exists entropi_coach_signal_actions_owner
  on public.coach_signal_actions;

create policy entropi_coach_signal_actions_owner
on public.coach_signal_actions
for all
to authenticated
using (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.athletes athlete
    where athlete.id = coach_signal_actions.athlete_id
      and athlete.coach_id = auth.uid()
  )
)
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.athletes athlete
    where athlete.id = coach_signal_actions.athlete_id
      and athlete.coach_id = auth.uid()
  )
);

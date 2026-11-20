-- ORDRE 1953 · coachens ugevideo til én atlet for én uge (Marc 20. nov.: "jeg kan ligge video ind til min klienter
-- hvor ejg forklare hvordan ugen er gået samt næste uges træning").
-- UDKAST. Køres af Dhurva i Supabase efter Marcs ja, aldrig af en agent. Rollback: samme navn med _ROLLBACK.
--
-- Hvem kan se en ugevideo: kun atleten selv (athletes.user_id = auth.uid()) og hendes coach
-- (athletes.coach_id = auth.uid()), samme tjek som resten af appen. En fremmed atlet, en anden coach og anon: nej.
-- Atleten må kun sætte athlete_seen_at (så coachen ser "Set"); alt andet afvises af triggeren.
-- Klippet ligger i videolageret (R2) eller i Supabase-lageret under <athlete_id>/<id>.<ext>, samme mappe som atletens videoer.

begin;

create table if not exists public.coach_week_videos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null default auth.uid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  video_path text not null unique check (video_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(mp4|mov|webm)$'),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  athlete_seen_at timestamptz,
  check (split_part(video_path, '/', 1) = athlete_id::text)
);
create index if not exists coach_week_videos_athlete_week on public.coach_week_videos (athlete_id, week_start desc);

alter table public.coach_week_videos enable row level security;
revoke all on public.coach_week_videos from anon;
grant select, insert, update, delete on public.coach_week_videos to authenticated;

-- Coachen: læse, lægge og fjerne for sine egne atleter.
drop policy if exists coach_week_videos_coach_select on public.coach_week_videos;
create policy coach_week_videos_coach_select on public.coach_week_videos
  for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = coach_week_videos.athlete_id and a.coach_id = (select auth.uid())));

drop policy if exists coach_week_videos_coach_insert on public.coach_week_videos;
create policy coach_week_videos_coach_insert on public.coach_week_videos
  for insert to authenticated
  with check (coach_id = (select auth.uid())
    and athlete_seen_at is null
    and exists (select 1 from public.athletes a where a.id = coach_week_videos.athlete_id and a.coach_id = (select auth.uid())));

drop policy if exists coach_week_videos_coach_delete on public.coach_week_videos;
create policy coach_week_videos_coach_delete on public.coach_week_videos
  for delete to authenticated
  using (exists (select 1 from public.athletes a where a.id = coach_week_videos.athlete_id and a.coach_id = (select auth.uid())));

-- Atleten: læse sine egne og markere dem set.
drop policy if exists coach_week_videos_athlete_select on public.coach_week_videos;
create policy coach_week_videos_athlete_select on public.coach_week_videos
  for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = coach_week_videos.athlete_id and a.user_id = (select auth.uid())));

drop policy if exists coach_week_videos_athlete_seen on public.coach_week_videos;
create policy coach_week_videos_athlete_seen on public.coach_week_videos
  for update to authenticated
  using (exists (select 1 from public.athletes a where a.id = coach_week_videos.athlete_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.athletes a where a.id = coach_week_videos.athlete_id and a.user_id = (select auth.uid())));

-- Kun athlete_seen_at må ændres, og kun fra tom til et tidspunkt. Ingen anden opdatering er tilladt
-- (heller ikke for coachen; han lægger en ny video i stedet). Service-rollen (auth.uid() er null) går fri.
create or replace function public.coach_week_videos_kun_set()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.id is distinct from old.id or new.athlete_id is distinct from old.athlete_id
     or new.coach_id is distinct from old.coach_id or new.week_start is distinct from old.week_start
     or new.video_path is distinct from old.video_path or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at
     or old.athlete_seen_at is not null or new.athlete_seen_at is null then
    raise exception 'Kun "set" kan ændres på en ugevideo' using errcode = '42501';
  end if;
  return new;
end
$function$;

drop trigger if exists a_coach_week_videos_kun_set on public.coach_week_videos;
create trigger a_coach_week_videos_kun_set before update on public.coach_week_videos
  for each row execute function public.coach_week_videos_kun_set();

-- Supabase-lageret (reserven ved korte klip): coachen må lægge et klip i sin egen atlets mappe.
-- Samme policy som ordre 1952's udkast; står her også, så denne fil virker alene. Atletens og coachens
-- læsning (vc_upload_athlete_select_own, vc_upload_coach_select) findes allerede.
drop policy if exists "vc_upload_coach_insert_own_athlete" on storage.objects;
create policy "vc_upload_coach_insert_own_athlete" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videocoach-uploads'
    and exists (select 1 from public.athletes a
      where a.id::text = (storage.foldername(objects.name))[1]
        and a.coach_id = (select auth.uid())));

commit;

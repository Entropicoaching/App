-- Generalprøve (ordre 80): tre live-tabeller, som edge-funktionen u8-push læser, men som ikke er
-- med i katalogudtrækket. Kolonnerne er dem, appen selv bruger (weight_logs.logged_at er dagen som
-- tekst, readiness_logs.logged_date, messages.sender_role/read_at). Ikke fra katalog; kun til at
-- prøve funktionens læsninger med service_role. Kun struktur.
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,
  weight numeric,
  logged_at date not null default current_date
);
create table public.readiness_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,
  logged_date date not null default current_date,
  energy integer,
  soreness_level integer
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,
  sender_role text not null,
  content text,
  category text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.weight_logs enable row level security;
alter table public.readiness_logs enable row level security;
alter table public.messages enable row level security;

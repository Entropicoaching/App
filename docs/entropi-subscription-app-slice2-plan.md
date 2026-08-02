# Entropi Abonnementsapp — teknisk plan, slice 2 (datamodel, RLS, auth)

Status: **plan. Intet er implementeret.** Ingen migration, ingen Supabase-ændring,
ingen betalingsintegration, ingen deploy, ingen commit.
Dato: 2026-07-31 · Branch `feature/subscription-app-slice-1` · Base `4c3c6ac`
**Revision 3** (2026-07-31): tier-opslaget delt i `sub_effective_tier`/`sub_current_tier`; M2a besluttet. Se §10.

> Historisk plan: de direkte entitlement/assignment-eksempler og rækkefølgen
> `sub-01`–`sub-06` er erstattet af den fail-closed DRAFT-kontrakt `sub-01`–`sub-11`.
> Brug kun `subscription-shadow-backend-safe-path.md` som aktuel runbook.

Slice 1 (lokal prototype, localStorage) ligger i `src/subscription/` og er uændret
af dette dokument. Se [`entropi-subscription-app-plan.md`](entropi-subscription-app-plan.md).

---

## 0. Read-only analyse af det eksisterende (grundlag)

Alt herunder er **læst**, ikke ændret. Kilder: `src/supabase.js`, `supabase/sql/*.sql`,
samt read-only forespørgsler mod projekt `dsqgaxwgtcbqgphsofav`
(`list_tables`, `pg_policies`, `information_schema.columns`, `get_advisors`).

### 0.1 Eksisterende tabeller (25, alle med RLS aktiveret)

`profiles`, `athletes`, `weeks`, `sessions`, `exercises`, `exercise_logs`,
`exercise_library`, `personal_records`, `messages`, `weight_logs`, `meal_logs`,
`meal_templates`, `custom_foods`, `readiness_logs`, `warmup_templates`,
`mobility_routines`, `mobility_logs`, `meet_plans`, `meet_results`,
`video_analyses`, `athlete_baselines`, `athlete_baselines_v3`,
`athlete_lv_profiles`, `coach_signal_actions`, `frontend_errors`.

**Konsekvens:** navnene `sessions`, `exercises`, `exercise_logs`, `weeks`,
`messages` er optaget af 1:1-produktet. Alt nyt får præfikset `sub_`, så en
abonnementstabel aldrig kan forveksles med — eller ved et uheld erstatte — en
coaching-tabel.

### 0.2 Identitetskæden i 1:1-produktet

```
auth.users ──trigger on_auth_user_created→ public.profiles (id = auth.uid(), role)
                                        └→ public.athletes.user_id = auth.uid()
```

`profiles.role` styrer UI-valget i `src/App.jsx` (`coach` → Dashboard, ellers
AthleteView). `athletes.user_id` er den rigtige kobling mellem en logget bruger og
en 1:1-atlet.

### 0.3 Kritisk fund: `profiles` kan skrives af brugeren selv

```
profiles_own | ALL | USING (id = auth.uid()) | WITH CHECK (id = auth.uid())
```

Policyen er `FOR ALL`. En hvilken som helst indlogget bruger kan altså køre
`update profiles set role = 'coach' where id = auth.uid()`.

**To konsekvenser:**

1. **Entitlements må ikke ligge på `profiles`** — heller ikke som en ny kolonne.
   Så ville enhver bruger kunne give sig selv `member`. De skal ligge i en egen
   tabel, hvor brugeren kun har `SELECT`.
2. Der er en **eksisterende svaghed i 1:1-produktet** (rolle-eskalering). Den er
   *ikke* rørt her og skal ikke rettes som en del af abonnementssporet — den
   ændrer 1:1-RLS. Se §8, beslutning M8.

### 0.4 Konventioner der genbruges

Fra `supabase/sql/*.sql`:

- SQL gemmes som fil i `supabase/sql/` og køres som en **navngiven Supabase-migration**; filen er versionsstyringen.
- Policy-navne præfikses `entropi_…`.
- SECURITY DEFINER-funktioner: `set search_path to pg_catalog, public`, derefter
  `revoke execute … from public, anon` og `grant execute … to authenticated`.
- Atlet-adgang på tværs af tabeller løses med SECURITY DEFINER-RPC frem for brede policies.

### 0.5 Advisor-baseline (før slice 2)

1 × `rls_policy_always_true` (`frontend_errors_insert`), 2 × `rls_enabled_no_policy`
(`athlete_baselines`, `athlete_lv_profiles`), 8 × SECURITY DEFINER-funktioner
eksekverbare af `anon`/`authenticated`, 1 × leaked-password-protection slået fra.

**Krav til slice 2: antallet må ikke stige.** Alle nye funktioner skal have
`revoke … from public, anon`, og alle nye tabeller skal have mindst én policy.

---

## 1. Datamodel

Alt i `public` med præfikset `sub_`. Ingen ændring af eksisterende tabeller,
kolonner, policies, funktioner eller triggere. Ingen `product`-kolonne nogen steder.

### 1.1 `sub_entitlements` — sandheden om adgang

```sql
create table public.sub_entitlements (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tier         text not null default 'free' check (tier in ('free','member')),
  source       text not null default 'manual' check (source in ('manual','trial','stripe')),
  valid_until  timestamptz,
  updated_at   timestamptz not null default now()
);
```

- **Brugeren kan kun læse.** Ingen INSERT/UPDATE/DELETE-policy for `authenticated`
  → kun `service_role` (som omgår RLS) kan skrive. Det er hele værnet.
- **Ingen række = `free`.** Vi opretter ikke rækker ved signup, og rører derfor
  ikke `handle_new_user`-triggeren.
- `coaching` er **ikke** en værdi her. Coaching-adgang er ikke abonnementsappens
  ejendom — den udledes af `athletes.user_id = auth.uid()` i 1:1-produktet. Det
  er sådan beslutning 2 holdes: én konto, to produkter, to adskilte sandheder.

### 1.2 `sub_members` — brugerens egne valg

```sql
create table public.sub_members (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  level          text check (level in ('begynder','oevet','erfaren')),
  days_per_week  int  check (days_per_week between 2 and 4),
  equipment      text check (equipment in ('bodyweight','dumbbells','gym')),
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

Præferencer, ikke adgang. Brugeren må selv skrive dem. Bevidst adskilt fra
`profiles`, så abonnementsappen aldrig skriver i 1:1-produktets identitetstabel.

### 1.3 `sub_programs` — versionsstyret katalog

```sql
create table public.sub_programs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,                 -- stabil identitet på tværs af versioner
  version         int  not null check (version >= 1),
  status          text not null default 'draft'
                    check (status in ('draft','published','retired')),
  name            text not null,
  tagline         text,
  summary         text,
  progression_rule text not null,                -- fast tekstregel (beslutning 3)
  days            int  not null check (days between 1 and 7),
  min_equipment   int  not null check (min_equipment between 0 and 2),
  levels          text[] not null,
  min_tier        text not null default 'member' check (min_tier in ('free','member')),
  content         jsonb not null,                -- pas + øvelser, samme form som slice 1
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (slug, version)
);
```

`content` genbruger formen fra `src/subscription/programs.js`, så slice 1 kan
skifte datakilde uden at UI'et ændres.

**`min_tier` er ikke kun en UI-markering — den håndhæves i RLS (§2.3).** Efter M3
har præcis ét program `min_tier = 'free'` (startprogrammet, `slug='start-2'`);
resten er `'member'`. En `free`-bruger får derfor ikke bare et bibliotek uden
knapper — de øvrige programmers `content` forlader aldrig databasen.

### 1.4 `sub_assignments` — hvilken programversion en bruger følger

```sql
create table public.sub_assignments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  program_id   uuid not null references public.sub_programs(id),  -- den EKSAKTE version
  match_input  jsonb not null,     -- niveau/dage/udstyr på matchtidspunktet
  assigned_at  timestamptz not null default now(),
  ended_at     timestamptz
);
create unique index sub_assignments_one_active
  on public.sub_assignments(user_id) where ended_at is null;
```

`match_input` gemmes, så begrundelsen i UI'et ("hvorfor dette program") kan vises
senere uden at gætte — det er en del af "fast og gennemskueligt".

### 1.5 `sub_workouts` + `sub_workout_sets` — træningsloggen

```sql
create table public.sub_workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.sub_assignments(id),
  program_id    uuid not null references public.sub_programs(id),  -- denormaliseret
  day_id        text not null,          -- pas-id inde i program.content
  client_id     text not null,          -- idempotens for offline-kø
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (user_id, client_id)
);

create table public.sub_workout_sets (
  id          bigint generated always as identity primary key,
  workout_id  uuid not null references public.sub_workouts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,            -- øvelses-id inde i program.content
  set_index   int  not null check (set_index >= 1),
  reps        int      check (reps between 1 and 100),
  weight_kg   numeric  check (weight_kg >= 0 and weight_kg <= 500),
  rpe         numeric  check (rpe >= 5 and rpe <= 10),
  logged_at   timestamptz not null default now(),
  unique (workout_id, exercise_id, set_index)
);

create index sub_workouts_user_completed on public.sub_workouts(user_id, completed_at desc);
create index sub_workout_sets_user_ex    on public.sub_workout_sets(user_id, exercise_id, logged_at desc);
```

To detaljer med vilje:

- `program_id` gemmes **på passet**, ikke kun via assignment. Historikken skal
  kunne læses korrekt selv om brugeren senere skifter program eller version.
- `user_id` er denormaliseret ned på sæt-niveau, så RLS bliver en ren
  `user_id = auth.uid()`-sammenligning uden join — kravet om "strengt pr. auth.uid()".
  Policyen kontrollerer *derudover* at passet tilhører samme bruger (§2.2).

### 1.6 `sub_coaching_interest` — eksplicit overgang til 1:1 — **PARKERET indtil M8**

⚠️ **Bygges ikke i slice 2.** Tabellen giver kun mening sammen med en læsevej for
coachen, og den kan ikke laves sikkert før M8 er løst — se §2.5 for begrundelsen og
for hvad der gøres i mellemtiden. Skemaet står her som udkast til senere.

```sql
create table public.sub_coaching_interest (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status       text not null default 'requested'
                 check (status in ('requested','contacted','converted','declined')),
  note         text check (length(note) <= 1000)
);
```

Tabellen indeholder **kun** en henvendelse — ingen træningsdata, ingen log, ingen
programhistorik. Coachen ser den gennem en SECURITY DEFINER-RPC (§2.3), og der
sker **ingen** automatisk datadeling. Vil coachen have træningsdata, kræver det en
separat, senere og eksplicit delingsbeslutning (M6).

---

## 2. RLS-matrix

Alle tabeller: `alter table … enable row level security` og
`revoke all on … from anon`. `service_role` omgår RLS og står ikke i matricen som
policy — den er markeret `(sr)` hvor den er den *eneste* skrivevej.

`ejer` = `auth.uid() = user_id`. `anden bruger` = enhver anden indlogget.

| Tabel | anon | ejer SELECT | ejer INSERT | ejer UPDATE | ejer DELETE | anden bruger | coach (1:1) |
|---|---|---|---|---|---|---|---|
| `sub_entitlements` | ✗ | ✓ | ✗ **(sr)** | ✗ **(sr)** | ✗ **(sr)** | ✗ | ✗ |
| `sub_members` | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `sub_programs` | ✗ | ✓ **kun tier-tilladte + egen tildelte** (§2.3) | ✗ **(sr)** | ✗ **(sr)** | ✗ **(sr)** | ✓ *(samme tier-betingelse)* | ✗ |
| `sub_assignments` | ✗ | ✓ | ✓ *(trigger-vagt)* | ✓ *(kun `ended_at`)* | ✗ | ✗ | ✗ |
| `sub_workouts` | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `sub_workout_sets` | ✗ | ✓ | ✓ *(+ pas-ejerskab)* | ✓ | ✓ | ✗ | ✗ |
| ~~`sub_coaching_interest`~~ | — | — | — | — | — | — | **parkeret indtil M8** (§2.5) |

**Ingen coach-policy på nogen abonnementstabel.** En coach er i denne model bare
en almindelig bruger. Det er den tekniske håndhævelse af beslutning 2 og 7.

### 2.1 Policy-skabelon (ejer-tabeller)

```sql
create policy entropi_sub_workouts_own on public.sub_workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

`(select auth.uid())` frem for `auth.uid()` — samme mønster som de eksisterende
`athletes_*`-policies (initplan-caching, ellers evalueres den pr. række).

### 2.2 Sæt: både ejerskab og pas-ejerskab

```sql
create policy entropi_sub_sets_own on public.sub_workout_sets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sub_workouts w
                where w.id = workout_id and w.user_id = (select auth.uid()))
  );
```

Uden `exists`-delen kunne en bruger hænge sine egne sæt på en fremmed brugers pas.
De ville ikke være synlige for offeret, men fremmedreferencen ville findes.

### 2.3 Programlæsning: tier-beskyttet, ikke bare "published"

Programindhold er produktet. En policy der kun tjekker `status = 'published'` ville
give enhver indlogget bruger — også `free` — hele biblioteket via REST, uanset hvad
UI'et viser. Adgangen skal derfor afhænge af tier.

Tier slås op gennem SECURITY DEFINER-hjælpere, så policyen ikke afhænger af
`sub_entitlements`' egne grants og policies, og så udløbslogikken kun findes ét sted.

**To funktioner, ikke én.** Den indre tager brugeren som parameter; den ydre er en
tynd `auth.uid()`-indpakning:

```sql
-- INTERN. Tager brugeren eksplicit, så den også virker når der ikke findes en
-- auth-kontekst (service_role, triggere, baggrundsjob). Ingen klient-execute.
create function public.sub_effective_tier(target_user_id uuid)
returns text language sql stable security definer
set search_path to pg_catalog, public as $$
  select coalesce(
    (select e.tier from public.sub_entitlements e
     where e.user_id = target_user_id
       and (e.valid_until is null or e.valid_until > now())),
    'free')
$$;
revoke execute on function public.sub_effective_tier(uuid) from public, anon, authenticated;

-- Til RLS og til klienten: altid den kaldende bruger, aldrig en parameter.
create function public.sub_current_tier()
returns text language sql stable security definer
set search_path to pg_catalog, public as $$
  select public.sub_effective_tier(auth.uid())
$$;
revoke execute on function public.sub_current_tier() from public, anon;
grant  execute on function public.sub_current_tier() to authenticated;
```

Hvorfor opdelingen virker:

- `sub_effective_tier` har **ingen** `grant` til `authenticated`. Den kan ikke kaldes
  over REST og kan ikke bruges til at udspørge en anden brugers tier.
- `sub_current_tier` er SECURITY DEFINER og kører derfor som ejeren, når den kalder
  den indre funktion. Klienten har adgang til indpakningen, men kun til sin egen tier.
- `sub_effective_tier(null)` (dvs. `service_role` uden auth-kontekst) rammer
  `coalesce(…, 'free')` og returnerer `'free'` — den fejler ikke, den giver bare
  ingen adgang. Det er den rigtige standardværdi for en adgangsfunktion.
- Udløbslogikken (`valid_until`) står stadig **ét** sted.

```sql
create policy entropi_sub_programs_read on public.sub_programs
  for select to authenticated
  using (
    -- 1) gratisprogrammet: åbent for alle indloggede
    (status = 'published' and min_tier = 'free')
    -- 2) medlemsprogrammer: kun med gyldigt member-entitlement
    or (status = 'published' and min_tier = 'member'
        and public.sub_current_tier() = 'member')
    -- 3) din egen tildelte version — også når den er retired eller
    --    dit medlemskab er udløbet: du skal kunne læse dit eget forløb
    or exists (select 1 from public.sub_assignments a
               where a.program_id = sub_programs.id
                 and a.user_id = (select auth.uid()))
  );
```

De tre grene svarer 1:1 til de tre krav:

1. `min_tier = 'free'` → startprogrammet, som `free` må bruge og logge (M3).
2. `min_tier = 'member'` → kræver gyldigt, ikke-udløbet member-entitlement.
   Udløber medlemskabet, forsvinder biblioteket fra databasen, ikke kun fra UI'et.
3. Assignment-grenen har **med vilje ingen** `status`- eller tier-betingelse. Det er
   hele pointen i beslutning 4: en `retired` version — eller en version man blev
   tildelt som medlem og siden er faldet til `free` på — kan stadig læses af netop
   de brugere der følger den. Ingen andre.

Gren 3 kan ikke misbruges til at læse fremmede programmer: `sub_assignments` har selv
RLS på `user_id = auth.uid()`, og tildeling går gennem tier-vagten i §2.4.

**Rækkefølge-note:** gren 3 refererer `sub_assignments`, som først findes i
migrationstrin 4. Trin 3 opretter derfor policyen med gren 1+2, og trin 4 erstatter
den med den fulde version. Se §5.

### 2.4 Tier-vagt på tildeling

En policy kan ikke elegant udtrykke "programmets `min_tier` ≤ min tier", fordi tier
ligger i en tabel brugeren ikke må skrive. Derfor en trigger:

```sql
create function public.sub_enforce_assignment_tier()
returns trigger language plpgsql security definer
set search_path to pg_catalog, public as $$
declare v_tier text; v_min text; v_status text;
begin
  -- Tier for DEN TILDELTE BRUGER — ikke for den der udfører insert'et.
  -- Samme udløbslogik som RLS-policyen, via den fælles interne hjælper.
  v_tier := public.sub_effective_tier(new.user_id);
  select p.min_tier, p.status into v_min, v_status
    from public.sub_programs p where p.id = new.program_id;
  if v_status is null then
    raise exception 'Ukendt programversion';
  end if;
  if v_status <> 'published' then
    raise exception 'Programversionen er ikke publiceret';
  end if;
  if v_min = 'member' and v_tier <> 'member' then
    raise exception 'Programmet kræver medlemskab';
  end if;
  return new;
end $$;
```

Fejlen er en teknisk grænse, ikke et betalingsflow. UI'et viser "ikke inkluderet
på dit niveau" — aldrig en pris eller en købsknap.

Triggeren er nødvendig **ud over** RLS i §2.3: en læsepolicy forhindrer ikke en
bruger i at `insert`e en `sub_assignments`-række med et program-id de har gættet
eller husket fra dengang de var medlem. Læsning og tildeling skal begge lukkes.

Triggeren bruger `sub_effective_tier(new.user_id)` og **ikke** `sub_current_tier()`.
Forskellen er afgørende: `auth.uid()` er `null` under `service_role`, så en
`sub_current_tier()`-baseret trigger ville regne enhver manuel tildeling som
`free` og afvise ethvert member-program — også når den tildelte bruger faktisk
*er* medlem. Vagten skal vurdere **den der tildeles**, ikke den der udfører
handlingen.

Rollefordelingen bliver dermed:

| Sammenhæng | Funktion | Vurderer |
|---|---|---|
| RLS-policy på `sub_programs` | `sub_current_tier()` | den kaldende bruger |
| `sub_my_access_v1()` (klient) | `sub_current_tier()` | den kaldende bruger |
| Tildelings-trigger | `sub_effective_tier(new.user_id)` | den tildelte bruger |

At en bruger kun kan tildele til sig selv, håndhæves fortsat af
`with check (user_id = auth.uid())` på tabellen — det er den regel, ikke triggeren,
der forhindrer tildeling på andres vegne. `service_role` omgår som altid RLS og kan
derfor tildele manuelt; triggeren tjekker stadig at modtageren har det rette
entitlement, hvilket er præcis det ønskede værn i M1-proceduren (§8.2).

### 2.5 Coach-RPC til interessetilkendegivelser — **PARKERET indtil M8**

Den oprindelige plan havde en `sub_coaching_interest_for_coach_v1()`, der gav
adgang på baggrund af `profiles.role = 'coach'`.

**Den bygges ikke.** `profiles.role` kan selvskrives (§0.3), så enhver indlogget
bruger kunne sætte sin egen rolle til `coach` og derefter kalde RPC'en. Det ville
eksponere andre brugeres interessetilkendegivelser — inklusive fritekstnoter, som
netop er den slags indhold folk skriver personlige ting i. At indholdet "kun" er en
henvendelse og ikke træningsdata gør ikke lækagen acceptabel.

**Regel herfra:** ingen abonnementsautorisation — hverken policy, trigger eller RPC —
må bruge `profiles.role`. Den eneste tilladte kilde til adgang er
`sub_entitlements` via `sub_current_tier()`, samt `auth.uid()`-ejerskab.

Konsekvens for slice 2: tabellen `sub_coaching_interest` (§1.6) og migrationstrin 6
er parkeret. Overgang til 1:1 håndteres i mellemtiden **uden datalagring** — UI'et
viser en almindelig kontaktvej (mail/link til Entropi), og brugeren skriver selv.
Det opfylder stadig beslutning 7: overgangen er en eksplicit brugerhandling, og der
deles ingen træningsdata automatisk. Skal henvendelsen registreres i appen, kræver
det først M8 og derefter en autorisationsmodel der ikke hviler på `profiles.role`
(fx en `sub_staff`-tabel som kun `service_role` kan skrive).

---

## 3. Auth- og entitlement-flow

### 3.1 Én identitet, to sessioner

Samme Supabase-projekt og samme GoTrue-brugere. Abonnementsappen ligger på et
**separat subdomæne** (beslutning 6), og `localStorage` er pr. origin — så
sessionen deles *ikke* automatisk mellem atletportalen og abonnementsappen.
Brugeren logger ind hvert sted. Det er en fordel her: to produkter, to sessioner,
ingen utilsigtet krydsadgang.

Klienten i `src/subscription/supabaseClient.js` skal alligevel sætte en egen
`storageKey`:

```js
createClient(URL, KEY, {
  auth: { storageKey: 'entropi-sub-auth', persistSession: true, detectSessionInUrl: false },
})
```

så de to aldrig kan overskrive hinandens token, heller ikke hvis nogen en dag
tester dem på samme origin. **`src/supabase.js` importeres ikke** — abonnementsappen
får sin egen klient, uden `warmupAuth`, `queueWrite` og de 1:1-specifikke retry-lag.

### 3.2 Adgangsopslag: én RPC, aldrig `profiles`

```sql
create function public.sub_my_access_v1()
returns table(tier text, has_coaching boolean)
language sql stable security definer set search_path to pg_catalog, public as $$
  select
    public.sub_current_tier(),                    -- samme kilde som RLS (§2.3)
    exists (select 1 from public.athletes a where a.user_id = auth.uid())
$$;
revoke execute on function public.sub_my_access_v1() from public, anon;
grant  execute on function public.sub_my_access_v1() to authenticated;
```

Udløbs- og tier-logikken findes ét sted — `sub_effective_tier()` — og nås gennem
`sub_current_tier()` overalt hvor "den kaldende bruger" er det rigtige spørgsmål.
UI, RLS-policy og tildelings-trigger kan derfor ikke komme til at være uenige om
hvad en bruger har adgang til, selv om de spørger fra hver sin kontekst.

- `tier` kommer fra en tabel brugeren ikke kan skrive.
- `has_coaching` er **kun** et UI-signal ("du har også 1:1 hos Entropi — åbn
  atletportalen"). Det åbner intet i abonnementsappen og henter ingen coaching-data.
- Ingen adgangsbeslutning bruger `profiles.role`.

### 3.3 Flow ved appstart

```
login → sub_my_access_v1()  → { tier, has_coaching }
      → select * from sub_members where user_id = auth.uid()
          ├─ ingen række → onboarding → insert sub_members
          │                            → deterministisk match (uændret klientlogik)
          │                            → insert sub_assignments (trigger tjekker tier)
          └─ række       → hent aktiv assignment + program → "I dag"
```

`free` uden `sub_entitlements`-række rammer `coalesce(...,'free')` — derfor er
ingen skrivning nødvendig ved signup, og `handle_new_user` forbliver urørt.

### 3.4 Klientens skrivemønster

Slice 1's rene funktioner i `trainingLog.js` bevares som de er. `storage.js`
udvides til to implementeringer bag samme interface: `local` (nu) og `remote`
(Supabase). Loggen skrives optimistisk lokalt først og synkroniseres derefter —
`client_id` på `sub_workouts` gør gentagne forsøg idempotente. UI-koden i
`screens/` bør ikke ændres i slice 2.

---

## 4. Programversionering (beslutning 4)

**Regel:** et program identificeres af `slug`; en *version* er en selvstændig række.
Redigering opretter altid en ny række.

```
sub_programs (slug='okuk-4', version=1, status='published')   ← Marc følger denne
sub_programs (slug='okuk-4', version=2, status='published')   ← ny bruger får denne
sub_programs (slug='okuk-4', version=1, status='retired')     ← lukket for nye
```

- `sub_assignments.program_id` peger på **række-id'et**, altså en eksakt version.
  En aktiv bruger flytter sig aldrig af sig selv.
- At retirere en version påvirker ingen aktive forløb (§2.3 lader ejeren læse videre).
- Skift af version er en **eksplicit brugerhandling**: afslut nuværende assignment
  (`ended_at = now()`) og opret en ny. Historikken peger fortsat på den gamle
  version via `sub_workouts.program_id`, så gamle pas læses med de øvelsesnavne de
  faktisk havde.
- Redigeringsvejen er en reviewet SQL-fil i `supabase/sql/`, kørt som migration af
  `service_role` (M4, besluttet). Ingen admin-UI. Hver ny version er dermed et
  reviewbart diff i git — samme model som resten af `supabase/sql/`.

**Ikke besluttet:** hvad der sker når en version *skal* trækkes tilbage af faglige
grunde (fx en farlig øvelse). Det kræver en migreringsvej for aktive brugere — M5.

---

## 5. Migrationsrækkefølge

Syv additive trin. Hvert trin kan køres og verificeres alene, og intet trin rører
en eksisterende tabel, kolonne, policy, funktion eller trigger.

| # | Fil | Indhold | Verifikation efter trinnet |
|---|---|---|---|
| 1 | `sub-01-entitlements.sql` | `sub_entitlements`, RLS (kun SELECT for ejer), `sub_effective_tier(uuid)`, `sub_current_tier()`, `sub_my_access_v1()` | Ny bruger får `('free', false)`. `insert`/`update` som `authenticated` fejler. `sub_current_tier()` returnerer `'free'` uden række og respekterer `valid_until`. **`select public.sub_effective_tier('<anden brugers id>')` som `authenticated` skal fejle med `permission denied for function`.** |
| 2 | `sub-02-members.sql` | `sub_members`, RLS, `updated_at`-trigger | Bruger kan skrive egen række; kan ikke se en andens. |
| 3 | `sub-03-programs.sql` | `sub_programs`, læsepolicy **gren 1+2** (tier), seed af de 3 slice-1-programmer som `version=1, published`; `start-2` med `min_tier='free'`, de øvrige `'member'` | `free`-bruger ser **1** række, `member` ser **3**. `insert` som `authenticated` fejler. |
| 4 | `sub-04-assignments.sql` | `sub_assignments`, unikt aktivt indeks, tier-trigger, **udskiftning af læsepolicyen med gren 1+2+3** | `free` afvises på et `member`-program (både usynligt og afvist ved insert). Retireret version er stadig læsbar for den tildelte bruger. |
| 5 | `sub-05-workouts.sql` | `sub_workouts`, `sub_workout_sets`, RLS, indekser | Bruger A kan ikke læse eller skrive bruger B's pas eller sæt. |
| 6 | `sub-06-hardening.sql` | `revoke … from anon` på alt nyt, `get_advisors`-gennemgang | Advisor-antallet er **uændret** i forhold til baseline (§0.5). |
| — | ~~`sub-07-coaching-interest.sql`~~ | **PARKERET indtil M8** (§2.5) | — |

**Rækkefølge-afhængighed:** programpolicyens gren 3 refererer `sub_assignments`, og
`sub_assignments` har fremmednøgle til `sub_programs`. Cirklen brydes ved at trin 3
opretter policyen med gren 1+2 (allerede sikker: tier håndhæves), og trin 4 —
efter at `sub_assignments` findes — erstatter den med den fulde tregrenede version.
Mellem trin 3 og 4 er en retireret version utilgængelig for alle, hvilket er
harmløst fordi der endnu ikke findes tildelinger.

**Før trin 1** køres en baseline-optælling, som gentages efter trin 6:

```sql
select count(*) from pg_policies where schemaname='public';
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef;
```

Ingen eksisterende policy eller funktion må være forsvundet eller ændret.

**Rollback:** hvert trin er `drop`-bart i omvendt rækkefølge. Ingen eksisterende
objekt refererer til noget `sub_*`, så et rul tilbage kan ikke efterlade
1:1-produktet i stykker. Det er selve grunden til at der ikke er en delt
`product`-kolonne.

**Test før prod (M7, besluttet):** trin 1-6 køres i et **separat Supabase-skyggeprojekt**,
ikke på `dsqgaxwgtcbqgphsofav`. Hele RLS-matricen i §2 verificeres dér med tre
testbrugere — A (`free`), B (`member`) og C (`free`, men med `profiles.role='coach'`
sat af brugeren selv) — før der overhovedet tages stilling til prod. Bruger C er
tilføjet netop for at bevise at en selverklæret coach ikke får adgang til noget som
helst i abonnementssporet.

**Verifikation af tier-gennemslag** (skal køres som bruger A, ikke som `service_role`):

```sql
select count(*) from public.sub_programs;                 -- forventet: 1
select count(*) from public.sub_programs where min_tier='member';  -- forventet: 0
insert into public.sub_assignments(user_id, program_id, match_input)
values (auth.uid(), '<member-program-id>', '{}'::jsonb);  -- forventet: exception
```

---

## 6. Frontend-afgrænsning i slice 2

| Fil | Ændring |
|---|---|
| `src/subscription/supabaseClient.js` | **ny** — egen klient med egen `storageKey` |
| `src/subscription/auth.jsx` | **ny** — login/signup kun for abonnementsappen |
| `src/subscription/access.js` | **ny** — kalder `sub_my_access_v1()`, erstatter det lokale `entitlement`-felt |
| `src/subscription/entitlements.js` | opdateres til M3-grænsen (se nedenfor); `can()` beholdes som ren, testet funktion |
| `src/subscription/storage.js` | udvides: `local` + `remote` bag samme interface |
| `src/subscription/programs.js` | bliver fallback/seed-kilde; data hentes fra `sub_programs` |
| `src/subscription/screens/*` | uændret UI-logik |
| **Alt uden for `src/subscription/`** | **uændret** |

**Feature-grænsen efter M3** — `entitlements.js` justeres, så den svarer til det RLS
faktisk håndhæver (UI'et må aldrig love mere eller mindre end databasen giver):

| Feature | `free` | `member` |
|---|---|---|
| Onboarding | ✓ | ✓ |
| Startprogram (`start-2`) | ✓ | ✓ |
| Deterministisk programmatch | ✗ | ✓ |
| Fuldt programbibliotek | ✗ | ✓ |
| Logning af træning | ✓ *(på startprogrammet)* | ✓ |
| Historik over egne pas | ✓ | ✓ |
| Progression pr. øvelse | ✗ | ✓ |

`free` springer altså matcher-trinnet i onboardingen over og tildeles direkte
`start-2`. Det er en forenkling af flowet, ikke en spærre midt i det — brugeren
møder ingen låst knap undervejs.

### 6.1 Build og deploy (M2, besluttet: `train.entropicoaching.dk`)

Samme repo, **separat Vite-entry og separat deploy-workflow**. Kun nye filer —
`vite.config.js`, `.github/workflows/deploy.yml`, `index.html` og `public/` røres ikke.

| Ny fil | Rolle |
|---|---|
| `vite.subscription.config.js` | Egen config: input `subscription.html`, `outDir: 'dist-subscription'`, **`publicDir: 'public-subscription'`** |
| `public-subscription/CNAME` | `train.entropicoaching.dk` |
| `public-subscription/manifest.webmanifest`, `icon.svg` | Egen PWA-identitet |
| `.github/workflows/deploy-subscription.yml` | Bygger med den nye config og publicerer `dist-subscription` |

**`publicDir` skal peges væk fra `public/`.** Ellers kopierer buildet
`public/CNAME` (= `app.entropicoaching.dk`) og `public/sw.js` ind i
abonnementsappens output — og en forkert CNAME i et Pages-deploy kan rive
atletportalens domæne med sig. Det er den enkeltfejl der ville gøre mest skade her.

Abonnementsappen får **ingen** service worker i første omgang (slice 1 har den
heller ikke). PWA-installation og offline-cache er et selvstændigt stykke arbejde
med sine egne cache-faldgruber — se [[gh-pages-fastly-cache-gotcha]]-erfaringen fra
atletportalen.

### 6.2 Deploy-mål (M2a, besluttet)

GitHub Pages tillader **ét custom domain pr. Pages-site, og ét Pages-site pr. repo**.
`Entropicoaching/App` bruger allerede sit til `app.entropicoaching.dk` via
`public/CNAME` og `peaceiris/actions-gh-pages` → `gh-pages`.

**Besluttet:** kilden bliver i det nuværende repo; udgivelsen sker til et
**separat GitHub-repo med sit eget Pages-site**, som betjener
`train.entropicoaching.dk`.

```
Entropicoaching/App  (kilde, uændret)
  ├── index.html          → vite.config.js          → dist            → gh-pages (samme repo)
  │                                                                     → app.entropicoaching.dk
  └── subscription.html   → vite.subscription.config.js → dist-subscription
                                                        → nyt repo, gh-pages
                                                        → train.entropicoaching.dk
```

Workflowen `deploy-subscription.yml` publicerer med
`peaceiris/actions-gh-pages` og `external_repository` + `deploy_key`. De to sites
har hver sit Pages-site og hver sin CNAME og kan ikke vælte hinanden.

**Ikke gjort nu, og ikke en del af dette arbejde:** oprettelse af deploy-repoet,
deploy key, DNS-record og selve workflow-filen. Det nuværende worktree bruges
fortsat kun til prototype og skyggeprojekt-test — **intet flyttes, publiceres eller
deployes endnu**.

Indtil deploy-sporet startes, forbliver `subscription.html` dev-only, og
`vite build` (atletportalen) har fortsat kun `index.html` som input.

**Rækkefølge når det engang sker:** opret deploy-repo og DNS først, verificér at
`train.entropicoaching.dk` svarer fra et tomt Pages-site, og tilføj derefter
workflowen. Bygger man før målet findes, er første grønne workflow-kørsel også
første gang nogen opdager at CNAME'en peger forkert.

---

## 7. Hvad denne plan bevidst IKKE gør

- Ingen ændring af `profiles`, `athletes` eller nogen 1:1-tabel — heller ikke additivt.
- Ingen ændring af `handle_new_user`, `claim_athlete_profile*`, `my_athlete_id` eller andre eksisterende funktioner.
- Ingen `product`-kolonne, ingen delt `sessions`/`exercise_logs`.
- Ingen retention-, eksport- eller sletteautomatik (beslutning 7 — udskudt bevidst).
- Ingen Stripe, ingen priser, ingen betalingsflade.
- Ingen automatisk deling af abonnementsdata til coaching.
- **Ingen autorisation baseret på `profiles.role`** — hverken policy, trigger eller RPC.
- **Ingen `sub_coaching_interest`-tabel og ingen coach-RPC** (§2.5, parkeret til M8).
- Ingen admin-UI til entitlements eller programmer (M1 og M4: manuelt, reviewet, via `service_role`).

---

## 8. Beslutninger

### 8.1 Truffet af Marc (2026-07-31) — indarbejdet ovenfor

| # | Beslutning | Hvor det står |
|---|---|---|
| **M1** | Kontrolleret manuel `service_role`-procedure til shadow-test og en lille pilot. Ingen admin-UI. | §8.2 (procedure), §7 |
| **M2** | `train.entropicoaching.dk`, samme kilderepo, separat Vite-entry og separat deploy-workflow. | §6.1 |
| **M2a** | Udgivelse til et separat GitHub-repo med eget Pages-site. Intet flyttes eller deployes endnu; worktreet bruges fortsat til prototype og skyggetest. | §6.2 |
| **M3** | `free`: ét startprogram, må bruge og logge det, og se den historik. `member`: matcher, fuldt bibliotek, fuld progressionsvisning. | §1.3, §2.3, §6, trin 3 i §5 |
| **M4** | Marc vedligeholder programmer som versionsstyrede, reviewede data/SQL-seeds. Ingen admin-UI. | §4, §7 |
| **M7** | Alle trin testes først i et separat Supabase-skyggeprojekt. | §5 |
| **M8** | Særskilt **kritisk** 1:1-security-task. Ingen abonnementsautorisation må bruge `profiles.role`. | §2.5, §7, §8.3 |

### 8.2 M1 — procedure for at sætte `member`

Indtil betaling findes, er tildeling en manuel, sporbar handling:

1. Marc kører i Supabase SQL-editoren (som `service_role`, der omgår RLS):

```sql
insert into public.sub_entitlements (user_id, tier, source, valid_until, updated_at)
values ('<auth-user-id>', 'member', 'manual', '<slutdato eller null>', now())
on conflict (user_id) do update
  set tier = excluded.tier,
      source = excluded.source,
      valid_until = excluded.valid_until,
      updated_at = now();
```

2. Kørslen noteres i `supabase/sql/` som en dateret pilot-log, så det altid kan
   rekonstrueres hvem der har fået hvad og hvornår.
3. Tilbagerulning er samme kommando med `tier='free'` — eller `valid_until` i
   fortiden, hvilket `sub_current_tier()` behandler som udløbet.

Til pilot bør `valid_until` altid sættes. En pilotadgang uden slutdato er i praksis
permanent, og det er en produktbeslutning man kommer til at træffe ved et uheld.

**Rækkefølge:** sæt entitlement **før** brugeren tildeles et member-program.
Tildelings-triggeren (§2.4) vurderer den tildelte brugers tier via
`sub_effective_tier(new.user_id)` og virker derfor korrekt også når Marc tildeler
manuelt som `service_role` — men den vurderer tilstanden på tildelingstidspunktet,
så et manglende entitlement giver `Programmet kræver medlemskab`.

### 8.3 M8 — særskilt kritisk opgave i 1:1-sporet

**Ikke en del af abonnementssporet. Ikke rørt her.**

- **Fund:** `profiles_own` er `FOR ALL` med `USING/WITH CHECK (id = auth.uid())`.
  Enhver indlogget bruger kan sætte sin egen `profiles.role` til `coach`.
- **Konsekvens i dag:** `src/App.jsx` ville rendere Dashboard for en selverklæret
  coach. Hvad der reelt kan læses derfra afhænger af de øvrige tabellers policies —
  fx `athletes_select`, som kræver `coach_id = auth.uid()`. Den fulde konsekvens
  skal kortlægges som en del af opgaven, ikke gættes her.
- **Forventet retning:** erstat `FOR ALL` med separate policies, hvor `UPDATE` ikke
  må ændre `role` (kolonne-værn via trigger, samme mønster som
  `enforce_athlete_seen_only` i `supabase/sql/message-tracks-and-athlete-seen.sql`).
- **Rækkefølge:** M8 skal løses før §2.5 og migrationstrinnet for
  `sub_coaching_interest` kan genoptages.

### 8.4 Stadig åbent

| # | Beslutning | Blokerer? |
|---|---|---|
| **M5** | Fagligt tilbagetræk af en programversion midt i aktive forløb: tvungen migrering eller besked til brugeren? | Nej |
| **M6** | Hvilke data må følge med ved overgang til 1:1, og hvordan bekræfter brugeren det? I dag: intet, og ingen registrering i appen (§2.5). | Nej |
| **M9** | Får en 1:1-atlet automatisk `member`, eller er det to køb? `has_coaching` findes allerede i `sub_my_access_v1()`, så begge dele kan implementeres — men det skal besluttes. | Nej |
| **M10** | Eksport/sletning ved opsigelse. Skal besluttes før første betalende bruger, ikke før kode. | Nej |

---

## 9. Anbefalet næste skridt

1. Trin 1-6 skrives som SQL-filer i `supabase/sql/` — **stadig uden at køre dem**.
2. Skyggeprojekt oprettes (M7).
3. Trin 1-6 køres dér, og hver celle i §2 verificeres eksplicit med bruger A
   (`free`), B (`member`) og C (`free` + selvsat `profiles.role='coach'`).
4. `get_advisors` på skyggeprojektet sammenlignes med baseline i §0.5.
5. Deploy-sporet (§6.2) startes som et selvstændigt stykke arbejde — uafhængigt af 1-4.
6. Først derefter tages stilling til prod.

M8 kører som sit eget spor i 1:1-produktet og er ikke en forudsætning for 1-6.

---

## 10. Revisionslog

### Revision 3 — 2026-07-31

**Rettelse: tier-opslaget er delt i to funktioner (§2.3, §2.4).**
Revision 2 lod tildelings-triggeren kalde `sub_current_tier()`, som hviler på
`auth.uid()`. Under `service_role` er `auth.uid()` `null`, så triggeren ville have
regnet enhver manuelt tildelt bruger som `free` og afvist alle member-programmer —
altså netop den situation M1-proceduren er bygget til. Nu:

| Funktion | Kaldes af | Vurderer | Klient-execute |
|---|---|---|---|
| `sub_effective_tier(uuid)` | interne kaldere (triggere, andre SECURITY DEFINER-funktioner) | den angivne bruger | **nej** — revoke fra `public, anon, authenticated` |
| `sub_current_tier()` | RLS-policy, `sub_my_access_v1()` | `auth.uid()` | ja, `authenticated` |

Én fælles udløbslogik bevaret i `sub_effective_tier`. Indpakningen er SECURITY
DEFINER og kører som ejeren, så klienten aldrig behøver — eller får — adgang til
den parametriserede variant. Den tidligere note om at deaktivere triggeren ved
manuel tildeling er fjernet; den er ikke længere nødvendig.

**M2a besluttet (§6.2):** udgivelse til et separat GitHub-repo med eget Pages-site
for `train.entropicoaching.dk`. Intet flyttes, publiceres eller deployes endnu;
worktreet bruges fortsat til prototype og skyggeprojekt-test.

Uændret: M1 (manuel `service_role`-pilotprocedure), M3 (`free` = ét startprogram
med logning og historik), M4 (versionsstyrede datafiler/SQL-seeds), M7
(skyggeprojekt).

### Revision 2 — 2026-07-31

**Sikkerhedsstramning 1: `sub_programs_read` er nu tier-beskyttet (§2.3).**
Den oprindelige policy tjekkede kun `status = 'published'` og ville dermed
udlevere hele biblioteket til enhver indlogget bruger via REST — uanset hvad UI'et
viste. Policyen kræver nu `min_tier = 'free'`, gyldigt member-entitlement, eller en
eksisterende tildeling til den konkrete programversion. Tier slås op via en ny
`sub_current_tier()`, som også bruges af `sub_my_access_v1()` og tildelings-
triggeren, så UI, RLS og trigger ikke kan komme ud af trit. Medførte en
rækkefølgeændring i §5 (policyen bygges i to tempi, trin 3 og trin 4).
*(Triggerens brug af `sub_current_tier()` blev rettet i revision 3.)*

**Sikkerhedsstramning 2: coach-RPC og `sub_coaching_interest` er parkeret (§2.5).**
`sub_coaching_interest_for_coach_v1()` gav adgang på baggrund af `profiles.role`,
som brugeren selv kan skrive. Enhver kunne have sat sin rolle til `coach` og læst
andres interessenoter. Både RPC og tabel udgår af slice 2 indtil M8 er løst, og der
er indført en generel regel: ingen abonnementsautorisation må bruge `profiles.role`.
Overgang til 1:1 håndteres i mellemtiden uden datalagring.

**Indarbejdet:** M1 (§8.2), M2 (§6.1), M3 (§1.3, §2.3, §5, §6), M4 (§4, §7),
M7 (§5), M8 (§8.3).

**Nyt åbent punkt:** M2a — GitHub Pages kan ikke betjene to custom domains fra ét
repo, så udgivelsesmålet for `train.entropicoaching.dk` skal afklares (§6.2).
*(Besluttet i revision 3: separat repo med eget Pages-site.)*

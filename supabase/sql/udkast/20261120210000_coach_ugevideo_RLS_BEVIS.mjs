// ORDRE 1953: kører udkastet i en rigtig Postgres (PGlite) og prøver, hvem der kan se en ugevideo. Ikke en del af suiten.
// Kør fra en tom temp-mappe: npm i @electric-sql/pglite, kopiér denne fil derind, og node <fil> <sti til _DRAFT.sql>.
// Resultat 20. nov. 2026: 26 af 26 PASS (ordrer\flaade\plan\1953\TJEK.md).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const draft = readFileSync(process.argv[2], 'utf8')
const db = new PGlite()
const C1 = '11111111-1111-4111-8111-111111111111', C2 = '33333333-3333-4333-8333-333333333333'
const U1 = '22222222-2222-4222-8222-222222222222', U2 = '44444444-4444-4444-8444-444444444444'
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const V1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', V2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, storage, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table public.athletes (id uuid primary key, user_id uuid, coach_id uuid);
alter table public.athletes enable row level security;
create policy athletes_read on public.athletes for select using (user_id = auth.uid() or coach_id = auth.uid());
grant select on public.athletes to authenticated;
insert into public.athletes values ('${A1}', '${U1}', '${C1}'), ('${A2}', '${U2}', '${C2}');
create table storage.objects (id serial primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert on storage.objects to authenticated; grant usage on sequence storage.objects_id_seq to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to authenticated;
-- de eksisterende læse-policies fra supabase/migrations/20260923120000_video_upload_policy_name_fix_v1.sql
create policy "vc_upload_athlete_select_own" on storage.objects for select to authenticated using (bucket_id = 'videocoach-uploads'
  and exists (select 1 from public.athletes a where a.id::text = (storage.foldername(objects.name))[1] and a.user_id = (select auth.uid())));
create policy "vc_upload_coach_select" on storage.objects for select to authenticated using (bucket_id = 'videocoach-uploads'
  and exists (select 1 from public.athletes a where a.id::text = (storage.foldername(objects.name))[1] and a.coach_id = (select auth.uid())));
`)
await db.exec(draft)

const resultater = []
async function som(rolle, uid, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${rolle};`)
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, affected: r.affectedRows } }
  catch (e) { return { ok: false, fejl: e.message } }
  finally { await db.exec('reset role') }
}
function prøv(navn, forventet, faktisk) {
  const pass = forventet === faktisk
  resultater.push({ navn, forventet, faktisk, pass })
}
const ins = (v, a) => `insert into public.coach_week_videos (id, athlete_id, week_start, video_path) values ('${v}', '${a}', '2026-11-23', '${a}/${v}.mp4')`

prøv('coach lægger video til egen atlet', true, (await som('authenticated', C1, ins(V1, A1))).ok)
prøv('coach lægger video til fremmed atlet', false, (await som('authenticated', C1, ins(V2, A2))).ok)
prøv('anden coach lægger til sin egen atlet', true, (await som('authenticated', C2, ins(V2, A2))).ok)
prøv('atlet lægger selv en video', false, (await som('authenticated', U1, ins('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', A1))).ok)
prøv('anon lægger en video', false, (await som('anon', null, ins('ffffffff-ffff-4fff-8fff-ffffffffffff', A1))).ok)
const sel = 'select id from public.coach_week_videos order by id'
prøv('atleten ser sin egen video (antal)', 1, (await som('authenticated', U1, sel)).rows?.length)
prøv('atleten ser kun sin egen (id)', V1, (await som('authenticated', U1, sel)).rows?.[0]?.id)
prøv('fremmed atlet ser videoen (antal rækker med V1)', 0, (await som('authenticated', U2, `select id from public.coach_week_videos where id = '${V1}'`)).rows?.length)
prøv('fremmed coach ser videoen (antal rækker med V1)', 0, (await som('authenticated', C2, `select id from public.coach_week_videos where id = '${V1}'`)).rows?.length)
prøv('egen coach ser videoen (antal)', 1, (await som('authenticated', C1, sel)).rows?.length)
prøv('anon læser tabellen', false, (await som('anon', null, sel)).ok)
prøv('fremmed atlet markerer V1 set (rækker ændret)', 0, (await som('authenticated', U2, `update public.coach_week_videos set athlete_seen_at = now() where id = '${V1}'`)).affected)
prøv('atleten ændrer noten', false, (await som('authenticated', U1, `update public.coach_week_videos set note = 'x' where id = '${V1}'`)).ok)
prøv('atleten markerer sin video set (rækker ændret)', 1, (await som('authenticated', U1, `update public.coach_week_videos set athlete_seen_at = now() where id = '${V1}'`)).affected)
prøv('coachen ser "set" (athlete_seen_at udfyldt)', true, (await som('authenticated', C1, `select athlete_seen_at from public.coach_week_videos where id = '${V1}'`)).rows?.[0]?.athlete_seen_at != null)
prøv('atleten sletter sin video (rækker ændret)', 0, (await som('authenticated', U1, `delete from public.coach_week_videos where id = '${V1}'`)).affected)
prøv('mandag kræves (tirsdag afvises)', false, (await som('authenticated', C1, `insert into public.coach_week_videos (athlete_id, week_start, video_path) values ('${A1}', '2026-11-24', '${A1}/12345678-1234-4234-8234-123456789012.mp4')`)).ok)
prøv('sti i en anden atlets mappe afvises', false, (await som('authenticated', C1, `insert into public.coach_week_videos (athlete_id, week_start, video_path) values ('${A1}', '2026-11-23', '${A2}/12345678-1234-4234-8234-123456789012.mp4')`)).ok)
prøv('coach sætter en anden coachs coach_id på egen atlets video', false, (await som('authenticated', C1, `insert into public.coach_week_videos (athlete_id, coach_id, week_start, video_path) values ('${A1}', '${C2}', '2026-11-23', '${A1}/12345678-1234-4234-8234-123456789013.mp4')`)).ok)
prøv('atleten flytter sin video til en anden atlet', false, (await som('authenticated', U1, `update public.coach_week_videos set athlete_id = '${A2}' where id = '${V1}'`)).ok)
// Lageret
const obj = a => `insert into storage.objects (bucket_id, name) values ('videocoach-uploads', '${a}/${V1}.mp4')`
prøv('coach lægger klip i egen atlets mappe', true, (await som('authenticated', C1, obj(A1))).ok)
prøv('coach lægger klip i fremmed atlets mappe', false, (await som('authenticated', C1, obj(A2))).ok)
prøv('atleten læser klippet i sin mappe (antal)', 1, (await som('authenticated', U1, `select name from storage.objects where name like '${A1}/%'`)).rows?.length)
prøv('fremmed atlet læser klippet (antal)', 0, (await som('authenticated', U2, `select name from storage.objects where name like '${A1}/%'`)).rows?.length)
prøv('fremmed coach læser klippet (antal)', 0, (await som('authenticated', C2, `select name from storage.objects where name like '${A1}/%'`)).rows?.length)
// Rollback
await db.exec(readFileSync(process.argv[2].replace('_DRAFT.sql', '_DRAFT_ROLLBACK.sql'), 'utf8'))
prøv('rollback fjerner tabellen', null, (await db.query(`select to_regclass('public.coach_week_videos') as t`)).rows[0].t)

for (const r of resultater) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.navn}: forventet ${r.forventet}, fik ${r.faktisk}`)
const fejl = resultater.filter(r => !r.pass).length
console.log(`${resultater.length - fejl} af ${resultater.length} PASS`)
process.exit(fejl ? 1 : 0)

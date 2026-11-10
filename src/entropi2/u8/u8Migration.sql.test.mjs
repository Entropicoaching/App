// U8 del 1: migrationspakke D (push) og tilbagerulningen, kørt mod en tom PGlite i hukommelsen.
// Som i U7 (u7Migration.sql.test.mjs): kun syntetiske id'er, ingen nøgler, intet net, og
// prøven springer aldrig over. Supabase giver som standard anon og authenticated alle rettigheder
// på nye tabeller i public; det efterlignes her, så prøven også viser, at udkastet fjerner dem.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const directory = new URL('../../../supabase/sql/udkast/', import.meta.url)
const read = name => readFileSync(new URL(name, directory), 'utf8').replace(/\r\n/g, '\n')
const up = read('20261111120000_u8_push_D_DRAFT.sql')
const down = read('20261111120000_u8_push_D_DRAFT_ROLLBACK.sql')
const ids = Array.from({ length: 4 }, (_, i) => `20000000-0000-4000-8000-0000000008${String(i + 1).padStart(2, '0')}`)
const [user1, user2] = ids
const TABLES = ['push_log_v1', 'push_preferences_v1', 'push_subscriptions_v1']
const p256dh = 'B' + 'a'.repeat(86)
const auth = 'c'.repeat(22)
const reject = (promise, code) => assert.rejects(promise, { code })

test('U8 SQL: én transaktion hver, ingen cascade, omvendt rækkefølge, ingen eksisterende tabel nævnt', () => {
  assert.equal((up.match(/^begin;$/gm) || []).length, 1)
  assert.equal((down.match(/^begin;$/gm) || []).length, 1)
  assert.doesNotMatch(down.replace(/--[^\n]*/g, ''), /\bcascade\b/i)
  const at = name => down.indexOf(`drop table public.${name};`)
  assert.ok(at('push_log_v1') < at('push_preferences_v1') && at('push_preferences_v1') < at('push_subscriptions_v1'))
  const code = up.replace(/--[^\n]*/g, '')
  const named = [...code.matchAll(/public\.([a-z_0-9]+)/g)].map(m => m[1])
  assert.deepEqual([...new Set(named)].sort(), TABLES)
})

test('U8 SQL mod PGlite: kun egen række, grænser, log kun for service_role, op/ned/op', { timeout: 120000 }, async t => {
  let PGlite
  try { ({ PGlite } = await import('@electric-sql/pglite')) }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    assert.fail('PGlite mangler; prøven må ikke springes over.')
  }
  async function fixture(run, { migrate = true } = {}) {
    const db = new PGlite()
    const query = (sql, args = []) => db.query(sql, args)
    const as = async (uid, role = 'authenticated') => {
      await db.exec('reset role')
      await query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ''])
      await db.exec(`set role ${role}`)
    }
    const tables = async () => (await query(`select relname from pg_class
      where relnamespace='public'::regnamespace and relkind='r' order by relname`)).rows.map(r => r.relname)
    try {
      await db.exec(`create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
        create schema auth;
        create function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema public, auth to authenticated, anon, service_role;
        grant execute on function auth.uid() to authenticated, anon, service_role;
        alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
        alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;`)
      if (migrate) await db.exec(up)
      await run({ db, query, as, tables })
    } finally { await db.close() }
  }
  const subscribe = (query, endpoint = 'https://push.example.test/abc') =>
    query('insert into public.push_subscriptions_v1 (endpoint, p256dh, auth, user_agent) values ($1,$2,$3,$4) returning user_id',
      [endpoint, p256dh, auth, 'syntetisk'])

  await t.test('push-adresse: user_id er altid den indloggede, andre ser og ændrer intet', () => fixture(async ({ query, as }) => {
    await as(user1)
    assert.equal((await subscribe(query)).rows[0].user_id, user1)
    await reject(query(`insert into public.push_subscriptions_v1 (user_id, endpoint, p256dh, auth) values ($1,'https://x.test/1',$2,$3)`,
      [user2, p256dh, auth]), '42501')
    // Samme telefon kan bære en anden bruger.
    await as(user2)
    await subscribe(query)
    assert.equal((await query('select * from public.push_subscriptions_v1')).rows.length, 1)
    assert.equal((await query(`update public.push_subscriptions_v1 set auth=$1 where user_id=$2`, ['d'.repeat(22), user1])).affectedRows, 0)
    assert.equal((await query(`delete from public.push_subscriptions_v1 where user_id=$1`, [user1])).affectedRows, 0)
    await reject(query(`update public.push_subscriptions_v1 set user_id=$1`, [user1]), '42501')
    // Upsert som PostgREST gør det for appen (merge-duplicates sætter alle sendte kolonner):
    // samme endpoint giver én række med de nye nøgler.
    await as(user1)
    await query(`insert into public.push_subscriptions_v1 (endpoint, p256dh, auth, user_agent) values ('https://push.example.test/abc',$1,$2,'ny')
      on conflict (user_id, endpoint) do update set endpoint=excluded.endpoint, p256dh=excluded.p256dh, auth=excluded.auth,
      user_agent=excluded.user_agent`, [p256dh, 'e'.repeat(22)])
    assert.deepEqual((await query('select auth from public.push_subscriptions_v1')).rows, [{ auth: 'e'.repeat(22) }])
    await as(null, 'anon')
    await reject(query('select * from public.push_subscriptions_v1'), '42501')
    await reject(subscribe(query), '42501')
    await as(null, 'service_role')
    assert.equal((await query('select * from public.push_subscriptions_v1')).rows.length, 2)
  }))

  await t.test('push-adresse: kun https, gyldige nøgler, kort user_agent', () => fixture(async ({ query, as }) => {
    await as(user1)
    await reject(subscribe(query, 'http://push.example.test/abc'), '23514')
    await reject(subscribe(query, 'https://push example'), '23514')
    await reject(query(`insert into public.push_subscriptions_v1 (endpoint, p256dh, auth) values ('https://x.test/2','kort',$1)`, [auth]), '23514')
    await reject(query(`insert into public.push_subscriptions_v1 (endpoint, p256dh, auth) values ('https://x.test/3',$1,'kort')`, [p256dh]), '23514')
    await reject(query(`insert into public.push_subscriptions_v1 (endpoint, p256dh, auth, user_agent) values ('https://x.test/4',$1,$2,$3)`,
      [p256dh, auth, 'u'.repeat(301)]), '23514')
    await reject(query(`insert into public.push_subscriptions_v1 (endpoint, p256dh, auth) values ($1,$2,$3)`,
      ['https://x.test/' + 'a'.repeat(990), p256dh, auth]), '23514')
  }))

  await t.test('tidspunkt: egen række, kvarter mellem 06 og 22, standard 19:00 og begge til', () => fixture(async ({ query, as }) => {
    await as(user1)
    await query('insert into public.push_preferences_v1 default values')
    assert.deepEqual((await query(`select user_id, remind_at::text, reminders_on, replies_on from public.push_preferences_v1`)).rows,
      [{ user_id: user1, remind_at: '19:00:00', reminders_on: true, replies_on: true }])
    for (const bad of ['05:45', '22:15', '07:10', '07:00:30']) await reject(query('update public.push_preferences_v1 set remind_at=$1', [bad]), '23514')
    await query(`update public.push_preferences_v1 set remind_at='06:00', reminders_on=false`)
    await query(`update public.push_preferences_v1 set remind_at='22:00'`)
    await query(`insert into public.push_preferences_v1 (remind_at, reminders_on, replies_on) values ('07:30', true, false)
      on conflict (user_id) do update set remind_at=excluded.remind_at, reminders_on=excluded.reminders_on, replies_on=excluded.replies_on`)
    assert.deepEqual((await query(`select remind_at::text, replies_on from public.push_preferences_v1`)).rows,
      [{ remind_at: '07:30:00', replies_on: false }])
    await reject(query(`insert into public.push_preferences_v1 (user_id) values ($1)`, [user2]), '42501')
    await as(user2)
    assert.equal((await query('select * from public.push_preferences_v1')).rows.length, 0)
    assert.equal((await query(`update public.push_preferences_v1 set replies_on=false`)).affectedRows, 0)
    await as(null, 'anon')
    await reject(query('select * from public.push_preferences_v1'), '42501')
  }))

  await t.test('afsendelseslog: kun service_role, én række pr. bruger, art og reference', () => fixture(async ({ query, as }) => {
    for (const uid of [user1, user2]) {
      await as(uid)
      await reject(query('select * from public.push_log_v1'), '42501')
      await reject(query(`insert into public.push_log_v1 (user_id, kind, ref) values ($1,'reminder','2026-11-11')`, [uid]), '42501')
    }
    await as(null, 'anon')
    await reject(query('select * from public.push_log_v1'), '42501')
    await as(null, 'service_role')
    const first = await query(`insert into public.push_log_v1 (user_id, kind, ref) values ($1,'reminder','2026-11-11')
      on conflict do nothing returning id`, [user1])
    const again = await query(`insert into public.push_log_v1 (user_id, kind, ref) values ($1,'reminder','2026-11-11')
      on conflict do nothing returning id`, [user1])
    assert.equal(first.rows.length, 1)
    assert.equal(again.rows.length, 0)
    await reject(query(`insert into public.push_log_v1 (user_id, kind, ref) values ($1,'andet','x')`, [user1]), '23514')
  }))

  await t.test('op, ned, op: tilbage til tom, og igen uden fejl; fejl midt i ned ruller alt tilbage', () => fixture(async ({ db, query, tables }) => {
    assert.deepEqual(await tables(), [])
    await db.exec(up)
    assert.deepEqual(await tables(), TABLES)
    await db.exec(down)
    assert.deepEqual(await tables(), [])
    assert.equal((await query(`select count(*)::int n from pg_policy`)).rows[0].n, 0)
    await db.exec(up)
    assert.deepEqual(await tables(), TABLES)
    // En uventet afhængighed standser tilbagerulningen, og intet er væk.
    await db.exec('create view public.afhaengig as select user_id from public.push_preferences_v1')
    await assert.rejects(db.exec(down))
    await db.exec('rollback')
    assert.deepEqual(await tables(), TABLES)
  }, { migrate: false }))
})

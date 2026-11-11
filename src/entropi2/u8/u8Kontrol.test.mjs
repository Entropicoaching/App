import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readPushSetup } from './pushData.mjs'
import { newestPerEndpoint } from '../../../supabase/functions-udkast/u8-push/plan.mjs'
import { runSend } from '../../../supabase/functions-udkast/u8-push/handler.mjs'

// U8 kontrol: rettelser efter den separate kontrol. Kun syntetiske data.
const sql = name => readFileSync(new URL(`../../../supabase/sql/udkast/${name}`, import.meta.url), 'utf8')
const UP = sql('20261111120000_u8_push_D_DRAFT.sql')
const A = '20000000-0000-4000-8000-000000000a01', B = '20000000-0000-4000-8000-000000000b01'
const KEYS = ['B' + 'a'.repeat(86), 'c'.repeat(22)]

async function pglite(run, { serviceDefaults = false } = {}) {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite()
  const query = (text, args = []) => db.query(text, args)
  const as = async (uid, role = 'authenticated') => {
    await db.exec('reset role')
    await query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ''])
    await db.exec(`set role ${role}`)
  }
  try {
    await db.exec(`create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated, anon, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated${serviceDefaults ? ', service_role' : ''};`)
    await query('insert into auth.users values ($1), ($2)', [A, B])
    await db.exec(UP)
    await run({ db, query, as })
  } finally { await db.close() }
}

test('U8 kontrol 1: delt telefon; den der sidst slog til, får beskederne, også når A slår til igen', { timeout: 60000 }, () => pglite(async ({ query, as }) => {
  // Præcis det, appen gør: slet egen række for telefonen, og indsæt en ny.
  const enable = async uid => {
    await as(uid)
    await query('delete from public.push_subscriptions_v1 where endpoint = $1', ['https://push.example.test/delt'])
    await query('insert into public.push_subscriptions_v1 (endpoint, p256dh, auth) values ($1, $2, $3)', ['https://push.example.test/delt', ...KEYS])
  }
  const newest = async () => {
    await as(null, 'service_role')
    const rows = (await query('select user_id, endpoint, created_at from public.push_subscriptions_v1')).rows
      .map(r => ({ ...r, created_at: r.created_at.toISOString() }))
    return newestPerEndpoint(rows).map(r => r.user_id)
  }
  await enable(A)
  await new Promise(r => setTimeout(r, 5))
  await enable(B)
  assert.deepEqual(await newest(), [B])
  await new Promise(r => setTimeout(r, 5))
  await enable(A)
  assert.deepEqual(await newest(), [A])
}))

test('U8 kontrol 1: kortet viser "slå til", når en anden sidst slog til på telefonen', async () => {
  let React, act, createRoot, hostFixture, tick
  try {
    React = await import('react'); ({ act } = React)
    ;({ createRoot } = await import('react-dom/client'))
    ;({ hostFixture, tick } = await import('../nutrition/diaryTemplate.fixture.mjs'))
  } catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return; throw error }
  const { default: PushCard } = await import('./PushCard.mjs')
  const endpoint = 'https://push.example.test/delt'
  const client = { functions: { invoke: async () => ({ data: { publicKey: 'B' + 'A'.repeat(86) }, error: null }) },
    from: table => { const b = { select: () => b, limit: () => b,
      then: (ok, no) => Promise.resolve({ data: table === 'push_subscriptions_v1' ? [{ endpoint }] : [], error: null }).then(ok, no) }; return b } }
  const registration = { pushManager: { getSubscription: async () => ({ endpoint }) } }
  const env = { navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0', serviceWorker: {} }, hasPushManager: true,
    notification: { permission: 'granted' }, registration }
  for (const [owner, expected] of [['atlet-b', /Slå påmindelser til/], ['atlet-a', /Påmindelse kl\. 19\.00, hvis noget mangler/]]) {
    const store = new Map([['entropi-u8-push-ejer', owner]])
    const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }
    const dom = hostFixture(), root = createRoot(dom.host)
    await act(async () => { root.render(React.createElement(PushCard, { athleteId: 'atlet-a', client, env, storage })); for (let i = 0; i < 12; i++) await tick() })
    assert.match(dom.host.textContent, expected)
    await act(async () => { root.unmount(); await tick() })
    dom.restore()
  }
})

// Syntetisk database til runSend: kun de kald, funktionen laver.
function fakeDb({ failMessages = false } = {}) {
  const log = [], calls = []
  const db = async (path, { method = 'GET', body } = {}) => {
    calls.push(`${method} ${path.split('?')[0]}`)
    const table = path.split('?')[0]
    if (table === 'push_subscriptions_v1' && method === 'GET') return [{ user_id: A, endpoint: 'https://push.example.test/a', p256dh: KEYS[0], auth: KEYS[1], created_at: '2026-11-10T10:00:00Z' }]
    if (table === 'push_preferences_v1') return [{ user_id: A, remind_at: '19:00:00', reminders_on: true, replies_on: true }]
    if (table === 'athletes') return [{ id: 'a', user_id: A }]
    if (['weight_logs', 'readiness_logs', 'meal_logs'].includes(table)) return []
    if (table === 'messages') { if (failMessages) throw Error('GET messages: 500'); return [] }
    if (table === 'push_log_v1' && method === 'POST') {
      const fresh = body.filter(r => !log.some(l => l.user_id === r.user_id && l.kind === r.kind && l.ref === r.ref))
      log.push(...fresh)
      return fresh
    }
    if (table === 'push_log_v1' && method === 'DELETE') {
      const ref = decodeURIComponent(/ref=in\.\("([^"]+)"\)/.exec(path)[1])
      log.splice(0, log.length, ...log.filter(l => l.ref !== ref))
      return null
    }
    throw Error(`uventet ${method} ${path}`)
  }
  return { db, log, calls }
}
const AT = new Date('2026-11-11T18:02:00Z')

test('U8 kontrol 2: fejler opslaget af coachsvar, er dagens påmindelse allerede sendt og markeret', async () => {
  const f = fakeDb({ failMessages: true }), sent = []
  await assert.rejects(runSend({ db: f.db, now: AT, send: async (s, payload, ttl) => { sent.push({ payload: JSON.parse(payload), ttl }); return { status: 201 } } }))
  assert.equal(sent.length, 1)
  assert.equal(sent[0].payload.tag, 'paamindelse')
  assert.equal(sent[0].ttl, (24 * 60 - (19 * 60 + 2)) * 60)
  assert.deepEqual(f.log.map(l => [l.kind, l.ref]), [['reminder', '2026-11-11']])
})

test('U8 kontrol 2: når ingen telefon fik påmindelsen, fjernes markeringen, og næste kørsel sender den', async () => {
  const f = fakeDb()
  const down = async () => ({ status: 503, gone: false })
  assert.deepEqual(await runSend({ db: f.db, now: AT, send: down }), { reminders: 1, replies: 0, sent: 0, removed: 0, failed: 1 })
  assert.deepEqual(f.log, [])
  const thrown = async () => { throw Error('net') }
  await runSend({ db: f.db, now: AT, send: thrown })
  assert.deepEqual(f.log, [])
  const up = async () => ({ status: 201 })
  assert.deepEqual(await runSend({ db: f.db, now: new Date(AT.getTime() + 300000), send: up }), { reminders: 1, replies: 0, sent: 1, removed: 0, failed: 0 })
  assert.deepEqual(f.log.map(l => l.ref), ['2026-11-11'])
  // Afmeldt telefon (410) er ikke en fejl, der skal prøves igen.
  const gone = fakeDb()
  gone.calls.length = 0
  const g = await runSend({ db: async (path, opts) => path.startsWith('push_subscriptions_v1?user_id') ? null : gone.db(path, opts), now: AT,
    send: async () => ({ status: 410, gone: true }) })
  assert.deepEqual(g, { reminders: 1, replies: 0, sent: 0, removed: 1, failed: 0 })
  assert.equal(gone.log.length, 1)
})

test('U8 kontrol 5: en manglende opsætning huskes; forsiden spørger ikke igen', async () => {
  let calls = 0
  const client = { from: () => { calls++; const b = { select: () => b, limit: () => b,
    then: (ok, no) => Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }).then(ok, no) }; return b } }
  assert.deepEqual(await readPushSetup({ client }), { status: 'missing' })
  assert.deepEqual(await readPushSetup({ client }), { status: 'missing' })
  assert.equal(calls, 1)
})

test('U8 kontrol 8: rækkerne følger brugeren (on delete cascade), og service_role har egne rettigheder', { timeout: 60000 }, () => pglite(async ({ query, as }) => {
  await as(A)
  await query('insert into public.push_subscriptions_v1 (endpoint, p256dh, auth) values ($1, $2, $3)', ['https://push.example.test/a', ...KEYS])
  await query('insert into public.push_preferences_v1 default values')
  await as(null, 'service_role')
  for (const [table, rights] of [['push_subscriptions_v1', ['select', 'insert', 'update', 'delete']],
    ['push_preferences_v1', ['select', 'insert', 'update', 'delete']], ['push_log_v1', ['select', 'insert', 'delete']]])
    for (const right of rights)
      assert.equal((await query('select has_table_privilege($1, $2) ok', [`public.${table}`, right])).rows[0].ok, true, `${table} ${right}`)
  await query(`insert into public.push_log_v1 (user_id, kind, ref) values ($1, 'reminder', '2026-11-11')`, [A])
  await query('reset role')
  await query('delete from auth.users where id = $1', [A])
  for (const table of ['push_subscriptions_v1', 'push_preferences_v1', 'push_log_v1'])
    assert.equal((await query(`select count(*)::int n from public.${table}`)).rows[0].n, 0, table)
}))

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { DEFAULT_U8_PUSH, DEFAULT_U8_SEND, u8Enabled } from './flag.mjs'
import { UDGIVELSE_TRIN } from '../../udgivelseTrin.mjs'

// U8 4/4: begge dele er tændt. Rollback er én linje pr. del i flag.mjs.
const root = new URL('../../../', import.meta.url)

test('U8 4/4: push og afsendelse er tændt, og et eksplicit false slukker hver del', () => {
  assert.deepEqual([DEFAULT_U8_PUSH, DEFAULT_U8_SEND], [true, true])
  for (const part of ['push', 'send']) {
    assert.equal(u8Enabled(part), true)
    assert.equal(u8Enabled(part, false), false)
  }
})

test('U8 4/4: UDGIVELSE_TRIN er uændret; migrationen og funktionen ligger kun som udkast; ingen ny afhængighed', () => {
  assert.equal(UDGIVELSE_TRIN, 0)
  assert.equal(existsSync(new URL('supabase/migrations/20261111120000_u8_push_D_DRAFT.sql', root)), false)
  assert.equal(existsSync(new URL('supabase/functions/u8-push', root)), false)
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  assert.equal(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(name => /push|vapid/i.test(name)), false)
  // Den samlede fil har flaget tændt ligesom kilden.
  const bundle = readFileSync(new URL('supabase/functions-udkast/u8-push/u8-push.bundle.js', root), 'utf8')
  // (Rolldown sætter flagets værdi direkte ind i defaults.)
  assert.match(bundle.replace(/\r\n/g, '\n'), /var defaults = \(\) => \(\{\n\tpush: true,\n\tsend: true\n/)
})

// Fund i den headless kørsel: efter "Slå påmindelser til" lå bekræftelsen inde i den foldede
// linje og kunne ikke ses. Beskeden skal stå uden for det, der foldes.
let React, act, createRoot, hostFixture, tick, propsOf, missingReact = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
  ;({ hostFixture, tick, propsOf } = await import('../nutrition/diaryTemplate.fixture.mjs'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  missingReact = true
}

test('U8 4/4: bekræftelsen efter tilmelding ses uden at folde linjen ud', { skip: missingReact ? 'Kræver ægte React.' : false }, async () => {
  const { default: PushCard } = await import('./PushCard.mjs')
  const key = 'B' + 'A'.repeat(86)
  const db = { push_subscriptions_v1: [], push_preferences_v1: [] }
  const client = {
    functions: { invoke: async () => ({ data: { publicKey: key }, error: null }) },
    from: table => {
      const b = { select: () => b, limit: () => b, eq: () => b,
        upsert: row => { db[table].push(row); return b }, delete: () => b,
        then: (resolve, reject) => Promise.resolve({ data: db[table].map(r => ({ ...r })), error: null }).then(resolve, reject) }
      return b
    },
  }
  let current = null
  const notification = { permission: 'granted', requestPermission: async () => 'granted' }
  const registration = { pushManager: { getSubscription: async () => current,
    subscribe: async () => (current = { endpoint: 'https://push.example.test/u8on', options: { applicationServerKey: null },
      toJSON: () => ({ endpoint: 'https://push.example.test/u8on', keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) } }) }) } }
  const env = { navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile', serviceWorker: {} }, hasPushManager: true, notification, registration }
  const dom = hostFixture(), root = createRoot(dom.host)
  const settle = async () => { for (let i = 0; i < 12; i++) await tick() }
  await act(async () => { root.render(React.createElement(PushCard, { athleteId: 'a1', client, env })); await settle() })
  const button = [...dom.host.querySelectorAll('button')].find(el => el.textContent === 'Slå påmindelser til')
  await act(async () => { propsOf(button).onClick({ preventDefault() {} }); await settle() })
  const status = [...dom.host.querySelectorAll('p')].find(el => el.getAttribute('role') === 'status')
  assert.match(status.textContent, /^Påmindelser er slået til/)
  let folded = false
  for (let el = status.parentNode; el && el !== dom.host; el = el.parentNode) if (el.tagName?.toLowerCase() === 'details') folded = true
  assert.equal(folded, false)
  await act(async () => { root.unmount(); await tick() })
  dom.restore()
})

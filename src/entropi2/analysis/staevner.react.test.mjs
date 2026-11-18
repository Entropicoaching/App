// Ordre 1705: atleten ser sine stævneresultater i Udvikling i Entropi 2.
// Ægte React og ægte Analysis; kun DOM og klienten er syntetiske.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import Analysis from './Analysis.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'

const meet = (meet_date, meet_name, squat, bench, deadlift, total, extra = {}) =>
  ({ athlete_id: 'synthetic-s', meet_date, meet_name, squat, bench, deadlift, total,
    bodyweight: 82.4, notes: 'Syntetisk note', meet_type: 'sbd', ...extra })
const meetsS = [
  meet('2026-03-14', 'Syntetisk forårsstævne', 180, 120, 220, 520),
  meet('2026-09-20', 'Syntetisk efterårsstævne', 185.5, 122.5, 230, 538),
]
const flush = () => new Promise(resolve => setImmediate(resolve))

// Syntetisk klient: fører log over hvert kald og filtrerer som PostgREST på eq, order og limit.
function syntheticClient(tables = {}) {
  const calls = []
  const client = {
    from(table) {
      const call = { table, select: null, eq: [], order: null, limit: null, writes: [] }
      calls.push(call)
      const query = {
        select(fields) { call.select = fields; return query },
        eq(col, value) { call.eq.push([col, value]); return query },
        gte() { return query }, lte() { return query }, in() { return query },
        order(col, opts) { call.order = [col, opts]; return query },
        limit(n) { call.limit = n; return query },
        range() { return query },
        insert(v) { call.writes.push(['insert', v]); return query },
        update(v) { call.writes.push(['update', v]); return query },
        upsert(v) { call.writes.push(['upsert', v]); return query },
        delete() { call.writes.push(['delete']); return query },
        then(resolve, reject) {
          let rows = (tables[table] ?? []).filter(row => call.eq.every(([col, value]) => row[col] === value))
          if (call.order) {
            const [col, opts] = call.order
            rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (opts?.ascending === false ? -1 : 1))
          }
          if (call.limit != null) rows = rows.slice(0, call.limit)
          const fields = call.select && call.select !== '*' ? call.select.split(',').map(s => s.trim()) : null
          const data = fields ? rows.map(row => Object.fromEntries(fields.map(f => [f, row[f]]))) : rows
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return { client, calls }
}

async function mount(props) {
  const doc = sessionReactDocument()
  const host = doc.createElement('div'); doc.body.append(host)
  const globals = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true }
  const prior = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  await act(async () => { root.render(h(Analysis, props)); await flush(); await flush() })
  const done = async () => {
    await act(async () => root.unmount())
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
    }
  }
  return { host, done }
}

const base = athleteId => ({ entropi2: true, now: '2026-11-18T12:00:00Z',
  athlete: { id: athleteId, competition_date: null }, fremgangLogs: [], exerciseLogs: [] })

test('Atlet S med 2 stævner ser "Stævner" med dato, navn, total og tre løft, nyeste først', async () => {
  const other = meet('2026-10-01', 'Andens stævne', 300, 200, 300, 800, { athlete_id: 'synthetic-other' })
  const { client, calls } = syntheticClient({ meet_results: [...meetsS, other] })
  const { host, done } = await mount({ ...base('synthetic-s'), u3Client: client })
  try {
    const list = host.querySelector('[data-analysis-meets]')
    assert.ok(list, 'Stævner vises')
    assert.equal(list.querySelector('h2').textContent, 'Stævner')
    const items = Array.from(list.querySelectorAll('li'))
    assert.equal(items.length, 2)
    assert.match(items[0].textContent, /20\.09\.2026/)
    assert.match(items[0].textContent, /Syntetisk efterårsstævne/)
    assert.match(items[0].textContent, /Total 538 kg/)
    assert.match(items[0].textContent, /Squat 185,5 kg/)
    assert.match(items[0].textContent, /Bænkpres 122,5 kg/)
    assert.match(items[0].textContent, /Dødløft 230 kg/)
    assert.match(items[1].textContent, /14\.03\.2026/)
    assert.match(items[1].textContent, /Syntetisk forårsstævne/)
    assert.doesNotMatch(list.textContent, /Andens stævne|82,4|Syntetisk note/)
    const reads = calls.filter(call => call.table === 'meet_results')
    assert.equal(reads.length, 1)
    assert.deepEqual(reads[0].eq, [['athlete_id', 'synthetic-s']])
    assert.deepEqual(reads[0].select.split(',').map(s => s.trim()).sort(),
      ['bench', 'deadlift', 'meet_date', 'meet_name', 'squat', 'total'])
    assert.deepEqual(reads[0].order, ['meet_date', { ascending: false }])
    assert.equal(reads[0].limit, 5)
    assert.deepEqual(calls.flatMap(call => call.writes), [])
  } finally { await done() }
})

test('højst 5 stævner, og et løft uden tal vises ikke som 0', async () => {
  const many = Array.from({ length: 7 }, (_, i) =>
    meet(`2026-0${i + 1}-10`, `Syntetisk stævne ${i + 1}`, i === 6 ? null : 150, 100, 200, i === 6 ? 300 : 450))
  const { client } = syntheticClient({ meet_results: many })
  const { host, done } = await mount({ ...base('synthetic-s'), u3Client: client })
  try {
    const items = Array.from(host.querySelectorAll('[data-analysis-meets] li'))
    assert.equal(items.length, 5)
    assert.match(items[0].textContent, /Syntetisk stævne 7/)
    assert.doesNotMatch(items[0].textContent, /Squat/)
    assert.match(items[4].textContent, /Syntetisk stævne 3/)
  } finally { await done() }
})

test('Atlet T uden stævner ser intet, heller ikke en tom overskrift', async () => {
  const { client } = syntheticClient({ meet_results: meetsS })
  const { host, done } = await mount({ ...base('synthetic-t'), u3Client: client })
  try {
    assert.equal(host.querySelector('[data-analysis-meets]'), null)
    assert.doesNotMatch(host.textContent, /Stævner/)
  } finally { await done() }
})

test('med U3-flaget slukket sker ingen læsning og intet vises', async () => {
  const { client, calls } = syntheticClient({ meet_results: meetsS })
  const { host, done } = await mount({ ...base('synthetic-s'), u3Client: client, u3Data: false })
  try {
    assert.equal(host.querySelector('[data-analysis-meets]'), null)
    assert.equal(calls.filter(call => call.table === 'meet_results').length, 0)
  } finally { await done() }
})

test('fejl i læsningen og manglende klient viser intet', async () => {
  const failing = { from: () => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q,
    then: (resolve, reject) => Promise.resolve({ data: null, error: { message: 'syntetisk fejl' } }).then(resolve, reject) }; return q } }
  for (const props of [{ u3Client: failing }, {}]) {
    const { host, done } = await mount({ ...base('synthetic-s'), ...props })
    try { assert.equal(host.querySelector('[data-analysis-meets]'), null) } finally { await done() }
  }
})

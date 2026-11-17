// Ordre 1547: sætlæsningen til stilstand henter kun løftet og perioden, reglen bruger, og samme svar
// som før (ordre 1545: alle tunge eller sprungne sæt i 26 uger). Ordre 1562: side for side fra de nyeste,
// uden tavst loft. Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../calendarDate.js'
import { readCoachAttention, attentionFor, STILSTAND_DAGE, STILSTAND_GEM_MS, STILSTAND_SIDE, STILSTAND_SIDER, stilstandKortDage } from './coachAttentionRead.mjs'
import { stagnationReason } from './coachAttention.mjs'

const day = '2026-11-16'
const A = 'syn-atlet'
const DAY = 86400000
const monday0 = Date.parse(`${day}T00:00:00Z`) - 25 * 7 * DAY

// 26 uger, 2 pas om ugen (3 i den travle prøve): squat 5x5, bænk 5x5, dødløft 3x3, backoff, roning 3x10 (over 8 reps).
// tops[w] er squattens vægt i uge w (0..25); null = ingen squat den uge (ferie).
function athleteLogs(tops, extra = () => [], pas = 2) {
  const rows = []
  for (let w = 0; w < 26; w++) {
    for (let p = 0; p < pas; p++) {
      const at = new Date(monday0 + w * 7 * DAY + p * 2 * DAY + 10 * 3600000).toISOString()
      const sets = [['Bænkpres', 80, 5, 5], ['Dødløft', 160, 3, 3], ['Squat backoff', 100, 6, 3], ['Roning', 50, 10, 3]]
      if (tops[w] != null) sets.unshift(['Squat', tops[w], 5, 5])
      for (const [name, weight, reps, n] of sets) {
        for (let s = 0; s < n; s++) rows.push(row(at, name, weight, reps, w))
      }
      for (const [name, weight, reps, skipped] of extra(w, p)) rows.push(row(at, name, weight, reps, w, skipped))
    }
  }
  return rows
}
let nextId = 0
function row(at, name, weight, reps, w, skipped = false) {
  return { id: ++nextId, athlete_id: A, logged_at: at, weight, reps_completed: skipped ? null : reps, skipped,
    exercises: { name, session_id: `syn-pas-${at}`, sessions: { weeks: { week_number: w + 1, block_name: 'Opbygning' } } } }
}

// ILIKE som i en database, der kun folder ASCII: Æ og æ er forskellige tegn; * er %, _ er ét tegn.
const asciiLower = text => String(text ?? '').replace(/[A-Z]/g, c => c.toLowerCase())
const ilike = (pattern, value) => new RegExp(`^${asciiLower(pattern).split('*').map(part => part.split('_').map(t => t.replace(/[.+?^$()|[\]{}\\]/g, '\\$&')).join('.')).join('.*')}$`).test(asciiLower(value))
// Lille PostgREST-lignende falsk klient: eq, gte, or (også på exercises), !inner, order, range, limit. Tæller rækker pr. kald.
function fakeClient(logs, { rpcRows, failNameFilter = false } = {}) {
  const calls = [], rpcCalls = []
  const match = (r, cond) => {
    const [col, op, ...rest] = cond.split('.'); const val = rest.join('.')
    const v = r?.[col]
    if (op === 'eq') return String(v) === val
    if (op === 'lte') return v != null && Number(v) <= Number(val)
    if (op === 'ilike') return ilike(val, v)
    throw new Error(`ukendt op ${op}`)
  }
  return {
    calls, rpcCalls,
    rpc: async name => { rpcCalls.push(name); return { data: rpcRows, error: null } },
    from(table) {
      const call = { table, filters: [], inner: false, nameFilter: null, limit: null, range: null, order: [], rows: 0 }
      calls.push(call)
      const b = {
        select(cols) { call.inner = /exercises!inner/.test(cols); return b },
        eq(col, v) { call.filters.push(r => r[col] === v); return b },
        in(col, vs) { call.filters.push(r => vs.includes(r[col])); return b },
        not() { call.filters.push(r => r.note != null); return b },
        gte(col, v) { call.filters.push(r => r[col] >= v); return b },
        or(expr, opts = {}) {
          const conds = expr.split(',')
          if (opts.referencedTable === 'exercises') call.nameFilter = conds
          else { call.stag = true; call.filters.push(r => conds.some(c => match(r, c))) }
          return b
        },
        order(col, { ascending = true } = {}) { call.order.push([col, ascending ? 1 : -1]); return b },
        range(from, to) { call.range = [from, to]; return b },
        limit(n) { call.limit = n; return b },
        then(resolve, reject) {
          if (call.nameFilter && failNameFilter) return Promise.resolve({ data: null, error: { message: 'syntetisk' } }).then(resolve, reject)
          let rows = (table === 'exercise_logs' ? logs : []).filter(r => call.filters.every(f => f(r)))
          if (call.nameFilter) {
            rows = rows.map(r => (call.nameFilter.some(c => match(r.exercises, c)) ? r : { ...r, exercises: null }))
            if (call.inner) rows = rows.filter(r => r.exercises)
          }
          rows = [...rows].sort((x, y) => {
            for (const [col, dir] of call.order) if (x[col] !== y[col]) return (x[col] < y[col] ? -1 : 1) * dir
            return 0
          })
          if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
          if (call.limit != null) rows = rows.slice(0, call.limit)
          call.rows = rows.length
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        },
      }
      return b
    },
  }
}
const signal = stalled => ({ o_athlete_id: A, o_athlete_name: 'Atlet', o_detector: 'stagnation', o_severity: 'alert',
  o_headline: 'Atlet: Squat stået stille', o_detail: 'x', o_metrics: { lift: 'Squat', stalled_weeks: stalled } })

// Før (ordre 1545): alle tunge eller sprungne sæt i 26 uger, uden løftfilter, med loft på 999 rækker.
const LOFT_1545 = 999
const before = logs => {
  const from = `${addCalendarDays(day, -STILSTAND_DAGE)}T00:00:00Z`
  const rows = logs.filter(r => r.athlete_id === A && (r.skipped === true || (r.reps_completed != null && r.reps_completed <= 8)) && r.logged_at >= from)
  return rows.length > LOFT_1545 ? null : rows
}
const setsRead = client => client.calls.filter(c => c.stag)

const RISING = Array.from({ length: 26 }, (_, w) => 100 + w * 2.5)
const scenarios = {
  // Top i uge 23, så 3 uger fladt, et sprunget squatsæt i uge 25.
  spoerg: [RISING.map((v, w) => (w >= 22 ? RISING[22] : v)), (w, p) => (w === 24 && p === 1 ? [['Squat', RISING[22], 5, true]] : [])],
  overvej: [RISING.map((v, w) => (w >= 22 ? RISING[22] : v)), () => []],
  // Ferie i 9 uger mellem toppen og de 3 flade uger: toppen ligger uden for det korte vindue, og 26 uger læses som før.
  ferie: [RISING.map((v, w) => ((w >= 13 && w < 22) || w === 25 ? null : w >= 12 ? RISING[12] : v)), (w, p) => (w === 23 && p === 0 ? [['Squat', RISING[12], 0]] : [])],
}

for (const [navn, [tops, extra]] of Object.entries(scenarios)) {
  test(`samme grund som før og færre rækker: ${navn}`, async () => {
    const logs = athleteLogs(tops, extra)
    const stalled = 3
    const client = fakeClient(logs, { rpcRows: [signal(stalled)] })
    const result = await readCoachAttention(client, [A], day, { daily: false, now: 0 })
    const now = attentionFor(result, A, day).stagnation
    const old = before(logs)
    assert.ok(old, 'før-læsningen ramte ikke loftet')
    assert.deepEqual(stagnationReason(now), stagnationReason({ signal: signal(stalled), logs: old }))
    assert.match(stagnationReason(now).reason, navn === 'overvej' ? /overvej deload/ : /^Spørg atleten først/)
    const reads = setsRead(client)
    const perCall = reads.map(c => c.rows)
    assert.ok(Math.max(...perCall) < old.length, `${perCall} rækker pr. kald mod ${old.length} før`)
    console.log(`TAL ${navn}: før ${old.length} rækker i ét kald, efter ${perCall.join(' + ')} i ${reads.length} kald`)
  })
}

test('fejler navnefilteret, læses uden det, og grunden er den samme', async () => {
  const [tops, extra] = scenarios.spoerg
  const logs = athleteLogs(tops, extra)
  const client = fakeClient(logs, { rpcRows: [signal(3)], failNameFilter: true })
  const result = await readCoachAttention(client, [A], day, { daily: false, now: 0 })
  assert.deepEqual(stagnationReason(attentionFor(result, A, day).stagnation),
    stagnationReason({ signal: signal(3), logs: before(logs) }))
  assert.match(stagnationReason(attentionFor(result, A, day).stagnation).reason, /Spørg atleten først/)
})

test('takten på 60 sekunder kalder ikke RPC og sæt igen før efter 15 minutter', async () => {
  const [tops, extra] = scenarios.spoerg
  const client = fakeClient(athleteLogs(tops, extra), { rpcRows: [signal(3)] })
  const t0 = 1_000_000
  const first = await readCoachAttention(client, [A], day, { daily: false, now: t0 })
  const reads = setsRead(client).length
  const second = await readCoachAttention(client, [A], day, { daily: false, now: t0 + 60_000 })
  assert.equal(client.rpcCalls.length, 1)
  assert.equal(setsRead(client).length, reads)
  assert.deepEqual(second.stagnation, first.stagnation)
  await readCoachAttention(client, [A], day, { daily: false, now: t0 + STILSTAND_GEM_MS })
  assert.equal(client.rpcCalls.length, 2)
  // En anden dag eller andre atleter læses straks.
  await readCoachAttention(client, [A], '2026-11-17', { daily: false, now: t0 + STILSTAND_GEM_MS + 1 })
  assert.equal(client.rpcCalls.length, 3)
})

test('en fejl gemmes ikke', async () => {
  const client = fakeClient([], { rpcRows: [signal(3)] })
  let fail = true
  const rpc = client.rpc
  client.rpc = async name => (fail ? { data: null, error: { message: 'syntetisk' } } : rpc(name))
  await readCoachAttention(client, [A], day, { daily: false, now: 0 })
  fail = false
  const ok = await readCoachAttention(client, [A], day, { daily: false, now: 1000 })
  assert.ok(ok.stagnation?.[A])
})

test('travl atlet: før ramte loftet på 999 rækker, og grunden forsvandt; nu vises den', async () => {
  const [tops, extra] = scenarios.spoerg
  const logs = athleteLogs(tops, extra, 3)
  assert.equal(before(logs), null, 'før: over loftet, ingen saet')
  const client = fakeClient(logs, { rpcRows: [signal(3)] })
  const result = await readCoachAttention(client, [A], day, { daily: false, now: 0 })
  assert.match(stagnationReason(attentionFor(result, A, day).stagnation).reason, /Spørg atleten først \(squat står stille, 1 sprunget sæt i uge 25\)/)
  console.log(`TAL travl: før over loftet (${logs.length} saet i alt), efter ${setsRead(client).map(c => c.rows).join(' + ')} i ${setsRead(client).length} kald`)
})

test('navnefilteret tager alle stavemåder af hovedløftene med, også uden at databasen folder Æ', async () => {
  const { STILSTAND_NAVNE } = await import('./coachAttentionRead.mjs')
  const { liftOf } = await import('../../coachBriefingRules.js')
  const navne = ['Squat', 'BACK SQUAT', 'Topsæt squat', 'Bænkpres', 'BÆNKPRES', 'Baenkpres', 'Bench press', 'Bænkpres - topsæt', 'bænk (comp)',
    'Dødløft', 'DØDLØFT', 'Doedloeft', 'Deadlift', 'DL', 'Dødløft (sumo)', 'Sumo deadlift', 'Konventionel dødløft']
  for (const navn of navne) {
    const lift = liftOf(navn)
    assert.ok(lift, navn)
    assert.ok(STILSTAND_NAVNE[lift].some(m => ilike(`*${m}*`, navn)), `${navn} (${lift}) skal med i filteret`)
  }
})

// Ordre 1562: samme løft, mange sæt. extra lægger `n` ekstra squatsæt i hvert pas på den flade vægt (ingen ny top).
const mangeSquat = (fra, n) => (w, p) => [
  ...(w >= fra ? Array.from({ length: n }, () => ['Squat', RISING[22], 5]) : []),
  ...(w === 24 && p === 1 ? [['Squat', RISING[22], 5, true]] : []),
]
// Hele svaret uden loft: alle løftets tunge eller sprungne sæt i 26 uger (det reglen ville se med ubegrænset læsning).
const fuld = logs => {
  const from = `${addCalendarDays(day, -STILSTAND_DAGE)}T00:00:00Z`
  return logs.filter(r => r.exercises.name === 'Squat' && (r.skipped === true || r.reps_completed <= 8) && r.logged_at >= from)
}

test('over 999 squatsæt i 26 uger: læses side for side, intet tabes, og grunden er "Spørg atleten først"', async () => {
  const [tops] = scenarios.spoerg
  const logs = athleteLogs(tops, mangeSquat(0, 80), 3)
  assert.ok(fuld(logs).length > 999, `${fuld(logs).length} squatsæt`)
  const client = fakeClient(logs, { rpcRows: [signal(3)] })
  const result = await readCoachAttention(client, [A], day, { daily: false, now: 0 })
  const stag = attentionFor(result, A, day).stagnation
  assert.equal(stag.loft, undefined)
  assert.deepEqual(stagnationReason(stag), stagnationReason({ signal: signal(3), logs: fuld(logs) }))
  assert.match(stagnationReason(stag).reason, /^Spørg atleten først \(squat står stille, 1 sprunget sæt i uge 25\)/)
  const reads = setsRead(client)
  assert.ok(reads.length > 1 && reads.every(c => c.range && c.range[1] - c.range[0] + 1 === STILSTAND_SIDE), 'flere sider à STILSTAND_SIDE')
  assert.deepEqual(reads[0].order, [['logged_at', -1], ['id', -1]], 'nyeste først, id som tiebreak')
  console.log(`TAL meget travl: ${fuld(logs).length} squatsæt i 26 uger, læst ${reads.map(c => c.rows).join(' + ')} i ${reads.length} kald`)
})

test('vinduet: kun løftet med stilstand og kun fra det korte vindue, når toppen ligger der', async () => {
  const [tops, extra] = scenarios.spoerg
  const logs = athleteLogs(tops, extra)
  const client = fakeClient(logs, { rpcRows: [signal(3)] })
  const result = await readCoachAttention(client, [A], day, { daily: false, now: 0 })
  const got = attentionFor(result, A, day).stagnation.logs
  const from = `${addCalendarDays(day, -stilstandKortDage(3))}T00:00:00Z`
  assert.ok(got.length > 0)
  assert.ok(got.every(r => /squat/i.test(r.exercises.name)), 'kun squat (navnefilteret)')
  assert.ok(got.every(r => r.logged_at >= from), 'kun fra det korte vindue')
  assert.ok(logs.some(r => r.exercises.name === 'Bænkpres' && r.logged_at >= from), 'bænk fandtes i vinduet, men er filtreret fra')
  assert.deepEqual(got.map(r => r.logged_at), [...got.map(r => r.logged_at)].sort(), 'stigende igen efter læsningen')
})

test('grænsen: STILSTAND_SIDER sider uden toppen giver de nyeste sæt, loft: true og stadig grunden', async () => {
  const [tops] = scenarios.spoerg
  const perUge = Math.ceil((STILSTAND_SIDER * STILSTAND_SIDE) / 3) + 50
  const logs = athleteLogs(tops, mangeSquat(23, Math.ceil(perUge / 2)))
  const client = fakeClient(logs, { rpcRows: [signal(3)] })
  const result = await readCoachAttention(client, [A], day, { daily: false, now: 0 })
  const stag = attentionFor(result, A, day).stagnation
  assert.equal(stag.loft, true, 'loftet er synligt i svaret')
  assert.equal(stag.logs.length, STILSTAND_SIDER * STILSTAND_SIDE)
  assert.equal(setsRead(client).length, STILSTAND_SIDER, 'ikke flere kald end grænsen')
  assert.match(stagnationReason(stag).reason, /^Spørg atleten først \(squat står stille, 1 sprunget sæt i uge 25\)/)
})

test('10 minutter med takten på 60 sekunder: 1 RPC og én sætlæsning (før: 11 af hver)', async () => {
  const [tops, extra] = scenarios.spoerg
  const client = fakeClient(athleteLogs(tops, extra), { rpcRows: [signal(3)] })
  for (let i = 0; i <= 10; i++) await readCoachAttention(client, [A], day, { daily: false, now: 5_000_000 + i * 60_000 })
  assert.equal(client.rpcCalls.length, 1)
  const reads = setsRead(client).length
  assert.equal(reads, 1)
  console.log(`TAL 10 min: ${client.rpcCalls.length} RPC og ${reads} sætlæsning ved 11 opdateringer`)
})

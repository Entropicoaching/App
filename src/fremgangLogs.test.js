import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fremgangLogsQuery, fremgangLogsKronologisk, FREMGANG_LOG_LIMIT, rekordRaekkerQuery } from './fremgangLogs.js'
import { heaviestSetPerWeek } from './exerciseProgress.js'

// Falsk klient der opfører sig som PostgREST: sorterer efter .order(), og
// afskærer til min(.limit(), maxRows) — maxRows er Supabase-projektets
// "Max rows". Optager kaldene, så testen kan se hvad der blev bedt om.
function fakeClient(rows, maxRows = Infinity) {
  const calls = {}
  const builder = {
    from(t) { calls.from = t; return builder },
    select(c) { calls.select = c; return builder },
    eq() { return builder },
    gt() { return builder },
    order(col, { ascending }) { calls.order = { col, ascending }; return builder },
    limit(n) { calls.limit = n; return builder },
    then(resolve) {
      const sorted = [...rows].sort((a, b) => (a.logged_at < b.logged_at ? -1 : 1) * (calls.order.ascending ? 1 : -1))
      resolve({ data: sorted.slice(0, Math.min(calls.limit, maxRows)), error: null })
    },
  }
  return { client: builder, calls }
}

// n sæt, ét pr. dag, med stigende vægt (så den nyeste er den tungeste).
function historik(n) {
  return Array.from({ length: n }, (_, i) => ({
    weight: 60 + i * 0.5, reps_completed: 5, exercises: { name: 'Squat' },
    logged_at: new Date(Date.UTC(2024, 0, 1 + i, 10)).toISOString(),
  }))
}

async function hent(rows, maxRows) {
  const { client, calls } = fakeClient(rows, maxRows)
  const { data } = await fremgangLogsQuery(client, 'atlet-1')
  return { logs: fremgangLogsKronologisk(data), calls }
}

test('fremgangLogsQuery henter faldende med grænsen (F2)', async () => {
  const { calls } = await hent(historik(3))
  assert.deepEqual(calls.order, { col: 'logged_at', ascending: false })
  assert.equal(calls.limit, FREMGANG_LOG_LIMIT)
  assert.equal(calls.from, 'exercise_logs')
})

test('rækkefølgen er kronologisk (ældste først) som før — under grænsen er intet ændret', async () => {
  const rows = historik(50)
  const { logs } = await hent(rows)
  assert.deepEqual(logs.map(l => l.logged_at), rows.map(l => l.logged_at))
})

test('grafen (heaviestSetPerWeek) er uændret ift. den gamle stigende hentning', async () => {
  const rows = historik(120)
  const { logs } = await hent(rows)
  assert.deepEqual(heaviestSetPerWeek(logs), heaviestSetPerWeek(rows))
})

test('rammer Max rows, mister vi de ÆLDSTE sæt — aldrig de nyeste (F2)', async () => {
  const rows = historik(1500)
  const { logs } = await hent(rows, 1000)
  assert.equal(logs.length, 1000)
  assert.equal(logs.at(-1).logged_at, rows.at(-1).logged_at, 'det nyeste sæt skal være med')
  assert.equal(logs[0].logged_at, rows[500].logged_at, 'det er de 500 ældste der falder væk')
  assert.ok(logs.every((l, i) => i === 0 || logs[i - 1].logged_at < l.logged_at), 'stadig kronologisk')
  assert.equal(heaviestSetPerWeek(logs).at(-1).weight, rows.at(-1).weight, 'kurven ender på det nyeste løft')
})

test('fremgangLogsKronologisk tåler null og rører ikke sit input', () => {
  assert.deepEqual(fremgangLogsKronologisk(null), [])
  const input = [{ a: 2 }, { a: 1 }]
  fremgangLogsKronologisk(input)
  assert.deepEqual(input, [{ a: 2 }, { a: 1 }])
})

test('rekordRaekkerQuery (ORDRE 450): kun rækker fra "siden", ellers alt; samme felter og grænse', async () => {
  const kald = []
  const lav = () => {
    const b = {
      from(t) { kald.push(['from', t]); return b }, select(c) { kald.push(['select', c]); return b },
      eq(k, v) { kald.push(['eq', k, v]); return b }, gt(k, v) { kald.push(['gt', k, v]); return b },
      gte(k, v) { kald.push(['gte', k, v]); return b }, order(k, o) { kald.push(['order', k, o.ascending]); return b },
      limit(n) { kald.push(['limit', n]); return b },
    }
    return b
  }
  rekordRaekkerQuery(lav(), 'atlet-1', '2026-09-01T00:00:00.000Z')
  assert.ok(kald.some(k => k[0] === 'gte' && k[1] === 'logged_at' && k[2] === '2026-09-01T00:00:00.000Z'))
  assert.ok(kald.some(k => k[0] === 'select' && k[1].includes('exercises(name)') && k[1].includes('exercise_id')))
  assert.ok(kald.some(k => k[0] === 'limit' && k[1] === FREMGANG_LOG_LIMIT))
  kald.length = 0
  rekordRaekkerQuery(lav(), 'atlet-1', null)
  assert.ok(!kald.some(k => k[0] === 'gte'))
})

// ORDRE 456 (A4): hele historikken side for side, uanset Supabase' "Max rows".
// Falsk klient med range (offset/limit) og et loft på maxRows pr. svar.
function sideKlient(rows, maxRows, { fejlPaaSide = null } = {}) {
  const kald = []
  const lav = () => {
    const q = { orden: [] }
    const b = {
      from() { return b }, select() { return b }, eq() { return b }, gt() { return b }, gte() { return b },
      order(col, { ascending }) { q.orden.push({ col, ascending }); return b },
      limit(n) { q.fra = 0; q.til = n - 1; return b },
      range(fra, til) { q.fra = fra; q.til = til; return b },
      then(resolve) {
        kald.push([q.fra, q.til])
        if (fejlPaaSide != null && kald.length - 1 === fejlPaaSide) return resolve({ data: null, error: { code: '57014', message: 'timeout' } })
        const sorted = [...rows].sort((a, b) => (a.logged_at < b.logged_at ? 1 : a.logged_at > b.logged_at ? -1 : (a.id < b.id ? 1 : -1)))
        resolve({ data: sorted.slice(q.fra, q.til + 1).slice(0, maxRows), error: null })
      },
    }
    return b
  }
  return { lav, kald }
}

test('hentAlleSider (ORDRE 456, A4): med et loft på 1000 kommer alle 4500 rækker, også den ældste top', async () => {
  const { hentAlleSider } = await import('./fremgangLogs.js')
  const rows = historik(4500).map((r, i) => ({ ...r, id: `r${String(i).padStart(5, '0')}`, exercise_id: 'x' }))
  rows[0].weight = 200 // den ældste række er toppen
  for (const loft of [1000, 4000, 250]) {
    const { lav, kald } = sideKlient(rows, loft)
    const { data, error } = await hentAlleSider((fra, til) => rekordRaekkerQuery(lav(), 'atlet-1', null, { fra, til }))
    assert.equal(error, null)
    assert.equal(data.length, 4500, `loft ${loft}: alle rækker`)
    assert.equal(new Set(data.map(r => r.id)).size, 4500, `loft ${loft}: ingen række to gange`)
    assert.ok(data.some(r => r.weight === 200), `loft ${loft}: den ældste top er med`)
    assert.deepEqual(kald.at(-1)[0], 4500, 'sidste side er den tomme efter de 4500')
  }
})

test('hentAlleSider: en fejl på en side giver fejl, ikke en halv historik', async () => {
  const { hentAlleSider } = await import('./fremgangLogs.js')
  const rows = historik(2500).map((r, i) => ({ ...r, id: `r${i}` }))
  const { lav } = sideKlient(rows, 1000, { fejlPaaSide: 1 })
  const { data, error } = await hentAlleSider((fra, til) => fremgangLogsQuery(lav(), 'atlet-1', { fra, til }))
  assert.equal(data, null)
  assert.equal(error.code, '57014')
})

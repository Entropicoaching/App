import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fremgangLogsQuery, fremgangLogsKronologisk, FREMGANG_LOG_LIMIT } from './fremgangLogs.js'
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

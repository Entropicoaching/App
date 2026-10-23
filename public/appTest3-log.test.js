// APP-TEST3: kun nye proever. Ingen appstart, storage, net eller browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { findDagensPas, nextSetInSession } from '../src/nextSet.js'
import { pasOverblik } from '../src/athlete/pasOverblikModel.mjs'
import { naesteOevelse, naesteOevelseDetalje, naesteKnapNavn, saetStreger } from '../src/athlete/dagensPasLayout.mjs'

const ex = [
  { id: 'sq', name: 'Squat', sets: 2, reps: '5' },
  { id: 'bp', name: 'Bænkpres', sets: 2, reps: '3' },
  { id: 'ny', name: 'Ukendt specialøvelse', sets: 1, reps: '8' },
]
const session = { id: 's1', exercises: ex }
const week = { id: 'w1', sessions: [{ id: 'hvile', exercises: [] }, session] }
const futureSession = { id: 's2', exercises: [{ id: 'f', name: 'Rows', sets: 1 }] }
const future = { id: 'w3', sessions: [futureSession] }
const gap = { id: 'w2', sessions: [] }
const log = (exercise_id, set_number, skipped = false) => ({ exercise_id, set_number, skipped })
const full = [log('sq', 1), log('sq', 2), log('bp', 1), log('bp', 2), log('ny', 1)]
// Syntetiske grupper isolerer layoutets kontrakt fra navneklassifikation.
const groups = ex.map(e => ({ name: e.name, rows: [{ ex: e }], totalSets: e.sets }))
const snapshot = value => JSON.stringify(value)
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('APP-TEST3: tom uge og manglende uge giver neutral tilstand og nul saet', () => {
  for (const empty of [{ id: 'w0' }, { id: 'w0', sessions: [] }, { id: 'w0', sessions: [{ exercises: [] }] }]) {
    assert.deepEqual(findDagensPas([empty, gap, future], empty, []), {
      status: 'empty', upcoming: { week: future, session: futureSession },
    })
    assert.deepEqual(findDagensPas([empty], empty, []), { status: 'empty', upcoming: null })
  }
  assert.equal(findDagensPas([], null, []), null)
  assert.deepEqual(pasOverblik(null, null, 'mangler'), { rows: [], total: 0, done: 0, percent: 0 })
  assert.equal(naesteOevelse([], 'mangler'), null)
  assert.deepEqual(saetStreger({ total: 0, setNumber: 1 }), [])
})

test('APP-TEST3: delvis uge vaelger foerste ufærdige pas efter et afsluttet pas', () => {
  const first = { id: 'foer', exercises: [{ id: 'a', sets: 1 }] }
  const current = { id: 'delvis', sessions: [first, ...week.sessions, futureSession] }
  const logs = [log('a', 1), log('sq', 1)]
  const result = findDagensPas([current], current, logs)
  assert.equal(result.status, 'open')
  assert.equal(result.session, session)
  assert.deepEqual(result.next, { exercise: ex[0], setNumber: 2, totalSets: 2 })
  assert.deepEqual(saetStreger({ setNumber: result.next.setNumber, total: 2 }), ['klaret', 'aktuelt'])
  const m = pasOverblik(session, logs, 'sq')
  assert.deepEqual([m.done, m.total, m.percent], [1, 5, 20])
  assert.deepEqual(m.rows.map(r => r.current), [true, false, false])
})

test('APP-TEST3: alle saet sprunget over afslutter ugen og giver 100 procent', () => {
  const logs = full.map(l => ({ ...l, skipped: true }))
  assert.deepEqual(findDagensPas([week, gap, future], week, logs), {
    status: 'done', upcoming: { week: future, session: futureSession },
  })
  assert.equal(nextSetInSession(session, logs), null)
  const m = pasOverblik(session, logs, null)
  assert.deepEqual([m.done, m.total, m.percent], [5, 5, 100])
  assert.ok(m.rows.every(r => r.sets.every(s => s.status === 'Sprunget over')))
  assert.equal(naesteKnapNavn(null, m.percent), 'Sidste øvelse i passet. Hele passet, 100 % afsluttet')
})

test('APP-TEST3: sidste saet i sidste oevelse skifter fra 80 til 100 procent', () => {
  const before = full.slice(0, -1)
  const result = findDagensPas([week], week, before)
  assert.equal(result.status, 'open')
  assert.deepEqual(result.next, { exercise: ex[2], setNumber: 1, totalSets: 1 })
  assert.deepEqual(saetStreger({ setNumber: 1, total: 1 }), ['aktuelt'])
  assert.equal(naesteOevelse(groups, result.next.exercise.id), null)
  assert.equal(pasOverblik(session, before, 'ny').percent, 80)
  assert.equal(naesteKnapNavn(null, 80), 'Sidste øvelse i passet. Hele passet, 80 % afsluttet')
  for (const skipped of [false, true]) {
    const logs = [...before, log('ny', 1, skipped)]
    assert.deepEqual(findDagensPas([week], week, logs), { status: 'done', upcoming: null })
    assert.deepEqual([pasOverblik(session, logs).done, pasOverblik(session, logs).percent], [5, 100])
  }
})

test('APP-TEST3: ukendt log og aktivt id paavirker hverken antal eller naeste oevelse', () => {
  const logs = [log('fremmed', 1), log('fremmed', 2, true)]
  assert.deepEqual(findDagensPas([week], week, logs).next, { exercise: ex[0], setNumber: 1, totalSets: 2 })
  const m = pasOverblik(session, logs, 'fremmed')
  assert.deepEqual([m.done, m.total, m.percent], [0, 5, 0])
  assert.ok(m.rows.every(r => !r.current))
  assert.equal(naesteOevelse(groups, 'fremmed'), null)
  // Et ukendt navn med et gyldigt programmeret id skal stadig kunne logges.
  assert.equal(findDagensPas([week], week, full.slice(0, 4)).next.exercise.name, 'Ukendt specialøvelse')
})

test('APP-TEST3: et sprunget saet flytter inden for oevelsen og derefter til naeste', () => {
  const logs = [log('sq', 1, true)]
  assert.deepEqual(findDagensPas([week], week, logs).next, { exercise: ex[0], setNumber: 2, totalSets: 2 })
  assert.deepEqual(naesteOevelse(groups, 'sq'), { name: 'Bænkpres', totalSets: 2, reps: '3', laterCount: 1 })
  const after = [...logs, log('sq', 2, true)]
  const result = findDagensPas([week], week, after)
  assert.deepEqual(result.next, { exercise: ex[1], setNumber: 1, totalSets: 2 })
  const next = naesteOevelse(groups, result.next.exercise.id)
  assert.deepEqual(next, { name: 'Ukendt specialøvelse', totalSets: 1, reps: '8', laterCount: 0 })
  assert.equal(naesteKnapNavn(next, pasOverblik(session, after).percent),
    'Næste øvelse: Ukendt specialøvelse · 1 sæt × 8. Hele passet, 40 % afsluttet')
})

test('APP-TEST3: bundarkets raekker og afrunding bruger saet, ikke antal oevelser', () => {
  const three = { exercises: [{ id: 'a', sets: 2 }, { id: 'b', sets: 1 }] }
  for (const [logs, done, percent, statuses] of [
    [[], 0, 0, ['Planlagt', 'Planlagt', 'Planlagt']],
    [[log('a', 1, true)], 1, 33, ['Sprunget over', 'Planlagt', 'Planlagt']],
    [[log('a', 1, true), log('b', 1)], 2, 67, ['Sprunget over', 'Planlagt', 'Færdigt']],
    [[log('a', 1, true), log('a', 2), log('b', 1)], 3, 100, ['Sprunget over', 'Færdigt', 'Færdigt']],
  ]) {
    const m = pasOverblik(three, logs, 'a')
    assert.deepEqual([m.done, m.total, m.percent], [done, 3, percent])
    assert.deepEqual(m.rows.flatMap(r => r.sets.map(s => s.status)), statuses)
    assert.deepEqual(m.rows.map(r => r.total), [2, 1])
    assert.deepEqual(m.rows.flatMap(r => r.sets.map(s => s.number)), [1, 2, 1])
    assert.equal(m.rows.reduce((sum, r) => sum + r.done, 0), done)
  }
})

test('APP-TEST3: delt top og backoff bevarer offset og undlader faelles reps', () => {
  const split = { name: 'Squat', totalSets: 3, rows: [
    { ex: { id: 'top', reps: '1' } }, { ex: { id: 'back', reps: '5' } },
  ] }
  const list = [groups[1], split, groups[2]]
  assert.deepEqual(naesteOevelse(list, 'bp'), { name: 'Squat', totalSets: 3, reps: null, laterCount: 1 })
  assert.equal(naesteOevelseDetalje(naesteOevelse(list, 'bp')), ' · 3 sæt (+1)')
  assert.deepEqual(naesteOevelse(list, 'top'), naesteOevelse(list, 'back'))
  assert.deepEqual(saetStreger({ offset: 1, setNumber: 2, total: 3 }), ['klaret', 'klaret', 'aktuelt'])
})

test('APP-TEST3: hvert trin i blandet log bevarer input og korrekt procent', () => {
  const logs = full.map((l, i) => ({ ...l, skipped: i % 2 === 0 }))
  const original = snapshot({ week, groups, logs })
  for (let i = 0; i <= logs.length; i++) {
    const partial = logs.slice(0, i)
    const m = pasOverblik(session, partial, i < 2 ? 'sq' : i < 4 ? 'bp' : 'ny')
    assert.deepEqual([m.done, m.total, m.percent], [i, 5, i * 20])
    const result = findDagensPas([week], week, partial)
    if (i < 5) {
      assert.equal(result.status, 'open')
      assert.equal(result.next.exercise.id, full[i].exercise_id)
      assert.equal(result.next.setNumber, full[i].set_number)
    } else assert.deepEqual(result, { status: 'done', upcoming: null })
  }
  assert.equal(snapshot({ week, groups, logs }), original)
})

test('APP-TEST3: alle 243 blandinger af planlagte, loggede og sprungne saet', () => {
  for (let mask = 0; mask < 3 ** full.length; mask++) {
    let code = mask
    const states = full.map(() => { const state = code % 3; code = Math.floor(code / 3); return state })
    const logs = full.flatMap((l, i) => states[i] ? [{ ...l, skipped: states[i] === 2 }] : [])
    logs.push(log('fremmed', 1, true))
    const missing = states.indexOf(0)
    const done = states.filter(Boolean).length
    const m = pasOverblik(session, logs)
    assert.deepEqual([m.done, m.total, m.percent], [done, 5, done * 20], `model ${mask}`)
    assert.deepEqual(m.rows.flatMap(r => r.sets.map(s => s.status)),
      states.map(s => ['Planlagt', 'Færdigt', 'Sprunget over'][s]), `status ${mask}`)
    const result = findDagensPas([week], week, logs)
    if (missing < 0) {
      assert.deepEqual(result, { status: 'done', upcoming: null }, `done ${mask}`)
    } else {
      assert.equal(result.status, 'open', `open ${mask}`)
      assert.equal(result.next.exercise.id, full[missing].exercise_id, `exercise ${mask}`)
      assert.equal(result.next.setNumber, full[missing].set_number, `set ${mask}`)
    }
  }
})

test('APP-TEST3: statisk JSX-binding for antal, procent og knap bruger samme model', () => {
  // Kun tekstlaesning, ikke render eller appintegration. LF og CRLF accepteres.
  const sheet = source('../src/athlete/PasOverblik.jsx')
  const card = source('../src/athlete/DagensPasCard.jsx')
  for (const text of [sheet, sheet.replace(/\r?\n/g, '\r\n')]) {
    assert.match(text, /aria-valuenow=\{model\.percent\}/)
    assert.match(text, /\{model\.done\} af \{model\.total\} sæt/)
    assert.match(text, /\{model\.percent\} %, \$\{model\.done\} af \$\{model\.total\} sæt afsluttet/)
    assert.match(text, /data-status=\{set\.status\}/)
  }
  for (const text of [card, card.replace(/\r?\n/g, '\r\n')]) {
    assert.match(text, /session=\{session\}\s+logs=\{exerciseLogs\}\s+activeId=\{ex\.id\}/)
    assert.match(text, /triggerLabel=\{model => naesteKnapNavn\(naeste, model\.percent\)\}/)
    // APP-PERF1: samme sessionsgrupper genbruges til raekke og naeste oevelse.
    assert.match(text, /const viewGroups = exerciseViewGroups\(session\.exercises\)/)
    assert.match(text, /const viewRow = dagensPasRaekke\(viewGroups, ex\.id\)/)
    assert.match(text, /const naeste = naesteOevelse\(viewGroups, ex\.id\)/)
  }
})

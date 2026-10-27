import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_FREMGANG_LINJER, fremgangLinjer, fremgangLinjeTekst, renderFremgangLinjer } from './fremgangLinjer.mjs'

const now = '2026-10-25T12:00:00Z'
const names = ['Squat topsæt', 'Bænkpres', 'Dødløft', 'Sumo dødløft', 'Front squat']
const dates = ['2026-10-05', '2026-10-12', '2026-10-19']
function fixture() {
  const allWeeks = dates.map((start_date, i) => ({ id: `w${i}`, week_number: i + 1, block_name: 'Styrke', start_date,
    sessions: [{ exercises: names.map((name, j) => ({ id: `e${i}-${j}`, name })) }] }))
  const fremgangLogs = allWeeks.slice(0, 2).flatMap((w, i) => names.map((name, j) => log(i, j, 100 + 5 * i)))
  const exerciseLogs = names.map((name, j) => log(2, j, 110))
  return { allWeeks, currentWeek: allWeeks[2], fremgangLogs, exerciseLogs, now }
}
function log(i, j, weight, reps = 3, day = dates[i]) {
  return { exercise_id: `e${i}-${j}`, weight, reps_completed: reps, logged_at: `${day}T10:00:00Z`, exercises: { name: names[j] } }
}
const squat = p => fremgangLinjer(p).find(r => r.key === 'squat')

test('exactly four main lift rows, one per lift; variants excluded', () => {
  const rows = fremgangLinjer(fixture())
  assert.deepEqual(rows.map(r => r.key), ['squat', 'baenk', 'doedloeft', 'sumo'])
  for (const r of rows) {
    assert.equal(r.mode, 'comparison')
    assert.equal(r.delta, 11)
    assert.equal(r.start.weight, 100)
    assert.equal(r.current.weight, 110)
  }
})
test('first program week best versus current week best, never lifetime best or first row', () => {
  const p = fixture()
  p.fremgangLogs.push(log(0, 0, 102), log(1, 0, 200))
  p.exerciseLogs.push({ ...log(2, 0, 90), logged_at: '2026-10-20T12:00:00Z' })
  const r = squat(p)
  assert.equal(r.start.weight, 102)
  assert.equal(r.current.weight, 110)
  assert.equal(r.delta, 9)
})
test('best means Epley estimate, with both actual sets visible', () => {
  const p = fixture(); p.exerciseLogs.push(log(2, 0, 105, 8))
  const r = squat(p)
  assert.equal(r.current.weight, 105)
  assert.equal(r.delta, 23)
  assert.match(fremgangLinjeTekst(r), /105 kg × 8 mod 100 kg × 3 ved blokstart/)
})
test('many sets on two days are insufficient', () => {
  const p = fixture(); p.fremgangLogs = [log(0, 0, 100), ...Array.from({ length: 30 }, () => log(0, 0, 101))]
  assert.equal(squat(p).mode, 'raw')
  assert.equal(squat(p).latest.weight, 110)
  assert.doesNotMatch(fremgangLinjeTekst(squat(p)), /e1RM|blokstart|skøn/)
})
test('three days within thirteen days are insufficient', () => {
  const p = fixture(); p.fremgangLogs[0].logged_at = '2026-10-06T10:00:00Z'
  assert.equal(squat(p).mode, 'raw')
})
test('missing first block week data does not rename oldest log to block start', () => {
  const p = fixture(); p.fremgangLogs = p.fremgangLogs.filter(l => l.exercise_id !== 'e0-0')
  p.fremgangLogs.push(log(1, 0, 106, 3, '2026-10-13'))
  assert.equal(squat(p).mode, 'raw')
})
test('missing current heavy set gives latest raw backoff, not an old comparison', () => {
  const p = fixture(); p.currentWeek.sessions[0].exercises[0].name = 'Squat backoff'
  assert.equal(squat(p).mode, 'raw')
  assert.equal(squat(p).latest.weight, 110)
})
test('current local rows replace stale fetched rows; undo removes them', () => {
  const p = fixture(); p.fremgangLogs.push(log(2, 0, 300))
  assert.equal(squat(p).current.weight, 110)
  p.exerciseLogs = p.exerciseLogs.filter(l => l.exercise_id !== 'e2-0')
  const r = squat(p)
  assert.equal(r.mode, 'raw'); assert.equal(r.latest.weight, 105)
})
test('skipped local rows never revive a fetched set', () => {
  const p = fixture(); p.fremgangLogs.push(log(2, 0, 300)); p.exerciseLogs[0].skipped = true
  assert.equal(squat(p).mode, 'raw'); assert.equal(squat(p).latest.weight, 105)
})
test('deload, backoff, technique and high reps cannot unlock comparison', () => {
  for (const name of ['Squat backoff', 'Squat teknik single', 'Squat volumen']) {
    const p = fixture(); p.allWeeks[0].sessions[0].exercises[0].name = name
    assert.equal(squat(p).mode, 'raw', name)
  }
  const p = fixture(); p.allWeeks[1].block_name = 'Deload'
  assert.equal(squat(p).mode, 'raw')
  const q = fixture(); q.fremgangLogs[0].reps_completed = 9
  assert.equal(squat(q).mode, 'raw')
})
test('raw latest can be a light set; it is neither estimated nor hidden', () => {
  const p = fixture(); p.fremgangLogs = []
  p.currentWeek.sessions[0].exercises[0].name = 'Squat backoff'
  p.exerciseLogs[0].reps_completed = 12
  assert.equal(fremgangLinjeTekst(squat(p)), 'Squat: seneste sæt 110 kg × 12 (2026-10-19)')
})
test('missing block, missing dates, absent current week and duplicate weeks fail closed', () => {
  for (const change of [p => { p.currentWeek = null }, p => { delete p.allWeeks[0].start_date },
    p => { p.allWeeks[0].start_date = '2026-02-30' }, p => { p.currentWeek.block_name = '' },
    p => { p.allWeeks.push({ ...p.allWeeks[0] }) }, p => { p.allWeeks[1].week_number = 8 }]) {
    const p = fixture(); change(p)
    assert.equal(squat(p).mode, 'raw')
  }
})
test('a repeated block name after another block does not reuse the earlier start', () => {
  const p = fixture(); p.allWeeks[1].block_name = 'Anden blok'
  assert.equal(squat(p).mode, 'raw')
})
test('logs outside their program week do not prove a comparison', () => {
  const p = fixture(); p.fremgangLogs[0].logged_at = '2026-09-01T10:00:00Z'
  assert.equal(squat(p).mode, 'raw')
})
test('invalid, zero, fractional reps and future rows are not raw sets', () => {
  for (const change of [{ weight: NaN }, { weight: 0 }, { reps_completed: 0 }, { reps_completed: 2.5 },
    { logged_at: null }, { logged_at: '2026-02-30' }, { logged_at: '2026-10-26T12:00:00Z' }]) {
    const p = fixture(); p.exerciseLogs[0] = { ...p.exerciseLogs[0], ...change }
    assert.equal(squat(p).mode, 'raw'); assert.equal(squat(p).latest.weight, 105)
  }
})
test('zero and negative changes are factual and do not celebrate progress', () => {
  for (const [weight, expected] of [[100, 'e1RM-skøn uændret'], [90, 'e1RM-skøn -11 kg']]) {
    const p = fixture(); p.exerciseLogs[0].weight = weight
    assert.ok(fremgangLinjeTekst(squat(p)).includes(expected))
  }
})
test('unsorted inputs produce identical rows and inputs remain untouched', () => {
  const p = fixture(), before = structuredClone(p)
  const expected = fremgangLinjer(p)
  assert.deepEqual(p, before)
  p.allWeeks.reverse(); p.exerciseLogs.reverse(); p.fremgangLogs.reverse()
  assert.deepEqual(fremgangLinjer(p), expected)
})
test('empty input and invalid clock give no invented sets', () => {
  assert.deepEqual(fremgangLinjer(), [])
  assert.deepEqual(fremgangLinjer({ ...fixture(), now: 'bad' }), [])
})

// Minimal synthetic DOM. It records actual element creation and text nodes.
function element(tag, props, ...children) {
  return { tag, props: props || {}, children: children.flat().filter(x => x != null) }
}
test('default OFF and strict true: disabled rendering creates no DOM nodes', () => {
  assert.equal(DEFAULT_FREMGANG_LINJER, false)
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    assert.equal(renderFremgangLinjer(() => { throw Error('must not render') }, { ...fixture(), enabled }), null)
  }
})
test('actual renderer creates one accessible paragraph per lift and raw fallback', () => {
  const p = fixture(); p.fremgangLogs = p.fremgangLogs.filter(l => l.exercise_id !== 'e0-1')
  const dom = renderFremgangLinjer(element, { ...p, enabled: true })
  assert.equal(dom.tag, 'section'); assert.equal(dom.props['aria-label'], 'Hovedløft siden blokstart')
  assert.equal(dom.children.length, 4)
  assert.ok(dom.children.every(n => n.tag === 'p' && n.children.length === 1))
  assert.deepEqual(dom.children.map(n => n.props['data-grundlag']), ['comparison', 'raw', 'comparison', 'comparison'])
  assert.ok(dom.children.every(n => !/[\u2013\u2014]/.test(n.children[0])))
  const empty = renderFremgangLinjer(element, { enabled: true, now })
  assert.equal(empty.children[0].children[0], 'Du har ikke logget et hovedløft endnu.')
})
test('integration threads the explicit flag to both actual tabs and keeps legacy content byte-identical', () => {
  const athlete = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  assert.ok(athlete.includes('fremgangLinjer = false'))
  assert.match(athlete, /fremgangLinjer: fremgangLinjer === true/)
  assert.match(athlete, /enkelDel: enkelOn \? route : null/)
  for (const name of ['FremgangTab.jsx', 'EnkelFremgangTab.jsx']) {
    const code = readFileSync(new URL(name, import.meta.url), 'utf8')
    assert.ok(code.includes('fremgangLinjer = DEFAULT_FREMGANG_LINJER'))
    assert.ok(code.includes(') : fremgangLinjer === true ? ('))
    assert.ok(code.includes('renderFremgangLinjer(createElement, { enabled: fremgangLinjer, fremgangLogs, exerciseLogs, allWeeks, currentWeek })'))
  }
})

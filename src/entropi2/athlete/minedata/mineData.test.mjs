import test from 'node:test'
import assert from 'node:assert/strict'
import { mineDataModel } from './mineDataModel.mjs'
import { register } from 'node:module'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: MineData } = await import('./MineData.mjs')
const ready = rows => ({ state: 'ready', rows })
const row = (extra = {}) => ({ athlete_id: 'synthetic-a', date: '2026-11-03', ...extra })
const input = (extra = {}) => ({ athleteId: 'synthetic-a', today: '2026-11-03',
  sessions: ready([]), records: ready([]), nutritionDays: ready([]), weights: ready([]), ...extra })
const nodes = e => !e || typeof e !== 'object' ? [] : [e, ...[e.props.children].flat(Infinity).flatMap(nodes)]
const content = e => e == null || typeof e === 'boolean' ? '' : typeof e !== 'object' ? String(e)
  : [e.props.children].flat(Infinity).map(content).join(' ')
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }; return v }

test('28 calendar days inclusive; excludes old, future, invalid and non-completed sessions', () => {
  const sessions = ready(['2026-10-07', '2026-11-03', '2026-10-06', '2026-11-04', '2026-02-30']
    .map((date, i) => row({ id: `s${i}`, date, status: 'completed' }))
    .concat(['partial', 'skipped'].map(status => row({ id: status, status }))))
  const model = mineDataModel(input({ sessions }))
  assert.equal(model.start, '2026-10-07'); assert.equal(model.end, '2026-11-03')
  assert.equal(model.sessions.completed, 2)
  assert.deepEqual(model.weight.weeks.map(w => [w.start, w.end]), [
    ['2026-10-07', '2026-10-13'], ['2026-10-14', '2026-10-20'],
    ['2026-10-21', '2026-10-27'], ['2026-10-28', '2026-11-03']])
})
test('explicit strict dates, leap day, DST and year boundaries', () => {
  for (const today of [undefined, null, 'bad', '2026-02-30', '2026-11-03T00:00:00Z']) {
    const m = mineDataModel(input({ today })); assert.equal(m.start, null)
    assert.equal(m.sessions.state, 'unavailable'); assert.equal(m.sessions.completed, null)
  }
  for (const [today, start] of [['2024-02-29', '2024-02-02'], ['2027-01-01', '2026-12-05'], ['2026-10-26', '2026-09-29']])
    assert.equal(mineDataModel(input({ today })).start, start)
})
test('every source requires exact ownership and confirmed in-window rows', () => {
  const rows = [row({ athlete_id: 'synthetic-b' }), row({ athlete_id: undefined }), row({ _optimistic: true }),
    row({ pending: true }), row({ date: '2026-11-04' }), row({ date: '2026-10-06' }), row({ date: 'bad' })]
  const m = mineDataModel(input({ sessions: ready(rows.map(r => ({ ...r, id: 's', status: 'completed' }))),
    records: ready(rows.map(r => ({ ...r, id: 'r', exerciseId: 'e', exercise: 'Other', weightKg: 100, reps: 5 }))),
    nutritionDays: ready(rows.map(r => ({ ...r, goalMet: true }))), weights: ready(rows.map(r => ({ ...r, kg: 80 }))) }))
  assert.equal(m.sessions.completed, 0); assert.deepEqual(m.records.lifts, [])
  assert.equal(m.nutrition.loggedDays, 0); assert.equal(m.weight.recordedDays, 0)
  for (const athleteId of [undefined, '', ' ', 1]) assert.equal(mineDataModel(input({ athleteId })).weight.state, 'unavailable')
})
test('unknown, loading, failed and known empty sources stay distinct', () => {
  for (const [source, state] of [[undefined, 'unavailable'], [{ state: 'loading' }, 'loading'],
    [{ state: 'error', rows: [] }, 'error'], [{ state: 'ready' }, 'unavailable']]) {
    const m = mineDataModel(input({ sessions: source, records: source, nutritionDays: source, weights: source }))
    assert.equal(m.sessions.state, state); assert.equal(m.sessions.completed, null)
    assert.equal(m.records.state, state); assert.equal(m.nutrition.goalDays, null); assert.equal(m.weight.state, state)
  }
  assert.equal(mineDataModel(input()).sessions.completed, 0)
})
test('session retries deduplicate; identity conflicts excluded regardless of order', () => {
  const r = row({ id: 'a', status: 'completed' })
  const rows = [r, r, { ...r, id: 'b' }, { ...r, id: 'b', status: 'partial' }, row({ status: 'completed' }), null]
  for (const list of [rows, rows.toReversed()])
    assert.equal(mineDataModel(input({ sessions: ready(list) })).sessions.completed, 1)
})
test('period best sets: weight then reps then earliest date, separate exercise identities', () => {
  const set = (id, weightKg, reps, date = '2026-11-03') => row({ id, exerciseId: 'squat', exercise: 'Squat', weightKg, reps, date })
  const rows = [set('a', 100, 8), set('b', 105, 3), set('c', 105, 5), set('d', 105, 5, '2026-10-10'),
    set('old', 200, 1, '2026-10-06'), set('bad', NaN, 1), set('zero', 0, 5), set('rep', 110, 1.5),
    set('conflict', 500, 1), set('conflict', 600, 1)]
  for (const list of [rows, rows.toReversed()]) assert.deepEqual(mineDataModel(input({ records: ready(list) })).records.lifts,
    [{ exerciseId: 'squat', exercise: 'Squat', date: '2026-10-10', weightKg: 105, reps: 5 }])
  assert.equal(mineDataModel(input({ records: ready([set('a', 100, 5), { ...set('b', 100, 5), exerciseId: 'other' }]) })).records.lifts.length, 2)
})
test('nutrition distinguishes assessed, unknown, absent and conflicting days', () => {
  const yes = row({ date: '2026-10-07', goalMet: true })
  const m = mineDataModel(input({ nutritionDays: ready([yes, yes, row({ date: '2026-10-08', goalMet: false }),
    row({ date: '2026-10-09', goalMet: null }), row({ goalMet: true }), row({ goalMet: false })]) }))
  assert.deepEqual(m.nutrition, { state: 'ready', loggedDays: 3, assessedDays: 2, unknownDays: 1, goalDays: 1 })
})
test('weight averages daily observations across gaps without filling missing periods', () => {
  const rows = [row({ date: '2026-10-07', kg: 80 }), row({ date: '2026-10-08', kg: 82 }), row({ kg: 79 }), row({ kg: 79 })]
  const w = mineDataModel(input({ weights: ready(rows) })).weight
  assert.deepEqual(w.weeks.map(x => x.kg), [81, null, null, 79]); assert.equal(w.deltaKg, -2)
  assert.equal(w.recordedDays, 3); assert.equal(w.from, '2026-10-07'); assert.equal(w.to, '2026-10-28')
})
test('invalid/conflicting weights omitted; one observed period has no trend', () => {
  const weights = ready([row({ kg: 80 }), row({ kg: 81 }), row({ date: '2026-10-07', kg: 0 }),
    row({ date: '2026-10-08', kg: -1 }), row({ date: '2026-10-09', kg: Infinity }),
    row({ date: '2026-10-10', kg: '80' }), row({ date: '2026-10-11', kg: 82 })])
  const w = mineDataModel(input({ weights })).weight
  assert.equal(w.recordedDays, 1); assert.equal(w.deltaKg, null)
})
test('model and actual view accept frozen synthetic inputs without mutation', () => {
  const props = freeze(input({ weights: ready([row({ kg: 80 })]) })), before = JSON.stringify(props)
  mineDataModel(props); MineData(props); assert.equal(JSON.stringify(props), before)
})
test('actual view has four cards, dated window, mobile wrapping and no actions', () => {
  assert.equal(MineData(input()), null)
  const v = MineData(input({ weights: ready([row({ kg: 80 })]) })), all = nodes(v)
  assert.deepEqual(all.filter(n => n.type === 'h3').map(content), ['Kropsvægt'])
  assert.equal(v.props.style.maxWidth, 480); assert.equal(v.props.style.overflowWrap, 'anywhere')
  assert.match(content(v), /07\.10\.2026 til 03\.11\.2026/)
  assert.match(content(v), /80 kg/)
  assert.equal(all.some(n => n.type === 'button' || n.type === 'a' || n.props.onClick), false)
})
test('view displays real projections, Danish units, coverage and neutral weight change', () => {
  const v = MineData(input({ sessions: ready([row({ id: 'a', status: 'completed' })]),
    records: ready([row({ id: 'r', exerciseId: 's', exercise: 'Squat', weightKg: 102.5, reps: 5 })]),
    nutritionDays: ready([row({ goalMet: true })]), weights: ready([row({ date: '2026-10-07', kg: 80 }), row({ kg: 79 })]) }))
  const s = content(v)
  for (const pattern of [/1 registrerede, gennemførte pas/, /102,5 kg × 5/, /1 af 1 kostdage/,
    /1 registrerede dage af 28/, /-1 kg/, /ikke en livstidsrekord/]) assert.match(s, pattern)
})
test('untrusted exercise labels remain text; records list capped at three', () => {
  const records = ready(Array.from({ length: 4 }, (_, i) => row({ id: `r${i}`, exerciseId: `e${i}`,
    exercise: '<script>synthetic</script>', weightKg: 100, reps: 1 })))
  const v = MineData(input({ records })), all = nodes(v)
  assert.match(content(v), /Viser 3 af 4 øvelser/); assert.equal(all.filter(n => n.type === 'li').length, 3)
  assert.equal(all.some(n => n.type === 'script' || n.props.dangerouslySetInnerHTML), false)
})
test('view reports failures and absent date without fabricated zero counts', () => {
  const s = content(MineData(input({ sessions: { state: 'loading' }, records: { state: 'error' },
    nutritionDays: undefined, weights: { state: 'error' } })))
  assert.match(s, /kunne ikke hentes/)
  assert.equal((s.match(/kunne ikke hentes/g) ?? []).length, 1)
  assert.doesNotMatch(s, /0 registrerede, gennemførte/); assert.equal(MineData(), null)
})

test('equal records on the same date resolve consistently by stable record ID', () => {
  const a = row({ id: 'a', exerciseId: 'e', exercise: 'First', weightKg: 100, reps: 5 })
  const b = { ...a, id: 'b', exercise: 'Second' }
  for (const rows of [[a, b], [b, a]])
    assert.equal(mineDataModel(input({ records: ready(rows) })).records.lifts[0].exercise, 'First')
})

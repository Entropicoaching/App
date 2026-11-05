import test from 'node:test'
import assert from 'node:assert/strict'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import ProgramEndingView, { programEndingModel } from './ProgramEndingView.mjs'
import { coachHomeModel } from './coachModel.mjs'

const today = '2026-11-03'
function fixture(starts = ['2026-11-03']) {
  const athletes = starts.map((_, i) => ({ id: `synthetic-${i}`, name: `Syntetisk atlet ${i}` }))
  return { session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: athletes.map(a => a.id) },
    athletes, calendarWeeks: Object.fromEntries(athletes.map((a, i) => [a.id,
      [{ start_date: starts[i], exercise_count: 1, athlete_id: a.id }]])),
    coachActionsStatus: { calendar: 'ready' }, loading: false, loadError: false }
}
const model = (p = fixture(), day = today) => programEndingModel(coachHomeModel(p, day))
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] :
  [n, ...nodes(n.props?.children ?? n.children)]
const text = n => Array.isArray(n) ? n.map(text).join(' ') : n == null || typeof n === 'boolean' ? '' :
  typeof n === 'object' ? text(n.props?.children ?? n.children) : String(n)
const view = (p = fixture(), openProfile) => ProgramEndingView({ context: coachHomeModel(p, today), openProfile })

test('zero athletes leaves no empty program-ending view or action', () => {
  assert.deepEqual(model(fixture([])), { state: 'ready', rows: [] })
  assert.equal(view(fixture([])), null)
  assert.equal(nodes(view(fixture([]))).filter(n => n.type === 'button').length, 0)
})

test('one athlete uses last week start plus six days and opens existing program path once', () => {
  const p = fixture(), calls = [], before = structuredClone(p)
  assert.equal(model(p).rows[0].endDate, '2026-11-09')
  const tree = view(p, (...args) => calls.push(args))
  const buttons = nodes(tree).filter(n => n.type === 'button')
  assert.equal(buttons.length, 1); assert.match(text(buttons[0]), /Planlæg næste blok/)
  assert.equal(buttons[0].props.type, 'button'); assert.equal(buttons[0].props.disabled, false)
  assert.match(buttons[0].props['aria-label'], /Syntetisk atlet 0/)
  assert.equal(nodes(tree).find(n => n.type === 'time').props.dateTime, '2026-11-09')
  buttons[0].props.onClick()
  assert.deepEqual(calls, [[p.athletes[0], 'program', 'list']]); assert.deepEqual(p, before)
})

test('many athletes sort by final date, include today and day seven, exclude past and day eight', () => {
  const p = fixture(['2026-11-04', '2026-10-28', '2026-11-05', '2026-10-27', '2026-11-01'])
  assert.deepEqual(model(p).rows.map(r => [r.athlete.id, r.endDate]), [
    ['synthetic-1', '2026-11-03'], ['synthetic-4', '2026-11-07'], ['synthetic-0', '2026-11-10']])
})

test('last planned week wins even for unordered weeks; empty future weeks do not extend a plan', () => {
  const p = fixture(['2026-10-28'])
  p.calendarWeeks['synthetic-0'].unshift({ start_date: '2026-11-15', exercise_count: 1 })
  assert.equal(model(p).rows.length, 0)
  p.calendarWeeks['synthetic-0'][0].exercise_count = 0
  assert.equal(model(p).rows[0].endDate, today)
})

test('missing, malformed and partly undated weeks stay out of program endings', () => {
  const p = fixture([null, '2026-02-30', '2026-11-03', '2026-11-03T00:00:00Z', '2026-11-03'])
  p.calendarWeeks['synthetic-4'].push({ exercise_count: 1 })
  const result = model(p)
  assert.equal(result.rows[0].athlete.id, 'synthetic-2')
  assert.equal(result.rows.length, 1)
  assert.equal(nodes(view(p)).filter(n => n.type === 'time').length, 1)
  assert.doesNotMatch(text(view(p)), /Ukendt slutdato/)
  p.calendarWeeks['synthetic-2'] = []
  assert.equal(model(p).rows.length, 0)
  assert.equal(view(p), null)
})

for (const [label, mutate] of Object.entries({
  stale: p => { p.readContext.day = '2026-11-02' },
  owner: p => { p.readContext.coachId = 'synthetic-other' },
  loading: p => { p.loading = true }, error: p => { p.loadError = true },
  calendar: p => { p.coachActionsStatus.calendar = 'loading' },
  missing: p => { delete p.calendarWeeks['synthetic-0'] },
  incomplete: p => { p.calendarWeeks['synthetic-0'][0].readEvidence = { complete: false } },
  capped: p => { p.calendarWeeks['synthetic-0'] = Array.from({ length: 1000 }, () => ({ exercise_count: 1, start_date: today })) },
})) test(`${label} data never claims a known end date or an empty result`, () => {
  const p = fixture(); mutate(p)
  assert.deepEqual(model(p), { state: 'unknown', rows: [] })
  assert.equal(view(p), null)
  assert.doesNotMatch(text(view(p)), /Ingen programmer slutter/)
})

test('hidden and out-of-context athletes do not appear; foreign weeks cannot extend a plan', () => {
  const p = fixture(['2026-11-03', '2026-11-03', '2026-11-03'])
  p.athletes[1].hidden = true; p.readContext.athleteIds.pop()
  p.calendarWeeks['synthetic-0'].push({ athlete_id: 'synthetic-foreign', exercise_count: 1, start_date: '2026-12-01' })
  assert.deepEqual(model(p).rows.map(r => r.athlete.id), ['synthetic-0'])
  p.hiddenAthleteIds = new Set(['synthetic-0']); assert.equal(model(p).rows.length, 0)
})

test('Copenhagen day and civil arithmetic remain stable across daylight saving', () => {
  const p = fixture(['2026-10-26']); p.readContext.day = '2026-10-26'
  assert.equal(model(p, new Date('2026-10-25T23:30:00Z')).rows[0].endDate, '2026-11-01')
})

test('missing callback disables action and markup remains literal text', () => {
  const p = fixture(); p.athletes[0].name = '<script>synthetic</script>'
  const tree = view(p), button = nodes(tree).find(n => n.type === 'button')
  assert.equal(button.props.disabled, true); assert.equal(button.props.onClick, undefined)
  assert.match(text(tree), /<script>synthetic<\/script>/)
  assert.equal(nodes(tree).some(n => n.props?.dangerouslySetInnerHTML), false)
})

test('small hook mounts only in enabled overview; OFF never reads program data or runs hooks', () => {
  const p = fixture()
  const tree = CoachView({ ...p, enabled: true, today })
  const child = nodes(tree).find(n => n.type === ProgramEndingView)
  assert.ok(child); assert.equal(child.props.context.day, today)
  assert.equal(nodes(CoachView({ ...p, enabled: true, today, tab: 'inbox' })).some(n => n.type === ProgramEndingView), false)
  const hostile = { get calendarWeeks() { throw Error('OFF read') } }
  assert.equal(CoachScreen(hostile), null); assert.equal(CoachView({ ...p, enabled: false }), null)
})

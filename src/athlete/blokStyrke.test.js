import { install } from './frem5Loader.mjs'
install()
import test from 'node:test'
import assert from 'node:assert/strict'
const { blockStrength, renderBlockStrength, DEFAULT_BLOK_STYRKE } = await import('./blokStyrke.mjs')
const { estimatedOneRepMax } = await import('../exerciseProgress.js')
const { fixture } = await import('./frem5Fixture.mjs')
import { createElement as h, nodes, text } from './frem5Dom.mjs'
const squat = model => model.lifts.find(l => l.key === 'squat')

test('existing Epley formula and best estimate per program week, without mutation', () => {
  const f = fixture()
  f.fremgangLogs = [f.row(), f.row(3, 6, { weight: '95,5', reps_completed: 8 }), f.row(5, 1, { weight: 60 }), f.row(5, 2, { weight: 140 })]
  const before = JSON.stringify(f)
  const m = blockStrength(f)
  assert.equal(m.status, 'ready')
  assert.deepEqual(m.lifts.map(l => l.key), ['squat', 'baenk', 'doedloeft'])
  assert.deepEqual(squat(m).weeks.map(w => w.number), [4, 5, 6, 7])
  assert.equal(squat(m).weeks[0].best.e1rm, Math.round(estimatedOneRepMax('95,5', 8)))
  assert.equal(squat(m).weeks[1].best, null)
  assert.equal(m.lifts[1].weeks[2].best.e1rm, 66)
  assert.equal(m.lifts[2].weeks[2].best.e1rm, 154)
  assert.equal(JSON.stringify(f), before)
})

test('only the current contiguous block; earlier equal names, variants and next block excluded', () => {
  const f = fixture()
  f.fremgangLogs = [f.row(0, 0, { weight: 900 }), f.row(2), f.row(7), f.row(3, 3), f.row(3, 4), f.row(3, 5), f.row(4, 6)]
  const m = blockStrength(f)
  assert.deepEqual(squat(m).weeks.map(w => w.best?.e1rm ?? null), [null, 110, null, null])
  assert(m.lifts.slice(1).every(l => l.weeks.every(w => w.best === null)))
})

test('program week boundaries use Danish dates, including Sunday, Monday and year crossing', () => {
  const f = fixture('2027-01-05')
  const start = f.allWeeks[3].start_date
  const end = f.allWeeks[4].start_date
  f.fremgangLogs = [f.row(3, 0, { logged_at: start + 'T00:00:00+01:00' }),
    f.row(3, 0, { weight: 110, logged_at: end + 'T00:00:00+01:00' }),
    f.row(4, 0, { weight: 120, logged_at: end + 'T00:00:00+01:00' })]
  let m = blockStrength(f)
  assert.equal(squat(m).weeks[0].best.e1rm, 110)
  assert.equal(squat(m).weeks[1].best.e1rm, 132)
  f.fremgangLogs = [f.row(3, 0, { weight: 125, logged_at: end + 'T00:30:00+02:00' })]
  m = blockStrength(f)
  assert.equal(squat(m).weeks[0].best.e1rm, 138) // Sunday 23:30 Copenhagen
})

test('invalid sets and future dates remain gaps, never zero or nonfinite coordinates', () => {
  const f = fixture()
  const bad = [{ skipped: true }, { weight: 0 }, { weight: -1 }, { weight: Infinity }, { weight: 'x' },
    { reps_completed: 0 }, { reps_completed: 2.5 }, { reps_completed: 9 }, { reps_completed: Infinity },
    { logged_at: null }, { logged_at: '2026-02-30' }, { logged_at: 'bad' }, { exercise_id: 'foreign' },
    { athlete_id: 'other' }, { exercises: { name: 'Bench' } }, { exercises: { name: 'Squat backoff' } }]
  f.fremgangLogs = [...bad.map(extra => f.row(3, 0, extra)), f.row(6)]
  const m = blockStrength(f)
  assert(squat(m).weeks.every(w => w.best === null))
  const dom = renderBlockStrength(h, { ...f, enabled: true })
  assert.equal(nodes(dom, n => n.type === 'circle').length, 0)
  assert(!text(dom).includes('NaN'))
})

test('local snapshot owns edited, undone and pending current sets without duplicates', () => {
  const f = fixture()
  f.fremgangLogs = [f.row(), f.row(5, 0, { weight: 900 })]
  f.exerciseLogs = [f.row(5, 0, { weight: 110, exercises: undefined })]
  let m = blockStrength(f)
  assert.equal(squat(m).weeks[2].best.e1rm, 121)
  f.exerciseLogs = []
  assert.equal(squat(blockStrength(f)).weeks[2].best, null)
  delete f.exerciseLogs
  assert.equal(squat(blockStrength(f)).weeks[2].best.e1rm, 990)
})

test('ambiguous schedules and unavailable data fail closed', () => {
  const changes = [f => { f.allWeeks[4].start_date = '2026-02-30' }, f => { f.allWeeks[4].week_number = 4 },
    f => { f.allWeeks[4].id = 'w3' }, f => { f.allWeeks[4].athlete_id = 'other' },
    f => { f.allWeeks[4].sessions[0].exercises[0].id = 'e3-0' },
    f => { f.currentWeek = { id: 'missing' } }, f => { f.now = '2026-12-15' },
    f => { f.fremgangLogs = null }, f => { f.allWeeks = null }]
  for (const change of changes) { const f = fixture(); change(f); assert.equal(blockStrength(f).status, 'unknown') }
})

test('SVG segments stop at holes and preserve x positions, readable set evidence and single points', () => {
  const f = fixture()
  f.fremgangLogs = [f.row(), f.row(5, 0, { weight: 120 })]
  const dom = renderBlockStrength(h, { ...f, enabled: true })
  assert.equal(nodes(dom, n => n.type === 'polyline').length, 0)
  assert.equal(nodes(dom, n => n.type === 'circle').length, 2)
  assert.deepEqual(nodes(dom, n => n.type === 'circle').map(n => n.props.cx), [28, 204])
  assert.match(text(dom), /Uge 5: ingen måling/)
  assert.match(text(dom), /100 kg × 3/)
  assert.match(text(dom), /Estimeret 1RM er et skøn/)
  f.fremgangLogs.push(f.row(4))
  assert.equal(nodes(renderBlockStrength(h, { ...f, enabled: true }), n => n.type === 'polyline').length, 1)
})

test('default OFF, strict opt-in and loading states', () => {
  assert.equal(DEFAULT_BLOK_STYRKE, false)
  assert.equal(renderBlockStrength(h), null)
  assert.equal(renderBlockStrength(h, { enabled: 'true' }), null)
  const dom = renderBlockStrength(h, { enabled: true, loading: true })
  assert.equal(nodes(dom, n => n.props.role === 'status').length, 1)
  assert.equal(nodes(dom, n => n.type === 'svg').length, 0)
})


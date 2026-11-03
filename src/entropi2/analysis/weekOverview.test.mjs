import test from 'node:test'
import assert from 'node:assert/strict'
import { analysisModel, QUESTIONS } from './analysisModel.mjs'
import Analysis from './testRender.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const ex = (id, name = 'Squat', sets = 2) => ({ id, name, sets })
const currentWeek = { start_date: '2026-11-02', block_name: 'Styrke', sessions: [
  { id: 's1', exercises: [ex('sq')] },
  { id: 's2', exercises: [ex('bp', 'Bænkpres', 1)] },
] }
const local = (exercise_id, set_number, extra = {}) => ({ exercise_id, set_number,
  logged_at: '2026-11-03T10:00:00Z', weight: 100, reps_completed: 3, ...extra })
const history = (name, day, weight, reps_completed = 3, extra = {}) => ({
  exercise_id: `old-${name}-${day}`, logged_at: `${day}T10:00:00Z`, weight, reps_completed,
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } }, ...extra,
})
const props = extra => ({ entropi2: true, now, currentWeek, exerciseLogs: [], fremgangLogs: [], ...extra })
const overview = extra => analysisModel(props(extra), now).weekOverview
const lift = (o, name = 'Squat') => o.lifts.find(r => r.lift === name)

test('empty week reports zero of the dated plan and explicit missing comparison', () => {
  const o = overview()
  assert.equal(o.sessions, 'Pas gennemført: 0 af 2 planlagt.')
  assert.equal(o.sets, 'Sæt bekræftet: 0. Sprunget over: 0.')
  assert.match(o.period, /02\.11\.2026 til 08\.11\.2026/)
  assert.equal(o.lifts.length, 4)
  for (const row of o.lifts) { assert.equal(row.value, undefined); assert.match(row.message, /Ingen sammenlignelige/) }
})

test('partial and full weeks count positions across several sessions', () => {
  const logs = [local('sq', 1), local('sq', 2)]
  assert.equal(overview({ exerciseLogs: logs }).sessions, 'Pas gennemført: 1 af 2 planlagt.')
  assert.equal(overview({ exerciseLogs: logs }).sets, 'Sæt bekræftet: 2. Sprunget over: 0.')
  logs.push(local('bp', 1))
  assert.equal(overview({ exerciseLogs: logs }).sessions, 'Pas gennemført: 2 af 2 planlagt.')
  assert.equal(overview({ exerciseLogs: logs }).sets, 'Sæt bekræftet: 3. Sprunget over: 0.')
})

test('skipped completes a planned position but is separate from confirmed sets', () => {
  const o = overview({ exerciseLogs: [local('sq', 1), local('sq', 2, { skipped: true })] })
  assert.equal(o.sessions, 'Pas gennemført: 1 af 2 planlagt.')
  assert.equal(o.sets, 'Sæt bekræftet: 1. Sprunget over: 1.')
  assert.match(o.note, /logget eller sprunget over/)
})

test('pending, foreign, out-of-range, invalid and future logs do not fill positions', () => {
  for (const bad of [local('sq', 1, { _optimistic: true }), local('other', 1), local('sq', 0),
    local('sq', 3), local('sq', 1.5), local('sq', '1'), local('sq', 1, { logged_at: '2026-11-01' }),
    local('sq', 1, { logged_at: '2026-11-05' }), local('sq', 1, { logged_at: '2026-11-04T13:00:00Z' }),
    local('sq', 1, { logged_at: '2026-11-03T24:00:00Z' })]) {
    assert.equal(overview({ exerciseLogs: [bad] }).sets, 'Sæt bekræftet: 0. Sprunget over: 0.')
  }
})

test('duplicate positions count once; conflicting positions count neither', () => {
  const row = local('sq', 1)
  assert.match(overview({ exerciseLogs: [row, { ...row, id: 'retry' }] }).sets, /bekræftet: 1\./)
  for (const change of [{ skipped: true }, { weight: 150 }]) {
    assert.match(overview({ exerciseLogs: [{ ...row, id: 'a' }, { ...row, id: 'b', ...change }] }).sets, /bekræftet: 0\./)
  }
})

test('missing and stale program or absent local logs cannot fabricate zero completion', () => {
  for (const week of [undefined, { ...currentWeek, start_date: '2026-10-26' },
    { ...currentWeek, start_date: '2026-11-09' }, { ...currentWeek, start_date: '2026-02-30' }]) {
    assert.match(overview({ currentWeek: week }).sessions, /programuge mangler/)
  }
  assert.equal(overview({ exerciseLogs: undefined }).sessions, 'Pas: gennemført antal mangler. 2 planlagt.')
  assert.match(overview({ exerciseLogs: undefined }).sets, /logdata.*mangler/)
})

test('empty plan is zero planned; malformed plan is explicitly missing', () => {
  assert.equal(overview({ currentWeek: { ...currentWeek, sessions: [] } }).sessions, 'Pas gennemført: 0 af 0 planlagt.')
  for (const sessions of [[{}], [{ exercises: [ex('dup'), ex('dup')] }],
    [{ exercises: [ex('bad', 'Squat', 1.5)] }]]) {
    assert.match(overview({ currentWeek: { ...currentWeek, sessions } }).sessions, /mangler/)
  }
})

test('weekly best e1RM compares same lift and rep zone with Danish decimals', () => {
  const o = overview({ exerciseLogs: [local('sq', 1, { weight: '102,5' })],
    fremgangLogs: [history('Back squat', '2026-10-28', 100)] })
  assert.equal(lift(o).value, '112,8 kg e1RM')
  assert.match(lift(o).message, /102,5 kg × 3\. 1-3 gentagelser/)
  assert.match(lift(o).message, /Sidste uge: 110 kg e1RM\. Ændring: \+2,8 kg e1RM/)
})

test('best estimate is selected independently of input order; flat and negative deltas are neutral', () => {
  for (const [weight, expected] of [[100, 'Ændring: 0 kg'], [90, 'Ændring: -11 kg']]) {
    const rows = [local('sq', 1, { weight }), local('sq', 2, { weight: 80 })]
    const extra = { exerciseLogs: rows, fremgangLogs: [history('Squat', '2026-10-28', 100)] }
    assert.match(lift(overview(extra)).message, new RegExp(expected))
    assert.deepEqual(overview(extra), overview({ ...extra, exerciseLogs: [...rows].reverse() }))
  }
})

test('missing prior week and incompatible rep zone have explicit messages', () => {
  for (const fremgangLogs of [[], [history('Squat', '2026-10-20', 100)],
    [history('Squat', '2026-10-28', 100, 6)]]) {
    const row = lift(overview({ exerciseLogs: [local('sq', 1)], fremgangLogs }))
    assert.equal(row.value, '110 kg e1RM')
    assert.match(row.message, /Sidste uge mangler.*samme rep-område/)
    assert.doesNotMatch(row.message, /Ændring:/)
  }
})

test('four main lifts stay separate and variants never supply comparison data', () => {
  const names = ['Squat', 'Bench top set', 'Deadlift', 'Sumo deadlift']
  const logs = names.flatMap((name, i) => [history(name, '2026-10-28', 100 + 10 * i),
    history(name, '2026-11-03', 105 + 10 * i)])
  logs.push(history('Front squat', '2026-11-03', 999))
  const o = overview({ fremgangLogs: logs })
  assert.deepEqual(o.lifts.map(r => r.lift), ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
  for (const row of o.lifts) assert.match(row.message, /Ændring: \+5,5 kg/)
})

test('deload and light sets count as confirmed but cannot establish weekly strength', () => {
  for (const week of [{ ...currentWeek, block_name: 'Deload' }, { ...currentWeek,
    sessions: [{ exercises: [ex('sq', 'Squat backoff')] }] }]) {
    const o = overview({ currentWeek: week, exerciseLogs: [local('sq', 1)] })
    assert.match(o.sets, /bekræftet: 1/)
    assert.equal(lift(o).value, undefined)
  }
})

test('local undo owns the current week and does not revive saved historical data', () => {
  const fremgangLogs = [history('Squat', '2026-11-03', 200, 3, { exercise_id: 'sq' })]
  assert.equal(lift(overview({ fremgangLogs, exerciseLogs: [] })).value, undefined)
})

test('loading and missing history do not display a strength delta', () => {
  for (const extra of [{ fremgangLoading: true }, { fremgangLogs: undefined }]) {
    const o = overview({ exerciseLogs: [local('sq', 1)], ...extra })
    assert.equal(lift(o).value, undefined)
    assert.match(lift(o).message, /ikke klar/)
    assert.match(o.sets, /bekræftet: 1/)
  }
})

test('Danish calendar midnight and previous-week boundaries are respected', () => {
  const sunday = new Date('2026-11-01T23:30:00Z') // Monday in Denmark
  const p = props({ now: sunday, exerciseLogs: [local('sq', 1, { logged_at: '2026-11-01T23:10:00Z' })],
    fremgangLogs: [history('Squat', '2026-11-01', 95)] })
  const o = analysisModel(p, sunday).weekOverview
  assert.match(o.period, /^02\.11\.2026/)
  assert.match(o.sets, /bekræftet: 1/)
  assert.match(lift(o).message, /Ændring: \+5,5 kg/)
})

test('render places overview above unchanged questions, escapes text and preserves navigation', () => {
  const calls = []
  const dom = Analysis(props({ setTab: tab => calls.push(tab), currentWeek: { ...currentWeek, block_name: '<img src=x>' } }))
  assert.deepEqual(dom.querySelectorAll('h2').map(n => n.textContent), ['Ugeoversigt', 'De seneste 4 uger', 'RPE de seneste 6 uger', ...QUESTIONS])
  assert.equal(dom.querySelectorAll('[data-analysis-week]').length, 1)
  assert.equal(dom.querySelectorAll('h3').length, 4)
  assert.equal(dom.querySelectorAll('img').length, 0)
  dom.querySelectorAll('button').forEach(b => b.dispatchEvent({ type: 'click' }))
  assert.deepEqual(calls, ['hjem', 'hjem', 'program'])
})

test('OFF never reads overview props; frozen data is unchanged', () => {
  assert.equal(Analysis({ entropi2: false, get currentWeek() { throw Error('OFF read') } }), null)
  const p = props({ exerciseLogs: [local('sq', 1)] })
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } }
  const snapshot = JSON.stringify(p); freeze(p)
  Analysis(p)
  assert.equal(JSON.stringify(p), snapshot)
})


test('render exposes empty, partial, full, missing-history and decimal snapshots', () => {
  const cases = [
    [{}, ['Pas gennemført: 0 af 2 planlagt.', 'Sæt bekræftet: 0.']],
    [{ exerciseLogs: [local('sq', 1)] }, ['Pas gennemført: 0 af 2 planlagt.', 'Sæt bekræftet: 1.']],
    [{ exerciseLogs: [local('sq', 1), local('sq', 2), local('bp', 1)] }, ['Pas gennemført: 2 af 2 planlagt.', 'Sæt bekræftet: 3.']],
    [{ exerciseLogs: [local('sq', 1, { weight: '102,5' })] }, ['112,8 kg e1RM', 'Sidste uge mangler sammenlignelige']],
    [{ fremgangLogs: undefined }, ['Løftehistorik mangler.', 'Sammenligningen er ikke klar.']],
    [{ fremgangLogs: [history('Bench', '2026-11-03', 80), history('Sumo deadlift', '2026-11-03', 160)] }, ['88 kg e1RM', '176 kg e1RM']],
  ]
  for (const [extra, texts] of cases) {
    const dom = Analysis(props(extra))
    for (const text of texts) assert.ok(dom.textContent.includes(text), text)
    assert.deepEqual(dom.querySelectorAll('h2').map(n => n.textContent), ['Ugeoversigt', 'De seneste 4 uger', 'RPE de seneste 6 uger', ...QUESTIONS])
  }
})

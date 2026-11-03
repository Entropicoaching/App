import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyShareSummary } from './weeklyShareSummary.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const week = { start_date: '2026-11-02', block_name: 'Styrke', sessions: [
  { exercises: [{ id: 'sq', name: 'Squat', sets: 2 }] },
  { exercises: [{ id: 'bp', name: 'Bænkpres', sets: 1 }] },
] }
const row = (exercise_id = 'sq', set_number = 1, extra = {}) => ({
  exercise_id, set_number, logged_at: '2026-11-03T10:00:00Z',
  weight: 100, reps_completed: 3, rpe_actual: 8, rpe_source: 'athlete', ...extra,
})
const props = extra => ({ currentWeek: week, exerciseLogs: [], fremgangLogs: [], historicalMealLogs: [], ...extra })
const summary = extra => weeklyShareSummary(props(extra), now)

test('empty loaded week gives short readable zero snapshot', () => {
  assert.equal(summary(), [
    'Ugesammendrag 02.11.2026 til 08.11.2026',
    'Pas gennemført: 0 af 2 planlagt.',
    'Tonnage: 0 kg.',
    'Bedste sæt: ingen sammenlignelige tunge sæt.',
    'Gennemsnitlig RPE: ingen atletregistreringer.',
    'Kostdage logget: 0 af 7.',
    'Ugen kan være ufuldstændig. Pas tæller loggede eller oversprungne sæt; kostdage er dage med en log, ikke nødvendigvis hele kostdage.',
  ].join('\n'))
})

test('partial week uses actual sets, Danish decimals and distinct meal days', () => {
  const text = summary({ exerciseLogs: [row('sq', 1, { weight: '102,5', rpe_actual: '8,5' }), row('sq', 2)],
    historicalMealLogs: [{ date: '2026-11-02', kcal: 0 }, { date: '2026-11-02', kcal: 500 },
      { date: '2026-11-03', kcal: '400,5' }] })
  assert.match(text, /Pas gennemført: 1 af 2 planlagt/)
  assert.match(text, /Tonnage: 607,5 kg/)
  assert.match(text, /Squat 102,5 kg × 3 \(112,8 kg e1RM\)/)
  assert.match(text, /RPE: 8,3 \(2 atletregistreringer\)/)
  assert.match(text, /Kostdage logget: 2 af 7/)
})

test('full week counts skips but skips and optimistic sets supply no metrics', () => {
  const text = summary({ exerciseLogs: [row(), row('sq', 2, { skipped: true }), row('bp')] })
  assert.match(text, /Pas gennemført: 2 af 2/)
  assert.match(text, /Tonnage: 600 kg/)
  assert.match(text, /RPE: 8 \(2 atletregistreringer\)/)
  assert.match(summary({ exerciseLogs: [row('sq', 1, { _optimistic: true })] }), /Tonnage: 0 kg/)
})

test('missing, stale and malformed plans and absent arrays stay explicitly unknown', () => {
  for (const currentWeek of [undefined, {}, { ...week, start_date: '2026-10-26' },
    { ...week, start_date: '2026-11-09' }, { ...week, start_date: '2026-02-30' },
    { ...week, sessions: [{}] }, { ...week, sessions: [{ exercises: [{ id: 'a', sets: 1.5 }] }] }]) {
    const text = summary({ currentWeek, exerciseLogs: [row()] })
    assert.match(text, /Pas gennemført: data mangler/)
    assert.match(text, /Tonnage: data mangler/)
  }
  const text = summary({ exerciseLogs: undefined, historicalMealLogs: undefined })
  assert.match(text, /RPE: data mangler/)
  assert.match(text, /Kostdage logget: data mangler/)
})

test('bad numeric metrics never become NaN, Infinity or negative tonnage', () => {
  for (const weight of [NaN, Infinity, -1, '', null, {}, '1e999', true]) {
    const text = summary({ exerciseLogs: [row('sq', 1, { weight })] })
    assert.match(text, /Tonnage: 0 kg \(kun gyldige sæt\)/)
    assert.doesNotMatch(text, /NaN|Infinity/)
    assert.match(text, /Bedste sæt: ingen sammenlignelige/)
  }
  for (const reps_completed of [0, -1, 1.5, Infinity, null, '']) {
    assert.match(summary({ exerciseLogs: [row('sq', 1, { reps_completed })] }), /Tonnage: 0 kg/)
  }
  assert.match(summary({ exerciseLogs: [row('sq', 1, { weight: Number.MAX_VALUE })] }), /Tonnage: kan ikke beregnes/)
})

test('invalid and unchosen RPE is excluded; each chosen valid set weighs equally', () => {
  for (const change of [{ rpe_actual: 11 }, { rpe_actual: -1 }, { rpe_actual: '' },
    { rpe_actual: Infinity }, { rpe_source: 'default' }, { rpe_source: undefined }]) {
    assert.match(summary({ exerciseLogs: [row('sq', 1, change)] }), /RPE: ingen atletregistreringer/)
  }
  assert.match(summary({ exerciseLogs: [row('sq', 1, { rpe_actual: 0 }), row('sq', 2, { rpe_actual: 10 })] }), /RPE: 5 \(2 atletregistreringer\)/)
})

test('duplicates count once; conflicting retries never select an arbitrary RPE or weight', () => {
  const a = row()
  assert.equal(summary({ exerciseLogs: [a, { ...a, id: 'retry' }] }), summary({ exerciseLogs: [a] }))
  for (const change of [{ weight: 200 }, { rpe_actual: 9 }, { rpe_source: 'default' }, { skipped: true }]) {
    const rows = [a, { ...a, ...change }]
    assert.match(summary({ exerciseLogs: rows }), /Tonnage: 0 kg/)
    assert.equal(summary({ exerciseLogs: rows }), summary({ exerciseLogs: rows.reverse() }))
  }
})

test('foreign, invalid, outside-week and future positions are ignored', () => {
  for (const change of [{ exercise_id: 'other' }, { set_number: 3 }, { set_number: '1' },
    { logged_at: undefined }, { logged_at: '2026-02-30' }, { logged_at: '2026-11-01' },
    { logged_at: '2026-11-05' }, { logged_at: '2026-11-04T13:00:00Z' },
    { logged_at: '2026-11-03T24:00:00Z' }, { logged_at: '2026-11-03T10:00:00' },
    { logged_at: '2026-11-03T10:00:00+01:60' }]) {
    assert.equal(summary({ exerciseLogs: [row('sq', 1, change)] }), summary())
  }
})

test('nutrition accepts existing date/kcal projection; excludes receipts, invalid and future data', () => {
  const historicalMealLogs = [null, { date: '2026-11-02', kcal: 200 },
    { date: '2026-11-03', kcal: 0, meal: ' [appData2-day-v1]receipt' },
    { date: '2026-11-03', kcal: 1, _optimistic: true },
    { date: '2026-11-04', kcal: -1 }, { date: '2026-11-04', kcal: null },
    { date: '2026-11-05', kcal: 100 }, { date: '2026-11-01', kcal: 100 },
    { date: '2026-02-30', kcal: 100 }, { date: '2026-11-03T00:00:00Z', kcal: 100 }]
  assert.match(summary({ historicalMealLogs }), /Kostdage logget: 1 af 7/)
})

test('undo owns current exercises; backoff and deload add volume without heavy best sets', () => {
  const saved = { ...row(), exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }
  assert.match(summary({ fremgangLogs: [saved] }), /Bedste sæt: ingen sammenlignelige/)
  for (const currentWeek of [{ ...week, block_name: 'Deload' }, { ...week,
    sessions: [{ exercises: [{ id: 'sq', name: 'Squat backoff', sets: 2 }] }] }]) {
    const text = summary({ currentWeek, exerciseLogs: [row()] })
    assert.match(text, /Tonnage: 300 kg/)
    assert.match(text, /Bedste sæt: ingen sammenlignelige/)
  }
  for (const extra of [{ fremgangLoading: true }, { fremgangLogs: undefined }]) {
    assert.match(summary({ exerciseLogs: [row()], ...extra }), /Bedste sæt: data mangler/)
  }
})

test('Danish midnight, explicit date and frozen snapshots are deterministic', () => {
  const midnight = new Date('2026-11-01T23:30:00Z')
  const input = props({ exerciseLogs: [row('sq', 1, { logged_at: '2026-11-01T23:10:00Z' })] })
  const freeze = value => { if (object(value)) { Object.values(value).forEach(freeze); Object.freeze(value) } }
  const object = v => v && typeof v === 'object'
  const before = JSON.stringify(input); freeze(input)
  const text = weeklyShareSummary(input, midnight)
  assert.match(text, /^Ugesammendrag 02.11.2026/)
  assert.match(text, /Tonnage: 300 kg/)
  assert.equal(JSON.stringify(input), before)
  assert.equal(weeklyShareSummary(input, midnight.toISOString()), text)
  for (const bad of [undefined, null, '', '2026-11-04', new Date('bad'), '2026-02-30T12:00:00Z']) {
    assert.equal(weeklyShareSummary(input, bad), 'Ugesammendrag: dato mangler eller er ugyldig.')
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarFixture } from './testCalendar.fixture.mjs'
import { homeModel, startHomeSession } from './entropi2/home/homeModel.mjs'
import { install } from './athlete/prog3Loader.mjs'
import { mount, nodes } from './athlete/prog3Dom.mjs'
import { programQolFixture } from './athlete/programQolFixture.mjs'

// Only this import uses the existing synthetic JSX renderer. SQL below imports
// its actual React/SQL fixture after this hook has been removed.
const hook = install()
let Program
try { Program = (await import('./athlete/ProgramTab.jsx')).default }
finally { hook.deregister() }

test('Sunday/Monday and year rollover retain exact future days, session identity and stale-day denial', () => {
  for (const [today, monday, weekday, expectedDates] of [
    ['2026-11-08', '2026-11-02', 6, ['2026-11-09', '2026-11-10', '2026-11-11']],
    ['2026-11-09', '2026-11-09', 0, ['2026-11-10', '2026-11-11', '2026-11-12']],
    ['2026-12-31', '2026-12-28', 3, ['2027-01-01', '2027-01-02', '2027-01-03']],
    ['2027-01-01', '2026-12-28', 4, ['2027-01-02', '2027-01-03', '2027-01-04']],
    ['2027-01-04', '2027-01-04', 0, ['2027-01-05', '2027-01-06', '2027-01-07']],
  ]) {
    const calendar = calendarFixture(today)
    assert.deepEqual(calendar.dates, expectedDates)
    const session = { id: 'rollover-pass', weekday, exercises: [{ id: 'rollover-lift', sets: 1 }] }
    const week = { id: 'rollover-week', start_date: monday, week_number: 1, sessions: [session] }
    const started = [], props = { enabled: true, athlete: { id: 'rollover-athlete' }, allWeeks: [week], currentWeek: week,
      exerciseLogs: [], onStartSession: (...args) => { started.push(args); return true } }
    const now = new Date(today + 'T12:00:00Z'), shown = homeModel({ ...props, now })
    assert.equal(shown.kind, 'today')
    assert.strictEqual(shown.target.week, week); assert.strictEqual(shown.target.session, session)
    assert.equal(startHomeSession(props, shown, now), true)
    assert.deepEqual(started, [['rollover-pass', 'rollover-week']])
    assert.equal(startHomeSession(props, shown, new Date(expectedDates[0] + 'T12:00:00Z')), false)
    assert.equal(started.length, 1, 'retained card cannot write on a different day')
  }
})

test('incomplete reads stay PLAN; empty Monday passes may be TODAY but never claim completion', t => {
  const originalDate = Date
  for (const [day, expected] of [
    ['2026-11-08', 'plan'], ['2026-11-09', 'today'],
    ['2026-12-31', 'plan'], ['2027-01-01', 'plan'],
  ]) {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(day + 'T12:00:00Z') })
    try {
      for (const incomplete of [true, false]) {
        const props = programQolFixture({ exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, skipped: false }] })
        if (incomplete) props.allWeeks[1].readEvidence = { complete: false }
        else props.allWeeks[1].sessions[0].exercises = []
        const tree = mount(Program, props).render()
        const passes = nodes(tree, n => n.props['data-program-session-tone'])
        assert.equal(passes[0].props['data-program-session-tone'], incomplete ? 'plan' : expected, day)
        assert.ok(passes.every(n => !['done', 'skipped'].includes(n.props['data-program-session-tone'])))
      }
    } finally { t.mock.timers.reset() }
    assert.strictEqual(Date, originalDate)
  }
})

test('real PGlite clock: later approval cannot authorize yesterday, original week constraint and RLS remain enforced', { timeout: 20000 }, async t => {
  const { withDatabase, athleteId, coachId, owner, stranger } = await import('./entropi2/kostplan/coach/generatorSql.fixture.mjs')
  const { storedSnapshot, uuid } = await import('./entropi2/kostplan/dailyReference.fixture.mjs')
  const { createPlanAdapter } = await import('./entropi2/kostplan/planAdapter.mjs')
  let database
  await withDatabase(async f => {
    database = f.db
    const { today, day } = f.calendar, parent = uuid(99001), version = uuid(99002), s = storedSnapshot(137, 0)
    const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
    await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [parent, athleteId, day(-1)])
    await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
      values($1,$2,1,$3,$3,$4,'Calendar control',$5,$6,$7)`, [version, parent, day(-1), JSON.stringify(basis), s.goal, s.intensity, JSON.stringify(s.meals)])
    await f.db.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values($1,'coach')", [version])
    const { rows: [ledger] } = await f.db.query(`select coach_id,
      (approved_at at time zone 'Europe/Copenhagen')::date::text as approved_day,
      week_start = date_trunc('week', approved_at at time zone 'Europe/Copenhagen')::date as coherent_week,
      approved_at >= $1::timestamptz and approved_at <= clock_timestamp() as real_time
      from public.kostplan_v1_approvals where version_id=$2`, [f.calendar.approvedAt, version])
    assert.deepEqual(ledger, { coach_id: coachId, approved_day: today, coherent_week: true, real_time: true })
    t.diagnostic(JSON.stringify({ sqlToday: today, sqlWeekStart: f.calendar.weekStart, sampledSqlTimestamp: f.calendar.approvedAt, ledger }))
    const adapter = date => createPlanAdapter({ enabled: true, client: f.client, athleteId, date })
    await f.login(owner)
    assert.equal(await adapter(day(-1)).loadActive(), null)
    assert.equal((await adapter(today).loadActive()).revision, version)
    assert.equal((await adapter(day(1)).loadActive()).revision, version)
    await f.login(stranger)
    assert.equal(await adapter(today).loadActive(), null)
    await f.db.exec('reset role')
    await assert.rejects(f.db.query('update public.kostplan_v1_approvals set week_start=week_start+7 where version_id=$1', [version]), { code: '23514' })
    assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
  })
  assert.equal(database.closed, true)
})

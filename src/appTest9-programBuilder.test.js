import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createWeekDeletionQueue } from './dashboard/weekDeletion.js'

// Hele originalmodulet importeres. Kun databasegrænsen erstattes.
// Alle kald holdes i hukommelsen. Ingen klient, net, DOM eller storage oprettes.
const key = Symbol.for('APP-TEST9.database')
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase') return {
      url: 'data:text/javascript,export const supabase = { from(table) { return globalThis[Symbol.for("APP-TEST9.database")].from(table) } }; export const withRetry = fn => fn()',
      shortCircuit: true,
    }
    // Appens egne imports uden filendelse skal også kunne køres af Node.
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(specifier + '.js', context)
    }
    return nextResolve(specifier, context)
  },
})
let lavProgramHandlinger, lavLaesninger, computePhases, nextWeekStartDate, fillMissingWeekDates
try {
  ;({ lavProgramHandlinger } = await import('./dashboard/programHandlinger.js'))
  ;({ lavLaesninger } = await import('./dashboard/laesninger.js'))
  ;({ computePhases } = await import('./dashboardShared.js'))
  ;({ nextWeekStartDate, fillMissingWeekDates } = await import('./weekDates.js'))
} finally { guard.deregister() }

function setup(overrides = {}) {
  const calls = [], state = {}, refresh = [], confirmations = []
  const timers = new Map()
  let now = 0
  const weekDeletionQueue = createWeekDeletionQueue(value => { state.pending = value }, {
    now: () => now,
    later: (fn, ms) => { const id = Symbol(); timers.set(id, { fn, due: now + ms }); return id },
    cancel: id => timers.delete(id),
  })
  async function elapse(ms) {
    now += ms
    for (const [id, timer] of timers) if (timer.due <= now) { timers.delete(id); await timer.fn() }
  }
  let sequence = 0
  const db = {
    from(table) {
      let call
      const query = {
        insert(value) { call = { table, op: 'insert', value: structuredClone(value) }; calls.push(call); return query },
        update(value) { call = { table, op: 'update', value: structuredClone(value) }; calls.push(call); return query },
        delete() { call = { table, op: 'delete' }; calls.push(call); return query },
        eq(field, value) { call.where = { field, value }; return query },
        select() { return query },
        single() { return Promise.resolve({ data: { id: `new-${++sequence}` }, error: null }) },
        then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject) },
      }
      return query
    },
  }
  globalThis[key] = db
  const setters = Object.fromEntries([
    'AddingWeek', 'WeekForm', 'EditingWeek', 'AddingSession', 'SessionForm',
    'EditingSession', 'OpenSessionId', 'OpenWeekId', 'ProgramBlockStart',
    'CopyingSession', 'CopyingExercise', 'AddingExercise', 'ExerciseForm',
    'EditingExercise', 'CopyingWeek', 'WeekDateFill', 'ShowBlockPlanner', 'CalBlockAthlete',
  ].map(name => [`set${name}`, value => {
    const next = typeof value === 'function' ? value(state[name]) : value
    ;(state[name] ??= []).push(next)
  }]))
  const args = {
    ...setters,
    weeks: [], athleteLogs: [], exerciseLibrary: [], athletes: [{ id: 'a' }],
    selectedAthlete: { id: 'a' }, calendarWeeks: {}, blockPlan: [],
    weekForm: {}, sessionForm: {}, exerciseForm: { name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' },
    askConfirm: (message, action) => confirmations.push({ message, action }),
    fetchWeeks: id => { refresh.push(id) },
    fetchCalendarWeeks: async () => {}, fetchAthleteWeekSummaries: () => {},
    showFlash: () => {}, weekDeletionQueue, setWeeks: () => {}, ...overrides,
  }
  return { h: lavProgramHandlinger(args), calls, state, refresh, confirmations, elapse, weekDeletionQueue }
}
const ex = (id, order, extra = {}) => ({ id, exercise_order: order, name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8', note: 'Rolig', recommended_weight: 100, ...extra })
const sn = (id, order, exercises = []) => ({ id, session_order: order, title: id, weekday: 2, exercises })
const wk = (id, number, sessions = [], extra = {}) => ({ id, week_number: number, block_name: 'Styrke', sessions, ...extra })
const writes = (f, table, op) => f.calls.filter(c => c.table === table && c.op === op)
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value) }
  return value
}

test('APP-TEST9 tomt program har ingen blok eller viste uger', () => {
  const f = setup()
  assert.deepEqual(computePhases([]), [])
  assert.equal(f.h.programActiveStart(), null)
  assert.deepEqual(f.h.programShownWeeks(), [])
  assert.deepEqual(f.calls, [])
})

test('APP-TEST9 første uge oprettes som uge 1 med tomme metadata', async () => {
  const f = setup()
  await f.h.addWeek()
  assert.deepEqual(f.calls, [{ table: 'weeks', op: 'insert', value: {
    athlete_id: 'a', week_number: 1, block_name: null, coach_note: null, block_description: null, start_date: null,
  } }])
  assert.deepEqual(f.refresh, ['a'])
  assert.deepEqual(f.state.AddingWeek, [false])
})

test('APP-TEST9 ret uge bevarer eksplicit dato og ugenummer', async () => {
  const f = setup({ weekForm: { week_number: '52', start_date: '2026-12-28', block_name: 'Peak', coach_note: 'Klar', block_description: 'Form' } })
  await f.h.updateWeek('u52')
  assert.deepEqual(f.calls, [{ table: 'weeks', op: 'update', where: { field: 'id', value: 'u52' }, value: {
    week_number: 52, start_date: '2026-12-28', block_name: 'Peak', coach_note: 'Klar', block_description: 'Form',
  } }])
  assert.deepEqual(f.state.EditingWeek, [null])
})

test('APP-TEST9 52 uger grupperes i rækkefølge uden at samle adskilte blokke', () => {
  const weeks = frozen(Array.from({ length: 52 }, (_, i) => wk(`u${i + 1}`, i + 1, [], { block_name: i < 20 || i >= 40 ? 'Styrke' : 'Deload' })))
  const phases = computePhases(weeks)
  assert.deepEqual(phases.map(p => [p.name, p.weeks.length]), [['Styrke', 20], ['Deload', 20], ['Styrke', 12]])
  assert.deepEqual(phases.flatMap(p => p.weeks), weeks)
  const f = setup({ weeks, openWeekId: 'u23' })
  assert.equal(f.h.programActiveStart(), 21)
  assert.deepEqual(f.h.programShownWeeks().map(w => w.week_number), Array.from({ length: 20 }, (_, i) => i + 21))
  assert.equal(setup({ weeks, programBlockStart: 'all' }).h.programShownWeeks(), weeks)
})

test('APP-TEST9 efter 52 uger bliver næste uge 53 selv ved usorteret input', async () => {
  const weeks = frozen(Array.from({ length: 52 }, (_, i) => wk(`u${52 - i}`, 52 - i)))
  const f = setup({ weeks })
  await f.h.addWeek()
  assert.equal(f.calls[0].value.week_number, 53)
})

test('APP-TEST9 datokopi over årsskifte bruger højeste daterede ugenummer', () => {
  const weeks = frozen([wk('u52', 52, [], { start_date: '2026-12-28' }), wk('u51', 51, [], { start_date: '2026-12-21' })])
  assert.equal(nextWeekStartDate(weeks), '2027-01-04')
  assert.equal(nextWeekStartDate([], new Date('2026-12-31T12:00:00')), '2027-01-04')
  assert.deepEqual(fillMissingWeekDates([]), [])
})

test('APP-TEST9 52 ugers datoudfyldning bevarer anker og giver 51 datoer', () => {
  const weeks = frozen(Array.from({ length: 52 }, (_, i) => wk(`u${i + 1}`, i + 1, [], { start_date: i === 26 ? '2026-12-28' : null })))
  const rows = fillMissingWeekDates(weeks)
  assert.equal(rows.length, 51)
  assert.deepEqual(rows[0], { id: 'u1', week_number: 1, start_date: '2026-06-29' })
  assert.deepEqual(rows.at(-1), { id: 'u52', week_number: 52, start_date: '2027-06-21' })
  assert.equal(rows.some(r => r.id === 'u27'), false)
  assert.equal(new Set(rows.map(r => r.start_date)).size, 51)
})

test('APP-TEST9 ugekopi over årsskifte bevarer pas øvelser sæt og kilde', async () => {
  const source = wk('u52', 52, [sn('s', 4, [ex('e', 7)])], { start_date: '2026-12-28', coach_note: 'Note', block_description: 'Formål' })
  const weeks = frozen([source])
  const f = setup({ weeks })
  await f.h.copyWeek('u52')
  assert.deepEqual(f.calls, [
    { table: 'weeks', op: 'insert', value: { athlete_id: 'a', week_number: 53, block_name: 'Styrke', coach_note: 'Note', block_description: 'Formål', start_date: '2027-01-04' } },
    { table: 'sessions', op: 'insert', value: { week_id: 'new-1', title: 's', session_order: 4, weekday: 2 } },
    { table: 'exercises', op: 'insert', value: { session_id: 'new-2', name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8', note: 'Rolig', exercise_order: 7, recommended_weight: 100 } },
  ])
  assert.deepEqual(f.state.CopyingWeek, [true, false])
  assert.deepEqual(f.state.OpenWeekId, ['new-1'])
  assert.deepEqual(f.refresh, ['a'])
})

test('APP-TEST9 ukendt ugekopi skriver intet', async () => {
  const f = setup()
  await f.h.copyWeek('ukendt')
  assert.deepEqual(f.calls, [])
})

test('APP-TEST9 dobbelt ugekopi under samme ventende kald opretter kun én uge', async () => {
  const f = setup({ weeks: [wk('u1', 1, [], { start_date: '2026-12-28' })] })
  await Promise.all([f.h.copyWeek('u1'), f.h.copyWeek('u1')])
  assert.equal(writes(f, 'weeks', 'insert').length, 1)
  assert.deepEqual(f.state.CopyingWeek, [true, false])
})

test('APP-TEST9 slet uge afventer bekræftelse og 10 sekunders fortrydelsesfrist', async () => {
  const f = setup({ weeks: [wk('u2', 2)], openWeekId: 'u2' })
  f.h.deleteWeek('u2')
  assert.deepEqual(f.calls, [])
  assert.equal(f.confirmations.length, 1)
  await f.confirmations[0].action()
  await f.elapse(9999)
  assert.deepEqual(f.calls, [])
  assert.equal(f.state.pending[0].weekId, 'u2')
  await f.elapse(1)
  assert.deepEqual(f.calls, [{ table: 'weeks', op: 'delete', where: { field: 'id', value: 'u2' } }])
  assert.deepEqual(f.state.pending, [])
})

test('APP-TEST9 fortryd bevarer uge pas øvelser og logs uden databaseskrivning', async () => {
  const weeks = frozen([wk('u2', 2, [sn('s', 0, [ex('e', 0)])])])
  const f = setup({ weeks, athleteLogs: [{ exercise_id: 'e', weight: 100 }] })
  f.h.deleteWeek('u2')
  f.confirmations[0].action()
  await f.elapse(9999)
  assert.equal(f.weekDeletionQueue.undo('u2'), true)
  await f.elapse(1)
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.state.pending, [])
})

test('APP-TEST9 blokkopi vælger kun en sammenhængende blok med samme navn', async () => {
  const f = setup({ weeks: [wk('u1', 1), wk('u2', 2), wk('u3', 3, [], { block_name: 'Deload' }), wk('u4', 4)] })
  assert.equal(await f.h.copyBlock('u1', 'reps'), true)
  assert.deepEqual(writes(f, 'weeks', 'insert').map(c => [c.value.week_number, c.value.block_name]), [[5, 'Styrke (kopi)'], [6, 'Styrke (kopi)']])
  assert.deepEqual(f.state.ProgramBlockStart, [5])
})

test('APP-TEST9 kopiering venter på en igangværende ugesletning', async () => {
  const f = setup({ weeks: [wk('u1', 1)] })
  f.h.deleteWeek('u1')
  f.confirmations[0].action()
  assert.equal(await f.h.copyWeek('u1'), false)
  assert.deepEqual(f.calls, [])
  f.weekDeletionQueue.undo('u1')
})

test('APP-TEST9 færdig kopi åbner ikke programmet for en anden atlet', async () => {
  const f = setup({ weeks: [wk('u1', 1)], currentProgramAthleteRef: { current: 'anden-atlet' } })
  assert.equal(await f.h.copyWeek('u1', 'weight'), true)
  assert.deepEqual(f.refresh, [])
  assert.equal(f.state.OpenWeekId, undefined)
})

test('APP-TEST9 nyt pas og rettelse bevarer ugedag nul', async () => {
  const f = setup({ weeks: [wk('u1', 1, [sn('s1', 0)])], sessionForm: { title: 'Mandag', weekday: 0 } })
  await f.h.addSession('u1')
  await f.h.updateSession('s1')
  assert.deepEqual(f.calls, [
    { table: 'sessions', op: 'insert', value: { week_id: 'u1', title: 'Mandag', session_order: 1, weekday: 0 } },
    { table: 'sessions', op: 'update', value: { title: 'Mandag', weekday: 0 }, where: { field: 'id', value: 's1' } },
  ])
})

test('APP-TEST9 flyt pas i 52 uger renummererer kun målugen uden inputmutation', async () => {
  const weeks = frozen(Array.from({ length: 52 }, (_, i) => wk('u' + (i + 1), i + 1, i === 0 ? [sn('c', 8), sn('b', 0), sn('a', 0)] : [sn('anden-' + i, 0)])))
  const f = setup({ weeks })
  await f.h.reorderSession('u1', 'b', 'up')
  assert.deepEqual(f.calls, [
    { table: 'sessions', op: 'update', value: { session_order: 1 }, where: { field: 'id', value: 'a' } },
    { table: 'sessions', op: 'update', value: { session_order: 2 }, where: { field: 'id', value: 'c' } },
  ])
  assert.deepEqual(f.refresh, ['a'])
})

test('APP-TEST9 flyt pas ved grænser og ukendt id skriver intet', async () => {
  const f = setup({ weeks: [wk('u1', 1, [sn('a', 0), sn('b', 1)])] })
  await f.h.reorderSession('u1', 'a', 'up')
  await f.h.reorderSession('u1', 'b', 'down')
  await f.h.reorderSession('u1', 'ukendt', 'down')
  assert.deepEqual(f.calls, [])
})

test('APP-TEST9 slet pas afventer bekræftelse og bevarer anden åben session', async () => {
  const f = setup({ openSessionId: 'anden' })
  f.h.deleteSession('s')
  assert.deepEqual(f.calls, [])
  await f.confirmations[0].action()
  assert.deepEqual(f.calls, [{ table: 'sessions', op: 'delete', where: { field: 'id', value: 's' } }])
  assert.equal(f.state.OpenSessionId, undefined)
})

test('APP-TEST9 ny og rettet øvelse bruger bibliotekets navn og antal sæt', async () => {
  const f = setup({ weeks: [wk('u1', 1, [sn('s', 0, [ex('e', 0)])])], exerciseLibrary: [{ name: 'Squat' }],
    exerciseForm: { name: ' squat ', sets: '4', reps: '3-5', intensity: ' 8 ', intensityPrefix: 'RPE', note: 'Pause' } })
  await f.h.addExercise('s')
  await f.h.updateExercise('e')
  assert.deepEqual(f.calls, [
    { table: 'exercises', op: 'insert', value: { session_id: 's', name: 'Squat', sets: 4, reps: '3-5', intensity: 'RPE 8', note: 'Pause', exercise_order: 1 } },
    { table: 'exercises', op: 'update', value: { name: 'Squat', sets: 4, reps: '3-5', intensity: 'RPE 8', note: 'Pause' }, where: { field: 'id', value: 'e' } },
  ])
})

test('APP-TEST9 intensitet kan bygges og læses uden databasekald', () => {
  for (const [prefix, value, stored] of [['RPE', '8.5', 'RPE 8.5'], ['%', '75', '75%'], ['Tid', '30', '30 sek'], ['Tid', '2 min', '2 min'], ['Fri tekst', 'let', 'let'], ['RPE', '', null]]) {
    const f = setup({ exerciseForm: { intensityPrefix: prefix, intensity: value } })
    assert.equal(f.h.buildIntensity(), stored)
    assert.deepEqual(f.calls, [])
  }
  const f = setup()
  assert.deepEqual(f.h.parseIntensity('RPE 8.5'), { intensityPrefix: 'RPE', intensity: '8.5' })
  assert.deepEqual(f.h.parseIntensity('75%'), { intensityPrefix: '%', intensity: '75' })
  assert.deepEqual(f.h.parseIntensity('30 sek'), { intensityPrefix: 'Tid', intensity: '30' })
  assert.deepEqual(f.h.parseIntensity(null), { intensityPrefix: 'RPE', intensity: '' })
})

test('APP-TEST9 flyt øvelse ned renummererer dubletter og bevarer andre pas', async () => {
  const weeks = frozen([wk('u1', 1, [sn('s', 0, [ex('b', 0), ex('a', 0), ex('c', 9)]), sn('anden', 1, [ex('urørt', 0)])])])
  const f = setup({ weeks })
  await f.h.reorderExercise('s', 'a', 'down')
  assert.deepEqual(f.calls, [
    { table: 'exercises', op: 'update', value: { exercise_order: 1 }, where: { field: 'id', value: 'a' } },
    { table: 'exercises', op: 'update', value: { exercise_order: 2 }, where: { field: 'id', value: 'c' } },
  ])
})

test('APP-TEST9 slet øvelse med logs sender kun afgrænset øvelsessletning', async () => {
  const logs = frozen([{ exercise_id: 'e', set_number: 1, exercises: { session_id: 's' } }])
  const f = setup({ athleteLogs: logs })
  await f.h.deleteExercise('e')
  assert.deepEqual(f.calls, [{ table: 'exercises', op: 'delete', where: { field: 'id', value: 'e' } }])
  assert.deepEqual(f.refresh, ['a'])
  assert.equal(logs.length, 1)
})

test('APP-TEST9 FUND F1 slettet øvelses logs må ikke afslutte erstatningsøvelse', () => {
  const f = setup({ athleteLogs: [{ exercise_id: 'slettet', set_number: 1, exercises: { session_id: 's' } }] })
  const status = f.h.sessionLogStatus(sn('s', 0, [ex('ny', 0, { sets: 1 })]))
  assert.equal(status.kind, 'none')
  assert.equal(status.logged, 0)
})

test('APP-TEST9 kopier øvelse til andet pas bevarer sæt og anbefalet vægt nul', async () => {
  const f = setup({ weeks: [wk('u1', 1, [sn('mål', 0)])] })
  await f.h.copyExerciseToSession(frozen(ex('e', 9, { recommended_weight: 0 })), 'mål')
  assert.deepEqual(f.calls, [{ table: 'exercises', op: 'insert', value: {
    session_id: 'mål', name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8', note: 'Rolig', recommended_weight: 0, exercise_order: 0,
  } }])
})

test('APP-TEST9 FUND F2 kopier pas til anden uge bevarer ugedag', async () => {
  const f = setup({ weeks: [wk('mål', 52)] })
  await f.h.copySessionToWeek(frozen(sn('kilde', 3, [ex('e', 0)])), 'mål')
  assert.equal(writes(f, 'sessions', 'insert')[0].value.weekday, 2)
  assert.equal(writes(f, 'exercises', 'insert')[0].value.session_id, 'new-1')
})

test('APP-TEST9 FUND F3 nyt pas efter sletning får fri sidste rækkefølge', async () => {
  const f = setup({ weeks: [wk('u1', 1, [sn('a', 0), sn('c', 2)])] })
  await f.h.addSession('u1')
  assert.equal(f.calls[0].value.session_order, 3)
})

test('APP-TEST9 FUND F4 ny øvelse efter sletning får fri sidste rækkefølge', async () => {
  const f = setup({ weeks: [wk('u1', 1, [sn('s', 0, [ex('a', 0), ex('c', 2)])])] })
  await f.h.addExercise('s')
  assert.equal(f.calls[0].value.exercise_order, 3)
})

test('APP-TEST9 logstatus tæller normale sæt og ignorerer skipped samt andet pas', () => {
  const training = frozen(sn('s', 0, [ex('e', 0, { sets: 2 })]))
  const logs = frozen([
    { exercise_id: 'e', set_number: 1, exercises: { session_id: 's' } },
    { exercise_id: 'e', set_number: 2, skipped: true, exercises: { session_id: 's' } },
    { exercise_id: 'anden', set_number: 1, exercises: { session_id: 'andet-pas' } },
  ])
  const f = setup({ athleteLogs: logs })
  assert.deepEqual(f.h.sessionLogStatus(training), { kind: 'partial', logged: 1, total: 2, color: '#c8923a' })
  assert.deepEqual(setup().h.sessionLogStatus(sn('tom', 0)), { kind: 'none', logged: 0, total: 0, color: '#3a3a36' })
})


test('APP-TEST9 atletskift under genindlæsning åbner ikke en forkert uge', async () => {
  const ref = { current: 'a' }
  const f = setup({ weeks: [wk('u1', 1)], currentProgramAthleteRef: ref,
    fetchWeeks: async () => { ref.current = 'anden-atlet' },
  })
  assert.equal(await f.h.copyWeek('u1'), true)
  assert.equal(f.state.OpenWeekId, undefined)
  assert.equal(f.state.ProgramBlockStart, undefined)
})

test('APP-TEST9 sent databasesvar erstatter ikke den nye atlets program', async () => {
  const ref = { current: 'a' }, updates = []
  let finish
  globalThis[key] = { from(table) {
    assert.equal(table, 'weeks')
    const query = {
      select: () => query, eq: () => query,
      order: () => new Promise(resolve => { finish = resolve }),
    }
    return query
  } }
  const h = lavLaesninger({ currentProgramAthleteRef: ref, setWeeks: value => updates.push(value) })
  const loading = h.fetchWeeks('a')
  ref.current = 'anden-atlet'
  finish({ data: [wk('u1', 1)] })
  await loading
  assert.deepEqual(updates, [])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Ordre 1877: en fejlende gemning eller sletning af pas, oevelser og raekkefoelge i coachens Program skal vises.
// Kun databasegraensen erstattes; alle kald holdes i hukommelsen.
const key = Symbol.for('PROGRAM-SKRIVEFEJL-1877.database')
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase' || specifier === '../supabase.js') return {
      url: 'data:text/javascript,export const supabase = { from(table) { return globalThis[Symbol.for("PROGRAM-SKRIVEFEJL-1877.database")].from(table) } }; export const withRetry = fn => fn()',
      shortCircuit: true,
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.js', context)
    return nextResolve(specifier, context)
  },
})
let lavProgramHandlinger
try { ;({ lavProgramHandlinger } = await import('./dashboard/programHandlinger.js')) } finally { guard.deregister() }

function setup(failing) {
  const calls = [], state = {}, refresh = [], flashes = []
  let pending = Promise.resolve()
  globalThis[key] = {
    from(table) {
      let call
      const query = {
        insert(value) { call = { table, op: 'insert', value }; calls.push(call); return query },
        update(value) { call = { table, op: 'update', value }; calls.push(call); return query },
        delete() { call = { table, op: 'delete' }; calls.push(call); return query },
        eq() { return query },
        then(resolve, reject) {
          return Promise.resolve({ data: null, error: failing ? { message: 'skrivning afvist' } : null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  const setter = name => value => { (state[name] ??= []).push(value) }
  const args = {
    setAddingSession: setter('AddingSession'), setSessionForm: setter('SessionForm'), setEditingSession: setter('EditingSession'),
    setOpenSessionId: setter('OpenSessionId'), openSessionId: 's1',
    askConfirm: (msg, fn) => { pending = fn() },
    weeks: [{ id: 'u1', week_number: 1, sessions: [
      { id: 's1', session_order: 0, exercises: [{ id: 'e1', exercise_order: 0 }, { id: 'e2', exercise_order: 1 }] },
      { id: 's2', session_order: 1, exercises: [] },
    ] }], athleteLogs: [], exerciseLibrary: [],
    athletes: [{ id: 'a' }], selectedAthlete: { id: 'a' }, calendarWeeks: {}, blockPlan: [],
    weekForm: {}, sessionForm: { title: 'Traening A', weekday: 1 }, exerciseForm: {},
    fetchWeeks: id => { refresh.push(id) }, fetchCalendarWeeks: async () => {}, fetchAthleteWeekSummaries: () => {},
    showFlash: (msg, type) => { flashes.push({ msg, type }) }, programCopyEnabled: true, setWeeks: () => {},
  }
  return { h: lavProgramHandlinger(args), calls, state, refresh, flashes, ventSletning: () => pending }
}

const kald = [
  ['addSession', async f => { await f.h.addSession('u1') }, ['AddingSession', 'SessionForm'], 1],
  ['updateSession', async f => { await f.h.updateSession('s1') }, ['EditingSession'], 1],
  ['deleteSession', async f => { f.h.deleteSession('s1'); await f.ventSletning() }, ['OpenSessionId'], 1],
  ['deleteExercise', async f => { await f.h.deleteExercise('e1') }, [], 1],
  ['reorderSession', async f => { await f.h.reorderSession('u1', 's1', 'down') }, [], 2],
  ['reorderExercise', async f => { await f.h.reorderExercise('s1', 'e1', 'down') }, [], 2],
]
for (const [navn, run, lukker, antal] of kald) {
  test(`1877 ${navn}: fejl vises og intet lukkes eller fjernes lokalt`, async () => {
    const f = setup(true)
    await run(f)
    assert.equal(f.calls.length, antal)
    assert.equal(f.flashes.length, 1)
    assert.equal(f.flashes[0].type, 'error')
    assert.match(f.flashes[0].msg, /skrivning afvist/)
    for (const s of lukker) assert.equal(f.state[s], undefined, `${s} maa ikke kaldes ved fejl`)
    if (!navn.startsWith('reorder')) assert.deepEqual(f.refresh, [])
  })
  test(`1877 ${navn}: lykket skrivning ser ud som foer`, async () => {
    const f = setup(false)
    await run(f)
    assert.equal(f.calls.length, antal)
    assert.equal(f.flashes.length, 0)
    for (const s of lukker) assert.ok(f.state[s], `${s} skal kaldes`)
    assert.deepEqual(f.refresh, ['a'])
  })
}

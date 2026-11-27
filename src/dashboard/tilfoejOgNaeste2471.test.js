import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'

// Ordre 2471: Tilfoej og naeste gemmer med addExercise og lader formularen staa aaben, tom.
// Kun databasegraensen erstattes; alle kald holdes i hukommelsen.
const key = Symbol.for('TILFOEJ-NAESTE-2471.database')
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase' || specifier === '../supabase.js') return {
      url: 'data:text/javascript,export const supabase = { from(table) { return globalThis[Symbol.for("TILFOEJ-NAESTE-2471.database")].from(table) } }; export const withRetry = fn => fn()',
      shortCircuit: true,
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.js', context)
    return nextResolve(specifier, context)
  },
})
let lavProgramHandlinger
try { ;({ lavProgramHandlinger } = await import('./programHandlinger.js')) } finally { guard.deregister() }

function setup(failing) {
  const calls = [], state = {}, refresh = [], flashes = []
  globalThis[key] = {
    from(table) {
      let call
      const query = {
        insert(value) { call = { table, op: 'insert', value }; calls.push(call); return query },
        update(value) { call = { table, op: 'update', value }; calls.push(call); return query },
        eq() { return query },
        select() { return query },
        single() { return Promise.resolve({ data: { id: 'new-1' }, error: null }) },
        then(resolve, reject) {
          return Promise.resolve({ data: null, error: failing ? { message: 'skrivning afvist' } : null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  const setter = name => value => { (state[name] ??= []).push(value) }
  const args = {
    setAddingWeek: setter('AddingWeek'), setWeekForm: setter('WeekForm'), setEditingWeek: setter('EditingWeek'),
    setAddingExercise: setter('AddingExercise'), setExerciseForm: setter('ExerciseForm'), setEditingExercise: setter('EditingExercise'),
    weeks: [{ id: 'u1', week_number: 1, sessions: [{ id: 's1', exercises: [] }] }], athleteLogs: [], exerciseLibrary: [],
    athletes: [{ id: 'a' }], selectedAthlete: { id: 'a' }, calendarWeeks: {}, blockPlan: [],
    weekForm: { week_number: '2', block_name: 'Styrke' }, sessionForm: {},
    exerciseForm: { name: 'Squat', sets: '3', reps: '5', intensity: '8', intensityPrefix: 'RPE', note: '' },
    fetchWeeks: id => { refresh.push(id) }, fetchCalendarWeeks: async () => {}, fetchAthleteWeekSummaries: () => {},
    showFlash: (msg, type) => { flashes.push({ msg, type }) }, programCopyEnabled: true, setWeeks: () => {},
  }
  return { h: lavProgramHandlinger(args), calls, state, refresh, flashes }
}


const tom = { name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' }

test('2471 Tilfoej og naeste: gemmer, holder passet aabent og toemmer formularen', async () => {
  const f = setup(false)
  const ok = await f.h.addExercise('s1', { next: true })
  assert.equal(ok, true)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].table, 'exercises')
  assert.equal(f.state.AddingExercise, undefined, 'passet maa ikke lukkes')
  assert.deepEqual(f.state.ExerciseForm, [tom])
  assert.deepEqual(f.refresh, ['a'])
})

test('2471 Tilfoej og naeste: fejl vises som i dag og formularen bevarer det indtastede', async () => {
  const f = setup(true)
  const ok = await f.h.addExercise('s1', { next: true })
  assert.equal(ok, false)
  assert.equal(f.flashes.length, 1)
  assert.equal(f.flashes[0].type, 'error')
  assert.match(f.flashes[0].msg, /skrivning afvist/)
  assert.equal(f.state.AddingExercise, undefined)
  assert.equal(f.state.ExerciseForm, undefined, 'formularen maa ikke toemmes ved fejl')
  assert.deepEqual(f.refresh, [])
})

test('2471 Tilfoej virker som foer og lukker passets formular', async () => {
  const f = setup(false)
  assert.equal(await f.h.addExercise('s1'), true)
  assert.deepEqual(f.state.AddingExercise, [null])
  assert.deepEqual(f.state.ExerciseForm, [tom])
})

test('2471 knappen staar ved siden af Tilfoej, bruger addExercise og flytter fokus til navnefeltet', () => {
  const kilde = readFileSync(new URL('./ProgramTab.jsx', import.meta.url), 'utf8')
  assert.match(kilde, /addExercise\(session\.id, \{ next: true \}\)/)
  assert.match(kilde, />Tilføj og næste<\/button>/)
  assert.match(kilde, /data-add-exercise=\{session\.id\}/)
  assert.match(kilde, /input\[aria-label="Navn"\]`\)\?\.focus/)
})

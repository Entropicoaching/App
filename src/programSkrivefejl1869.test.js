import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'

// Ordre 1869: en fejlende gemning i coachens Program skal vises, og formularen skal blive aaben.
// Kun databasegraensen erstattes; alle kald holdes i hukommelsen.
const key = Symbol.for('PROGRAM-SKRIVEFEJL-1869.database')
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase' || specifier === '../supabase.js') return {
      url: 'data:text/javascript,export const supabase = { from(table) { return globalThis[Symbol.for("PROGRAM-SKRIVEFEJL-1869.database")].from(table) } }; export const withRetry = fn => fn()',
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

const kald = [
  ['addWeek', h => h.addWeek(), ['AddingWeek', 'WeekForm']],
  ['updateWeek', h => h.updateWeek('u1'), ['EditingWeek']],
  ['addExercise', h => h.addExercise('s1'), ['AddingExercise', 'ExerciseForm']],
  ['updateExercise', h => h.updateExercise('e1'), ['EditingExercise']],
]
for (const [navn, run, lukker] of kald) {
  test(`1869 ${navn}: fejl vises og formularen bliver aaben`, async () => {
    const f = setup(true)
    await run(f.h)
    assert.equal(f.calls.length, 1)
    assert.equal(f.flashes.length, 1)
    assert.equal(f.flashes[0].type, 'error')
    assert.match(f.flashes[0].msg, /skrivning afvist/)
    for (const s of lukker) assert.equal(f.state[s], undefined, `${s} maa ikke kaldes ved fejl`)
    assert.deepEqual(f.refresh, [])
  })
  test(`1869 ${navn}: lykket gemning lukker formularen som foer`, async () => {
    const f = setup(false)
    await run(f.h)
    assert.equal(f.flashes.length, 0)
    for (const s of lukker) assert.ok(f.state[s], `${s} skal kaldes`)
    assert.deepEqual(f.refresh, ['a'])
  })
}

const jsx = readFileSync(new URL('./dashboard/ProgramTab.jsx', import.meta.url), 'utf8')
test('1869 Gem tilknytninger tjekker alle svar og viser fejlen', () => {
  const i = jsx.indexOf('Gem tilknytninger')
  const blok = jsx.slice(i - 900, i)
  assert.match(blok, /const results = await Promise\.all/)
  assert.match(blok, /results\.find\(r => r\?\.error\)/)
  assert.match(blok, /showFlash\(/)
})
test('1869 omdoeb blok tjekker svaret og lader feltet staa ved fejl', () => {
  const i = jsx.indexOf(".update({ block_name: name }).in('id'")
  const blok = jsx.slice(jsx.lastIndexOf('onBlur', i), i + 600)
  assert.match(blok, /const \{ error \} = await supabase/)
  assert.match(blok, /if \(error\) \{ showFlash\(/)
  assert.ok(blok.indexOf('if (error)') < blok.indexOf('setRenamingBlock(null)'), 'feltet lukkes foerst efter et lykket svar')
})

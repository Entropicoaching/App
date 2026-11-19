import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Ordre 1880: en fejlet laesning af oevelsesbiblioteket eller atletens vaegt skal vises som fejl,
// ikke som tom tilstand. Kun databasegraensen erstattes; alle kald holdes i hukommelsen.
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase' || specifier === '../supabase.js') return {
      url: 'data:text/javascript,export const supabase = { from(table) { return globalThis[Symbol.for("COACH-LAESEFEJL-1880.database")].from(table) } }; export const withRetry = fn => fn()',
      shortCircuit: true,
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.js', context)
    return nextResolve(specifier, context)
  },
})
let lavLaesninger
try { ;({ lavLaesninger } = await import('./dashboard/laesninger.js')) } finally { guard.deregister() }

function database(failing, rows) {
  globalThis[Symbol.for('COACH-LAESEFEJL-1880.database')] = {
    from(table) {
      const query = {}
      for (const op of ['select', 'eq', 'order', 'limit']) query[op] = () => query
      query.then = (resolve, reject) =>
        Promise.resolve(failing ? { data: null, error: { message: 'laesning afvist' } } : { data: rows[table] || [], error: null }).then(resolve, reject)
      return query
    },
  }
}

function opsaet(failing, rows = {}) {
  database(failing, rows)
  const state = { library: [], weight: [] }
  const apply = (name, v) => { state[name] = typeof v === 'function' ? v(state[name]) : v }
  const l = lavLaesninger({
    setExerciseLibrary: v => apply('library', v), setAthleteWeightLogs: v => apply('weight', v),
    session: { user: { id: 'c' } },
  })
  return { l, state }
}

const bib = [{ id: 'e1', name: 'Pause squat', category: 'Squat' }]
const vaegt = [{ id: 'w1', weight: 80, logged_at: '2026-11-01' }]

test('bibliotek: fejlet laesning markeres som fejl og sletter ikke tidligere hentede oevelser', async () => {
  const { l, state } = opsaet(false, { exercise_library: bib })
  await l.fetchExerciseLibrary()
  assert.equal(state.library.length, 1)
  assert.ok(!state.library.laesefejl)
  database(true, {})
  await l.fetchExerciseLibrary()
  assert.equal(state.library.length, 1)
  assert.equal(state.library.laesefejl, true)
})

test('bibliotek: foerste laesning der fejler giver fejlmarkering, ikke ren tom liste', async () => {
  const { l, state } = opsaet(true)
  await l.fetchExerciseLibrary()
  assert.equal(state.library.laesefejl, true)
})

test('bibliotek: ny lykket laesning fjerner fejlmarkeringen', async () => {
  const { l, state } = opsaet(true)
  await l.fetchExerciseLibrary()
  database(false, { exercise_library: bib })
  await l.fetchExerciseLibrary()
  assert.ok(!state.library.laesefejl)
  assert.deepEqual([...state.library], bib)
})

test('vaegt: fejlet laesning markeres som fejl', async () => {
  const { l, state } = opsaet(true)
  await l.fetchAthleteWeightLogs('a')
  assert.equal(state.weight.laesefejl, true)
})

test('vaegt: lykket laesning er uaendret og uden fejlmarkering', async () => {
  const { l, state } = opsaet(false, { weight_logs: vaegt })
  await l.fetchAthleteWeightLogs('a')
  assert.deepEqual([...state.weight], vaegt)
  assert.ok(!state.weight.laesefejl)
})

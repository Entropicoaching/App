import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Ordre 1878: en fejlende sletning, gemning eller fastgoerelse skal vises for coachen.
// Kun databasegraensen erstattes; alle kald holdes i hukommelsen.
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase' || specifier === '../supabase.js') return {
      url: 'data:text/javascript,export const supabase = { from(table) { return globalThis[Symbol.for("COACH-SKRIVEFEJL-1878.database")].from(table) } }; export const withRetry = fn => fn()',
      shortCircuit: true,
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.js', context)
    return nextResolve(specifier, context)
  },
})
let lavAtletHandlinger, lavIndbakkeHandlinger
try {
  ;({ lavAtletHandlinger } = await import('./dashboard/atletHandlinger.js'))
  ;({ lavIndbakkeHandlinger } = await import('./dashboard/indbakkeHandlinger.js'))
} finally { guard.deregister() }

function database(failing, calls) {
  globalThis[Symbol.for('COACH-SKRIVEFEJL-1878.database')] = {
    from(table) {
      const query = {}
      for (const op of ['insert', 'update', 'upsert', 'delete']) query[op] = value => { calls.push({ table, op, value }); return query }
      query.eq = () => query
      query.then = (resolve, reject) =>
        Promise.resolve({ data: null, error: failing ? { message: 'skrivning afvist' } : null }).then(resolve, reject)
      return query
    },
  }
}

function atlet(failing) {
  const calls = [], state = {}, flashes = [], refresh = [], pending = []
  database(failing, calls)
  const setter = name => value => { (state[name] ??= []).push(value) }
  const args = {
    askConfirm: (_t, fn) => { pending.push(fn()) },
    selectedAthlete: { id: 'a' }, session: { user: { id: 'c' } }, warmupTemplates: [{ id: 't1', exercise_category: 'squat', athlete_id: 'a' }],
    meetPlanForm: { meet_type: 'DM', squat1: '100', squat2: '', squat3: '', bench1: '', bench2: '', bench3: '', dead1: '', dead2: '', dead3: '', notes: '' },
    setAthletes: setter('Athletes'), setShowDeleteModal: setter('ShowDeleteModal'), setView: setter('View'),
    setEditingWarmup: setter('EditingWarmup'), setWarmupNewStep: setter('WarmupNewStep'),
    setSavingMeetPlan: setter('SavingMeetPlan'), setMeetResults: setter('MeetResults'),
    fetchMeetPlan: async () => { refresh.push('meetPlan') }, fetchWarmupTemplates: () => { refresh.push('warmup') },
    showFlash: (msg, type) => { flashes.push({ msg, type }) },
  }
  return { h: lavAtletHandlinger(args), calls, state, flashes, refresh, pending }
}

const kald = [
  ['deleteAthlete', h => h.deleteAthlete(), ['Athletes', 'ShowDeleteModal', 'View']],
  ['saveMeetPlan', h => h.saveMeetPlan('a'), []],
  ['deleteMeetResult', h => h.deleteMeetResult('m1'), ['MeetResults']],
  ['saveWarmupTemplate (ret)', h => h.saveWarmupTemplate('squat', ['x'], 'a'), ['EditingWarmup', 'WarmupNewStep']],
  ['saveWarmupTemplate (ny)', h => h.saveWarmupTemplate('bench', ['x'], 'a'), ['EditingWarmup', 'WarmupNewStep']],
  ['deleteWarmupTemplate', h => h.deleteWarmupTemplate('t1'), []],
]
for (const [navn, run, lokalt] of kald) {
  test(`1878 ${navn}: fejl vises og intet aendres lokalt`, async () => {
    const f = atlet(true)
    await run(f.h)
    await Promise.all(f.pending)
    assert.ok(f.calls.length >= 1)
    assert.equal(f.flashes.filter(x => x.type === 'error').length, 1)
    assert.match(f.flashes.find(x => x.type === 'error').msg, /skrivning afvist/)
    assert.equal(f.flashes.filter(x => x.type === 'success').length, 0)
    for (const s of lokalt) assert.equal(f.state[s], undefined, `${s} maa ikke kaldes ved fejl`)
    assert.deepEqual(f.refresh, [])
  })
  test(`1878 ${navn}: lykket skrivning goer som foer`, async () => {
    const f = atlet(false)
    await run(f.h)
    await Promise.all(f.pending)
    assert.equal(f.flashes.filter(x => x.type === 'error').length, 0)
    for (const s of lokalt) assert.ok(f.state[s], `${s} skal kaldes`)
  })
}

test('1878 togglePin: fejl vises og listen hentes ikke', async () => {
  for (const failing of [true, false]) {
    const calls = [], flashes = [], hentet = []
    database(failing, calls)
    const h = lavIndbakkeHandlinger({
      selectedAthlete: { id: 'a' }, athletes: [], fetchMessages: id => { hentet.push(id) },
      showFlash: (msg, type) => { flashes.push({ msg, type }) },
    })
    await h.togglePin('m1', false)
    assert.deepEqual(calls, [{ table: 'messages', op: 'update', value: { pinned: true } }])
    if (failing) {
      assert.equal(flashes.length, 1); assert.equal(flashes[0].type, 'error'); assert.match(flashes[0].msg, /skrivning afvist/)
    } else {
      assert.equal(flashes.length, 0); assert.deepEqual(hentet, ['a'])
    }
  }
})

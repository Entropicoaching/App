import test from 'node:test'
import assert from 'node:assert/strict'
import { createProfileGoals } from './profileGoalsController.mjs'
import { athleteGoals, goalDate, goalWeight, goalDraft, goalDisplay, validateGoalDraft } from './profileGoalsModel.mjs'
import { goalStorageKey, readProfileGoals } from './profileGoalsStore.mjs'

const athlete = Object.freeze({ id: 'fixture-athlete', user_id: 'fixture-user', name: 'Testatlet',
  goal: 'bulk', weight_class: 83, competition_date: '2027-03-14', kcal_target: 2400 })
const own = () => ({ enabled: true, athleteId: athlete.id, ownerId: athlete.user_id, athleteUserId: athlete.user_id })
function fixture(extra = {}) {
  const scope = own(), rows = new Map(), reads = [], writes = []
  const storage = () => ({ getItem(key) { reads.push(key); return rows.get(key) ?? null },
    setItem(key, value) { writes.push([key, value]); rows.set(key, value) } })
  const controller = createProfileGoals({ enabled: true, athlete, getScope: () => scope, storage,
    get client() { assert.fail('local goals must never inspect a database client') }, ...extra })
  return { controller, scope, rows, reads, writes, storage }
}
const edit = (f, fields) => { assert.equal(f.controller.load(), true); for (const [key, value] of Object.entries(fields)) assert.equal(f.controller.change(key, value), true) }

test('goals OFF is inert before every data, storage and scope getter', () => {
  for (const fn of [createProfileGoals, readProfileGoals]) {
    assert.equal(fn(), null)
    for (const enabled of [undefined, false, 0, 1, 'true', null]) {
      assert.equal(fn(new Proxy({ enabled }, { get(o, k) { assert.equal(k, 'enabled'); return o[k] } })), null)
    }
  }
})

test('wrong or absent athlete ownership cannot read storage or create a controller', () => {
  for (const scope of [{}, { ...own(), enabled: false }, { ...own(), ownerId: 'other' }, { ...own(), athleteId: 'other' }]) {
    const opts = { enabled: true, scope, athlete, getScope: () => scope, storage: () => assert.fail('storage') }
    assert.equal(createProfileGoals(opts), null); assert.equal(readProfileGoals(opts), null)
  }
})

test('model has truthful empty values and preserves existing free text without guessing', () => {
  assert.deepEqual(athleteGoals(null), { goal: null, weight_class: null, competition_date: null, target_weight: null })
  assert.deepEqual(goalDisplay(athleteGoals(null)), { goal: 'Intet mål angivet endnu', weight_class: 'Ikke angivet endnu',
    competition_date: 'Intet stævne angivet endnu', target_weight: 'Ikke angivet endnu' })
  const saved = athleteGoals({ ...athlete, goal: 'Stærkere\nTre pas' })
  assert.equal(validateGoalDraft({ ...goalDraft(saved), weight_class: '82,5' }, saved).values.goal, saved.goal)
  assert.equal(goalDisplay(saved).competition_date, '14.03.2027')
})

test('weight and civil date parsing reject malformed, rollover, nonfinite and nonpositive input', () => {
  for (const value of [true, false, [], {}, 0, -1, Infinity, NaN, '1e2', '0x10', '83kg', '1,2.3', '1001']) assert.equal(goalWeight(value), undefined)
  for (const value of [null, undefined, '', ' ']) assert.equal(goalWeight(value), null)
  assert.equal(goalWeight('82,5'), 82.5); assert.equal(goalWeight(' 82.5 '), 82.5)
  for (const value of ['2027-02-29', '2026-02-30', '2027-13-01', '0000-01-01', '2027-01-01T00:00:00Z', {}, 1]) assert.equal(goalDate(value), undefined)
  assert.equal(goalDate('2028-02-29'), '2028-02-29')
})

test('controller reads only its namespace on explicit load, with no writes or client calls', () => {
  const f = fixture()
  assert.deepEqual(f.reads, []); assert.equal(f.controller.snapshot().phase, 'loading')
  f.controller.load()
  assert.deepEqual(f.reads, [goalStorageKey(own())]); assert.deepEqual(f.writes, [])
  assert.equal(f.controller.snapshot().values.target_weight, null)
  assert.notEqual(goalStorageKey(own()), goalStorageKey({ ...own(), athleteId: 'other' }))
  assert.notEqual(goalStorageKey(own()), goalStorageKey({ ...own(), ownerId: 'other', athleteUserId: 'other' }))
})

test('all four fields save in one owner namespace, without inspecting any database client', async () => {
  const f = fixture(); edit(f, { goal: 'cut', weight_class: '82,5', competition_date: '2027-04-18', target_weight: '81,2' })
  assert.equal(await f.controller.save(), true)
  const expected = { goal: 'cut', weight_class: 82.5, competition_date: '2027-04-18', target_weight: 81.2 }
  assert.equal(f.writes.length, 1)
  assert.equal(f.writes[0][0], goalStorageKey(own()))
  assert.deepEqual(JSON.parse(f.writes[0][1]), { schema: 'entropi2-profile-goals/v1', fields: expected })
  assert.deepEqual(f.controller.snapshot().values, expected)
  assert.deepEqual(f.controller.snapshot().localFields.sort(), Object.keys(expected).sort())
  assert.equal(f.controller.snapshot().message, 'Gemt på denne enhed; din coach ser det ikke endnu')
  assert.equal(athlete.goal, 'bulk'); assert.equal(athlete.kcal_target, 2400)
  const reopened = createProfileGoals({ enabled: true, athlete, getScope: own, storage: f.storage })
  assert.equal(reopened.refresh(), true)
  assert.deepEqual(reopened.snapshot().values, expected)
  assert.equal(reopened.snapshot().message, f.controller.snapshot().message)
})

test('saving only bodyweight or an unchanged form still persists every field', async () => {
  for (const fields of [{ target_weight: '81' }, {}]) {
    const f = fixture(); edit(f, fields); assert.equal(await f.controller.save(), true)
    assert.deepEqual(Object.keys(JSON.parse(f.writes[0][1]).fields).sort(), ['competition_date', 'goal', 'target_weight', 'weight_class'])
    assert.equal(JSON.parse(f.writes[0][1]).fields.goal, 'bulk')
  }
})

test('blank fields are explicit local nulls and mask existing host values on reopen', async () => {
  const f = fixture(); edit(f, { goal: '', weight_class: '', competition_date: '', target_weight: '' })
  assert.equal(await f.controller.save(), true)
  assert.deepEqual(f.controller.snapshot().values, Object.fromEntries(['goal', 'weight_class', 'competition_date', 'target_weight'].map(k => [k, null])))
  assert.equal(f.controller.refresh(), true); assert.equal(f.controller.snapshot().values.goal, null)
  assert.equal(athlete.goal, 'bulk')
})

test('coach free text is retained unchanged when editing another field and never mutated by a local goal choice', async () => {
  const source = Object.freeze({ ...athlete, goal: 'Stærkere\nTre pas om ugen' })
  const f = fixture({ athlete: source }); edit(f, { target_weight: '81' })
  assert.equal(await f.controller.save(), true)
  assert.equal(JSON.parse(f.writes[0][1]).fields.goal, source.goal)
  assert.equal(f.controller.refresh(), true)
  f.controller.change('goal', 'cut'); assert.equal(await f.controller.save(), true)
  assert.equal(f.controller.snapshot().coachGoal, source.goal)
  assert.equal(source.goal, 'Stærkere\nTre pas om ugen')
})

test('invalid input retains draft and four field errors without writing', async () => {
  const f = fixture(); edit(f, { goal: 'invented', weight_class: '-5', competition_date: '2027-02-30', target_weight: 'abc' })
  assert.equal(await f.controller.save(), false)
  assert.equal(Object.keys(f.controller.snapshot().errors).length, 4)
  assert.equal(f.controller.snapshot().draft.target_weight, 'abc'); assert.deepEqual(f.writes, [])
})

test('reset only resets the draft and cannot write storage', () => {
  const f = fixture(); edit(f, { goal: 'cut' }); assert.equal(f.controller.reset(), true)
  assert.equal(f.controller.snapshot().draft.goal, 'bulk'); assert.deepEqual(f.writes, [])
})

test('revocation, identity switch and disposal reject every retained action', async () => {
  for (const revoke of [f => { f.scope.enabled = false }, f => { f.scope.ownerId = 'other' },
    f => { f.scope.athleteId = 'other' }, f => { f.scope.athleteUserId = 'other' }, f => f.controller.dispose()]) {
    const f = fixture(); edit(f, { goal: 'cut', target_weight: '81' }); revoke(f)
    const reads = f.reads.length
    assert.equal(await f.controller.save(), false); assert.equal(f.controller.refresh(), false)
    assert.equal(f.controller.change('goal', 'bulk'), false); assert.equal(f.controller.reset(), false)
    assert.deepEqual(f.writes, []); assert.equal(f.reads.length, reads)
  }
})

test('revocation during storage acquisition or comparison prevents writes and stale notifications', async () => {
  for (const point of ['acquire', 'compare']) {
    const scope = own(), rows = new Map()
    let revoke = false, reads = 0, writes = 0
    const controller = createProfileGoals({ enabled: true, athlete, getScope: () => scope,
      storage: () => {
        if (revoke && point === 'acquire') scope.enabled = false
        return {
          getItem(key) { reads++; if (revoke && point === 'compare') scope.enabled = false; return rows.get(key) ?? null },
          setItem() { writes++; assert.fail('revoked write') },
        }
      } })
    assert.equal(controller.load(), true); controller.change('goal', 'cut')
    let emitted = 0; controller.subscribe(() => emitted++)
    revoke = true; assert.equal(await controller.save(), false)
    assert.equal(emitted, 1); assert.equal(writes, 0)
    assert.equal(reads, point === 'acquire' ? 1 : 2)
  }
})

test('scope revoked by a saving subscriber prevents writing; reentrant save is blocked', async () => {
  const f = fixture(); edit(f, { goal: 'cut' })
  let reentrant
  f.controller.subscribe(() => {
    if (f.controller.snapshot().pending) {
      reentrant = f.controller.save()
      assert.equal(f.controller.change('goal', 'bulk'), false)
      assert.equal(f.controller.reset(), false)
      f.scope.enabled = false
    }
  })
  assert.equal(await f.controller.save(), false); assert.equal(await reentrant, false)
  assert.deepEqual(f.writes, [])
})

test('storage failures and corrupt records block editing and preserve stored bytes', async () => {
  const records = ['broken', '{}', 'null', JSON.stringify({ schema: 'entropi2-profile-goals/v1', fields: { private_field: 1 } }),
    JSON.stringify({ schema: 'entropi2-profile-goals/v1', fields: { target_weight: '82' } }),
    JSON.stringify({ schema: 'entropi2-profile-goals/v1', fields: { competition_date: '2027-02-29' } })]
  for (const raw of records) {
    const f = fixture(); f.rows.set(goalStorageKey(own()), raw)
    assert.equal(f.controller.load(), false); assert.equal(f.controller.snapshot().phase, 'load-error')
    assert.equal(f.controller.change('goal', 'cut'), false); assert.equal(await f.controller.save(), false)
    assert.equal(f.rows.get(goalStorageKey(own())), raw); assert.deepEqual(f.writes, [])
  }
  for (const storage of [() => null, () => { throw Error('denied') }, () => ({})]) {
    const f = fixture({ storage }); assert.equal(f.controller.load(), false)
    assert.equal(await f.controller.save(), false)
  }
})

test('quota error preserves all drafts and confirmed values; retry saves all fields', async () => {
  let denied = true
  const rows = new Map(), writes = []
  const f = fixture({ storage: () => ({ getItem: key => rows.get(key) ?? null,
    setItem(key, value) { if (denied) throw Error('quota'); writes.push(key); rows.set(key, value) } }) })
  edit(f, { goal: 'cut', target_weight: '81' }); assert.equal(await f.controller.save(), false)
  assert.equal(f.controller.snapshot().values.goal, 'bulk'); assert.equal(f.controller.snapshot().values.target_weight, null)
  assert.equal(f.controller.snapshot().draft.goal, 'cut'); assert.equal(f.controller.snapshot().draft.target_weight, '81')
  assert.match(f.controller.snapshot().message, /ikke gemt/); assert.equal(writes.length, 0)
  denied = false; assert.equal(await f.controller.save(), true); assert.equal(writes.length, 1)
})

test('a stale profile cannot overwrite a locally saved record from another editor', async () => {
  const f = fixture(), other = createProfileGoals({ enabled: true, athlete, getScope: own, storage: f.storage })
  edit(f, { goal: 'cut' }); other.load(); other.change('target_weight', '81')
  assert.equal(await other.save(), true)
  const prior = f.rows.get(goalStorageKey(own()))
  assert.equal(await f.controller.save(), false); assert.equal(f.rows.get(goalStorageKey(own())), prior)
  assert.equal(f.controller.snapshot().draft.goal, 'cut'); assert.match(f.controller.snapshot().message, /anden fane/)
})

test('legacy partial local records remain readable and expand to all fields on the next save', async () => {
  const f = fixture()
  f.rows.set(goalStorageKey(own()), JSON.stringify({ schema: 'entropi2-profile-goals/v1', fields: { target_weight: 81 } }))
  assert.equal(f.controller.refresh(), true); assert.equal(f.controller.snapshot().values.target_weight, 81)
  assert.equal(await f.controller.save(), true)
  assert.equal(Object.keys(JSON.parse(f.writes[0][1]).fields).length, 4)
})

test('other identities and unrelated local keys remain byte-for-byte untouched', async () => {
  const f = fixture(), other = goalStorageKey({ ...own(), athleteId: 'other' })
  f.rows.set(other, 'unrelated record'); f.rows.set('unrelated-key', 'unchanged')
  edit(f, { goal: 'cut' }); assert.equal(await f.controller.save(), true)
  assert.equal(f.rows.get(other), 'unrelated record'); assert.equal(f.rows.get('unrelated-key'), 'unchanged')
  assert.ok(f.reads.every(key => key === goalStorageKey(own())))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { withDatabase, scope, profile, names, owner, stranger } from './generatorSql.fixture.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'

const raw = new URL('./mealForm.react.test.mjs', import.meta.url).href
const fixture = new URL('./generatorSql.fixture.mjs', import.meta.url).href
const stamp = `${scope.date}T12:00:00Z`
const hostDate = Date
// Bounded child for the intentionally rejected callback. It must exit normally
// after the fixture finally closes PGlite and TestContext restores Date.
const child = (source, pattern) => spawnSync(process.execPath, [
  '--max-old-space-size=1024', '--experimental-vm-modules',
  '--test-concurrency=1', '--test-reporter=tap',
  ...(pattern ? [`--test-name-pattern=${pattern}`] : []),
  '--input-type=module', '--eval', source,
], { encoding: 'utf8', timeout: 90000, env: { TZ: 'Europe/Copenhagen' }, maxBuffer: 1000000 })

// These are supplementary host Date.now source contexts, not raw-file PASS
// claims. mock.method leaves the native Date constructor available to the
// original TestContext Date mock; a nested timers Date mock is unsupported.
const contexts = [
  ['Nov8', '2026-11-08T12:00:00Z'],
  ['Nov9', '2026-11-09T12:00:00Z'],
  ['2030', '2030-06-15T12:00:00Z'],
  ['before Copenhagen midnight', '2026-11-07T22:59:59.999Z'],
  ['after Copenhagen midnight', '2026-11-07T23:00:00.001Z'],
  ['before UTC midnight', '2026-11-07T23:59:59.999Z'],
  ['after UTC midnight', '2026-11-08T00:00:00.001Z'],
]
for (const [label, wall] of contexts) test(`original form under outer Date.now source: ${label}`, { timeout: 95000 }, () => {
  const result = child(`
    import test, { mock } from 'node:test'
    import assert from 'node:assert/strict'
    const outerDate=Date, wall=Date.parse(${JSON.stringify(wall)})
    mock.method(Date,'now',()=>wall)
    await import(${JSON.stringify(raw)})
    test('outer Date restored',()=>{
      try { assert.equal(Date,outerDate);assert.equal(Date.now(),wall) }
      finally { mock.restoreAll() }
    })
  `, '^(StrictMode actual PortalPlan|outer Date restored)')
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stdout.slice(-4000) + result.stderr.slice(-1000))
  assert.match(result.stdout, /# tests 2/)
  assert.match(result.stdout, /# pass 2/)
})

test('real later SQL approval stays unavailable on the requested day; next day and owner succeed; stranger does not', { timeout: 60000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  let database
  await withDatabase(async f => {
    database = f.db
    const controller = openPortalPlan({ enabled: true, ...scope, athlete: profile,
      storage: () => memoryStorage(), template: [{ id: 'clock-meal', name: 'Synthetic clock meal', items: [] }] }).controller
    assert.equal(controller.generate(), true)
    const s = controller.snapshot()
    const adapter = date => createPlanAdapter({ enabled: true, client: f.client, athleteId: scope.athleteId, date })
    const approved = await adapter(scope.date).activate({ ...scope, goal: s.form.goal, intensity: s.form.intensity, meals: s.meals })
    assert.equal(approved.ok, true)
    const ledger = (await f.db.query('select * from public.kostplan_v1_approvals')).rows[0]
    assert.equal(Date.parse(ledger.approved_at), Date.now())
    assert.equal(await adapter(scope.date).loadActive(), null)
    const next = await adapter('2026-11-08').loadActive()
    assert.equal(next.active, true)
    assert.equal(next.revision, ledger.version_id)
    assert.deepEqual(next.meals.map(m => m.foods.map(i => i.grams)), s.meals.map(m => m.items.map(i => i.grams)))
    for (const table of names) assert.equal(Number((await f.db.query(`select count(*) n from public.${table}`)).rows[0].n), 1)
    assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
    await f.login(owner)
    assert.equal(await adapter(scope.date).loadActive(), null)
    assert.equal((await adapter('2026-11-08').loadActive()).revision, ledger.version_id)
    await f.login(stranger)
    assert.equal(await adapter('2026-11-08').loadActive(), null)
  })
  assert.equal(database.closed, true)
})

test('Date identity is restored between cases', () => assert.equal(Date, hostDate))

test('callback rejection closes the real fixture and restores the per-test Date', { timeout: 95000 }, () => {
  const result = child(`
    import test from 'node:test'
    import assert from 'node:assert/strict'
    import { withDatabase } from ${JSON.stringify(fixture)}
    const outerDate=Date, outerNow=Date.now()
    let database
    test('intentional callback rejection',async t=>{
      t.mock.timers.enable({apis:['Date'],now:Date.parse(${JSON.stringify(stamp)})})
      await withDatabase(async f=>{
        database=f.db
        assert.equal(Date.parse((await f.db.query('select now() stamp')).rows[0].stamp),Date.parse(${JSON.stringify(stamp)}))
        throw Error('EXPECTED_CALLBACK_REJECTION')
      })
    })
    test('restored after rejection',()=>{
      assert.equal(database.closed,true)
      assert.equal(Date,outerDate);assert.ok(Date.now()>=outerNow)
    })
  `)
  assert.ifError(result.error)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /EXPECTED_CALLBACK_REJECTION/)
  assert.match(result.stdout, /ok 2 - restored after rejection/)
  assert.match(result.stdout, /# tests 2/)
  assert.match(result.stdout, /# pass 1/)
  assert.match(result.stdout, /# fail 1/)
})

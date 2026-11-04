// Additional hermetic interaction checks. This is explicitly NOT real React.
// Only React hooks/elements are substituted; all production models/readers run.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, one, text } from '../../../dashboard/analyseTestDom.mjs'
import { fixture } from '../planlaegning/syntheticFixture.mjs'

const runtime = new URL('../../../dashboard/analyseTestDom.mjs', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: runtime, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Tools } = await import('./CoachProgramTools.mjs')
const button = (tree, label) => one(tree, n => n.type === 'button' && text(n) === label)
const settle = () => new Promise(resolve => setImmediate(resolve))
function setup(t, tables) {
  const writes = [], reads = [], values = new Map()
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key) { reads.push(key); return values.get(key) ?? null },
    setItem(key, value) { writes.push([key, value]); values.set(key, value) },
  } })
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage })
  const calls = []
  const client = { from(table) {
    calls.push(table)
    const query = { select() { return query }, eq() { return query }, gte() { return query }, lt() { return query },
      lte() { return query }, order() { return query }, limit() { return query },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (tables[table] instanceof Error) throw tables[table]
        return { data: tables[table] ?? [], error: null }
      }).then(resolve, reject) } }
    return query
  } }
  const weeks = Array.isArray(tables.weeks) ? tables.weeks : []
  const props = { enabled: true, athleteId: 'synthetic-athlete', weeks, client }
  const app = mount(Tools, props)
  t.after(() => app.dispose())
  const open = label => {
    const detail = one(app.render(), n => n.type === 'details' && text(n).startsWith(label))
    detail.props.onToggle({ currentTarget: { open: true } })
    return app.render()
  }
  return { app, open, writes, reads, values, calls, props }
}

test('synthetic interaction: collapsed tools do no IO; block edits require explicit save, quota failure is visible', async t => {
  const basis = fixture()
  const tables = { weeks: basis.plan.rows.map((w, i) => ({ ...w, id: `w${i}`, week_number: i + 1 })), exercise_logs: basis.logs.rows }
  const f = setup(t, tables)
  assert.equal(nodes(f.app.render(), n => n.type === 'details').length, 3)
  assert.deepEqual(f.calls, []); assert.deepEqual(f.reads, []); assert.deepEqual(f.writes, [])
  f.open('Forslag til næste blok'); await settle()
  let tree = f.app.render()
  assert.equal(nodes(tree, n => n.type === 'fieldset').length, 4)
  assert.deepEqual(f.writes, [])
  const input = nodes(tree, n => n.type === 'input' && n.props.type === 'number')[0]
  input.props.onChange({ target: { value: '12' } }); tree = f.app.render()
  assert.deepEqual(f.writes, [])
  button(tree, 'Gem blokudkast lokalt').props.onClick()
  assert.equal(f.writes.length, 1); assert.match(f.writes[0][0], /:block$/)
  assert.equal(JSON.parse(f.writes[0][1]).model.weeks[0].lifts[0].sets, 12)
  assert.deepEqual(f.calls, ['weeks', 'exercise_logs'])
  globalThis.localStorage.setItem = () => { throw Error('synthetic quota') }
  button(f.app.render(), 'Gem blokudkast lokalt').props.onClick()
  assert.match(text(f.app.render()), /kunne ikke gemmes/)
})

test('synthetic interaction: empty and failed block reads are distinct, retry works', async t => {
  const tables = { weeks: new Error('synthetic') }, f = setup(t, tables)
  f.open('Forslag til næste blok'); await settle()
  assert.ok(nodes(f.app.render(), n => n.props.role === 'alert').length > 0)
  tables.weeks = []
  button(f.app.render(), 'Hent blokgrundlag igen').props.onClick(); f.app.render(); await settle()
  assert.match(text(f.app.render()), /Intet blokforslag er lavet/)
  assert.equal(nodes(f.app.render(), n => n.props.role === 'alert').length, 0)
  assert.deepEqual(f.writes, [])
})

test('synthetic interaction: template creation, reuse and program draft save remain local and scoped', t => {
  const week = { id: 'synthetic-week', athlete_id: 'synthetic-athlete', week_number: 1, sessions: [{ title: 'Pas A', weekday: 0,
    exercises: [{ name: 'Squat', sets: 2, reps: '5', intensity: 'RPE 7' }] }] }
  const f = setup(t, { weeks: [week] })
  let tree = f.open('Programskabeloner')
  assert.match(text(tree), /Ingen gemte skabeloner/)
  one(tree, n => n.type === 'select').props.onChange({ target: { value: week.id } })
  one(tree, n => n.type === 'input').props.onChange({ target: { value: 'Syntetisk basis' } })
  assert.deepEqual(f.writes, [])
  button(f.app.render(), 'Gem som skabelon').props.onClick()
  assert.equal(f.writes.length, 1)
  button(f.app.render(), 'Brug som udkast').props.onClick()
  assert.equal(f.writes.length, 1)
  assert.match(text(f.app.render()), /Squat/)
  button(f.app.render(), 'Gem programudkast lokalt').props.onClick()
  assert.equal(f.writes.length, 2)
  assert.ok(f.writes.every(([key]) => key.startsWith('entropi2:coach-program:v1:synthetic-athlete:')))
  assert.deepEqual(f.calls, [])
  const switched = f.app.render({ ...f.props, athleteId: 'other', weeks: [] })
  assert.doesNotMatch(text(switched), /Syntetisk basis/)
})

test('synthetic interaction: old comparison response is discarded after changing selection', async t => {
  const weeks = [{ athlete_id: 'synthetic-athlete', start_date: '2020-01-06' }, { athlete_id: 'synthetic-athlete', start_date: '2020-01-13' }]
  const f = setup(t, { weeks })
  let tree = f.open('Sammenlign to uger')
  const selects = nodes(tree, n => n.type === 'select')
  selects[0].props.onChange({ target: { value: weeks[0].start_date } })
  selects[1].props.onChange({ target: { value: weeks[1].start_date } })
  const pending = button(f.app.render(), 'Sammenlign').props.onClick()
  nodes(f.app.render(), n => n.type === 'select')[1].props.onChange({ target: { value: '' } })
  await pending
  assert.match(text(f.app.render()), /Vælg to uger/)
  assert.equal(nodes(f.app.render(), n => n.type === 'table').length, 0)
  assert.deepEqual(f.writes, [])
})

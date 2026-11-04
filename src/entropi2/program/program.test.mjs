import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { text, nodes } from './programFixture.mjs'
import { programModel } from './programModel.mjs'

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./Program.mjs', import.meta.url).href)
    return { url: new URL('./programFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Program } = await import('./Program.mjs')
const week = { id: 'week-fixture', week_number: 3, block_name: 'Styrke', coach_note: 'Rolig start', sessions: [
  { id: 'session-fixture', title: 'Pas A', weekday: 0, exercises: [
    { id: 'exercise-fixture', name: 'Squat – top', sets: 1, reps: '3–5', intensity: 'RPE 8', recommended_weight: 102.5, note: 'Pause i bunden' },
    { id: 'exercise-fixture', name: 'Squat – backoff', sets: 3, reps: '5', intensity: 'RPE 7', recommended_weight: 90 },
    { name: 'Planke', sets: 2, reps: '30 sek pr. side' },
  ] },
  { title: 'Pas B', weekday: 6, exercises: [{ name: 'Bænkpres', sets: 4, reps: 8 }] },
] }
const render = currentWeek => Program({ enabled: true, currentWeek })

test('OFF requires literal true and never inspects data', () => {
  for (const enabled of [undefined, false, 'true', 1, null]) {
    assert.equal(Program({ enabled, get currentWeek() { throw Error('OFF data access') },
      get programError() { throw Error('OFF error access') } }), null)
  }
})
test('actual component renders every supplied session, exercise and distinct prescription in order', () => {
  const tree = render(week), content = text(tree)
  assert.equal(nodes(tree, 'article').length, 2)
  assert.equal(nodes(tree, 'li').length, 4)
  for (const expected of ['Uge 3', 'Styrke', 'Rolig start', 'Mandag', 'Søndag', '1 sæt', '3 sæt',
    '3–5', 'RPE 8', 'RPE 7', '102,5 kg', '90 kg', '30 sek pr. side', 'Pause i bunden']) assert.ok(content.includes(expected), expected)
  assert.ok(content.indexOf('Squat – top') < content.indexOf('Squat – backoff'))
  assert.equal(nodes(tree, 'h1').length, 1)
  assert.equal(nodes(tree, 'h2').length, 2)
  assert.equal(nodes(tree, 'h3').length, 4)
})
test('loading/error do not inspect the week and have distinct accessible feedback', () => {
  const inaccessible = { enabled: true, get currentWeek() { throw Error('premature week read') } }
  for (const state of [{ loading: true }, { programError: true }]) {
    const tree = Program(Object.assign(Object.create(inaccessible), state))
    assert.equal(nodes(tree, 'article').length, 0)
    assert.equal(nodes(tree, 'p')[0].props.role, state.programError ? 'alert' : 'status')
  }
})
test('missing, incomplete, empty week, empty session and unknown exercises stay distinct', () => {
  assert.match(text(render(null)), /ikke et program endnu/)
  assert.match(text(render({})), /ikke tilgængelige/)
  assert.match(text(render({ sessions: [] })), /Ingen pas planlagt/)
  assert.match(text(render({ sessions: [{}] })), /Øvelserne er ikke tilgængelige/)
  assert.match(text(render({ sessions: [{ exercises: [] }] })), /Ingen øvelser planlagt/)
  assert.match(text(render({ sessions: [{ exercises: [null] }] })), /Øvelse uden navn.*Sæt ikke angivet.*Mål: Ikke angivet/)
})
test('zero remains explicit, bad numeric values are not invented as prescriptions', () => {
  const ex = programModel({ sessions: [{ weekday: 9, exercises: [{ sets: 0, reps: 0, recommended_weight: 0 },
    { sets: -1, recommended_weight: Infinity }, { sets: 1.5, recommended_weight: '100' }] }] }).sessions[0]
  assert.equal(ex.day, 'Dag ikke fastlagt')
  assert.deepEqual(ex.exercises.map(e => [e.sets, e.reps, e.weight]), [
    ['0 sæt', '0', '0 kg'], ['Sæt ikke angivet', '', ''], ['Sæt ikke angivet', '', ''],
  ])
})
test('render is read-only, preserves text as text and imposes no fixed mobile width', () => {
  const freeze = obj => { if (obj && typeof obj === 'object') { Object.values(obj).forEach(freeze); Object.freeze(obj) } return obj }
  const data = freeze(structuredClone(week)), before = JSON.stringify(data)
  const tree = render(data)
  assert.equal(JSON.stringify(data), before)
  assert.equal(tree.props.style.width, '100%')
  assert.equal(tree.props.style.minWidth, 0)
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.equal(nodes(tree, 'button').length, 0)
  assert.ok(text(render({ sessions: [{ title: '<script>fixture</script>', exercises: [] }] })).includes('<script>fixture</script>'))
  assert.equal(nodes(tree, 'script').length, 0)
})

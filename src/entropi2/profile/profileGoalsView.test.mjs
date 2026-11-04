// Actual imported stateless view + controller, with synthetic elements only when
// React is unavailable. This does not claim ReactDOM, hooks or visual layout QA.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { athleteGoals, goalDraft } from './profileGoalsModel.mjs'
import { createProfileGoals } from './profileGoalsController.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { ProfileGoalsView } = await import('./ProfileGoalsView.mjs')
const { default: Profile } = await import('./Profile.mjs')
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === 'object' ? [node, ...walk(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'string' ? node : text(node?.props?.children ?? '')
const initial = extra => {
  const values = athleteGoals({ goal: 'bulk', weight_class: 83, competition_date: '2027-03-14' })
  return { phase: 'ready', values, draft: goalDraft(values), localFields: [], errors: {}, message: '', pending: false, ...extra }
}
const render = (state = initial(), props = {}) => ProfileGoalsView({ state, ...props })
const control = (tree, name) => walk(tree).find(node => node.props.name === name)

test('goals view shows existing values and hides absent summary rows', () => {
  const tree = render()
  assert.match(text(tree), /Mit mål Opbygning/); assert.match(text(tree), /Vægtklasse 83 kg/)
  assert.match(text(tree), /Næste stævne 14.03.2027/); assert.equal(walk(tree).filter(n => n.type === 'dt').length, 3)
  assert.match(text(tree), /kun på denne enhed/); assert.match(text(tree), /bruges ikke automatisk i kostplan eller prognose/)
  const values = athleteGoals(null)
  const empty = render(initial({ values, draft: goalDraft(values) }))
  assert.equal(walk(empty).filter(n => n.type === 'dl').length, 0)
  assert.doesNotMatch(text(empty), /Intet mål angivet endnu|Intet stævne angivet endnu|Ikke angivet endnu/)
  assert.equal(control(empty, 'goal').props.value, '')
  assert.equal(walk(tree).find(node => node.type === 'details').props.open, undefined)
})

test('mobile controls have labels, native semantics and targets of at least 44 px', () => {
  const tree = render(), nodes = walk(tree)
  for (const field of nodes.filter(node => ['input', 'select'].includes(node.type))) {
    assert.ok(nodes.some(node => node.type === 'label' && node.props.htmlFor === field.props.id))
    assert.ok(field.props.style.minHeight >= 44)
    assert.equal(field.props.style.minWidth, 0); assert.equal(field.props.style.width, '100%')
  }
  for (const node of nodes.filter(node => ['button', 'summary'].includes(node.type))) assert.ok(node.props.style.minHeight >= 44)
  assert.equal(control(tree, 'target_weight').props.inputMode, 'decimal')
  assert.equal(control(tree, 'competition_date').props.type, 'date')
  assert.deepEqual(nodes.filter(node => node.type === 'option').map(node => node.props.value), ['', 'bulk', 'maintain', 'cut'])
  assert.equal(nodes.filter(node => node.type === 'form').length, 1)
})

test('loading and pending block direct view handlers as well as native controls', () => {
  for (const state of [initial({ phase: 'loading' }), initial({ phase: 'load-error' }), initial({ phase: 'saving', pending: true })]) {
    const fail = () => assert.fail('locked action')
    const tree = render(state, { onSave: fail, onChange: fail, onReset: fail })
    for (const node of walk(tree).filter(node => ['input', 'select'].includes(node.type))) {
      assert.equal(node.props.disabled, true); node.props.onChange({ target: { value: 'cut' } })
    }
    walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    walk(tree).find(node => node.type === 'button' && text(node) === 'Fortryd ændringer').props.onClick()
  }
})

test('error state announces preserved draft, identifies the field and enables retry', () => {
  const state = initial({ phase: 'error', errors: { target_weight: 'Brug en vægt over 0.' },
    draft: { ...initial().draft, target_weight: '-1' }, message: 'Målene blev ikke gemt. Dit udkast er bevaret. Prøv igen.' })
  let saves = 0
  const tree = render(state, { onSave: () => saves++ })
  assert.match(text(walk(tree).find(node => node.props.role === 'alert')), /ikke gemt/)
  const field = control(tree, 'target_weight')
  assert.equal(field.props.value, '-1'); assert.equal(field.props['aria-invalid'], true)
  assert.ok(walk(tree).some(node => node.props.id === field.props['aria-describedby']))
  walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(saves, 1)
  let retries = 0
  const failed = render(initial({ phase: 'load-error', message: 'Lokale mål kunne ikke læses.' }), { onRetry: () => retries++ })
  walk(failed).find(node => node.type === 'button' && text(node) === 'Prøv igen').props.onClick()
  assert.equal(retries, 1)
})

test('view handlers save and reset through the actual controller with an in-memory store', async () => {
  const athlete = { id: 'fixture-athlete', user_id: 'fixture-user', goal: 'bulk' }
  const scope = { enabled: true, athleteId: athlete.id, ownerId: athlete.user_id, athleteUserId: athlete.user_id }
  const writes = []
  const controller = createProfileGoals({ enabled: true, athlete, getScope: () => scope,
    client: { from() { assert.fail('local field must never access database') } },
    storage: () => ({ getItem: () => null, setItem: (...args) => writes.push(args) }) })
  controller.load()
  const draw = () => render(controller.snapshot(), { onChange: controller.change, onSave: controller.save, onReset: controller.reset })
  let tree = draw()
  control(tree, 'target_weight').props.onChange({ target: { value: '81,5' } }); tree = draw()
  assert.equal(control(tree, 'target_weight').props.value, '81,5')
  assert.equal(await walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }), true)
  assert.equal(writes.length, 1); assert.match(text(draw()), /81,5 kg\s+· kun på denne enhed/)
  control(draw(), 'target_weight').props.onChange({ target: { value: '79' } })
  walk(draw()).find(node => node.type === 'button' && text(node) === 'Fortryd ændringer').props.onClick()
  assert.equal(control(draw(), 'target_weight').props.value, '81.5')
})

test('legacy free text remains an escaped text child and the host can suppress duplicate goal display', () => {
  const goal = '<script>synthetic</script>'
  const values = athleteGoals({ goal })
  const tree = render(initial({ values, draft: goalDraft(values) }))
  assert.ok(text(tree).includes(goal)); assert.equal(walk(tree).some(node => node.props.dangerouslySetInnerHTML), false)
  assert.ok(walk(tree).some(node => node.type === 'option' && node.props.value === goal))
  const profile = Profile({ enabled: true, athlete: { goal: 'bulk' }, hideGoal: true, hideLogout: true })
  assert.equal(walk(profile).filter(node => node.type === 'dt' && text(node) === 'Mit mål').length, 0)
})


test('local save wording covers all four fields and retained coach text is visible only when different', () => {
  const saved = render(initial({ coachGoal: 'Stærkere', message: 'Gemt på denne enhed; din coach ser det ikke endnu',
    localFields: ['goal', 'weight_class', 'competition_date', 'target_weight'] }))
  assert.match(text(saved), /Alle fire felter gemmes kun på denne enhed/)
  assert.match(text(saved), /Gemt på denne enhed; din coach ser det ikke endnu/)
  assert.match(text(saved), /Coachens mål: Stærkere/)
  assert.doesNotMatch(text(render(initial({ coachGoal: 'bulk' }))), /Coachens mål:/)
})

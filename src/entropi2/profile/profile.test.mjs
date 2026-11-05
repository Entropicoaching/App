import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { profileModel } from './profileModel.mjs'

register('./syntheticReactLoader.mjs', import.meta.url)
const { default: Profile } = await import('./Profile.mjs')
const athlete = Object.freeze({ id: 'synthetic-athlete', name: 'Testatlet', goal: 'Stærkere\nTre pas om ugen', kcal_target: 2400, protein_target: '150' })
const walk = n => Array.isArray(n) ? n.flatMap(walk) : n && typeof n === 'object' ? [n, ...walk(n.props.children)] : []
const text = n => Array.isArray(n) ? n.map(text).join(' ') : typeof n === 'string' ? n : text(n?.props?.children ?? '')
const render = props => Profile({ enabled: true, athlete, onLogOut() {}, ...props })
const button = tree => walk(tree).find(n => n.type === 'button')

test('OFF is inert and does not read data, callbacks or globals', () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    const props = new Proxy({ enabled }, { get(o, k) { assert.equal(k, 'enabled'); return o[k] } })
    assert.equal(Profile(props), null)
  }
  assert.equal(Profile(), null)
})

test('actual component shows existing name, goal and daily calorie/protein targets', () => {
  const tree = render()
  assert.equal(tree.props['aria-label'], 'Mig')
  assert.match(text(tree), /Navn Testatlet Mit mål Stærkere\nTre pas om ugen/)
  assert.match(text(tree), /Mine kostmål Pr. dag Kalorier 2\.400 kcal Protein 150 g/)
  assert.equal(walk(tree).filter(n => n.type === 'h1').length, 1)
  assert.equal(walk(tree).filter(n => n.type === 'button').length, 1)
  assert.equal(walk(tree).filter(n => ['input', 'textarea', 'form'].includes(n.type)).length, 0)
  assert.equal(athlete.kcal_target, 2400)
})

test('missing fields and invalid targets never invent numeric goals', () => {
  assert.deepEqual(profileModel(null), { name: null, goal: null, kcal: null, protein: null })
  for (const value of [null, undefined, '', ' ', false, true, [], {}, -1, 0, Infinity, NaN, 'NaN', '-2', '150g', '0x10']) {
    const model = profileModel({ kcal_target: value, protein_target: value })
    assert.equal(model.kcal, null)
    assert.equal(model.protein, null)
  }
  assert.equal(profileModel({ protein_target: ' 150.5 ' }).protein, '150,5 g')
  const empty = render({ athlete: null })
  assert.equal(walk(empty).filter(n => ['dl', 'dt', 'dd'].includes(n.type)).length, 0)
  assert.doesNotMatch(text(empty), /Mine kostmål|ikke angivet|Intet mål/)
})

test('only user action calls supplied confirmed logout, preserving promise and no arguments', async () => {
  let calls = 0
  const result = Promise.resolve('synthetic completion')
  const tree = render({ onLogOut: (...args) => { assert.deepEqual(args, []); calls++; return result } })
  assert.equal(calls, 0)
  assert.equal(button(tree).props.type, 'button')
  assert.equal(button(tree).props.disabled, false)
  assert.equal(button(tree).props.onClick(), result)
  assert.equal(await result, 'synthetic completion')
  assert.equal(calls, 1)
})

test('preview, hidden and missing callback omit logout; pending blocks its existing action', () => {
  for (const props of [{ preview: true }, { hideLogout: true }, { onLogOut: undefined }, { onLogOut: null }]) {
    const tree = render({ onLogOut: () => assert.fail('logout forbidden'), ...props })
    assert.equal(button(tree), undefined)
    assert.doesNotMatch(text(tree), /Log ud|ikke tilgængeligt/)
  }
  const pending = button(render({ loggingOut: true, onLogOut: () => assert.fail('logout pending') }))
  assert.equal(pending.props.disabled, true); pending.props.onClick()
  assert.equal(pending.props.children, 'Logger ud…')
})

test('host error is announced; retry remains the existing action', () => {
  let calls = 0
  const tree = render({ logoutError: true, onLogOut: () => calls++ })
  assert.match(text(walk(tree).find(n => n.props.role === 'alert')), /Prøv igen/)
  button(tree).props.onClick(); assert.equal(calls, 1)
})

test('nutrition visibility follows existing flag and rerender has no stale athlete data', () => {
  assert.doesNotMatch(text(render({ visKost: false })), /Mine kostmål|2\.400|150 g/)
  const tree = render({ athlete: { name: 'Anden testatlet', goal: 'Andet mål', kcal_target: 1800 } })
  assert.match(text(tree), /Anden testatlet/)
  assert.doesNotMatch(text(tree), /Tre pas|2\.400|150 g/)
})

test('long untrusted text stays a text child; mobile flow has no fixed overlays', () => {
  const name = '<img src=x onerror=synthetic>' + 'x'.repeat(1000)
  const tree = render({ athlete: { name, goal: 'y'.repeat(2000) } })
  assert.ok(text(tree).includes(name))
  assert.equal(walk(tree).some(n => n.props.dangerouslySetInnerHTML), false)
  assert.equal(tree.props.style.maxWidth, 480)
  assert.equal(tree.props.style.width, '100%')
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.ok(button(tree).props.style.minHeight >= 44)
  assert.equal(walk(tree).some(n => ['fixed', 'absolute'].includes(n.props.style?.position)), false)
})


test('existing nutrition goal codes are Danish; free text and missing values keep their meaning', () => {
  for (const [goal, expected] of [['cut', 'Vægttab'], ['maintain', 'Vedligehold'], ['bulk', 'Opbygning'],
    ['Stærkere\nTre pas', 'Stærkere\nTre pas'], [' cut ', 'Vægttab'], ['constructor', 'constructor'],
    ['toString', 'toString'], ['__proto__', '__proto__'], ['', null], [null, null]]) {
    assert.equal(profileModel({ goal }).goal, expected)
    const fields = walk(render({ athlete: { goal } })).filter(n => n.type === 'dd')
    assert.deepEqual(fields.map(text), expected == null ? [] : [expected])
  }
})

test('React element contract retains scalar children, arrays, false and special keys', () => {
  const tree = render({ visKost: false })
  assert.equal(tree.$$typeof, Symbol.for('react.transitional.element'))
  const heading = walk(tree).find(n => n.type === 'h1')
  assert.equal(heading.props.children, 'Mig')
  const field = walk(tree).find(n => n.type === 'div' && n.key === 'Navn')
  assert.ok(field)
  assert.equal(Object.prototype.propertyIsEnumerable.call(field.props, 'key'), false)
  assert.equal(tree.props.children[2], false)
  assert.ok(Array.isArray(tree.props.children[1].props.children))
})

test('host catches its own logout rejection and supplies visible error state', async () => {
  let logoutError = false
  const onLogOut = async () => {
    try { await Promise.reject(new Error('synthetic failure')) }
    catch { logoutError = true }
  }
  await button(render({ onLogOut })).props.onClick()
  assert.equal(logoutError, true)
  const retry = render({ onLogOut, logoutError })
  assert.match(text(walk(retry).find(n => n.props.role === 'alert')), /Prøv igen/)
})

test('partial profile keeps only known fields, with no empty cards or new editing action', () => {
  for (const [athlete, expected] of [
    [{ name: '  Testatlet  ' }, ['Testatlet']],
    [{ goal: 'bulk' }, ['Opbygning']],
    [{ kcal_target: 2400 }, ['2.400 kcal']],
    [{ protein_target: '150.5' }, ['150,5 g']],
    [{ name: ' ', goal: '', kcal_target: 0, protein_target: 'invalid' }, []],
  ]) {
    const tree = render({ athlete, onLogOut: undefined })
    assert.deepEqual(walk(tree).filter(n => n.type === 'dd').map(text), expected)
    assert.equal(walk(tree).some(n => ['button', 'input', 'form', 'textarea'].includes(n.type)), false)
    assert.doesNotMatch(text(tree), /ikke angivet|Intet mål|ikke tilgængeligt/)
  }
  const tree = render({ athlete: { goal: 'bulk' }, hideGoal: true, hideLogout: true, children: 'Eksisterende indhold' })
  assert.equal(walk(tree).some(n => n.type === 'dl'), false)
  assert.match(text(tree), /Eksisterende indhold/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { emptySnapshot, populatedSnapshot } from './fixtures.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: AthleteWeek } = await import('./AthleteWeek.mjs')
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flatMap(nodes)]
const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.children.map(text).join(' ')
const render = snapshot => AthleteWeek({ enabled: true, snapshot })

test('actual view import: strict OFF never reads the snapshot', () => {
  for (const enabled of [undefined, false, 'true', 1, null]) {
    assert.equal(AthleteWeek({ enabled, get snapshot() { throw Error('OFF read') } }), null)
  }
})

test('populated card shows five metrics with evidence visible before closed details', () => {
  const tree = render(populatedSnapshot()), all = nodes(tree)
  const visible = text({ ...tree, children: tree.children.filter(child => child?.type !== 'details') })
  for (const label of ['Ugen i korte træk', '2026-11-01', '2026-11-07', '2 pas', '1 af 2 planlagte',
    '110 kg × 3', '7 timer', '3 af 5', '1.800 kcal/dag', '90 %', '4/7 dage']) assert.ok(visible.includes(label), label)
  assert.equal((visible.match(/Datagrundlag:/g) || []).length, 5)
  assert.equal(all.filter(node => node.type === 'dt').length, 5)
  assert.equal(all.filter(node => node.type === 'details').length, 1)
  assert.ok(all.filter(node => node.type === 'details').every(node => !node.props.open))
  assert.equal(all.filter(node => node.type === 'summary')[0].props.style.minHeight, 44)
  assert.equal((visible.match(/én registrering ad gangen/g) || []).length, 1)
})

test('empty card is honest, dated and neutral, with no invented values or scores', () => {
  const tree = render(emptySnapshot()), content = text(tree)
  assert.match(content, /Ingen registreringer i perioden endnu/)
  assert.match(content, /For lidt data/); assert.match(content, /0\/7 dage/)
  assert.match(content, /Kan ikke sammenlignes med mål/)
  assert.ok(nodes(tree).some(node => node.props.role === 'status'))
  assert.doesNotMatch(content, /NaN|Infinity|undefined|100 %|cyklus|sundhedsscore/)
})

test('loading and failure are distinct and retry delegates exactly once', () => {
  const loading = render({ status: 'loading' })
  assert.equal(loading.props['aria-busy'], true)
  assert.match(text(loading), /Henter ugens/)
  assert.ok(nodes(loading).some(node => node.props.role === 'status'))
  let retries = 0
  const error = AthleteWeek({ enabled: true, snapshot: { status: 'error' }, onRetry() { retries++ } })
  assert.ok(nodes(error).some(node => node.props.role === 'alert'))
  const button = nodes(error).find(node => node.type === 'button')
  assert.equal(button.props.type, 'button'); assert.equal(button.props.style.minHeight, 44)
  button.props.onClick(); assert.equal(retries, 1)
  assert.doesNotMatch(text(error), /Ingen registreringer|0 pas|Dagsform i gennemsnit/)
  assert.ok(!nodes(render({ status: 'error' })).some(node => node.type === 'button'))
})

test('folded basis retains source days, formula, missing-day explanation and dated targets', () => {
  const tree = render(populatedSnapshot()), content = text(nodes(tree).find(node => node.type === 'details'))
  for (const label of ['Manglende dage udfyldes ikke', 'kg × (1 + gentagelser/30)', '2026-11-03',
    '1.800 / 2.000 kcal', '90 / 100 g', 'synthetic-v1']) assert.ok(content.includes(label), label)
  assert.ok(nodes(tree).some(node => node.type === 'time' && node.props.dateTime === '2026-11-04'))
})

test('mobile shell can shrink and untrusted labels remain text; no raw HTML or links', () => {
  const data = populatedSnapshot(); data.strength.label = '<script>synthetic</script>'
  const tree = render(data), all = nodes(tree)
  assert.equal(tree.props.style.width, '100%'); assert.equal(tree.props.style.minWidth, 0)
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.ok(all.every(node => !('dangerouslySetInnerHTML' in node.props)))
  assert.ok(!all.some(node => ['script', 'a', 'form'].includes(node.type)))
  assert.match(text(tree), /<script>synthetic<\/script>/)
})

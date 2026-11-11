import { register } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticWeek } from './syntheticFixture.mjs'
register('./reactFixtureLoader.mjs', import.meta.url)
const { default: View } = await import('./WeekEvaluationView.mjs')
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] : [n, ...nodes(n.children)]
const text = n => Array.isArray(n) ? n.map(text).join(' ') : n == null || typeof n === 'boolean' ? '' :
  typeof n === 'object' ? text(n.children) : String(n)

test('OFF touches no input getters or callbacks', () => {
  const props = { get input() { throw Error('OFF must not read data') } }
  assert.equal(View(props), null)
  assert.equal(View({ ...{ enabled: false }, get input() { throw Error('OFF') } }), null)
})

test('enabled view uses four folded native sections and a flexible mobile layout', () => {
  const tree = View({ enabled: true, input: syntheticWeek() }), all = nodes(tree)
  // U9: forklaringerne har hver sin lukkede fold "Forklaring"; de fire sektioner er uændrede.
  const sections = all.filter(n => n.type === 'details' && !Object.hasOwn(n.props, 'data-u9-forklaring'))
  assert.equal(sections.length, 4)
  assert.equal(all.filter(n => n.type === 'details' && Object.hasOwn(n.props, 'data-u9-forklaring')).every(n => !n.props.open), true)
  assert.equal(sections.every(n => !n.props.open), true)
  assert.equal(all.filter(n => n.type === 'summary').every(n => n.props.style.minHeight >= 44), true)
  assert.equal(tree.props.style.width, '100%'); assert.equal(tree.props.style.minWidth, 0)
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.equal(all.some(n => 'dangerouslySetInnerHTML' in n.props), false)
  for (const expected of ['Syntetisk atlet', '26.10.2026', '01.11.2026', 'Top-e1RM', '2.250', '125 g', '+3 kg', 'Smerte nævnt', 'Stop nævnt']) assert.ok(text(tree).includes(expected), expected)
})

test('unknown, empty, partial and invalid inputs remain visibly distinct', () => {
  assert.match(text(View({ enabled: true, input: { athleteId: 'a', today: '2026-11-03' } })), /Data er ikke tilgængelige/)
  const p = syntheticWeek()
  for (const k of ['training', 'nutrition', 'weights', 'messages']) p[k].rows = []
  delete p.training.week.sessions[0].athlete_comment
  let output = text(View({ enabled: true, input: p }))
  assert.match(output, /Ingen noter eller beskeder/); assert.match(output, /0 af 7/)
  assert.match(output, /data mangler/)
  p.nutrition.rows = [{ athlete_id: p.athleteId, id: 'bad', date: '2026-10-26', meal: 'x', kcal: '', protein: 10 }]
  output = text(View({ enabled: true, input: p }))
  assert.match(output, /Ufuldstændige data/)
  assert.match(text(View({ enabled: true, input: null })), /afsluttet uge/)
})

test('message text is passed as text children, never as HTML', () => {
  const p = syntheticWeek(); p.messages.rows[0].content = '<script>synthetic</script>'
  const tree = View({ enabled: true, input: p })
  assert.ok(text(tree).includes('<script>synthetic</script>'))
  assert.equal(nodes(tree).some(n => n.type === 'script'), false)
})

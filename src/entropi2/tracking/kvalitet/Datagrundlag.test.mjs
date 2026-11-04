import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: View } = await import('./Datagrundlag.mjs')

const athleteId = 'synthetic-athlete-a'
const props = { enabled: true, athleteId, asOf: '2026-11-04' }
const ready = rows => ({ athleteId, state: 'ready', complete: true, rows })
function nodes(node) {
  return node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : []
}
function text(node) {
  return node == null ? '' : typeof node === 'object' ? node.children.map(text).join(' ') : String(node)
}

test('actual view OFF returns null before touching data, athlete or date', () => {
  assert.equal(View(), null)
  for (const enabled of [undefined, false, null, 'true', 1]) {
    assert.equal(View({ enabled, get sources() { throw Error('read sources') },
      get athleteId() { throw Error('read identity') }, get asOf() { throw Error('read cutoff') } }), null)
  }
})

test('actual view renders four weeks, four domains and missing days under details', () => {
  const tree = View({ ...props, sources: { training: ready([{ athlete_id: athleteId, logged_at: '2026-11-02', weight: 60, reps_completed: 5 }]),
    nutrition: ready([]), weight: ready([]), readiness: ready([]) } })
  const all = nodes(tree), content = text(tree)
  assert.equal(all.filter(n => n.type === 'h3').length, 4)
  assert.equal(all.filter(n => n.type === 'details').length, 4)
  for (const label of ['Datagrundlag', 'Træningslog', 'Kost', 'Vægt', 'Dagsform', athleteId,
    '2026-10-12 – 2026-10-18', '1/3 dage registreret; 1 med værdigrundlag', '0/3 dage registreret',
    'Igangværende uge: 3 dage', 'Uden registrering: 2026-11-03, 2026-11-04', 'Manglende træningslog kan være hvile',
    'Hvert signal kræver sit eget grundlag']) assert.ok(content.includes(label), label)
  const current = all.find(n => n.props['aria-label'] === 'Uge 2026-11-02')
  const details = nodes(current).find(n => n.type === 'details')
  assert.ok(text(details).includes('2026-11-04'))
  assert.ok(!text(details).includes('2026-11-05'))
  assert.ok(!all.some(n => n.type === 'table' || n.type === 'button' || n.type === 'input'))
})

test('failed, loading, truncated and absent reads show unknown instead of zero', () => {
  const tree = View({ ...props, sources: { training: { athleteId, state: 'error' },
    nutrition: { athleteId, state: 'loading' }, weight: { athleteId, state: 'partial' } } })
  const content = text(tree)
  for (const message of ['Data kunne ikke indlæses', 'Data indlæses', 'ikke fuldt indlæst', 'Datakilde mangler',
    'Dækning er ukendt', 'Manglende dage kan ikke opgøres']) assert.ok(content.includes(message), message)
  assert.ok(!content.includes('0/'))
  assert.ok(!content.includes('Uden registrering:'))
})

test('invalid scope/date fails visibly, without displaying counts', () => {
  for (const change of [{ athleteId: '' }, { asOf: '2026-02-30' }, { asOf: undefined }]) {
    const tree = View({ ...props, ...change })
    assert.ok(text(tree).includes('mangler eller er ugyldig'))
    assert.equal(nodes(tree).filter(n => n.props.role === 'status').length, 1)
    assert.equal(nodes(tree).filter(n => n.type === 'h3').length, 0)
  }
})

test('value deficiencies are explicit without claiming complete logs or signal validity', () => {
  const tree = View({ ...props, sources: { readiness: ready([{ athlete_id: athleteId, logged_date: '2026-11-03', readiness_score: null }]) } })
  const content = text(tree)
  assert.ok(content.includes('1/3 dage registreret; 0 med værdigrundlag'))
  assert.ok(content.includes('Uden værdigrundlag: 2026-11-03'))
  assert.ok(content.includes('ikke bevis for komplette pas eller kostdage'))
  assert.ok(content.includes('ikke en samlet kvalitetsgodkendelse'))
})

test('mobile and accessible host structure; escaped text, no HTML injection or writes', () => {
  const tree = View({ ...props, athleteId: '<script>synthetic</script>' }), all = nodes(tree)
  assert.equal(tree.props['aria-label'], 'Datagrundlag')
  assert.ok(all.some(n => n.props.style?.gridTemplateColumns?.includes('min(100%, 280px)')))
  assert.ok(all.filter(n => n.type === 'summary').every(n => n.props.style.minHeight >= 44))
  assert.ok(all.every(n => !('dangerouslySetInnerHTML' in n.props)))
  assert.ok(all.every(n => !Object.keys(n.props).some(key => /^on[A-Z]/.test(key))))
  assert.ok(all.every(n => n.type !== 'script'))
  assert.ok(text(tree).includes('<script>synthetic</script>'))
})

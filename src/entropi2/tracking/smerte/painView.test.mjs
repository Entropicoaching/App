import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./painSyntheticLoader.mjs', import.meta.url)
const { default: PainHistory } = await import('./PainHistory.mjs')
const data = daily => ({ state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: '2026-11-04', daily })
const row = (day, pain, painLocation = 'Testknæ') => ({ day, pain, painLocation, source: 'athlete_manual' })
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flatMap(nodes)]
const text = tree => !tree ? '' : typeof tree !== 'object' ? String(tree) : tree.children.map(text).join(' ')
const render = daily => PainHistory({ enabled: true, weeks: 4, data: data(daily) })

test('synthetic actual view import: OFF never reads data; loading/error/retry distinct', () => {
  assert.equal(PainHistory({ get data() { throw Error('OFF read') } }), null)
  const loading = PainHistory({ enabled: true, data: { state: 'loading' } })
  assert.ok(nodes(loading).some(n => n.props['aria-busy'] === true))
  let retries = 0
  const failed = PainHistory({ enabled: true, data: { state: 'error' }, onRetry() { retries++ } })
  assert.ok(nodes(failed).some(n => n.props.role === 'alert'))
  const button = nodes(failed).find(n => n.type === 'button')
  button.props.onClick(); assert.equal(retries, 1)
  assert.doesNotMatch(text(failed), /Flag:|Ingen indtastet/)
})

test('empty is explicit, dated and contains no invented scores or flags', () => {
  const empty = render([])
  assert.match(text(empty), /Ingen indtastet smerte med kropsområde/)
  assert.match(text(empty), /2026-10-08–2026-11-04/)
  assert.match(text(empty), /28 dage uden dagsformdata/)
  assert.doesNotMatch(text(empty), /Flag:|Senest|NaN|undefined/)
})

test('high and rising flags always include evidence outside folded history', () => {
  const rows = [row('2026-10-08', 2), row('2026-10-15', 2), row('2026-10-21', 2),
    row('2026-10-22', 4), row('2026-10-29', 4), row('2026-11-04', 7)]
  const tree = render(rows), all = nodes(tree)
  const article = all.find(n => n.type === 'article')
  const visible = text({ ...article, children: article.children.filter(n => n?.type !== 'details') })
  assert.match(visible, /Flag: smerte 7\+/)
  assert.match(visible, /Flag: stigende tendens/)
  assert.match(visible, /Datagrundlag: 1 af 6/)
  for (const r of rows) assert.ok(visible.includes(`${r.day}: ${r.pain}/10`))
  assert.match(visible, /2\/10 \(3 dage\).*5\/10 \(3 dage\)/)
  assert.match(visible, /Forslag til samtale/)
  assert.ok(all.filter(n => n.type === 'details').every(n => !n.props.open))
  assert.ok(all.filter(n => n.type === 'summary').every(n => n.props.style.minHeight === '44px'))
  assert.ok(all.some(n => n.type === 'time' && n.props.dateTime === '2026-11-04'))
})

test('sparse data and unusual area names render as text with no raw HTML API', () => {
  const tree = render([row('2026-11-04', 0, '<script>synthetic</script>')])
  assert.match(text(tree), /For lidt data til tendens/)
  assert.match(text(tree), /Ingen flag efter reglerne/)
  assert.ok(nodes(tree).every(n => !('dangerouslySetInnerHTML' in n.props)))
  assert.equal(nodes(tree).filter(n => n.type === 'script').length, 0)
})

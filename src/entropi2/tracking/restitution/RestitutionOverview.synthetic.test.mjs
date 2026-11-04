import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fixture, readiness } from './restitutionFixtures.mjs'
import { renderTree } from '../../analysis/testDom.mjs'

// Supplemental actual component/model import with the pinned synthetic element
// fixture. This checks text, attributes/events, NOT ReactDOM or visual layout.
register('../../analysis/reactLoader.mjs', import.meta.url)
const { default: RestitutionOverview } = await import('./RestitutionOverview.mjs')
const render = props => renderTree(RestitutionOverview(props))

test('synthetic actual view: OFF and distinct loading/error/empty states, retry event', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 1]) assert.equal(render({ enabled, snapshot: poison }), null)
  assert.match(render({ enabled: true, snapshot: { status: 'loading' } }).textContent, /Henter registreringer/)
  let retries = 0
  const error = render({ enabled: true, snapshot: { status: 'error', message: 'synthetic-hidden' }, onRetry() { retries++ } })
  error.querySelectorAll('button')[0].dispatchEvent({ type: 'click' })
  assert.equal(retries, 1); assert.doesNotMatch(error.textContent, /synthetic-hidden|For lidt data/)
  const empty = render({ enabled: true, snapshot: { ...fixture(), readinessRows: [], exerciseLogs: [] } })
  assert.match(empty.textContent, /For lidt data/); assert.match(empty.textContent, /0\/7 dage/)
  assert.doesNotMatch(empty.textContent, /Forsigtig restitutionsstatus|NaN|Infinity|undefined/)
})

test('synthetic actual view: levels, evidence, native folded details and safe text', () => {
  for (const [changes, level] of [[{}, 'God'], [{ energy: 3 }, 'Ok'], [{ stress: 4 }, 'Lav']]) {
    const data = fixture(); data.readinessRows = [7, 8, 9, 13].map(i => readiness(i, changes))
    const tree = render({ enabled: true, snapshot: data })
    for (const text of [`Forsigtig restitutionsstatus: ${level}`, '4/7 dage', '2/7 dage', '600 kg × gentagelser',
      'Programmet ændres ikke.', 'ikke en måling af din restitution', 'Huller udfyldes ikke.', 'Øget belastning alene giver ikke Lav.']) assert.ok(tree.textContent.includes(text), text)
    const details = tree.querySelectorAll('details')
    assert.equal(details.length, 1); assert.equal(details[0].getAttribute('open'), null)
    assert.equal(tree.querySelectorAll('summary').length, 1)
    assert.doesNotMatch(tree.textContent, /synthetic-|NaN|Infinity|undefined/)
  }
})

test('synthetic actual view: stale/invalid data remain explicit', () => {
  const data = fixture(); data.readinessRows = [7, 8, 9, 10].map(i => readiness(i))
  data.readinessRows[0].sleep_hours = Infinity; data.exerciseLogs[0].weight = null
  const tree = render({ enabled: true, snapshot: data })
  for (const text of ['For lidt data', '3/7 dage', 'sidste to dage', 'ugyldige dagsformmålinger', 'usikre sætrækker', 'Ukendt belastning']) assert.ok(tree.textContent.includes(text), text)
  assert.doesNotMatch(tree.textContent, /Forsigtig restitutionsstatus/)
})

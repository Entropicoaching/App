import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fixture, readiness, quality, set } from './sleepFixtures.mjs'
import { renderTree } from '../../analysis/testDom.mjs'

// Supplemental synthetic element/event checks only; no ReactDOM/layout claim.
// Reuse pinned public fixture. The actual component and model are imported.
register('../../analysis/reactLoader.mjs', import.meta.url)
const { default: SleepOverview } = await import('./SleepOverview.mjs')
const render = props => renderTree(SleepOverview(props))

test('synthetic actual view: OFF and status branches, retry dispatch', () => {
  assert.equal(render({ snapshot: new Proxy({}, { get() { throw Error('OFF') } }) }), null)
  assert.match(render({ enabled: true, snapshot: { status: 'loading' } }).textContent, /Henter/)
  let retries = 0
  const failure = render({ enabled: true, snapshot: { status: 'error' }, onRetry() { retries++ } })
  failure.querySelectorAll('button')[0].dispatchEvent({ type: 'click' })
  assert.equal(retries, 1)
  assert.match(render({ enabled: true, snapshot: fixture() }).textContent, /Ingen søvnregistreringer/)
})

test('synthetic actual view: dates, missing values, pas context and advice', () => {
  const data = fixture(); data.readinessRows = [0, 1, 2, 3].map(i => readiness(i, { sleep_hours: 0 }))
  data.qualityRows = [0, 1, 2, 3].map(i => quality(i)); data.exerciseLogs = [set(0)]
  const tree = render({ enabled: true, snapshot: data, weeks: 6 })
  for (const text of ['0 timer · 4/7 dage', '4 af 5 · 4/7 dage', 'Ukendt',
    '1 dage med både søvntimer og RPE', 'ikke en samlet pasvurdering', 'kg e1RM', 'pre-workout']) {
    assert.ok(tree.textContent.includes(text), text)
  }
  assert.equal(tree.querySelectorAll('details').length, 3)
  assert.equal(tree.querySelectorAll('time').length, 43)
  assert.equal(tree.querySelectorAll('a')[0].getAttribute('href'), 'https://doi.org/10.1136/bjsports-2020-102025')
  assert.doesNotMatch(tree.textContent, /NaN|Infinity|undefined|synthetic-/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, readiness, quality, set } from './sleepFixtures.mjs'

// Ordinary app npm-test discovery; real React/ReactDOM, never a replacement.
// Public-only workers cannot install missing dependencies. Report every skip.
let h, renderToStaticMarkup, SleepOverview, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: SleepOverview } = await import('./SleepOverview.mjs'))
const options = { skip: missing ? 'Real React/react-dom absent in pinned copy; Dhurva integration gate required' : false }
const render = props => renderToStaticMarkup(h(SleepOverview, props))

test('real React: OFF does not read snapshot or period', options, () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    const poison = new Proxy({}, { get() { throw Error('OFF read') } })
    assert.equal(render({ enabled, snapshot: poison, weeks: poison }), '')
  }
})

test('real React: loading, error, retry and empty are distinct', options, () => {
  assert.match(render({ enabled: true, snapshot: { status: 'loading' } }), /aria-busy="true"/)
  const failure = render({ enabled: true, snapshot: { status: 'error', message: 'synthetic-hidden' }, onRetry() {} })
  assert.match(failure, /role="alert"/); assert.match(failure, /<button type="button"/)
  assert.doesNotMatch(failure, /synthetic-hidden|Ingen søvnregistreringer/)
  const empty = render({ enabled: true, snapshot: fixture() })
  assert.match(empty, /Ingen søvnregistreringer i perioden endnu/)
  assert.match(empty, /0\/7 dage/)
  assert.doesNotMatch(empty, /NaN|Infinity|undefined/)
  const invalid = fixture(); invalid.readinessRows = [readiness(0, { sleep_hours: Infinity })]
  const invalidHtml = render({ enabled: true, snapshot: invalid })
  assert.match(invalidHtml, /Ingen gyldige søvnmålinger/)
  assert.match(invalidHtml, /ugyldige søvnmålinger/)
})

test('real React: visible weeks, independent coverage and folded details', options, () => {
  const data = fixture(); data.readinessRows = [0, 1, 2, 3].map(i => readiness(i))
  data.qualityRows = [0, 1, 2].map(i => quality(i)); data.exerciseLogs = [set(0)]
  const html = render({ enabled: true, snapshot: data })
  for (const text of ['6 uger', '7,5 timer', '4/7 dage', 'For lidt data', '3/7 dage',
    'Søvnkvalitet', 'Søvn og dine pas', 'ikke, at søvn er årsagen', 'kg e1RM', 'af 10', '1/1 sæt']) assert.ok(html.includes(text), text)
  assert.equal((html.match(/<details>/g) ?? []).length, 3)
  assert.doesNotMatch(html, /<details open|synthetic-sleep-athlete|synthetic-session/)
})

test('real React: four/eight weeks, native dates and source link', options, () => {
  for (const weeks of [4, 8]) {
    const html = render({ enabled: true, snapshot: fixture(), weeks })
    assert.equal((html.match(/class="e2-sleep-week"/g) ?? []).length, weeks)
    assert.equal((html.match(/<time\b[^>]*(?:dateTime|datetime)=/g) ?? []).length, weeks * 7)
    assert.match(html, /https:\/\/doi.org\/10.1136\/bjsports-2020-102025/)
    assert.match(html, /noopener noreferrer/)
    assert.match(html, /min-height:44px/)
  }
})

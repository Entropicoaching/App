import test from 'node:test'
import assert from 'node:assert/strict'
import { memoryStorage } from './syntheticDom.mjs'
import { firstVisitKey } from './firstVisitState.mjs'
import { createDocument, elements, click } from './firstVisitDom.mjs'

// Integration gate uses the app's real React and ReactDOM, with no loader/fallback.
// The pinned public archive excludes installed dependencies; report that honestly.
let h, act, render, createRoot, Introduction, AthleteHome, unavailable = false
try {
  const react = await import('react'), server = await import('react-dom/server'), client = await import('react-dom/client')
  h = react.createElement; act = react.act; render = server.renderToStaticMarkup; createRoot = client.createRoot
  Introduction = (await import('./AthleteIntroduction.mjs')).default
  AthleteHome = (await import('../home/AthleteHome.mjs')).default
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  unavailable = true
}
const options = { skip: unavailable ? 'Pinned public bundle has no React packages; Dhurva must run this real React gate.' : false }
const props = extra => ({ enabled: true, athleteId: 'synthetic-react', firstName: 'Testfornavn Testefternavn', storage: memoryStorage(), canLogReadiness: true, canLogWeight: true, ...extra })

test('real React: first visit appears once, uses only first name and accessible mobile controls', options, () => {
  const p = props(), html = render(h(Introduction, p))
  assert.match(html, /Trin 1 af 4/); assert.match(html, /Velkommen, Testfornavn/)
  assert.match(html, /aria-live="polite"/); assert.match(html, /tabindex="-1"/)
  assert.match(html, /min-height:52px/); assert.match(html, /Spring over/)
  assert.equal((html.match(/data-home-onboarding/g) || []).length, 1)
  assert.doesNotMatch(html, /Testefternavn|Log et sæt|<script/)
  assert.deepEqual(p.storage.writes, [])
})

test('real React: empty name/data and program failure remain honest in the actual Home screen', options, () => {
  assert.match(render(h(Introduction, props({ firstName: '' }))), />Velkommen<\/h2>/)
  for (const programError of [false, true]) {
    const html = render(h(AthleteHome, { enabled: true, athlete: { id: 'synthetic-react' },
      now: new Date('2026-11-04T12:00:00Z'), allWeeks: [], exerciseLogs: [], programError, storage: memoryStorage() }))
    assert.match(html, /Trin 1 af 4/)
    assert.match(html, programError ? /Programmet kunne ikke hentes/ : /Intet program endnu/)
    assert.doesNotMatch(html, /Start dagens pas|af 4 pas/)
  }
})

test('real React: completed/OFF are empty, storage error is visible and markup-looking names are escaped', options, () => {
  const forbidden = () => assert.fail('OFF access')
  assert.equal(render(h(Introduction, { enabled: false, storage: { getItem: forbidden, setItem: forbidden } })), '')
  assert.equal(render(h(Introduction, props({ storage: memoryStorage({ [firstVisitKey('synthetic-react')]: '1' }) }))), '')
  const html = render(h(Introduction, props({ firstName: '<script>synthetic</script> Testefternavn', storage: null })))
  assert.match(html, /&lt;script&gt;synthetic&lt;\/script&gt;/)
  assert.match(html, /role="status"/); assert.match(html, /tidligere valg kunne ikke læses/)
  assert.doesNotMatch(html, /<script>|Testefternavn/)
})

test('real ReactDOM: all four steps, back, completion, reload, athlete switch, skip and failed storage', options, async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const oldAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  const doc = createDocument(), host = doc.createElement('div'), storage = memoryStorage()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const root = createRoot(host), homeHeading = doc.createElement('h1')
  const p = props({ storage, headingRef: { current: homeHeading } })
  const show = async value => { await act(async () => root.render(h(Introduction, value))) }
  const press = async label => { await act(async () => click(host, label)) }
  try {
    await show(p)
    assert.match(host.textContent, /Trin 1 af 4.*Velkommen, Testfornavn/)
    await press('Næste'); assert.match(host.textContent, /Find dit pas/)
    assert.equal(doc.activeElement.tagName, 'H2')
    await press('Næste'); assert.match(host.textContent, /Log et sæt.*Godkendt/)
    await press('Tilbage'); assert.match(host.textContent, /Trin 2 af 4/)
    await press('Næste'); await press('Næste')
    assert.match(host.textContent, /Dagsform og vægt.*Vægt i dag på Hjem.*Gem/)
    await press('Kom i gang'); assert.equal(host.textContent, '')
    assert.equal(doc.activeElement, homeHeading)
    assert.deepEqual(storage.writes, [[firstVisitKey(p.athleteId), '1']])
    await show({ ...p, enabled: false }); await show(p); assert.equal(host.textContent, '')
    await show({ ...p, athleteId: 'synthetic-react-other' }); assert.match(host.textContent, /Trin 1 af 4/)
    await press('Spring over'); assert.equal(host.textContent, '')
    await show({ ...p, athleteId: 'synthetic-error', storage: null })
    await press('Spring over'); assert.match(host.textContent, /kunne ikke gemmes.*vises igen/)
    await press('Luk'); assert.equal(host.textContent, '')
    assert.equal(elements(host).some(n => n.tagName === 'BUTTON'), false)
    await show({ ...p, enabled: false }); assert.equal(host.textContent, '')
  } finally {
    await act(async () => root.unmount())
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window
    if (oldAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', oldAct); else delete globalThis.IS_REACT_ACT_ENVIRONMENT
  }
})

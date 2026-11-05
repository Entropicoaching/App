import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, elements } from '../onboarding/firstVisitDom.mjs'

// Discovered by app npm test. Genuine React only; never substitute a test renderer.
let h, act, render, createRoot, Home, missing = false
try {
  ;({ createElement: h, act } = await import('react'))
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: Home } = await import('./AthleteHome.mjs'))
const gate = { skip: missing ? 'Pinned copy lacks React/react-dom; genuine React required at Dhurva merge.' : false }
const athlete = { id: 'synthetic-details-react', name: 'Testfornavn Testefternavn' }
const props = (count, extra = {}) => {
  const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
    sessions: [{ id: 'synthetic-session', title: 'Syntetisk pastitel '.repeat(20), weekday: 2,
      exercises: Array.from({ length: count }, (_, i) => ({ id: `synthetic-exercise-${i}`, sets: 2,
        name: `Syntetisk løft ${i}`, note: `Note ${i} <instruktion>\n` + 'Lang syntetisk note '.repeat(60) })) }] }
  return { enabled: true, athlete, now: new Date('2026-11-04T12:00:00Z'),
    allWeeks: [week], currentWeek: week, exerciseLogs: [], storage: null, onStartSession() {},
    logWeight() { assert.fail('details must not log weight') }, setWeightInput() {}, ...extra }
}
const html = (count, extra) => render(h(Home, props(count, extra)))

test('real React: one/ten exercises use one closed native fold after visible Start and progress', gate, () => {
  for (const count of [1, 10]) for (const day of ['2026-11-03', '2026-11-04']) {
    const markup = html(count, { now: new Date(day + 'T12:00:00Z') })
    const fold = markup.match(/<details[^>]*data-home-session-details=""[^>]*>[\s\S]*?<\/details>/g)
    assert.equal(fold?.length, 1)
    assert.doesNotMatch(fold[0].split('>')[0], /\sopen(?:[\s=]|$)/)
    assert.match(fold[0], /<summary[^>]*min-height:44px[^>]*>Se øvelser og coachnoter<\/summary>/)
    const start = markup.search(/Start (dagens|næste) pas/)
    const progress = markup.indexOf(`0 af ${count * 2} sæt klaret`)
    assert.ok(start >= 0 && start < progress && progress < markup.indexOf(fold[0]))
    for (let i = 0; i < count; i++) {
      const note = `Note ${i} &lt;instruktion&gt;\n` + 'Lang syntetisk note '.repeat(60)
      assert.equal(markup.split(note).length - 1, 1)
      assert.ok(fold[0].includes(note))
    }
    assert.match(markup, /Testfornavn/); assert.doesNotMatch(markup, /Testefternavn/)
    assert.match(markup, /Ugen: 0 af 1 pas/); assert.match(markup, /data-home-checkin/)
    // QuickLogs exists only with the host's logging callbacks. Require each
    // section before comparing indices; a missing section must never pass.
    const positions = [markup.indexOf(fold[0]), markup.indexOf('data-week-sessions'),
      markup.indexOf('data-home-quick-logs'), markup.indexOf('data-home-checkin')]
    assert.ok(positions.every(index => index >= 0))
    for (let i = 1; i < positions.length; i++) assert.ok(positions[i - 1] < positions[i])
    assert.doesNotMatch(markup, /data-home-record/)
  }
})

test('real React: missing program and OFF have no session fold; preview keeps notes without Start', gate, () => {
  assert.doesNotMatch(html(1, { programError: true }), /data-home-session-details|Start dagens pas/)
  assert.equal(html(1, { enabled: false }), '')
  const preview = html(1, { sessionReadOnly: true })
  assert.match(preview, /data-home-session-details/)
  assert.match(preview, /&lt;instruktion&gt;/)
  assert.doesNotMatch(preview, /Start dagens pas|Start næste pas/)
  assert.doesNotMatch(preview, /data-home-quick-logs/)
  assert.doesNotMatch(html(1, { logWeight: undefined, setWeightInput: undefined }), /data-home-quick-logs/)
})

test('real ReactDOM: loaded record follows weekly progress before quick logs and closed check-in', gate, async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const priorAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  const doc = createDocument(), createElement = doc.createElement
  doc.createElement = tag => {
    const el = createElement(tag)
    if (tag === 'select') Object.defineProperty(el, 'options', { get: () => el.children.filter(n => n.tagName === 'OPTION') })
    return el
  }
  const host = doc.createElement('div'), writes = []
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const root = createRoot(host)
  const input = props(1, { onLogSet() { assert.fail('render must not log') }, setLogInputs() {},
    storage: { getItem() { return null }, setItem(...args) { writes.push(args) }, removeItem(...args) { writes.push(args) } },
    exerciseLogs: [{ athlete_id: athlete.id, exercise_id: 'synthetic-record-squat', set_number: 1,
      weight: 140, reps_completed: 3, skipped: false, logged_at: '2026-11-03T10:00:00Z' }],
    readHomeRecordHistory: async () => ({ status: 'ready', complete: true, athleteId: athlete.id, rows: [
      { athlete_id: athlete.id, exercise_id: 'synthetic-prior', set_number: 1, weight: 130, reps_completed: 3,
        skipped: false, logged_at: '2026-10-01T10:00:00Z', exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } },
    ] }) })
  input.currentWeek.block_name = 'Styrke'
  input.currentWeek.sessions.push({ id: 'synthetic-completed', weekday: 1,
    exercises: [{ id: 'synthetic-record-squat', name: 'Squat', sets: 1 }] })
  try {
    await act(async () => root.render(h(Home, input)))
    const nodes = elements(host)
    const section = attribute => nodes.filter(n => n.getAttribute(attribute) !== null)
    const positions = ['data-home-session-details', 'data-week-sessions', 'data-home-record',
      'data-home-quick-logs', 'data-home-checkin'].map(attribute => {
      const matches = section(attribute)
      assert.equal(matches.length, 1, attribute)
      return nodes.indexOf(matches[0])
    })
    for (let i = 1; i < positions.length; i++) assert.ok(positions[i - 1] < positions[i])
    assert.match(section('data-home-record')[0].textContent, /Ny rekord: Squat 140 kg × 3/)
    for (const attribute of ['data-home-session-details', 'data-home-checkin'])
      assert.equal(section(attribute)[0].getAttribute('open'), null)
    assert.deepEqual(writes, [])
  } finally {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
    if (priorAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', priorAct); else delete globalThis.IS_REACT_ACT_ENVIRONMENT
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { homeRecord } from './homeRecord.mjs'
import { createDocument, elements } from '../onboarding/firstVisitDom.mjs'

// Discovered by app npm test. A synthetic host is never evidence of React QA.
let h, act, render, createRoot, Home, Card, missing = false
try {
  ;({ createElement: h, act } = await import('react'))
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: Home, HomeRecordCard: Card } = await import('./AthleteHome.mjs'))
const gate = { skip: missing ? 'Pinned copy lacks React/react-dom. Genuine React remains a Dhurva merge gate; installation forbidden.' : false }

test('genuine React record card renders actual model result once, with semantic date and no motion', gate, () => {
  const athlete = { id: 'synthetic-react-owner' }
  const week = { id: 'synthetic-week', start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ id: 'synthetic-session', exercises: [{ id: 'synthetic-squat', name: 'Squat', sets: 1 }] }] }
  const props = { enabled: true, athlete, currentWeek: week, allWeeks: [week], exerciseLogs: [
    { exercise_id: 'synthetic-squat', set_number: 1, weight: '140,5', reps_completed: 3, logged_at: '2026-11-04T12:00:00Z' },
  ] }
  const record = homeRecord(props, { status: 'ready', complete: true, athleteId: athlete.id, rows: [
    { athlete_id: athlete.id, exercise_id: 'synthetic-prior', set_number: 1, weight: 130, reps_completed: 3,
      logged_at: '2026-10-01T12:00:00Z', exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } },
  ] }, new Date('2026-11-05T12:00:00Z'))
  const html = render(h(Card, { record }))
  assert.match(html, /<section[^>]*aria-label="Ny rekord"/)
  assert.equal((html.match(/Ny rekord: Squat 140,5 kg × 3/g) ?? []).length, 1)
  assert.match(html, /<time dateTime="2026-11-04"[^>]*>4\. nov\.<\/time>/i)
  assert.doesNotMatch(html, /animation|transition|canvas|script|confetti/)
  assert.equal(render(h(Card, { record: null })), '')
  assert.match(render(h(Card, { record: { ...record, lift: '<script>synthetic</script>' } })), /&lt;script&gt;/)
})

test('genuine React OFF, preview and initial Home never display stale or invented celebrations', gate, () => {
  for (const props of [{ enabled: false }, { enabled: true, sessionReadOnly: true }, { enabled: true }]) {
    const html = render(h(Home, { ...props, storage: null,
      readHomeRecordHistory() { assert.fail('SSR must not read records') } }))
    assert.doesNotMatch(html, /data-home-record|Ny rekord:/)
  }
})

test('genuine ReactDOM: sets reuse history without blinking; undo and revalidation failure remain immediate', gate, async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const priorAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  const doc = createDocument(), createElement = doc.createElement
  // Home also renders the folded weekly check-in; ReactDOM reads select.options.
  doc.createElement = tag => { const el = createElement(tag); if (tag === 'select') Object.defineProperty(el, 'options',
    { get: () => el.children.filter(n => n.tagName === 'OPTION') }); return el }
  const host = doc.createElement('div')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const root = createRoot(host), athlete = { id: 'synthetic-react-lifecycle' }
  const week = { id: 'synthetic-week', athlete_id: athlete.id, block_name: 'Styrke', start_date: '2026-11-02',
    sessions: [{ id: 'synthetic-session', exercises: [{ id: 'synthetic-squat', name: 'Squat', sets: 1 }] }] }
  const rows = [{ athlete_id: athlete.id, exercise_id: 'synthetic-prior', set_number: 1, weight: 130, reps_completed: 3,
    logged_at: '2026-10-01T12:00:00Z', exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }]
  let rowReads = 0, reads = 0
  const pending = [], history = { status: 'ready', complete: true, athleteId: athlete.id, get rows() { rowReads++; return rows } }
  const props = { enabled: true, athlete, currentWeek: week, allWeeks: [week], storage: null,
    now: new Date('2026-11-05T12:00:00Z'), onLogSet() {}, setLogInputs() {},
    exerciseLogs: [{ athlete_id: athlete.id, exercise_id: 'synthetic-squat', set_number: 1, weight: 140,
      reps_completed: 3, skipped: false, logged_at: '2026-11-04T12:00:00Z' }],
    readHomeRecordHistory() { return ++reads === 1 ? Promise.resolve(history) : new Promise((resolve, reject) => pending.push({ resolve, reject })) } }
  const show = async p => { await act(async () => root.render(h(Home, p))) }
  const cards = () => elements(host).filter(n => n.getAttribute('data-home-record') !== null)
  try {
    await show(props); assert.equal(cards().length, 1)
    const originalCard = cards()[0]
    const count = rowReads
    await show({ ...props, now: new Date('2026-11-05T12:00:30Z'), messages: [] })
    assert.equal(rowReads, count); assert.equal(reads, 1); assert.equal(cards().length, 1)
    const changed = { ...props, exerciseLogs: [{ ...props.exerciseLogs[0], weight: 150 }] }
    await show(changed)
    assert.equal(cards().length, 1); assert.match(cards()[0].textContent, /150 kg/)
    assert.equal(reads, 1); assert.equal(pending.length, 0)
    assert.equal(cards()[0], originalCard, 'the existing card DOM node survives the confirmed edit')
    await show({ ...changed, exerciseLogs: [] }); assert.equal(cards().length, 0)
    assert.equal(reads, 1)
    await show(props); assert.equal(cards().length, 1); assert.equal(reads, 1)
    const weekClone = { ...week }
    await show({ ...props, currentWeek: weekClone, allWeeks: [weekClone], exerciseLogs: [...props.exerciseLogs] })
    assert.equal(reads, 1); assert.equal(cards().length, 1)
    const longerWeek = { ...week, sessions: [{ ...week.sessions[0], exercises: [
      { ...week.sessions[0].exercises[0], sets: 12 },
    ] }] }
    const logs = []
    for (let set = 1; set <= 12; set++) {
      logs.push({ ...props.exerciseLogs[0], set_number: set, weight: set === 12 ? 150 : 140 })
      await show({ ...props, currentWeek: { ...longerWeek }, allWeeks: [longerWeek], exerciseLogs: [...logs] })
      assert.equal(cards().length, set === 12 ? 1 : 0)
      assert.equal(reads, 1, 'twelve confirmations reuse the initial history in genuine React')
    }
    assert.match(cards()[0].textContent, /150 kg/)
    await show({ ...props, now: new Date('2026-11-06T00:00:00Z') })
    assert.equal(reads, 2); assert.equal(cards().length, 1)
    await act(async () => pending.shift().reject(Error('synthetic failure'))); assert.equal(cards().length, 0)
  } finally {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
    if (priorAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', priorAct); else delete globalThis.IS_REACT_ACT_ENVIRONMENT
  }
})

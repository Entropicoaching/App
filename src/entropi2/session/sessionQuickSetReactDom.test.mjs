import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { historyElement } from './historik/exerciseHistoryDom.mjs'
import { mountSession } from './sessionView.mjs'

test('React synthetic document traverses production content text without selecting text nodes', () => {
  const doc = sessionReactDocument()
  const content = historyElement(doc, 'section', { 'data-session-comparison': '' },
    historyElement(doc, 'p', null, '300 kg → 325 kg'),
    historyElement(doc, 'button', { class: 'continue', type: 'button' }, 'Fortsæt passet'))
  doc.body.append(content)
  const text = content.firstChild.firstChild
  assert.equal(text.nodeType, 3)
  assert.equal(text.nodeName, '#text')
  assert.deepEqual(doc.body.querySelectorAll('p').map(node => node.textContent), ['300 kg → 325 kg'])
  assert.equal(text.ownerDocument, doc)
  const button = doc.body.querySelector('button')
  assert.equal(button.textContent, 'Fortsæt passet')
  assert.equal(doc.body.querySelector('.continue'), button)
  assert.equal(doc.body.querySelector('[data-session-comparison]'), content)
  assert.equal(doc.body.querySelector('section button'), button)
  assert.equal(doc.body.querySelector('[type="button"]'), button)
  assert.deepEqual(doc.body.querySelectorAll('#text'), [])
  assert.equal(content.contains(text), true)
})

test('React synthetic text supports nodeValue updates, reparenting and removal', () => {
  const doc = sessionReactDocument(), first = doc.createElement('p'), second = doc.createElement('p')
  doc.body.append(first, second)
  const text = doc.createTextNode('before')
  first.append(text)
  assert.equal(doc.body.querySelectorAll('p').length, 2)
  text.nodeValue = 'after'
  assert.equal(first.textContent, 'after')
  text.textContent = 'again'
  assert.equal(text.nodeValue, 'again')
  second.append(text)
  assert.equal(first.textContent, '')
  assert.equal(second.textContent, 'again')
  assert.equal(text.parentNode, second)
  second.removeChild(text)
  assert.equal(text.parentNode, null)
  assert.equal(doc.body.contains(text), false)
  assert.equal(second.textContent, '')
})

test('actual session renderer on React synthetic document compares, refreshes, resumes and cleans up OFF', () => {
  const doc = sessionReactDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const session = { id: 'session', exercises: [{ id: 'lift', name: 'Løft A', sets: 3, reps: 5 }] }
  const week = { id: 'week', sessions: [session] }
  const props = { enabled: true, athleteId: 'synthetic', allWeeks: [week], currentWeek: week,
    exerciseLogs: ['2026-11-04', '2026-11-05'].map((day, i) => ({ athlete_id: 'synthetic', exercise_id: 'lift',
      set_number: i + 1, weight: 60 + 5 * i, reps_completed: 5, logged_at: `${day}T10:00:00Z` })),
    logInputs: {}, setLogInputs() { assert.fail('summary wrote inputs') },
    onLogSet() { assert.fail('summary saved a set') }, parsePlannedRpe: () => null }
  const timers = new Set()
  const clock = { Date: { now: () => Date.parse('2026-11-05T12:00:00Z') },
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(host, () => props, { clock })
  const press = label => {
    const button = host.querySelectorAll('button').find(node => node.textContent === label)
    assert.ok(button, label); assert.equal(button.disabled, false); button.click()
  }
  const comparison = () => host.querySelector('[data-session-comparison]')
  try {
    press('Start dagens pas'); assert.equal(comparison(), null)
    press('Afslut pas'); assert.match(comparison().textContent, /300 kg → 325 kg/)
    assert.equal(doc.activeElement, host.querySelector('[data-heading]'))
    props.exerciseLogsLoading = true; view.update(); assert.equal(comparison(), null)
    props.exerciseLogsLoading = false; view.update(); assert.ok(comparison())
    press('Fortsæt passet'); assert.equal(comparison(), null)
    press('Afslut pas'); assert.ok(comparison())
    props.enabled = false; view.update(); assert.equal(host.querySelector('dialog'), null)
    assert.equal(timers.size, 0)
  } finally { view.dispose() }
  assert.equal(host.children.length, 0)
  assert.equal(timers.size, 0)
})

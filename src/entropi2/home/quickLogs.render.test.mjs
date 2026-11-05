import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, useState, act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { createDocument, elements, click } from '../onboarding/firstVisitDom.mjs'
import { manualClock } from '../tracking/hurtig/testFixtures.mjs'
import AthleteHome from './AthleteHome.mjs'
import QuickLogs from './QuickLogs.mjs'

const props = { enabled: true, athlete: { id: 'synthetic-athlete' }, today: '2026-11-04',
  now: new Date('2026-11-04T12:00:00Z'), weightLogs: [], readinessLog: null,
  storage: { getItem: () => null },
  saveReadiness() {}, setReadinessInput() {}, logWeight() {}, setWeightInput() {} }

test('real React: shortcuts occur once beneath the session overview and do not duplicate check-in reminders', () => {
  const html = renderToStaticMarkup(h(AthleteHome, props))
  assert.equal((html.match(/data-home-quick-logs/g) || []).length, 1)
  assert.ok(html.indexOf('data-home-quick-logs') > html.indexOf('Dit næste pas'))
  assert.ok(html.indexOf('data-home-quick-logs') < html.indexOf('data-film-set'))
  assert.match(html, />Dagsform<\/button>/); assert.match(html, />Vægt i dag<\/button>/)
  const quick = html.slice(html.indexOf('data-home-quick-logs'), html.indexOf('data-film-set'))
  assert.doesNotMatch(quick, /<form|check-in|Logget i dag/)
  assert.match(html.slice(html.indexOf('data-film-set')), /data-home-checkin/)
  assert.equal((html.match(/data-home-checkin=/g) || []).length, 1)
  assert.equal((html.match(/data-home-reminder=/g) || []).length, 1)
  const unknownStorage = renderToStaticMarkup(h(AthleteHome, { ...props, storage: null }))
  assert.equal((unknownStorage.match(/data-home-checkin=/g) || []).length, 1)
  assert.doesNotMatch(unknownStorage, /data-home-reminder=/)
})

test('real React: dated status is accessible, missing callbacks are disabled, and OFF is empty', () => {
  const html = renderToStaticMarkup(h(QuickLogs, { ...props,
    readinessLog: { athlete_id: props.athlete.id, logged_date: props.today },
    weightLogs: [{ athlete_id: props.athlete.id, logged_at: props.today, weight: 82.5 }] }))
  assert.equal((html.match(/aria-label="[^"]*Logget i dag"/g) || []).length, 2)
  assert.equal(renderToStaticMarkup(h(QuickLogs, { ...props, saveReadiness: null, logWeight: null })), '')
  assert.equal(renderToStaticMarkup(h(QuickLogs, { ...props, enabled: false })), '')
})

const history = { status: 'ready', complete: true, athleteId: props.athlete.id, today: props.today,
  readinessRows: [{ athlete_id: props.athlete.id, logged_date: '2026-11-03',
    sleep_hours: 8, energy: 2, motivation: 4, stress: 2, soreness_level: 1 }] }

test('real React: Home offers five unselected energy choices and explicit yesterday proposals without a draft mutation', () => {
  const html = renderToStaticMarkup(h(QuickLogs, { ...props, trackingData: history,
    setReadinessInput() { assert.fail('render must not update draft') }, saveReadiness() { assert.fail('render must not save') } }))
  assert.match(html, /data-home-readiness-fast=/)
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 5)
  assert.match(html, /Motivation 4 · Stress 2 · Ømhed 1 · samme som i går \(forslag\)/)
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Gem dagsform<\/button>/)
  assert.doesNotMatch(html, /Søvn \(timer/)
  const buttons = html.match(/<button[^>]*aria-label="Energi [1-5]"[^>]*>/g)
  assert.equal(buttons?.length, 5)
  for (const button of buttons) assert.match(button, /min-height:44px/)
  for (const extra of [{ enabled: false }, { sessionReadOnly: true }, { saveReadiness: null, logWeight: null }])
    assert.equal(renderToStaticMarkup(h(QuickLogs, { ...props, trackingData: history, ...extra })), '')
})

test('real ReactDOM: one energy click, explicit save, undo, retry and confirmed success on actual QuickLogs', async () => {
  const doc = createDocument(), host = doc.createElement('div'), time = manualClock(), writes = []
  const previous = new Map(['window', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  function Harness() {
    const [readinessInput, setReadinessInput] = useState({ sleep: '', energy: null, motivation: null, stress: null, soreness: null })
    const [readinessLog, setReadinessLog] = useState(null)
    return h(QuickLogs, { ...props, trackingData: history, quickClock: time.clock,
      getNow: () => new Date('2026-11-04T12:00:00Z'), readinessInput, setReadinessInput, readinessLog,
      saveReadiness: async () => {
        const saved = { athlete_id: props.athlete.id, logged_date: props.today, sleep_hours: null,
          energy: Number(readinessInput.energy), motivation: Number(readinessInput.motivation),
          stress: Number(readinessInput.stress), soreness_level: Number(readinessInput.soreness) }
        writes.push(saved); setReadinessLog(saved)
      } })
  }
  const root = createRoot(host)
  const submit = async () => {
    const target = elements(host).find(n => n.tagName === 'FORM')
    assert.ok(target)
    const event = { type: 'submit', target, bubbles: true, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true }, stopPropagation() {} }
    await act(async () => { host.events.get('submit:capture')?.(event); host.events.get('submit:bubble')(event) })
    assert.equal(event.defaultPrevented, true)
  }
  try {
    await act(async () => root.render(h(Harness)))
    await act(async () => click(host, '5'))
    assert.equal(elements(host).filter(n => n.getAttribute('aria-pressed') === 'true').length, 1)
    assert.deepEqual(writes, []); assert.equal(time.handles(), 0)
    await submit()
    await act(async () => time.advance(4999)); assert.deepEqual(writes, [])
    await act(async () => click(host, 'Fortryd'))
    await act(async () => time.advance(10000)); assert.deepEqual(writes, [])
    await submit(); await act(async () => time.advance(5000))
    assert.deepEqual(writes, [{ athlete_id: props.athlete.id, logged_date: props.today, sleep_hours: null,
      energy: 5, motivation: 4, stress: 2, soreness_level: 1 }])
    assert.match(host.textContent, /Logget i dag/)
    assert.equal(time.handles(), 0)
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
    }
  }
  assert.equal(time.handles(), 0)
})

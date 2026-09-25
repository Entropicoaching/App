// ORDRE 301 · commit 2 — automatiseringsfejl i Indbakken. Kort og uden atletdata:
// rækker uden athlete_id må ikke længere droppes stille for denne type, men
// stadig droppes for alle andre (de kræver en atlet at åbne).
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachPriorityItems, coachPriorityQueueContext } from './coachPriority.js'
import { coachInboxFocusDecision } from './coachInboxState.js'
import {
  automationAlertDetail, automationAlertResolveErrorMessage, filterOpenAutomationAlerts, formatRelativeTimeDa,
} from './automationAlerts.js'

const NOW = Date.parse('2026-09-21T12:00:00Z')
const minutesAgo = n => new Date(NOW - n * 60000).toISOString()

const openAlert = { id: 'a1', workflow_id: 'wf1', workflow_name: 'Ugentlig check-in', failed_node: 'Send mail', execution_id: '7', mode: 'trigger', occurred_at: minutesAgo(125), resolved_at: null }
const olderAlert = { id: 'a2', workflow_id: 'wf2', workflow_name: 'Backup', failed_node: 'Upload', execution_id: null, mode: 'trigger', occurred_at: minutesAgo(3000), resolved_at: null }
const resolvedAlert = { id: 'a3', workflow_id: 'wf3', workflow_name: 'Løst', failed_node: 'X', execution_id: '9', mode: 'trigger', occurred_at: minutesAgo(10), resolved_at: minutesAgo(5) }

const athlete = { id: 'ath1', name: 'Ø Test' }
const build = (extra = {}) => buildCoachPriorityItems({
  athletes: [athlete],
  trainingSignals: [],
  unreadByTrack: {},
  latestByTrack: {},
  videoReviewQueue: [],
  describeVideo: () => 'video',
  now: NOW,
  ...extra,
})

test('en automatiseringsfejl uden athlete_id droppes ikke stille', () => {
  const items = build({ automationAlerts: [openAlert] })
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, 'automation')
  assert.equal(items[0].title, 'Ugentlig check-in')
  assert.equal(items[0].detail, 'Node: Send mail · for 2 timer siden')
  assert.equal(items[0].alert.athlete_id, undefined)
})

test('andre typer uden atlet droppes stadig (uændret adfærd)', () => {
  const items = build({
    trainingSignals: [{ o_athlete_id: 'ukendt', o_severity: 'alert', o_detector: 'dropout', o_headline: 'h', o_detail: 'd' }],
    videoReviewQueue: [{ id: 'v1', athlete_id: 'ukendt', created_at: minutesAgo(5) }],
  })
  assert.deepEqual(items, [])
})

test('løste rækker og rækker uden id vises ikke', () => {
  assert.deepEqual(filterOpenAutomationAlerts([openAlert, resolvedAlert, { workflow_name: 'uden id' }, null]).map(a => a.id), ['a1'])
  assert.deepEqual(build({ automationAlerts: [resolvedAlert] }), [])
})

// ORDRE 377: mailens rækkefølge; fravær (dropout, også context) før
// afvigelse (stagnation), så beskeder, så automatiseringsfejlen.
test('rækkefølge: fravær, afvigelse, ventende besked, automatiseringsfejl', () => {
  const items = build({
    automationAlerts: [openAlert],
    trainingSignals: [
      { o_athlete_id: 'ath1', o_severity: 'context', o_detector: 'dropout', o_headline: 'Ingen logs', o_detail: '' },
      { o_athlete_id: 'ath1', o_severity: 'alert', o_detector: 'stagnation', o_headline: 'Afvigelse', o_detail: '' },
    ],
    unreadByTrack: { ath1: { besked: 1 } },
    latestByTrack: { ath1: { besked: { content: 'hej', created_at: minutesAgo(30) } } },
  })
  assert.deepEqual(items.map(item => item.kind + ':' + (item.signal?.o_severity || '')), [
    'signal:context', 'signal:alert', 'message:', 'automation:',
  ])
})

test('flere automatiseringsfejl: ældste først', () => {
  const items = build({ automationAlerts: [openAlert, olderAlert] })
  assert.deepEqual(items.map(item => item.alert.id), ['a2', 'a1'])
})

test('uden fejl er køen præcis som før', () => {
  assert.deepEqual(build(), build({ automationAlerts: [] }))
  assert.deepEqual(build({ automationAlerts: undefined }), [])
})

test('"Næste opgave" og mailens fokus-link åbner aldrig en fejl uden atlet', () => {
  const items = build({
    automationAlerts: [openAlert],
    unreadByTrack: { ath1: { besked: 1 } },
    latestByTrack: { ath1: { besked: { content: 'hej', created_at: minutesAgo(30) } } },
  })
  const queue = coachPriorityQueueContext(items, null)
  assert.equal(queue.nextItem.kind, 'message')
  assert.equal(queue.remainingCount, 1)
  const onlyAutomation = coachPriorityQueueContext(build({ automationAlerts: [openAlert] }), null)
  assert.equal(onlyAutomation.state, 'complete')
  const decision = coachInboxFocusDecision({ requested: true, view: 'inbox', refreshStatus: { kind: 'success' }, priorityItems: [items.find(item => item.kind === 'automation'), ...items.filter(item => item.kind !== 'automation')] })
  assert.equal(decision.nextItem.kind, 'message')
})

test('dansk relativ tid', () => {
  const at = n => formatRelativeTimeDa(minutesAgo(n), NOW)
  assert.equal(at(0), 'lige nu')
  assert.equal(at(-5), 'lige nu')
  assert.equal(at(1), 'for 1 minut siden')
  assert.equal(at(45), 'for 45 minutter siden')
  assert.equal(at(60), 'for 1 time siden')
  assert.equal(at(125), 'for 2 timer siden')
  assert.equal(at(24 * 60), 'for 1 dag siden')
  assert.equal(at(3 * 24 * 60), 'for 3 dage siden')
  assert.equal(formatRelativeTimeDa(null, NOW), '')
  assert.equal(formatRelativeTimeDa('ikke en dato', NOW), '')
  assert.equal(automationAlertDetail({ failed_node: '', occurred_at: minutesAgo(90) }, NOW), 'for 1 time siden')
})

test('fejlteksten ved "Markeret som set" er læsbar, også når RPC\'en ikke er kørt endnu', () => {
  const missing = automationAlertResolveErrorMessage({ code: 'PGRST202', message: 'Could not find the function public.resolve_automation_alert_v1 in the schema cache' })
  assert.match(missing, /findes ikke endnu/)
  assert.match(missing, /står stadig i indbakken/)
  assert.match(automationAlertResolveErrorMessage({ message: 'boom' }), /boom/)
  assert.match(automationAlertResolveErrorMessage(null), /Prøv igen/)
})

// Browser-only continuity for the customer-journey demo.  This is deliberately
// not authentication, a server cache, or an entitlement record.  It holds no
// raw email address and is only useful to resume this one browser's demo.

import { PROGRAM_MATCH_INPUT_SCHEMA_VERSION, validateTemplateInput } from './templateMatcher.js'
import { validateBaselineLoads } from './baselineLoads.js'
import { validateCustomerSetLog } from './customerSetLogging.js'

export const LOCAL_CUSTOMER_JOURNEY_SCHEMA_VERSION = 1
export const LOCAL_CUSTOMER_JOURNEY_STAGES = new Set([
  'match', 'baseline', 'week-one', 'week-two', 'week-two-session', 'week-two-complete',
])

const PREFIX = 'entropi:sub:customer-journey:v1:'
const ACTIVE_KEY = `${PREFIX}active-demo`

function browserStorage() {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

function hash(value) {
  let result = 2166136261
  for (const character of value) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

export function localDemoIdFromEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(normalized)) return null
  // A local namespace only. It is explicitly not an identity or security key.
  return `demo-${hash(normalized)}`
}

function snapshotKey(demoId) { return `${PREFIX}${demoId}:snapshot` }
function validDemoId(value) { return typeof value === 'string' && /^demo-[a-f0-9]{8}$/.test(value) }
function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }

function validSetLogs(value) {
  return Array.isArray(value) && value.every(item => validateCustomerSetLog(item).ok)
}

function validSummaryLogs(value) {
  return Array.isArray(value) && value.every(log => plainObject(log)
    && typeof log.exerciseId === 'string' && log.exerciseId.length > 0
    && Number.isFinite(log.loadKg) && Number.isFinite(log.reps) && Number.isFinite(log.rpe))
}

function validCompleted(value) {
  return Array.isArray(value) && value.every(item => plainObject(item)
    && typeof item.sessionId === 'string' && item.sessionId.length > 0
    && validSummaryLogs(item.logs) && validSetLogs(item.setLogs))
}

function validSessionDraft(value) {
  if (value == null) return true
  return plainObject(value)
    && Number.isInteger(value.weekNumber) && value.weekNumber >= 1
    && typeof value.sessionId === 'string' && value.sessionId.length > 0
    && Array.isArray(value.rows) && validSetLogs(value.rows)
    && plainObject(value.confirmed)
    && (value.activeIndex === null || (Number.isInteger(value.activeIndex) && value.activeIndex >= 0))
}

// Fail closed: an incomplete, unexpected, or corrupt snapshot is never
// interpreted as a real workout or a server-side state.
export function validateLocalCustomerJourneySnapshot(value) {
  if (!plainObject(value) || value.schemaVersion !== LOCAL_CUSTOMER_JOURNEY_SCHEMA_VERSION) return { ok: false }
  if (!validDemoId(value.demoId) || !LOCAL_CUSTOMER_JOURNEY_STAGES.has(value.stage)) return { ok: false }
  if (value.matchInput != null && (value.matchInput.schemaVersion !== PROGRAM_MATCH_INPUT_SCHEMA_VERSION || !validateTemplateInput(value.matchInput).valid)) return { ok: false }
  if (value.baselineLoads != null && !validateBaselineLoads(value.baselineLoads).ok) return { ok: false }
  if (!validCompleted(value.completed) || !validSetLogs(value.setLogs) || !validSessionDraft(value.sessionDraft)) return { ok: false }
  if (value.weekTwoCompleted != null && !validCompleted([value.weekTwoCompleted])) return { ok: false }
  if (!['accepted', 'kept', null].includes(value.weekTwoChoice)) return { ok: false }

  const completedSetCount = value.completed.flatMap(item => item.setLogs).length
  if (completedSetCount !== value.setLogs.length) return { ok: false }
  if (value.stage !== 'match' && !value.matchInput) return { ok: false }
  if (['week-one', 'week-two', 'week-two-session', 'week-two-complete'].includes(value.stage) && !value.baselineLoads) return { ok: false }
  if (['week-two', 'week-two-session', 'week-two-complete'].includes(value.stage) && value.completed.length === 0) return { ok: false }
  if (['week-two-session', 'week-two-complete'].includes(value.stage) && value.weekTwoChoice === null) return { ok: false }
  if (value.stage === 'week-two-complete' && value.weekTwoCompleted == null) return { ok: false }
  return { ok: true, value }
}

export function loadLocalCustomerJourney(storage = browserStorage()) {
  if (!storage) return null
  let demoId = null
  try {
    demoId = storage.getItem(ACTIVE_KEY)
    if (!validDemoId(demoId)) return null
    const raw = storage.getItem(snapshotKey(demoId))
    const parsed = raw ? JSON.parse(raw) : null
    const checked = validateLocalCustomerJourneySnapshot(parsed)
    if (checked.ok && checked.value.demoId === demoId) return checked.value
    storage.removeItem(snapshotKey(demoId))
    storage.removeItem(ACTIVE_KEY)
  } catch {
    // Quota/privacy mode/corrupt JSON all fail to a clean local start.
    try {
      if (validDemoId(demoId)) storage.removeItem(snapshotKey(demoId))
      storage.removeItem(ACTIVE_KEY)
    } catch { /* best effort only */ }
  }
  return null
}

export function loadLocalCustomerJourneyForDemo(demoId, storage = browserStorage()) {
  if (!storage || !validDemoId(demoId)) return null
  try {
    const raw = storage.getItem(snapshotKey(demoId))
    const checked = validateLocalCustomerJourneySnapshot(raw ? JSON.parse(raw) : null)
    if (checked.ok && checked.value.demoId === demoId) return checked.value
    storage.removeItem(snapshotKey(demoId))
    if (storage.getItem(ACTIVE_KEY) === demoId) storage.removeItem(ACTIVE_KEY)
    return null
  } catch { return null }
}

export function saveLocalCustomerJourney(snapshot, storage = browserStorage()) {
  const checked = validateLocalCustomerJourneySnapshot(snapshot)
  if (!storage || !checked.ok) return false
  try {
    storage.setItem(snapshotKey(snapshot.demoId), JSON.stringify(snapshot))
    storage.setItem(ACTIVE_KEY, snapshot.demoId)
    return true
  } catch { return false }
}

export function clearLocalCustomerJourney(demoId, storage = browserStorage()) {
  if (!storage || !validDemoId(demoId)) return
  try {
    storage.removeItem(snapshotKey(demoId))
    if (storage.getItem(ACTIVE_KEY) === demoId) storage.removeItem(ACTIVE_KEY)
  } catch { /* local demo cache is best effort */ }
}

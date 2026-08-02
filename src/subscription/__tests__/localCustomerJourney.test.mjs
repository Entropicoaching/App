import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LOCAL_CUSTOMER_JOURNEY_SCHEMA_VERSION,
  loadLocalCustomerJourney,
  loadLocalCustomerJourneyForDemo,
  localDemoIdFromEmail,
  saveLocalCustomerJourney,
  validateLocalCustomerJourneySnapshot,
} from '../localCustomerJourney.js'

class MemoryStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}

const input = {
  schemaVersion: 4, goal: 'powerlifting-foundation', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'low-bar', deadliftStyle: 'sumo', updatedAt: null,
}
const baselineLoads = { squat: 100, bench: 70, deadlift: 140 }
const setLog = {
  weekNumber: 1, sessionId: 'day-a', exerciseId: 'squat-low-bar', setNumber: 1,
  planned: { weightKg: 100, reps: 5, rpe: 7 },
  actual: { weightKg: 100, repsCompleted: 5, rpeActual: 7, note: '', skipped: false },
}

function snapshot(demoId, overrides = {}) {
  const completed = [{ sessionId: 'day-a', logs: [{ exerciseId: 'squat-low-bar', loadKg: 100, reps: 5, rpe: 7 }], setLogs: [setLog] }]
  return {
    schemaVersion: LOCAL_CUSTOMER_JOURNEY_SCHEMA_VERSION, demoId, stage: 'week-two', matchInput: input, baselineLoads,
    completed, setLogs: [setLog], weekTwoChoice: null, sessionDraft: null, weekTwoCompleted: null, ...overrides,
  }
}

test('lokal demo-identitet er stabil pr. normaliseret e-mail uden at gemme e-mailen i snapshot', () => {
  assert.equal(localDemoIdFromEmail(' Test@Eksempel.dk '), localDemoIdFromEmail('test@eksempel.dk'))
  assert.equal(localDemoIdFromEmail('ikke-en-mail'), null)
  const id = localDemoIdFromEmail('test@eksempel.dk')
  assert.doesNotMatch(id, /test|eksempel/i)
})

test('gyldig lokal kunderejse genoptages isoleret pr. demo-identitet', () => {
  const store = new MemoryStorage()
  const a = localDemoIdFromEmail('a@eksempel.dk')
  const b = localDemoIdFromEmail('b@eksempel.dk')
  const saved = snapshot(a)
  assert.equal(saveLocalCustomerJourney(saved, store), true)
  assert.deepEqual(loadLocalCustomerJourney(store), saved)
  assert.equal(loadLocalCustomerJourneyForDemo(b, store), null)
})

test('korrupt eller ufuldstændig browserdata fejler lukket til en ren lokal start', () => {
  const store = new MemoryStorage()
  const id = localDemoIdFromEmail('a@eksempel.dk')
  const broken = snapshot(id, { setLogs: [{ nope: true }] })
  assert.equal(validateLocalCustomerJourneySnapshot(broken).ok, false)
  assert.equal(saveLocalCustomerJourney(broken, store), false)
  store.setItem('entropi:sub:customer-journey:v1:active-demo', id)
  store.setItem(`entropi:sub:customer-journey:v1:${id}:snapshot`, '{bad-json')
  assert.equal(loadLocalCustomerJourney(store), null)
  assert.equal(store.getItem('entropi:sub:customer-journey:v1:active-demo'), null)
})

test('uge-to-valg og et afsluttet uge-to-pas kan kun genoptages som komplet lokal data', () => {
  const id = localDemoIdFromEmail('a@eksempel.dk')
  const done = { sessionId: 'day-a', logs: [{ exerciseId: 'squat-low-bar', loadKg: 102.5, reps: 5, rpe: 7 }], setLogs: [{ ...setLog, weekNumber: 2, actual: { ...setLog.actual, weightKg: 102.5 } }] }
  const complete = snapshot(id, { stage: 'week-two-complete', weekTwoChoice: 'accepted', weekTwoCompleted: done })
  assert.equal(validateLocalCustomerJourneySnapshot(complete).ok, true)
  assert.equal(validateLocalCustomerJourneySnapshot({ ...complete, weekTwoCompleted: null }).ok, false)
})

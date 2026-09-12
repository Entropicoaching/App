import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordSilentFail, pendingSilentFails, attachPendingSilentFails, clearPendingSilentFails, SILENT_FAIL_CODES,
  markUploadInflight, clearUploadInflight, takeStaleUploadInflight, summarizeSilentFailsForCoach } from './athleteSilentFailLog.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

test('recordSilentFail + pendingSilentFails: en registreret fejl kan læses igen', () => {
  const storage = fakeStorage()
  recordSilentFail('athlete-1', 'silent:pr-insert-failed', storage, '2026-09-10T12:00:00.000Z')
  const pending = pendingSilentFails('athlete-1', storage, new Date('2026-09-10T12:05:00.000Z').getTime())
  assert.equal(pending.length, 1)
  assert.equal(pending[0].code, 'silent:pr-insert-failed')
})

test('ukendt kode afvises (aldrig fri tekst ind i kø\'en)', () => {
  const storage = fakeStorage()
  const ok = recordSilentFail('athlete-1', 'fri-tekst-ikke-whitelistet', storage)
  assert.equal(ok, false)
  assert.deepEqual(pendingSilentFails('athlete-1', storage), [])
})

test('kø er pr. atlet — en anden atlet ser den ikke', () => {
  const storage = fakeStorage()
  recordSilentFail('athlete-1', 'silent:weight-log-failed', storage)
  assert.deepEqual(pendingSilentFails('athlete-2', storage), [])
})

test('ældre end 7 dage tælles ikke med i "denne uge"', () => {
  const storage = fakeStorage()
  recordSilentFail('athlete-1', 'silent:pr-insert-failed', storage, '2026-09-01T00:00:00.000Z')
  const eightDaysLater = new Date('2026-09-09T00:00:01.000Z').getTime()
  assert.deepEqual(pendingSilentFails('athlete-1', storage, eightDaysLater), [])
})

test('maks 5 ventende fejl pr. atlet — ældste falder ud', () => {
  const storage = fakeStorage()
  for (let i = 0; i < 7; i++) recordSilentFail('athlete-1', 'silent:video-upload-interrupted', storage, `2026-09-10T12:0${i}:00.000Z`)
  const pending = pendingSilentFails('athlete-1', storage, new Date('2026-09-10T13:00:00.000Z').getTime())
  assert.equal(pending.length, 5)
  assert.equal(pending[0].at, '2026-09-10T12:02:00.000Z') // de to ældste (00, 01) er faldet ud
})

test('attachPendingSilentFails: lægger kø\'en ind i session_context UDEN at rydde den', () => {
  const storage = fakeStorage()
  recordSilentFail('athlete-1', 'silent:pr-insert-failed', storage)
  const base = { athlete_note: null }
  const withFails = attachPendingSilentFails(base, 'athlete-1', storage)
  assert.equal(withFails.silent_fails.length, 1)
  assert.equal(withFails.athlete_note, null) // resten af session_context er urørt
  // IKKE ryddet endnu — en fejlet gemning må ikke tabe koderne
  assert.equal(attachPendingSilentFails(base, 'athlete-1', storage).silent_fails.length, 1)
})

test('clearPendingSilentFails: rydder kø\'en kun når kalderen selv beder om det (efter bekræftet gemning)', () => {
  const storage = fakeStorage()
  recordSilentFail('athlete-1', 'silent:pr-insert-failed', storage)
  clearPendingSilentFails('athlete-1', storage)
  const again = attachPendingSilentFails({ athlete_note: null }, 'athlete-1', storage)
  assert.equal(again.athlete_note, null)
  assert.equal(again.silent_fails, undefined) // uændret reference-fri tjek: ingen ekstra nøgle
})

test('attachPendingSilentFails rører ikke session_context når kø\'en er tom', () => {
  const storage = fakeStorage()
  const base = { athlete_note: 'hej' }
  assert.equal(attachPendingSilentFails(base, 'athlete-1', storage), base)
})

test('manglende storage vælter ikke', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.doesNotThrow(() => recordSilentFail('athlete-1', 'silent:pr-insert-failed', throwingStorage))
  assert.deepEqual(pendingSilentFails('athlete-1', throwingStorage), [])
})

test('SILENT_FAIL_CODES whitelist indeholder præcis de tre kendte koder fra runde 5', () => {
  assert.deepEqual([...SILENT_FAIL_CODES].sort(), [
    'silent:pr-insert-failed', 'silent:video-upload-interrupted', 'silent:weight-log-failed',
  ])
})

test('G16 — en afbrudt upload (markør aldrig ryddet) ses ved næste app-åbning', () => {
  const storage = fakeStorage()
  markUploadInflight('athlete-1', 'req-1', storage, '2026-09-10T12:00:00.000Z')
  const stale = takeStaleUploadInflight('athlete-1', storage)
  assert.equal(stale.requestId, 'req-1')
  // kun én gang — ryddet af selve kaldet
  assert.equal(takeStaleUploadInflight('athlete-1', storage), null)
})

test('G16 — en upload der faktisk fuldførte (markøren ryddet) ses ikke ved næste åbning', () => {
  const storage = fakeStorage()
  markUploadInflight('athlete-1', 'req-1', storage)
  clearUploadInflight('athlete-1', storage)
  assert.equal(takeStaleUploadInflight('athlete-1', storage), null)
})

test('G16 — inflight-markøren er pr. atlet', () => {
  const storage = fakeStorage()
  markUploadInflight('athlete-1', 'req-1', storage)
  assert.equal(takeStaleUploadInflight('athlete-2', storage), null)
})

test('summarizeSilentFailsForCoach: ingen rækker → intet resumé', () => {
  assert.equal(summarizeSilentFailsForCoach([]), null)
  assert.equal(summarizeSilentFailsForCoach(null), null)
})

test('summarizeSilentFailsForCoach: rækker uden silent_fails → intet resumé', () => {
  const rows = [{ session_context: { athlete_note: 'hej' } }, { session_context: null }, {}]
  assert.equal(summarizeSilentFailsForCoach(rows), null)
})

test('summarizeSilentFailsForCoach: tæller på tværs af flere rækker, ental/flertal', () => {
  const now = new Date('2026-09-10T12:00:00.000Z').getTime()
  const rows = [
    { session_context: { silent_fails: [{ code: 'silent:video-upload-interrupted', at: '2026-09-09T10:00:00.000Z' }] } },
    { session_context: { silent_fails: [{ code: 'silent:pr-insert-failed', at: '2026-09-08T10:00:00.000Z' }] } },
  ]
  assert.equal(summarizeSilentFailsForCoach(rows, now), 'Atleten havde netproblemer 2 gange i denne uge.')
  assert.equal(summarizeSilentFailsForCoach(rows.slice(0, 1), now), 'Atleten havde netproblemer 1 gang i denne uge.')
})

test('summarizeSilentFailsForCoach: ældre end 7 dage og ukendte koder tælles ikke med', () => {
  const now = new Date('2026-09-10T12:00:00.000Z').getTime()
  const rows = [
    { session_context: { silent_fails: [
      { code: 'silent:pr-insert-failed', at: '2026-09-01T00:00:00.000Z' }, // > 7 dage gammel
      { code: 'fri-tekst-ikke-whitelistet', at: '2026-09-09T10:00:00.000Z' }, // ukendt kode
    ] } },
  ]
  assert.equal(summarizeSilentFailsForCoach(rows, now), null)
})

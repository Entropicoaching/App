import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as q from './offlineSetQueue.js'

const key = 'entropi_offline_sets:a'
const entry = { exerciseId: 'e', setNumber: 1, clientId: 'c', payload: { weight: 80 } }
function storage(queue) {
  const map = new Map([[key, JSON.stringify(queue)]])
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
  }
}

test('K9a: defekt objektkoetid stopper ikke sortering eller afsendelse af raske poster', async () => {
  const st = storage({ broken: { ...entry, queuedAt: { toString: 'legacy' } }, healthy: { ...entry, clientId: 'h', queuedAt: 1000 } })
  const before = st.getItem(key)
  const sent = []
  for (const [id, item] of q.orderedOfflineSets('a', st)) {
    const payload = q.queuedPayloadWithTime(item)
    await Promise.resolve().then(() => sent.push({ id, payload }))
    q.clearOfflineSetIfSame('a', id, item, st)
  }
  assert.deepEqual(sent.map(x => x.id), ['broken', 'healthy'])
  assert.deepEqual(sent[0].payload, entry.payload)
  assert.equal(sent[1].payload.logged_at, '1970-01-01T00:00:01.000Z')
  assert.deepEqual(q.loadOfflineSets('a', st), {})
  assert.equal(JSON.parse(before).broken.queuedAt.toString, 'legacy')
})

test('K9b: tidsnormalisering beskytter Date og bevarer gamle gyldige tider', () => {
  for (const queuedAt of [{ toString: 'legacy' }, {}, [], [1000], true, false, null, '', ' ', 'invalid', 9e20]) {
    const item = JSON.parse(JSON.stringify({ ...entry, queuedAt }))
    assert.equal(q.queuedPayloadWithTime(item), item.payload)
  }
  for (const [queuedAt, expected] of [[1000, '1970-01-01T00:00:01.000Z'], [0, '1970-01-01T00:00:00.000Z'], ['2020-01-02T03:04:05Z', '2020-01-02T03:04:05.000Z']]) {
    const item = { ...entry, queuedAt }
    assert.equal(q.queuedPayloadWithTime(item).logged_at, expected)
    assert.equal(item.payload.logged_at, undefined)
  }
  const payload = { logged_at: '2020-01-01T00:00:00Z', weight: 80 }
  assert.equal(q.queuedPayloadWithTime({ payload, queuedAt: { toString: 'legacy' } }), payload)
})

test('K10a: talstreng 2 bliver til 3 og parkeres foerst ved femte afvisning', () => {
  const st = storage({ e_1: { ...entry, failures: '2' } })
  const sent = q.loadOfflineSets('a', st).e_1
  // Samme rene graensebetingelse som noteRoundFailure i den pinnede kalder.
  function refuse() {
    const { failures } = q.noteOfflineSetFailure('a', 'e_1', sent, '42501', {}, st)
    if (failures >= 5) q.parkOfflineSet('a', 'e_1', sent, '42501', st)
    return failures
  }
  assert.equal(refuse(), 3)
  assert.equal(q.countOfflineSets('a', st), 1)
  assert.deepEqual(q.loadParkedSets('a', st), {})
  assert.equal(refuse(), 4)
  assert.equal(q.countOfflineSets('a', st), 1)
  assert.equal(refuse(), 5)
  assert.equal(q.countOfflineSets('a', st), 0)
  assert.equal(q.loadParkedSets('a', st).e_1.failures, '2')
})

test('K10b: defekte taellere starter sikkert og count false normaliserer uden addition', () => {
  for (const failures of [-1, 1.5, 'bad', '', ' ', {}, [], true, null, 'Infinity', 1e100, '-2', '2.5']) {
    for (const count of [true, false]) {
      const st = storage({ e_1: { ...entry, failures } })
      const sent = q.loadOfflineSets('a', st).e_1
      assert.equal(q.noteOfflineSetFailure('a', 'e_1', sent, '42501', { count }, st).failures, count ? 1 : 0)
      assert.equal(q.loadOfflineSets('a', st).e_1.failures, count ? 1 : 0)
    }
  }
  for (const failures of [2, '2', ' 2 ', '02']) {
    const st = storage({ e_1: { ...entry, failures } })
    const sent = q.loadOfflineSets('a', st).e_1
    assert.equal(q.noteOfflineSetFailure('a', 'e_1', sent, 'SLOW_NET', { count: false }, st).failures, 2)
    assert.equal(q.noteOfflineSetFailure('a', 'e_1', sent, '42501', {}, st).failures, 3)
  }
})

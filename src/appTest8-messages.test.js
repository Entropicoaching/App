import test from 'node:test'
import assert from 'node:assert/strict'
import { ugeBesked, erUgeLinjeSendt, markerUgeLinjeSendt } from './athlete/dinUge.js'
import { summarizeCoachMessages, coachMessageTrack } from './coachInboxState.js'

const message = (id, content, extra = {}) => ({ id, content, athlete_id: 'synthetic1', sender_role: 'athlete', category: 'besked', read_by_coach: false, ...extra })

test('APP-TEST8: tom samtale og tom ugelinje giver intet indhold', () => {
  for (const rows of [[], null, undefined]) {
    assert.deepEqual(summarizeCoachMessages(rows), { unreadCounts: {}, unreadByTrack: {}, latestByTrack: {} })
  }
  for (const text of ['', ' \t\r\n ', null, undefined]) assert.equal(ugeBesked(8, text), '')
})

test('APP-TEST8: lang dansk besked bevares uden afkortning eller mutation', () => {
  const text = 'Æblegrød, blåbær og dødløft. <script>syntetisk</script>\n'.repeat(2000)
  assert.equal(ugeBesked(8, `  ${text}  `), `Om uge 8: ${text.trim()}`)
  assert.equal(ugeBesked(null, ' Øv, trætte lår! '), 'Øv, trætte lår!')
  assert.equal(ugeBesked(0, 'ÆØÅ æøå'), 'Om uge 0: ÆØÅ æøå')
  const row = Object.freeze(message('m1', text))
  const summary = summarizeCoachMessages(Object.freeze([row]))
  assert.strictEqual(summary.latestByTrack.synthetic1.besked, row)
  assert.equal(summary.latestByTrack.synthetic1.besked.content, text)
  assert.equal(summary.unreadCounts.synthetic1, 1)
})

test('APP-TEST8: to beskeder med samme tekst er to ulæste beskeder', () => {
  // Input follows the caller contract: newest row first. Distinct sends have distinct IDs.
  const text = 'Må jeg øge vægten?'
  const rows = Object.freeze([Object.freeze(message('m2', text)), Object.freeze(message('m1', text))])
  const result = summarizeCoachMessages(rows)
  assert.equal(result.unreadCounts.synthetic1, 2)
  assert.deepEqual(result.unreadByTrack.synthetic1, { teknik: 0, besked: 2 })
  assert.equal(result.latestByTrack.synthetic1.besked.id, 'm2')
})

test('APP-TEST8: spor, læst-status, afsender og atlet holdes adskilt', () => {
  const rows = [message('t', 'Teknik æøå', { category: 'teknik' }),
    message('b', 'Besked', { category: null }),
    message('r', 'Læst', { read_by_coach: true }),
    message('c', 'Svar', { sender_role: 'coach' }),
    message('a', 'Anden', { athlete_id: 'synthetic2', category: 'teknik' }), null, { content: 'Ingen atlet' }]
  const result = summarizeCoachMessages(rows)
  assert.deepEqual(result.unreadCounts, { synthetic1: 2, synthetic2: 1 })
  assert.deepEqual(result.unreadByTrack.synthetic1, { teknik: 1, besked: 1 })
  assert.equal(result.latestByTrack.synthetic2.teknik.id, 'a')
  for (const category of [undefined, null, '', 'ukendt']) assert.equal(coachMessageTrack({ category }), 'besked')
})

test('APP-TEST8: gentagen sendt-markering er isoleret pr. atlet og uge', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(erUgeLinjeSendt('synthetic1', 'week1', storage), false)
  markerUgeLinjeSendt('synthetic1', 'week1', storage)
  markerUgeLinjeSendt('synthetic1', 'week1', storage)
  assert.equal(values.size, 1)
  assert.equal(erUgeLinjeSendt('synthetic1', 'week1', storage), true)
  assert.equal(erUgeLinjeSendt('synthetic2', 'week1', storage), false)
  assert.equal(erUgeLinjeSendt('synthetic1', 'week2', storage), false)
})

test('APP-TEST8: manglende og afvist storage vælter ikke beskedstatus', () => {
  const denied = { getItem() { throw new Error('synthetic denied') }, setItem() { throw new Error('synthetic quota') } }
  for (const storage of [null, denied]) {
    assert.equal(erUgeLinjeSendt('synthetic1', 'week1', storage), false)
    assert.doesNotThrow(() => markerUgeLinjeSendt('synthetic1', 'week1', storage))
  }
})

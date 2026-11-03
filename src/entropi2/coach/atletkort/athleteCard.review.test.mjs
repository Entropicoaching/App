// Independent adversarial checks: no producer fixture/helper imports.
import test from 'node:test'
import assert from 'node:assert/strict'
import { athleteCardModel } from './athleteCardModel.mjs'
import AthleteCard from './AthleteCard.mjs'

test('each card rejects receipts from every other athlete', () => {
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const facts = { today: '2026-10-25', athlete: { id: `synthetic-${i}` },
      messages: { athleteId: `synthetic-${j}`, day: '2026-10-25', state: 'ready', complete: true, count: 3 } }
    const model = athleteCardModel(facts)
    assert.equal(model.messages.state, i === j ? 'ready' : 'unknown')
    assert.equal(model.signal.kind, i === j ? 'unread' : 'unknown')
  }
})

test('weekly means ignore sample order and compare days, not sample counts', () => {
  const dates = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
    '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
  const kg = [70, 72, 74, 76, 71, 73, 75, 77, 79]
  const weight = { athleteId: 'synthetic-x', day: '2026-11-03', state: 'ready', complete: true,
    from: '2026-10-21', through: '2026-11-03', points: dates.map((day, i) => ({ day, kg: kg[i] })).reverse() }
  const facts = { athlete: { id: 'synthetic-x' }, today: '2026-11-03', weight }
  assert.equal(athleteCardModel(facts).weight.deltaKg, 2)
  const original = JSON.stringify(facts)
  athleteCardModel(facts)
  assert.equal(JSON.stringify(facts), original)
})

test('sensitive and uncontracted properties never enter the returned model or view', () => {
  const hostile = () => { throw Error('Uncontracted property read') }
  const athlete = { id: 'synthetic-x', name: 'Syntetisk X' }
  for (const key of ['cycle', 'privateNotes', 'user_id', 'email']) Object.defineProperty(athlete, key, { get: hostile })
  const facts = { athlete, today: '2026-11-03' }
  const model = athleteCardModel(facts)
  assert.deepEqual(Object.keys(model), ['id', 'name', 'lastSession', 'nutrition', 'weight', 'messages', 'signal'])
  assert.ok(AthleteCard({ enabled: true, facts }))
})

test('only literal true enables the view and OFF never reads props beyond enabled', () => {
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    const props = new Proxy({ enabled }, { get(target, key) {
      if (key !== 'enabled') throw Error(`OFF read: ${String(key)}`)
      return target[key]
    } })
    assert.equal(AthleteCard(props), null)
  }
})

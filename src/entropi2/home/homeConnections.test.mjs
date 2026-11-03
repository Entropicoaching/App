import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
import { weekSummary } from './weekSummary.mjs'
import { mountHomeOnboarding, homeOnboardingKey } from './homeOnboarding.mjs'
import { syntheticDocument, memoryStorage, descendants } from '../onboarding/syntheticDom.mjs'

const now = new Date('2026-11-03T12:00:00Z')
const athlete = { id: 'synthetic-athlete' }
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, title: `Pas ${i + 1}`, weekday: i,
    exercises: [{ id: `e${i}`, name: 'Syntetisk øvelse', sets: 1 }] })) }
const log = (i, extra = {}) => ({ athlete_id: athlete.id, exercise_id: `e${i}`, set_number: 1,
  logged_at: '2026-11-03T10:00:00Z', ...extra })
const props = extra => ({ enabled: true, athlete, currentWeek: week, allWeeks: [week],
  exerciseLogs: [log(0), log(1, { skipped: true })], now, ...extra })

function fixture(options = {}) {
  const document = syntheticDocument()
  const create = document.createElement.bind(document)
  document.createElement = tag => {
    const node = create(tag)
    node.style = {}
    node.replaceChildren = (...nodes) => { node.children = nodes }
    return node
  }
  const host = document.createElement('div'), heading = document.createElement('h1')
  const storage = memoryStorage({ unrelated: 'keep' })
  const dispose = mountHomeOnboarding(host, { enabled: true, athleteId: athlete.id,
    storage, focusTarget: heading, ...options })
  return { document, host, heading, storage, dispose, buttons: descendants(host, 'button') }
}

test('home renders one weekly sentence directly beneath the session card, with public slot semantics', () => {
  assert.equal(weekSummary(props()), 'Ugen: 2 af 4 pas')
  const html = renderToStaticMarkup(createElement(AthleteHome, props()))
  assert.match(html, /Se mit program<\/button><\/section><p[^>]*data-week-sessions=""[^>]*>Ugen: 2 af 4 pas<\/p>/)
  assert.equal((html.match(/Ugen:/g) || []).length, 1)
  assert.equal(weekSummary(props({ exerciseLogs: [] })), 'Ugen: 0 af 4 pas')
  assert.equal(weekSummary(props({ exerciseLogs: [0,1,2,3].map(i => log(i)) })), 'Ugen: 4 af 4 pas')
})

test('queued, parked, optimistic and foreign records never count as completed sessions', () => {
  for (const extra of [
    { pendingSyncKeys: ['e0_1'] }, { parkedSets: [{ exerciseId: 'e0', setNumber: 1 }] },
    { exerciseLogs: [log(0, { _optimistic: true }), log(1, { skipped: true })] },
    { exerciseLogs: [log(0, { athlete_id: 'synthetic-other' }), log(1, { skipped: true })] },
  ]) assert.equal(weekSummary(props(extra)), 'Ugen: 1 af 4 pas')
})

test('missing, conflicting, stale, foreign, empty or offline week has no invented count', () => {
  for (const extra of [
    { enabled: false }, { programError: true }, { offlineSnapshotAt: 'synthetic' },
    { exerciseLogs: undefined }, { athlete: undefined },
    { now: new Date('2026-11-09T10:00:00Z') },
    { currentWeek: { ...week, start_date: null } },
    { currentWeek: { ...week, athlete_id: 'synthetic-other' } },
    { currentWeek: { ...week, sessions: [] } },
    { exerciseLogs: [log(0), log(0, { skipped: true })] },
  ]) assert.equal(weekSummary(props(extra)), null)
})

test('Copenhagen midnight ends the loaded week even if a next-week card is shown', () => {
  assert.equal(weekSummary(props({ now: new Date('2026-11-08T22:59:59Z') })), 'Ugen: 2 af 4 pas')
  assert.equal(weekSummary(props({ now: new Date('2026-11-08T23:00:00Z') })), null)
})

test('OFF renders nothing and performs no onboarding storage access', () => {
  const forbidden = () => assert.fail('OFF side effect')
  assert.equal(renderToStaticMarkup(createElement(AthleteHome, props({ enabled: false,
    storage: { getItem: forbidden, setItem: forbidden } }))), '')
  const { host, dispose } = fixture({ enabled: false, storage: { getItem: forbidden, setItem: forbidden } })
  assert.equal(host.children.length, 0)
  dispose()
})

test('first visit reuses Hjem/Pas/Kost; completion and skip remember only the scoped athlete', () => {
  for (const skipAt of [0, 1, 2, null]) {
    const f = fixture()
    assert.equal(f.host.hidden, false)
    assert.equal(descendants(f.host, 'h2')[0].textContent, 'Hjem')
    assert.equal(f.storage.writes.length, 0)
    assert.ok(f.buttons.every(b => parseFloat(b.style.minHeight) >= 44 && b.style.minHeight.endsWith('px') && b.style.width === '100%'))
    if (skipAt == null) {
      f.buttons[0].click()
      assert.equal(descendants(f.host, 'h2')[0].textContent, 'Pas')
      f.buttons[0].click()
      assert.equal(descendants(f.host, 'h2')[0].textContent, 'Kost')
      f.buttons[0].click()
    } else {
      for (let i = 0; i < skipAt; i++) f.buttons[0].click()
      f.buttons[1].click()
    }
    assert.equal(f.host.hidden, true)
    assert.equal(f.document.activeElement, f.heading)
    assert.deepEqual(f.storage.writes, [[homeOnboardingKey(athlete.id), '1']])
    assert.equal(f.storage.getItem('unrelated'), 'keep')
    f.buttons[1].click()
    assert.equal(f.storage.writes.length, 1)
    f.dispose()
    assert.equal(fixture({ storage: f.storage }).host.hidden, true)
    assert.equal(fixture({ storage: f.storage, athleteId: 'synthetic-other' }).host.hidden, false)
  }
})

test('legacy browser-wide marker does not hide introduction for a different new athlete', () => {
  const f = fixture({ storage: memoryStorage({ 'entropi2:onboarding:v1': '1' }) })
  assert.equal(f.host.hidden, false)
})

test('unfinished visits restart; disposed handlers cannot write or focus after athlete switch', () => {
  const f = fixture()
  f.buttons[0].click()
  f.dispose()
  f.document.activeElement = null
  f.buttons[1].click()
  assert.equal(f.storage.writes.length, 0)
  assert.equal(f.document.activeElement, null)
  assert.equal(f.host.children.length, 0)
  const again = fixture({ storage: f.storage })
  assert.equal(descendants(again.host, 'h2')[0].textContent, 'Hjem')
})

test('denied storage and invalid athlete identity do not block Hjem', () => {
  const f = fixture({ storage: { getItem() { throw Error('denied') }, setItem() { throw Error('full') } } })
  f.buttons[1].click()
  assert.equal(f.host.hidden, true)
  for (const athleteId of [undefined, null, '', ' ', 0, {}, false]) {
    const f = fixture({ athleteId, storage: { getItem() { assert.fail('invalid identity') } } })
    assert.equal(f.host.children.length, 0)
  }
})

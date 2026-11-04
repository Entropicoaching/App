// These tests deliberately require real React and run under the app's npm test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteMeetDay from './AthleteMeetDay.mjs'
import { planLift } from '../meetModel.mjs'
import { draftKey, saveDraft } from './athleteMeetDraft.mjs'
import { emptyResults, planFingerprint, readPlans } from './athleteMeetModel.mjs'

const fixture = () => ({ enabled: true, athleteId: 'synthetic-athlete', meetId: 'synthetic-meet', planRevision: 'v1',
  plans: { squat: planLift({ e1RM: 200, openerTime: '10:00' }), bench: planLift({ e1RM: 100 }), deadlift: planLift({ e1RM: 250 }) },
  storage: { getItem() { return null } } })
const render = props => renderToStaticMarkup(h(AthleteMeetDay, props))

test('real React: strict OFF and loading errors do not inspect plan data or storage', () => {
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    const props = { enabled, get plans() { assert.fail('OFF plan read') }, get storage() { assert.fail('OFF storage read') } }
    assert.equal(AthleteMeetDay(props), null)
    // createElement copies props before the component runs; poison getters test
    // the component boundary directly, while SSR tests use ordinary props.
    assert.equal(render({ enabled }), '')
  }
  assert.ok(AthleteMeetDay({ enabled: true, error: true, get plans() { assert.fail('failed plan read') } }))
  const failed = render({ enabled: true, error: true })
  assert.match(failed, /role="alert"/); assert.match(failed, /kunne ikke indlæses/)
  assert.doesNotMatch(failed, /<input|<select/)
})

test('real React: selected coach attempts, folded warmup with times, labels and radio groups render for one lift', () => {
  const props = fixture(); props.plans.squat.attempts = [172.5, 180, 187.5]
  const html = render(props)
  assert.match(html, /forsøg 1 · 172,5 kg/); assert.match(html, /forsøg 3 · 187,5 kg/)
  assert.match(html, /70 kg × 5 · 35 min før åbner · kl. 09:25/)
  assert.match(html, /åbner kl. 10:00/)
  assert.equal((html.match(/<fieldset/g) ?? []).length, 3)
  assert.equal((html.match(/type="radio"/g) ?? []).length, 9)
  assert.equal((html.match(/checked=""/g) ?? []).length, 3)
  assert.equal((html.match(/<details>/g) ?? []).length, 2)
  assert.doesNotMatch(html, /<details open/)
  assert.match(html, /Ikke godkendt/); assert.match(html, /Ingen godkendte forsøg endnu/)
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const [, id] of html.matchAll(/\sfor="([^"]+)"/g)) assert.ok(ids.includes(id))
  const names = [...html.matchAll(/\sname="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(names).size, 3)
  for (const name of new Set(names)) assert.equal(names.filter(value => value === name).length, 3)
})

test('real React: empty, partial, malformed and failed data never invent attempts or zero totals', () => {
  const empty = render({ enabled: true })
  assert.equal((empty.match(/Ingen plan for/g) ?? []).length, 3)
  assert.doesNotMatch(empty, /<input|Total: 0|NaN|undefined/)
  const malformed = render({ enabled: true, plans: [] })
  assert.equal((malformed.match(/role="alert"/g) ?? []).length, 3)
  assert.doesNotMatch(malformed, /<input/)
  assert.match(render({ ...fixture(), athleteId: '' }), /Vælg en atlet/)
  const props = fixture(); props.plans.bench = null
  assert.match(render(props), /Bænkpres \(ingen plan\)/)
  props.storage = { getItem() { throw Error('synthetic denial') } }
  assert.match(render(props), /Kladden kunne ikke læses eller gemmes/)
  assert.equal((render(props).match(/<fieldset/g) ?? []).length, 3)
})

test('real React: a saved draft shows only approved weights in the total and respects plan changes', () => {
  const props = fixture(), data = new Map()
  props.storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const results = emptyResults(); results.squat = ['miss', 'good', 'miss']; results.bench = ['good', 'miss', 'miss']; results.deadlift = ['miss', 'miss', 'good']
  saveDraft(draftKey(props.athleteId, props.meetId, props.planRevision), planFingerprint(readPlans(props.plans)), results, props.storage)
  const html = render(props)
  assert.match(html, /Total: 532,5 kg/)
  assert.match(html, /Kladde gemt på denne enhed/)
  props.plans.squat.attempts[1] = 190
  const changed = render(props)
  assert.match(changed, /plan er ændret/); assert.match(changed, /Ingen godkendte forsøg endnu/)
  assert.doesNotMatch(changed, /Total: 532,5/)
})

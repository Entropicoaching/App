import test from 'node:test'
import assert from 'node:assert/strict'
import { seeded, mounted, nutrientFold, nutrientRows, freeze, micros, athleteId, date, all, propsOf } from './plannedMicronutrients.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { readAthletePlan } from './dayModel.mjs'

const labels = ['Jern', 'Calcium', 'Magnesium', 'Zink', 'Kalium', 'Natrium', 'D-vitamin', 'B12', 'Folat']
const unknown = 'Ukendt – mangler data'

for (const kind of ['partial', 'legacy', 'unsupported']) test('missing-data lead: actual StrictMode Today/Future names every supported nutrient for ' + kind, async t => {
  const f = seeded(kind === 'partial' ? 'partial' : 'complete')
  if (kind !== 'partial') for (const index of [0, 1]) {
    const version = structuredClone(f.plan.data[tableNames[1]][index])
    for (const meal of version.meals) for (const portion of meal.portions) {
      if (kind === 'legacy') for (const key of Object.keys(micros)) delete portion.food.nutrientsPer100g[key]
      else portion.food.source.unrecognized = 'Unsupported metadata'
    }
    f.plan.data[tableNames[1]][index] = freeze(version)
  }
  const original = JSON.stringify(f.plan.data), ui = await mounted(t, f)
  for (const selected of [date, '2026-11-06']) {
    if (selected !== date) await ui.choose(selected)
    const scope = selected === date ? ui.today() : ui.future(), fold = nutrientFold(scope)
    const rows = nutrientRows(scope)
    // This assertion reproduces the pinned omission before the view-only fix.
    assert.equal(rows.Jern, unknown, 'Jern must be named honestly rather than omitted or shown as zero')
    assert.deepEqual(Object.keys(rows), labels)
    const dl = all(fold, 'dl'); assert.equal(dl.length, 1)
    assert.deepEqual(all(dl[0], 'dt,dd').map(n => n.tagName.toLowerCase()), labels.flatMap(() => ['dt', 'dd']))
    assert.equal(fold.getAttribute('open'), null)
    assert.ok(propsOf(all(fold, 'summary')[0]).style.minHeight >= 44)
    assert.match(fold.textContent, /ikke spist indtag eller dokumenteret dækning/)
    assert.doesNotMatch(fold.textContent, /RDA|%|tilskud|dosis|mangler data for \d+ fødevarer/)
    const plan = await createPlanAdapter({ enabled: true, athleteId, date: selected, client: f.client }).loadActive()
    const known = readAthletePlan(plan, athleteId, selected).plannedMicronutrients ?? []
    assert.equal(known.length, kind === 'partial' ? 8 : 0, 'Known-only model does not gain placeholder rows')
    assert.ok(known.every(row => row.nutrient !== 'ironMg'))
    if (kind === 'partial') {
      assert.equal(rows.Calcium, '176 mg'); assert.equal(rows['D-vitamin'], '0 µg'); assert.equal(rows.B12, '0,879 µg')
      assert.equal(Object.values(rows).filter(v => v === unknown).length, 1)
      assert.match(fold.textContent, /Kendte summer for 8 af 9 stoffer/)
    } else {
      assert.deepEqual(rows, Object.fromEntries(labels.map(label => [label, unknown])))
      for (const dd of all(fold, 'dd')) assert.doesNotMatch(dd.textContent, /\d|mg|µg/)
      assert.match(fold.textContent, /Ingen mineral- eller vitaminsummer/)
    }
  }
  assert.equal(JSON.stringify(f.plan.data), original)
  assert.equal(f.plan.writes().length + f.writes.length + f.rows.length, 0)
  assert.equal(f.calls.filter(call => call.action !== 'select').length, 0)
})

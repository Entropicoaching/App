import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import WaterDayLog from './WaterDayLog.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

// Ordre 1685 (Marc 16. nov.: "det tager for lang tid foer noget virker"): knapperne i "Ret dagens vand"
// bruger samme knapstil som Dit væskemål (WaterGoal), ikke browserens standardknap, som blev ulæselig i mørk tilstand.
test('Ret dagens vand: knapperne har temaets knapfarver, også når Tilføj drukket vand er deaktiveret', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture(); f.approve()
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: { getItem: k => f.storage.getItem(k), setItem: f.storage.setItem } })
  t.after(async () => { await act(async () => { root.unmount(); await tick() }); dom.restore() })
  const props = { enabled: true, athleteId, date, client: f.client, currentDay: () => date }
  await act(async () => { root.render(h(WaterDayLog, props)); await tick() })
  const fold = all(dom.host, 'details').find(n => all(n, 'summary')[0]?.textContent === 'Ret dagens vand')
  const add = all(fold, 'button').find(n => n.textContent === 'Tilføj drukket vand')
  assert.ok(add); assert.equal(propsOf(add).disabled, true)
  for (const n of all(fold, 'button')) {
    const s = propsOf(n).style
    assert.equal(s.background, '#1c1c18', n.textContent)
    assert.equal(s.color, '#edeae2', n.textContent)
    assert.match(String(s.border), /#414139|#858579/, n.textContent)
  }
  assert.match(String(propsOf(add).style.border), /dashed/)
})

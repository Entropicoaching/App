import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import WaterDayLog from './WaterDayLog.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

// U9 punkt 5 (Marc 11. nov.): væskemålet med glasset er godt, men "Væske i dag" nedenunder gentog det.
// Under glasset står nu kun én lukket linje til at rette eller fjerne registreringer; ingen dublet af tal eller knapper.
test('U9 5: under glasset kun én lukket linje, ingen dublet af mængde, portioner eller forklaring', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture(); f.approve()
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  t.after(async () => { await act(async () => { root.unmount(); await tick() }); dom.restore() })
  await act(async () => { root.render(h(WaterDayLog, { enabled: true, athleteId, date, client: f.client, currentDay: () => date })); await tick() })
  const goal = all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Væskemål')
  assert.ok(goal, 'glasset står der stadig')
  const folds = all(dom.host, 'details')
  assert.equal(folds.length, 1)
  assert.equal(propsOf(folds[0]).open, undefined, 'folden er lukket')
  assert.equal(all(folds[0], 'summary')[0].textContent, 'Ret dagens vand')
  assert.equal(dom.host.textContent.includes('Væske i dag'), false)
  const labels = all(dom.host, 'button').map(n => n.textContent)
  assert.equal(labels.filter(l => /250 ml/.test(l)).length, 1, 'kun glassets + 250 ml')
  assert.equal(labels.filter(l => /500 ml/.test(l)).length, 1, 'kun glassets + 500 ml')
  assert.doesNotMatch(folds[0].textContent, /Registrér kun vand|Registreret vand i dag|Intet vand registreret|tekniske grænser|Ændringer gemmes kun/)
})

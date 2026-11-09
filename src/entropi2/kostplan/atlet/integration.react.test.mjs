// Required real React gate, automatically discovered by npm test. No loader,
// fake package, skip or dependency fallback is permitted for this file.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import ActivePlan from './ActivePlan.mjs'
import KostDayFrame from './KostDayFrame.mjs'
import { KostplanAtletView } from './KostplanAtlet.mjs'
import { createKostDaySession } from './daySession.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'

const open = f => createKostDaySession({ enabled: true, athleteId, date, client: f.client, storage: f.storage })
const render = controller => renderToStaticMarkup(h(KostDayFrame, { controller,
  tracker: h('div', { 'data-existing-tracker': '' }, 'Eksisterende tracker og vejning') }))
const nodes = node => !isValidElement(node) ? [] : [node, ...[node.props.children].flat(Infinity).flatMap(nodes)]

test('real React: SSR is read-free and OFF stays empty; old sibling never duplicates the day plan', () => {
  const client = { from() { throw Error('SSR read') } }
  for (const enabled of [false, undefined, 1, 'true']) assert.equal(renderToStaticMarkup(h(Entropi2Kost, { enabled, athlete: { id: athleteId }, date, client })), '')
  assert.match(renderToStaticMarkup(h(Entropi2Kost, { enabled: true, athlete: { id: athleteId }, date, client })), /data-entropi2-kost/)
  assert.equal(renderToStaticMarkup(h(ActivePlan, { enabled: true, athleteId, date, client })), '')
})

test('real React: missing/empty plan renders distinct status and an open diary', async t => {
  for (const config of [{ missing: true }, {}]) {
    const f = fixture(config), s = open(f); t.after(s.dispose); await s.controller.load()
    const html = render(s.controller)
    assert.match(html, /<details open=""/)
    // Before the migration (no plans table) the day is an honest tracker day too.
    assert.match(html, /Du har ingen aktiv kostplan/)
    assert.doesNotMatch(html, /role="alert"/)
    assert.match(html, /data-existing-tracker/); assert.doesNotMatch(html, /Dagens kostplan|Spist som planlagt/)
    assert.equal(f.rows.length, 0); assert.deepEqual(f.writes, [])
  }
})

test('real React: a failed first read exposes retry and never claims an empty plan', async t => {
  for (const config of [{ error: '42501' }, { before() { throw Error('synthetic offline') } }]) {
    const f = fixture(config), s = open(f); t.after(s.dispose)
    assert.equal(await s.controller.load(), false)
    const html = render(s.controller)
    assert.match(html, /data-existing-tracker/)
    assert.match(html, /role="alert".*Kostplanen kunne ikke hentes/)
    assert.match(html, /Hent kostplan igen/)
    assert.doesNotMatch(html, /Du har ingen aktiv kostplan/)
    assert.equal(f.rows.length, 0); assert.deepEqual(f.writes, []); assert.equal(f.plan.writes().length, 0)
  }
})

test('real React: active day uses actual adapter/contracts and one-tap handler, escaped food and an open tracker', async t => {
  const f = fixture(); f.approve(); const s = open(f); t.after(s.dispose); await s.controller.load()
  let html = render(s.controller)
  assert.equal((html.match(/Dagens kostplan<\/h1>/g) || []).length, 1)
  assert.match(html, /Frokost &lt;syntetisk&gt;/)
  assert.match(html, /Tilbage i dag: 500 kcal · 50 g protein/)
  assert.match(html, /<details open=""><summary[^>]*>Kostlog og vejning/)
  assert.doesNotMatch(html, /Plan fra din coach/)
  const tree = KostplanAtletView({ enabled: true, snapshot: s.controller.snapshot(), onEaten: s.controller.markEaten })
  await nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Frokost <syntetisk>: Spist som planlagt').props.onClick()
  await flush(); html = render(s.controller)
  assert.match(html, /1 af 2 måltider spist/); assert.match(html, /Tilbage i dag: 300 kcal · 30 g protein/)
  assert.equal(f.rows.length, 1); assert.equal(f.plan.writes().length, 0)
})

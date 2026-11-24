import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Ordre 2034f (Marc 23. nov.: kost er en pakke, skjult for atleter uden): Hjem viser hverken
// Kost-linket eller kostlinjen, når atletens egen læsning har sat athlete.kostPakke = false.
// Uden feltet (coachens forhåndsvisning, læsefejl) er Hjem som før. Samme kopi af Hjem og samme
// syntetiske hooks som homeDestinations.synthetic.test.mjs.
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react'
    ? { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href)}; export const useMemo = fn => fn();`) }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const nutritionToday = { date: '2026-11-04', kcal: 400, kcalTarget: 2400 }
const props = extra => ({ enabled: true, now: new Date('2026-11-04T12:00:00Z'), storage: null, messages: [], ...extra })
const text = node => node == null || node === false ? '' : typeof node === 'object' ? node.children.map(text).join('') : String(node)
const buttons = view => view.nodes(n => n.type === 'button')
const kostKnapper = view => buttons(view).filter(n => /^(Kost|Kost i dag:.*)$/.test(text(n)))

test('uden kostpakke: intet Kost-link og ingen kostlinje på Hjem, resten står', t => {
  for (const snapshot of [null, nutritionToday]) {
    const calls = []
    const view = mount(Home, props({ athlete: { id: 'synthetic-uden-pakke', kostPakke: false }, nutritionToday: snapshot, setTab: r => calls.push(r) }))
    t.after(() => view.unmount())
    assert.equal(kostKnapper(view).length, 0, 'intet om kost på Hjem')
    assert.ok(buttons(view).find(n => text(n) === 'Analyse'), 'Analyse står stadig')
    assert.ok(buttons(view).find(n => text(n) === 'Mobilitet'), 'Mobilitet står stadig')
    assert.ok(buttons(view).find(n => text(n) === 'Din coach'), 'Din coach står stadig')
    assert.deepEqual(calls, [])
  }
})

test('med kostpakke eller uden feltet: Hjem som før med præcis ét Kost-mål', t => {
  for (const athlete of [{ id: 'synthetic-med-pakke', kostPakke: true }, { id: 'synthetic-ukendt' }]) {
    for (const snapshot of [null, nutritionToday]) {
      const view = mount(Home, props({ athlete, nutritionToday: snapshot }))
      t.after(() => view.unmount())
      const kost = kostKnapper(view)
      assert.equal(kost.length, 1, JSON.stringify(athlete))
      assert.equal(text(kost[0]).startsWith('Kost i dag:'), snapshot != null)
    }
  }
})

test('værtens visKost false vinder også uden kostPakke-feltet', t => {
  const view = mount(Home, props({ athlete: { id: 'synthetic-host' }, visKost: false, nutritionToday }))
  t.after(() => view.unmount())
  assert.equal(kostKnapper(view).length, 0)
})

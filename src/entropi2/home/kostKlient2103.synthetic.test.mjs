import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Ordre 2103 (Marc 24. nov.: "kost kan købes alene"): en atlet med kostpakke og uden program får Kost som dagens ting på Hjem
// og ingen trænings-tomtilstand. Atleter med program eller uden pakke er som før. Kun syntetiske atleter.
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react'
    ? { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href)}; export const useMemo = fn => fn();`) }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const nutritionToday = { date: '2026-11-04', kcal: 400, kcalTarget: 2400 }
const now = new Date('2026-11-04T12:00:00Z')
const tom = { allWeeks: [], currentWeek: null, exerciseLogs: [] }
const props = extra => ({ enabled: true, now, storage: null, messages: [], ...extra })
const text = node => node == null || node === false ? '' : typeof node === 'object' ? node.children.map(text).join('') : String(node)
const buttons = view => view.nodes(n => n.type === 'button')
const alt = view => view.nodes(() => true).length ? text(view.nodes(n => n.type === 'main')[0]) : ''

test('kostpakke og intet program: Kost er dagens ting, ét tryk fra Hjem, og ingen trænings-tomtilstand', t => {
  const calls = []
  const view = mount(Home, props({ athlete: { id: 'synthetic-kostklient', kostPakke: true }, ...tom, nutritionToday, setTab: r => calls.push(r) }))
  t.after(() => view.unmount())
  const side = alt(view)
  assert.match(side, /Din kost i dag/)
  assert.doesNotMatch(side, /ved at lægge dit program|Se mit program|Dit næste pas|Start dagens pas|0 af 0|ikke lagt/)
  const aabn = buttons(view).filter(n => text(n) === 'Åbn kost')
  assert.equal(aabn.length, 1)
  aabn[0].props.onClick()
  assert.deepEqual(calls, ['kost'])
})

test('uden kostpakke eller uden felt: Hjem som før', t => {
  for (const [athlete, data] of [[{ id: 'synthetic-uden-pakke', kostPakke: false }, tom], [{ id: 'synthetic-ukendt' }, tom]]) {
    const view = mount(Home, props({ athlete, ...data, nutritionToday }))
    t.after(() => view.unmount())
    const side = alt(view)
    assert.match(side, /Din coach er ved at lægge dit program/, JSON.stringify(athlete))
    assert.doesNotMatch(side, /Din kost i dag/)
    assert.equal(buttons(view).some(n => text(n) === 'Åbn kost'), false)
  }
})

test('værtens visKost false vinder: ingen kostklient-kort', t => {
  const view = mount(Home, props({ athlete: { id: 'synthetic-host', kostPakke: true }, ...tom, visKost: false, nutritionToday }))
  t.after(() => view.unmount())
  assert.doesNotMatch(alt(view), /Din kost i dag/)
})

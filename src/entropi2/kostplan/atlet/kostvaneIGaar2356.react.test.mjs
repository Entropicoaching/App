import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import KostvaneCheckin from './KostvaneCheckin.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

// Ordre 2356: Kostvane-kortets "Jeg spiste som i går" gemmer med dagens plannavne og kan fortrydes som én gruppe.
const athleteId = 'a-2356', date = '2026-11-25'
const igaar = [{ meal: 'Havregrød med bær', kcal: 400, protein: 25 }, { meal: 'Kylling og ris', kcal: 600, protein: 45 }]

function fakeTracker({ undoable = true } = {}) {
  const listeners = new Set()
  let state = { loaded: true, athleteId, date, logs: [], yesterday: igaar, historyRows: [], totals: { kcal: 0, protein: 0 }, targets: {}, undo: null }
  const set = next => { state = { ...state, ...next }; listeners.forEach(fn => fn()) }
  const logged = [], undone = []
  return { logged, undone, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, snapshot: () => state,
    log: async (meal, intent) => {
      logged.push(meal.meal)
      set({ logs: [...state.logs, { ...meal, date }], undo: undoable ? { token: intent, rowId: 'r' + logged.length } : null })
      return true
    },
    undoRows: async ids => { undone.push(...ids); set({ logs: [], undo: null }); return ids.length } }
}

async function mount(t, props) {
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: { getItem: () => null, setItem() {} } })
  t.after(async () => { try { await act(async () => { root.unmount(); await tick() }) } finally { dom.restore() } })
  await act(async () => { root.render(h(KostvaneCheckin, { athleteId, date, storage: null, ...props })); for (let i = 0; i < 4; i++) await tick() })
  return dom
}
const tryk = async (node, n = 8) => act(async () => { await propsOf(node).onClick(); for (let i = 0; i < n; i++) await tick() })

test('Kostvane: med plan får gårsdagens rækker plannavne, og Fortryd fjerner hele gruppen', async t => {
  const tracker = fakeTracker()
  const dom = await mount(t, { tracker, planNames: ['Morgenmad', 'Frokost'] })
  await tryk(button(dom.host, 'Jeg spiste som i går (2 måltider)'))
  assert.deepEqual(tracker.logged, ['Morgenmad', 'Frokost'])
  const fortryd = button(dom.host, 'Fortryd')
  assert.ok(fortryd, 'Fortryd vises, når hele gruppen er gemt med id')
  await tryk(fortryd)
  assert.deepEqual(tracker.undone, ['r1', 'r2'])
  assert.equal(button(dom.host, 'Fortryd'), undefined)
  assert.ok(button(dom.host, 'Jeg spiste som i går (2 måltider)'), 'knappen er tilbage, når dagen er tom')
})

test('Kostvane: uden plan bevares gårsdagens navne som før (vagtprøve)', async t => {
  const tracker = fakeTracker()
  const dom = await mount(t, { tracker })
  await tryk(button(dom.host, 'Jeg spiste som i går (2 måltider)'))
  assert.deepEqual(tracker.logged, ['Havregrød med bær', 'Kylling og ris'])
})

test('Kostvane: uden rækkeider vises ingen Fortryd (vagtprøve)', async t => {
  const tracker = fakeTracker({ undoable: false })
  const dom = await mount(t, { tracker, planNames: ['Morgenmad', 'Frokost'] })
  await tryk(button(dom.host, 'Jeg spiste som i går (2 måltider)'))
  assert.deepEqual(tracker.logged, ['Morgenmad', 'Frokost'])
  assert.equal(button(dom.host, 'Fortryd'), undefined)
})

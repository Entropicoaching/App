import test from 'node:test'
import assert from 'node:assert/strict'

// U6 4/5: Mad-rækken står før træningsrækken i I dag-kortet. Kun syntetiske data.
let React, render, TodayCard, missing = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: TodayCard } = await import('../home/today/TodayCard.mjs'))
const gate = { skip: missing ? 'Kræver ægte React.' : false }
const A = 'atlet-syntetisk-u6'
const today = '2026-11-10'

// Server-render kører ingen effekter; mad vises, når måltiderne er hentet. Derfor en klient-render.
async function rows(extra) {
  const { act } = React, { createRoot } = await import('react-dom/client')
  const { createDocument, elements } = await import('../onboarding/firstVisitDom.mjs')
  const doc = createDocument(), host = doc.createElement('div')
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(host)
  try {
    await act(async () => root.render(React.createElement(TodayCard, { athlete: { id: A }, today, setTab() {},
      u5ReadMeals: async () => ({ status: 'ready', today: 0, yesterday: [{ meal: 'Syntetisk grød', kcal: 400 }] }),
      u5ReadLastWeights: async () => ({}), u5Training: { kind: 'today', logged: 0, total: 4, exercises: [] }, ...extra })))
    await act(async () => new Promise(r => setTimeout(r, 0)))
    return elements(host).map(n => n.attributes ?? n.props ?? {}).map(a => Object.keys(a).find(k => /^data-u5-(weight|readiness|training|meal)$/.test(k))).filter(Boolean)
  } finally {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
  }
}

test('U6 4/5: med flaget står Mad før Træning; uden flaget som i U5', gate, async () => {
  assert.deepEqual(await rows({ u6MealFirst: true }), ['data-u5-meal', 'data-u5-training'])
  assert.deepEqual(await rows({ u6MealFirst: false }), ['data-u5-training', 'data-u5-meal'])
})

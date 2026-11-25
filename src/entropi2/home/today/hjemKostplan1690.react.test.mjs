import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, click } from '../../onboarding/firstVisitDom.mjs'
import { createPlanSnapshot } from '../../kostplan/planSnapshot.mjs'

// Ordre 1690: Mad-rækken på Hjem kender dagens godkendte kostplan med Kosts egen læser.
// Ægte React og planAdapter på syntetiske data; ingen netværk.
let React, act, createRoot, TodayCard, todayRead, missing = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: TodayCard } = await import('./TodayCard.mjs'))
  todayRead = await import('./todayRead.mjs')
}
const gate = { skip: missing ? 'Kræver ægte React.' : false }
const h = (...a) => React.createElement(...a)
const A = '30000000-0000-4000-8000-000000001690'
const today = '2026-11-18', yesterday = '2026-11-17'
const id = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const food = (name, kcal, p, c, f) => ({ name, nutrientsPer100g: { energyKcal: kcal, proteinG: p, carbohydrateG: c, fatG: f },
  source: { citation: 'Syntetisk prøve 1690', verification: 'syntetisk' } })
const snapshot = createPlanSnapshot({ goal: 'cut', intensity: 0.5, meals: [
  { name: 'Morgenmad', portions: [{ grams: 100, food: food('Havregryn', 370, 13, 60, 7) }, { grams: 250, food: food('Skyr', 60, 11, 4, 0.2) }] },
  { name: 'Frokost', portions: [{ grams: 200, food: food('Kylling', 110, 23, 0, 2) }, { grams: 250, food: food('Ris', 130, 2.7, 28, 0.3) }] },
  { name: 'Aftensmad', portions: [{ grams: 200, food: food('Laks', 200, 20, 0, 13) }, { grams: 300, food: food('Kartofler', 77, 2, 17, 0.1) }] },
] })
const planTables = () => ({
  kostplan_v1_plans: [{ id: id(901), athlete_id: A, valid_from: '2026-11-16', status: 'godkendt' }],
  kostplan_v1_versions: [{ id: id(902), plan_id: id(901), version_no: 1, effective_from: '2026-11-16', goal: 'cut', intensity: 0.5,
    meals: JSON.parse(JSON.stringify(snapshot.meals)), portion_guidance: null }],
  kostplan_v1_approvals: [{ version_id: id(902), plan_id: id(901), athlete_id: A, approved_at: '2026-11-16T08:00:00.000000Z', approval_kind: 'coach' }],
})
const yesterdayMeals = () => [{ athlete_id: A, date: yesterday, meal: 'Havregrød', kcal: 400, protein: 20, carb: 60, fat: 8 },
  { athlete_id: A, date: yesterday, meal: 'Kylling og ris', kcal: 650, protein: 45, carb: 70, fat: 15 }]

// Syntetisk klient med Supabase' kædeform; fail gør én tabel til en læsefejl. reads tæller pr. tabel.
function fakeClient(tables, { fail = null, reads = {} } = {}) {
  return { from(name) {
    reads[name] = (reads[name] ?? 0) + 1
    const q = { filters: [], select() { return q }, eq(k, v) { q.filters.push(r => r[k] === v); return q },
      gte(k, v) { q.filters.push(r => r[k] >= v); return q }, lte(k, v) { q.filters.push(r => r[k] <= v); return q },
      in(k, v) { q.filters.push(r => v.includes(r[k])); return q }, order() { return q }, limit() { return q },
      then(ok, bad) {
        const result = name === fail ? { error: { code: 'XX000', message: 'syntetisk fejl' }, data: null }
          : { error: null, data: (tables[name] || []).filter(r => q.filters.every(f => f(r))) }
        return Promise.resolve(result).then(ok, bad)
      } }
    return q
  } }
}
async function mount(props) {
  const doc = createDocument(), host = doc.createElement('div')
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(host)
  const render = async extra => { await act(async () => root.render(h(TodayCard, { athlete: { id: A }, today, ...props, ...extra }))); await act(async () => new Promise(r => setTimeout(r, 0))) }
  await render()
  return { host, render, meal: () => host.textContent.slice(host.textContent.indexOf('Mad')), async done() {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
  } }
}

test('1690: med godkendt plan i dag siger Mad-rækken planen i én linje, og Log mad fører til Kost', gate, async () => {
  const tabs = [], m = await mount({ u5Client: fakeClient(planTables()), setTab: t => tabs.push(t) })
  try {
    assert.match(m.meal(), /Din kostplan i dag: 3 måltider, 1\.696 kcal\./)
    assert.doesNotMatch(m.meal(), /Søg eller vælg en favorit under Kost/)
    assert.equal(m.host.textContent.split('Din kostplan i dag').length - 1, 1)
    await act(async () => { click(m.host, 'Log mad'); await new Promise(r => setTimeout(r, 0)) })
    assert.deepEqual(tabs, ['kost'])
  } finally { await m.done() }
})

test('1690: uden plan er Mad-rækken uændret', gate, async () => {
  const m = await mount({ u5Client: fakeClient({}), setTab() {} })
  try {
    assert.match(m.meal(), /Log mad/)
    assert.match(m.meal(), /Søg eller vælg en favorit under Kost\./)
    assert.doesNotMatch(m.host.textContent, /kostplan/i)
  } finally { await m.done() }
})

test('1690: med "Jeg spiste som i går" bevares knappen; planlinjen er teksten under', gate, async () => {
  const m = await mount({ u5Client: fakeClient({ ...planTables(), meal_logs: yesterdayMeals() }), setTab() {} })
  try {
    assert.match(m.meal(), /Jeg spiste som i går \(2 måltider\)/)
    assert.match(m.meal(), /Din kostplan i dag: 3 måltider, 1\.696 kcal\./)
    assert.doesNotMatch(m.meal(), /Spiste du andet/)
  } finally { await m.done() }
})

test('1690: fejler planlæsningen, står den gamle tekst og ingen fejl', gate, async () => {
  for (const fail of ['kostplan_v1_versions', 'kostplan_v1_plans', 'kostplan_v1_approvals']) {
    const m = await mount({ u5Client: fakeClient(planTables(), { fail }), setTab() {} })
    try {
      assert.match(m.meal(), /Søg eller vælg en favorit under Kost\./, fail)
      assert.doesNotMatch(m.host.textContent, /fejl|kostplan/i, fail)
      assert.equal(m.host.querySelector?.('[role="alert"]') ?? null, null)
    } finally { await m.done() }
  }
  const thrown = await mount({ u5ReadMeals: async () => ({ status: 'ready', today: 0, yesterday: [] }),
    u5ReadPlan: async () => { throw Error('syntetisk') }, setTab() {} })
  try { assert.match(thrown.meal(), /Søg eller vælg en favorit under Kost\./) } finally { await thrown.done() }
})

test('1690: planen læses én gang pr. atlet og dag, ikke ved hver gengivelse', gate, async () => {
  const calls = []
  const props = { u5ReadMeals: async () => ({ status: 'ready', today: 0, yesterday: [] }), setTab() {},
    u5ReadPlan: async args => { calls.push(args.today); return { meals: 3, kcal: 2232 } } }
  const m = await mount(props)
  try {
    assert.match(m.meal(), /Din kostplan i dag: 3 måltider, 2\.232 kcal\./)
    await m.render({ weightLogs: [] }); await m.render({ readinessLog: null })
    assert.deepEqual(calls, [today])
  } finally { await m.done() }
})

test('1690: planlinjen tåler ét måltid og manglende kcal', gate, () => {
  assert.equal(todayRead.planLine({ meals: 1, kcal: 650 }), 'Din kostplan i dag: 1 måltid, 650 kcal.')
  assert.equal(todayRead.planLine({ meals: 4, kcal: null }), 'Din kostplan i dag: 4 måltider.')
  assert.equal(todayRead.planLine(null), null)
  assert.equal(todayRead.planLine({ meals: 0, kcal: 100 }), null)
})

test('2345: ét logget måltid af tre lukker ikke Mad-rækken på Hjem; Log mad står og tæller siger 1 af 3', gate, async () => {
  const m = await mount({ u5ReadMeals: async () => ({ status: 'ready', today: 1, yesterday: [] }),
    u5ReadPlan: async () => ({ meals: 3, kcal: 1696 }), setTab() {} })
  try {
    assert.match(m.host.textContent, /Mangler i dag: mad/)
    assert.doesNotMatch(m.host.textContent, /Alt er logget i dag/)
    assert.match(m.meal(), /Log mad/)
    assert.match(m.meal(), /1 af 3 logget\./)
  } finally { await m.done() }
  const all = await mount({ u5ReadMeals: async () => ({ status: 'ready', today: 3, yesterday: [] }),
    u5ReadPlan: async () => ({ meals: 3, kcal: 1696 }), setTab() {} })
  try { assert.doesNotMatch(all.host.textContent, /Mangler i dag: mad/) } finally { await all.done() }
})

test('2345: planen klar før måltiderne giver ingen fejl i Hjem-kortet', gate, async () => {
  const m = await mount({ u5ReadMeals: () => new Promise(() => {}), u5ReadPlan: async () => ({ meals: 3, kcal: 1696 }),
    u5Training: { kind: 'today', logged: 0, total: 3 }, setTab() {} })
  try { assert.match(m.host.textContent, /I dag/) } finally { await m.done() }
})

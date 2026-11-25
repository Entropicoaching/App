import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, click } from '../../onboarding/firstVisitDom.mjs'
import { yesterdayToCopy } from './todayRead.mjs'
import { mealsModel } from './todayModel.mjs'
import { uplanlagteRaekker } from '../../kostplan/friPulje.mjs'

// Ordre 2353: "Jeg spiste som i går" på Hjem kopierer for en kostklient som Kost i dags "Alt fra i går":
// rækkerne får plannavne, et planmåltid logget i dag kopieres ikke igen, og hele gruppen kan fortrydes.
// Ægte React på syntetiske data; ingen netværk.
let React, act, createRoot, TodayCard, missing = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: TodayCard } = await import('./TodayCard.mjs'))
const gate = { skip: missing ? 'Kræver ægte React.' : false }
const h = (...a) => React.createElement(...a)
const A = '30000000-0000-4000-8000-000000002353'
const today = '2026-11-25', yesterday = '2026-11-24'
const PLAN = ['Morgenmad', 'Frokost', 'Aftensmad']
const meal = (name, kcal, date = yesterday) => ({ athlete_id: A, date, meal: name, kcal, protein: 20, carb: 40, fat: 10 })
const igaar = () => [meal('Havregrød', 400), meal('Kylling og ris', 650), meal('Laks', 700)]

test('2353: kopien får plannavne i planens rækkefølge, som Kost i dags Alt fra i går', () => {
  const list = yesterdayToCopy(igaar(), PLAN, [])
  assert.deepEqual(list.map(row => row.meal), PLAN)
  assert.equal(uplanlagteRaekker(list.map(row => ({ ...row, date: today })), PLAN).length, 0)
})

test('2353: et planmåltid logget i dag kopieres ikke igen (navnenøgle som friPulje)', () => {
  const navngivet = [meal('Morgenmad', 400), meal('Frokost', 650), meal('Aftensmad', 700)]
  const list = yesterdayToCopy(navngivet, PLAN, [' morgenmad '])
  assert.deepEqual(list.map(row => row.meal), ['Frokost', 'Aftensmad'])
  // Uplanlagt mad i dag optager ingen planplads.
  assert.deepEqual(yesterdayToCopy(navngivet, PLAN, ['Fri: snack']).map(row => row.meal), PLAN)
  // Ukendte navne fra i går får de frie plannavne, men aldrig et allerede logget.
  assert.deepEqual(yesterdayToCopy(igaar(), PLAN, ['Morgenmad']).map(row => row.meal), ['Frokost', 'Aftensmad', 'Laks'])
})

test('2353: uden plan er listen gårsdagens som før', () => {
  const rows = igaar()
  assert.equal(yesterdayToCopy(rows, null, ['Morgenmad']), rows)
  assert.equal(yesterdayToCopy(rows, [], []), rows)
})

test('2353: mealsModel giver dagens navne uden dagskvitteringer', () => {
  const m = mealsModel([meal('Morgenmad', 400, today), meal('Laks', 700)], A, today)
  assert.deepEqual(m.todayNames, ['Morgenmad'])
  assert.equal(m.today, 1)
})

// Syntetisk klient med Supabase' kædeform for meal_logs: select, insert().select('id') og delete().eq().select('id').
function fakeClient(rows, { failInsertAt = -1 } = {}) {
  let next = 0, inserts = 0
  return { rows, from(name) {
    assert.equal(name, 'meal_logs')
    const q = { filters: [], mode: 'select', select() { return q }, eq(k, v) { q.filters.push(r => r[k] === v); return q },
      gte(k, v) { q.filters.push(r => r[k] >= v); return q }, lte(k, v) { q.filters.push(r => r[k] <= v); return q },
      order() { return q }, limit() { return q },
      insert(value) { q.mode = 'insert'; q.value = value; return q }, delete() { q.mode = 'delete'; return q },
      then(ok, bad) {
        let result
        if (q.mode === 'insert') {
          if (inserts++ === failInsertAt) result = { error: { message: 'syntetisk fejl' }, data: null }
          else { const row = { id: `30000000-0000-4000-8000-1${String(++next).padStart(11, '0')}`, ...q.value }; rows.push(row); result = { error: null, data: [{ id: row.id }] } }
        } else if (q.mode === 'delete') {
          const hit = rows.filter(r => q.filters.every(f => f(r)))
          for (const row of hit) rows.splice(rows.indexOf(row), 1)
          result = { error: null, data: hit.map(row => ({ id: row.id })) }
        } else result = { error: null, data: rows.filter(r => q.filters.every(f => f(r))) }
        return Promise.resolve(result).then(ok, bad)
      } }
    return q
  } }
}
const tick = () => act(async () => new Promise(r => setTimeout(r, 0)))
async function mount(props) {
  const doc = createDocument(), host = doc.createElement('div')
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(host)
  await act(async () => root.render(h(TodayCard, { athlete: { id: A }, today, setTab() {}, ...props })))
  await tick()
  return { host, meal: () => host.textContent.slice(host.textContent.indexOf('Mad')), async press(text) { await act(async () => { click(host, text) }); for (let i = 0; i < 6; i++) await tick() },
    async done() {
      await act(async () => root.unmount())
      if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
    } }
}
const plan = async () => ({ meals: 3, kcal: 1696, names: PLAN })
const todayRows = client => client.rows.filter(row => row.date === today)

test('2353: kostklient: kopien gemmes med plannavne, Hjem siger 3 af 3, og Fortryd fjerner hele gruppen', gate, async () => {
  const client = fakeClient(igaar())
  const m = await mount({ u5Client: client, u5ReadPlan: plan, u5UndoMs: 60000 })
  try {
    assert.match(m.meal(), /Jeg spiste som i går \(3 måltider\)/)
    await m.press('Jeg spiste som i går (3 måltider)')
    assert.deepEqual(todayRows(client).map(row => row.meal), PLAN)
    assert.equal(uplanlagteRaekker(todayRows(client), PLAN).length, 0)
    assert.match(m.host.textContent, /Alt er logget i dag/)
    assert.match(m.host.textContent, /3 måltider fra i går gemt\./)
    await m.press('Fortryd')
    assert.equal(todayRows(client).length, 0)
    assert.match(m.host.textContent, /3 måltider fra i går er fortrudt\./)
    assert.match(m.host.textContent, /Mangler i dag: mad/)
    assert.match(m.meal(), /Log mad/)
  } finally { await m.done() }
})

test('2353: kostklient med Morgenmad logget i dag får ingen dublet; knappen tæller to', gate, async () => {
  const client = fakeClient([meal('Morgenmad', 400), meal('Frokost', 650), meal('Aftensmad', 700), meal('Morgenmad', 420, today)])
  const m = await mount({ u5Client: client, u5ReadPlan: plan, u5UndoMs: 60000 })
  try {
    assert.match(m.meal(), /Jeg spiste som i går \(2 måltider\)/)
    assert.match(m.meal(), /1 af 3 logget\./)
    await m.press('Jeg spiste som i går (2 måltider)')
    assert.deepEqual(todayRows(client).map(row => row.meal).sort(), ['Aftensmad', 'Frokost', 'Morgenmad'])
    assert.match(m.host.textContent, /Alt er logget i dag/)
  } finally { await m.done() }
})

test('2353: Fortryd forsvinder efter fortrydelsesvinduet; rækkerne bliver', gate, async () => {
  const client = fakeClient(igaar())
  const m = await mount({ u5Client: client, u5ReadPlan: plan, u5UndoMs: 1 })
  try {
    await m.press('Jeg spiste som i går (3 måltider)')
    await act(async () => new Promise(r => setTimeout(r, 20)))
    assert.doesNotMatch(m.host.textContent, /Fortryd/)
    assert.equal(todayRows(client).length, 3)
  } finally { await m.done() }
})

test('2353: delvis kopi giver ingen Fortryd, men siger hvor mange der blev gemt', gate, async () => {
  const client = fakeClient(igaar(), { failInsertAt: 1 })
  const m = await mount({ u5Client: client, u5ReadPlan: plan, u5UndoMs: 60000 })
  try {
    await m.press('Jeg spiste som i går (3 måltider)')
    assert.match(m.host.textContent, /1 af 3 måltider blev gemt\. Log resten under Kost\./)
    assert.doesNotMatch(m.host.textContent, /Fortryd/)
  } finally { await m.done() }
})

test('2353: uden kostplan kopieres som før: egne navne og ingen Fortryd', gate, async () => {
  const client = fakeClient(igaar())
  const m = await mount({ u5Client: client, u5ReadPlan: async () => null })
  try {
    await m.press('Jeg spiste som i går (3 måltider)')
    assert.deepEqual(todayRows(client).map(row => row.meal), ['Havregrød', 'Kylling og ris', 'Laks'])
    assert.doesNotMatch(m.host.textContent, /Fortryd/)
  } finally { await m.done() }
})

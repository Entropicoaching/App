import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, click } from '../../onboarding/firstVisitDom.mjs'
import { mealsModel, todayItems } from './todayModel.mjs'

// Ordre 2359: Hjems "N af M logget" og "Alt er logget i dag" tæller kun planmåltider for en kostklient.
// Fri mad (andet navn, "Fri: ...") vises som "+ N fri" og lukker aldrig Mad. Uden plan som før.
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
const A = '30000000-0000-4000-8000-000000002359'
const today = '2026-11-25', yesterday = '2026-11-24'
const PLAN = ['Morgenmad', 'Frokost', 'Aftensmad']
const meal = (name, kcal, date = yesterday) => ({ athlete_id: A, date, meal: name, kcal, protein: 20, carb: 40, fat: 10 })
const igaar = () => [meal('Havregrød', 400), meal('Kylling og ris', 650), meal('Laks', 700)]

const rowsToday = (...names) => names.map(name => meal(name, 300, today))

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

test('2359: et planmåltid og et frit måltid giver 1 af 3 + 1 fri, og Mad står åben', gate, async () => {
  const client = fakeClient(rowsToday('Morgenmad', 'Pizza hos venner'))
  const m = await mount({ u5Client: client, u5ReadPlan: plan })
  try {
    assert.match(m.host.textContent, /Mangler i dag: mad/)
    assert.match(m.meal(), /1 af 3 logget/)
    assert.match(m.meal(), /\+ 1 fri/)
    assert.doesNotMatch(m.host.textContent, /Alt er logget i dag/)
  } finally { await m.done() }
})

test('2359: tre frie måltider lukker ikke Mad for en kostklient', gate, async () => {
  const client = fakeClient(rowsToday('Fri: snack', 'Pizza', 'Burger'))
  const m = await mount({ u5Client: client, u5ReadPlan: plan })
  try {
    assert.doesNotMatch(m.host.textContent, /Alt er logget i dag/)
    assert.match(m.host.textContent, /Mangler i dag: mad/)
    assert.match(m.meal(), /\+ 3 fri/)
  } finally { await m.done() }
})

test('2359: alle planmåltider logget lukker Mad, og fri mad vises som + 1 fri', gate, async () => {
  const client = fakeClient(rowsToday(' morgenmad', 'Frokost', 'Aftensmad', 'Kage'))
  const m = await mount({ u5Client: client, u5ReadPlan: plan })
  try {
    assert.match(m.host.textContent, /Alt er logget i dag/)
    assert.match(m.host.textContent, /\+ 1 fri/)
  } finally { await m.done() }
})

test('2359: kopi fra i går tæller som planmåltider, Fortryd tæller dem af igen', gate, async () => {
  const client = fakeClient([meal('Havregrød', 400), meal('Laks', 700), meal('Pizza', 500, today)])
  const m = await mount({ u5Client: client, u5ReadPlan: plan, u5UndoMs: 60000 })
  try {
    await m.press('Jeg spiste som i går (2 måltider)')
    assert.match(m.host.textContent, /Mangler i dag: mad/)
    assert.match(m.meal(), /2 af 3 logget\. \+ 1 fri/)
    await m.press('Fortryd')
    assert.match(m.meal(), /2 måltider fra i går er fortrudt/)
  } finally { await m.done() }
})

test('2359: vagtprøve uden kostplan: alle rækker tæller som før', gate, async () => {
  const client = fakeClient(rowsToday('Pizza'))
  const m = await mount({ u5Client: client, u5ReadPlan: async () => null })
  try {
    assert.match(m.host.textContent, /Alt er logget i dag/)
    assert.doesNotMatch(m.host.textContent, /fri/)
  } finally { await m.done() }
})

test('2359: todayItems uden planlagte navne bruger meal.today som før', () => {
  assert.equal(todayItems({ meal: { status: 'ready', today: 1, planned: null } }).headline, 'Alt er logget i dag')
  assert.equal(todayItems({ meal: { status: 'ready', today: 1, planned: 3 } }).headline, 'Alt er logget i dag'.replace('Alt er logget i dag', 'Mangler i dag: mad'))
})

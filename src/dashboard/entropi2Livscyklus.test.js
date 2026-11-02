// Entropi 2-kobling runde 7: kalenderlæsningen startes og fornys for coachskærmens visninger
// (list og inbox), også ved direkte åbning af indbakken og ved dansk dagsskifte.
// Faktisk useDashboardEffekter; React-effekterne og browserens timere er syntetiske.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './coachFourWeeksLoader.mjs'
install()
const { useDashboardEffekter } = await import('./useDashboardEffekter.js')
const fake = await import('./coachFourWeeksFake.mjs')
// Kaldes som almindelig funktion med syntetiske effekter, ikke som React-hook.
const runEffects = useDashboardEffekter

const athletes = [{ id: 'syn-a' }, { id: 'syn-b' }]
function render(props) {
  fake.effects.length = 0
  const calls = { calendar: [], progress: [], refresh: 0 }
  runEffects({ activeTab: 'hub', athletes, selectedAthlete: null, loading: false, loadError: false,
    fetchCalendarWeeks: ids => calls.calendar.push(ids), fetchCalendarProgress: ids => calls.progress.push(ids),
    refreshCoachInbox: () => { calls.refresh++ }, ...props })
  const find = text => fake.effects.find(e => e.fn.toString().includes(text))
  return { calls, calendar: find('fetchCalendarWeeks(ids)'), refresh: find('refreshCoachInbox()') }
}
// Syntetisk vindue og dokument: timere og lyttere registreres, intet køres af sig selv.
function browser() {
  const timers = []
  const old = { window: globalThis.window, document: globalThis.document }
  globalThis.window = { addEventListener() {}, removeEventListener() {},
    setInterval: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length - 1 },
    clearInterval: id => { if (timers[id]) timers[id].cleared = true } }
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  return { timers, restore() { globalThis.window = old.window; globalThis.document = old.document } }
}

test('R7: med flaget tændt starter direkte åbning af indbakken kalender- og fremdriftslæsningen', () => {
  const on = render({ view: 'inbox', entropi2: true })
  on.calendar.fn()
  assert.deepEqual(on.calls.calendar, [['syn-a', 'syn-b']])
  assert.deepEqual(on.calls.progress, [['syn-a', 'syn-b']])
  // Visningen indgår i effektens afhængigheder, så skift mellem list og inbox starter en ny læsning.
  assert.ok(on.calendar.deps.includes('inbox'))
  for (const view of ['list', 'calendar']) {
    const r = render({ view, entropi2: true }); r.calendar.fn()
    assert.equal(r.calls.calendar.length, 1, view)
  }
})

test('R7: med flaget slukket er kalendereffekten uændret: ingen læsning i indbakken', () => {
  for (const entropi2 of [undefined, false, 'true', 1]) {
    const off = render({ view: 'inbox', entropi2 })
    off.calendar.fn()
    assert.deepEqual(off.calls.calendar, [], String(entropi2))
  }
  const list = render({ view: 'list' }); list.calendar.fn()
  assert.equal(list.calls.calendar.length, 1)
  const empty = render({ view: 'inbox', entropi2: true, athletes: [] }); empty.calendar.fn()
  assert.deepEqual(empty.calls.calendar, [])
})

test('R7: ved dansk dagsskifte fornyer coachskærmen sine læsninger straks; OFF har ingen dagstimer', () => {
  const b = browser()
  try {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T22:58:00Z') })
    const on = render({ view: 'inbox', entropi2: true })
    const cleanup = on.refresh.fn()
    assert.equal(on.calls.refresh, 1)
    const day = b.timers.find(t => t.ms === 60 * 1000)
    assert.ok(day, 'dagstimeren findes')
    day.fn()
    assert.equal(on.calls.refresh, 1, 'samme dag: ingen ekstra opdatering')
    mock.timers.setTime(Date.parse('2026-11-02T23:00:30Z'))
    day.fn()
    assert.equal(on.calls.refresh, 2, 'efter midnat i København: ny opdatering')
    day.fn()
    assert.equal(on.calls.refresh, 2, 'kun én gang pr. dagsskifte')
    cleanup()
    assert.ok(b.timers.every(t => t.cleared))
    mock.timers.reset()
    b.timers.length = 0
    const off = render({ view: 'inbox' })
    off.refresh.fn()()
    assert.deepEqual(b.timers.map(t => t.ms), [5 * 60 * 1000])
  } finally { mock.timers.reset(); b.restore() }
})

test('R7: Dashboard giver kun hooken flaget, når entropi2 er tændt', () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(source, /view, weeksLogsLoadedForRef, \.\.\.\(e2 \? \{ entropi2: true \} : \{\}\),\n {2}\}\)/)
})

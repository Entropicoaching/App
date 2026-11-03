// Entropi 2-kobling runde 9: dagsuret og kostens dato efter dansk midnat uden genindlæsning.
// Faktisk dayClock.mjs og appens calendarDay med falsk ur; AthleteViews præcise dagseffekt evalueres
// fra kilden med syntetiske settere.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { startDayClock } from './dayClock.mjs'
import { calendarDay } from '../calendarDate.js'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const timers = () => {
  const list = []
  return { list, setInterval: (fn, ms) => { list.push({ fn, ms, cleared: false }); return list.length - 1 },
    clearInterval: id => { list[id].cleared = true } }
}

test('R9: dagsuret melder præcis én gang ved dansk dagsskifte og ryddes', () => {
  const t = timers(), days = []
  try {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T22:58:00Z') })
    const stop = startDayClock({ today: () => calendarDay(), onDay: d => days.push(d), timers: t })
    assert.equal(t.list[0].ms, 60 * 1000)
    t.list[0].fn(); assert.deepEqual(days, [])
    mock.timers.setTime(Date.parse('2026-11-02T23:00:30Z'))
    t.list[0].fn(); t.list[0].fn()
    assert.deepEqual(days, ['2026-11-03'])
    stop(); assert.equal(t.list[0].cleared, true)
  } finally { mock.timers.reset() }
  assert.equal(startDayClock({ today: undefined, onDay: () => {}, timers: t }), undefined)
})

// AthleteViews dagseffekt, læst præcist fra kilden.
const athleteView = read('../AthleteView.jsx')
const body = athleteView.match(/ {2}useEffect\(\(\) => \{\n {4}const forrige = e2ForrigeDag\.current\n([\s\S]*?)\n {2}\}, \[e2, e2Dag\.day\]\)/)
function runDayEffect({ e2, forrige, dag, kostDate, conversation }) {
  const ref = { current: forrige }, state = { kostDate }
  const setKostDate = update => { state.kostDate = typeof update === 'function' ? update(state.kostDate) : update }
  new Function('e2', 'e2Dag', 'e2ForrigeDag', 'setKostDate', 'e2ConversationRef',
    'const forrige = e2ForrigeDag.current\n' + body[1])(e2, { day: dag }, ref, setKostDate, { current: conversation })
  return { ...state, ref: ref.current }
}

test('R9 F1: kostens dato følger dagsskiftet, når den stod på dagen før; samtalen hentes igen', () => {
  assert.ok(body, 'dagseffekten findes i AthleteView')
  let refreshed = 0
  const conversation = { refresh: async () => { refreshed++ } }
  // Reproduktion: kostDate blev sat ved mount og står på gårsdagen efter midnat.
  const r = runDayEffect({ e2: true, forrige: '2026-11-02', dag: '2026-11-03', kostDate: '2026-11-02', conversation })
  assert.equal(r.kostDate, '2026-11-03'); assert.equal(r.ref, '2026-11-03'); assert.equal(refreshed, 1)
  // En bevidst valgt anden dato flyttes ikke.
  assert.equal(runDayEffect({ e2: true, forrige: '2026-11-02', dag: '2026-11-03', kostDate: '2026-10-30', conversation }).kostDate, '2026-10-30')
  // Samme dag og flaget slukket: intet ændres.
  assert.equal(runDayEffect({ e2: true, forrige: '2026-11-03', dag: '2026-11-03', kostDate: '2026-11-02', conversation }).kostDate, '2026-11-02')
  assert.equal(runDayEffect({ e2: false, forrige: '2026-11-02', dag: '2026-11-03', kostDate: '2026-11-02', conversation }).kostDate, '2026-11-02')
  // Samtalen hentes igen ved hvert dagsskifte (også ved en anden valgt kostdato), aldrig samme dag eller slukket.
  assert.equal(refreshed, 2)
  // Uden monteret samtale går effekten ikke i stykker.
  assert.equal(runDayEffect({ e2: true, forrige: '2026-11-02', dag: '2026-11-03', kostDate: '2026-11-02', conversation: null }).kostDate, '2026-11-03')
})

test('R9 F1: kostskærmen monteres igen med den nye dato, og vægten kan kun logges på dagens dato', () => {
  assert.match(athleteView, /const e2Dag = useEntropi2Dag\(\{ enabled: e2, today \}\) \?\? \{\}/)
  assert.match(athleteView, /<Entropi2Kost enabled=\{true\} athlete=\{athlete\} date=\{kostDate\}/)
  assert.match(athleteView, /\.\.\.\(kostDate === e2Dag\.day \|\| kostDate === e2Day \? \{ onWeightInput: setWeightInput, logWeight, currentDay: today, onDayChanged: e2Dag\.refresh \} : \{\}\)/)
  assert.match(read('./Entropi2Kost.mjs'), /\}, \[enabled, athlete\?\.id, athlete\?\.kcal_target, athlete\?\.protein_target, date, client, foods\]\)/)
})

test('R9: coachsiden har samme dagsur; kostmål og coachens samtale følger dagsskiftet', () => {
  const dash = read('../Dashboard.jsx')
  assert.match(dash, /const e2Dag = useEntropi2Dag\(\{ enabled: e2, today: calendarDay \}\) \?\? \{\}/)
  assert.match(dash, /useEffect\(\(\) => \{ if \(e2\) void e2CoachSamtaleRef\.current\?\.refresh\?\.\(\) \}, \[e2, e2Dag\.day\]\)/)
  assert.match(dash, /<ConversationEntry enabled=\{true\} role="coach" controllerRef=\{e2CoachSamtaleRef\}/)
  assert.match(dash, /today=\{calendarDay\(\)\}/)
})

// Runde 10: dagsurets hook med en afhængighedsstyret hookfixture (som React: effekten køres igen kun ved
// ændrede afhængigheder; setState gengiver igen).
async function dayHook() {
  const source = read('./dayClock.mjs').replace(/^import[^\n]+\n/m, '')
  const mod = await import('data:text/javascript;base64,' + Buffer.from(
    'export function fixture(useEffect, useMemo, useState) {\n' + source.replaceAll('export function', 'function') +
    '\nreturn { useEntropi2Dag, startDayClock }\n}').toString('base64'))
  let states = [], effects = [], memos = [], si = 0, ei = 0, mi = 0, dirty = false, intervals = []
  const useState = init => { const i = si++; if (!(i in states)) states[i] = typeof init === 'function' ? init() : init
    return [states[i], v => { if (!Object.is(states[i], v)) { states[i] = v; dirty = true } }] }
  const changed = (prev, deps) => !prev || deps.length !== prev.length || deps.some((d, j) => !Object.is(d, prev[j]))
  const useEffect = (fn, deps) => { const i = ei++, prev = effects[i]
    if (changed(prev?.deps, deps)) { prev?.cleanup?.(); effects[i] = { deps, cleanup: undefined, run: fn } } else effects[i].run = null }
  const useMemo = (fn, deps) => { const i = mi++, prev = memos[i]; if (changed(prev?.deps, deps)) memos[i] = { deps, value: fn() }; return memos[i].value }
  const saved = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval }
  globalThis.setInterval = (fn, ms) => { intervals.push({ fn, ms, cleared: false }); return intervals.length - 1 }
  globalThis.clearInterval = id => { if (intervals[id]) intervals[id].cleared = true }
  const dagHook = mod.fixture(useEffect, useMemo, useState).useEntropi2Dag
  let out
  const render = props => {
    for (let n = 0; n < 5; n++) {
      si = ei = mi = 0; dirty = false
      out = dagHook(props)
      for (const e of effects) if (e?.run) { const fn = e.run; e.run = null; e.cleanup = fn() }
      if (!dirty) return out
    }
    return out
  }
  return { render, intervals, restore() { Object.assign(globalThis, saved) } }
}

test('R10 F3: aktiveres uret efter et dagsskifte, følger state straks dagen, og intervallet melder derefter normalt', async () => {
  let day = '2026-11-02'
  const today = () => day
  const h = await dayHook()
  try {
    assert.equal(h.render({ enabled: false, today }).day, '2026-11-02')
    assert.equal(h.intervals.length, 0)
    day = '2026-11-03'
    assert.equal(h.render({ enabled: true, today }).day, '2026-11-03')
    const live = h.intervals.filter(t => !t.cleared)
    assert.equal(live.length, 1)
    day = '2026-11-04'; live[0].fn()
    assert.equal(h.render({ enabled: true, today }).day, '2026-11-04')
    // Slukket: intet interval kører videre.
    h.render({ enabled: false, today })
    assert.equal(h.intervals.filter(t => !t.cleared).length, 0)
  } finally { h.restore() }
})

test('R10 F1: kosten følger i dag efter midnat, også før uret har flyttet den viste dato', () => {
  const view = read('../AthleteView.jsx')
  const m = view.match(/\{\.\.\.\((kostDate === e2Dag\.day \|\| kostDate === e2Day) \? \{ onWeightInput: setWeightInput, logWeight, currentDay: today, onDayChanged: e2Dag\.refresh \} : \{\}\)\} \/>/)
  assert.ok(m, 'kostens følg-i-dag-betingelse')
  const follows = new Function('kostDate', 'e2Dag', 'e2Day', 'return ' + m[1])
  // Gengivelse efter midnat før minut-ticket: skærmen står stadig på uret dag; gemning skal bruge today().
  assert.equal(follows('2026-11-02', { day: '2026-11-02' }, '2026-11-03'), true)
  // Almindelig dag og efter ticket.
  assert.equal(follows('2026-11-03', { day: '2026-11-03' }, '2026-11-03'), true)
  // En bevidst historisk dato følger ikke i dag.
  assert.equal(follows('2026-10-30', { day: '2026-11-03' }, '2026-11-03'), false)
})

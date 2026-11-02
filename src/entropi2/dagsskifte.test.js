// Entropi 2-kobling runde 9: dagsuret og kostens dato efter dansk midnat uden genindlæsning.
// Faktisk dayClock.mjs og appens calendarDay med falsk ur; AthleteViews præcise dagseffekt evalueres
// fra kilden med syntetiske settere.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
  assert.match(athleteView, /const e2Dag = useEntropi2Dag\(\{ enabled: e2, today \}\)/)
  assert.match(athleteView, /<Entropi2Kost enabled=\{true\} athlete=\{athlete\} date=\{kostDate\}/)
  assert.match(athleteView, /\.\.\.\(kostDate === e2Day \? \{ onWeightInput: setWeightInput, logWeight \} : \{\}\)/)
  assert.match(read('./Entropi2Kost.mjs'), /\}, \[enabled, athlete\?\.id, athlete\?\.kcal_target, athlete\?\.protein_target, date, client, foods\]\)/)
})

test('R9: coachsiden har samme dagsur; kostmål og coachens samtale følger dagsskiftet', () => {
  const dash = read('../Dashboard.jsx')
  assert.match(dash, /const e2Dag = useEntropi2Dag\(\{ enabled: e2, today: calendarDay \}\)/)
  assert.match(dash, /useEffect\(\(\) => \{ if \(e2\) void e2CoachSamtaleRef\.current\?\.refresh\?\.\(\) \}, \[e2, e2Dag\.day\]\)/)
  assert.match(dash, /<ConversationEntry enabled=\{true\} role="coach" controllerRef=\{e2CoachSamtaleRef\}/)
  assert.match(dash, /today=\{calendarDay\(\)\}/)
})

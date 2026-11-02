// Entropi 2-kobling runde 8: flagskift ON til OFF og OFF til ON på samme monterede Dashboard.
// Faktisk useDashboardEffekter med en afhængighedsstyret effektplanlægger (som React: en effekt
// køres igen, og den forrige ryddes op, kun når en afhængighed ændrer sig) og syntetiske timere.
// Desuden faktisk lavLaesninger og createSingleFlightRunner for opdateringens single-flight.
import './testLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { state } from './synthetic.mjs'
import { entropi2CalendarRead, entropi2ReadGate } from '../entropi2/coachReadContext.mjs'
// testLoader stubber læserens hjælpere fra coachInboxState; her bruges de faktiske.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../coachInboxState.js' && context.parentURL?.endsWith('/laesninger.js'))
    return { url: new URL('../coachInboxState.js', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { lavLaesninger } = await import('./laesninger.js')
const { createSingleFlightRunner } = await import('../coachInboxState.js')

// Hooken indlæses som kildetekst med en injiceret useEffect (samme greb som effectFixture.mjs).
const hookSource = readFileSync(new URL('./useDashboardEffekter.js', import.meta.url), 'utf8')
  .replace(/^import[^\r\n]+/gm, '').replace('export function useDashboardEffekter', 'function useDashboardEffekter')
const hookModule = await import('data:text/javascript;base64,' + Buffer.from(
  'export function fixture(useEffect, supabase) {\n' + hookSource + '\nreturn useDashboardEffekter\n}').toString('base64'))

function mounted() {
  let installed = [], index = 0
  const runEffects = hookModule.fixture((fn, deps) => {
    const i = index++, prev = installed[i]
    if (!prev || !deps || deps.length !== prev.deps.length || deps.some((d, j) => !Object.is(d, prev.deps[j]))) {
      prev?.cleanup?.()
      installed[i] = { deps, cleanup: fn() }
    }
  }, { from() { throw Error('Uventet databasekald') } })
  return { render(props) { index = 0; runEffects(props) }, unmount() { installed.forEach(e => e?.cleanup?.()); installed = [] } }
}
function browser() {
  const timers = [], listeners = []
  const old = { window: globalThis.window, document: globalThis.document }
  globalThis.window = { addEventListener: (type, fn) => listeners.push({ type, fn, removed: false }),
    removeEventListener: (type, fn) => { const l = listeners.find(x => x.fn === fn && !x.removed); if (l) l.removed = true },
    setInterval: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length - 1 },
    clearInterval: id => { if (timers[id]) timers[id].cleared = true } }
  globalThis.document = { visibilityState: 'visible', addEventListener: (type, fn) => listeners.push({ type, fn, removed: false }),
    removeEventListener: (type, fn) => { const l = listeners.find(x => x.fn === fn && !x.removed); if (l) l.removed = true } }
  return { timers, listeners, live: () => timers.filter(t => !t.cleared), restore() { globalThis.window = old.window; globalThis.document = old.document } }
}
const athletes = [{ id: 'syn-a' }]
const props = (flag, log) => ({ view: 'inbox', athletes, loading: false, loadError: false, activeTab: 'hub', selectedAthlete: null,
  ...(flag ? { entropi2: true } : {}),
  snoozeMigratedRef: { current: true }, weeksLogsLoadedForRef: { current: null }, videoReviewOpenedRef: { current: null },
  fetchAthletes: () => {}, fetchExerciseLibrary: () => {}, fetchLastBackup: () => {},
  fetchCalendarWeeks: ids => log.push([flag ? 'on' : 'off', 'calendar', ids]),
  fetchCalendarProgress: ids => log.push([flag ? 'on' : 'off', 'progress', ids]),
  refreshCoachInbox: () => log.push([flag ? 'on' : 'off', 'refresh']) })

test('R8: OFF til ON på samme instans starter kalenderen, opdateringen og dagstimeren med ON-læseren', () => {
  const b = browser(), log = [], d = mounted()
  try {
    d.render(props(false, log))
    assert.deepEqual(log, [['off', 'refresh']])
    assert.deepEqual(b.live().map(t => t.ms), [5 * 60 * 1000])
    // Almindelig ny gengivelse uden flagskift: intet startes igen.
    d.render(props(false, log))
    assert.equal(log.length, 1)
    d.render(props(true, log))
    assert.deepEqual(log.slice(1), [['on', 'calendar', ['syn-a']], ['on', 'progress', ['syn-a']], ['on', 'refresh']])
    // Kun ON-tilstandens timere lever; det femminutters callback kalder ON-læseren.
    assert.deepEqual(b.live().map(t => t.ms).sort((x, y) => x - y), [60 * 1000, 5 * 60 * 1000])
    b.live().find(t => t.ms === 5 * 60 * 1000).fn()
    assert.deepEqual(log.at(-1), ['on', 'refresh'])
    assert.equal(b.listeners.filter(l => !l.removed).length, 2)
  } finally { d.unmount(); b.restore() }
})

test('R8: ON til OFF på samme instans rydder dagstimeren og bruger OFF-læseren; ingen ekstra kalenderlæsning', () => {
  const b = browser(), log = [], d = mounted()
  try {
    d.render(props(true, log))
    d.render(props(true, log))
    assert.equal(log.filter(x => x[1] === 'refresh').length, 1)
    log.length = 0
    d.render(props(false, log))
    // Kalendereffekten køres igen, men med OFF-betingelserne læses kalenderen ikke i inbox.
    assert.deepEqual(log, [['off', 'refresh']])
    assert.deepEqual(b.live().map(t => t.ms), [5 * 60 * 1000])
    b.live()[0].fn()
    assert.deepEqual(log.at(-1), ['off', 'refresh'])
    d.unmount()
    assert.equal(b.live().length, 0)
    assert.equal(b.listeners.filter(l => !l.removed).length, 0)
  } finally { d.unmount(); b.restore() }
})

test('R8: en igangværende OFF-opdatering opsluger ikke den første ON-opdatering efter flagskiftet', async () => {
  state.calls.length = 0; state.responses.length = 0
  const noop = () => {}
  const setters = Object.fromEntries(['setTodayData', 'setVideoReviewQueue', 'setVideoReviewQueueError', 'setTrainingSignals',
    'setTrainingSignalsError', 'setAutomationAlerts', 'setAutomationAlertsError', 'setCoachBriefingSeen', 'setUnreadCounts',
    'setUnreadByTrack', 'setLatestByTrack', 'setPendingByTrack', 'setMessageInboxError', 'setInboxRefreshStatus', 'setInboxRefreshing',
    'setAthleteCurrentWeek', 'setAthleteWeekCompletion', 'setAthleteLastLogs', 'setWeeklyActivity', 'setCalendarWeeks',
    'setCoachMorningData'].map(name => [name, noop]))
  let status = {}
  const base = { ...setters, session: { user: { id: 'syn-coach' } }, coachActions: true, coachMorning: true,
    videoCoachAthletesRef: { current: athletes }, setCoachActionsStatus: fn => { status = fn(status) } }
  // Som Dashboard: OFF bruger den almindelige runner; ON sin egen.
  const offRunner = { current: createSingleFlightRunner() }, onRunner = { current: createSingleFlightRunner() }
  let release
  state.responses.push(new Promise(resolve => { release = () => resolve({ data: [] }) }))
  for (let i = 0; i < 40; i++) state.responses.push({ data: [] })
  const off = lavLaesninger({ ...base, inboxRefreshRunnerRef: offRunner }).refreshCoachInbox()
  const on = lavLaesninger({ ...base, entropi2CalendarRead, entropi2ReadGate, inboxRefreshRunnerRef: onRunner }).refreshCoachInbox()
  await on
  assert.ok(state.calls.some(call => call.table === 'weeks'), 'ON-opdateringen læste kalenderen trods den igangværende OFF')
  assert.equal(status.calendar, 'ready')
  // Med samme runner ville ON-kaldet have returneret OFF-kaldets løfte (reproduktion af hullet).
  const shared = createSingleFlightRunner()
  let ran = 0
  const first = shared(() => new Promise(resolve => setTimeout(resolve, 0)))
  const second = shared(async () => { ran++ })
  assert.equal(second, first); await second; assert.equal(ran, 0)
  release(); await off
})

test('R8: Dashboard giver ON-læseren sin egen single-flight; hooken har flaget i begge effekters afhængigheder', () => {
  const dash = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(dash, /const e2InboxRefreshRunnerRef = useRef\(createSingleFlightRunner\(\)\)/)
  assert.match(dash, /\.\.\.\(e2 \? \{ entropi2CalendarRead, entropi2ReadGate, inboxRefreshRunnerRef: e2InboxRefreshRunnerRef \} : \{\}\),/)
  const hook = hookSource.replace(/\r\n/g, '\n')
  assert.match(hook, /\}, \[view, calendarAthletes, e2Effects\]\)/)
  assert.match(hook, /\}, \[view, loading, loadError, e2Effects\]\)/)
})

// Runde 8 (rest): læsninger fra før et flagskift kasseres i begge tilstande (flaggeneration).
function dashboardReaders() {
  // Stabile settere som Dashboardets useState-settere; læseren bygges på ny ved hver gengivelse.
  const captured = { status: {}, calendar: undefined, athletes: undefined, loadError: undefined }
  const stable = {
    setCalendarWeeks: value => { captured.calendar = value },
    setCoachActionsStatus: fn => { captured.status = fn(captured.status) },
    setAthletes: value => { captured.athletes = value }, setLoadError: value => { captured.loadError = value },
    setLoading: () => {}, setHiddenAthleteIds: () => {}, setSnoozedAthletes: () => {},
    setAthleteCurrentWeek: () => {}, setAthleteWeekCompletion: () => {},
  }
  const build = on => lavLaesninger({ ...stable, session: { user: { id: 'syn-coach' } }, coachActions: true,
    ...(on ? { entropi2CalendarRead, entropi2ReadGate } : {}) })
  return { captured, build }
}
const weekRow = id => ({ id, athlete_id: 'syn-a', week_number: 1, start_date: '2026-10-29', sessions: [] })

test('R8: en OFF-kalenderlæsning fra før skiftet til ON overskriver hverken kalender, status eller kontekst', async () => {
  for (const lateOff of [{ data: [weekRow('syn-off')] }, { data: null, error: { message: 'syntetisk' } }, Error('syntetisk kast')]) {
    state.calls.length = 0; state.responses.length = 0
    const { captured, build } = dashboardReaders()
    let release
    state.responses.push(new Promise((resolve, reject) => { release = () => lateOff instanceof Error ? reject(lateOff) : resolve(lateOff) }),
      { data: [weekRow('syn-on')] })
    const off = build(false).fetchCalendarWeeks(['syn-a'])
    const on = build(true).fetchCalendarWeeks(['syn-a'])
    await on
    const weeks = captured.calendar
    assert.equal(weeks['syn-a'][0].id, 'syn-on')
    release(); await off.catch(() => {})
    assert.equal(captured.calendar, weeks)
    assert.equal(captured.status.calendar, 'ready')
    assert.equal(captured.status.e2Calendar.pending, 0)
    assert.equal(captured.status.e2Calendar.weeks, weeks)
  }
})

test('R8: en ON-læsning fra før skiftet til OFF og en OFF-atletlæsning kasseres også; uden flagskift er OFF uændret', async () => {
  state.calls.length = 0; state.responses.length = 0
  let r = dashboardReaders()
  let release
  state.responses.push(new Promise(resolve => { release = () => resolve({ data: [weekRow('syn-gammel-on')] }) }), { data: [weekRow('syn-off')] })
  const onRead = r.build(true).fetchCalendarWeeks(['syn-a'])
  await r.build(false).fetchCalendarWeeks(['syn-a'])
  release(); await onRead
  assert.equal(r.captured.calendar['syn-a'][0].id, 'syn-off')
  // Atletlæsning fra før skiftet til ON.
  state.calls.length = 0; state.responses.length = 0
  r = dashboardReaders()
  state.responses.push(new Promise(resolve => { release = () => resolve({ data: [{ id: 'syn-gammel' }] }) }), { data: [] })
  const oldAthletes = r.build(false).fetchAthletes()
  await r.build(true).fetchAthletes()
  release(); await oldAthletes
  assert.deepEqual(r.captured.athletes, [])
  // Uden flagskift (flaget altid slukket) vinder det sene svar som i den uændrede læser.
  state.calls.length = 0; state.responses.length = 0
  r = dashboardReaders()
  state.responses.push(new Promise(resolve => { release = () => resolve({ data: [weekRow('syn-sen')] }) }), { data: [weekRow('syn-tidlig')] })
  const late = r.build(false).fetchCalendarWeeks(['syn-a'])
  await r.build(false).fetchCalendarWeeks(['syn-a'])
  release(); await late
  assert.equal(r.captured.calendar['syn-a'][0].id, 'syn-sen')
})

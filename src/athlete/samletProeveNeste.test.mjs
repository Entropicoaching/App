// E2-SAMLET-PROEVE3, base 7aef5dfe. App npm test discovers this file.
// React dependencies are mandatory: no conditional skips or synthetic React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { dispose, importedModules, renderScenario, scenario } from './samletProeveFixture.mjs'
import { elements, markupTree, nodeText } from './samletProeveMarkup.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { quickSetFixture } from '../entropi2/session/sessionQuickSetFixture.mjs'
import { sessionReactDocument } from '../entropi2/session/sessionQuickSetReactDom.mjs'
import SessionScreen from '../entropi2/session/SessionScreen.mjs'
import AthleteHome, { HomeRecordCard } from '../entropi2/home/AthleteHome.mjs'
import HomeCheckIn from '../entropi2/home/HomeCheckIn.mjs'
import { homeRecord } from '../entropi2/home/homeRecord.mjs'
import Analysis from '../entropi2/analysis/Analysis.mjs'
import CoachKostMaal from '../entropi2/kostMaalKobling.mjs'
import { mountKost } from '../entropi2/Entropi2Kost.mjs'
import { syntheticHost, find, flush } from '../entropi2/nutrition/synthetic-dom.mjs'

// The existing fixture only transforms JSX and seeds host state, blocks services,
// freezes time, and resolves the host's real lazy factories. No leaves are faked.
const { default: Program } = await import('./ProgramTab.jsx')
const { lavNavigation } = await import('../dashboard/navigation.js')
const { HUB_SECTIONS } = await import('../dashboard/hubSektioner.jsx')
test.after(dispose)
const now = new Date('2026-11-04T12:00:00Z')
const render = (Component, props) => renderToStaticMarkup(h(Component, props))
const text = html => nodeText(markupTree(html))
const closed = node => assert.doesNotMatch(node.attributes, /\sopen(?:[\s=>])/)
const fold = (html, title) => {
  const result = elements(markupTree(html)).filter(node => node.tag === 'details' &&
    node.children.some(child => child.tag === 'summary' && nodeText(child) === title))
  assert.equal(result.length, 1, `Exactly one fold: ${title}`)
  closed(result[0]); return result[0]
}
const memory = () => {
  const data = new Map(), writes = []
  return { writes, getItem: key => data.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); data.set(key, String(value)) },
    removeItem(key) { writes.push([key, null]); data.delete(key) } }
}

for (const mode of ['athlete', 'own']) {
  test(`samlet næste: ${mode} sees first name, Start, weekly count and quick logs on actual Home`, async () => {
    const html = await renderScenario(scenario(mode, 'hjem'))
    const tree = markupTree(html), nodes = elements(tree)
    const greeting = nodes.find(node => node.tag === 'h1')
    assert.equal(nodeText(greeting), 'Klar til dit pas, Testfornavn?')
    assert.doesNotMatch(nodeText(greeting), /Testefternavn/)
    const start = nodes.filter(node => node.tag === 'button' && /^Start (dagens|næste) pas$/.test(nodeText(node)))
    assert.equal(start.length, 1)
    assert.doesNotMatch(start[0].attributes, /\sdisabled(?:[\s=>])/)
    const sessionCard = nodes.find(node => node.tag === 'section' && /aria-label="Dit næste pas"/.test(node.attributes))
    assert.ok(sessionCard)
    const cardNodes = elements(sessionCard)
    assert.equal(cardNodes.find(node => node.tag === 'button'), start[0])
    assert.ok(nodes.indexOf(greeting) < nodes.indexOf(start[0]))
    assert.ok(cardNodes.indexOf(start[0]) < cardNodes.findIndex(node => node.tag === 'ul'))
    assert.ok(html.indexOf(start[0].attributes) < html.indexOf('data-home-quick-logs'))
    const counts = nodes.filter(node => /\bdata-week-sessions=/.test(node.attributes ?? ''))
    assert.equal(counts.length, 1); assert.equal(nodeText(counts[0]), 'Ugen: 0 af 1 pas')
    const quick = nodes.find(node => /\bdata-home-quick-logs=/.test(node.attributes ?? ''))
    assert.ok(quick)
    assert.deepEqual(elements(quick).filter(node => node.tag === 'button').map(node =>
      nodeText(node).replace(/\s*✓$/, '')), ['Dagsform', 'Vægt i dag'])
    assert.match(html, /data-home-checkin/)
    // One of three slots is confirmed: an incomplete session cannot count as a full pass.
    const seed = scenario(mode, 'hjem').seed
    const exerciseLogs = [1, 2, 3].map(set_number => ({ ...seed.exerciseLogs[0], set_number }))
    const done = await renderScenario(scenario(mode, 'hjem', 'ready', { exerciseLogs }))
    assert.match(text(done), /Godt arbejde i dag, Testfornavn/)
    assert.match(text(done), /Ugen: 1 af 1 pas/)
  })
}

test('samlet næste: empty, failed and OFF Home cannot invent a weekly count or record', async () => {
  const empty = await renderScenario(scenario('athlete', 'hjem', 'empty'))
  assert.match(text(empty), /Intet program endnu/)
  assert.doesNotMatch(empty, /data-week-sessions|data-home-record/)
  const failure = await renderScenario(scenario('athlete', 'hjem', 'ready', { programError: true }))
  assert.match(text(failure), /Programmet kunne ikke hentes/)
  assert.doesNotMatch(failure, /data-week-sessions|data-home-record/)
  const off = scenario('athlete', 'hjem'); off.props.entropi2 = false
  for (const node of elements(markupTree(await renderScenario(off))))
    assert.doesNotMatch(node.attributes ?? '', /\bdata-entropi2-(?:athlete|home-session)=/)
  assert.equal(render(AthleteHome, { enabled: false }), '')
})

test('samlet næste: a confirmed improvement renders a dated record card; absent/error history stays silent', () => {
  const { seed } = scenario('athlete', 'hjem')
  seed.currentWeek.block_name = 'Styrke'
  const props = { ...seed, enabled: true, exerciseLogs: [1, 2, 3].map(set_number => ({
    ...seed.exerciseLogs[0], set_number, weight: 70 })) }
  const history = { status: 'ready', complete: true, athleteId: seed.athlete.id, rows: [{
    ...seed.exerciseLogs[0], exercise_id: 'synthetic-previous', weight: 60,
    logged_at: '2026-10-28T09:00:00Z',
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } },
  }] }
  const record = homeRecord(props, history, now)
  assert.deepEqual(record, { lift: 'Squat', weight: 70, reps: 3, date: '2026-11-04' })
  const html = render(HomeRecordCard, { record })
  assert.equal((text(html).match(/Ny rekord: Squat 70 kg × 3/g) ?? []).length, 1)
  assert.match(html, /<time datetime="2026-11-04"[^>]*>4\. nov\.<\/time>/i)
  for (const data of [undefined, { ...history, status: 'error' }, { ...history, rows: [] },
    { ...history, athleteId: 'synthetic-other' }]) {
    assert.equal(homeRecord(props, data, now), null)
    assert.equal(render(HomeRecordCard, { record: homeRecord(props, data, now) }), '')
  }
  assert.equal(homeRecord({ ...props, readOnly: true }, history, now), null)
  assert.equal(homeRecord({ ...props, enabled: false }, history, now), null)
})

test('samlet næste: real ReactDOM session confirms the plan, runs rest timer and compares confirmed sets at finish', async () => {
  const f = quickSetFixture(), doc = sessionReactDocument(), host = doc.createElement('div'), timers = new Set()
  f.exercise.sets = 2; f.exercise.note = 'Pause: 120 sek'
  f.p.currentWeek.sessions[0].exercises = [f.exercise]
  // Earlier prescription had later slots. Current slots 1/2 stay unconfirmed;
  // comparison counts the two actual confirmations, without inventing missing sets.
  f.p.exerciseLogs = [3, 4].map(set_number => ({ athlete_id: f.p.athleteId,
    exercise_id: f.exercise.id, set_number, weight: 75, reps_completed: 5, logged_at: '2026-11-03T10:00:00Z' }))
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  let root
  const show = () => act(async () => root.render(h(SessionScreen, { ...f.p })))
  const press = async label => {
    const button = host.querySelectorAll('button').find(node => node.textContent === label)
    assert.ok(button, label); assert.equal(button.disabled, false)
    await act(async () => button.click())
  }
  const submit = async label => {
    const button = host.querySelectorAll('button').find(node => node.textContent === label)
    assert.ok(button, label); assert.equal(button.getAttribute('type'), 'submit'); assert.equal(button.disabled, false)
    await act(async () => { button.parentElement.dispatch('submit'); await Promise.resolve() })
    await show()
  }
  try {
    root = createRoot(host); await show(); await press('Start dagens pas')
    assert.equal(f.calls.length, 0); assert.equal(timers.size, 0)
    assert.equal(host.querySelector('[data-field="weight"]').value, '80')
    assert.equal(host.querySelector('[data-field="reps"]').value, '5')
    await submit('Som planlagt')
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].input.weight, '80'); assert.equal(f.calls[0].reps, 5)
    const timer = host.querySelector('[role="timer"]')
    assert.ok(timer); assert.equal(timer.textContent, '2:00'); assert.equal(timers.size, 1)
    await press('Pause'); assert.equal(timers.size, 0)
    await press('+30 s'); assert.equal(timer.textContent, '2:30')
    await press('Fortsæt'); assert.equal(timers.size, 1)
    await press('Afslut pas')
    const comparison = () => host.querySelector('[data-session-comparison]')
    assert.ok(comparison()); assert.match(comparison().textContent, /2 sæt sidst, 1 sæt i dag/)
    assert.doesNotMatch(comparison().textContent, /Samlet volumen:.*→/)
    await press('Fortsæt passet'); await submit('Som sidste sæt')
    assert.equal(f.calls.length, 2)
    assert.match(comparison().textContent, /75 kg × 5 → 80 kg × 5/)
    assert.match(comparison().textContent, /750 kg → 800 kg/)
    f.p.exerciseLogsError = true; await show(); assert.equal(comparison(), null)
    f.p.enabled = false; await show(); assert.equal(host.querySelector('dialog'), null)
    assert.equal(timers.size, 0)
  } finally {
    try { if (root) await act(async () => root.unmount()) }
    finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
      }
    }
  }
  assert.equal(host.children.length, 0); assert.equal(timers.size, 0)
})

test('samlet næste: actual Program puts Næste pas before closed historical weeks', () => {
  const props = programQolFixture({ progOpenSession: 'session-1-0' })
  const html = render(Program, props)
  assert.match(html, /^<div[^>]*data-entropi2-program-motion=""[^>]*><button[^>]*data-program-next=""/)
  assert.match(text(html), /Næste pas · Pas 1-0/)
  const history = fold(html, 'Vis tidligere uger')
  assert.doesNotMatch(nodeText(history), /Vægt ·|Vægt, sæt/)
  assert.ok(html.indexOf('data-program-next') < html.indexOf('data-program-history'))
  assert.match(render(Program, { ...props, exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1 }] }), /Næste pas · Pas 1-1/)
  assert.doesNotMatch(render(Program, { ...props, entropi2: false }), /data-program-next|data-program-history/)
})

test('samlet næste: Din udvikling leads and Mine tal is closed only when scoped production data exists', () => {
  const seed = scenario('athlete', 'fremgang').seed
  const trackingSnapshot = { status: 'ready', complete: true, athleteId: seed.athlete.id,
    endDate: '2026-11-03', dailySource: 'readiness_logs', dailyRows: [{ athlete_id: seed.athlete.id,
      source: 'readiness_logs', logged_date: '2026-11-03', sleep_hours: 7, energy: 3, stress: 2, soreness_level: 2 }] }
  const props = { ...seed, entropi2: true, now, trackingSnapshot }
  const html = render(Analysis, props)
  assert.match(text(html), /Din udvikling/); fold(html, 'Mine tal')
  assert.ok(html.indexOf('data-development') < html.indexOf('data-fremgang-mine-tal'))
  for (const snapshot of [undefined, { ...trackingSnapshot, dailyRows: [] },
    { ...trackingSnapshot, athleteId: 'synthetic-other' }, { ...trackingSnapshot, endDate: '2026-11-02' }])
    assert.doesNotMatch(render(Analysis, { ...props, trackingSnapshot: snapshot }), /data-fremgang-mine-tal/)
  const empty = render(Analysis, { ...props, fremgangLogs: [], exerciseLogs: [], trackingSnapshot: undefined })
  assert.match(text(empty), /Din udvikling kommer frem, når du logger vægt og gentagelser/)
  assert.equal(render(Analysis, { ...props, entropi2: false }), '')
})

test('samlet næste: Kost tab reaches its actual DOM mount, showing meals, honest empty data and retry', async () => {
  assert.match(await renderScenario(scenario('athlete', 'kost')), /data-entropi2-kost/)
  const athlete = scenario('athlete', 'kost').seed.athlete
  for (const state of ['ready', 'empty', 'error']) {
    const host = syntheticHost(), storage = memory(), reads = []
    let fail = state === 'error', coached = 0
    const rows = state === 'empty' ? [] : [{ id: 'synthetic-meal', athlete_id: athlete.id, date: '2026-11-04',
      meal: 'Syntetisk ret', kcal: 400, protein: 25, carb: 40, fat: 10 }]
    const query = { select() { return this }, eq(key, value) { reads.push([key, value]); return this },
      gte() { return this }, lte() { return this }, order: async () => ({ data: fail ? null : rows, error: fail ? { message: 'synthetic failure' } : null }) }
    const client = { from(table) { assert.equal(table, 'meal_logs'); return query } }
    const cleanup = mountKost(host, { athlete, date: '2026-11-04', client, storage },
      { current: { onCoach: () => coached++, currentDay: () => '2026-11-04' } })
    try {
      await flush()
      assert.ok(reads.length > 0)
      assert.ok(reads.every(([key, value]) => key === 'athlete_id' && value === athlete.id))
      if (fail) {
        assert.match(host.textContent, /Kostloggen kunne ikke hentes/)
        assert.doesNotMatch(host.textContent, /Ingen måltider registreret/)
        fail = false; await find(host, 'button', 'Hent igen').fire('click'); await flush()
      }
      if (state === 'empty') assert.match(host.textContent, /Ingen måltider registreret i dag/)
      else { assert.match(host.textContent, /Syntetisk ret/); assert.match(host.textContent, /400 kcal · 25 g protein/) }
      await find(host, 'button', 'Tal med din coach').fire('click'); assert.equal(coached, 1)
      assert.deepEqual(storage.writes, [])
    } finally { cleanup() }
    assert.equal(host.children.length, 0)
  }
})

test('samlet næste: one folded local check-in reminder; unavailable storage never claims a missing check-in', () => {
  const storage = memory(), props = { enabled: true, athleteId: 'synthetic-checkin', now, storage }
  const html = render(HomeCheckIn, props)
  const reminder = fold(html, 'Lyst til ugens check-in? Åbn check-in')
  assert.match(nodeText(reminder), /De deles ikke med din coach/)
  assert.equal((html.match(/data-home-reminder/g) ?? []).length, 1)
  assert.doesNotMatch(render(HomeCheckIn, { ...props, storage: null }), /data-home-reminder/)
  assert.doesNotMatch(render(HomeCheckIn, { ...props, now: new Date('2026-11-04T23:00:00Z') }), /data-home-reminder/)
  assert.equal(render(HomeCheckIn, { ...props, enabled: false }), '')
  assert.deepEqual(storage.writes, [])
})

test('samlet næste: MIN TRÆNING navigation selects coach own profile and Kost & mål renders a closed Kostplan', async () => {
  const input = scenario('own', 'hjem'), selected = []
  lavNavigation({ myAthleteId: input.seed.athlete.id, athletes: [input.seed.athlete],
    onPreviewAthlete: id => selected.push(id) }).goToMyProfile()
  assert.deepEqual(selected, [input.seed.athlete.id])
  assert.equal(input.seed.athlete.user_id, input.props.session.user.id)
  const home = await renderScenario(input)
  assert.match(home, /Til coachportalen/)
  assert.match(home, /Min træning/)
  assert.doesNotMatch(home, /Resten af din dag|aria-label="Genveje"/)
  assert.match(home, /<button[^>]*min-height:44px[^>]*>Til coachportalen<\/button>/)
  assert.match(home, /<button[^>]*font-size:14px[^>]*>Til coachportalen<\/button>/)
  assert.match(home, /height:auto/)
  assert.match(home, /min-height:52px/)
  assert.match(await renderScenario(scenario('athlete', 'hjem')), /Resten af din dag/)
  assert.match(await renderScenario(scenario('preview', 'hjem')), /Resten af din dag/)
  assert.doesNotMatch(await renderScenario(scenario('preview', 'hjem')), /Min træning/)
  assert.doesNotMatch(home, /<fieldset[^>]*disabled/)
  assert.match(home, /Start dagens pas/)
  assert.equal(HUB_SECTIONS.find(section => section.key === 'kost').label, 'Kost & mål')
  const props = { enabled: true, athlete: input.seed.athlete, session: input.props.session,
    today: '2026-11-04', weightStatus: { athleteId: input.seed.athlete.id, state: 'ready', rows: [] } }
  const html = render(CoachKostMaal, props)
  fold(html, 'Kostplan')
  assert.ok(text(html).indexOf('Kostmål') < text(html).indexOf('Kostplan'))
  assert.doesNotMatch(html, /Dagens plan og mål|Planen er aktiveret|<summary[^>]*>Kostrapport/)
  assert.equal(render(CoachKostMaal, { ...props, enabled: false }), '')
})

test('samlet næste: host and Program still import the actual presentation modules', () => {
  for (const name of ['AthleteView.jsx', 'athlete/ProgramTab.jsx', 'entropi2/home/HomeSession.mjs'])
    assert.ok([...importedModules].some(url => url.endsWith('/src/' + name)), name)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from '../../scripts/restMobilityLoader.mjs'
import { createElement as h, expand, nodes, text } from '../../scripts/restMobilityDom.mjs'
install()
const { restMobilityText } = await import('./restMobility.mjs')
const { coachNotes } = await import('./coachMobility.mjs')
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const { saveHomework } = await import('../mobilityHomework.mjs')
const { default: RestDays } = await import('./RestDays.jsx')
const { default: WeekCalendarUtenFlag } = await import('./WeekCalendar.jsx')
const WeekCalendar = p => WeekCalendarUtenFlag({ hviledageListe: true, ...p })
const { default: HjemTab } = await import('./HjemTab.jsx')
const { default: EnkelHjemTab } = await import('./EnkelHjemTab.jsx')
const { default: ProgramTab } = await import('./ProgramTab.jsx')
const { default: MobilitetFokus } = await import('./MobilitetFokus.jsx')
const enabled = { enabled: true, athleteId: 'synthetic-a', focus: { athleteId: 'synthetic-a', lift: 'Squat', need: 'Mere dybde' } }
const week = { id: 'w', week_number: 1, start_date: '2026-10-26', sessions: [{ id: 'train', weekday: 0, title: 'Squat', exercises: [{ id: 'sq', sets: 1, name: 'Squat' }] }] }
const render = (Component, props) => expand(h(Component, props))
const suggestions = tree => nodes(tree, n => Object.hasOwn(n.props, 'data-rest-mobility'))
const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) } }
const baseProps = () => ({ WEEKDAYS_LONG: ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'], allWeeks: [week], currentWeek: week, athlete: { id: 'synthetic-a' }, exerciseLogs: [], pastLogs: [], viewingWeekIdx: 0, computeActiveWeekIdx: () => 0,
 weekStartDate: () => new Date('2026-10-26T12:00:00'), fmtWeekRange: () => '', now: new Date('2026-10-29T12:00:00'), tab: 'hjem',
 days: ['Søn','Man','Tir','Ons','Tor','Fre','Lør'], months: Array(12).fill('okt'), readinessHistory: [], messages: [], sharedVideoAnalyses: [],
 weightLogs: [], weeklyTonnage: [], exerciseHistory: [], liftProgress: [], prs: [], pendingSyncKeys: [], parkedSets: [],
 setTab: () => {}, openSession: () => {}, readinessCardRef: { current: null }, logInputs: {}, mereOpen: false })

test('default OFF, non-boolean flag and missing identity never read storage', () => {
 const trap = { getItem() { throw Error('unexpected read') } }
 for (const flag of [undefined, false, 1, 'true']) assert.equal(restMobilityText({ ...enabled, enabled: flag, homeworkEnabled: true, storage: trap }), null)
 assert.equal(restMobilityText({ ...enabled, athleteId: undefined }), null)
})

test('rest without focus preserves only existing rest text and coach note', () => {
 for (const coach_note of [undefined, 'Rolig dag fra coach']) {
  const props = { week: { ...week, coach_note }, weekStart: week.start_date }
  const before = render(RestDays, props)
  const after = render(RestDays, { ...props, restMobility: { enabled: true, athleteId: 'synthetic-a' } })
  assert.deepEqual(after, before)
  assert.equal(suggestions(after).length, 0)
  assert.match(text(after), coach_note ? /Rolig dag fra coach/ : /Ingen træning planlagt/)
 }
})

test('focus gives optional five minute text only on established rest rows', () => {
 const tree = render(RestDays, { week, restMobility: enabled })
 assert.equal(suggestions(tree).length, 6)
 for (const row of nodes(tree, n => Object.hasOwn(n.props, 'data-hviledag'))) {
  assert.notEqual(row.props['data-hviledag'], 0)
  assert.match(text(row), /Hvis du har lyst.*fem minutter.*let mobilitet/)
  assert.match(text(row), /Dit fokus: mere dybde/)
  assert.match(text(row), /Hvile er også helt fint/)
 }
 assert.equal(nodes(tree, n => n.type === 'button' || n.props['aria-live']).length, 0)
})

test('MOB6 homework uses actual scoped reader and assigned catalog exercise', () => {
 const local = storage()
 assert.equal(saveHomework('synthetic-a', { problemId: 'squat-hip', exerciseIds: ['sq-mob-1'] }, local).error, null)
 const props = { ...enabled, homeworkEnabled: true, storage: local }
 assert.match(restMobilityText(props), /hoftecirkler.*Fra din coachs hjemmeøvelser på denne enhed/)
 assert.doesNotMatch(restMobilityText({ ...props, homeworkEnabled: false }), /hjemmeøvelser/)
 assert.equal(restMobilityText({ ...props, athleteId: 'synthetic-b' }), null)
 const broken = { getItem: () => '{bad' }
 assert.equal(restMobilityText({ ...props, focus: null, storage: broken }), null)
 assert.match(restMobilityText({ ...props, storage: broken }), /Dit fokus/)
})

test('validated coach focus honors existing flag, identity and corrupt-note guard', () => {
 const notes = coachNotes('synthetic-a', '', { Bænkpres: { need: 'Skulderposition', ids: ['bp-mob-2'] } }, WARMUP_BASE)
 const props = { enabled: true, athleteId: 'synthetic-a', notes, coachEnabled: true }
 assert.match(restMobilityText(props), /Din coachs fokus: skulderposition/)
 assert.equal(restMobilityText({ ...props, coachEnabled: false }), null)
 assert.equal(restMobilityText({ ...props, athleteId: 'synthetic-b' }), null)
 assert.equal(restMobilityText({ ...props, notes: notes + '\n[HARA-MOBILITY-V1]\n' }), null)
 assert.equal(restMobilityText({ ...enabled, focus: { ...enabled.focus, need: 'invented' } }), null)
})

test('training calendar cells and handlers are unchanged when enabled', () => {
 let opened
 const props = { week, exerciseLogs: [], onOpenSession: id => { opened = id } }
 const off = render(WeekCalendar, props), on = render(WeekCalendar, { ...props, restMobility: enabled })
 const training = tree => nodes(tree, n => n.props['data-dag'] === 'pas')[0]
 assert.equal(text(training(on)), text(training(off)))
 assert.deepEqual(training(on).props.style, training(off).props.style)
 assert.equal(training(on).props['aria-label'], training(off).props['aria-label'])
 training(on).props.onClick(); assert.equal(opened, 'train')
 assert.equal(suggestions(on).length, 6)
 for (const invalid of [undefined, {}, { sessions: [{ weekday: null, exercises: [] }] }, { sessions: [{ weekday: 1 }] }]) {
  assert.equal(render(RestDays, { week: invalid, restMobility: enabled }), null)
 }
 const full = { sessions: Array.from({length: 7}, (_,weekday) => ({ weekday, exercises: [{}] })) }
 assert.equal(render(RestDays, { week: full, restMobility: enabled }), null)
})

test('actual Hjem, EnkelHjem and Program layouts pass suggestion to shared rest rows', () => {
 for (const Component of [HjemTab, EnkelHjemTab, ProgramTab]) {
  const props = { ...baseProps(), hviledageListe: true }
  const off = render(Component, props)
  assert.equal(suggestions(off).length, 0)
  const on = render(Component, { ...props, restMobility: enabled })
  assert.equal(suggestions(on).length, 6, Component.name)
  assert.equal(suggestions(render(Component, { ...props, restMobility: { ...enabled, enabled: false } })).length, 0)
 }
})

test('actual focus start handler reports active user selection, never default render', () => {
 let focus
 const tree = render(MobilitetFokus, { athleteId: 'synthetic-a', library: WARMUP_BASE, onFocusSelected: value => { focus = value } })
 assert.equal(focus, undefined)
 nodes(tree, n => n.type === 'button' && text(n) === 'Start min rutine')[0].props.onClick()
 assert.deepEqual(focus, { lift: 'Squat', need: 'Mere dybde' })
})

test('top-level and lazy mobility wiring preserve opt-in and athlete scope', () => {
 const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
 assert.match(source, /hviledagMobilitet = false/)
 assert.match(source, /restFocus\?\.athleteId === athlete\?\.id/)
 assert.match(source, /restMobility=\{restMobility\}/)
 assert.match(source, /restMobility, WEEKDAYS_LONG/)
 assert.match(source, /onFocusSelected: hviledagMobilitet === true/)
 const mobility = readFileSync(new URL('./MobiliseringTab.jsx', import.meta.url), 'utf8')
 assert.match(mobility, /createElement\(MobilitetFokus, \{[^\n]*onFocusSelected/)
})


test('counterexamples: all-training week and unknown calendar cannot gain suggestions in Home', () => {
 for (const sessions of [Array.from({length:7}, (_,weekday) => ({ id: String(weekday), weekday, exercises: [{ id: 'sq', sets: 1, name: 'Squat' }] })), [{ weekday: null, exercises: [] }]]) {
  const props = baseProps(), currentWeek = { ...week, sessions }
  for (const Component of [HjemTab, EnkelHjemTab]) {
   assert.equal(suggestions(render(Component, { ...props, currentWeek, allWeeks: [currentWeek], restMobility: enabled })).length, 0)
  }
 }
})

test('counterexamples: focus is athlete scoped and enabled homework reader never writes', () => {
 assert.equal(restMobilityText({ ...enabled, athleteId: 'other' }), null)
 let reads = 0
 const local = { getItem: () => { reads++; return null }, setItem: () => assert.fail('write'), removeItem: () => assert.fail('remove') }
 assert.match(restMobilityText({ ...enabled, homeworkEnabled: true, storage: local }), /Dit fokus/)
 assert.equal(reads, 1)
})

test('closed loader blocks unrelated direct imports from an app module', async () => {
 const { createRequire } = await import('node:module')
 const require = createRequire(new URL('./RestDays.jsx', import.meta.url))
 assert.throws(() => require('./unapproved-module.mjs'), /Closed loader rejected/)
})

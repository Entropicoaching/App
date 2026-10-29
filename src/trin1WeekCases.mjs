import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mount, text, nodes, createElement, io } from './trin1Dom.mjs'
import Program from './athlete/ProgramTab.jsx'
import Mobilisering from './athlete/MobiliseringTab.jsx'
import * as helpers from './athlete/ugeHjaelp.js'
import { nextTrainingHome, renderNextTrainingHome } from './athlete/nextTrainingHome.mjs'
import { summarizeWeek } from './athlete/ugeFeedback.js'
import { coachUgeFeedback, ugeFeedbackTree, erAfsluttetUge } from './dashboard/coachUgeFeedback.js'
import { dataEnoughEnabled, withDataEnoughFlag } from './dataEnough.mjs'
import { UDGIVELSE_TRIN } from './udgivelseTrin.mjs'
import { rel1030Enabled, rel1030Mobility } from './rel1030.mjs'

const ex = { id: 'synthetic-sq', name: 'Squat', sets: 1, reps: '5', recommended_weight: 100 }
const session = { id: 'synthetic-mon', title: 'Mandagens pas', weekday: 0, exercises: [ex] }
const rest = { id: 'synthetic-sun', title: 'Søndag', weekday: 6, exercises: [] }
const week = { id: 'w1', week_number: 1, start_date: '2026-10-19', sessions: [session, rest], block_description: 'Syntetisk coachnote' }
const next = { ...week, id: 'w2', week_number: 2, start_date: '2026-10-26', sessions: [{ ...session, id: 'next-mon', exercises: [{ ...ex, id: 'next-sq' }] }] }
const log = { exercise_id: ex.id, set_number: 1, weight: 100, reps_completed: 5, rpe_actual: 8, rpe: 8 }
const NativeDate = Date
function at(instant, fn) {
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [instant])) }
    static now() { return new NativeDate(instant).getTime() }
  }
  try { return fn() } finally { globalThis.Date = NativeDate }
}
function programProps(extra = {}) {
  return { ...helpers, allWeeks: [week, next], currentWeek: week, viewingWeekIdx: 0, hviledageListe: true,
    athlete: { id: 'synthetic' }, exerciseLogs: [], pastLogs: [], readinessLog: {}, progOpenSession: null,
    sessionRefs: { current: {} }, dismissedFeedback: new Set(), feedbackInputs: {}, logInputs: {}, setConfirm: {},
    lastLogByExerciseName: {}, exerciseHistory: {}, exWarmupExpanded: {}, exWarmupWeightOverride: {}, warmupChecked: {},
    suggestNextWeight: () => null, calcWarmupSets: () => [], suggestWarmupOverride: () => null, ...extra }
}
const buttons = (tree, label) => nodes(tree, n => n.type === 'button' && text(n).trim() === label)

export function weekCases(enabled) {
  const prefix = enabled ? 'profile 1' : 'profile 0'
  const savedLocation = globalThis.location
  test.before(() => { globalThis.location = { search: '' } })
  test.after(() => {
    if (savedLocation === undefined) delete globalThis.location
    else globalThis.location = savedLocation
  })
  test(`${prefix}: effective dataEnough import, no URL or storage intervention`, async () => {
    assert.equal(UDGIVELSE_TRIN, enabled ? 1 : 0)
    assert.equal(dataEnoughEnabled(), enabled)
    assert.equal(withDataEnoughFlag('/program'), enabled ? '/program?appData2=1' : '/program')
    assert.equal(rel1030Enabled(''), false)
    const props = { mobilitetCoach: false, mobilitetHjemme: false, mobilitetHjalp: false }
    assert.strictEqual(rel1030Mobility(props, ''), props)
    const rows = JSON.parse(readFileSync(new URL('./trin1Flagoversigt.json', import.meta.url), 'utf8'))
    for (const row of rows.filter(row => row.probe)) {
      const actual = await import(new URL('../' + row.module, import.meta.url))
      assert.equal(actual[row.probe], false, row.name)
    }
  })

  test(`${prefix}: rest week keeps the documented ON/OFF difference for athlete and coach`, () => {
    const before = JSON.stringify([week, log])
    const result = summarizeWeek(week, [log])
    assert.equal(result.status, enabled ? 'fuld' : 'delvis')
    assert.equal(result.pas[1].status, 'ingen_saet_planlagt')
    assert.equal(result.rpe.gennemsnit, enabled ? null : 8)
    const coach = coachUgeFeedback(week, [log], new Date('2026-11-15T12:00:00Z'))
    assert.equal(coach.status, result.status)
    const tree = ugeFeedbackTree(createElement, coach, 1)
    assert.match(text(tree), /Søndag: Ingen planlagte sæt/)
    assert.match(text(tree), enabled ? /Fuldt gennemført/ : /Delvist gennemført/)
    assert.equal(JSON.stringify([week, log]), before)
  })

  test(`${prefix}: rest days cannot hide missing, partial, skipped or unknown work`, () => {
    assert.equal(summarizeWeek(week, []).status, 'ingen_logs')
    assert.equal(summarizeWeek(week, [{ ...log, skipped: true }]).status, 'sprunget_over')
    const partial = { ...week, sessions: [{ ...session, exercises: [{ ...ex, sets: 2 }] }, rest] }
    assert.equal(summarizeWeek(partial, [log]).status, 'delvis')
    assert.equal(summarizeWeek({ sessions: [rest] }, []).status, 'tom')
    assert.equal(summarizeWeek({ sessions: [] }, []).status, 'tom')
    assert.equal(summarizeWeek(week, [{ ...log, exercise_id: 'unrelated' }]).status, 'ingen_logs')
    assert.equal(coachUgeFeedback(week, null, new Date('2026-11-15T12:00Z')), null)
    assert.equal(erAfsluttetUge(week, new Date('2026-10-25T12:00Z')), false)
    assert.equal(erAfsluttetUge(week, new Date('2026-10-26T12:00Z')), true)
    if (enabled) {
      assert.equal(erAfsluttetUge(week, new Date('2026-10-25T22:59:59Z')), false)
      assert.equal(erAfsluttetUge(week, new Date('2026-10-25T23:00:00Z')), true)
    }
  })

  test(`${prefix}: Program Sunday rest, actual next week handler and coach text`, () => at('2026-10-25T12:00Z', () => {
    const calls = []
    const p = programProps({ setViewingWeekIdx: n => calls.push(['week', n]),
      setProgOpenSession: n => calls.push(['session', n]), setPastLogs: n => calls.push(['logs', n]),
      fetchPastLogs: () => assert.fail('future week must not read past logs') })
    const view = mount(Program, p)
    let tree = view.render()
    assert.match(text(tree), /Søndag.*Hviledag/)
    assert.match(text(tree), /Fra din coach.*Syntetisk coachnote/)
    // The second empty circle is the actual next-week control.
    const circles = nodes(tree, n => n.type === 'button' && n.props.style?.borderRadius === '50%' && n.props.style?.width === '20px')
    assert.equal(circles.length, 1)
    circles[0].props.onClick()
    assert.deepEqual(calls, [['week', 1], ['session', null], ['logs', []]])
    tree = view.render({ ...p, viewingWeekIdx: 1 })
    assert.match(text(tree), /Planlagt · uge 2/)
    assert.match(text(tree), /Mandagens pas/)
    assert.match(text(tree), /Fra din coach/)
    assert.doesNotMatch(text(tree), /tekst fra Marc|RIR/i)
    // Additional preview flag remains opt-in, and is tested explicitly as such.
    const preview = view.render({ ...p, viewingWeekIdx: 1, programNaesteUge: true })
    assert.match(text(preview), /Mandagens pas/)
    const monday = mount(Program, programProps({ currentWeek: next, viewingWeekIdx: 1 })).render()
    assert.match(text(monday), /Du er her · uge 2/)
  }))

  test(`${prefix}: actual nextTrainingHome Sunday DST, Monday rollover and Program action`, () => {
    const base = { allWeeks: [week, next], currentWeek: week, exerciseLogs: [] }
    assert.equal(nextTrainingHome(base), null, 'feature itself stays default OFF')
    for (const instant of ['2026-10-25T00:30Z', '2026-10-25T01:30Z', '2026-10-25T22:59:59Z']) {
      const model = nextTrainingHome({ ...base, enabled: true, now: new Date(instant) })
      assert.equal(model.date, '2026-10-26')
      assert.equal(model.day, 'Mandag')
      assert.equal(model.weekNumber, 2)
      const calls = []
      const tree = renderNextTrainingHome(createElement, model, () => calls.push('program'))
      buttons(tree, 'Se Program')[0].props.onClick()
      assert.deepEqual(calls, ['program'])
    }
    assert.equal(nextTrainingHome({ ...base, enabled: true, now: new Date('2026-10-25T23:00Z') }), null)
    const empty = nextTrainingHome({ ...base, allWeeks: [week], enabled: true, now: new Date('2026-10-25T12:00Z') })
    assert.equal(empty.kind, 'no-next')
  })

  test(`${prefix}: actual Mobilisering shortcut handlers work without optional mobility flags`, () => {
    const calls = []
    const p = { mobilityMode: null, currentWeek: week, readinessLog: {}, warmupTemplates: [],
      setMobilityMode: mode => calls.push(['mode', mode]), setTab: tab => calls.push(['tab', tab]),
      setWarmupChoice: () => {}, setWarmupStep: () => {}, setWarmupPhase: () => {},
      setWarmupFocus: () => {}, setWarmupSubtype: () => {}, setWarmupProblems: () => {}, setWarmupExercises: () => {},
      setTimerActive: () => {}, setTimerSeconds: () => {}, setTimerDone: () => {},
      warmupExercises: [], warmupChoice: {}, warmupProblems: new Set(), warmupPhase: 'done' }
    const view = mount(Mobilisering, p)
    const door = nodes(view.render(), n => n.type === 'button' && /Varm op/.test(text(n)))
    assert.equal(door.length, 1)
    door[0].props.onClick()
    assert.deepEqual(calls, [['mode', 'opvarmning']])
    calls.length = 0
    const tree = view.render({ ...p, mobilityMode: 'opvarmning' })
    buttons(tree, 'Til dagens pas →')[0].props.onClick()
    assert.deepEqual(calls, [['mode', null], ['tab', 'hjem']])
    assert.doesNotMatch(text(tree), /tekst fra Marc|RIR/i)
    assert.equal(io.rpc, 0)
  })
}

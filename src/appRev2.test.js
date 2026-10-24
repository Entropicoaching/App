import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { writes, resetFake } from './appRev2Fakes.mjs'

// The actual handler modules are imported. Only the service boundary is faked.
registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) {
    return { url: new URL('./appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { compareReadiness, summarizeReadinessForCoach } = await import('./readinessInsight.js')
const { lavProfilTal } = await import('./dashboard/profilTal.js')
const { calendarDay, addCalendarDays, calendarDaysBetween } = await import('./calendarDate.js')
const weeks = await import('./weekDates.js')
const period = await import('./periodizationAssistant.js')
const overview = await import('./planOverview.js')
const dates = await import('./danskDato.js')
const shared = await import('./athleteShared.js')
const nutrition = await import('./athlete/kostNumbers.mjs')
const strength = await import('./exerciseProgress.js')
const defaults = await import('./setLogDefaults.js')
const volume = await import('./volume/beregn.js')
const plannedVolume = await import('./volume/planlagt.js')
const keys = await import('./volume/ugenoegle.js')
const status = await import('./athlete/ugeStatus.js')
const seen = await import('./coachBriefingSeen.js')
const checkin = await import('./checkinReminder.js')
const { lavSaetSkrivning } = await import('./athlete/saetSkrivning.js')
const { lavLaesninger } = await import('./athlete/laesninger.js')
const { lavAtletHandlinger } = await import('./dashboard/atletHandlinger.js')
const { lavProgramHandlinger } = await import('./dashboard/programHandlinger.js')
const { lavIndbakkeHandlinger } = await import('./dashboard/indbakkeHandlinger.js')
const noop = () => {}

for (const zone of ['Europe/Copenhagen', 'Pacific/Auckland', 'America/Los_Angeles']) {
  test(`F1 hele uger, sommertid, aarsskifte og lokal/UTC i ${zone}`, () => {
    process.env.TZ = zone // Synthetic test setting only.
    assert.equal(period.fullWeeksUntil({ startDate: '2026-03-23', competitionDate: '2026-04-06' }), 2)
    assert.equal(period.fullWeeksUntil({ startDate: '2026-10-19', competitionDate: '2026-11-02' }), 2)
    assert.equal(weeks.nextWeekStartDate([{ week_number: 52, start_date: '2026-12-28' }]), '2027-01-04')
    assert.equal(weeks.nextWeekStartDate([], new Date('2026-03-22T23:30:00Z')), '2026-03-23')
    assert.deepEqual(weeks.fillMissingWeekDates([{ id: 'a', week_number: 1, start_date: '2026-03-23' }, { id: 'b', week_number: 3 }]),
      [{ id: 'b', week_number: 3, start_date: '2026-04-06' }])
    const entry = overview.buildPlanOverview({ athletes: [{ id: 'a' }], calendarWeeks: { a: [{ week_number: 1, start_date: '2026-03-23' }] }, today: '2026-03-23' })[0]
    assert.equal(entry.coverage_end, '2026-03-29')
    assert.equal(entry.days_of_coverage, 6)
  })
}
for (const day of ['2026-02-29', '2026-02-30', '2026-13-01', 'wrong']) {
  test(`F1 ugyldig kalenderdato ${day}`, () => {
    assert.equal(dates.danskDag(day), '')
    assert.equal(dates.dageSiden(day, new Date('2026-03-01T12:00:00Z')), null)
    assert.equal(dates.danskDatoTekst(day), '')
    assert.equal(period.fullWeeksUntil({ startDate: day, competitionDate: '2026-05-01' }), null)
    assert.equal(shared.shiftDate(day, 1), null)
    assert.equal(keys.ugenoegle(day), null)
  })
}
test('F1 ugyldig reference, tomme uger og dansk dato ved UTC midnat', () => {
  assert.equal(dates.dageSiden('2026-03-01', new Date(NaN)), null)
  assert.equal(dates.danskDag('2026-12-31T23:30:00Z'), '2027-01-01')
  assert.equal(dates.danskDag('2026-02-30T12:00:00Z'), '')
  assert.equal(dates.dageSiden('2026-03-28', new Date('2026-03-30T10:00:00Z')), 2)
  assert.equal(keys.ugenoegle('2021-01-01'), '2020-W53')
  assert.equal(keys.ugenoegle(new Date(NaN)), null)
  assert.equal(weeks.nextWeekStartDate([null, { week_number: 2, start_date: 'bad' }], new Date('2026-12-31T12:00:00Z')), '2027-01-04')
  assert.deepEqual(weeks.fillMissingWeekDates([null, { week_number: 1, start_date: '2026-02-30' }, { week_number: 2 }]), [])
  assert.equal(weeks.nextWeekStartDate([], new Date(NaN)), null)
  assert.equal(checkin.shouldNudgeCheckin({ weekStartStr: '2026-02-24', weekEndStr: '2026-02-30', todayStr: '2026-02-29' }), false)
})
test('F1 tomme og manglende planfelter', () => {
  assert.deepEqual(period.withBlockPurposes(null), [])
  assert.deepEqual(overview.buildPlanOverview({ athletes: null, calendarWeeks: null }), [])
  const entries = overview.buildPlanOverview({ athletes: [null, { id: 'a' }], calendarWeeks: { a: [null, { week_number: 1, start_date: '2026-02-30' }] }, today: '2026-03-01' })
  assert.equal(entries[0].status, 'needs_dates')
  assert.deepEqual(overview.planOverviewCounts(null), {})
  assert.deepEqual(volume.beregnVolumenPrUge(null, { referenceDato: new Date(NaN) }), [])
  assert.equal(volume.beregnVolumenPrUge([null], { referenceDato: '2026-03-01', antalUger: 1 }).length, 1)
})

function editSet(input) {
  const initial = { id: 'log', exercise_id: 'ex', set_number: 1, logged_at: '2026-03-01T12:00:00Z', weight: 90, reps_completed: 5 }
  let logs = [initial]
  const errors = []
  const handlers = lavSaetSkrivning({ athlete: { id: 'a' }, exerciseLogs: logs,
    setWriteRef: { current: {} }, setExerciseLogs: f => { logs = f(logs) },
    setPendingSyncCount: noop, fetchExerciseLogs: noop, showFlash: (...v) => errors.push(v) })
  return { run: () => handlers.updateLoggedSet('ex', 1, input), logs: () => logs, errors }
}
for (const weight of ['92,5', '92.5']) {
  test(`F2 faktiske saetrettelser gemmer ${weight}`, async () => {
    resetFake({ data: [{ id: 'log' }], error: null })
    const c = editSet({ weight, reps: '5' })
    assert.equal(await c.run(), true)
    assert.equal(writes.find(w => w.table === 'exercise_logs').payload.weight, 92.5)
    assert.equal(c.logs()[0].weight, 92.5)
    assert.equal(c.logs()[0].logged_at, '2026-03-01T12:00:00Z')
  })
}
for (const value of ['Infinity', 'NaN', '12kg', '-1', '1,2.3', '1e999']) {
  test(`F2 afvis saetvaegt ${value} foer skrivning`, async () => {
    resetFake()
    const c = editSet({ weight: value, reps: '5' })
    assert.equal(await c.run(), false)
    assert.equal(writes.length, 0)
    assert.equal(c.logs()[0].weight, 90)
    assert.ok(c.errors.length)
  })
}
test('F2 reps maa ikke afkortes', async () => {
  resetFake()
  assert.equal(await editSet({ weight: '100', reps: '5.5' }).run(), false)
  assert.equal(writes.length, 0)
})
test('F2 logSet validerer foer optimistisk skrivning', async () => {
  resetFake()
  const errors = []
  const h = lavSaetSkrivning({ athlete: { id: 'a' }, exerciseLogs: [], logInputs: { ex_1: { weight: 'Infinity', rpe: '8' } }, showFlash: (...v) => errors.push(v) })
  assert.equal(await h.logSet('ex', 1, 1, '5', 8), false)
  assert.equal(writes.length, 0)
  assert.equal(errors.length, 1)
})
function readiness(input) {
  const errors = []
  const h = lavLaesninger({ athlete: { id: 'a' }, readinessInput: input,
    setSavingReadiness: noop, setReadinessError: e => errors.push(e), setReadinessLog: noop })
  return { run: h.saveReadiness, errors }
}
test('F2 parathed bevarer decimalkomma og manglende soreZones', async () => {
  resetFake()
  await readiness({ sleep: '7,5', energy: 3, motivation: 3, stress: 3, soreness: 3 }).run()
  const p = writes.find(w => w.table === 'readiness_logs').payload
  assert.equal(p.sleep_hours, 7.5)
  assert.equal(p.readiness_score, 63)
  assert.equal(p.sore_zones, null)
})
test('F2 parathed afviser ikke-finite svar og soevn', async () => {
  for (const patch of [{ sleep: 'Infinity' }, { energy: 'NaN' }, { stress: 7 }]) {
    resetFake()
    const c = readiness({ sleep: '7', energy: 3, motivation: 3, stress: 3, soreness: 3, ...patch })
    await c.run()
    assert.equal(writes.length, 0)
    assert.ok(c.errors.some(Boolean))
  }
})
test('F2 coachens faktiske anbefalingshandler', async () => {
  for (const value of ['82,5', '82.5', '', 'Infinity', 'NaN', '82kg']) {
    resetFake()
    const errors = []
    const h = lavProgramHandlinger({ recommendedInput: value, selectedAthlete: { id: 'a' }, fetchWeeks: noop, setEditingRecommended: noop, showFlash: (...v) => errors.push(v) })
    await h.saveRecommendedWeight('ex')
    if (['Infinity', 'NaN', '82kg'].includes(value)) { assert.equal(writes.length, 0); assert.equal(errors.length, 1) }
    else assert.equal(writes[0].payload.recommended_weight, value ? 82.5 : null)
  }
})
test('F2 coachens faktiske atletoprettelse', async () => {
  resetFake({ data: { id: 'a', name: 'A' }, error: null })
  const h = lavAtletHandlinger({ newAthlete: { name: ' A ', email: '', goal: '', notes: '', age: '25', bodyweight: '82,5', squat: '100,5' },
    session: { user: { id: 'c' } }, setSaving: noop, setAthletes: noop, setShowAddModal: noop, setAddStep: noop,
    setNewAthlete: noop, openProfile: noop, setAddingWeek: noop, setWeekForm: noop, showFlash: noop })
  await h.addAthlete()
  assert.equal(writes[0].payload.bodyweight, 82.5)
  assert.equal(writes[0].payload.squat, 100.5)
  assert.equal(writes[1].payload[0].weight, 100.5)
})
test('F2 atletoprettelse afviser Infinity foer I/O', async () => {
  resetFake()
  const h = lavAtletHandlinger({ newAthlete: { name: 'A', age: 'Infinity' }, setSaving: noop, showFlash: noop })
  await h.addAthlete()
  assert.equal(writes.length, 0)
})
test('F2 staevneresultat bevarer halve kilo', async () => {
  resetFake()
  const h = lavAtletHandlinger({ selectedAthlete: { id: 'a', squat: 200 },
    meetResultForm: { contest: { squat: true }, squat: '152,5', bodyweight: '82,5', meet_date: '2026-03-01', meet_name: '', notes: '' },
    setSaving: noop, fetchMeetResults: noop, fetchAthletePRs: noop, setMeetResultForm: noop, showFlash: noop })
  await h.saveMeetResult()
  const p = writes.find(w => w.table === 'meet_results').payload
  assert.equal(p.total, 152.5)
  assert.equal(p.bodyweight, 82.5)
})
test('F2 staevnetotal med overloeb afvises', async () => {
  resetFake()
  const h = lavAtletHandlinger({ selectedAthlete: { id: 'a' }, meetResultForm: { contest: { squat: true, bench: true }, meet_date: '2026-03-01', squat: '1e308', bench: '1e308' }, setSaving: noop, showFlash: noop })
  await h.saveMeetResult()
  assert.equal(writes.length, 0)
})

for (const [w, r] of [[Infinity, 5], [100, Infinity], [NaN, 5], [1e308, 100], [null, 5], [100, 0], [-5, 5]]) {
  test(`F3 finite styrketal ${w}/${r}`, () => assert.equal(strength.estimatedOneRepMax(w, r), 0))
}
test('F3 styrketal genbruger decimalkomma', () => assert.equal(strength.estimatedOneRepMax('100,5', '3'), 110.55000000000001))
test('F3 grafer ignorerer ugyldige raekker og datoer', () => {
  const rows = [null, { weight: Infinity, reps_completed: 5, logged_at: '2026-03-01' },
    { weight: 100, reps_completed: 5, logged_at: '2026-02-30' },
    { weight: 100, reps_completed: 5, logged_at: '2026-03-01', exercises: { name: 'Squat' } }]
  assert.equal(strength.heaviestSetPerWeek(rows).length, 1)
  assert.equal(strength.bestEstimatedSetPerWeek(rows).length, 1)
  assert.equal(strength.bestHeavySetPerDay(rows).length, 1)
})
test('F3 plus og minus giver aldrig NaN eller Infinity', () => {
  assert.equal(defaults.stepWeight('92,5'), '95')
  assert.equal(defaults.stepWeight('12kg'), '2.5')
  assert.equal(defaults.stepWeight('1e308'), '1e+308')
  assert.equal(defaults.stepWeight('100', Infinity), '100')
  assert.equal(defaults.stepReps('5', Infinity), '5')
})
test('F4 tomme naeringsdata og manglende raekker', () => {
  assert.deepEqual(nutrition.nutritionValues(null), { kcal: 0, protein: 0, carb: 0, fat: 0 })
  assert.equal(nutrition.finiteTotal(null, 'kcal'), 0)
  assert.equal(nutrition.finiteTotal([null, {}, { kcal: '100,5' }, { kcal: Infinity }], 'kcal'), 100.5)
  assert.equal(nutrition.nutritionValues({ kcal: '1e308' }, 10), null)
})
test('F5 ugyldigt createdAt vaelter ikke beskednoeglen', () => {
  const item = { kind: 'message', athlete: { id: 'a' }, track: 'chat' }
  assert.equal(seen.coachBriefingPointKey({ ...item, createdAt: 'bad' }), 'message-a-chat-ukendt-dato')
  assert.equal(seen.coachBriefingPointKey({ ...item, createdAt: '2026-02-30T12:00:00Z' }), 'message-a-chat-ukendt-dato')
  assert.equal(seen.coachBriefingPointKey({ ...item, createdAt: '2026-12-31T23:30:00Z' }), 'message-a-chat-2026-12-31')
})
test('F6 faktisk indbakkehandler viser I gaar efter sommertid', t => {
  process.env.TZ = 'Europe/Copenhagen'
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-03-30T10:00:00Z').getTime() })
  const h = lavIndbakkeHandlinger({})
  assert.match(h.formatMsgTime('2026-03-29T10:00:00Z'), /^I går /)
  assert.equal(h.formatMsgTime('bad'), '')
  assert.equal(h.formatMsgTime('2026-02-30T12:00:00Z'), '')
  t.mock.timers.reset()
})
test('F7 tonnage og kalenderdage med manglende og ikke-finite felter', () => {
  process.env.TZ = 'Europe/Copenhagen'
  const week = { sessions: [null, { weekday: 0.5 }, { weekday: 6, exercises: [null, { id: 'e', sets: 3, reps: '5', recommended_weight: Infinity }] }] }
  const result = status.beregnUgeDage(week, new Date(2026, 9, 19), [null, { exercise_id: 'e', weight: Infinity, reps_completed: 5 }])
  assert.equal(result.dage[6].date.getDate(), 25)
  assert.equal(result.dage[6].planlagtTonnage, null)
  assert.equal(result.dage[6].gennemfoertTonnage, 0)
  assert.equal(result.flexSessioner, 1)
  assert.deepEqual(status.beregnForloebUger([null, { start_date: '2026-02-30' }], null), { uger: [], ugerUdenDato: 2 })
})
test('F7 decimalkomma og overloeb i planlagt og gennemfoert tonnage', () => {
  const week = { start_date: '2026-03-23', sessions: [{ weekday: 0, exercises: [{ id: 'e', sets: 3, reps: '5', recommended_weight: '82,5' }] }] }
  const result = status.beregnForloebUger([week], [{ weight: '82,5', reps_completed: 5, logged_at: '2026-03-23' }])
  assert.equal(result.uger[0].planlagt.tonnage, 1238)
  assert.equal(result.uger[0].gennemfoert.tonnage, 413)
  const huge = status.beregnUgeDage({ sessions: [{ weekday: 0, exercises: [{ id: 'e', sets: 3, reps: 5, recommended_weight: 1e308 }] }] }, null, [{ exercise_id: 'e', weight: 1e308, reps_completed: 5 }])
  assert.equal(huge.dage[0].planlagtTonnage, null)
  assert.equal(huge.dage[0].gennemfoertTonnage, 0)
})


test('F1 kalenderhjaelper validerer datoer og vaelger dansk dag', () => {
  assert.equal(calendarDay('2026-03-28T23:30:00Z'), '2026-03-29')
  assert.equal(calendarDay('2024-02-29'), '2024-02-29')
  assert.equal(calendarDay('2026-02-29'), null)
  assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29')
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addCalendarDays('2026-01-01', Infinity), null)
  assert.equal(calendarDaysBetween('2026-03-28', '2026-03-30'), 2)
  assert.equal(calendarDay(new Date(NaN)), null)
  assert.equal(dates.danskDag(undefined), '')
})
test('F1 faktisk datokaskade over aarsskifte og sommertid', async () => {
  process.env.TZ = 'Pacific/Auckland'
  resetFake()
  const h = lavProgramHandlinger({ athletes: [{ id: 'a' }], selectedAthlete: { id: 'a' }, fetchCalendarWeeks: noop, fetchWeeks: noop })
  await h.setBlockStartDate('a', [{ id: '1', week_number: 1 }, { id: '2', week_number: 2 }], '2026-12-28')
  assert.deepEqual(writes.map(w => w.payload.start_date), ['2026-12-28', '2027-01-04'])
  resetFake()
  await h.setBlockStartDate('a', [{ id: '1', week_number: 1 }], '2026-02-30')
  assert.equal(writes.length, 0)
})
test('F2 ny logSet gemmer halve kilo og halve RPE', async t => {
  resetFake({ data: { id: 'log' }, error: null })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let logs = []
  const ex = { id: 'ex', sets: 1, name: 'Squat' }
  const week = { sessions: [{ exercises: [ex] }] }
  const h = lavSaetSkrivning({ athlete: { id: 'a' }, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: { ex_1: { weight: '92,5', rpe: '7,5' } },
    setExerciseLogs: fn => { logs = fn(logs) }, setRestPause: noop, setSetConfirm: noop,
    setWriteRef: { current: {} }, fetchExerciseLogs: noop, showFlash: noop })
  await h.logSet('ex', 1, 1, '5', 8)
  const payload = writes.find(w => w.table === 'exercise_logs').payload
  assert.equal(payload.weight, 92.5)
  assert.equal(payload.rpe_actual, 7.5)
  assert.equal(logs[0].weight, 92.5)
  t.mock.timers.reset()
})
test('F3 parathed sammenligner kun finite scores', () => {
  assert.equal(compareReadiness(Infinity, [50, 50, 50, 50, 50]).status, 'insufficient')
  assert.equal(compareReadiness(50, [Infinity, 50, 50, 50, 50]).status, 'insufficient')
  assert.equal(compareReadiness(50, [NaN, 50, 50, 50, 50]).status, 'insufficient')
  assert.deepEqual(compareReadiness(50, [50, 50, 50, 50, 50]), { status: 'normal', mean: 50, sd: 0, diff: 0 })
})
test('F3 soevngennemsnit med decimalkomma og Infinity', () => {
  const r = summarizeReadinessForCoach([
    { logged_date: '2026-03-01', sleep_hours: '7,5' },
    { logged_date: '2026-03-02', sleep_hours: 8.5 },
    { logged_date: '2026-03-03', sleep_hours: Infinity },
  ])
  assert.equal(r.avgSleep, 8)
})
test('F3 profilens faktiske gennemsnit med decimaler og tomme data', () => {
  assert.equal(lavProfilTal({ athleteLogs: null, athleteWeightLogs: null }).currentWeight, null)
  assert.equal(lavProfilTal({ athleteLogs: [], athleteWeightLogs: [{ weight: '82,5' }, { weight: '83.5' }, { weight: Infinity }, null] }).currentWeight, 83)
  assert.equal(lavProfilTal({ athleteLogs: [], athleteWeightLogs: [{ weight: 1e308 }, { weight: 1e308 }] }).currentWeight, 1e308)
})


test('F2 faktiske profilrettelser bruger faelles parser', async () => {
  resetFake({ data: { id: 'a' }, error: null })
  const h = lavAtletHandlinger({ editData: { bodyweight: '82,5', height: '', age: '25' }, selectedAthlete: { id: 'a' },
    setSaving: noop, setSelectedAthlete: noop, setAthletes: noop, setEditing: noop, showFlash: noop })
  await h.saveEdit()
  assert.equal(writes[0].payload.bodyweight, 82.5)
  assert.equal(writes[0].payload.height, null)
  assert.equal(writes[0].payload.age, 25)
})
test('F1 ugyldige profildatoer afvises foer skrivning', async () => {
  resetFake()
  const h = lavAtletHandlinger({ editData: { competition_date: '2026-02-30' }, selectedAthlete: { id: 'a' },
    setSaving: noop, setSelectedAthlete: noop, setAthletes: noop, setEditing: noop, showFlash: noop })
  await h.saveEdit()
  assert.equal(writes.length, 0)
})
test('F2 stævneplan bevarer decimalkomma og afviser Infinity', async () => {
  for (const value of ['100,5', 'Infinity']) {
    resetFake()
    const h = lavAtletHandlinger({ meetPlanForm: { squat1: value }, fetchMeetPlan: noop, setSavingMeetPlan: noop, showFlash: noop })
    await h.saveMeetPlan('a')
    if (value === 'Infinity') assert.equal(writes.length, 0)
    else assert.equal(writes[0].payload.squat1, 100.5)
  }
})
test('F1 ugyldig stævneresultatdato afvises', async () => {
  resetFake()
  const h = lavAtletHandlinger({ selectedAthlete: { id: 'a' }, meetResultForm: { meet_date: '2026-02-30', contest: { squat: true }, squat: 100 }, setSaving: noop, showFlash: noop })
  await h.saveMeetResult()
  assert.equal(writes.length, 0)
})


test('F1 og F7 planlagt volumen springer ugyldige uger og tomme raekker over', () => {
  const weeks = [null, { start_date: '2026-02-30' }, { start_date: '2026-03-23', sessions: [null, { exercises: [null, { name: 'Squat', sets: 3 }, { name: 'Squat', sets: Infinity }] }] }]
  const result = plannedVolume.beregnPlanlagtPrUge(weeks, [null, { loggetDato: '2026-02-30', oevelseNavn: 'Squat' }])
  assert.equal(result.ugerUdenDato, 2)
  assert.equal(result.uger.length, 1)
  assert.equal(result.uger[0].uge, '2026-W13')
  assert.ok(Object.values(result.uger[0].planlagt.grupper).every(g => Number.isFinite(g.ialt) && g.ialt <= 3))
  assert.equal(plannedVolume.beregnPlanlagtDenneUge(weeks, { referenceDato: '2026-02-30' }).ugePlaceret, false)
  assert.deepEqual(plannedVolume.opsummerGab(null, null, null), [])
  assert.deepEqual(plannedVolume.opsummerGab([{}], ['quads'], {}), [])
})

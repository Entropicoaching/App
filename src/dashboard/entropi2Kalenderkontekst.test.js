// Entropi 2-kobling runde 4, fund 1: læsekonteksten bindes til den faktiske kalenderlæsning.
// Faktisk lavLaesninger med den syntetiske database fra testLoader, faktisk coachmodel.
import './testLoader.mjs'
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as flush } from 'node:timers/promises'
import { state } from './synthetic.mjs'
import { entropi2CalendarRead, entropi2ReadContext } from '../entropi2/coachReadContext.mjs'
import { coachHomeModel } from '../entropi2/coach/coachModel.mjs'
import { readCoachNutrition, selectCoachNutrition, startCoachNutritionRead } from '../entropi2/coachNutritionRead.mjs'
import { nutritionDatabase } from '../entropi2/coachNutritionPagination.fixture.mjs'
import { activityDay } from './coachInactive.mjs'
const { lavLaesninger } = await import('./laesninger.js')

// 2. november kl. 23:50 og 3. november kl. 00:10, København (CET).
const evening = new Date('2026-11-02T22:50:00Z')
const afterMidnight = new Date('2026-11-02T23:10:00Z')
const session = { user: { id: 'syn-coach' } }
const a = { id: 'syn-a', name: 'Syntetisk A' }, b = { id: 'syn-b', name: 'Syntetisk B' }
// Uge 1 startede 29. oktober; sidste planlagte dag ligger under syv dage fremme begge dage.
const weekRows = [{ id: 'syn-w1', athlete_id: 'syn-a', week_number: 1, start_date: '2026-10-29',
  sessions: [{ id: 'syn-s1', session_order: 1, exercises: [{ id: 'syn-e1', sets: 3, reps: '5' }] }] }]

function reader({ entropi2 = true, coachActions = true } = {}) {
  state.calls.length = 0; state.responses.length = 0
  const captured = { status: {}, calendar: undefined }
  const handlers = lavLaesninger({ session, coachActions,
    ...(entropi2 ? { entropi2CalendarRead } : {}),
    setCoachActionsStatus: fn => { captured.status = fn(captured.status) },
    setCalendarWeeks: value => { captured.calendar = value } })
  return { handlers, captured }
}
async function at(now, fn) {
  mock.timers.enable({ apis: ['Date'], now })
  try { return await fn() } finally { mock.timers.reset() }
}
const contextFor = (captured, athletes, extra = {}) => entropi2ReadContext({ enabled: true, loading: false, loadError: false,
  coachId: session.user.id, athletes, calendarWeeks: captured.calendar, coachActionsStatus: captured.status, coachMorningData: {}, ...extra })
const homeModel = (captured, athletes, readContext, today) => coachHomeModel({ session, athletes, readContext,
  calendarWeeks: captured.calendar, coachActionsStatus: captured.status, loading: false, loadError: false }, today)
const programActions = m => m.actions.filter(item => item.tab === 'program')

test('R4 F1: genstempling efter midnat med omordnet atletliste giver ingen programhandling', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: weekRows })
  await at(evening, () => handlers.fetchCalendarWeeks([a.id, b.id]))
  const context = contextFor(captured, [a, b])
  assert.deepEqual(context, { coachId: 'syn-coach', athleteIds: [a.id, b.id], day: '2026-11-02' })
  assert.equal(programActions(homeModel(captured, [a, b], context, evening)).length, 1)
  // Kl. 00:10: samme kalenderobjekt og status, men atletlisten har skiftet rækkefølge.
  const later = await at(afterMidnight, () => contextFor(captured, [b, a]))
  assert.equal(later, context)
  assert.equal(later.day, '2026-11-02')
  const m = homeModel(captured, [b, a], later, afterMidnight)
  assert.equal(m.calendarReady, false)
  assert.equal(programActions(m).length, 0)
  assert.equal(m.complete, false)
})

test('R4 F1: en ny faktisk læsning efter midnat giver dagens kontekst og handlingen tilbage', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: weekRows })
  await at(evening, () => handlers.fetchCalendarWeeks([a.id]))
  const old = contextFor(captured, [a])
  state.responses.push({ data: weekRows })
  await at(afterMidnight, () => handlers.fetchCalendarWeeks([a.id]))
  const fresh = contextFor(captured, [a])
  assert.notEqual(fresh, old)
  assert.equal(fresh.day, activityDay(afterMidnight))
  assert.equal(fresh.day, '2026-11-03')
  assert.equal(programActions(homeModel(captured, [a], fresh, afterMidnight)).length, 1)
})

test('R4 F1: under en ny læsning og efter fejl er der ingen kontekst; et ældre resultat ommærkes ikke', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: weekRows })
  await handlers.fetchCalendarWeeks([a.id])
  assert.ok(contextFor(captured, [a]))
  // To overlappende læsninger: den første afsluttes først, men hører ikke til den nyeste anmodning.
  state.responses.push({ data: weekRows }, { data: weekRows })
  const first = handlers.fetchCalendarWeeks([a.id])
  const second = handlers.fetchCalendarWeeks([a.id, b.id])
  assert.equal(contextFor(captured, [a]), undefined)
  await first
  assert.equal(contextFor(captured, [a]), undefined)
  await second
  assert.deepEqual(contextFor(captured, [a, b]).athleteIds, [a.id, b.id])
  assert.equal(contextFor(captured, [a]), undefined)
  // En fejlet læsning efterlader ingen kontekst, heller ikke den forrige.
  state.responses.push({ data: null, error: { message: 'syntetisk' } })
  await handlers.fetchCalendarWeeks([a.id, b.id])
  assert.equal(captured.status.calendar, 'error')
  assert.equal(contextFor(captured, [a, b]), undefined)
  // Ejer- og scopeskift invaliderer en afsluttet læsning.
  state.responses.push({ data: weekRows })
  await handlers.fetchCalendarWeeks([a.id])
  assert.ok(contextFor(captured, [a]))
  assert.equal(contextFor(captured, [a], { coachId: 'syn-other' }), undefined)
  assert.equal(contextFor(captured, [a, b]), undefined)
  assert.equal(contextFor(captured, [a], { coachMorningData: { messages: { state: 'loading' } } }), undefined)
})

test('R4 F1: en tom faktisk læsning bindes også til sit eget resultat', async () => {
  const { handlers, captured } = reader()
  await at(evening, () => handlers.fetchCalendarWeeks([]))
  assert.deepEqual(captured.calendar, {})
  assert.deepEqual(contextFor(captured, []), { coachId: 'syn-coach', athleteIds: [], day: '2026-11-02' })
  assert.equal(state.calls.length, 0)
})

test('R4 F1: OFF er læseren uændret: ingen kontekst og samme status uden funktionen', async () => {
  for (const options of [{ entropi2: false }, { entropi2: true, coachActions: false }, { entropi2: false, coachActions: false }]) {
    const { handlers, captured } = reader(options)
    state.responses.push({ data: weekRows })
    await handlers.fetchCalendarWeeks([a.id])
    assert.equal(Object.hasOwn(captured.status, 'e2Calendar'), false, JSON.stringify(options))
    assert.deepEqual(captured.status, options.coachActions === false ? {} : { calendar: 'ready' })
    assert.equal(contextFor(captured, [a]), undefined)
  }
})

test('R5 F1: B afsluttes før A; ingen kontekst mens A er i gang, og A overskriver ikke B', async () => {
  for (const lateA of [{ data: weekRows }, { data: null, error: { message: 'syntetisk' } }, Error('syntetisk kast')]) {
    const { handlers, captured } = reader()
    let releaseA
    const answerA = new Promise((resolve, reject) => { releaseA = () => lateA instanceof Error ? reject(lateA) : resolve(lateA) })
    state.responses.push(answerA, { data: [] })
    const first = handlers.fetchCalendarWeeks([a.id])
    const second = handlers.fetchCalendarWeeks([a.id, b.id])
    await second
    const weeksB = captured.calendar
    assert.deepEqual(weeksB, { [a.id]: [], [b.id]: [] })
    assert.equal(captured.status.calendar, 'ready')
    // A er stadig i gang: læsningerne overlapper, så der er ingen kontekst.
    assert.equal(contextFor(captured, [a, b]), undefined)
    releaseA()
    await first.catch(() => {})
    // A's ældre svar overskriver hverken kalender eller status, og B's kontekst gælder nu.
    assert.equal(captured.calendar, weeksB)
    assert.equal(captured.status.calendar, 'ready')
    assert.deepEqual(contextFor(captured, [a, b]).athleteIds, [a.id, b.id])
    assert.equal(contextFor(captured, [a]), undefined)
  }
})

test('R5 F1: en ny læsning midt i en afsluttet giver ingen kontekst, før den selv er afsluttet', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: weekRows })
  await handlers.fetchCalendarWeeks([a.id])
  assert.ok(contextFor(captured, [a]))
  let release
  state.responses.push(new Promise(resolve => { release = () => resolve({ data: weekRows }) }))
  const pending = handlers.fetchCalendarWeeks([a.id])
  assert.equal(contextFor(captured, [a]), undefined)
  release(); await pending
  assert.ok(contextFor(captured, [a]))
})

// Fletning med kostkoblingen: kostlinjen læses og vises kun med læsningens egen kontekst.
function nutritionClient(rows, options = {}) {
  // Same synthetic Supabase boundary as the accepted pagination tests: filters
  // and stable ordering precede inclusive ranges, including the empty last page.
  const { client, calls } = nutritionDatabase(rows, {
    goals: [{ id: a.id, kcal_target: 2400, protein_target: 150 }], ...options,
  })
  return { ...client, calls }
}

test('R4 kost: kostlinjen følger læsningens kontekst og forsvinder ved genstempling efter midnat', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: weekRows })
  await at(evening, () => handlers.fetchCalendarWeeks([a.id, b.id]))
  const context = contextFor(captured, [a, b])
  const rows = ['2026-10-28', '2026-10-30', '2026-11-01', '2026-11-02'].map((date, i) => ({ id: i + 1, athlete_id: a.id, date, meal: 'Syntetisk', kcal: 2000, protein: 120 }))
  const coachNutrition = await readCoachNutrition(nutritionClient(rows), context)
  assert.equal(selectCoachNutrition({ context, batch: coachNutrition }, true, context), coachNutrition)
  const props = readContext => ({ session, athletes: [a, b], readContext, coachNutrition: selectCoachNutrition({ context, batch: coachNutrition }, true, readContext),
    calendarWeeks: captured.calendar, coachActionsStatus: captured.status, loading: false, loadError: false })
  assert.equal(coachHomeModel(props(context), evening).nutrition.size, 1)
  // Efter midnat og omordnet atletliste er konteksten stadig læsningens egen: ingen kostlinje.
  const later = await at(afterMidnight, () => contextFor(captured, [b, a]))
  assert.equal(later, context)
  assert.equal(coachHomeModel(props(later), afterMidnight).nutrition.size, 0)
  // Uden kontekst (fx under en ny læsning) gives intet kostsvar videre.
  assert.equal(selectCoachNutrition({ context, batch: coachNutrition }, true, contextFor(captured, [a, b], { coachMorningData: { messages: { state: 'loading' } } })), undefined)
})

test('R2 kostfixture: filtre og stabil dato/id-sortering anvendes før inklusiv range og tom slutside', async () => {
  const row = (id, date, athlete_id = a.id) => ({ id, date, athlete_id, meal: 'Syntetisk', kcal: 500, protein: 40 })
  const client = nutritionClient([
    row(5, '2026-11-02'), row(3, '2026-10-28'), row(1, '2026-11-02'),
    row(6, '2026-11-02', b.id), row(7, '2026-10-27'), row(8, '2026-11-03'),
  ], { goals: [{ id: b.id }, { id: a.id, kcal_target: 2400 }] })
  const query = () => client.from('meal_logs').select('id, date').in('athlete_id', [a.id])
    .gte('date', '2026-10-28').lte('date', '2026-11-02').order('date').order('id')
  assert.deepEqual((await query().range(0, 1)).data, [{ id: 3, date: '2026-10-28' }, { id: 1, date: '2026-11-02' }])
  assert.deepEqual((await query().range(2, 2)).data, [{ id: 5, date: '2026-11-02' }])
  assert.deepEqual((await query().range(3, 1002)).data, [])
  assert.deepEqual((await query().limit(1)).data, [{ id: 3, date: '2026-10-28' }])
  const targets = () => client.from('athletes').select('id, kcal_target').in('id', [a.id]).order('id')
  assert.deepEqual((await targets().range(0, 0)).data, [{ id: a.id, kcal_target: 2400 }])
  assert.deepEqual((await targets().range(1, 1000)).data, [])
})

test('R2 kostfixture: faktisk læser fortsætter efter korte sider og afslutter begge tabeller med tom range', async () => {
  const context = { coachId: session.user.id, athleteIds: [a.id], day: '2026-11-02' }
  const rows = [5, 1, 4, 2, 3].map(id => ({ id, athlete_id: a.id, date: context.day, meal: 'Syntetisk' }))
  const client = nutritionClient([...rows,
    { ...rows[0], id: 6, athlete_id: b.id }, { ...rows[0], id: 7, date: '2026-10-26' },
    { ...rows[0], id: 8, date: '2026-11-03' },
  ], { serverCap: 2, goals: [{ id: b.id }, { id: a.id, kcal_target: 2400, protein_target: 150 }] })
  const batch = await readCoachNutrition(client, context)
  assert.equal(batch.state, 'ready'); assert.equal(batch.complete, true)
  assert.deepEqual(batch.rows.map(row => row.id), ['1', '2', '3', '4', '5'])
  assert.deepEqual(batch.targets, [{ athlete_id: a.id, kcal_target: 2400, protein_target: 150 }])
  const meals = client.calls.filter(call => call.table === 'meal_logs')
  assert.deepEqual(meals.map(call => call.range), [[0, 999], [2, 1001], [4, 1003], [5, 1004]])
  for (const call of meals) {
    assert.deepEqual(call.filters, [['athlete_id', 'in', [a.id]], ['date', 'gte', '2026-10-27'], ['date', 'lte', context.day]])
    assert.deepEqual(call.orders, [['date', true], ['id', true]])
  }
  const targets = client.calls.filter(call => call.table === 'athletes')
  assert.deepEqual(targets.map(call => call.range), [[0, 999], [1, 1000]])
  for (const call of targets) {
    assert.deepEqual(call.filters, [['id', 'in', [a.id]]])
    assert.deepEqual(call.orders, [['id', true]])
  }
})

test('R2 kostfixture: sent terminalt svar får ikke en ny kalenderkontekst eller kontekst under læsning', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: weekRows })
  await at(evening, () => handlers.fetchCalendarWeeks([a.id, b.id]))
  const context = contextFor(captured, [a, b])
  const rows = ['2026-10-28', '2026-10-30', '2026-11-01', '2026-11-02']
    .map((date, id) => ({ id: id + 1, athlete_id: a.id, date, meal: 'Syntetisk', kcal: 2000, protein: 120 }))
  let release, entered
  const held = new Promise(resolve => { release = resolve }), waiting = new Promise(resolve => { entered = resolve })
  const client = nutritionClient(rows, { serverCap: 2, before: call => {
    if (call.table === 'meal_logs' && call.range[0] === 4) { entered(); return held }
  } })
  const values = [], stop = startCoachNutritionRead({ enabled: true, client, readContext: context }, value => values.push(value))
  try {
    await waiting
    assert.equal(values.length, 0)
    state.responses.push({ data: weekRows })
    const pending = at(afterMidnight, () => handlers.fetchCalendarWeeks([b.id, a.id]))
    assert.equal(contextFor(captured, [b, a]), undefined)
    await pending
    const fresh = contextFor(captured, [b, a])
    assert.notEqual(fresh, context); assert.equal(fresh.day, '2026-11-03')
    release()
    await flush()
    assert.equal(values.length, 1); assert.equal(values[0].batch.complete, true)
    assert.equal(values[0].context, context); assert.equal(values[0].batch.day, '2026-11-02')
    assert.equal(selectCoachNutrition(values[0], true, fresh), undefined)
    assert.equal(selectCoachNutrition(values[0], true, undefined), undefined)
    const batch = selectCoachNutrition(values[0], true, context)
    assert.equal(batch, values[0].batch)
    const props = { session, athletes: [a, b], readContext: context, coachNutrition: batch,
      calendarWeeks: captured.calendar, coachActionsStatus: captured.status, loading: false, loadError: false }
    assert.equal(coachHomeModel(props, evening).nutrition.size, 1)
    assert.equal(coachHomeModel(props, afterMidnight).nutrition.size, 0)
  } finally { stop(); release() }
})

test('R2 kostfixture: annullering på næste side standser senere sider, mål og aflevering', async () => {
  const context = { coachId: session.user.id, athleteIds: [a.id], day: '2026-11-02' }
  const rows = [1, 2, 3].map(id => ({ id, athlete_id: a.id, date: context.day, meal: 'Syntetisk' }))
  let release, entered
  const held = new Promise(resolve => { release = resolve }), waiting = new Promise(resolve => { entered = resolve })
  const client = nutritionClient(rows, { serverCap: 2, before: call => {
    if (call.table === 'meal_logs' && call.range[0] === 2) { entered(); return held }
  } })
  const values = [], stop = startCoachNutritionRead({ enabled: true, client, readContext: context }, value => values.push(value))
  try {
    await waiting
    stop(); release()
    await flush()
    assert.deepEqual(values, [])
    assert.deepEqual(client.calls.map(call => [call.table, call.range[0]]), [['meal_logs', 0], ['meal_logs', 2]])
  } finally { stop(); release() }
})

// Entropi 2-kostkobling: APP-KOST-START1 (atlet) og APP-KOST-COACH1 (coach) koblet bag flaget entropi2.
// Faktiske moduler; syntetiske data og en falsk klient. Ingen browser, net eller rigtig database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import Entropi2Kost, { mountKost, forwardKostWeight } from './Entropi2Kost.mjs'
import { mountNutritionScreen } from './nutrition/index.mjs'
import { syntheticHost, flush } from './nutrition/synthetic-dom.mjs'
import { readCoachNutrition, startCoachNutritionRead, selectCoachNutrition, nutritionFrom, COACH_NUTRITION_CAP } from './coachNutritionRead.mjs'
import CoachScreen, { CoachView } from './coach/CoachScreen.mjs'
import { coachHomeModel } from './coach/coachModel.mjs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const day = '2026-11-02'
const athlete = { id: 'syn-atlet', kcal_target: 2400, protein_target: 160 }

// Falsk klient: kæden registreres, og svaret afgøres af tabellen.
function fakeClient(answers = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      const call = { table, ops: [] }
      calls.push(call)
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') {
          const answer = answers[table] ?? { data: [], error: null }
          if (answer instanceof Error) return (_ok, fail) => Promise.reject(answer).then(_ok, fail)
          return (ok, fail) => Promise.resolve(typeof answer === 'function' ? answer(call) : answer).then(ok, fail)
        }
        return (...args) => { call.ops.push([key, ...args]); return chain }
      } })
      return chain
    },
  }
  return client
}
const latestRef = () => ({ current: {} })
const weightSection = host => host.querySelectorAll('section').find(n => n.textContent.startsWith('Din vægt'))
// Runde 12: kostens "Log hurtigt" (E2-KOST-NAESTE1) ligger nu øverst med egne formularer;
// vægtformularen findes derfor i vægtafsnittet, ikke som sidens første formular.
const weightForm = host => weightSection(host).querySelectorAll('form')[0]
const goalCard = host => host.querySelectorAll('section').find(n => n.textContent.startsWith('Dagens mål'))
const weightRow = (logged_at, weight, extra = {}) => ({ athlete_id: athlete.id, logged_at, weight, ...extra })

test('KOST: kostskærmen får atletens mål og vægt fra de eksisterende rækker', async () => {
  const host = syntheticHost()
  const cleanup = mountKost(host, { athlete, date: day, client: fakeClient(), foods: [] }, latestRef(),
    { weightLogs: [weightRow('2026-11-01', 82.4), weightRow(day, 82.0), { ...weightRow(day, 99), athlete_id: 'syn-anden' }],
      weightInput: '', onWeightInput() {}, logWeight() {}, savingWeight: false })
  await flush()
  assert.match(goalCard(host).textContent, /2.400 kcal/)
  assert.match(goalCard(host).textContent, /160 g/)
  const section = weightSection(host)
  assert.match(section.textContent, /Seneste vægt: 82 kg · 2\. nov\./)
  assert.match(section.textContent, /Ugegennemsnit: 82,2 kg · 2 vejedage/)
  assert.doesNotMatch(section.textContent, /99/)
  assert.equal(section.querySelectorAll('form').length, 1)
  assert.equal(typeof cleanup.updateWeight, 'function')
  cleanup()
})

test('KOST: vejning med ét tryk kalder den nyeste logWeight-closure uden argumenter', async () => {
  const host = syntheticHost()
  const calls = []
  const closure = input => (...args) => { calls.push({ input, args }) }
  const inputs = []
  const cleanup = mountKost(host, { athlete, date: day, client: fakeClient(), foods: [] }, latestRef(),
    { weightLogs: [], weightInput: '', onWeightInput: value => inputs.push(value), logWeight: closure(''), savingWeight: false })
  await flush()
  // Som AthleteView efter setWeightInput: ny gengivelse med ny closure og nyt input.
  forwardKostWeight(cleanup, { weightLogs: [], weightInput: '82,5', onWeightInput: value => inputs.push(value),
    logWeight: closure('82,5'), savingWeight: false })
  await weightForm(host).fire('submit')
  await flush()
  assert.deepEqual(calls, [{ input: '82,5', args: [] }])
  // Den gamle closure med tomt input bruges aldrig.
  assert.equal(calls.some(call => call.input === ''), false)
  cleanup()
})

test('KOST: uden skrivecallbacks (historisk dato) vises ingen vægtformular, men vægttallene', async () => {
  const host = syntheticHost()
  const cleanup = mountKost(host, { athlete, date: day, client: fakeClient(), foods: [] }, latestRef(),
    { weightLogs: [weightRow(day, 81.5)], weightInput: '', savingWeight: false })
  await flush()
  assert.equal(weightSection(host).querySelectorAll('form').length, 0)
  assert.match(weightSection(host).textContent, /Seneste vægt: 81,5 kg/)
  assert.match(weightSection(host).textContent, /Vejning er ikke tilsluttet endnu/)
  cleanup()
})

test('KOST: med flaget slukket monteres intet, og OFF-cleanup tåler vægtvideresendelse', () => {
  const host = syntheticHost()
  const cleanup = mountNutritionScreen(host, { entropi2: false, athlete, date: day, weightLogs: [weightRow(day, 80)] })
  assert.equal(host.textContent, '')
  assert.doesNotThrow(() => forwardKostWeight(cleanup, { weightInput: '80' }))
  assert.doesNotThrow(() => forwardKostWeight(null, {}))
  assert.equal(renderToString(createElement(Entropi2Kost, { enabled: false, athlete, date: day })), '')
  assert.equal(renderToString(createElement(Entropi2Kost, { enabled: 'true', athlete, date: day })), '')
})

test('KOST: AthleteView leverer mål, vægt og logWeight kun på dagens dato og henter vægt ved kostfanen', () => {
  const source = read('../AthleteView.jsx')
  assert.match(source, /<Entropi2Kost enabled=\{true\} athlete=\{athlete\} date=\{kostDate\}/)
  assert.match(source, /weightLogs=\{weightLogs\} weightInput=\{weightInput\} savingWeight=\{savingWeight\}/)
  assert.match(source, /\{\.\.\.\(kostDate === e2Dag\.day \|\| kostDate === e2Day \? \{ onWeightInput: setWeightInput, logWeight, currentDay: today, onDayChanged: e2Dag\.refresh \} : \{\}\)\} \/>/)
  assert.match(source, /const e2KostAaben = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete\?\.id && visKost && tab === 'kost'\n/)
  assert.match(source, /useEffect\(\(\) => \{ if \(e2KostAaben\) fetchWeightLogs\(athlete\.id\) \}, \[e2KostAaben, athlete\?\.id\]\)/)
  // Den gamle kostfane med flaget slukket er uændret og får ingen nye props.
  assert.match(source, /\{!e2Atlet && visKost && tab === 'kost' && \(\n {10}<LazyBoundary\n {12}factory=\{kostFactory\}/)
})

test('KOST: vægthentningens betingelse er falsk med flaget slukket og i coachens forhåndsvisning', () => {
  const line = read('../AthleteView.jsx').split('\n').find(l => l.startsWith('  const e2KostAaben = '))
  const condition = new Function('e2', 'role', 'coachAthleteId', 'onExitPreview', 'athlete', 'visKost', 'tab',
    'return Boolean(' + line.slice('  const e2KostAaben = '.length) + ')')
  const on = ['athlete', null, undefined, { id: 'syn' }, true, 'kost']
  assert.equal(condition(true, ...on), true)
  assert.equal(condition(false, ...on), false)
  assert.equal(condition(true, 'coach', 'syn', undefined, { id: 'syn' }, true, 'kost'), false)
  assert.equal(condition(true, 'athlete', null, () => {}, { id: 'syn' }, true, 'kost'), false)
  assert.equal(condition(true, 'athlete', null, undefined, { id: 'syn' }, true, 'hjem'), false)
  assert.equal(condition(true, 'athlete', null, undefined, { id: 'syn' }, false, 'kost'), false)
})

// ---- Coach (APP-KOST-COACH1) ----
const context = () => ({ coachId: 'syn-coach', day, athleteIds: ['syn-a', 'syn-b'] })
const session = { user: { id: 'syn-coach' } }
const athletes = [{ id: 'syn-a', name: 'Syntetisk A' }, { id: 'syn-b', name: 'Syntetisk B' }]
const meals = ['2026-10-27', '2026-10-28', '2026-10-30', day].map((date, i) =>
  ({ id: `syn-meal-${i}`, athlete_id: 'syn-a', date, meal: 'Syntetisk måltid', kcal: 2000, protein: 120 }))
const goals = [{ id: 'syn-a', kcal_target: 2400, protein_target: 150 }, { id: 'syn-b', kcal_target: null, protein_target: null }]
const answers = () => ({ meal_logs: { data: meals.map(m => ({ ...m })), error: null }, athletes: { data: goals, error: null } })
const coachProps = (readContext, coachNutrition) => ({ session, athletes, readContext, coachNutrition,
  loading: false, loadError: false, calendarWeeks: {}, coachActionsStatus: {} })

test('COACH: læsningen er atlet-scopet til kontekstens id-mængde og de seneste 7 kalenderdage', async () => {
  const client = fakeClient(answers())
  const batch = await readCoachNutrition(client, context())
  assert.equal(nutritionFrom(day), '2026-10-27')
  assert.deepEqual({ ...batch, rows: undefined, targets: undefined }, { coachId: 'syn-coach', day, athleteIds: ['syn-a', 'syn-b'],
    from: '2026-10-27', through: day, state: 'ready', complete: true, rows: undefined, targets: undefined })
  const meal = client.calls.find(c => c.table === 'meal_logs')
  assert.deepEqual(meal.ops.find(op => op[0] === 'in'), ['in', 'athlete_id', ['syn-a', 'syn-b']])
  assert.deepEqual(meal.ops.find(op => op[0] === 'gte'), ['gte', 'date', '2026-10-27'])
  assert.deepEqual(meal.ops.find(op => op[0] === 'lte'), ['lte', 'date', day])
  assert.deepEqual(meal.ops.find(op => op[0] === 'limit'), ['limit', COACH_NUTRITION_CAP])
  const target = client.calls.find(c => c.table === 'athletes')
  assert.deepEqual(target.ops.find(op => op[0] === 'in'), ['in', 'id', ['syn-a', 'syn-b']])
  assert.equal(client.calls.some(c => c.ops.some(([op]) => ['insert', 'update', 'upsert', 'delete', 'rpc'].includes(op))), false)
  assert.deepEqual(batch.targets[0], { athlete_id: 'syn-a', kcal_target: 2400, protein_target: 150 })
})

test('COACH: gyldig kontekst giver præcis én kostlinje i CoachView; skjult uden flag', async () => {
  const readContext = context()
  const batch = await readCoachNutrition(fakeClient(answers()), readContext)
  const model = coachHomeModel(coachProps(readContext, batch), day)
  assert.equal(model.nutrition.size, 1)
  assert.match(model.nutrition.get('syn-a').text, /Kost · 4\/7 dage · Gns\. pr\. logget dag: 2000 kcal \/ 120 g protein · Mål: 2400 kcal \/ 150 g protein/)
  const html = renderToString(createElement(CoachView, { enabled: true, today: day, ...coachProps(readContext, batch) }))
  assert.match(html, /Kostoverblik/)
  assert.match(html, /4\/7 dage/)
  // Flaget slukket: hverken skærm eller kostlinje.
  assert.equal(renderToString(createElement(CoachScreen, { enabled: false, today: day, ...coachProps(readContext, batch) })), '')
  assert.equal(renderToString(createElement(CoachView, { enabled: 'true', today: day, ...coachProps(readContext, batch) })), '')
})

test('COACH: et svar fra en anden ejer, dag eller atletmængde ommærkes aldrig', async () => {
  const readContext = context()
  const batch = await readCoachNutrition(fakeClient(answers()), readContext)
  const lines = ctx => coachHomeModel(coachProps(ctx, batch), ctx.day).nutrition.size
  assert.equal(lines(readContext), 1)
  assert.equal(lines({ ...readContext, coachId: 'syn-anden' }), 0)
  assert.equal(lines({ ...readContext, day: '2026-11-03' }), 0)
  assert.equal(lines({ ...readContext, athleteIds: ['syn-a'] }), 0)
  // Hooken giver kun svaret videre for netop det kontekstobjekt, læsningen startede med.
  const result = { context: readContext, batch }
  assert.equal(selectCoachNutrition(result, true, readContext), batch)
  assert.equal(selectCoachNutrition(result, true, { ...readContext }), undefined)
  assert.equal(selectCoachNutrition(result, false, readContext), undefined)
  assert.equal(selectCoachNutrition(result, true, undefined), undefined)
})

test('COACH: konteksten indfanges ved læsningens start og følger svaret uændret', async () => {
  const readContext = context()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const client = fakeClient({ ...answers(), meal_logs: () => gate.then(() => ({ data: meals, error: null })) })
  const pending = readCoachNutrition(client, readContext)
  readContext.athleteIds.push('syn-c'); readContext.day = '2026-11-03'
  release()
  const batch = await pending
  assert.deepEqual(batch.athleteIds, ['syn-a', 'syn-b'])
  assert.equal(batch.day, day)
})

test('COACH: fejl, afkortning og manglende mål giver ingen linje', async () => {
  const readContext = context()
  const cases = {
    'meal-fejl': { ...answers(), meal_logs: { data: null, error: new Error('syn') } },
    'mål-fejl': { ...answers(), athletes: { data: null, error: new Error('syn') } },
    'kast': { ...answers(), meal_logs: new Error('syn') },
    'cap': { ...answers(), meal_logs: { data: Array.from({ length: COACH_NUTRITION_CAP }, (_, i) =>
      ({ ...meals[i % 4], id: `syn-${i}` })), error: null } },
  }
  for (const [name, answer] of Object.entries(cases)) {
    const batch = await readCoachNutrition(fakeClient(answer), readContext)
    assert.equal(batch.complete, false, name)
    assert.notEqual(batch.state, 'ready', name)
    assert.equal(coachHomeModel(coachProps(readContext, batch), day).nutrition.size, 0, name)
  }
})

// Runde 2 (K-ENTROPI2-KOSTKOBLING1 fund 1): afkortede mål må aldrig erklæres komplette.
const manyIds = n => Array.from({ length: n }, (_, i) => `syn-${String(i).padStart(4, '0')}`)
const lastMeals = id => ['2026-10-27', '2026-10-28', '2026-10-30', day].map((date, i) =>
  ({ id: `syn-last-${i}`, athlete_id: id, date, meal: 'Syntetisk måltid', kcal: 2000, protein: 120 }))
const manyProps = (ids, batch) => ({ ...coachProps({ coachId: 'syn-coach', day, athleteIds: ids }, batch),
  athletes: ids.map(id => ({ id, name: id })) })

test("COACH R2: 1001 scope-id'er med fejlfrit, afkortet målsvar giver ingen linje", async () => {
  const ids = manyIds(COACH_NUTRITION_CAP + 1), last = ids[ids.length - 1]
  // Serveren afkorter uden fejl til de første 1000 målrækker; den sidste atlet mangler.
  const client = fakeClient({ meal_logs: { data: lastMeals(last), error: null },
    athletes: { data: ids.slice(0, COACH_NUTRITION_CAP).map(id => ({ id, kcal_target: 2400, protein_target: 150 })), error: null } })
  const batch = await readCoachNutrition(client, { coachId: 'syn-coach', day, athleteIds: ids })
  assert.equal(batch.complete, false)
  assert.equal(batch.state, 'partial')
  assert.equal(batch.rows, undefined); assert.equal(batch.targets, undefined)
  assert.equal(coachHomeModel(manyProps(ids, batch), day).nutrition.size, 0)
})

test('COACH R2: målhentningen har samme cap som måltiderne, og fejl eller kast i mål giver ingen linje', async () => {
  const client = fakeClient(answers())
  await readCoachNutrition(client, context())
  const target = client.calls.find(c => c.table === 'athletes')
  assert.deepEqual(target.ops.find(op => op[0] === 'limit'), ['limit', COACH_NUTRITION_CAP])
  const readContext = context()
  for (const [name, athletesAnswer] of [['mål-kast', new Error('syn')], ['mål-uden-array', { data: { id: 'syn-a' }, error: null }],
    ['mål-cap', { data: manyIds(COACH_NUTRITION_CAP).map(id => ({ id, kcal_target: 1, protein_target: 1 })), error: null }]]) {
    const batch = await readCoachNutrition(fakeClient({ ...answers(), athletes: athletesAnswer }), readContext)
    assert.equal(batch.complete, false, name)
    assert.notEqual(batch.state, 'ready', name)
    assert.equal(coachHomeModel(coachProps(readContext, batch), day).nutrition.size, 0, name)
  }
})

test("COACH R2: kontrol under cap: 999 scope-id'er med alle mål giver stadig én linje", async () => {
  const ids = manyIds(COACH_NUTRITION_CAP - 1), last = ids[ids.length - 1]
  const client = fakeClient({ meal_logs: { data: lastMeals(last), error: null },
    athletes: { data: ids.map(id => ({ id, kcal_target: 2400, protein_target: 150 })), error: null } })
  const batch = await readCoachNutrition(client, { coachId: 'syn-coach', day, athleteIds: ids })
  assert.equal(batch.complete, true)
  const lines = coachHomeModel(manyProps(ids, batch), day).nutrition
  assert.equal(lines.size, 1)
  assert.match(lines.get(last).text, /Mål: 2400 kcal \/ 150 g protein/)
})

test('COACH: ingen læsning med flaget slukket, uden klient eller uden gyldig kontekst', async () => {
  const client = fakeClient(answers())
  const seen = []
  for (const input of [{ enabled: false, client, readContext: context() }, { enabled: 'true', client, readContext: context() },
    { enabled: true, client: null, readContext: context() }, { enabled: true, client, readContext: undefined },
    { enabled: true, client, readContext: { ...context(), coachId: '' } }, { enabled: true, client, readContext: { ...context(), day: 'x' } }])
    assert.equal(startCoachNutritionRead(input, value => seen.push(value)), undefined)
  await flush()
  assert.equal(client.calls.length, 0)
  assert.deepEqual(seen, [])
  // Tændt: ét afleveret svar; efter annullering afleveres intet.
  const readContext = context()
  const cancel = startCoachNutritionRead({ enabled: true, client, readContext }, value => seen.push(value))
  await flush(); await flush()
  assert.equal(seen.length, 1); assert.equal(seen[0].context, readContext)
  const cancelled = startCoachNutritionRead({ enabled: true, client, readContext }, value => seen.push(value))
  cancelled(); await flush(); await flush()
  assert.equal(seen.length, 1)
  cancel()
})

test('COACH: Dashboard binder kostlæsningen til flaget, supabase-klienten og samme readContext', () => {
  const source = read('../Dashboard.jsx')
  assert.match(source, /const e2CoachNutrition = useEntropi2CoachNutrition\(\{ enabled: e2, client: supabase, readContext: e2ReadContext \}\)/)
  assert.match(source, /coachNutrition=\{e2CoachNutrition\}\n {10}readContext=\{e2ReadContext\} \/>/)
  assert.match(source, /\{e2 && \(view === 'inbox' \|\| view === 'list'\) && \(\n {10}<CoachScreen enabled=\{true\}/)
})

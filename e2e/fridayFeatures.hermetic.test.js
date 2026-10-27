import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './fridayHermeticLoader.mjs'
install()
const { fridayTestEnabled } = await import('../src/e2eTestFlags.mjs')
const { default: MobilitetFokus } = await import('../src/athlete/MobilitetFokus.jsx')
const { mount, button, text, nodes, createElement: h } = await import('../src/athlete/mobilityDom.mjs')
const { renderMobilityShortcut, DEFAULT_MOBILITY_FOCUS } = await import('../src/athlete/mobilityFocus.mjs')
const { renderAnalyseSamlet, analyseDemoSelection, analyseSamletEnabled } = await import('../src/dashboard/analyseSamlet.mjs')
const { createCopyDraft, sendCopyDraft, validateCopyDraft, DEFAULT_COACH_PLAN_COPY, sessionDate } = await import('../src/dashboard/coachPlanCopy.mjs')
const { summarizeCoachMessages, coachInboxCompletionStatus } = await import('../src/coachInboxState.js')
const { buildCoachPriorityItems, coachPriorityFocus, coachPriorityQueueContext } = await import('../src/coachPriority.js')
const { COACH_NOTE_SIGNAL_ENABLED } = await import('../src/coachNoteSignal.js')
const { buildFridaySeed, FRIDAY_CASES, featureUrl, MESSAGE_ONE, MESSAGE_TWO } = await import('./fridayFeatures.test.js')
const { main, runFridaySuite, FRIDAY_FLOWS } = await import('./fridayFeatures-run.mjs')
const { ATHLETE_ID, WEEK_ID } = await import('./fixtures.mjs')

test('default OFF og kun entydigt lokalt e2e-tilvalg', () => {
  assert.equal(DEFAULT_MOBILITY_FOCUS, false)
  assert.equal(DEFAULT_COACH_PLAN_COPY, false)
  assert.equal(COACH_NOTE_SIGNAL_ENABLED, false)
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(fridayTestEnabled('e2e', `http://${host}:5185/?appE2E2=1`), true)
  for (const mode of [undefined, '', 'production', 'development', 'test']) assert.equal(fridayTestEnabled(mode, 'http://localhost/?appE2E2=1'), false)
  for (const href of ['', 'x', 'https://localhost/?appE2E2=1', 'http://localhost/', 'http://localhost/?appE2E2=true',
    'http://localhost/?appE2E2=1&appE2E2=1', 'http://localhost/?appE2E2=0&appE2E2=1',
    'http://localhost.example/?appE2E2=1', 'http://user@localhost/?appE2E2=1']) assert.equal(fridayTestEnabled('e2e', href), false, href)
  assert.equal(analyseSamletEnabled(''), false)
  assert.equal(analyseSamletEnabled('?analyseSamlet=1&analyseSamlet=1'), false)
  assert.equal(analyseSamletEnabled('?analyseSamlet=1'), true)
})

test('seeds isolerer kopimaalet, bevarer soendag og laver friske raekker', () => {
  for (const c of FRIDAY_CASES) {
    const seed = buildFridaySeed(c, 'copy')
    assert.equal(seed.tables.weeks.length, 1)
    assert.equal(seed.tables.weeks[0].start_date, c.monday)
    assert.equal(seed.tables.sessions[0].weekday, 6)
    const week = buildFridaySeed(c, 'week')
    assert.equal(week.tables.weeks.length, 2)
    assert.equal(week.tables.weeks[1].start_date, c.next)
    seed.tables.exercises[0].name = 'Aendret'
    assert.equal(buildFridaySeed(c, 'copy').tables.exercises[0].name, 'Squat')
  }
  assert.throws(() => buildFridaySeed(FRIDAY_CASES[0], 'unknown'))
  assert.throws(() => featureUrl('https://example.com'))
  assert.equal(new URL(featureUrl('http://localhost:5185/?old=1', false)).search, '')
  assert.equal(fridayTestEnabled('e2e', featureUrl('http://localhost:5185')), true)
})

test('mobilitet: rigtig komponent gennem valg, tilbage, afslut og nulstilling', () => {
  const exercises = ['ds-mob-2', 'ds-mob-1', 'ds-mov-1'].map((id, i) => ({ id, name: `Syntetisk oevelse ${i + 1}`, label: '5 rolige reps', desc: 'Syntetisk instruktion' }))
  const library = { 'Dødløft — Sumo': [{ options: exercises }] }
  const app = mount(MobilitetFokus, { library, warmupTemplates: [], onExit() {} })
  let tree = app.render()
  button(tree, 'Dødløft').props.onClick()
  tree = app.render()
  button(tree, 'Plads i sumostilling').props.onClick()
  tree = app.render()
  assert.equal(button(tree, 'Plads i sumostilling').props['aria-pressed'], true)
  assert.match(text(tree), /3 øvelser til dødløft/)
  button(tree, 'Start min rutine').props.onClick()
  tree = app.render()
  assert.match(text(tree), /1 af 3/)
  button(tree, 'Næste øvelse').props.onClick()
  tree = app.render()
  assert.match(text(tree), /2 af 3/)
  button(tree, 'Forrige øvelse').props.onClick()
  tree = app.render()
  assert.match(text(tree), /1 af 3/)
  for (let i = 0; i < 2; i++) { button(tree, 'Næste øvelse').props.onClick(); tree = app.render() }
  button(tree, 'Afslut rutinen').props.onClick()
  tree = app.render()
  assert.match(text(tree), /Klar til næste skridt/)
  button(tree, 'Vælg nyt fokus').props.onClick()
  tree = app.render()
  assert.equal(button(tree, 'Start min rutine').props.disabled, false)
  button(tree, 'Bænkpres').props.onClick()
  assert.equal(button(app.render(), 'Start min rutine').props.disabled, true)
})

test('mobilitetsgenvej kraever true og korrekt side; rigtig handler navigerer', () => {
  const calls = []
  const props = { enabled: true, tab: 'hjem', enkelOn: false, setMobilityMode: value => calls.push(value), setTab: value => calls.push(value) }
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(renderMobilityShortcut(h, { ...props, enabled }), null)
  assert.equal(renderMobilityShortcut(h, { ...props, tab: 'program' }), null)
  assert.equal(renderMobilityShortcut(h, { ...props, enkelOn: true, route: 'uge' }), null)
  button(renderMobilityShortcut(h, props), 'Åbn mobilitet').props.onClick()
  assert.deepEqual(calls, ['fokus', 'mobilisering'])
})

test('samlet analyse: historik, baselinegraense, manglende maaling og tomt loeft', () => {
  let lift = 'squat', selectedId = null
  const render = () => renderAnalyseSamlet(h, { lift, selectedId, chooseLift: value => { lift = value; selectedId = null }, chooseAnalysis: value => { selectedId = value } })
  let tree = render()
  assert.equal(nodes(tree, node => node.type === 'section').length, 6)
  assert.match(text(tree), /demo-squat-2/)
  assert.match(text(tree), /Eksempelbaseline: 0,46/)
  button(tree, '2026-10-16 · Squat · Godkendt').props.onClick()
  tree = render()
  assert.match(text(tree), /demo-squat-1/)
  assert.match(text(tree), /Utilstrækkeligt grundlag/)
  const select = () => nodes(render(), node => node.type === 'select')[0]
  select().props.onChange({ target: { value: 'bench' } })
  assert.match(text(render()), /demo-bench-1/)
  assert.match(text(render()), /Ikke målt/)
  select().props.onChange({ target: { value: 'deadlift' } })
  assert.match(text(render()), /Ingen analyser for dette løft/)
  assert.equal(nodes(render(), node => node.type === 'button').length, 0)
  assert.equal(analyseDemoSelection('deadlift', 'demo-squat-2').selected, null)
  select().props.onChange({ target: { value: 'squat' } })
  assert.match(text(render()), /demo-squat-2/)
})

function nestedWeek(c) {
  const seed = buildFridaySeed(c, 'copy')
  return { ...seed.tables.weeks[0], sessions: seed.tables.sessions.map(session => ({ ...session,
    exercises: seed.tables.exercises.filter(ex => ex.session_id === session.id).map(ex => ({ ...ex, athlete_comment: 'Maa ikke kopieres' })) })) }
}
function database(failTable) {
  const rows = { weeks: [], sessions: [], exercises: [] }, calls = []
  return { rows, calls, from(table) {
    return { insert(value) {
      calls.push(['insert', table, structuredClone(value)])
      const result = failTable === table ? { error: { message: 'Syntetisk fejl' } }
        : { data: { id: `${table}-${rows[table].length + 1}`, ...structuredClone(value) }, error: null }
      if (!result.error) rows[table].push(result.data)
      return { select() { return { single: async () => result } }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) } }
    }, delete() {
      const filters = []
      return { eq(key, value) { filters.push([key, value]); return this }, then(resolve, reject) {
        calls.push(['delete', table, filters])
        rows[table] = rows[table].filter(row => !filters.every(([key, value]) => row[key] === value))
        return Promise.resolve({ error: null }).then(resolve, reject)
      } }
    } }
  } }
}

test('kopi: rigtig send-handler bevarer kilde og kopierer kun programfelter', async () => {
  for (const c of FRIDAY_CASES) {
    const source = nestedWeek(c), before = structuredClone(source)
    const draft = createCopyDraft(source, ATHLETE_ID)
    draft.sessions[0].title = 'Redigeret kladde'
    draft.sessions[0].exercises[0].recommended_weight = '82,5'
    assert.equal(draft.start_date, c.next)
    assert.equal(sessionDate(draft, draft.sessions[0]), new Date(Date.parse(c.next) + 6 * 86400000).toISOString().slice(0, 10))
    const db = database()
    assert.equal(db.calls.length, 0)
    const id = await sendCopyDraft(db, draft, [source], ATHLETE_ID)
    assert.equal(db.rows.weeks[0].id, id)
    assert.equal(db.rows.weeks[0].week_number, 2)
    assert.equal(db.rows.sessions[0].title, 'Redigeret kladde')
    assert.equal(db.rows.exercises[0].recommended_weight, 82.5)
    assert.equal(db.rows.exercises[0].athlete_comment, undefined)
    assert.equal(db.rows.exercises[0].athlete_id, undefined)
    assert.deepEqual(source, before)
    const count = db.calls.length
    await assert.rejects(sendCopyDraft(db, draft, [...db.rows.weeks, source], ATHLETE_ID), /findes allerede/)
    assert.equal(db.calls.length, count)
  }
})

test('kopi: konflikt og forkert atlet skriver intet; fejl kalder afgraenset rollback', async () => {
  const source = nestedWeek(FRIDAY_CASES[0])
  assert.throws(() => createCopyDraft(source, 'anden-atlet'), /anden atlet/)
  const draft = createCopyDraft(source, ATHLETE_ID)
  const db = database('exercises')
  await assert.rejects(sendCopyDraft(db, draft, [source], 'anden-atlet'), /anden atlet/)
  assert.equal(db.calls.length, 0)
  assert.match(validateCopyDraft({ ...draft, week_number: 1 }, [source], ATHLETE_ID), /findes allerede/)
  await assert.rejects(sendCopyDraft(db, draft, [source], ATHLETE_ID), /Syntetisk fejl/)
  assert.equal(db.rows.weeks.length, 0)
  assert.deepEqual(db.calls.at(-1), ['delete', 'weeks', [['id', 'weeks-1'], ['athlete_id', ATHLETE_ID]]])
})

test('APP-COACH3/4: laest note bliver, svar rydder kun eget spor', () => {
  const seed = buildFridaySeed(FRIDAY_CASES[0], 'inbox')
  const messages = seed.tables.messages
  const queue = () => {
    const summary = summarizeCoachMessages([...messages].sort((a, b) => b.created_at.localeCompare(a.created_at)), { noteSignalEnabled: true })
    return buildCoachPriorityItems({ athletes: seed.tables.athletes, trainingSignals: [], ...summary, noteSignalEnabled: true,
      videoReviewQueue: [], describeVideo: () => '' })
  }
  assert.deepEqual(queue().map(item => item.detail), [MESSAGE_ONE, MESSAGE_TWO])
  assert.equal(coachPriorityFocus(queue()).remainingCount, 1)
  messages[0].read_by_coach = true
  assert.equal(queue().length, 2)
  assert.equal(coachPriorityQueueContext(queue(), queue()[0].key).remainingCount, 1)
  messages.push({ id: 'reply-1', athlete_id: ATHLETE_ID, category: 'besked', sender_role: 'coach', content: 'Svar', created_at: FRIDAY_CASES[0].now })
  assert.equal(queue().length, 1)
  assert.equal(queue()[0].detail, MESSAGE_TWO)
  messages.push({ id: 'reply-2', athlete_id: ATHLETE_ID, category: 'teknik', sender_role: 'coach', content: 'Svar', created_at: FRIDAY_CASES[0].now })
  assert.equal(queue().length, 0)
  assert.equal(coachInboxCompletionStatus({ refreshStatus: { kind: 'success' } }), 'complete')
  assert.equal(coachInboxCompletionStatus({ refreshStatus: { kind: 'partial' } }), 'unavailable')
})

test('runner er OFF uden --run-e2e og indlaeser ingen runtime', async () => {
  let loaded = 0
  assert.equal(await main([], async () => { loaded++; throw new Error('Maa ikke indlaeses') }), false)
  assert.equal(loaded, 0)
  assert.equal(FRIDAY_FLOWS.length, 7)
})

function runtime({ failLaunch = false, failContextClose = false } = {}) {
  const calls = [], seeds = []
  let onError
  return { calls, seeds, fireError: () => onError(new Error('Syntetisk browserfejl')), deps: {
    APP_URL: 'http://127.0.0.1:5185/', MOCK_PORT: 8991,
    startVite: async () => { calls.push('vite'); return { stop: async () => calls.push('vite-close') } },
    launchBrowser: async () => { calls.push('browser'); if (failLaunch) throw new Error('launch'); return {
      close: async () => calls.push('browser-close'),
      newContext: async options => { calls.push(options.viewport.width); return {
        close: async () => { calls.push('context-close'); if (failContextClose) throw new Error('close') },
        newPage: async () => ({ clock: { setFixedTime: async date => calls.push(date.toISOString()) }, on: (event, callback) => { assert.equal(event, 'pageerror'); onError = callback } }),
      } },
    } },
    createMockSupabase: seed => { seeds.push(seed); return {
      listen: async port => { assert.equal(port, 8991); calls.push('listen') }, close: async () => calls.push('mock-close'), table: name => seed.tables[name],
    } },
  } }
}

test('runner isolerer hver mock og returnerer stabile foer-billeder', async () => {
  const fake = runtime(), reports = []
  await runFridaySuite(fake.deps, { cases: [FRIDAY_CASES[0]], flows: [['copy', async (page, { read }) => {
    const before = await read('weeks')
    fake.seeds.at(-1).tables.weeks[0].block_name = 'Mutation'
    assert.equal(before[0].block_name, 'Base')
  }, 1280], ['week', async () => {}, 390]], report: value => reports.push(value) })
  assert.equal(fake.seeds.length, 2)
  assert.notEqual(fake.seeds[0], fake.seeds[1])
  assert.equal(reports.length, 2)
  assert.deepEqual(fake.calls.slice(-4), ['context-close', 'mock-close', 'browser-close', 'vite-close'])
})
for (const failure of ['flow', 'pageerror', 'context-close', 'launch']) test(`runner rydder op ved ${failure}`, async () => {
  const fake = runtime({ failLaunch: failure === 'launch', failContextClose: failure === 'context-close' })
  await assert.rejects(runFridaySuite(fake.deps, { cases: [FRIDAY_CASES[0]], flows: [['copy', async () => {
    if (failure === 'flow') throw new Error('flow')
    if (failure === 'pageerror') fake.fireError()
  }, 390]], report() {} }))
  assert.equal(fake.calls.at(-1), 'vite-close')
  if (failure !== 'launch') {
    assert.ok(fake.calls.includes('mock-close'))
    assert.ok(fake.calls.includes('browser-close'))
  }
})

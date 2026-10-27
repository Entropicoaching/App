import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import { jsx } from './rel3Jsx.mjs'
import { install } from './release3-loader.mjs'
install()
const { release3TestFlags } = await import('./release3TestFlags.mjs')
const { default: TemplateMessage } = await import('./CoachTemplateMessage.jsx')
const { createCoachTemplateSender, readCoachTemplates, COACH_TEMPLATE_MESSAGES_ENABLED } = await import('./coachTemplateMessages.mjs')
const { createElement: h, mount, button, field, text, nodes } = await import('./rel3Dom.mjs')
const { nextTrainingHome, renderNextTrainingHome, DEFAULT_NEXT_TRAINING_HOME } = await import('./nextTrainingHome.mjs')
const { fokusModel } = await import('./fremgangFokusModel.mjs')
const { isMeetDay, DEFAULT_STAEVNEDAG_FOKUS } = await import('./staevnedagFocus.mjs')
const { meetPlan, finalizeDraft } = await import('./staevnedagPlan.mjs')
const { coachRydEnabled, CoachFold, ProfileActions } = await import('./coachRyd.mjs')
const { CASES, FLOWS, QUESTION, TEMPLATE, REPLY, buildRelease3Seed, releaseUrl, snapshot, waitReply } = await import('./release3Flows.test.js')
const { main, runRelease3Suite } = await import('./release3-run.mjs')
const { ATHLETE_ID, COACH_USER } = await import('./fixtures.mjs')
const nestedWeek = seed => seed.tables.weeks.map(week => ({ ...week, sessions: seed.tables.sessions
  .filter(s => s.week_id === week.id).map(s => ({ ...s, exercises: seed.tables.exercises.filter(e => e.session_id === s.id) })) }))

test('kun entydigt lokalt e2e-tilvalg, default OFF og ingen flaglaek', () => {
  for (const mode of ['production', 'development', 'test', '', undefined]) {
    assert.deepEqual(release3TestFlags(mode, 'http://localhost/?appRel3=1'), { athlete: {}, coach: {} })
  }
  for (const suffix of ['', '?appRel3=0', '?appRel3=true', '?appRel3=1&appRel3=1', '?appRel3=0&appRel3=1']) {
    assert.deepEqual(release3TestFlags('e2e', 'http://localhost/' + suffix), { athlete: {}, coach: {} })
  }
  for (const url of ['https://localhost/?appRel3=1', 'http://localhost.evil/?appRel3=1', 'http://u:p@localhost/?appRel3=1', 'x']) {
    assert.deepEqual(release3TestFlags('e2e', url), { athlete: {}, coach: {} })
  }
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const flags = release3TestFlags('e2e', releaseUrl(`http://${host}:5185/`, true, true))
    assert.deepEqual(flags.athlete, { fremgangFokus: true, naesteTraening: true, staevnedagFokus: true })
    assert.deepEqual(flags.coach, { coachTemplateMessages: true })
  }
  assert.equal(DEFAULT_NEXT_TRAINING_HOME, false)
  assert.equal(DEFAULT_STAEVNEDAG_FOKUS, false)
  assert.equal(COACH_TEMPLATE_MESSAGES_ENABLED, false)
  assert.equal(coachRydEnabled(''), false)
  assert.equal(coachRydEnabled('?coachRyd=1&coachRyd=1'), false)
  assert.throws(() => releaseUrl('https://example.test/'))
  assert.equal(new URL(releaseUrl('http://localhost/?appRel3=1&coachRyd=1#x', false)).search, '')
})

test('hviledag og vintertid: faktisk model og DOM med rigtig Program-handler', () => {
  for (const c of CASES) {
    const seed = buildRelease3Seed(c, 'home'), weeks = nestedWeek(seed)
    const props = { enabled: true, allWeeks: weeks, currentWeek: weeks[0], exerciseLogs: [], now: new Date(c.now) }
    const model = nextTrainingHome(props)
    assert.equal(model.kind, 'next')
    assert.equal(model.date, c.next)
    assert.deepEqual(model.exercises, [{ name: 'Squat', sets: 4 }])
    let opened = 0
    const tree = renderNextTrainingHome(h, model, () => opened++)
    assert.match(text(tree), /REL3 naeste pas/)
    button(tree, 'Se Program').onClick()
    assert.equal(opened, 1)
    assert.equal(nextTrainingHome({ ...props, enabled: false }), null)
    const day = new Date(c.next + 'T11:00:00Z')
    assert.equal(nextTrainingHome({ ...props, now: day }), null, 'Traeningsdag skal bevare dagens logger')
  }
})

test('fremgang: faktiske importer af model, ingen dubletter og skip-modproeve', () => {
  for (const c of CASES) {
    const seed = buildRelease3Seed(c, 'progress'), weeks = nestedWeek(seed)
    const props = { currentWeek: weeks[0], allWeeks: weeks, exerciseLogs: seed.tables.exercise_logs,
      fremgangLogs: seed.tables.exercise_logs, weightLogs: [] }
    const model = fokusModel(props)
    assert.equal(model.completed, 1)
    assert.equal(model.lifts.find(row => row.key === 'squat').points.length, 1)
    assert.deepEqual(model.weights, [])
    assert.equal(fokusModel({ ...props, exerciseLogs: [{ ...props.exerciseLogs[0], skipped: true }] }).completed, 0)
    assert.equal(fokusModel({ ...props, exerciseLogs: [] }).completed, 0, 'Fortrudt lokalt saet kommer ikke tilbage fra historik')
  }
})

test('staevne: rigtig dagsgate og lokal kladde, dato uden for dagen afvises', () => {
  for (const c of CASES) {
    const seed = buildRelease3Seed(c, 'meet'), before = structuredClone(seed)
    assert.equal(isMeetDay(true, c.day, new Date(c.now)), true)
    assert.equal(isMeetDay(false, c.day, new Date(c.now)), false)
    assert.equal(isMeetDay(true, '2026-10-24', new Date(c.now)), false)
    const attempts = { squat: [{ w: 100 }], bench: [{ w: 60 }], deadlift: [{ w: 120 }] }
    const plan = meetPlan(attempts, 'sbd')
    assert.equal(plan.length, 3)
    const draft = structuredClone(plan[0].sets)
    draft[0].weight = '22.5'
    assert.equal(finalizeDraft(draft, 100).ok, true)
    draft[0].weight = '1001'
    assert.equal(finalizeDraft(draft, 100).ok, false)
    assert.deepEqual(seed, before)
  }
})

test('coachoprydning: faktiske fold og Plan/Log/Svar-handlere', () => {
  const fold = CoachFold({ enabled: true, title: 'Opgaver på forsiden', children: h('p', null, QUESTION) })
  assert.equal(fold.type, 'details')
  assert.equal(Object.hasOwn(fold.props, 'open'), false)
  const destinations = []
  const tree = ProfileActions({ go: value => destinations.push(value), athlete: { name: 'Testatlet' }, activeTab: 'log' })
  assert.equal(button(tree, 'Log')['aria-pressed'], true)
  for (const label of ['Plan', 'Log', 'Svar']) button(tree, label).onClick()
  assert.deepEqual(destinations, ['program', 'log', 'beskeder'])
})

test('skabelon: rigtig komponent, storage og afsendelseshandler, kasser/reload/dobbelttryk', async () => {
  const values = new Map(), stored = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const messages = []
  let finish
  const sender = createCoachTemplateSender({ enabled: true,
    getScope: () => ({ enabled: true, coachId: COACH_USER.id, athletes: [{ id: ATHLETE_ID }] }),
    database: { from(name) { assert.equal(name, 'messages'); return { insert(row) {
      messages.push(row); return new Promise(resolve => { finish = () => resolve({ error: null }) })
    } } } } })
  const props = { coachId: COACH_USER.id, athlete: { id: ATHLETE_ID, name: 'Testatlet' }, storage: () => stored, sendMessage: sender }
  const app = mount(TemplateMessage, props)
  button(app.render(), 'Skabelonbesked til Testatlet').onClick()
  field(app.render(), 'Skabelonnavn').onChange({ target: { value: 'REL3 tempo' } })
  field(app.render(), 'Skabelontekst').onChange({ target: { value: TEMPLATE } })
  button(app.render(), 'Gem skabelon').onClick()
  assert.equal(readCoachTemplates(stored, COACH_USER.id).length, 1)
  assert.deepEqual(readCoachTemplates(stored, 'anden-coach'), [])
  button(app.render(), 'Brug REL3 tempo').onClick()
  assert.equal(field(app.render(), 'Beskedkladde').value, REPLY)
  button(app.render(), 'Kasser kladde').onClick()
  assert.equal(nodes(app.render(), n => n.props['aria-label'] === 'Beskedkladde').length, 0)
  assert.equal(messages.length, 0)
  const reopened = mount(TemplateMessage, props)
  button(reopened.render(), 'Skabelonbesked til Testatlet').onClick()
  button(reopened.render(), 'Brug REL3 tempo').onClick()
  const send = button(reopened.render(), 'Send').onClick
  const pending = send()
  await send()
  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0], { athlete_id: ATHLETE_ID, sender_role: 'coach', category: 'besked', content: REPLY })
  finish(); await pending
  assert.match(text(reopened.render()), /Beskeden er sendt/)
  assert.equal(readCoachTemplates(stored, COACH_USER.id)[0].text, TEMPLATE)
  await assert.rejects(createCoachTemplateSender({})({ coachId: COACH_USER.id, athleteId: ATHLETE_ID, text: REPLY }))
})

test('scope skift og skrivefejl bevarer kladde uden forkert modtager', async () => {
  let scope = { enabled: true, coachId: COACH_USER.id, athletes: [{ id: ATHLETE_ID }] }, calls = 0
  const sender = createCoachTemplateSender({ enabled: true, getScope: () => scope,
    database: { from() { return { async insert() { calls++; return { error: Error('syntetisk afvisning') } } } } } })
  const args = { coachId: COACH_USER.id, athleteId: ATHLETE_ID, text: REPLY }
  scope = { ...scope, athletes: [] }
  await assert.rejects(sender(args)); assert.equal(calls, 0)
  scope = { ...scope, athletes: [{ id: ATHLETE_ID }] }
  await assert.rejects(sender(args)); assert.equal(calls, 1)
  const storage = { getItem: () => JSON.stringify([{ name: 'REL3', text: TEMPLATE }]) }
  const app = mount(TemplateMessage, { coachId: COACH_USER.id, athlete: { id: ATHLETE_ID, name: 'Testatlet' }, storage: () => storage, sendMessage: sender })
  button(app.render(), 'Skabelonbesked til Testatlet').onClick()
  button(app.render(), 'Brug REL3').onClick()
  await button(app.render(), 'Send').onClick()
  assert.equal(field(app.render(), 'Beskedkladde').value, REPLY)
  assert.match(text(app.render()), /Beskeden blev ikke sendt/)
})

test('seed og assertions: uafhaengige kopier og forkert modtager/dublet afvises', async () => {
  const seed = buildRelease3Seed(CASES[0], 'templates')
  seed.tables.messages[0].content = 'forkert'
  assert.equal(buildRelease3Seed(CASES[0], 'templates').tables.messages[0].content, QUESTION)
  assert.throws(() => buildRelease3Seed({}, 'home'))
  assert.throws(() => buildRelease3Seed(CASES[0], 'ukendt'))
  const row = { id: 'ny', athlete_id: ATHLETE_ID, sender_role: 'coach', category: 'besked', content: REPLY }
  await waitReply(async () => [row], [])
  await assert.rejects(waitReply(async () => [{ ...row, athlete_id: 'anden' }], []))
  await assert.rejects(waitReply(async () => [row, { ...row, id: 'dublet' }], []))
  const copy = await snapshot(async () => seed.tables.messages)
  seed.tables.messages[0].content = 'ny mutation'
  assert.equal(copy.messages[0].content, 'forkert')
})

test('runner er OFF uden tilvalg og rydder syntetiske ressourcer efter fejl', async () => {
  let loaded = 0
  assert.equal(await main([], async () => { loaded++; throw Error('maa ikke kaldes') }), false)
  assert.equal(loaded, 0)
  for (const stage of ['listen', 'context', 'flow', 'success']) {
    const closed = []
    const runtime = {
      APP_URL: 'http://127.0.0.1:5185', MOCK_PORT: 8991,
      async startVite() { return { async stop() { closed.push('vite') } } },
      async launchBrowser() { return { async close() { closed.push('browser') }, async newContext() {
        if (stage === 'context') throw Error('context')
        return { async close() { closed.push('context') }, async newPage() {
          return { clock: { async setFixedTime() {} }, on() {} }
        } }
      } } },
      createMockSupabase() { return { async listen() { if (stage === 'listen') throw Error('listen') }, async close() { closed.push('mock') }, table() { return [] } } },
    }
    const action = () => runRelease3Suite(runtime, { cases: [CASES[0]], flows: [['home', async () => { if (stage === 'flow') throw Error('flow') }, 390]], report() {} })
    if (stage === 'success') await action()
    else await assert.rejects(action())
    assert.deepEqual(closed, ['listen', 'context'].includes(stage) ? ['mock', 'browser', 'vite'] : ['context', 'mock', 'browser', 'vite'])
  }
  assert.deepEqual(FLOWS.map(row => row[0]), ['off', 'progress', 'meet', 'home', 'coach', 'templates'])
})

test('FS kontrol: flag er koblet til begge atletgrene og coach, uden linjeslutkrav', () => {
  const flat = new URL('./App.jsx', import.meta.url)
  let app
  try { app = readFileSync(flat, 'utf8') } catch { app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8') }
  for (const source of [app.replace(/\r\n/g, '\n'), app.replace(/\r?\n/g, '\r\n')]) {
    assert.equal((source.match(/\.\.\.rel3\.athlete/g) || []).length, 2)
    assert.equal((source.match(/\.\.\.rel3\.coach/g) || []).length, 1)
    assert.equal((source.match(/fremgangFokus === true \|\| rel3\.athlete\.fremgangFokus === true/g) || []).length, 2)
    assert.match(source, /release3TestFlags\(import\.meta\.env\.MODE/)
    const compiled = jsx(source).replace(/^import .* from .*$/gm, '')
      .replace(/export default App/g, '').replace(/import\.meta/g, 'syntheticMeta')
    assert.doesNotThrow(() => new Script(compiled), 'Hele App-kandidaten kan parses efter den pinnede JSX-adapter')
  }
})

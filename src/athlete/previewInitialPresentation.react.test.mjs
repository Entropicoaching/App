import { registerHooks } from 'node:module'
import { checkAthleteSyntax } from './selectionHarness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { withoutU2 } from './u2AthleteViewLine.mjs'
import { withoutU3 } from './u3AthleteViewLine.mjs'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { dispose, renderScenario, scenario, tabs } from './samletProeveFixture.mjs'
import { assertCleanMarkup, assertNoWriteButtons } from './samletProeveMarkup.mjs'
import { fixture, find, deferred } from '../entropi2/conversation/accessibilityFixture.mjs'
import ConversationEntry, { createEntryFactory } from '../entropi2/conversation/ConversationEntry.mjs'
import Conversation from '../entropi2/conversation/Conversation.mjs'
import HomeSession from '../entropi2/home/HomeSession.mjs'
import { readHomeReadiness } from '../entropi2/home/homeTrackingRead.mjs'
import { readHomeRecordHistory } from '../entropi2/home/homeRecordRead.mjs'
// Read-only seam around the existing fixture's genuine JSX loader. It exposes
// the original internal component only in this test process; product exports,
// imports, business logic and the original syntax oracle remain unchanged.
const hostURL = new URL('../AthleteView.jsx', import.meta.url).href
const previewLoader = registerHooks({
  load(url, context, next) {
    const loaded = next(url, context)
    if (url !== hostURL) return loaded
    assert.equal(loaded.format, 'module')
    assert.equal(typeof loaded.source, 'string')
    assert.match(loaded.source, /function PreviewKost\(props\)/)
    return { ...loaded, source: loaded.source + '\nexport { PreviewKost as __familyPreviewKost };\n' }
  },
})
let PreviewKost
try { ({ __familyPreviewKost: PreviewKost } = await import('../AthleteView.jsx')) }
finally { previewLoader.deregister() }

import { strictDocument } from '../entropi2/nutrition/ugeplan/lifecycle.fixture.mjs'
import { readFileSync } from 'node:fs'
import { invertPreviewInitialPresentation, previewInitialSourceDeltas, invertCoachSelfTraining } from './coachSelfTrainingOffFixture.mjs'

test.after(dispose)
const message = (athleteId, content, id = 'synthetic-message') => ({ id, athlete_id: athleteId,
  sender_role: 'coach', content, created_at: '2026-11-04T10:00:00Z' })
const storage = () => {
  const values = new Map(), writes = []
  return { writes, getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push(key); values.set(key, value) },
    removeItem(key) { writes.push(key); values.delete(key) } }
}
function database(rows = [], gate) {
  const calls = [], writes = []
  return { calls, writes, from(table) {
    const filters = []
    const q = { select() { calls.push(['select', table]); return q },
      eq(key, value) { filters.push(row => row[key] === value); return q },
      gte(key, value) { filters.push(row => row[key] >= value); return q },
      lte(key, value) { filters.push(row => row[key] <= value); return q },
      order() { return q }, range() { return q }, limit() { return q },
      async then(resolve, reject) {
        try { if (gate) await gate.promise; return resolve({ data: table === 'messages' || table === 'meal_logs'
          ? rows.filter(row => filters.every(f => f(row))) : [] }) } catch (error) { return reject(error) }
      },
    }
    for (const verb of ['insert', 'update', 'delete', 'upsert']) q[verb] = (...args) => {
      writes.push([verb, table, args]); assert.fail('No implicit synthetic database write')
    }
    return q
  }, rpc(name) {
    calls.push(['rpc', name]); assert.equal(name, 'get_my_shared_video_analyses_v3')
    return Promise.resolve({ data: [] })
  } }
}
function entryFor(id, client, store) {
  return { enabled: true, athlete: { id, user_id: `owner-${id}` }, session: { user: { id: `owner-${id}` } },
    inboxDatabase: client, storage: () => store, messages: [message(id, `Supplied ${id}`)], sharedVideoAnalyses: [] }
}
async function mounted(run) {
  const f = fixture()
  f.doc.createElementNS = (_ns, tag) => f.doc.createElement(tag)
  f.doc.createTextNode = text => ({ nodeType: 3, nodeName: '#text', nodeValue: String(text), parentNode: null, children: [],
    get textContent() { return this.nodeValue }, set textContent(value) { this.nodeValue = String(value) }, contains(n) { return n === this } })
  const create = f.doc.createElement
  f.doc.createElement = tag => {
    const el = create(tag); el.getAttribute = name => el.attributes[name] ?? null
    el.remove = () => el.parentNode?.removeChild(el)
    Object.defineProperty(el, 'options', { get: () => el.children.filter(n => n.tagName === 'OPTION') })
    return el
  }
  const descriptors = new Map(['window', 'IS_REACT_ACT_ENVIRONMENT'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  Object.defineProperty(globalThis, 'window', { configurable: true, value: f.win })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const root = createRoot(f.host)
  const render = async element => { await act(async () => root.render(element)) }
  try { await run({ ...f, render }) } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
    }
  }
}
// Strict NodeList/parent ownership for the existing imperative nutrition mount.
async function mountedNutrition(run) {
  const doc = strictDocument(), host = doc.createElement('div')
  doc.body.append(host)
  const keys = ['window', 'IS_REACT_ACT_ENVIRONMENT']
  const prior = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const root = createRoot(host)
  try { await run({ host, render: async element => { await act(async () => root.render(element)) } }) }
  finally {
    await act(async () => root.unmount())
    keys.forEach((key, i) => { if (prior[i]) Object.defineProperty(globalThis, key, prior[i]); else delete globalThis[key] })
  }
}
const noWriteControls = host => {
  for (const tag of ['button', 'input', 'textarea', 'select']) for (const el of find(host, tag)) {
    if (tag === 'button') assert.doesNotMatch(el.textContent, /\b(gem|log|send|spring|godkend|upload)\b|film et sæt|start (dagens|næste) pas/i)
    else assert.fail(`Preview exposes ${tag}`)
  }
}

test('family SSR: actual host escapes supplied scoped messages, rejects foreign rows, and never creates capabilities', async () => {
  for (const mode of ['athlete', 'preview', 'own']) {
    const input = scenario(mode, 'beskeder')
    const id = input.seed.athlete.id
    input.seed.messages = [message(id, 'Virkelig <syntetisk> besked & tekst'), message('foreign', 'FOREIGN-TEXT', 'foreign')]
    input.seed.sharedVideoAnalyses = [{ id: 'synthetic-shared', athlete_id: id, status: 'shared',
      athlete_feedback: { focus: [{ text: 'Delt <feedback>' }] } }, { id: 'private', athlete_id: id, status: 'draft',
      athlete_feedback: { focus: [{ text: 'PRIVATE-FEEDBACK' }] } }]
    const html = await renderScenario(input)
    assertCleanMarkup(html); assert.match(html, /Virkelig &lt;syntetisk&gt; besked &amp; tekst/)
    assert.match(html, /Delt &lt;feedback&gt;/); assert.doesNotMatch(html, /FOREIGN-TEXT|PRIVATE-FEEDBACK/)
    if (mode === 'preview') assertNoWriteButtons(html)
  }
  const input = scenario('athlete', 'beskeder')
  input.props.session = { user: { id: 'foreign-owner' } }
  assert.doesNotMatch(await renderScenario(input), /Syntetisk besked fra din coach/)
  for (const tab of ['hjem', 'profil']) {
    const preview = scenario('preview', tab, 'empty', { onboardingDone: false, guideOpen: true })
    // A preview can also be identified by onExitPreview without coachAthleteId.
    preview.props.coachAthleteId = undefined
    const html = await renderScenario(preview); assertNoWriteButtons(html); assertCleanMarkup(html)
    assert.match(html, /Forhåndsvisning/)
  }
})

test('family ReactDOM: original entry/adapters replace initial view once, preserve draft across fetched updates, and clean owner churn', async () => {
  const store = storage(), client = database([message('one', 'Live one'), message('two', 'Live two')])
  let entry = entryFor('one', client, store)
  const ref = { current: null }, getEntry = () => entry
  await mounted(async ({ host, render }) => {
    const view = () => h(StrictMode, null, h(ConversationEntry, { enabled: true, role: 'athlete', getEntry, controllerRef: ref }))
    assert.match(renderToStaticMarkup(view()), /Supplied one/)
    await render(view())
    assert.equal(find(host, 'div').filter(n => Object.hasOwn(n.attributes, 'data-conversation-initial')).length, 0)
    assert.equal(find(host, 'textarea').filter(n => n.attributes['aria-label'] === 'Din besked').length, 1)
    assert.equal(host.textContent.split('Live one').length - 1, 2, 'existing live view contains expanded body and preview')
    assert.doesNotMatch(host.textContent, /Supplied one/)
    const first = ref.current
    await act(async () => first.draft('Bevar <kladde>'))
    entry = { ...entry, messages: [message('one', 'Refetched one')] }
    await render(view())
    assert.equal(ref.current, first); assert.equal(find(host, 'textarea').find(n => n.attributes['aria-label'] === 'Din besked').value, 'Bevar <kladde>')
    assert.deepEqual(client.writes, []); assert.deepEqual(store.writes, [])
    entry = entryFor('two', client, store)
    await render(view())
    assert.notEqual(ref.current, first); assert.equal(first.snapshot().available, false)
    assert.equal(find(host, 'textarea').find(n => n.attributes['aria-label'] === 'Din besked').value, '')
    assert.doesNotMatch(host.textContent, /Live one|Bevar|Supplied one/); assert.match(host.textContent, /Live two/)
    const athleteController = ref.current
    entry = { ...entry, selectedAthlete: entry.athlete, athletes: [entry.athlete], session: { user: { id: 'synthetic-coach' } } }
    await render(h(ConversationEntry, { enabled: true, role: 'coach', getEntry, controllerRef: ref }))
    assert.equal(athleteController.snapshot().available, false)
    assert.equal(ref.current.snapshot().role, 'coach')
    assert.equal(ref.current.snapshot().draft, '')
    assert.deepEqual(client.writes, []); assert.deepEqual(store.writes, [])
    await render(h(ConversationEntry, { enabled: false, role: 'athlete', getEntry: () => assert.fail('OFF host read'), controllerRef: ref }))
    assert.equal(ref.current, null); assert.equal(host.children.length, 0)
  })
})

test('family ReactDOM: preview uses original conversation controller without composer, receipts, storage writes or stale role/owner data', async () => {
  const store = storage(), client = database([message('one', 'Live preview')])
  let entry = entryFor('one', client, store)
  const ref = { current: null }, getEntry = () => entry
  const factory = createEntryFactory({ enabled: true, role: 'athlete', getEntry })
  await mounted(async ({ host, render }) => {
    await render(h(StrictMode, null, h(Conversation, { enabled: true, readOnly: true, createController: factory,
      controllerRef: ref, initial: { athleteId: 'one', messages: entry.messages } })))
    assert.match(host.textContent, /Live preview/); noWriteControls(host)
    assert.equal(host.textContent.split('Live preview').length - 1, 1)
    assert.deepEqual(client.writes, []); assert.deepEqual(store.writes, [])
    const prior = ref.current
    await render(h(Conversation, { enabled: true, createController: factory, controllerRef: ref }))
    assert.equal(prior.snapshot().available, false); assert.equal(find(host, 'textarea').filter(n => n.attributes['aria-label'] === 'Din besked').length, 1)
    entry = entryFor('two', client, store)
    const nextFactory = createEntryFactory({ enabled: true, role: 'athlete', getEntry })
    await render(h(Conversation, { enabled: true, readOnly: true, createController: nextFactory, controllerRef: ref,
      initial: { athleteId: 'two', messages: [message('one', 'FOREIGN'), ...entry.messages] } }))
    noWriteControls(host); assert.doesNotMatch(host.textContent, /Live preview|FOREIGN|Supplied one/)
    assert.match(host.textContent, /Ingen beskeder/)
    await render(h(Conversation, { enabled: false, createController: () => assert.fail('OFF controller'), controllerRef: ref }))
    assert.equal(host.children.length, 0); assert.equal(ref.current, null)
  })
})

test('family ReactDOM: original preview nutrition mount replaces SSR guidance and rejects disposed athlete/date replies', async () => {
  const gate = deferred(), rows = [{ id: 'meal-one', athlete_id: 'one', date: '2026-11-04',
    meal: 'Syntetisk <måltid>', kcal: 500, protein: 30, carb: 50, fat: 20 }]
  const client = database(rows, gate), store = storage(), foods = []
  let props = { enabled: true, athlete: { id: 'one' }, date: '2026-11-04', client, foods,
    weightLogs: [{ athlete_id: 'one', logged_at: '2026-11-04', weight: 80 }], weightStatus: { athleteId: 'one', state: 'ready' } }
  const initial = renderToStaticMarkup(h(PreviewKost, props))
  assert.match(initial, /Henter kostloggen/); assertNoWriteButtons(initial); assertCleanMarkup(initial)
  assert.deepEqual(client.calls, []); assert.deepEqual(store.writes, [])
  await mountedNutrition(async ({ host, render }) => {
    const view = () => h(StrictMode, null, h('fieldset', { disabled: true }, h(PreviewKost, props)))
    await render(view())
    assert.match(host.textContent, /Henter kostloggen/)
    assert.doesNotMatch(host.textContent, /Registrering sker fra atletens egen visning/)
    props = { ...props, athlete: { id: 'two' }, date: '2026-11-05' }
    await render(view())
    await act(async () => gate.resolve())
    assert.doesNotMatch(host.textContent, /Syntetisk <måltid>|80 kg|500 kcal/)
    assert.match(host.textContent, /Ingen måltider registreret/)
    props = { ...props, athlete: { id: 'one' }, date: '2026-11-04' }
    await render(view())
    assert.match(host.textContent, /Syntetisk <måltid>/); assert.match(host.textContent, /500 kcal/)
    assert.doesNotMatch(host.textContent, /Henter kostloggen|Registrering sker fra atletens egen visning/)
    assert.equal(Array.from(host.querySelectorAll('input')).filter(n => n.getAttribute('data-focus') === 'meal-part-0').length, 1)
    assert.deepEqual(client.writes, []); assert.deepEqual(store.writes, [])
    assert.equal(renderToStaticMarkup(h(PreviewKost, { enabled: false, athlete: new Proxy({}, { get() { assert.fail('OFF athlete') } }) })), '')
    const readsBeforeOff = client.calls.length
    props = { enabled: false }
    await render(h(PreviewKost, props))
    assert.equal(client.calls.length, readsBeforeOff); assert.equal(host.children.length, 0)
  })
})

test('family ReactDOM: real HomeSession omits preview onboarding, film/check-in, keeps normal and coach-own actions', async () => {
  const client = database(), store = storage()
  const own = scenario('own', 'hjem')
  const props = { enabled: true, athlete: own.seed.athlete, allWeeks: own.seed.allWeeks,
    currentWeek: own.seed.currentWeek, exerciseLogs: [], storage: store, now: new Date('2026-11-04T12:00:00Z'),
    getNow: () => new Date('2026-11-04T12:00:00Z'), setTab() {}, onLogSet() { assert.fail('hidden set write') },
    setLogInputs() {}, parsePlannedRpe() {}, onFilmSet() {}, logWeight() {}, setWeightInput() {},
    saveReadiness() {}, setReadinessInput() {},
    readHomeReadiness: args => readHomeReadiness({ ...args, client }),
    readHomeRecordHistory: args => readHomeRecordHistory({ ...args, client }) }
  await mounted(async ({ host, render }) => {
    await render(h(StrictMode, null, h(HomeSession, { ...props, readOnly: true, onLogSet: undefined, setLogInputs: undefined })))
    noWriteControls(host)
    assert.match(host.textContent, /Testpas/); assert.match(host.textContent, /Se mit program/)
    for (const coachOwnTraining of [false, true]) {
      await render(h(HomeSession, { ...props, coachOwnTraining }))
      assert.ok(find(host, 'button').some(n => n.textContent === 'Spring over'))
      assert.ok(find(host, 'button').some(n => n.textContent === 'Film et sæt til videocoach' && !n.disabled))
      assert.ok(find(host, 'button').some(n => /^Start (dagens|næste) pas$/.test(n.textContent) && !n.disabled))
      assert.ok(find(host, 'details').some(n => Object.hasOwn(n.attributes, 'data-home-checkin')))
    }
    assert.deepEqual(client.writes, []); assert.deepEqual(store.writes, [])
    await render(h(HomeSession, { enabled: false }))
    assert.equal(host.children.length, 0)
  })
})

// Independently captured from the pinned source before any production edit.
const pinnedOff = {"athlete/hjem/ready":"bb7fe550d9b6418eb8a2c8e9597aceb05e4f6e6366870caf310e483dd01075bd","athlete/hjem/empty":"ffbf6bf6a2a4b027cadf6be3922d76aeb916c925ab2fa4ad21d3bf2a9e5088b2","athlete/program/ready":"8be8623de46f8655e3e23b82b81dcbeafe8ec341e085a58bb94da6e35a2b9bd1","athlete/program/empty":"2b20807eb86df5b6139109aa8d05b58c6d6f55b634443a4d9ac0925584f5fac8","athlete/fremgang/ready":"5887c80802219e66f55d5e5e19503549197702783839bd79cf3090722c3c45ca","athlete/fremgang/empty":"8e53eee632a33c5e6b29cbb4c2929f088876e637a2f7a9b328042d4effa9f9cc","athlete/kost/ready":"c6c289be031bd020e08785c5e8e62c59891304173136fdef1128acf37bcabc86","athlete/kost/empty":"6889ea591f6a750e6f4d4a6af729b890810dd0176976a59d461dc2589e0bceb3","athlete/beskeder/ready":"8d12867f8ba06e20ff2fbb94f1891374103bb70014b02126c080d7da00157722","athlete/beskeder/empty":"fa2ecac7410e0ca916c364ff7cf388dc03984bd5735295144e8341be020dc5c2","athlete/profil/ready":"bb7fe550d9b6418eb8a2c8e9597aceb05e4f6e6366870caf310e483dd01075bd","athlete/profil/empty":"ffbf6bf6a2a4b027cadf6be3922d76aeb916c925ab2fa4ad21d3bf2a9e5088b2","athlete/volumen/ready":"7f2cf767dfb1b1994ba14142497b4c3c0f301fb22686dfc0620c50ef3c1010ee","athlete/volumen/empty":"3565c85d2f931a35ac85db528f6b74dcf2ac8185ad9bb6f13da6941fc1b0bd8e","preview/hjem/ready":"7e9dcfc317771eb0927bc421148390424883b64a07906ec17ecf9fb6fef822cc","preview/hjem/empty":"a227310aaf24ade69317d84a212383b40bacaf18969b696b9159c9c1ff5eb792","preview/program/ready":"999232d38b2f4b19599179cac86b93e97bd4f6d81857a873900553aed0e7a979","preview/program/empty":"b892358a5c6b9d4f2ea1e32d08a23bbe512013040f4fed5e39c2bd3d77ea5b9e","preview/fremgang/ready":"f124cb536d4b2c8f5e0aaa7b788f6819b17e5f89c297720f7a295ed74b9142fe","preview/fremgang/empty":"d805f57fe1611c1199b05ab550f66079741e0c93b6a983c4d8ec9896f0e810bf","preview/kost/ready":"bbaf6c4e44154d880a00d853697557d164b6805c745e2a54334d8efdf48d7320","preview/kost/empty":"89cde472d6483d6403a1d14788672f51e00cfa009669ef5969dd1cede04426a5","preview/beskeder/ready":"37b981e693faaec14f315dcdf0b30eb2473c54f4984e0da235510f5e88ed59ab","preview/beskeder/empty":"5d84019a49d727547a6edbd127107efdf5222d506ba94eb3885eee1dd7cb1c58","preview/profil/ready":"7e9dcfc317771eb0927bc421148390424883b64a07906ec17ecf9fb6fef822cc","preview/profil/empty":"a227310aaf24ade69317d84a212383b40bacaf18969b696b9159c9c1ff5eb792","preview/volumen/ready":"a759638683470c49f726cc99888050b82671e55bb029a50d3398b91c8ddcc9ff","preview/volumen/empty":"db623e3ed6d9f01250d5ef23ac7c6400fa79af158f00fbfc5ebf7a4ba441cc96","own/hjem/ready":"7e9dcfc317771eb0927bc421148390424883b64a07906ec17ecf9fb6fef822cc","own/hjem/empty":"a227310aaf24ade69317d84a212383b40bacaf18969b696b9159c9c1ff5eb792","own/program/ready":"999232d38b2f4b19599179cac86b93e97bd4f6d81857a873900553aed0e7a979","own/program/empty":"b892358a5c6b9d4f2ea1e32d08a23bbe512013040f4fed5e39c2bd3d77ea5b9e","own/fremgang/ready":"f124cb536d4b2c8f5e0aaa7b788f6819b17e5f89c297720f7a295ed74b9142fe","own/fremgang/empty":"d805f57fe1611c1199b05ab550f66079741e0c93b6a983c4d8ec9896f0e810bf","own/kost/ready":"bbaf6c4e44154d880a00d853697557d164b6805c745e2a54334d8efdf48d7320","own/kost/empty":"89cde472d6483d6403a1d14788672f51e00cfa009669ef5969dd1cede04426a5","own/beskeder/ready":"37b981e693faaec14f315dcdf0b30eb2473c54f4984e0da235510f5e88ed59ab","own/beskeder/empty":"5d84019a49d727547a6edbd127107efdf5222d506ba94eb3885eee1dd7cb1c58","own/profil/ready":"7e9dcfc317771eb0927bc421148390424883b64a07906ec17ecf9fb6fef822cc","own/profil/empty":"a227310aaf24ade69317d84a212383b40bacaf18969b696b9159c9c1ff5eb792","own/volumen/ready":"a759638683470c49f726cc99888050b82671e55bb029a50d3398b91c8ddcc9ff","own/volumen/empty":"db623e3ed6d9f01250d5ef23ac7c6400fa79af158f00fbfc5ebf7a4ba441cc96"}

test('family strict OFF: actual original host remains byte-identical for every tab, mode and ready/empty snapshot', async () => {
  for (const mode of ['athlete', 'preview', 'own']) for (const tab of tabs) for (const state of ['ready', 'empty']) {
    const input = scenario(mode, tab, state); input.props.entropi2 = false
    assert.equal(createHash('sha256').update(await renderScenario(input)).digest('hex'), pinnedOff[`${mode}/${tab}/${state}`])
  }
})

// Additional counterexamples selected during the producer's same-engine self-check.
// These do not constitute the separately required fresh K review.
test('family error counterexamples: original nutrition reader rejects foreign/malformed replies without claiming empty success', async () => {
  for (const rows of [[{ athlete_id: 'foreign', date: '2026-11-04', meal: 'FOREIGN' }],
    [{ athlete_id: 'one', date: '2026-11-04', meal: { bad: 'object' }, kcal: null }]]) {
    // This transport deliberately returns its unfiltered reply; the real adapter
    // must enforce scope even when a backend responds to the wrong query.
    const client = { from() {
      const q = { select: () => q, eq: () => q, gte: () => q, lte: () => q, order: async () => ({ data: rows }) }
      return q
    } }
    await mountedNutrition(async ({ host, render }) => {
      await render(h(PreviewKost, { enabled: true, athlete: { id: 'one' }, date: '2026-11-04', client,
        storage: storage(), foods: [], weightStatus: { athleteId: 'one', state: 'error' } }))
      assert.doesNotMatch(host.textContent, /FOREIGN|NaN|undefined|\[object Object\]/)
      assert.match(host.textContent, /Vejningerne kunne ikke hentes/)
      if (rows[0].athlete_id === 'foreign') {
        assert.match(host.textContent, /Kostloggen kunne ikke hentes/)
        assert.doesNotMatch(host.textContent, /Ingen måltider registreret|0 kcal/)
      } else assert.match(host.textContent, /Måltid uden navn/)
    })
  }
})

test('family inversion: each new feature hunk is exact and unrelated legacy mutations remain detectable', () => {
  const source = withoutU3(withoutU2(readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8'))).replace(/\r\n/g, '\n')
  const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex')
  const publicBase = '0c03822be85862e06dcef14a9d664f4e50ccb86f34d6bb8f25a9d7ba4191c612'
  assert.equal(hash(invertPreviewInitialPresentation(source)), publicBase)
  assert.equal(hash(invertPreviewInitialPresentation(source.replace(/\n/g, '\r\n'))), publicBase)
  for (const [added] of previewInitialSourceDeltas) {
    for (const mutant of [source.replace(added, ''), source + added,
      source.replace(added, added.replace(/\w/, 'X'))]) {
      assert.throws(() => invertPreviewInitialPresentation(mutant), /Exact coach self-training \/ preview/)
    }
  }
  const baseline = '6c2deb31ac020fc1ad02e3866e7eeeb74a8bad52b97e44c3b646049df03b9cb8'
  assert.equal(hash(invertCoachSelfTraining(source)), baseline)
  const unrelated = source + '\n// synthetic unrelated legacy change\n'
  assert.notEqual(hash(invertPreviewInitialPresentation(unrelated)), publicBase)
  assert.notEqual(hash(invertCoachSelfTraining(unrelated)), baseline)
})

test('family regression: unchanged original syntax oracle parses the exact parent with internal PreviewKost', () => {
  const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(source, /\nfunction PreviewKost\(props\)/)
  assert.doesNotMatch(source, /export\s+function PreviewKost/)
  assert.equal(typeof checkAthleteSyntax(), 'function')
  assert.equal(typeof PreviewKost, 'function')
})

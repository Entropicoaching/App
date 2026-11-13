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
const pinnedOff = {"athlete/hjem/ready":"0538b3a59a12c7a07591ebfca9e341cd590e3a8a6bdb34e9284e8095a6d8bc8f","athlete/hjem/empty":"91d0687b1105bbb69fd77fca1b00a34babd2f2aeeaf2f132c7a7259fda9dca8a","athlete/program/ready":"815e6d03741e87d46be4ad24e4e0bcbd24d4de8e21d7807334cf657a43f591b2","athlete/program/empty":"80a61a3bbfe1306217361f85c4375eac795a99e88af8f4d4954753f4d931ca73","athlete/fremgang/ready":"b7ff11b47b2819772209c8ef5fe5b2d21fefb00d6040268b8a4fdd2d0c2f37dc","athlete/fremgang/empty":"5ced86e98014e679c3662133f5bc9d2ce102686d67a15af6374f64c75d77e407","athlete/kost/ready":"dd198c738ce3240ff389a49cd2e3b807cbaf64c4ea4fa0ef0ed808b2bca55899","athlete/kost/empty":"ec5466d79e38f907427a02fe4c25246698fee5358137acfb789d16cd1068a000","athlete/beskeder/ready":"4e3deeed3a73ed81e5e26ead26f60dcc430340a661f2f129fefcd1eff464c9a3","athlete/beskeder/empty":"9f8a60e19b0263cd2342ed981100a0823bdbccd395dd328fcc623eec199c4863","athlete/profil/ready":"0538b3a59a12c7a07591ebfca9e341cd590e3a8a6bdb34e9284e8095a6d8bc8f","athlete/profil/empty":"91d0687b1105bbb69fd77fca1b00a34babd2f2aeeaf2f132c7a7259fda9dca8a","athlete/volumen/ready":"82974c2ad073c560c9d21876e867c0d77e3ff675bb58ec9c600015206f479ca8","athlete/volumen/empty":"d8d1a7b26cb934952effcc1806c8604f49925444e3b50ad96dc2ff0acf310ab4","preview/hjem/ready":"ab597d9abe56cf504f0151024d59992f92b52962f69953c18a5840c9123709af","preview/hjem/empty":"29f9fcbef8f9b21afaf5c7f6ac020bc7b762b3e4f5766e99d390179d07bc9a7d","preview/program/ready":"1c60085b7118b0594e07869a9c465e7c263f069a2f1b2052596b9a61cb7ce5b9","preview/program/empty":"407cff5ba35938c08089a7dc86cfd91ddbc54f0eae53575658353a5fd1652897","preview/fremgang/ready":"df0d5007c229b138eb5734ddab9897cf6b76229a244a6b0f1c97e580ab765650","preview/fremgang/empty":"69f1b23191cfaa50635687a1c12b216e245302aa22b32e81dff828269f54a110","preview/kost/ready":"2d920a7d34133bd0bc9b8e1e4fb3840e3fd3fd818558241b242d9430efb825ab","preview/kost/empty":"b48536fb130639167edad84b061f7b234ae1c3185d9f4d86e582987907670093","preview/beskeder/ready":"3eac2f4ae1c08b9c8b02543d2f56ea7d11db6deb49de7c04272be6a8e8007370","preview/beskeder/empty":"2d32619d879437a289e6de23154613251eabece6cb44846157cc9cbbb1110541","preview/profil/ready":"ab597d9abe56cf504f0151024d59992f92b52962f69953c18a5840c9123709af","preview/profil/empty":"29f9fcbef8f9b21afaf5c7f6ac020bc7b762b3e4f5766e99d390179d07bc9a7d","preview/volumen/ready":"f60fe839088b3dedb051fad40343f9ee7d93cc05bd05890707ec4449b14777b4","preview/volumen/empty":"090591640194542f4394cfb9b308960302d3eb8a8ddc405722bc472657e6fa21","own/hjem/ready":"ab597d9abe56cf504f0151024d59992f92b52962f69953c18a5840c9123709af","own/hjem/empty":"29f9fcbef8f9b21afaf5c7f6ac020bc7b762b3e4f5766e99d390179d07bc9a7d","own/program/ready":"1c60085b7118b0594e07869a9c465e7c263f069a2f1b2052596b9a61cb7ce5b9","own/program/empty":"407cff5ba35938c08089a7dc86cfd91ddbc54f0eae53575658353a5fd1652897","own/fremgang/ready":"df0d5007c229b138eb5734ddab9897cf6b76229a244a6b0f1c97e580ab765650","own/fremgang/empty":"69f1b23191cfaa50635687a1c12b216e245302aa22b32e81dff828269f54a110","own/kost/ready":"2d920a7d34133bd0bc9b8e1e4fb3840e3fd3fd818558241b242d9430efb825ab","own/kost/empty":"b48536fb130639167edad84b061f7b234ae1c3185d9f4d86e582987907670093","own/beskeder/ready":"3eac2f4ae1c08b9c8b02543d2f56ea7d11db6deb49de7c04272be6a8e8007370","own/beskeder/empty":"2d32619d879437a289e6de23154613251eabece6cb44846157cc9cbbb1110541","own/profil/ready":"ab597d9abe56cf504f0151024d59992f92b52962f69953c18a5840c9123709af","own/profil/empty":"29f9fcbef8f9b21afaf5c7f6ac020bc7b762b3e4f5766e99d390179d07bc9a7d","own/volumen/ready":"f60fe839088b3dedb051fad40343f9ee7d93cc05bd05890707ec4449b14777b4","own/volumen/empty":"090591640194542f4394cfb9b308960302d3eb8a8ddc405722bc472657e6fa21"}

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

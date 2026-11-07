import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sessionReactDocument } from './entropi2/session/sessionQuickSetReactDom.mjs'
import { load, fixture, session, dual, foreign, week } from './coachSelfTrainingFixture.mjs'
import { requestCoachSelfTraining, createCoachSelfContext, isCoachSelfTraining, guardTrainingClient } from './coachSelfTraining.mjs'
const { App, Dashboard, AthleteView, dispose } = await load()
test.after(dispose)
const settle = () => new Promise(resolve => setImmediate(resolve))
const writes = table => fixture.calls.filter(c => c.op !== 'select' && (!table || c.table === table))
async function setup(t, { mobile = false, legacy = dual.id, athlete = dual, strict = false, clean = false } = {}) {
  const doc = sessionReactDocument(), host = doc.createElement('div'), appHost = doc.createElement('div')
  const createElement = doc.createElement
  doc.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.children.filter(n => n.tagName === 'OPTION') })
    return node
  }
  doc.body.append(host, appHost)
  const values = new Map(legacy ? [['entropi_my_athlete_id', legacy]] : [])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
  const timers = new Map(), events = new Map()
  const win = Object.assign(doc.defaultView, { innerWidth: mobile ? 400 : 1200, location: { search: '', href: 'https://synthetic.invalid/', pathname: '/' },
    scrollTo() {}, addEventListener(name, fn) { (events.get(name) ?? events.set(name, new Set()).get(name)).add(fn) },
    removeEventListener(name, fn) { events.get(name)?.delete(fn) } })
  const replacements = { window: win, document: doc, localStorage: storage, navigator: { onLine: true }, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { throw Error('Network forbidden') },
    setTimeout(fn, ms) { const timer = {}; timers.set(timer, { fn, ms }); return timer }, clearTimeout: timer => timers.delete(timer),
    requestAnimationFrame: () => ({}), cancelAnimationFrame() {},
    setInterval: () => ({}), clearInterval() {} }
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value, writable: true })
  fixture.snapshots = {
    'Dashboard.jsx': { athletes: [dual, foreign], loading: false, isMobile: mobile },
    'AthleteView.jsx': { athlete, loading: false, homeProgramLoading: false, onboardingDone: true, currentWeek: week, allWeeks: [week],
      readinessInput: { sleep: '8', energy: 4, motivation: 4, stress: 2, soreness: 2, soreZones: [] }, weightInput: '80' },
  }
  fixture.captured = {}; fixture.calls = []; fixture.authSession = session; fixture.role = 'coach'; fixture.pauseRole = null; fixture.queue = null
  fixture.returnAthlete = false; fixture.athleteRead = null
  fixture.cleanNav = clean; fixture.pendingSession = null; fixture.lazyMounts = []
  const root = createRoot(host), appRoot = createRoot(appHost)
  t.after(async () => {
    await act(async () => { root.unmount(); appRoot.unmount() })
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  })
  const render = async (Component, props, key) => act(async () => {
    root.render(strict ? h(StrictMode, null, h(Component, { ...props, key })) : h(Component, { ...props, key })); await settle()
  })
  const click = async node => {
    assert.ok(node, 'Expected actual navigation/button: ' + host.textContent + ' captures=' + Object.keys(fixture.captured).join(','))
    await act(async () => { host.dispatch('click', { type: 'click', target: node, button: 0, bubbles: true, stopPropagation() {} }); await settle() })
  }
  const button = label => host.querySelectorAll('button').find(b => b.textContent.trim().endsWith(label))
  const dashboard = () => render(Dashboard, fixture.captured.Dashboard, 'dashboard')
  const showAthlete = () => render(AthleteView, fixture.captured.Atletvisning, 'view')
  const app = async () => act(async () => { appRoot.render(h(App)); await settle() })
  return { host, appHost, storage, values, timers, events, root, render, click, button, dashboard, showAthlete, app }
}
async function ownEntry(f) {
  await f.app(); await f.dashboard()
  await f.click(f.button('Min træning'))
  assert.ok(fixture.captured.Atletvisning?.coachSelfTraining, 'App mints session-bound self entry')
  await f.showAthlete()
}

test('real App → actual Dashboard Min træning → dual-account AthleteView → existing logSet exactly once', async t => {
  const f = await setup(t)
  await ownEntry(f)
  assert.doesNotMatch(f.host.textContent, /Forhåndsvisning/)
  assert.equal(f.values.get('entropi_my_athlete_id'), dual.id, 'Legacy selection retained')
  assert.deepEqual(JSON.parse(f.values.get('entropi_coach_self_training_v1')), { ownerId: session.user.id, athleteId: dual.id })
  await f.click(f.button('Start dagens pas') || f.button('Start næste pas'))
  await act(async () => { await import('./entropi2/session/sessionView.mjs'); await settle() })
  assert.ok(f.host.querySelector('dialog'), 'Actual session screen opened')
  await act(async () => { f.host.querySelector('dialog').querySelector('form').dispatch('submit'); await settle() })
  assert.equal(writes('exercise_logs').length, 1)
  assert.equal(writes('exercise_logs')[0].body.athlete_id, dual.id)
})

for (const clean of [false, true]) for (const mobile of [false, true]) test(`first explicit ${mobile ? 'mobile' : 'desktop'} pickingMine choice is owner bound (clean=${clean})`, async t => {
  const f = await setup(t, { mobile, legacy: null, clean })
  await f.app(); await f.dashboard()
  if (mobile) await f.click(f.button('Menu'))
  await f.click(f.button('Min træning'))
  const choice = [...f.host.querySelectorAll('button'), ...f.host.querySelectorAll('div')].find(n => n.textContent === dual.name)
  await f.click(choice)
  assert.ok(fixture.captured.Atletvisning.coachSelfTraining)
  await f.showAthlete()
  assert.doesNotMatch(f.host.textContent, /Forhåndsvisning/)
  assert.equal(fixture.captured.LazyBoundary.key, `coach:${session.user.id}:${dual.id}:self`)
  assert.equal(JSON.parse(f.values.get('entropi_coach_self_training_v1')).ownerId, session.user.id)
})

test('Se som atlet reuses ONLY established self; another athlete of SAME coach remains preview', async t => {
  const f = await setup(t)
  await ownEntry(f)
  await act(async () => fixture.captured.Atletvisning.onExitPreview())
  await f.dashboard()
  await f.click(f.button('Se som atlet'))
  await f.click(f.host.querySelectorAll('div').find(n => n.textContent === dual.name))
  assert.ok(fixture.captured.Atletvisning.coachSelfTraining)
  await f.showAthlete()
  await act(async () => fixture.captured.Atletvisning.onExitPreview())
  await f.dashboard(); await f.click(f.button('Se som atlet'))
  await f.click(f.host.querySelectorAll('div').find(n => n.textContent === foreign.name))
  assert.equal(fixture.captured.Atletvisning.coachSelfTraining, null)
  fixture.snapshots['AthleteView.jsx'].athlete = foreign
  await f.render(AthleteView, fixture.captured.Atletvisning, 'foreign')
  assert.equal(fixture.captured.LazyBoundary.key, `coach:${session.user.id}:${foreign.id}:preview`)
  assert.ok(fixture.lazyMounts.some(([event, label]) => event === 'dispose' && label === 'Atletvisning'))
  assert.match(f.host.textContent, /Forhåndsvisning/)
  assert.equal(f.button('Start dagens pas') || f.button('Start næste pas'), undefined)
  assert.equal(writes('exercise_logs').length, 0)
})

test('session-bound capability rejects arbitrary booleans, pending/mismatched rows, missing/wrong owner and cross-account selection', async t => {
  const f = await setup(t)
  const context = createCoachSelfContext(session.user.id, 'coach', session.user.id)
  t.after(() => context.dispose())
  const entry = context.open(requestCoachSelfTraining({ session, athlete: dual }), session)
  const valid = { session, role: 'coach', athlete: dual, coachAthleteId: dual.id }
  assert.equal(isCoachSelfTraining(entry, valid), true)
  for (const value of [true, {}, false, null]) assert.equal(isCoachSelfTraining(value, valid), false)
  for (const changed of [
    { athlete: null }, { athlete: { ...dual, id: foreign.id } }, { athlete: { ...dual, coach_id: null } },
    { athlete: { ...dual, coach_id: 'synthetic-other-coach' } }, { coachAthleteId: foreign.id },
    { coachAthleteId: null }, { session: null }, { session: { user: { id: '' } } },
    { session: { user: { id: 'synthetic-other-coach' } } }, { role: 'athlete' }, { role: null },
  ]) assert.equal(isCoachSelfTraining(entry, { ...valid, ...changed }), false, JSON.stringify(changed))
  for (const cache of [{ ownerId: 'synthetic-other-coach', athleteId: dual.id }, { ownerId: session.user.id, athleteId: foreign.id }, {}]) {
    f.storage.setItem('entropi_coach_self_training_v1', JSON.stringify(cache))
    assert.equal(isCoachSelfTraining(entry, valid), false)
    assert.equal(requestCoachSelfTraining({ session, athlete: dual }), null)
  }
  f.storage.setItem('entropi_coach_self_training_v1', 'broken')
  assert.equal(isCoachSelfTraining(entry, valid), false)
})

test('retained actual write handlers cannot write after App exit, signout or account switch', async t => {
  const f = await setup(t)
  await ownEntry(f)
  const p = fixture.captured.Atletvisning
  await act(async () => fixture.setters['AthleteView.jsx:requestedTab']('program'))
  const program = fixture.captured.Program
  assert.equal(typeof program.logSet, 'function')
  await act(async () => p.onExitPreview())
  assert.equal(await program.logSet('synthetic-lift', 1, 1, 3, null, { inputOverride: { weight: '60' } }), false)
  assert.equal(writes('exercise_logs').length, 0)
  await f.dashboard(); await f.click(f.button('Min træning')); await f.render(AthleteView, fixture.captured.Atletvisning, 'again')
  await act(async () => fixture.setters['AthleteView.jsx:requestedTab']('program'))
  const retained = fixture.captured.Program.logSet
  await act(async () => { fixture.auth('SIGNED_OUT', null); await settle() })
  assert.equal(await retained('synthetic-lift', 1, 1, 3, null), false)
  await act(async () => { fixture.auth('SIGNED_IN', { user: { id: 'synthetic-other-coach' } }); await settle() })
  for (const { fn, ms } of [...f.timers.values()]) if (ms === 0) await act(async () => { fn(); await settle() })
  assert.equal(await retained('synthetic-lift', 1, 1, 3, null), false)
  assert.equal(writes('exercise_logs').length, 0)
})

test('prepared mutation query checks current context before transport', async () => {
  let allowed = true
  const client = guardTrainingClient({ from: () => ({ insert() { return this }, then() { assert.fail('stale query reached transport') } }) }, () => allowed)
  const prepared = client.from('exercise_logs').insert({ athlete_id: dual.id })
  allowed = false
  await assert.rejects(Promise.resolve(prepared), /ikke længere gemme/)
})

test('verified dual owner uses actual readiness, bodyweight and food adapters; retained clients fail closed', async t => {
  const f = await setup(t)
  await ownEntry(f)
  const home = fixture.captured.HomeSession
  assert.equal(typeof home.saveReadiness, 'function')
  assert.equal(typeof home.logWeight, 'function')
  await act(async () => { await home.saveReadiness(); await home.logWeight() })
  for (const table of ['readiness_logs', 'weight_logs']) {
    assert.equal(writes(table).length, 1)
    assert.equal(writes(table)[0].body.athlete_id, dual.id)
  }
  await act(async () => fixture.setters['AthleteView.jsx:requestedTab']('kost'))
  const nutrition = fixture.captured.Entropi2Kost
  assert.ok(nutrition.client)
  assert.equal(nutrition.athlete.id, dual.id)
  for (const [label, value] of [['Måltid', 'Syntetisk måltid'], ['Energi (kcal)', '300'], ['Protein (g)', '20'], ['Kulhydrat (g)', '30'], ['Fedt (g)', '10']]) {
    const input = f.host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-' + label)
    assert.ok(input, label)
    input.value = value
    await act(async () => input.dispatch('input', { target: input }))
  }
  const mealForm = f.host.querySelectorAll('form').find(n => n.querySelectorAll('button').some(b => b.textContent === 'Gem måltid'))
  await act(async () => { mealForm.dispatch('submit'); await settle() })
  assert.equal(writes('meal_logs').length, 1)
  assert.equal(writes('meal_logs')[0].body.athlete_id, dual.id)
  assert.equal(f.button('Mig'), undefined, 'Separate athlete login has no account settings')
  await act(async () => fixture.captured.Atletvisning.onExitPreview())
  assert.equal(await home.saveReadiness(), false)
  assert.equal(await home.logWeight(), false)
  assert.throws(() => nutrition.client.from('meal_logs').insert({ athlete_id: dual.id }), /ikke længere gemme/)
  assert.equal(writes('readiness_logs').length, 1)
  assert.equal(writes('weight_logs').length, 1)
  assert.equal(writes('meal_logs').length, 1)
})

test('real same-instance athlete/account switches revoke old callbacks, including original equal-user path', async t => {
  const equal = { ...dual, user_id: session.user.id }
  const f = await setup(t, { athlete: equal })
  const props = { session, role: 'coach', coachAthleteId: equal.id, onExitPreview() {} }
  await f.render(AthleteView, props, 'same')
  const retained = fixture.captured.HomeSession.onLogSet
  await f.render(AthleteView, { ...props, coachAthleteId: foreign.id }, 'same')
  assert.equal(await retained(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }), false)
  assert.equal(fixture.captured.HomeSession.onLogSet, undefined)
  await f.render(AthleteView, { ...props, session: { user: { id: 'synthetic-other-coach' } } }, 'same')
  assert.equal(await retained(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }), false)
  assert.equal(writes('exercise_logs').length, 0)
})

test('ordinary athlete and explicit OFF retain original presentation and actual equal-user writer', async t => {
  const equal = { ...dual, user_id: session.user.id, onboarding_completed_at: '2026-11-01T12:00:00Z' }
  const f = await setup(t, { athlete: equal })
  fixture.returnAthlete = true
  await f.render(AthleteView, { session, role: 'athlete' }, 'ordinary')
  assert.equal(typeof fixture.captured.HomeSession.onLogSet, 'function')
  await act(async () => fixture.captured.HomeSession.onLogSet(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }, { sessionOnly: true }))
  assert.equal(writes('exercise_logs').length, 1)
  await f.render(AthleteView, { session, role: 'coach', coachAthleteId: equal.id, entropi2: false }, 'off')
  assert.equal(f.host.querySelector('[data-entropi2-athlete]'), null)
  assert.equal(f.host.querySelector('fieldset'), null)
})

test('pending loaded row, unscoped cache alone, and boolean self flag never expose dual writer', async t => {
  const f = await setup(t, { athlete: null })
  const props = { session, role: 'coach', coachAthleteId: dual.id, coachSelfTraining: true }
  await f.render(AthleteView, props, 'pending')
  assert.equal(f.host.querySelector('[data-entropi2-home-session]'), null)
  await act(async () => fixture.setters['AthleteView.jsx:athlete'](dual))
  assert.equal(fixture.captured.HomeSession.onLogSet, undefined)
  assert.match(f.host.textContent, /Forhåndsvisning/)
  assert.equal(writes('exercise_logs').length, 0)
})

test('unconfirmed cached coach role cannot mint self mode; late role lookup cannot revive signed-out account', async t => {
  const f = await setup(t)
  let releaseRole
  fixture.pauseRole = new Promise(resolve => { releaseRole = resolve })
  fixture.snapshots['App.jsx'] = { session, role: 'coach', loading: false }
  await f.app(); await f.dashboard(); await f.click(f.button('Min træning'))
  assert.equal(fixture.captured.Atletvisning.coachSelfTraining, null)
  await f.showAthlete()
  assert.equal(fixture.captured.HomeSession.onLogSet, undefined)
  await act(async () => { fixture.auth('SIGNED_OUT', null); releaseRole(); await settle() })
  assert.ok(fixture.captured.Auth)
  assert.equal(writes('exercise_logs').length, 0)
})

test('late initial getSession cannot restore a session after signout', async t => {
  const f = await setup(t)
  let releaseSession
  fixture.pendingSession = new Promise(resolve => { releaseSession = resolve })
  await f.app()
  assert.equal(fixture.captured.Dashboard, undefined)
  await act(async () => { fixture.auth('SIGNED_OUT', null); await settle() })
  assert.ok(fixture.captured.Auth)
  await act(async () => { releaseSession({ data: { session } }); await settle() })
  assert.equal(fixture.captured.Dashboard, undefined)
  assert.ok(f.appHost.querySelector('[data-test-child="Auth"]'))
})

test('retained actual dual writer rejects corrupted, removed and cross-owner selection cache', async t => {
  const f = await setup(t)
  await ownEntry(f)
  const retained = fixture.captured.HomeSession.onLogSet
  for (const value of [null, 'broken', 'false', 'null', '[]', JSON.stringify({ ownerId: 'synthetic-other-coach', athleteId: dual.id }),
    JSON.stringify({ ownerId: session.user.id, athleteId: foreign.id })]) {
    if (value === null) f.storage.removeItem('entropi_coach_self_training_v1')
    else f.storage.setItem('entropi_coach_self_training_v1', value)
    assert.equal(await retained(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }), false)
  }
  assert.equal(writes('exercise_logs').length, 0)
})

test('retired Dashboard selection callbacks cannot replace another entry or its persisted mapping', async t => {
  const f = await setup(t)
  await ownEntry(f)
  const stale = fixture.captured.Sidebar
  const before = f.values.get('entropi_coach_self_training_v1')
  await act(async () => {
    stale.onSelectOwnAthlete(foreign.id)
    stale.onPreviewAthlete(foreign.id)
  })
  assert.equal(f.values.get('entropi_coach_self_training_v1'), before)
  assert.equal(fixture.captured.Atletvisning.coachAthleteId, dual.id)
  assert.equal(writes('exercise_logs').length, 0)
})

test('StrictMode mounts dispose correctly and queued actual logSet cannot run after session exit', async t => {
  const f = await setup(t, { strict: true })
  await ownEntry(f)
  let deferred
  fixture.queue = run => new Promise((resolve, reject) => { deferred = () => Promise.resolve().then(run).then(resolve, reject) })
  const home = fixture.captured.HomeSession
  let pending
  await act(async () => {
    pending = home.onLogSet(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }, { sessionOnly: true })
    await settle()
  })
  assert.equal(typeof deferred, 'function')
  await act(async () => fixture.captured.Atletvisning.onExitPreview())
  await act(async () => { await deferred(); await pending })
  assert.equal(writes('exercise_logs').length, 0)
})

// Round 2: use App's ordinary/equal-user paths and invoke retained real adapters
// inside the auth callback's React batch, before the new view can commit.
for (const role of ['athlete', 'coach']) for (const transition of ['signout', 'switch', ...(role === 'coach' ? ['exit'] : [])])
  test(`App revokes original ${role} writes synchronously on ${transition}, preserving earlier writes`, async t => {
    const equal = { ...dual, user_id: session.user.id, onboarding_completed_at: '2026-11-01T12:00:00Z' }
    const f = await setup(t, { athlete: equal, legacy: null })
    fixture.role = role; fixture.returnAthlete = true
    await f.app()
    if (role === 'coach') await act(async () => fixture.captured.Dashboard.onPreviewAthlete(equal.id))
    await f.showAthlete()
    const entry = fixture.captured.Atletvisning, home = fixture.captured.HomeSession
    const log = () => home.onLogSet(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }, { sessionOnly: true })
    await act(async () => { await log(); await home.saveReadiness(); await home.logWeight() })
    for (const table of ['exercise_logs', 'readiness_logs', 'weight_logs']) assert.equal(writes(table).length, 1, table)
    await act(async () => fixture.setters['AthleteView.jsx:requestedTab']('kost'))
    const nutrition = fixture.captured.Entropi2Kost
    const prepared = nutrition.client.from('meal_logs').insert({ athlete_id: equal.id, kcal: 20 })
    await act(async () => {
      if (transition === 'exit') entry.onExitPreview()
      else fixture.auth(transition === 'signout' ? 'SIGNED_OUT' : 'SIGNED_IN', transition === 'signout' ? null : { user: { id: 'synthetic-next-account' } })
      // These are synchronous denials, before yielding to React or the transport.
      assert.equal(log(), false)
      assert.equal(home.saveReadiness(), false)
      assert.equal(home.logWeight(), false)
      await assert.rejects(Promise.resolve(prepared), /ikke længere gemme/)
      assert.throws(() => nutrition.client.from('meal_logs').insert({ athlete_id: equal.id }), /ikke længere gemme/)
    })
    for (const table of ['exercise_logs', 'readiness_logs', 'weight_logs']) assert.equal(writes(table).length, 1, table)
    assert.equal(writes('meal_logs').length, 0)
  })

for (const role of ['athlete', 'coach']) test(`App equal-user ${role} token refresh preserves its write lease`, async t => {
  const equal = { ...dual, user_id: session.user.id }
  const f = await setup(t, { athlete: equal })
  fixture.role = role; fixture.returnAthlete = true
  await f.app()
  if (role === 'coach') await act(async () => fixture.captured.Dashboard.onPreviewAthlete(equal.id))
  await f.showAthlete()
  const home = fixture.captured.HomeSession
  await act(async () => {
    fixture.auth('TOKEN_REFRESHED', { user: { id: session.user.id } })
    await home.onLogSet(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }, { sessionOnly: true })
  })
  assert.equal(writes('exercise_logs').length, 1)
})

for (const entropi2 of [undefined, false]) test(`standalone Dashboard has original navigation without a verified self context (E2=${entropi2})`, async t => {
  const f = await setup(t, { clean: true, legacy: null })
  const calls = [], onPreviewAthlete = (...args) => calls.push(args)
  await f.render(Dashboard, { session, onPreviewAthlete, entropi2 }, 'standalone')
  const sidebar = fixture.captured.Sidebar
  assert.equal(sidebar.onPreviewAthlete, onPreviewAthlete)
  assert.equal(Object.hasOwn(sidebar, 'onSelectOwnAthlete'), false)
  await f.click(f.button('Min træning'))
  const choice = f.host.querySelectorAll('button').find(n => n.textContent === dual.name)
  await f.click(choice)
  assert.deepEqual(calls, [[dual.id]])
  assert.equal(f.values.get('entropi_my_athlete_id'), dual.id)
  assert.equal(f.values.has('entropi_coach_self_training_v1'), false)
  await f.render(AthleteView, { session, role: 'coach', coachAthleteId: dual.id, onExitPreview() {} }, 'preview')
  assert.equal(fixture.captured.HomeSession.onLogSet, undefined, 'legacy navigation never grants separate-login writes')
  assert.equal(writes('exercise_logs').length, 0)
})

for (const role of ['athlete', 'coach']) test(`queued original ${role} set transport cannot run after App auth revocation`, async t => {
  const equal = { ...dual, user_id: session.user.id }
  const f = await setup(t, { athlete: equal })
  fixture.role = role; fixture.returnAthlete = true
  await f.app()
  if (role === 'coach') await act(async () => fixture.captured.Dashboard.onPreviewAthlete(equal.id))
  await f.showAthlete()
  const home = fixture.captured.HomeSession
  let deferred, pending
  fixture.queue = run => new Promise((resolve, reject) => { deferred = () => Promise.resolve().then(run).then(resolve, reject) })
  await act(async () => {
    pending = home.onLogSet(week.sessions[0].exercises[0], 1, 1, 3, null, { weight: '60' }, { sessionOnly: true })
    await settle()
  })
  assert.equal(typeof deferred, 'function')
  await act(async () => { fixture.auth('SIGNED_OUT', null); await deferred(); await pending })
  assert.equal(writes('exercise_logs').length, 0)
})

test('explicit Dashboard OFF keeps callback identity and old picker even with a verified App context', async t => {
  const f = await setup(t, { clean: true, legacy: null })
  await f.app()
  const props = fixture.captured.Dashboard
  assert.ok(props.coachSelfContext)
  await f.render(Dashboard, { ...props, entropi2: false }, 'off-dashboard')
  assert.equal(fixture.captured.Sidebar.onPreviewAthlete, props.onPreviewAthlete)
  assert.equal(Object.hasOwn(fixture.captured.Sidebar, 'onSelectOwnAthlete'), false)
  await f.click(f.button('Min træning'))
  await f.click(f.host.querySelectorAll('button').find(n => n.textContent === dual.name))
  assert.equal(f.values.get('entropi_my_athlete_id'), dual.id)
  assert.equal(f.values.has('entropi_coach_self_training_v1'), false)
  assert.equal(fixture.captured.Atletvisning.coachSelfTraining, null)
  await f.showAthlete()
  assert.equal(fixture.captured.HomeSession.onLogSet, undefined)
})

test('ordinary App athlete onboarding RPC is allowed before revocation and denied from a retained queue afterward', async t => {
  const equal = { ...dual, user_id: session.user.id }
  const f = await setup(t, { athlete: equal })
  fixture.role = 'athlete'; fixture.returnAthlete = true
  await f.app(); await f.showAthlete()
  await act(async () => fixture.setters['AthleteView.jsx:guideOpen'](true))
  await act(async () => fixture.captured.OnboardingGuide.completeOnboardingGuide())
  assert.equal(writes('rpc').filter(c => c.name === 'complete_athlete_onboarding_v1').length, 1)
  await act(async () => fixture.setters['AthleteView.jsx:guideOpen'](true))
  let queued
  fixture.queue = run => { queued = run; return Promise.resolve() }
  await act(async () => fixture.captured.OnboardingGuide.completeOnboardingGuide())
  assert.equal(typeof queued, 'function')
  await act(async () => {
    fixture.auth('SIGNED_OUT', null)
    assert.throws(queued, /ikke længere gemme/)
  })
  assert.equal(writes('rpc').filter(c => c.name === 'complete_athlete_onboarding_v1').length, 1)
})

test('normal athlete profile claim remains available during legitimate initial loading', async t => {
  const equal = { ...dual, user_id: session.user.id }
  const f = await setup(t, { athlete: equal })
  fixture.role = 'athlete'; fixture.returnAthlete = true
  let reads = 0
  fixture.athleteRead = async () => ({ data: ++reads === 1 ? null : equal, error: null })
  await f.app(); await f.showAthlete()
  assert.equal(writes('rpc').filter(c => c.name === 'claim_athlete_profile_v3').length, 1)
  assert.equal(typeof fixture.captured.HomeSession.onLogSet, 'function')
})

for (const found of [false, true]) test(`pending normal athlete lookup cannot dispatch identity writes after logout (found=${found})`, async t => {
  const equal = { ...dual, user_id: session.user.id }
  const f = await setup(t, { athlete: equal })
  fixture.role = 'athlete'; fixture.returnAthlete = true
  let release
  fixture.athleteRead = () => new Promise(resolve => { release = resolve })
  await f.app(); await f.showAthlete()
  assert.equal(typeof release, 'function')
  const before = writes().length
  await act(async () => {
    fixture.auth('SIGNED_OUT', null)
    release({ data: found ? equal : null, error: null })
    await settle()
  })
  assert.equal(writes().length, before)
  assert.equal(writes('rpc').length, 0)
})

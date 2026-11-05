import test from 'node:test'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './prog3Jsx.mjs'
import assert from 'node:assert/strict'
import { loadViews, seed, begin, render, named, nodes, fixture, session, ownAthlete, otherAthlete, runEffects, week } from './coachOwnTrainingFixture.mjs'
import { athleteConversationScope, createConversationAdapters } from '../entropi2/conversation/conversationAdapters.mjs'
import { syntheticHost, flush } from '../entropi2/nutrition/synthetic-dom.mjs'

const { default: AthleteView, App, dispose } = await loadViews()
test.after(dispose)
const props = (athlete = ownAthlete, extra = {}) => ({ session, role: 'coach', coachAthleteId: athlete.id,
  onExitPreview() {}, ...extra })
const mount = (athlete = ownAthlete, values = {}, extra = {}) => {
  seed({ athlete, ...values }); return render(AthleteView, props(athlete, extra))
}

test('actual App preview handler feeds the complete AthleteView for own and other profiles', () => {
  for (const athlete of [ownAthlete, otherAthlete]) {
    seed({}, true)
    const dashboard = nodes(render(App)).find(node => node.props?.label === 'Dashboard')
    dashboard.props.componentProps.onPreviewAthlete(athlete.id)
    const preview = nodes(render(App)).find(node => node.props?.label === 'Atletvisning')
    assert.equal(preview.props.componentProps.entropi2, undefined, 'default flag must not overwrite explicit release props')
    assert.equal(preview.props.componentProps.role, 'coach')
    seed({ athlete })
    const tree = render(AthleteView, preview.props.componentProps)
    assert.ok(named(tree, 'HomeSession'), 'actual coach host reaches Entropi 2')
    assert.equal(typeof named(tree, 'HomeSession').props.onLogSet, athlete === ownAthlete ? 'function' : 'undefined')
  }
})

test('own coach profile reaches E2 Home, logging, analysis, nutrition, conversation and mobility', async () => {
  const home = named(mount(), 'HomeSession')
  assert.ok(home)
  await home.props.onLogSet(week.sessions[0].exercises[0], 1, 1, 3, 8, { weight: '60', rpe: '8' })
  assert.equal(fixture.calls.filter(call => call.name === 'logDagensPasSet').length, 1)
  home.props.onFilmSet()
  assert.equal(named(render(AthleteView, props()), 'Ramme').props.athleteVideoCoachOpen, true)
  const back = named(mount(), 'Ramme').props.backBtn
  assert.ok(nodes(back).some(node => node.type === 'button' && node.props.children.includes('Til coachportalen')))
  assert.ok(named(back, 'ProfileMenu'))
  for (const [requestedTab, name] of [['fremgang', 'Entropi2Analysis'], ['kost', 'Entropi2Kost'], ['beskeder', 'ConversationEntry'], ['mobilisering', 'Entropi2Mobility']]) {
    const tree = mount(ownAthlete, { requestedTab })
    const entry = named(tree, name) || nodes(tree).find(node => node.type?.name === ({ Entropi2Analysis: 'Analysis', Entropi2Mobility: 'Entropi2Mobility' })[name])
    assert.ok(entry, requestedTab)
    if (requestedTab === 'beskeder') {
      const scope = athleteConversationScope(entry.props.getEntry())
      assert.equal(scope.enabled, true)
      assert.equal(scope.athleteUserId, session.user.id)
      assert.equal(scope.ownerId, session.user.id)
    }
    if (requestedTab === 'kost') assert.equal(typeof entry.props.logWeight, 'function')
  }
})

test('other athlete has E2 presentation, disabled form boundary and no own actions or background flush', () => {
  const prior = globalThis.window
  globalThis.window = { location: { search: '' }, addEventListener() {}, removeEventListener() {}, scrollTo() {} }
  try {
    const tree = mount(otherAthlete)
    const home = named(tree, 'HomeSession')
    assert.ok(home)
    assert.equal(home.props.onLogSet, undefined)
    assert.equal(home.props.setLogInputs, undefined)
    assert.equal(home.props.onFilmSet, undefined)
    assert.throws(() => home.props.storage.setItem('entropi2:checkin:v1:test', 'x'), /kan ikke gemme/)
    assert.ok(nodes(tree).find(node => node.type === 'fieldset' && node.props.disabled === true))
    assert.ok(named(tree, 'BundNav'), 'navigation remains outside the disabled content')
    assert.equal(named(tree, 'ProfileMenu'), undefined)
    assert.equal(fixture.bridge.athlete, null)
    assert.equal(fixture.readiness.athlete, null)
    const cleanup = runEffects(); cleanup()
    assert.equal(fixture.calls.filter(call => call.name === 'flushOfflineSets').length, 0)
    const kost = named(mount(otherAthlete, { requestedTab: 'kost' }), 'PreviewKost')
    assert.ok(kost)
    assert.equal(kost.props.logWeight, undefined)
    assert.equal(kost.props.onWeightInput, undefined)
    const mobility = named(mount(otherAthlete, { requestedTab: 'mobilisering' }), 'Entropi2Mobility')
    assert.throws(() => mobility.props.storage.setItem('entropi2:mobility:done:v1:test', 'x'), /kan ikke gemme/)
    const messages = mount(otherAthlete, { requestedTab: 'beskeder' })
    assert.equal(named(messages, 'ConversationEntry'), undefined)
    assert.ok(named(messages, 'Conversation'))
  } finally { if (prior === undefined) delete globalThis.window; else globalThis.window = prior }
})

test('ownership uses loaded user identity, never selected profile, missing IDs, or preview exit callback', () => {
  for (const athlete of [{ ...ownAthlete, user_id: null }, { ...ownAthlete, user_id: '' }, otherAthlete]) {
    assert.equal(named(mount(athlete), 'HomeSession').props.onLogSet, undefined)
  }
  assert.equal(named(mount(ownAthlete, {}, { coachAthleteId: otherAthlete.id }), 'HomeSession').props.onLogSet, undefined)
  assert.equal(typeof named(mount(ownAthlete, {}, { onExitPreview: undefined }), 'HomeSession').props.onLogSet, 'function')
  assert.equal(named(mount(ownAthlete, {}, { session: { user: { id: '' } } }), 'HomeSession').props.onLogSet, undefined)
  seed({ athlete: null })
  assert.equal(named(render(AthleteView, props()), 'HomeSession'), undefined)
})

test('ordinary athlete still has the complete E2 self view and legacy OFF is independent of preview callbacks', () => {
  const tree = mount(ownAthlete, {}, { role: 'athlete', coachAthleteId: null, onExitPreview: undefined })
  assert.equal(typeof named(tree, 'HomeSession').props.onLogSet, 'function')
  assert.equal(nodes(tree).some(node => node.type === 'fieldset'), false)
  const conversation = named(mount(ownAthlete, { requestedTab: 'beskeder' },
    { role: 'athlete', coachAthleteId: null, onExitPreview: undefined }), 'ConversationEntry')
  assert.equal(athleteConversationScope(conversation.props.getEntry()).enabled, true)
})

test('explicit OFF keeps all legacy screens for coach own, preview and normal athlete', () => {
  for (const role of ['athlete', 'coach']) for (const athlete of [ownAthlete, otherAthlete]) {
    for (const requestedTab of ['hjem', 'fremgang', 'kost', 'beskeder', 'mobilisering']) {
      const tree = mount(athlete, { requestedTab }, { role, entropi2: false })
      for (const name of ['HomeSession', 'Entropi2Kost', 'ConversationEntry', 'Conversation', 'Analysis', 'Entropi2Mobility']) assert.equal(named(tree, name), undefined, name)
      assert.equal(nodes(tree).some(node => node.type === 'fieldset'), false)
      assert.equal(nodes(tree).some(node => Object.hasOwn(node.props || {}, 'data-entropi2-athlete')), false)
      assert.ok(requestedTab === 'hjem' ? named(tree, 'HjemTab') : nodes(tree).some(node => node.props?.label))
    }
  }
})

test('preview nutrition permits scoped reads but rejects every backend mutation before invocation', async () => {
  const calls = []
  const query = { select() { calls.push('select'); return query }, eq() { calls.push('eq'); return query },
    then(resolve) { return Promise.resolve(resolve({ data: [], error: null })) },
    insert() { assert.fail('insert reached backend') }, update() { assert.fail('update reached backend') },
    delete() { assert.fail('delete reached backend') }, upsert() { assert.fail('upsert reached backend') } }
  fixture.database = { from: table => { assert.equal(table, 'meal_logs'); return query } }
  const client = named(mount(otherAthlete, { requestedTab: 'kost' }), 'PreviewKost').props.client
  fixture.database = null
  assert.deepEqual(await client.from('meal_logs').select('*').eq('athlete_id', otherAthlete.id), { data: [], error: null })
  assert.deepEqual(calls, ['select', 'eq'])
  for (const action of ['insert', 'update', 'delete', 'upsert', 'rpc']) assert.throws(() => client.from('meal_logs')[action]({}), /kan ikke gemme/)
  assert.equal(client.rpc, undefined)
})

test('actual preview conversation controller renders only target snapshots and cannot send, receipt, upload or save', async () => {
  const message = { id: 'synthetic-message', athlete_id: otherAthlete.id, sender_role: 'coach', content: 'Testbesked', created_at: '2026-11-04T12:00:00Z' }
  const tree = mount(otherAthlete, { requestedTab: 'beskeder',
    messages: [message, { ...message, id: 'synthetic-wrong', athlete_id: ownAthlete.id }], sharedVideoAnalyses: [] })
  const c = named(tree, 'Conversation').props.createController()
  try {
    assert.equal(await c.refresh(), true)
    assert.equal(c.snapshot().thread.length, 1)
    await c.seen(c.snapshot().thread[0].key)
    assert.equal(c.snapshot().thread[0].value.read_at, undefined)
    c.draft('Må ikke sendes')
    assert.equal(await c.send(), false)
    assert.equal(await c.upload(), false)
    assert.equal(await c.submission('synthetic-submission'), false)
  } finally { c.dispose() }
})

test('actual preview nutrition mount reads meals and blocks persistent favorites even if synthetic events bypass disabled fieldset', async () => {
  const rows = [1, 2].map(i => ({ id: 'synthetic-meal-' + i, athlete_id: otherAthlete.id, date: '2026-11-04',
    meal: 'Testmåltid ' + i, kcal: 100, protein: 10, carb: 10, fat: 2 }))
  const q = { select() { return q }, eq() { return q }, gte() { return q }, lte() { return q },
    order: async () => ({ data: rows, error: null }) }
  fixture.database = { from: () => q }
  const preview = named(mount(otherAthlete, { requestedTab: 'kost' }), 'PreviewKost')
  fixture.database = null
  begin()
  const leaf = preview.type(preview.props), host = syntheticHost()
  leaf.props.ref.current = host
  const cleanup = runEffects()
  try {
    await flush()
    assert.match(host.textContent, /Testmåltid 1/)
    for (const index of [0, 1]) await host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'meal-part-' + index).fire('change')
    const input = host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Navn på eget måltid')
    input.value = 'Preview måltid'; await input.fire('input')
    await host.querySelectorAll('form').find(n => n.getAttribute('aria-label') === 'Gem eget måltid').fire('submit')
    assert.match(host.textContent, /Favoritten blev ikke gemt/)
  } finally { cleanup() }
})

test('own coach conversation retains per-message acknowledgement; preview scope never grants athlete ownership', async () => {
  const entry = named(mount(ownAthlete, { requestedTab: 'beskeder' }), 'ConversationEntry').props.getEntry()
  const writes = []
  const database = { from(table) { const q = { update(patch) { writes.push({ table, patch }); return q }, eq() { return q },
    select: async () => ({ data: [{ id: 'synthetic-message' }], error: null }) }; return q } }
  const adapter = createConversationAdapters({ enabled: true, database, getScope: () => athleteConversationScope(entry) })
  await adapter.seen({ kind: 'message', value: { id: 'synthetic-message', athlete_id: ownAthlete.id, sender_role: 'coach' } })
  assert.equal(writes.length, 1)
  assert.deepEqual(Object.keys(writes[0].patch), ['read_at'])
  assert.equal(athleteConversationScope({ ...entry, athlete: otherAthlete, coachAthleteId: otherAthlete.id }).enabled, false)
})

test('MIN TRÆNING: return keeps the callback, 44 px target, 14 px text and scoped OFF label', () => {
  for (const athlete of [ownAthlete, otherAthlete]) for (const entropi2 of [true, false]) {
    let exits = 0
    const ramme = named(mount(athlete, {}, { entropi2, onExitPreview: () => exits++ }), 'Ramme')
    const button = nodes(ramme.props.backBtn).find(node => node.type === 'button')
    assert.ok(button)
    assert.equal(ramme.props.coachOwnTraining, entropi2 && athlete === ownAthlete)
    assert.equal(ramme.props.coachNavigation, entropi2)
    assert.equal(button.props.children.includes(entropi2 ? 'Til coachportalen' : '← Coach view'), true)
    assert.equal(button.props.style.fontSize, entropi2 ? 14 : '0.56rem')
    assert.equal(button.props.style.minHeight, entropi2 ? 44 : undefined)
    assert.equal(exits, 0)
    button.props.onClick()
    assert.equal(exits, 1)
  }
})

test('MIN TRÆNING: actual frame wraps return/profile/date and bottom navigation retains every removed shortcut', async () => {
  const files = new Set(['Ramme.jsx', 'BundNav.jsx', 'NavItems.jsx'].map(name => new URL(name, import.meta.url).href))
  const rammeURL = new URL('Ramme.jsx', import.meta.url).href
  const bundURL = new URL('BundNav.jsx', import.meta.url).href
  const forbidden = 'data:text/javascript,' + encodeURIComponent('export const signOutHard = () => { throw Error("Forbidden service") }; export const countOfflineSets = () => 0; export const ATHLETE_VIDEOCOACH_URL = "synthetic-video";')
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === rammeURL) {
        if (['../supabase', '../offlineSetQueue', './videoCoachBro'].includes(specifier)) return { url: forbidden, shortCircuit: true }
        if (specifier === '../athleteShared') return next('../athleteShared.js', context)
      }
      if (context.parentURL === bundURL && specifier === './NavItems') return next('./NavItems.jsx', context)
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!files.has(url)) return next(url, context)
      return { format: 'module', shortCircuit: true, source:
        `import { createElement as __create, Fragment as __fragment } from './coachOwnTrainingFixture.mjs';
        const __h = (type, props, key, ...children) => __create(type ?? __fragment, props, ...children);
        ${jsx(readFileSync(new URL(url), 'utf8'))}` }
    },
  })
  try {
    const { default: Ramme } = await import('./Ramme.jsx')
    const { default: BundNav } = await import('./BundNav.jsx')
    const { s: base } = await import('../athleteShared.js')
    for (const athlete of [ownAthlete, otherAthlete]) for (const entropi2 of [true, false]) {
      const props = named(mount(athlete, {}, { entropi2 }), 'Ramme').props
      const frame = Ramme(props)
      const topbar = nodes(frame).find(node => node.props.style?.position === 'sticky')
      assert.ok(topbar)
      assert.equal(textOf(frame).includes('Min træning'), entropi2 && athlete === ownAthlete)
      if (entropi2) {
        assert.equal(topbar.props.style.height, 'auto')
        assert.equal(topbar.props.style.minHeight, 52)
        assert.equal(topbar.props.style.flexWrap, 'wrap')
        assert.equal(topbar.props.style.boxSizing, 'border-box')
        assert.ok(nodes(frame).some(node => node.props.style?.maxWidth === '100%' && node.props.style.flexWrap === 'wrap'))
      } else assert.deepEqual(topbar.props.style, base.topbar)
    }
    const routes = []
    const nav = BundNav({ athlete: ownAthlete, hasMeetPlan: false, setTab: route => routes.push(route),
      sharedVideoAnalyses: [], tab: 'hjem', unreadMsgCount: 0 })
    const current = nodes(nav).find(node => Object.hasOwn(node.props, 'data-entropi2-bundnav'))
    const details = { open: true, querySelector: () => ({ focus() {} }) }
    for (const route of ['fremgang', 'kost', 'mobilisering', 'beskeder']) {
      const button = nodes(current).find(node => node.type === 'button' && node.props.key === route)
      assert.ok(button, route)
      button.props.onClick({ currentTarget: { closest: () => details } })
    }
    assert.deepEqual(routes, ['fremgang', 'kost', 'mobilisering', 'beskeder'])
    assert.equal(details.open, false, 'Mobility remains in the existing More menu')
  } finally { hooks.deregister() }
})

function textOf(tree) {
  return nodes(tree).flatMap(node => (node.props?.children ?? []).filter(value => typeof value === 'string')).join(' ')
}

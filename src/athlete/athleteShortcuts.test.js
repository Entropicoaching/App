import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderAthleteShortcuts, contactSummary, revealWeek, DEFAULT_FORENKLINGER } from './athleteShortcuts.mjs'
import { openReadinessSurface } from './readinessShortcut.mjs'

// Synthetic DOM: no renderer, browser, network or application services.
const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat(Infinity).filter(x => x != null) })
const all = node => node && typeof node === 'object' ? [node, ...node.children.flatMap(all)] : []
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join(' ')
function setup(extra = {}) {
  const events = []
  const props = { enabled: true, role: 'athlete', athlete: { id: 'synthetic' },
    go: tab => events.push(['tab', tab]), setMsgTrack: track => events.push(['track', track]),
    openReadiness: () => events.push(['readiness']), startVideo: () => events.push(['video']),
    openWeek: () => events.push(['week']), hasWeek: true, ...extra }
  const tree = renderAthleteShortcuts(h, props)
  const click = key => {
    const node = all(tree).find(n => n.props.key === key && n.tag === 'button')
    assert.ok(node, key); node.props.onClick()
  }
  return { tree, events, click }
}

test('flag defaults off and accepts only boolean true', () => {
  assert.equal(DEFAULT_FORENKLINGER, false)
  assert.equal(renderAthleteShortcuts(h), null)
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    assert.equal(renderAthleteShortcuts(h, { enabled }), null)
  }
})

test('training, progress and week buttons use existing destinations', () => {
  const { click, events } = setup()
  for (const key of ['program', 'strength', 'volume', 'week']) click(key)
  assert.deepEqual(events, [['tab', 'program'], ['tab', 'fremgang'], ['tab', 'volumen'], ['week']])
})

test('each contact button selects its track before navigation', () => {
  const { click, events } = setup()
  click('message'); click('technique')
  assert.deepEqual(events, [['track', 'besked'], ['tab', 'beskeder'], ['track', 'teknik'], ['tab', 'beskeder']])
})

test('latest message excludes athlete messages and selects correct track', () => {
  const { tree, click, events } = setup({ messages: [
    { sender_role: 'athlete', content: 'Egen besked', created_at: '2099-01-01' },
    { sender_role: 'coach', content: 'Godt løft', category: 'teknik', created_at: '2026-10-20' },
  ] })
  assert.ok(text(tree).includes('Godt løft'))
  assert.ok(!text(tree).includes('Egen besked'))
  click('latest')
  assert.deepEqual(events, [['track', 'teknik'], ['tab', 'beskeder']])
})

test('latest shared feedback uses shared date and opens technique', () => {
  const { click, events } = setup({ messages: [{ sender_role: 'coach', created_at: '2026-10-20', content: 'Hej' }],
    sharedVideoAnalyses: [{ created_at: '2026-01-01', shared_at: '2026-10-21' }] })
  click('latest')
  assert.deepEqual(events, [['track', 'teknik'], ['tab', 'beskeder']])
})

test('empty, loading and failure contact states remain visible', () => {
  const { tree } = setup({ sharedVideoLoading: true, sharedVideoError: 'Kunne ikke hente' })
  assert.ok(text(setup().tree).includes('Ingen beskeder'))
  assert.ok(!text(tree).includes('Ingen beskeder'))
  for (const s of ['Henter videofeedback', 'Kunne ikke hente']) assert.ok(text(tree).includes(s))
  assert.equal(all(tree).filter(n => n.props.role === 'status').length, 2)
})

test('unread counts, empty week and preview role do not expose film action', () => {
  const { tree } = setup({ role: 'coach', hasWeek: false, messages: [
      { sender_role: 'coach' }, { sender_role: 'coach' },
      { sender_role: 'coach', category: 'teknik' }, { sender_role: 'athlete' },
    ],
    sharedVideoAnalyses: [{}, { athlete_seen_at: '2026-10-21' }] })
  assert.ok(text(tree).includes('2 ulæste'))
  assert.ok(text(tree).includes('Teknik og videofeedback (2 ulæste)'))
  assert.ok(!all(tree).some(n => ['week', 'film'].includes(n.props.key)))
  assert.ok(!all(setup({ athlete: null }).tree).some(n => n.props.key === 'film'))
})

test('film preserves instant-send entry and readiness uses real isolated handler', () => {
  const frames = [], effects = [], state = { mere: true, readiness: false }
  const { click, events } = setup({ openReadiness: () => openReadinessSurface({
    setTab: v => effects.push(v), setMereOpen: v => { state.mere = v },
    setReadinessOpen: v => { state.readiness = v }, requestFrame: f => frames.push(f),
    matchMedia: () => ({ matches: true }), readinessCardRef: { current: {
      focus: () => effects.push('focus'), scrollIntoView: o => effects.push(o.behavior),
    } },
  }) })
  click('film'); click('readiness')
  assert.deepEqual(events, [['video']])
  assert.deepEqual(state, { mere: false, readiness: true })
  while (frames.length) frames.shift()()
  assert.deepEqual(effects, ['hjem', 'focus', 'auto'])
})

test('week opens existing card then focuses after mount, respecting reduced motion', () => {
  for (const reducedMotion of [true, false]) {
    const frames = [], effects = [], ref = { current: null }
    revealWeek({ setMereOpen: v => effects.push(v), weekStatusRef: ref,
      requestFrame: f => frames.push(f), reducedMotion })
    assert.deepEqual(effects, [true])
    ref.current = { focus: o => effects.push(o), scrollIntoView: o => effects.push(o) }
    while (frames.length) frames.shift()()
    assert.deepEqual(effects, [true, { preventScroll: true }, { behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }])
  }
})

test('week unmount during delayed focus is harmless', () => {
  const frames = []
  revealWeek({ setMereOpen() {}, weekStatusRef: { current: null }, requestFrame: f => frames.push(f) })
  while (frames.length) frames.shift()()
})

test('summary handles invalid dates, preserves inputs and renders text without HTML injection', () => {
  const messages = Object.freeze([Object.freeze({ sender_role: 'coach', content: '<img onerror=alert(1)>', created_at: 'invalid' })])
  assert.equal(contactSummary(messages).text, messages[0].content)
  const { tree } = setup({ messages })
  assert.ok(!all(tree).some(n => n.props.dangerouslySetInnerHTML))
  for (const node of all(tree).filter(n => n.tag === 'button')) {
    assert.equal(node.props.type, 'button')
    assert.ok(node.props.style.minHeight >= 44)
    assert.equal(typeof node.props.onClick, 'function')
  }
})

test('integration retains pinned code and separate prototype', () => {
  const read = f => {
    try { return readFileSync(new URL(f, import.meta.url), 'utf8').replaceAll('\r\n', '\n') }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      return readFileSync(new URL('../' + f, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
    }
  }
  const app = read('AthleteView.jsx'), home = read('HjemTab.jsx')
  assert.ok(app.includes('forenklinger = false'))
  assert.ok(read('App.jsx').includes('forenklinger: forenklinger === true'))
  assert.ok(app.includes('taskShortcuts={forenklinger === true && !enkelOn}'))
  assert.ok(app.includes('setMsgTrack={setMsgTrack}'))
  assert.ok(home.includes("from './athleteShortcuts.mjs'"))
  assert.ok(home.includes('taskShortcuts === true && renderAthleteShortcuts(createElement'))
  for (const name of ['DagensPasCard', 'UgensStatusKort', 'RestPauseFooter', 'DinUgeKort']) {
    assert.equal(home.split('<' + name).length, 2)
  }
  assert.ok(home.includes('setAthleteVideoCoachInstant(true); setAthleteVideoCoachOpen(true)'))
})

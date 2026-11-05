import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Actual copied Home and models; synthetic hook host, no browser/layout claim.
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react'
    ? { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href)}; export const useMemo = fn => fn();`) }
    : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const athlete = { id: 'synthetic-visual', name: 'Testfornavn Testefternavn' }
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-session', weekday: 2, title: 'Syntetisk pas', exercises: [
    { id: 'synthetic-exercise', name: 'Syntetisk løft', sets: 2, note: 'Syntetisk lang note. '.repeat(40) },
  ] }] }
const props = extra => ({ enabled: true, athlete, now: new Date('2026-11-04T12:00:00Z'),
  allWeeks: [week], currentWeek: week, exerciseLogs: [], storage: null, onStartSession() {}, ...extra })
const show = (t, extra) => { const view = mount(Home, props(extra)); t.after(() => view.unmount()); return view }
const text = node => typeof node === 'object' ? node.children.map(text).join('') : String(node)
const coachCard = view => view.nodes(n => n.props['aria-label'] === 'Fra din coach')[0]
const startButton = view => view.nodes(n => n.type === 'button' && /^Start (dagens|næste) pas$/.test(text(n)))[0]

test('visual: Start precedes every exercise/note for today and next, retaining its session callback', t => {
  for (const now of [new Date('2026-11-04T12:00:00Z'), new Date('2026-11-03T12:00:00Z')]) {
    const calls = [], view = show(t, { now, onStartSession: (...args) => calls.push(args) })
    const button = startButton(view), nodes = view.nodes(() => true)
    assert.ok(button)
    assert.equal(button.props.disabled, false)
    for (const description of nodes.filter(n => n.type === 'li' || n.type === 'p' && text(n).startsWith('Coach ·')))
      assert.ok(nodes.indexOf(button) < nodes.indexOf(description))
    button.props.onClick()
    assert.deepEqual(calls, [['synthetic-session', 'synthetic-week']])
    assert.match(view.text(), /0 af 2 sæt klaret/)
    assert.match(view.text(), /Testfornavn/)
    assert.doesNotMatch(view.text(), /Testefternavn/)
    assert.ok(view.nodes(n => n.type?.name === 'HomeCheckIn').length)
    assert.ok(view.nodes(n => n.type?.name === 'QuickLogs').length)
    assert.equal(view.nodes(n => n.props['data-week-sessions'] === '')[0].children[0], 'Ugen: 0 af 1 pas')
  }
})

test('visual: latest long coach text has a bounded preview and one closed native disclosure with exact remainder', t => {
  const content = 'Syntetisk besked. '.repeat(100) + '\n🧪 Slut <script>tekst</script>'
  const messages = Object.freeze([
    { sender_role: 'coach', content: 'Gammel syntetisk besked' },
    { sender_role: 'coach', content, created_at: 'synthetic-time' },
    { sender_role: 'athlete', content: 'Syntetisk atletsvar' },
    { sender_role: 'coach', content: '  ' },
  ].map(Object.freeze))
  const routes = [], view = show(t, { messages, setTab: route => routes.push(route), formatMsgTime: time => `Tid: ${time}` })
  const card = coachCard(view), preview = card.children.find(n => n.type === 'p' && !text(n).startsWith('Fra din coach'))
  const disclosure = card.children.find(n => n.type === 'details')
  assert.ok(disclosure, 'long text must fold')
  assert.equal(disclosure.props.open, undefined)
  assert.equal(disclosure.children[0].type, 'summary')
  assert.equal(text(disclosure.children[0]), 'Læs resten af beskeden')
  assert.ok(disclosure.children[0].props.style.minHeight >= 44)
  assert.ok(Array.from(text(preview)).length <= 160)
  assert.equal(text(preview) + text(disclosure.children[1]), content)
  assert.doesNotMatch(text(card), /Gammel syntetisk besked|Syntetisk atletsvar/)
  assert.match(text(card), /Tid: synthetic-time/)
  card.children.find(n => n.type === 'button').props.onClick()
  assert.deepEqual(routes, ['beskeder'])
})

test('visual: short/empty messages stay quiet; Unicode and whitespace survive splitting once', t => {
  for (const content of ['Kort syntetisk besked', 'x'.repeat(160), '🧪'.repeat(160),
    '🧪'.repeat(161), 'x'.repeat(161), '  Første linje\n\n' + 'syntetisk '.repeat(50)]) {
    const card = coachCard(show(t, { messages: [{ sender_role: 'coach', content }] }))
    const paragraphs = card.children.filter(n => n.type === 'p')
    const disclosure = card.children.find(n => n.type === 'details')
    assert.equal(Boolean(disclosure), Array.from(content).length > 160)
    const preview = paragraphs[1]
    assert.equal(text(preview) + (disclosure ? text(disclosure.children[1]) : ''), content)
    assert.ok(Array.from(text(preview)).length <= 160)
    assert.ok(!/[\uD800-\uDBFF]$/.test(text(preview)), 'never split a surrogate pair')
  }
  for (const messages of [null, [], [{ sender_role: 'coach', content: '\n  ' }]])
    assert.equal(coachCard(show(t, { messages })), undefined)
})

test('visual: read-only, missing callback, stale week, empty/error and OFF retain their guards', t => {
  assert.equal(startButton(show(t, { sessionReadOnly: true })), undefined)
  const unavailable = show(t, { onStartSession: undefined })
  assert.equal(startButton(unavailable).props.disabled, true)
  assert.match(unavailable.text(), /Passet kunne ikke åbnes/)
  const next = { ...week, id: 'synthetic-next', start_date: '2026-11-09' }
  const stale = show(t, { now: new Date('2026-11-11T12:00:00Z'), allWeeks: [week, next] })
  assert.equal(startButton(stale).props.disabled, true)
  assert.match(stale.text(), /En ny uge er startet/)
  for (const extra of [{ programError: true }, { onHoliday: true }, { allWeeks: [], currentWeek: undefined }])
    assert.equal(startButton(show(t, extra)), undefined)
  const forbidden = () => assert.fail('OFF read')
  const off = mount(Home, { enabled: false, get messages() { return forbidden() }, get athlete() { return forbidden() } })
  assert.equal(off.tree, null); off.unmount()
})

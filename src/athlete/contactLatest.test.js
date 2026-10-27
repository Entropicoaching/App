import test from 'node:test'
import assert from 'node:assert/strict'
import { contactLatestEnabled, CONTACT_LATEST_DEFAULT, CONTACT_LATEST_FLAG, latestContactFeedback, formatContactDate, enterContact, scrollContactEnd } from './contactLatest.mjs'
import { contactModules, nodes, text } from './contactHarness.mjs'

const { Contact, lavBeskederOgVaegt } = await contactModules()
const old = { id: 'old', sender_role: 'coach', content: 'Gammel besked', created_at: '2026-10-20T10:00:00Z' }
const recent = { id: 'recent', sender_role: 'coach', category: 'teknik', pinned: true, content: '<img src=x onerror=alert(1)>\nGodt loft', created_at: '2026-10-26T10:00:00Z', read_at: null }
const video = { id: 'video', lift: 'squat', analyzed_at: '2026-10-27T10:00:00Z', athlete_seen_at: null,
  athlete_feedback: { works: [{ text: 'God kontrol' }], focus: [{ text: '<script>literal</script>' }], next_set: [{ text: 'Hold tempo' }] } }
const fail = () => { throw Error('Unexpected action') }
function props(overrides = {}) {
  const p = { contactLatest: true, messages: [], sharedVideoAnalyses: [], sharedVideoLoading: false, sharedVideoError: null,
    msgTrack: 'besked', messageInput: '', messagesEndRef: { current: null }, fetchSharedVideoAnalyses: fail,
    formatMsgTime: x => x, sendAthleteMessage: fail, setMessageInput: fail, setMsgTrack: fail, ...overrides }
  const factory = lavBeskederOgVaegt({ ...p, athlete: { id: 'synthetic' }, openSharedVideoId: null, setOpenSharedVideoId: fail, setTab: fail })
  return { ...p, renderSharedFeedbackCards: factory.renderSharedFeedbackCards }
}
const panel = tree => nodes(tree).find(n => n.type === 'section' && n.props['aria-label'] === 'Seneste feedback fra din coach')

test('flag is default OFF, exact opt-in, storage errors fail closed, no writes', () => {
  assert.equal(CONTACT_LATEST_DEFAULT, false)
  assert.equal(contactLatestEnabled({ getItem: k => { assert.equal(k, CONTACT_LATEST_FLAG); return '1' } }), true)
  for (const value of [null, '', 'true', '0', 1]) assert.equal(contactLatestEnabled({ getItem: () => value }), false)
  assert.equal(contactLatestEnabled({ getItem: fail }), false)
})
test('empty feedback, loading and read errors have distinct states', () => {
  assert.match(text(panel(Contact(props()))), /Ingen feedback endnu/)
  const loading = text(panel(Contact(props({ sharedVideoLoading: true }))))
  assert.match(loading, /Henter/); assert.doesNotMatch(loading, /Ingen feedback/)
  const error = text(panel(Contact(props({ sharedVideoError: 'Kunne ikke hentes' }))))
  assert.match(error, /Kunne ikke hentes/); assert.doesNotMatch(error, /Ingen feedback/)
})
test('newest coach text across tracks sits above older messages, remains unread and literal', () => {
  const messages = structuredClone([recent, old, { ...recent, id: 'athlete', sender_role: 'athlete', content: 'Atlet svar', created_at: '2026-10-28T00:00:00Z' }])
  const before = structuredClone(messages)
  const tree = Contact(props({ messages }))
  assert.match(text(panel(tree)), /26\. oktober 2026/)
  assert.match(text(panel(tree)), /Ulæst/)
  assert.ok(text(tree).indexOf(recent.content) < text(tree).indexOf(old.content))
  assert.equal(text(tree).split(recent.content).length - 1, 1)
  assert.ok(nodes(tree).every(n => !n.props.dangerouslySetInnerHTML && n.type !== 'img'))
  assert.deepEqual(messages, before)
})
test('latest video uses existing structured feedback and expanded card without acknowledgement', () => {
  const analyses = structuredClone([video, { ...video, id: 'older-video', analyzed_at: '2026-10-22T00:00:00Z' }])
  const before = structuredClone(analyses)
  const tree = Contact(props({ messages: [recent, old], sharedVideoAnalyses: analyses, msgTrack: 'teknik' }))
  const top = panel(tree)
  for (const label of ['God kontrol', '<script>literal</script>', 'Hold tempo', 'Det fungerer', 'Dit fokus', 'Næste gang', 'Ulæst']) assert.ok(text(top).includes(label), label)
  assert.equal(nodes(top).filter(n => n.props.onClick && text(n).includes('Skjul')).length, 0)
  assert.ok(nodes(top).every(n => n.type !== 'script' && !n.props.dangerouslySetInnerHTML))
  assert.deepEqual(analyses, before)
})
test('latest selection sorts by time, tolerates bad dates, stable ties, never mutates inputs', () => {
  assert.equal(latestContactFeedback([{ ...recent, created_at: '2026-02-30' }, old]).value, old)
  assert.equal(latestContactFeedback([{ ...recent, created_at: null }]).date, null)
  assert.equal(latestContactFeedback([recent, { ...recent, id: 'tie' }]).value, recent)
  assert.equal(latestContactFeedback([{ ...recent, sender_role: 'athlete' }, { ...recent, content: '  ' }]), null)
  assert.equal(latestContactFeedback([recent], [video]).value, video)
  assert.equal(formatContactDate('2026-10-26T23:30:00Z'), '27. oktober 2026')
  for (const date of [null, '', 'nonsense', '2026-02-30', '2026-10-27T12:00:00']) assert.equal(formatContactDate(date), 'Dato ukendt')
})
test('actual entry and scroll handlers preserve unread with flag ON; OFF keeps legacy calls', () => {
  for (const enabled of [false, true]) for (const track of ['besked', 'teknik']) {
    const calls = []
    enterContact({ enabled, track, fetchMessages: () => calls.push('messages'), markRead: t => calls.push(t), fetchVideos: () => calls.push('videos') })
    assert.deepEqual(calls, ['messages', ...(!enabled ? [track] : []), ...(enabled || track === 'teknik' ? ['videos'] : [])])
    scrollContactEnd(enabled, { current: { scrollIntoView: options => calls.push(options) } })
    assert.equal(typeof calls.at(-1) === 'object', !enabled)
  }
})
test('flag OFF produces exactly the pinned baseline DOM and existing renderer DOM', async () => {
  const [{ default: Base }, { lavBeskederOgVaegt: baseFactory }] = await Promise.all([import('./contactBaseBeskederTab.jsx'), import('./contactBaseFactory.jsx')])
  for (const enabled of [undefined, false]) for (const track of ['besked', 'teknik']) for (const data of [[], [video]]) {
    const p = props({ contactLatest: enabled, messages: [old, recent], sharedVideoAnalyses: data, msgTrack: track })
    const b = baseFactory({ ...p, athlete: { id: 'synthetic' } })
    // Callback identity differs by module instance; compare rendered semantics.
    const snapshot = tree => JSON.stringify(tree, (key, value) => typeof value === 'function' ? '[handler]' : value)
    assert.equal(snapshot(Contact(p)), snapshot(Base({ ...p, renderSharedFeedbackCards: b.renderSharedFeedbackCards })))
    assert.equal(snapshot(p.renderSharedFeedbackCards()), snapshot(b.renderSharedFeedbackCards()))
    assert.equal(panel(Contact(p)), undefined)
  }
})

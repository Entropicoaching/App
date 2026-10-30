import { useTestRelease } from './trin1TestProfile.mjs'
// These fixtures exercise the legacy contract, independently of the shipped step.
useTestRelease(0)
const { assertNoteDependencies } = await import('./coachNoteDependencyGuard.mjs')
import test from 'node:test'
import assert from 'node:assert/strict'
const { pendingCoachNotes, COACH_NOTE_SIGNAL_ENABLED } = await import('./coachNoteSignal.js')
const { summarizeCoachMessages } = await import('./coachInboxState.js')
const { app, nodes, text, source } = await import('./coachNoteTestHelpers.mjs')

const athlete = { id: 'a', name: 'Syntetisk Atlet' }
const note = (id, date, extra = {}) => ({ id, athlete_id: 'a', sender_role: 'athlete',
  category: 'besked', content: `Note ${id}`, created_at: date, read_by_coach: true, ...extra })
const old = note('old', '2020-01-01T10:00:00Z')
const reply = (extra = {}) => note('reply', '2026-10-26T12:00:00Z', { sender_role: 'coach', content: 'Tak for din note', ...extra })
const plain = value => JSON.parse(JSON.stringify(value))
const noop = () => {}

test('note lever til et senere gemt svar i samme atlet og spor, uden aldersgraense', () => {
  assert.equal(pendingCoachNotes([old]).a.besked.count, 1)
  assert.deepEqual(pendingCoachNotes([old, reply()]), {})
  assert.equal(pendingCoachNotes([old, reply({ category: 'teknik' })]).a.besked.count, 1)
  assert.equal(pendingCoachNotes([old, reply({ athlete_id: 'b' })]).a.besked.count, 1)
  assert.deepEqual(pendingCoachNotes([old, reply({ category: null })]), {})
})

test('senere note genoptager traaden; inputraekkefoelge og laest-status aendrer intet', () => {
  const latest = note('new', '2026-10-26T13:00:00Z')
  const rows = [old, reply(), latest]
  const before = JSON.stringify(rows)
  assert.equal(pendingCoachNotes(rows).a.besked.latestNote.id, 'new')
  assert.deepEqual(pendingCoachNotes(rows), pendingCoachNotes([...rows].reverse()))
  assert.equal(JSON.stringify(rows), before)
  assert.equal(pendingCoachNotes([{ ...old, read_by_coach: false }]).a.besked.count, 1)
})

test('ugyldigt eller tomt svar afslutter ikke; ens tid bevares konservativt', () => {
  for (const invalid of [{ content: ' ' }, { created_at: 'bad' }, { sender_role: 'system' }, { created_at: null }]) {
    assert.equal(pendingCoachNotes([old, reply(invalid)]).a.besked.count, 1)
  }
  assert.equal(pendingCoachNotes([old, reply({ created_at: old.created_at })]).a.besked.count, 1)
  assert.deepEqual(pendingCoachNotes([null, note('bad', 'bad'), { ...old, athlete_id: null }]), {})
})

test('default OFF bevarer summary og gammel prioritering, selv ved truthy flag', async () => {
  assert.equal(COACH_NOTE_SIGNAL_ENABLED, false)
  const load = await app()
  const { buildCoachPriorityItems } = await load('src/coachPriority.js')
  const summary = summarizeCoachMessages([old])
  assert.deepEqual(Object.keys(summary).sort(), ['latestByTrack', 'unreadByTrack', 'unreadCounts'])
  const options = { athletes: [athlete], trainingSignals: [], videoReviewQueue: [], ...summary,
    pendingByTrack: pendingCoachNotes([old]), describeVideo: noop }
  assert.equal(buildCoachPriorityItems(options).length, 0)
  assert.equal(buildCoachPriorityItems({ ...options, noteSignalEnabled: 'true' }).length, 0)
  const unread = summarizeCoachMessages([{ ...old, read_by_coach: false }, reply()])
  assert.equal(buildCoachPriorityItems({ ...options, ...unread }).length, 1)
})

async function flow(enabled = true) {
  const rows = [structuredClone(old)]
  const calls = []
  let failSend = false, failRead = false
  const backend = { from(table) {
    assert.equal(table, 'messages')
    return {
      select() { return { in() { return { async order() {
        return failRead ? { error: new Error('syntetisk') } : { data: structuredClone(rows) }
      } } } } },
      async insert(value) {
        calls.push(value)
        if (failSend) return { error: new Error('syntetisk') }
        rows.push({ ...value, id: 'saved', created_at: '2026-10-26T12:00:00Z' })
        return { error: null }
      },
      update() { return { eq() { return this }, or() { return this }, then(resolve) { resolve({ error: null }) } } },
    }
  } }
  const load = await app({ enabled, backend })
  const state = { pendingByTrack: {}, latestByTrack: {}, unreadByTrack: {}, input: 'Svar', error: null }
  const { lavLaesninger } = await load('src/dashboard/laesninger.js')
  const { fetchLatestMessages } = lavLaesninger({
    setUnreadCounts: noop, setUnreadByTrack: v => state.unreadByTrack = v,
    setLatestByTrack: v => state.latestByTrack = v, setPendingByTrack: v => state.pendingByTrack = v,
    setMessageInboxError: v => state.error = v,
  })
  const { useCoachPrioritet } = await load('src/dashboard/useCoachPrioritet.js')
  const items = () => useCoachPrioritet({ athletes: [athlete], hiddenAthleteIds: new Set(),
    trainingSignals: [], videoReviewQueue: [], automationAlerts: [], ...state }).coachPriorityItems
  const { lavIndbakkeHandlinger } = await load('src/dashboard/indbakkeHandlinger.js')
  const handlers = track => lavIndbakkeHandlinger({ athletes: [athlete], coachMsgTrack: track,
    messageInput: state.input, selectedAthlete: athlete, sendingMessage: false,
    messageThreadAthleteRef: { current: 'a' }, fetchLatestMessages, fetchMessages: noop,
    setMessageInput: v => state.input = v, setMessageSendError: v => state.error = v,
    setSendingMessage: noop, setMessages: noop,
  })
  return { load, rows, calls, state, items, handlers, refresh: () => fetchLatestMessages(['a']),
    failSend: () => failSend = true, failRead: () => failRead = true }
}

test('rigtig laeser, hook og send-handler: andet spor bevarer, samme spor afslutter', async () => {
  const f = await flow()
  await f.refresh()
  assert.equal(f.items().length, 1)
  assert.equal(f.calls.length, 0)
  await f.handlers('teknik').sendCoachMessage()
  assert.equal(f.items().length, 1)
  f.state.input = 'Svar i den rigtige traad'
  await f.handlers('besked').sendCoachMessage()
  assert.equal(f.items().length, 0)
  assert.equal(f.calls[1].category, 'besked')
  assert.equal(f.calls[1].sender_role, 'coach')
  assert.equal(f.state.input, '')
})

test('mislykket send og laesning bevarer signal og kladde', async () => {
  const f = await flow()
  await f.refresh()
  f.failSend()
  await f.handlers('besked').sendCoachMessage()
  assert.equal(f.state.input, 'Svar')
  assert.equal(f.items().length, 1)
  assert.ok(f.state.error)
  f.failRead()
  assert.equal(await f.refresh(), false)
  assert.equal(f.items().length, 1)
})

test('OFF gennem den rigtige laeser og hook skjuler en laest gammel note', async () => {
  const f = await flow(false)
  await f.refresh()
  assert.equal(f.items().length, 0)
  assert.deepEqual(plain(f.state.pendingByTrack), {})
  assert.equal(f.calls.length, 0)
})

test('syntetisk DOM fra rigtig IndbakkeView viser note og aabner samme spor', async () => {
  const f = await flow()
  await f.refresh()
  const { default: IndbakkeView } = await f.load('src/dashboard/IndbakkeView.jsx')
  const opened = []
  const render = () => IndbakkeView({ athletes: [athlete], hiddenAthleteIds: new Set(),
    ...f.state, coachPriorityItems: f.items(), inboxRefreshStatus: { kind: 'success' },
    openCoachPriorityItem: item => opened.push(item), setCoachMsgTrack: noop, openProfile: noop,
  })
  const tree = render()
  assert.match(text(tree), /Note old/)
  const button = nodes(tree).find(n => n.type === 'button' && n.props.style?.padding === 0 && text(n).includes('Note old'))
  assert.ok(button)
  button.props.onClick()
  assert.equal(opened[0].track, 'besked')
  assert.equal(opened[0].athlete.id, 'a')
  assert.equal(f.calls.length, 0)
  await f.handlers('besked').sendCoachMessage()
  assert.equal(f.items().length, 0)
  assert.ok(!nodes(render()).some(n => n.type === 'button' && n.props.style?.padding === 0 && text(n).includes('Note old') && text(n).includes('Besked')))
})

test('Dashboard forbinder pending state til begge fabrikker', () => {
  const code = source('src/Dashboard.jsx')
  assert.match(code, /\[pendingByTrack, setPendingByTrack\] = useState\(\{\}\)/)
  assert.match(code, /setLatestByTrack, setLoadError, setPendingByTrack/)
  assert.match(code, /latestByTrack, pendingByTrack, openCoachPriorityItem/)
})

test('notesignalets transitive kaede har ingen net eller lagring', () => {
  assertNoteDependencies(source)
})

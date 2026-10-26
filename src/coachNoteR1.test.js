import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text } from './coachNoteTestHelpers.mjs'

const row = { id: 'old', athlete_id: 'a', sender_role: 'athlete', category: 'teknik',
  content: 'Gammel tekniknote', created_at: '2020-01-01T10:00:00Z', read_by_coach: true }

test('R1: samtidige modulgrafer holder flag og backend adskilt uden VM-flag', async () => {
  const calls = []
  const backend = name => ({ from(table) {
    calls.push([name, table])
    return { select() { return { in() { return { async order() { return { data: [row] } } } } } } }
  } })
  const [on, off] = await Promise.all([
    app({ enabled: true, backend: backend('on') }),
    app({ enabled: false, backend: backend('off') }),
  ])
  const [a, b] = await Promise.all([on('src/dashboard/laesninger.js'), off('src/dashboard/laesninger.js')])
  const states = [null, null]
  const make = (module, i) => module.lavLaesninger({
    setUnreadCounts() {}, setUnreadByTrack() {}, setLatestByTrack() {}, setMessageInboxError() {},
    setPendingByTrack(value) { states[i] = value },
  })
  await Promise.all([make(a, 0).fetchLatestMessages(['a']), make(b, 1).fetchLatestMessages(['a'])])
  assert.equal(states[0].a.teknik.count, 1)
  assert.equal(states[1], null)
  assert.deepEqual(calls.sort(), [['off', 'messages'], ['on', 'messages']])
  assert.equal((await on('src/coachNoteSignal.js')).COACH_NOTE_SIGNAL_ENABLED, true)
  assert.equal((await off('src/coachNoteSignal.js')).COACH_NOTE_SIGNAL_ENABLED, false)
  assert.equal((await (await app())('src/coachNoteSignal.js')).COACH_NOTE_SIGNAL_ENABLED, false)
})

test('R1: rigtig DOM aabner tekniknoten paa den rigtige atlet uden skrivning', async () => {
  const load = await app({ enabled: true })
  const { summarizeCoachMessages } = await load('src/coachInboxState.js')
  const { useCoachPrioritet } = await load('src/dashboard/useCoachPrioritet.js')
  const { default: View } = await load('src/dashboard/IndbakkeView.jsx')
  const athletes = [{ id: 'a', name: 'Syntetisk A' }]
  const summary = summarizeCoachMessages([row], { noteSignalEnabled: true })
  const { coachPriorityItems } = useCoachPrioritet({ athletes, hiddenAthleteIds: new Set(),
    trainingSignals: [], videoReviewQueue: [], ...summary })
  const opened = []
  const tree = View({ athletes, hiddenAthleteIds: new Set(), ...summary, coachPriorityItems,
    inboxRefreshStatus: { kind: 'success' }, openCoachPriorityItem: item => opened.push(item),
    setCoachMsgTrack() {}, openProfile() {},
  })
  const button = nodes(tree).find(n => n.type === 'button' && n.props.style?.padding === 0 && text(n).includes(row.content))
  assert.ok(button)
  button.props.onClick()
  assert.equal(opened.length, 1)
  assert.equal(opened[0].athlete.id, 'a')
  assert.equal(opened[0].track, 'teknik')
})

test('R1: syntetisk loader afviser ikke-pinnede afhaengigheder', async () => {
  const load = await app()
  assert.throws(() => load('node:fs'), /Unapproved synthetic dependency/)
  assert.throws(() => load('src/not-pinned.js'), /Unapproved synthetic dependency/)
})

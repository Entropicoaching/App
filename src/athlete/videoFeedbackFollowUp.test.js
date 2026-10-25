import assert from 'node:assert/strict'
import test from 'node:test'
import { openVideoFeedbackFollowUp } from './videoFeedbackFollowUp.mjs'

function click(analysis, draft = '', track = 'besked', tab = 'hjem', lift, variation) {
  const state = { draft, track, tab, effects: [] }
  const actions = {
    setMessageInput: update => { state.effects.push('kladde'); state.draft = update(state.draft) },
    setMsgTrack: value => { state.effects.push('spor'); state.track = value },
    setTab: value => { state.effects.push('fane'); state.tab = value },
  }
  openVideoFeedbackFollowUp(analysis, actions, lift, variation)
  return { state, actions }
}

test('Genvejen aabner eksisterende kladde i tekniksporet fra Hjem', () => {
  const { state } = click({ analyzed_at: '2026-10-21T12:00:00Z', lift: 'bench', variation: 'pause' }, '', 'besked', 'hjem', 'Bænkpres', 'Pause bænk')
  assert.equal(state.track, 'teknik')
  assert.equal(state.tab, 'beskeder')
  assert.equal(state.draft, `Jeg har et spørgsmål til din videofeedback (${new Date('2026-10-21T12:00:00Z').toLocaleDateString('da-DK')}, Bænkpres, Pause bænk): `)
  assert.deepEqual(state.effects, ['kladde', 'spor', 'fane'])
})
test('Eksisterende tekst bevares og gentaget tryk dublerer ikke henvisningen', () => {
  const analysis = { lift: 'squat' }
  const { state, actions } = click(analysis, 'Mit eget spørgsmål', 'teknik', 'beskeder', 'Squat')
  const first = state.draft
  assert.ok(first.startsWith('Mit eget spørgsmål\n'))
  openVideoFeedbackFollowUp(analysis, actions, 'Squat')
  assert.equal(state.draft, first)
})
test('Valgt kort bestemmer dato og oevelse', () => {
  const first = click({ analyzed_at: '2026-09-02', lift: 'squat' }, '', 'besked', 'hjem', 'Squat').state
  const second = click({ analyzed_at: '2026-10-23', lift: 'deadlift' }, first.draft, 'teknik', 'beskeder', 'Dødløft').state
  assert.ok(second.draft.includes('Dødløft'))
  assert.ok(second.draft.includes(new Date('2026-10-23').toLocaleDateString('da-DK')))
  assert.ok(second.draft.startsWith(first.draft))
})
test('Tom maaling giver ingen dato, oevelse eller standardvariation', () => {
  for (const analysis of [undefined, null, {}, { analyzed_at: null, lift: '', variation: null }]) {
    assert.equal(click(analysis, '', 'besked', 'hjem', 'Squat', 'Konkurrence squat').state.draft,
      'Jeg har et spørgsmål til din videofeedback: ')
  }
})
test('Ugyldige og tomme datoer bliver ikke til dags dato eller 1970', () => {
  for (const analyzed_at of ['', ' ', null, 0, 'ukendt', '2026-02-30', '2026-13-01', '2026-10-25T99:00:00Z']) {
    assert.equal(click({ analyzed_at }).state.draft, 'Jeg har et spørgsmål til din videofeedback: ')
  }
})
test('Kendt dato uden oevelse bevares uden opdigtet loeft', () => {
  const analyzed_at = '2026-10-21'
  assert.equal(click({ analyzed_at }, '', 'besked', 'hjem', 'Squat').state.draft,
    `Jeg har et spørgsmål til din videofeedback (${new Date(analyzed_at).toLocaleDateString('da-DK')}): `)
})
test('Manglende variation bliver ikke en konkurrencevariation', () => {
  assert.equal(click({ lift: 'squat' }, '', 'besked', 'hjem', 'Squat', 'Konkurrence squat').state.draft,
    'Jeg har et spørgsmål til din videofeedback (Squat): ')
})
test('Ukendt loeft bruger kun det oplyste navn', () => {
  assert.equal(click({ lift: 'specialløft' }).state.draft, 'Jeg har et spørgsmål til din videofeedback (specialløft): ')
})
test('Maaling, feedback og tal aendres ikke', () => {
  const analysis = Object.freeze({ analyzed_at: '2026-10-21', lift: 'bench', load_kg: 0, rpe: null,
    reps_count: 3, metrics: Object.freeze({ rom: 42 }), athlete_feedback: Object.freeze({ focus: [] }) })
  const before = JSON.stringify(analysis)
  const { state } = click(analysis, '', 'teknik', 'beskeder', 'Bænkpres')
  assert.equal(JSON.stringify(analysis), before)
  assert.deepEqual(state.effects, ['kladde', 'spor', 'fane'])
  assert.ok(!state.draft.includes('42'))
  assert.ok(!state.draft.includes('kg'))
})

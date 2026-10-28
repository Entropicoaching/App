import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './nytTestLoader.mjs'
import { mount, button } from './nytTestDom.mjs'
install()
const { default: NytIAppen, nytAthleteNavigation, nytCoachNavigation } = await import('./nytIAppen.mjs')
const { nytIAppenText: copy } = await import('./nytIAppenText.mjs')
const { previewNavigation } = await import('./nytBasePrototype.mjs')
const { readinessNavigation } = await import('./nytBaseReadiness.mjs')
const { lavNavigation } = await import('./nytBaseNavigation.mjs')

test('card links run the pinned athlete navigation chain in legacy and simple views', () => {
  for (const enkel of [false, true]) {
    const state = {}, set = key => value => { state[key] = value }
    const navigate = previewNavigation(enkel, set('tab'), set('route'))
    const onNavigate = nytAthleteNavigation({ setTab: readinessNavigation(navigate, set('readiness')),
      setMsgTrack: set('track'), setMobilityMode: set('mode') })
    const ui = mount(NytIAppen, { search: '?rel1030=1', role: 'athlete', profileId: 'A', storage: null, onNavigate })
    for (const [id, tab, route] of [['mobilitet', 'mobilisering', 'mobilisering'], ['tidsmarkeringer', 'beskeder', 'kontakt'], ['fremgang', 'fremgang', 'styrke']]) {
      button(ui.render(), copy.items.find(i => i.id === id).label).onClick()
      assert.equal(state.tab, tab)
      assert.equal(state.readiness, false)
      if (enkel) assert.equal(state.route, route)
    }
  }
})

test('coach card runs pinned openProfile, preserving its navigation resets and explicit target', async () => {
  const state = {}, refs = { viewRef: { current: 'inbox' }, listScrollYRef: { current: 9 }, messageThreadAthleteRef: { current: null } }
  const setters = new Proxy({}, { get: (_, key) => value => { state[key] = value } })
  // Supply only synthetic state and a resolved local lazy factory. No effects or backend.
  const args = { ...refs, analyseTabFactory: () => Promise.resolve({}) }
  for (const name of ['setProfileReturnView', 'setProfilePriorityKey', 'setProfilePriorityContext', 'setVideoAnalysisReview',
    'setVideoAnalysisReviewError', 'setSelectedAthlete', 'setActiveTab', 'setEditing', 'setView', 'setMessages', 'setMessageInput',
    'setMessageThreadError', 'setMessageSendError', 'setWeeks', 'setAthleteWeightLogs', 'setOpenWeekId', 'setProgramBlockStart',
    'setOpenSessionId', 'setAddingWeek', 'setAddingSession', 'setAddingExercise', 'setEditingWeek', 'setEditingSession', 'setEditingExercise']) args[name] = setters[name]
  const { openProfile } = lavNavigation(args)
  const onNavigate = nytCoachNavigation({ ...args, openProfile })
  const athlete = { id: 'synthetic-A', name: 'Atlet A' }
  const ui = mount(NytIAppen, { search: '?rel1030=1', role: 'coach', profileId: 'coach-A', storage: null, athletes: [athlete], onNavigate })
  for (const id of ['analyse', 'tidsmarkeringer', 'fremgang']) {
    button(ui.render(), copy.items.find(i => i.id === id).label).onClick()
    button(ui.render(), athlete.name).onClick()
    assert.equal(state.setView, 'profile')
    assert.equal(state.setSelectedAthlete, athlete)
    assert.equal(state.setActiveTab, id === 'fremgang' ? 'oversigt' : 'analyse')
    assert.equal(refs.messageThreadAthleteRef.current, athlete.id)
    assert.deepEqual(state.setMessages, [])
    assert.equal(state.setVideoAnalysisReview, null)
  }
  await Promise.resolve()
})

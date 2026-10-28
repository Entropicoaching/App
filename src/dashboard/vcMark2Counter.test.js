import './vcMark2Loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readMarkerTemplates, saveMarkerTemplate, readMarkerNotes, saveMarkerNote } from './vcMarkerTemplates.mjs'
import { mount, text, button, field, nodes } from './vcMark2Dom.mjs'
const { default: Panel } = await import('./VideoMarkerTemplates.mjs')
const { default: Modal } = await import('./VideoReviewModal.jsx')
const scope = { coachId: 'coach-one', athleteId: 'athlete-one', analysisId: 'analysis-one' }
const row = { start: 0, end: 4, text: '<script>$& Æøå</script>' }
function store() {
  const data = new Map(); let writes = 0, deny = false
  return { data, get writes() { return writes }, deny() { deny = true },
    getItem(k) { return data.get(k) ?? null },
    setItem(k, v) { if (deny) throw Error('quota'); writes++; data.set(k, v) } }
}
test('counter 1: account/athlete/video switch clears opened draft and template selection', () => {
  const s = store(); saveMarkerTemplate(s, scope.coachId, row)
  for (const key of ['coachId', 'athleteId', 'analysisId']) {
    const app = mount(Modal, {}), props = { coachId: scope.coachId,
      selectedAthlete: { id: scope.athleteId }, videoAnalysisReview: { id: scope.analysisId,
        athlete_id: scope.athleteId, status: 'draft' }, videoBaselines: [], videoAnalyses: [],
      videoAnalysisFeedbackDraft: { works: '', focus: '', next_set: '' } }
    globalThis.localStorage = { getItem: k => k === 'vc-epik2-playback' ? '1' : s.getItem(k), setItem: s.setItem }
    button(app.render(props), 'Åbn markeringsskabeloner').onClick()
    button(app.render(props), `Brug: ${row.text}`).onClick()
    assert.equal(field(app.render(props), 'Tekst til markeringen').value, row.text)
    if (key === 'coachId') props.coachId = 'coach-two'
    if (key === 'athleteId') { props.selectedAthlete.id = 'athlete-two'; props.videoAnalysisReview.athlete_id = 'athlete-two' }
    if (key === 'analysisId') props.videoAnalysisReview.id = 'analysis-two'
    assert.doesNotMatch(text(app.render(props)), /Gem som markeringsskabelon/)
    button(app.render(props), 'Åbn markeringsskabeloner').onClick()
    assert.equal(field(app.render(props), 'Tekst til markeringen').value, '')
  }
  delete globalThis.localStorage
})
test('counter 2: markup stays literal and failed delete preserves library and reused draft', () => {
  const s = store(); saveMarkerTemplate(s, scope.coachId, row)
  const app = mount(Panel, { ...scope, storage: () => s })
  button(app.render(), 'Åbn markeringsskabeloner').onClick()
  button(app.render(), `Brug: ${row.text}`).onClick()
  assert.equal(nodes(app.render(), n => n.type === 'script').length, 0)
  s.deny(); button(app.render(), `Slet skabelon: ${row.text}`).onClick()
  assert.match(text(app.render()), /Ikke gemt: quota/)
  assert.equal(field(app.render(), 'Tekst til markeringen').value, row.text)
  assert.deepEqual(readMarkerTemplates(s, scope.coachId), [row])
  assert.equal(s.writes, 1)
})
test('counter 3: missing duration and poisoned note identity cannot write or overwrite', () => {
  const s = store()
  for (const duration of [undefined, null, NaN, 0, -1, '8', Infinity])
    assert.throws(() => saveMarkerNote(s, scope, row, duration))
  saveMarkerNote(s, scope, row, 8)
  const [key, raw] = [...s.data.entries()][0]
  for (const mutate of [data => { delete data.rows[0].duration },
    data => { data.athleteId = 'other' }, data => { data.rows[0].end = 9 }]) {
    const data = JSON.parse(raw); mutate(data); s.data.set(key, JSON.stringify(data))
    assert.throws(() => readMarkerNotes(s, scope))
    assert.throws(() => saveMarkerNote(s, scope, row, 8))
  }
  assert.equal(s.writes, 1)
})
test('counter 4: read denial keeps modal closed when marker flag cannot be read', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied') } })
  const app = mount(Modal, { coachId: scope.coachId, selectedAthlete: { id: scope.athleteId },
    videoAnalysisReview: { id: scope.analysisId, athlete_id: scope.athleteId, status: 'draft' },
    videoBaselines: [], videoAnalyses: [], videoAnalysisFeedbackDraft: {} })
  assert.doesNotMatch(text(app.render()), /Åbn markeringsskabeloner/)
  delete globalThis.localStorage
})
test('counter 5: two mounted panels read current library before save/delete', () => {
  const s = store(), apps = [0, 1].map(() => mount(Panel, { ...scope, storage: () => s }))
  for (const app of apps) button(app.render(), 'Åbn markeringsskabeloner').onClick()
  for (const [index, app] of apps.entries()) {
    for (const [label, value] of [['Start i sekunder', '0'], ['Slut i sekunder', '4'], ['Tekst til markeringen', `Cue ${index}`]])
      field(app.render(), label).onChange({ target: { value } })
    button(app.render(), 'Gem som markeringsskabelon').onClick()
  }
  assert.deepEqual(readMarkerTemplates(s, scope.coachId).map(r => r.text), ['Cue 0', 'Cue 1'])
  button(apps[0].render(), 'Slet skabelon: Cue 0').onClick()
  assert.deepEqual(readMarkerTemplates(s, scope.coachId).map(r => r.text), ['Cue 1'])
})
test('counter 6: no template or note operation touches existing message or playback storage', () => {
  const s = store(), oldKey = 'entropi_coach_message_templates_v1:coach-one'
  s.data.set(oldKey, 'existing'); s.data.set('vc-epik2-playback', '1')
  saveMarkerTemplate(s, scope.coachId, row); saveMarkerNote(s, scope, row, 8)
  assert.equal(s.data.get(oldKey), 'existing'); assert.equal(s.data.get('vc-epik2-playback'), '1')
  assert.equal(s.data.size, 4)
})

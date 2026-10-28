import './vcMark2Loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { markerCopy, readMarkerTemplates, saveMarkerTemplate, deleteMarkerTemplate,
  readMarkerNotes, saveMarkerNote } from './vcMarkerTemplates.mjs'
const { default: VideoMarkerTemplates } = await import('./VideoMarkerTemplates.mjs')
const { default: Modal } = await import('./VideoReviewModal.jsx')
import { mount, text, button, field, nodes } from './vcMark2Dom.mjs'

const cue = 'Hold brystet oppe ud af bunden'
const marker = () => ({ start: 1.25, end: 3.5, text: cue })
const scope = { coachId: 'coach-a', athleteId: 'athlete-a', analysisId: 'analysis-a' }
function memory() {
  const data = new Map(), reads = [], writes = []
  return { data, reads, writes, getItem(k) { reads.push(k); return data.get(k) ?? null },
    setItem(k, v) { writes.push([k, v]); data.set(k, v) } }
}
function editor(storage = memory(), props = scope) {
  const app = mount(VideoMarkerTemplates, { ...props, storage: () => storage })
  const render = next => app.render(next ? { ...next, storage: () => storage } : undefined)
  button(render(), 'Åbn markeringsskabeloner').onClick()
  return { storage, render }
}
function change(e, label, value) { field(e.render(), label).onChange({ target: { value } }) }
function fill(e, value = marker()) {
  change(e, 'Start i sekunder', String(value.start)); change(e, 'Slut i sekunder', String(value.end))
  change(e, 'Tekst til markeringen', value.text); change(e, 'Klippets varighed i sekunder', '8')
}

test('model: save, read clones, reuse strips clip identity and delete is per coach', () => {
  const s = memory(), source = { ...marker(), athleteId: 'old', strokes: [{ points: [] }] }
  saveMarkerTemplate(s, 'coach-a', source); source.text = 'changed'
  const loaded = readMarkerTemplates(s, 'coach-a')
  assert.deepEqual(loaded, [marker()]); loaded[0].text = 'also changed'
  assert.deepEqual(readMarkerTemplates(s, 'coach-a'), [marker()])
  assert.deepEqual(readMarkerTemplates(s, 'coach-b'), [])
  saveMarkerTemplate(s, 'coach-b', marker()); deleteMarkerTemplate(s, 'coach-a', marker())
  assert.deepEqual(readMarkerTemplates(s, 'coach-a'), [])
  assert.deepEqual(readMarkerTemplates(s, 'coach-b'), [marker()])
})
test('model: exact duplicate saves are idempotent; fifty rows maximum', () => {
  const s = memory()
  saveMarkerTemplate(s, 'coach-a', marker()); saveMarkerTemplate(s, 'coach-a', marker())
  assert.equal(s.writes.length, 1)
  for (let i = 1; i < 50; i++) saveMarkerTemplate(s, 'coach-a', { ...marker(), text: `Cue ${i}` })
  assert.throws(() => saveMarkerTemplate(s, 'coach-a', { ...marker(), text: 'Full' }), /50/)
  assert.equal(readMarkerTemplates(s, 'coach-a').length, 50)
})
test('model: invalid times and text are rejected before any storage writes', () => {
  const s = memory()
  for (const bad of [null, { ...marker(), start: -1 }, { ...marker(), start: '1' },
    { ...marker(), end: Infinity }, { ...marker(), start: NaN }, { ...marker(), end: 1.25 },
    { ...marker(), end: 7201 }, { ...marker(), text: '  ' }, { ...marker(), text: 'x'.repeat(2001) }]) {
    assert.throws(() => saveMarkerTemplate(s, 'coach-a', bad))
  }
  assert.throws(() => saveMarkerTemplate(s, '../coach', marker()))
  assert.deepEqual(s.writes, [])
  assert.equal(markerCopy({ start: 0, end: 7200, text: 'x'.repeat(2000) }).end, 7200)
})
test('model: corrupt or wrong-owner storage cannot be overwritten by save/delete', () => {
  for (const raw of ['{', 'null', '[]', 'x'.repeat(250001),
    JSON.stringify({ schema: 'vc-marker-templates/v1', coachId: 'coach-b', rows: [] }),
    JSON.stringify({ schema: 'vc-marker-templates/v1', coachId: 'coach-a', rows: [{ ...marker(), end: null }] })]) {
    const s = memory(); s.data.set('entropi_vc_marker_templates_v1:coach-a', raw)
    assert.throws(() => saveMarkerTemplate(s, 'coach-a', marker()))
    assert.throws(() => deleteMarkerTemplate(s, 'coach-a', marker()))
    assert.deepEqual(s.writes, [])
  }
})
test('DOM: save template, one click reuse on new video, edit then explicit local save', () => {
  const e = editor(); fill(e)
  button(e.render(), 'Gem som markeringsskabelon').onClick()
  assert.match(text(e.render()), /Skabelon gemt/)
  assert.equal(e.storage.writes.length, 1)
  const other = editor(e.storage, { ...scope, analysisId: 'analysis-b', athleteId: 'athlete-b' })
  assert.equal(field(other.render(), 'Tekst til markeringen').value, '')
  button(other.render(), `Brug: ${cue}`).onClick()
  assert.equal(field(other.render(), 'Start i sekunder').value, '1.25')
  assert.equal(field(other.render(), 'Slut i sekunder').value, '3.5')
  assert.equal(field(other.render(), 'Tekst til markeringen').value, cue)
  assert.equal(e.storage.writes.length, 1)
  change(other, 'Tekst til markeringen', 'Ret brystet op'); change(other, 'Klippets varighed i sekunder', '8')
  button(other.render(), 'Gem markering lokalt').onClick()
  assert.deepEqual(readMarkerNotes(e.storage, { ...scope, analysisId: 'analysis-b', athleteId: 'athlete-b' }),
    [{ ...marker(), text: 'Ret brystet op', duration: 8 }])
  assert.deepEqual(readMarkerNotes(e.storage, scope), [])
  assert.equal(readMarkerTemplates(e.storage, 'coach-a')[0].text, cue)
  button(other.render(), `Slet skabelon: ${cue}`).onClick()
  assert.equal(readMarkerTemplates(e.storage, 'coach-a').length, 0)
  assert.equal(field(other.render(), 'Tekst til markeringen').value, 'Ret brystet op')
})
test('DOM: target duration validation leaves reused draft intact, no automatic save', () => {
  const e = editor(); fill(e); button(e.render(), 'Gem som markeringsskabelon').onClick()
  button(e.render(), `Brug: ${cue}`).onClick(); change(e, 'Klippets varighed i sekunder', '2')
  button(e.render(), 'Gem markering lokalt').onClick()
  assert.match(text(e.render()), /Ikke gemt:/); assert.equal(e.storage.writes.length, 1)
  assert.equal(field(e.render(), 'Tekst til markeringen').value, cue)
  for (const label of ['Start i sekunder', 'Slut i sekunder']) {
    change(e, label, ''); button(e.render(), 'Gem som markeringsskabelon').onClick()
    assert.equal(e.storage.writes.length, 1)
  }
})
test('DOM: storage read and write failures report error and preserve draft', () => {
  const s = memory(), e = editor(s); fill(e)
  s.setItem = () => { throw Error('quota') }
  button(e.render(), 'Gem som markeringsskabelon').onClick()
  assert.match(text(e.render()), /Ikke gemt: quota/)
  assert.equal(field(e.render(), 'Tekst til markeringen').value, cue)
  assert.deepEqual(readMarkerTemplates(s, 'coach-a'), [])
  const bad = editor({ getItem() { throw Error('denied') }, setItem() { assert.fail('write') } })
  assert.match(text(bad.render()), /kunne ikke læses/)
  assert.equal(button(bad.render(), 'Gem som markeringsskabelon').disabled, true)
})
test('DOM: updating blocks actual handlers including direct invocation', () => {
  const s = memory(), e = editor(s); fill(e)
  button(e.render(), 'Gem som markeringsskabelon').onClick()
  const tree = e.render({ ...scope, updating: true })
  for (const n of nodes(tree, n => n.type === 'button')) {
    assert.equal(n.props.disabled, true); n.props.onClick()
  }
  field(e.render(), 'Tekst til markeringen').onChange({ target: { value: 'blocked' } })
  assert.equal(field(e.render(), 'Tekst til markeringen').value, cue)
  assert.equal(s.writes.length, 1)
})
function modal(overrides = {}) {
  const p = { coachId: 'coach-a', selectedAthlete: { id: 'athlete-a' },
    videoAnalysisReview: { id: 'analysis-a', athlete_id: 'athlete-a', status: 'draft' },
    videoAnalysisFeedbackDraft: { works: 'Good', focus: 'Focus', next_set: 'Cue' },
    videoAnalyses: [], videoBaselines: [], ...overrides }
  return mount(Modal, p)
}
test('actual modal: existing marker flag OFF leaves panel and library untouched', () => {
  for (const value of [null, '0', 'true']) {
    const s = memory(); s.data.set('vc-epik2-playback', value); globalThis.localStorage = s
    assert.doesNotMatch(text(modal().render()), /Åbn markeringsskabeloner/)
    assert.ok(s.reads.every(key => !key.startsWith('entropi_vc_marker')))
    assert.deepEqual(s.writes, [])
  }
  delete globalThis.localStorage
})
test('actual modal: opt-in scope, status and updating gate, no save/share handler is called', () => {
  const s = memory(); s.data.set('vc-epik2-playback', '1'); globalThis.localStorage = s
  const forbidden = () => assert.fail('No backend handler may run')
  const app = modal({ saveVideoAnalysisFeedback: forbidden, reviewVideoAnalysis: forbidden,
    saveApproveShareVideoAnalysis: forbidden })
  button(app.render(), 'Åbn markeringsskabeloner').onClick()
  const tree = app.render()
  field(tree, 'Start i sekunder').onChange({ target: { value: '0' } })
  assert.deepEqual(s.writes, [])
  for (const overrides of [{ coachId: '' }, { selectedAthlete: { id: 'other' } },
    ...['shared', 'invalid'].map(status => ({ videoAnalysisReview: { ...scope, id: 'analysis-a', athlete_id: 'athlete-a', status } }))])
    assert.doesNotMatch(text(modal(overrides).render()), /Åbn markeringsskabeloner/)
  assert.equal(button(modal({ videoAnalysisUpdatingId: 'analysis-a' }).render(), 'Åbn markeringsskabeloner').disabled, true)
  delete globalThis.localStorage
})
test('model: explicit local note save and read clone, strict athlete/analysis/coach scope', () => {
  const s = memory()
  saveMarkerNote(s, scope, marker(), 8)
  const copy = readMarkerNotes(s, scope); copy[0].text = 'mutated'
  assert.equal(readMarkerNotes(s, scope)[0].text, cue)
  for (const key of ['coachId', 'athleteId', 'analysisId']) {
    assert.deepEqual(readMarkerNotes(s, { ...scope, [key]: 'other' }), [])
    assert.throws(() => saveMarkerNote(s, { ...scope, [key]: '' }, marker(), 8))
  }
  assert.equal(s.writes.length, 1)
})

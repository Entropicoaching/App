import './vcMark2Loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, nodes, text } from './vcMark2Dom.mjs'
import { saveMarkerNote, saveMarkerTemplate, readMarkerTemplates } from './vcMarkerTemplates.mjs'
const { default: Modal } = await import('./VideoReviewModal.jsx')

test('rebase probe 3: imported modal OFF and wrong athlete never read local marker storage or expose reuse', () => {
  const reads = []; let writes = 0
  globalThis.localStorage = { getItem(key) { reads.push(key); throw Error('read forbidden') }, setItem() { writes++ } }
  const common = { coachId: 'synthetic-coach', selectedAthlete: { id: 'a' },
    videoAnalysisReview: { id: 'v', athlete_id: 'b', status: 'draft' },
    videoBaselines: [], videoAnalyses: [], videoAnalysisFeedbackDraft: {} }
  for (const search of ['', '?rel1030=1']) {
    globalThis.window = { location: { search } }
    const tree = mount(Modal, common).render()
    assert.equal(nodes(tree, n => n.type === 'button' && text(n).includes('markeringsskabeloner')).length, 0)
  }
  delete globalThis.window
  assert.deepEqual(reads, ['entropi:vc-review1', 'entropi:vc-review1'])
  assert.equal(writes, 0)
})

test('rebase probe 4: corrupt marker library and shorter clip both fail atomically', () => {
  const data = new Map(), writes = []
  const storage = { getItem: k => data.get(k) ?? null, setItem(k,v) { writes.push(k); data.set(k,v) } }
  const row = { start: 1, end: 4, text: 'Synthetic cue' }
  saveMarkerTemplate(storage, 'coach_a', row)
  const raw = data.get('entropi_vc_marker_templates_v1:coach_a')
  assert.throws(() => saveMarkerNote(storage, { coachId: 'coach_a', athleteId: 'a', analysisId: 'v' }, row, 3))
  assert.equal(writes.length, 1)
  const poisoned = JSON.parse(raw); poisoned.rows.push({ ...row, end: null })
  data.set('entropi_vc_marker_templates_v1:coach_a', JSON.stringify(poisoned))
  assert.throws(() => saveMarkerTemplate(storage, 'coach_a', row))
  assert.throws(() => readMarkerTemplates(storage, 'coach_a'))
  assert.equal(writes.length, 1)
})

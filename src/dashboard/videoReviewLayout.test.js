import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_VIDEO_REVIEW, VIDEO_REVIEW_FLAG, readVideoReviewFlag, renderVideoReviewLayout, videoReviewConclusion } from './videoReviewLayout.mjs'
import { createVideoReviewStatusHandler } from './videoReviewStatus.mjs'

// Syntetisk elementtrae. onClick er den faktiske importerede statushandler.
const Fragment = Symbol('Fragment')
const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat(Infinity).filter(x => x != null && x !== false) })
const all = node => typeof node === 'object' && node ? [node, ...node.children.flatMap(all)] : []
const text = node => typeof node === 'string' ? node : node?.children?.map(text).join(' ') || ''
function fixture() {
  const writes = []
  let nextStatus
  const analysis = { id: 'video-a', athlete_id: 'athlete-a', status: 'draft', athlete_feedback: null }
  const q = { update(v) { nextStatus = v.status; writes.push(v); return this }, eq() { return this }, is() { return this }, select() { return this }, async single() { return { data: { ...analysis, status: nextStatus } } } }
  const noop = () => {}
  const handler = createVideoReviewStatusHandler({ selectedAthlete: { id: 'athlete-a' }, supabase: { from: () => q },
    setVideoAnalysisUpdatingId: noop, setVideoAnalysisError: noop, fetchVideoCoachHistory: async () => {}, fetchVideoReviewQueue: noop,
    setVideoAnalysisReview: noop, showFlash: noop })
  const parts = Object.fromEntries(['measurement', 'packageReview', 'athleteNote', 'evidence', 'feedback', 'actions'].map(id => [id, h('section', { id }, id)]))
  parts.actions = h('button', { id: 'actions', onClick: () => handler(analysis, 'coach_approved') }, 'Godkend til baseline')
  parts.conclusion = videoReviewConclusion({ status: 'draft', quality: { canShare: true } })
  return { parts, writes }
}

test('Flag er fra som standard og kraever eksakt 1 i egen storage-noegle', () => {
  assert.equal(DEFAULT_VIDEO_REVIEW, false)
  assert.equal(readVideoReviewFlag(null), false)
  assert.equal(readVideoReviewFlag({ getItem() { throw Error('blocked') } }), false)
  for (const value of [null, '', '0', 'true', 'on', ' 1 ', 1]) assert.equal(readVideoReviewFlag({ getItem: () => value }), false)
  assert.equal(readVideoReviewFlag({ getItem(key) { assert.equal(key, VIDEO_REVIEW_FLAG); return '1' } }), true)
})

test('Flag fra bevarer alle originale sektioner i samme raekkefoelge og identitet', () => {
  const { parts } = fixture()
  for (const enabled of [undefined, false, null, 'true', 1]) {
    const tree = renderVideoReviewLayout(h, Fragment, parts, enabled)
    assert.deepEqual(tree.children, ['measurement', 'packageReview', 'athleteNote', 'evidence', 'feedback', 'actions'].map(key => parts[key]))
    assert.equal(all(tree).some(n => n.tag === 'details'), false)
  }
})

test('Flag til: besked og handling foer foldet maaling, ingen kontrol dubleres', async () => {
  const { parts, writes } = fixture()
  const tree = renderVideoReviewLayout(h, Fragment, parts, true)
  assert.deepEqual(tree.children.slice(1, 4), [parts.athleteNote, parts.feedback, parts.actions])
  assert.equal(tree.children[0].props['aria-label'], 'Konklusion')
  const details = tree.children[4]
  assert.equal(details.tag, 'details')
  assert.equal(details.props.open, undefined)
  assert.equal(details.children[0].tag, 'summary')
  assert.deepEqual(details.children.slice(1), [parts.measurement, parts.packageReview, parts.evidence])
  for (const key of ['measurement', 'packageReview', 'athleteNote', 'evidence', 'feedback', 'actions']) assert.equal(all(tree).filter(n => n === parts[key]).length, 1, key)
  assert.equal(writes.length, 0)
  await parts.actions.props.onClick()
  assert.deepEqual(writes, [{ status: 'coach_approved' }])
})

test('Ingen noter eller evidens: feedback og handling forbliver synlige', () => {
  const { parts } = fixture()
  parts.athleteNote = null; parts.evidence = false
  const tree = renderVideoReviewLayout(h, Fragment, parts, true)
  assert.ok(tree.children.includes(parts.feedback))
  assert.ok(tree.children.includes(parts.actions))
  assert.equal(all(tree).filter(n => n.tag === 'details').length, 1)
})

test('Konklusion for alle statusser, dirty, kvalitet og ventetid', () => {
  const summary = (status, dirty = false, canShare = true, updating = false) => videoReviewConclusion({ status, dirty, quality: { canShare }, updating })
  assert.match(summary('draft').title, /Afventer/)
  assert.match(summary('draft').next, /Godkend til baseline/)
  assert.match(summary('coach_approved').title, /endnu ikke delt/)
  assert.match(summary('coach_approved').next, /Del feedback/)
  for (const status of ['draft', 'coach_approved']) {
    assert.match(summary(status, true).next, /Gem feedback/)
    assert.match(summary(status, false, false).next, /Ret feedback/)
  }
  assert.match(summary('shared', true).title, /delt med atleten/)
  assert.match(summary('invalid').title, /udeladt/)
  assert.match(summary('unknown').title, /Ukendt/)
  assert.match(summary('draft', true, false, true).next, /Vent/)
  assert.match(videoReviewConclusion({ status: 'coach_approved' }).next, /Ret feedback/)
})

test('Modalens binding bruger layoutmodulet og de bevarede handlerudtryk', () => {
  const source = readFileSync(new URL('./VideoReviewModal.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.ok(source.includes("from './videoReviewLayout.mjs'"))
  assert.ok(source.includes('renderVideoReviewLayout(createElement, Fragment, {'))
  assert.ok(source.includes('}, readVideoReviewFlag())'))
  assert.ok(source.includes('athleteNote: athleteNoteSection'))
  assert.ok(source.includes("reviewVideoAnalysis(analysis, 'coach_approved')"))
  assert.ok(source.includes('onClick={() => saveVideoAnalysisFeedback(analysis)}'))
  assert.ok(source.includes('disabled={updating || videoAnalysisFeedbackDirty || !feedbackQuality.canShare}'))
})

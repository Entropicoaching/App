import test from 'node:test'
import assert from 'node:assert/strict'
await import('./test-loader.mjs')
const { renderVideoCoachChoices, returnCompletedVideoToReview } = await import('./vcForenkl4.mjs')
const { lavVideoReviewHandlinger } = await import('./dashboard/videoReviewHandlinger.js')
test('Egen DOM: kun eksplicit true viser to adskilte valg; ingen utilsigtet afsendelse', () => {
  let writes = 0
  const opts = { athleteId: 'synthetic', setInstant: () => writes++, setOpen: () => writes++ }
  const h = (tag, props, ...children) => ({ tag, props, children })
  for (const enabled of [undefined, null, false, 0, 1, 'true']) {
    assert.equal(renderVideoCoachChoices(h, { ...opts, enabled }), null)
  }
  const section = renderVideoCoachChoices(h, { ...opts, enabled: true })
  const buttons = section.children.filter(node => node.tag === 'button')
  assert.equal(buttons.length, 2)
  assert.ok(buttons.every(node => node.props.type === 'button' && node.props.style.minHeight >= 44))
  assert.equal(writes, 0)
})
test('Egen handler: den faktiske fabriks samlede handling er default OFF', async () => {
  globalThis.syntheticFrom = () => { throw new Error('Maa ikke skrive') }
  const handlers = lavVideoReviewHandlinger({ selectedAthlete: { id: 'a' } })
  assert.equal(typeof handlers.saveVideoAnalysisFeedback, 'function')
  assert.equal(typeof handlers.reviewVideoAnalysis, 'function')
  await handlers.saveApproveShareVideoAnalysis({ id: 'v', athlete_id: 'a', status: 'draft' })
})
test('Egen C1: fejlagtig completion maa ikke navigere til en anden atlet', () => {
  const fail = () => { throw new Error('Uventet navigation') }
  assert.equal(returnCompletedVideoToReview({ enabled: true, active: true,
    pending: { athleteId: 'a', clientAnalysisId: 'c' },
    data: { id: 'v', athlete_id: 'b', client_analysis_id: 'c' }, athletes: [{ id: 'a' }, { id: 'b' }],
    setVideoCoachOpen: fail, setVideoReviewRequest: fail, openProfile: fail }), false)
})

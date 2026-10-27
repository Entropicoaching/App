import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text } from './coachRydHarness.mjs'

const load = await app()
const props = {
  selectedAthlete: { id: 'synthetic-a', name: 'Syntetisk atlet' },
  videoAnalysisReview: { id: 'synthetic-r', athlete_id: 'synthetic-a', status: 'draft' },
  videoAnalysisFeedbackDraft: {}, videoAnalyses: [], videoBaselines: [],
}

test('K-VC-REVIEW2: actual final modal imports through the existing strict harness', async () => {
  const Modal = await load('VideoReviewModal.jsx')
  const tree = Modal(props)
  assert.equal(nodes(tree).filter(n => n.type === 'button' && text(n) === 'Godkend til baseline').length, 1)
  assert.doesNotMatch(text(tree), /Vælg konklusionsskabelon/)
})

test('counter: default OFF stub has the exact export contract', async () => {
  const module = await import('coachryd-test://1/VideoReviewTemplates.mjs')
  assert.equal(module.DEFAULT_VIDEO_REVIEW_TEMPLATES, false)
  assert.equal(module.default(), null)
})

test('counter: OFF final modal never reads the coach template library', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage forbidden') } })
  try {
    const Modal = await load('VideoReviewModal.jsx')
    for (const flag of [undefined, false, 'true', 1]) {
      assert.doesNotMatch(text(Modal({ ...props, coachId: 'synthetic-coach', videoReviewTemplates: flag })), /Vælg konklusionsskabelon/)
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})

// ORDRE 2053: coachen kan gemme, godkende og dele et svar i ét tryk (var tre: Gem feedback, Godkend, Del).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Handleren gem, godkend og del er tændt på coachens side', () => {
  assert.match(read('./videoReviewHandlinger.js'), /createSaveApproveShareHandler\(\{\s*enabled: true,/)
})

test('Knappen Gem, godkend og del feedback vises for redigerbare analyser uden flag', () => {
  const source = read('./VideoReviewModal.jsx')
  assert.ok(source.includes('{feedbackEditable && <button disabled={updating || !feedbackQuality.canShare} onClick={() => saveApproveShareVideoAnalysis(analysis)}'))
  assert.ok(!source.includes('DEFAULT_VIDEOCOACH_FORENKL4'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { assertProtectedLines, assertAcceptedSource, protectedSources } from '../analyse5SourceContract.mjs'
import { install } from './analyseConclusionLoader.mjs'
install()
const { default: Conclusion, DEFAULT_ANALYSE_CONCLUSION, approvedConclusionReviews } = await import('./analyseConclusion.mjs')

test('additive pins accept independent new lines before, between and after every protected line, with LF and CRLF', () => {
  for (const [name, source] of Object.entries(protectedSources)) {
    const added = '// independent future addition\n' + source.split('\n').join('\n// independent future addition\n')
    assertAcceptedSource(name, added)
    assertAcceptedSource(name, added.replace(/\n/g, '\r\n'))
  }
})

test('each protected line rejects removal and alteration, including duplicates and blank lines', () => {
  for (const [name, source] of Object.entries(protectedSources)) {
    const lines = source.split('\n'); lines.pop()
    for (let i = 0; i < lines.length; i++) {
      assert.throws(() => assertAcceptedSource(name, lines.filter((_, j) => j !== i).join('\n') + '\n'), /missing or changed protected line/, name + ' removed line ' + (i + 1))
      const changed = [...lines]; changed[i] += ' /* changed */'
      assert.throws(() => assertAcceptedSource(name, changed.join('\n') + '\n'), /missing or changed protected line/, name + ' changed line ' + (i + 1))
    }
  }
  assert.throws(() => assertAcceptedSource('unknown', ''), /undeclared protected source/)
  assert.throws(() => assertProtectedLines('beta\nalpha\n', 'alpha\nbeta\n'), /missing or changed/)
})

test('actual accepted conclusion module remains default OFF and scopes approved review selection', () => {
  assert.equal(DEFAULT_ANALYSE_CONCLUSION, false)
  const child = { type: 'p', props: { children: 'synthetic evidence' } }
  assert.equal(Conclusion({ children: child, get logs() { throw Error('OFF read') } }), child)
  const row = { id: 'local', athlete_id: 'a', status: 'shared', lift: 'squat', analyzed_at: '2026-10-20', athlete_feedback: { focus: [{ text: 'Hold pausen.' }] } }
  assert.deepEqual(approvedConclusionReviews({ athleteId: 'b', analyses: [row] }), [])
  assert.deepEqual(approvedConclusionReviews({ athleteId: 'a', analyses: [row] }), [row])
})

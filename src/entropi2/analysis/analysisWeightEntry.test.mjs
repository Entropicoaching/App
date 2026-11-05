import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Execute the copied host's exact gate/effect, without evaluating unrelated JSX,
// auth, startup writes or UI. This also runs against the unmodified base host.
const source = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
const block = source.match(/  const e2(?:KostAaben|WeightOpen) = [\s\S]*?useEffect\([^\n]+/)[0]
function enter(extra = {}) {
  const calls = []
  const props = { e2: true, role: 'athlete', athlete: { id: 'synthetic-entry' },
    coachAthleteId: undefined, onExitPreview: undefined, visKost: false, tab: 'fremgang', ...extra }
  const read = id => calls.push(id)
  Function(...Object.keys(props), 'useEffect', 'fetchWeightLogs', 'fetchInitialWeightLogs', block)(
    ...Object.values(props), effect => effect(), read, read)
  return calls
}

test('analysis first reads weight even when nutrition is hidden or has never been opened', () => {
  for (const visKost of [false, true]) assert.deepEqual(enter({ visKost }), ['synthetic-entry'])
})

test('coach own view and read-only athlete preview can read analysis weight', () => {
  for (const extra of [{ role: 'coach' }, { role: 'coach', coachAthleteId: 'synthetic-entry' },
    { coachAthleteId: 'synthetic-entry', onExitPreview() {} }]) {
    assert.deepEqual(enter(extra), ['synthetic-entry'])
  }
})

test('OFF, missing athlete, other roles/tabs and hidden nutrition do not start this read', () => {
  for (const extra of [{ e2: false }, { athlete: null }, { role: 'admin' },
    { tab: 'hjem' }, { tab: 'kost', visKost: false }]) assert.deepEqual(enter(extra), [])
  assert.deepEqual(enter({ tab: 'kost', visKost: true }), ['synthetic-entry'])
})

test('startup and tab entry use the shared initial reader; retry stays the raw read', () => {
  assert.match(source, /fetchLogs, fetchMealTemplates, fetchWeightLogs: fetchInitialWeightLogs, guideStep/)
  assert.match(block, /if \(e2WeightOpen\) fetchInitialWeightLogs\(athlete.id\)/)
  assert.match(source, /retryWeightRef.current = \(\) => fetchWeightLogs\(athlete.id\)/)
})

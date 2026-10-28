import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text } from './retentionAppHarness.mjs'
const athleteId = '11111111-1111-1111-1111-111111111111'
const stem = athleteId + '/22222222-2222-2222-2222-222222222222'
const objects = [
  { bucket_id: 'videocoach-uploads', name: stem + '.mp4', created_at: '2020-01-01T00:00:00Z', metadata: { size: 400 } },
  { bucket_id: 'videocoach-uploads', name: stem + '.jpg', metadata: { size: 20 } },
]
function props() {
  return { a: { id: athleteId }, selectedAthlete: { id: athleteId },
    athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], weeks: [],
    videoAnalyses: [{ id: 'synthetic', athlete_id: athleteId, video_path: stem + '.mp4',
      analysis_state: 'complete', status: 'draft', lift: 'squat', created_at: '2020-01-01T00:00:00Z',
      session_context: { video_retention: { still_path: stem + '.jpg' } } }],
    videoBaselines: [], videoLiftFilter: 'all' }
}
const find = (tree, type, label) => nodes(tree).find(n => n.type === type && (!label || text(n).includes(label)))
function calculate(view, p, inventory = objects) {
  let tree = view.render(p)
  const input = find(tree, 'textarea')
  assert.ok(input, 'F1: normal coach props must expose local metadata input')
  input.props.onChange({ target: { value: typeof inventory === 'string' ? inventory : JSON.stringify(inventory) } })
  tree = view.render(p)
  find(tree, 'button', 'Beregn metadata-preview').props.onClick()
  return view.render(p)
}
test('F1 before FAIL / final PASS: actual AnalyseTab with Dashboard props reaches working dryrun', async () => {
  const before = await app({ before: true }), p = props()
  assert.match(text(before.render(p)), /Filoversigten mangler/)
  assert.throws(() => calculate(before, p), assert.AssertionError)
  const final = await app()
  const tree = calculate(final, p)
  assert.match(text(tree), /1 originaler ville blive slettet. 400 bytes/)
  assert.match(text(tree), /slået fra/)
  assert.equal(find(tree, 'section', 'Originalvideoer').props['aria-label'], 'Opbevaring af originalvideoer')
})
test('local handler rejects malformed JSON and clears stale preview on edit', async () => {
  const view = await app(), p = props()
  calculate(view, p)
  let tree = calculate(view, p, '{broken')
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert'))
  assert.match(text(tree), /Filoversigten mangler/)
  tree = calculate(view, p, {})
  assert.match(text(tree), /Filoversigten skal være/)
  tree = calculate(view, p)
  find(tree, 'textarea').props.onChange({ target: { value: '[]' } })
  assert.match(text(view.render(p)), /Filoversigten mangler/)
})
test('athlete switch isolates local metadata; foreign inventory is never selected', async () => {
  const view = await app(), p = props()
  calculate(view, p)
  const other = { ...p, a: { id: '33333333-3333-3333-3333-333333333333' } }
  assert.match(text(view.render(other)), /Filoversigten mangler/)
  assert.match(text(calculate(view, other)), /0 originaler ville blive slettet. 0 bytes/)
})

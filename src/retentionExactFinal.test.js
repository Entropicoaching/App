import test from 'node:test'
import assert from 'node:assert/strict'
import { runOriginalRetention, RETENTION_MS } from './videoRetention.mjs'
import { app, nodes } from './retentionAppHarness.mjs'

test('counter: OFF does not even access a deletion adapter method', async () => {
  const id = '11111111-1111-1111-1111-111111111111', stem = id + '/22222222-2222-2222-2222-222222222222'
  const now = '2026-10-28T00:00:00Z'
  const input = { athleteId: id, now, analyses: [{ id: 'fake', athlete_id: id, video_path: stem + '.mp4',
    analysis_state: 'complete', session_context: { video_retention: { still_path: stem + '.jpg' } } }],
    objects: [{ bucket_id: 'videocoach-uploads', name: stem + '.mp4', metadata: { size: 400 },
      created_at: new Date(Date.parse(now) - RETENTION_MS - 1).toISOString() },
    { bucket_id: 'videocoach-uploads', name: stem + '.jpg', metadata: { size: 20 } }] }
  const adapter = { get kind() { assert.fail('adapter accessed with OFF') },
    get deleteOriginal() { assert.fail('delete handler accessed with OFF') } }
  const result = await runOriginalRetention(input, { videoSlet: false, dryRun: false, adapter })
  assert.equal(result.plan.bytes, 400)
  assert.deepEqual(result.removed, [])
})
test('exact final app imports only enumerated synthetic dependencies', async () => {
  const view = await app()
  const tree = view.render({ a: { id: 'synthetic' }, athleteLogs: [], athletePRHistory: [], athleteReadiness: [],
    athleteWeightLogs: [], exerciseLibrary: [], weeks: [], videoAnalyses: [], videoBaselines: [], videoLiftFilter: 'all' })
  const section = nodes(tree).find(n => n.props?.['aria-label'] === 'Opbevaring af originalvideoer')
  assert.ok(section)
  assert.equal(nodes(section).some(n => n.props?.onClick || n.props?.dangerouslySetInnerHTML), false)
})

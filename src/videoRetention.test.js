import './retentionLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { planOriginalRetention, runOriginalRetention, VIDEO_SLET, RETENTION_MS } from './videoRetention.mjs'
import { renderVideoRetentionPreview } from './VideoRetentionPreview.mjs'
const athleteId = '11111111-1111-1111-1111-111111111111'
const id = '22222222-2222-2222-2222-222222222222'
const now = '2026-10-27T12:00:00.000Z'
const original = `${athleteId}/${id}.mp4`
const still = `${athleteId}/${id}.jpg`
function fixture(age = RETENTION_MS + 1) {
  return { athleteId, now, analyses: [{ id, athlete_id: athleteId, video_path: original,
    analysis_state: 'complete', coach_note: 'Konklusion', findings: [{ x: 3 }],
    drawings: [{ points: [1, 2] }], session_context: { video_retention: { still_path: still } } }],
    objects: [{ bucket_id: 'videocoach-uploads', name: original,
      created_at: new Date(Date.parse(now) - age).toISOString(), metadata: { size: 123456 } },
    { bucket_id: 'videocoach-uploads', name: still, metadata: { size: 1234 } }] }
}
const h = (type, props, ...children) => ({ type, props, children: children.flat(Infinity) })
const text = node => node && typeof node === 'object' ? node.children.map(text).join(' ') : String(node ?? '')
const nodes = node => node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : []

test('01: strict 30 day boundary, millisecond precision, offset and original age', () => {
  for (const age of [RETENTION_MS - 1, RETENTION_MS, 0])
    assert.equal(planOriginalRetention(fixture(age)).candidates.length, 0)
  const input = fixture()
  input.analyses[0].created_at = now
  assert.equal(planOriginalRetention(input).bytes, 123456)
  input.objects[0].created_at = '2026-09-27T14:00:00+02:00'
  assert.equal(planOriginalRetention(input).candidates.length, 0)
})

test('02: missing, malformed, future and ambiguous metadata fail closed', () => {
  for (const change of [
    x => delete x.objects,
    x => x.now = 'bad',
    x => x.objects[0].created_at = '2026-09-01',
    x => x.objects[0].created_at = '2026-02-30T00:00:00Z',
    x => x.objects[0].created_at = '2026-10-28T00:00:00Z',
    x => x.objects[0].metadata.size = '123456',
    x => x.objects[0].metadata.size = -1,
    x => x.objects.push({ ...x.objects[0] }),
    x => x.analyses.push({ ...x.analyses[0] }),
    x => x.analyses[0].analysis_state = 'awaiting_analysis',
  ]) { const input = fixture(); change(input); assert.equal(planOriginalRetention(input).candidates.length, 0) }
})

test('03: athlete, bucket, path and independent still are mandatory', () => {
  for (const change of [
    x => x.athleteId = 'other',
    x => x.analyses[0].athlete_id = 'other',
    x => x.objects[0].bucket_id = 'other',
    x => x.analyses[0].video_path = `${athleteId}/../clip.mp4`,
    x => x.analyses[0].session_context = {},
    x => x.analyses[0].session_context.video_retention.still_path = original,
    x => x.objects.pop(),
    x => x.objects[1].metadata.size = 0,
  ]) { const input = fixture(); change(input); assert.equal(planOriginalRetention(input).candidates.length, 0) }
})

test('04: flag default OFF, strict boolean and dryrun never invoke adapter', async () => {
  assert.equal(VIDEO_SLET, false)
  let calls = 0
  const adapter = { kind: 'synthetic', deleteOriginal() { calls++; return { ok: true } } }
  for (const options of [{}, { videoSlet: false, dryRun: false },
    { videoSlet: 'true', dryRun: false }, { videoSlet: true }, { videoSlet: true, dryRun: true }]) {
    const result = await runOriginalRetention(fixture(), { ...options, adapter })
    assert.deepEqual(result.removed, [])
  }
  assert.equal(calls, 0)
})

test('05: fake storage deletes only original; all annotations and still survive', async () => {
  const input = fixture(), before = structuredClone(input)
  const storage = new Map(input.objects.map(o => [o.name, structuredClone(o)]))
  const result = await runOriginalRetention(input, { videoSlet: true, dryRun: false,
    adapter: { kind: 'synthetic', async deleteOriginal(item) {
      assert.equal(item.bucket, 'videocoach-uploads')
      assert.equal(item.path, original)
      storage.delete(item.path); return { ok: true }
    } } })
  assert.deepEqual(result.removed, [original])
  assert.deepEqual(input, before)
  assert.deepEqual(storage.get(still), before.objects[1])
  assert.equal(storage.has(original), false)
  await assert.rejects(runOriginalRetention(input, { videoSlet: true, dryRun: false,
    adapter: { kind: 'live', deleteOriginal() { assert.fail('live adapter called') } } }), TypeError)
})

test('06: failed or unconfirmed adapter calls never report space as freed', async () => {
  for (const deleteOriginal of [async () => { throw Error('fake failure') }, async () => ({ ok: false }), async () => undefined]) {
    const result = await runOriginalRetention(fixture(), { videoSlet: true, dryRun: false,
      adapter: { kind: 'synthetic', deleteOriginal } })
    assert.deepEqual(result.removed, [])
    assert.deepEqual(result.failed, [original])
  }
})

test('07: imported coach view renders dryrun candidates, bytes, blocked and unavailable', () => {
  const input = fixture()
  const tree = renderVideoRetentionPreview(h, input)
  assert.match(text(tree), /1 originaler ville blive slettet.*123456 bytes/)
  assert.match(text(tree), /slået fra/)
  assert.match(text(tree), /Markeringer, tegninger, konklusion/)
  assert.equal(nodes(tree).filter(n => n.type === 'li').length, 1)
  assert.equal(nodes(tree).some(n => n.props?.onClick), false)
  assert.match(text(renderVideoRetentionPreview(h, { ...input, objects: undefined })), /Filoversigten mangler/)
  input.objects.pop()
  assert.match(text(renderVideoRetentionPreview(h, input)), /1 originaler afventer/)
  input.analyses[0].id = '<script>fake</script>'
  input.objects = fixture().objects
  const escaped = renderVideoRetentionPreview(h, input)
  assert.match(text(escaped), /<script>fake<\/script>/)
  assert.equal(nodes(escaped).some(n => n.props?.dangerouslySetInnerHTML), false)
})

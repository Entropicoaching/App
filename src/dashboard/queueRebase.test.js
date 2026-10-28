import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { app, nodes, text } from './vcQueueHarness.mjs'

const configurations = {
  coachRyd: `const { app } = await import('../coachRydHarness.mjs');
    const load = await app(); await load('IndbakkeView.jsx');
    await assert.rejects(async () => load('weightTrend.mjs'), /Unapproved/);`,
  coachRyd2: `const { app } = await import('../coachRyd2Harness.mjs');
    const load = await app(); await load('IndbakkeView.jsx');
    await assert.rejects(async () => load('weightTrend.mjs'), /Unapproved/);`,
  coachNote: `const { app } = await import('../coachNoteTestHelpers.mjs');
    const load = await app(); await load('src/dashboard/IndbakkeView.jsx');
    assert.equal((await load('src/dashboard/videoQueueWait.mjs')).VIDEO_QUEUE_WAIT_ENABLED, false);
    await assert.rejects(async () => load('src/not-pinned.mjs'), /Unapproved/);
    await assert.rejects(async () => load('node:fs'), /Unapproved/);`,
  coachSaveNext: `const { app } = await import('./coachSaveNextHarness.mjs');
    const load = await app({});
    assert.equal((await load('src/dashboard/videoQueueWait.mjs')).VIDEO_QUEUE_WAIT_ENABLED, false);
    await load('src/dashboard/VideoReviewModal.jsx');
    await assert.rejects(async () => load('src/athlete/weightTrend.mjs'), /Blocked/);
    await assert.rejects(async () => load('node:fs'), /Blocked/);`,
  queue: `const { app } = await import('./vcQueueHarness.mjs');
    const host = await app();
    assert.equal((await host.load('videoQueueWait.mjs')).VIDEO_QUEUE_WAIT_ENABLED, false);
    await assert.rejects(async () => host.load('weightTrend.mjs'), /Forbidden/);
    await assert.rejects(async () => host.load('node:fs'), /Forbidden/);`,
}

for (const [name, code] of Object.entries(configurations)) {
  test(`native layout: ${name} imports ordered module and refuses unapproved pure/host modules`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import assert from 'node:assert/strict'; ${code}`],
      { cwd: fileURLToPath(new URL('./', import.meta.url)), encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  })
  test(`closed graph: ${name} refuses an unapproved transitive import from the ordered module`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import assert from 'node:assert/strict';
       import fs from 'node:fs';
       import { syncBuiltinESMExports } from 'node:module';
       const read = fs.readFileSync;
       fs.readFileSync = (path, ...args) => {
         const result = read(path, ...args);
         if (String(path).replaceAll('\\\\', '/').endsWith('/videoQueueWait.mjs'))
           return "import './unapproved-pure.mjs';\\n" + result;
         return result;
       };
       syncBuiltinESMExports();
       ${code}`],
      { cwd: fileURLToPath(new URL('./', import.meta.url)), encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /(?:Unapproved|Forbidden|Blocked).*unapproved-pure\.mjs/)
  })
}

test('union keeps marker preview, seen handler and exact video handler in the same rendered inbox', async () => {
  const host = await app(false, true)
  const athlete = { id: 'synthetic-rebase', name: 'Synthetic Rebase' }
  const video = { key: 'video', kind: 'video', athlete,
    video: { id: 'v', created_at: '2026-10-26T12:00:00Z' },
    title: 'Queue video', detail: 'Video detail', label: 'Video' }
  const signal = { key: 'signal', kind: 'signal', athlete, title: 'Keep signal',
    detail: 'Signal detail', label: 'Signal', signal: { id: 's', o_athlete_id: athlete.id, o_detector: 'synthetic' } }
  const opened = [], seen = [], signals = []
  const props = { athletes: [athlete], hiddenAthleteIds: new Set(), coachPriorityItems: [video, signal],
    latestByTrack: {}, unreadByTrack: {}, inboxRefreshStatus: { kind: 'success' },
    coachRyd: true, coachBriefingSeen: {}, handleCoachBriefingSeen: (...args) => seen.push(args),
    handleTrainingSignal: (...args) => signals.push(args),
    openCoachPriorityItem: (...args) => opened.push(args), refreshCoachInbox() {} }
  const tree = host.render(props)
  assert.match(text(tree), /Signal detail/)
  const button = nodes(tree).find(n => n.type === 'button' && text(n).includes('Video detail'))
  button.props.onClick()
  assert.deepEqual(opened, [[video, 'inbox']])
  assert.equal(nodes(tree).filter(n => n.props?.['data-video-wait']).length, 1)
  const queue = nodes(tree).find(n => n.type === 'section' && n.props?.['aria-label'] === 'Videokø')
  nodes(queue).find(n => n.type === 'button' && text(n) === 'Set').props.onClick()
  assert.deepEqual(seen, [[video]])
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Udsæt 7 dage').props.onClick()
  assert.deepEqual(signals, [[signal.signal, 'snooze']])
  // Source pin asserts the additive merge independently of the queue DOM.
  const source = readFileSync(new URL('./IndbakkeView.jsx', import.meta.url), 'utf8')
  for (const fragment of ["import { coachBriefingPointKey }", "import { markerReplyPreview }",
    'handleCoachBriefingSeen', 'markerReplyPreview(']) assert.ok(source.includes(fragment), fragment)
  for (const name of ['coachBriefingPointKey', 'markerReplyPreview', 'VIDEO_QUEUE_WAIT_ENABLED']) {
    const imports = source.split(/\r?\n/).filter(line => line.startsWith('import ') && line.includes(name))
    assert.equal(imports.length, 1, name)
  }
})

test('hash comparison normalizes CRLF and LF without normalizing other source bytes', () => {
  const code = readFileSync(new URL('./videoQueueWait.mjs', import.meta.url), 'utf8')
  const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex')
  const lf = code.replace(/\r\n/g, '\n')
  assert.equal(hash(lf), hash(lf.replace(/\n/g, '\r\n')))
  assert.notEqual(hash(code), hash(code.replace('ENABLED = false', 'ENABLED = true')))
})

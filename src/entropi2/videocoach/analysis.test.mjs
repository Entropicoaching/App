import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoAnalysisController } from './analysisController.mjs'
import { renderVideoAnalyses } from './analysisView.mjs'
import { createConversation } from '../conversation/conversationController.mjs'
import { createReviewController } from './reviewController.mjs'
import { renderReview } from './view.mjs'
import { pausedSet, sourceFor } from './setBoundaryFixture.mjs'
import { h, text, click, deferred } from './accessSynthetic.mjs'
import { fixture as domFixture, find } from '../conversation/accessibilityFixture.mjs'
import { mountConversation } from '../conversation/ConversationView.mjs'

const choices = [
  { key: 'synthetic-set-a', exercise_id: 'synthetic-squat', exercise_name: 'Squat', set_number: 1,
    session_id: 'synthetic-pass-a', session_date: '2026-11-05' },
  { key: 'synthetic-set-b', exercise_id: 'synthetic-squat', exercise_name: 'Squat', set_number: 1,
    session_id: 'synthetic-pass-b', session_date: '2026-11-04' },
]
const flush = () => new Promise(resolve => setImmediate(resolve))
async function fixture(extra = {}) {
  const messages = [], videos = [], calls = [], submissionCalls = []
  let sequence = 0, scope = 'synthetic-owner', failMessage = false, failSubmission = false
  const scopeFor = role => ({ athleteId: 'synthetic-athlete', ownerId: `synthetic-${role}`, role })
  const adapter = role => ({
    scope: () => scopeFor(role), load: async () => ({ messages: [...messages], analyses: [...videos] }),
    send: async row => {
      calls.push(['message', structuredClone(row)])
      if (failMessage) throw Error('Syntetisk beskedfejl')
      const saved = messages.find(message => message.id === row.id)
      if (!saved) messages.push({ ...row, created_at: '2026-11-05T12:00:00Z' })
      return saved ?? messages.at(-1)
    },
    submission: async id => {
      submissionCalls.push(id)
      if (failSubmission) throw Error('Syntetisk referencefejl')
      let video = videos.find(video => video.client_analysis_id === id)
      if (!video) {
        video = { id: `video-${id}`, client_analysis_id: id, athlete_id: 'synthetic-athlete',
          source_mode: 'athlete_submission', status: 'draft', lift: 'squat', created_at: '2026-11-05T12:00:00Z' }
        videos.push(video)
      }
      return video
    },
  })
  const conversation = createConversation({ enabled: true, adapters: adapter('athlete'), uuid: () => `message-${++sequence}` })
  await conversation.refresh()
  const callbacks = {
    chooseSource: () => ({ id: 'synthetic-source', label: 'Syntetisk klip', duration: 20 }),
    analyze(request) { calls.push(['analyze', structuredClone(request.window)]); return { reps: 2,
      path: [[request.window.start, .5, .8], [request.window.end, .5, .2]] } },
    prepare(request) { calls.push(['prepare', request]); return { duration: request.window.end - request.window.start, artifact: 'synthetic-only' } },
    upload(request) { calls.push(['upload', request]); return { ok: true, clientAnalysisId: request.clientAnalysisId, uploaded: true } },
    ...extra.callbacks,
  }
  const controller = createVideoAnalysisController({ enabled: true, options: choices, conversation,
    getScope: () => scope, uuid: () => `analysis-${++sequence}`, ...extra, callbacks })
  const view = props => renderVideoAnalyses(h, { state: controller.snapshot(), controller, ...props })
  return { controller, access: controller.access, conversation, calls, messages, videos, submissionCalls, view,
    setScope: value => { scope = value }, failMessage: value => { failMessage = value },
    failSubmission: value => { failSubmission = value },
    coach: async () => { const c = createConversation({ enabled: true, adapters: adapter('coach'), uuid: () => `coach-message-${++sequence}` }); await c.refresh(); return c },
  }
}

test('analysis link: strict OFF and read-only inspect no host capabilities', async () => {
  for (const extra of [{}, { enabled: false }, { enabled: 'true' }, { enabled: 1 }, { enabled: true, readOnly: true }]) {
    const poison = () => { throw Error('OFF host read') }
    const c = createVideoAnalysisController({ ...extra, get callbacks() { return poison() },
      get options() { return poison() }, get conversation() { return poison() }, get getScope() { return poison() } })
    assert.deepEqual(c.snapshot(), { enabled: false }); assert.deepEqual(c.access.snapshot(), { enabled: false })
    assert.equal(await c.send('synthetic'), false)
    assert.equal(renderVideoAnalyses(h, { state: c.snapshot(), controller: c }), null)
  }
})

test('analysis link: one visible click sends actual analysis through upload, existing conversation and coach feedback', async () => {
  const f = await fixture()
  assert.match(text(f.view()), /Ingen videoanalyse/)
  f.access.open(choices[0].key); await f.access.chooseSource()
  assert.equal(f.calls.filter(([name]) => name === 'upload').length, 0)
  assert.equal(f.messages.length, 0)
  assert.match(text(f.view()), /2026-11-05 · Squat · sæt 1/)
  assert.match(text(f.view()), /2 gentagelser registreret/)
  assert.equal(await click(f.view(), 'Send til din coach'), true)
  assert.match(text(f.view()), /Sendt i samtalen/)
  const uploaded = f.calls.find(([name]) => name === 'upload')[1]
  assert.deepEqual(uploaded.analysis, f.controller.snapshot().records[0].analysis)
  assert.equal(uploaded.choice.session_id, choices[0].session_id)
  assert.deepEqual(uploaded.window, { start: 5, end: 20 })
  assert.equal(f.submissionCalls.length, 1); assert.equal(f.messages.length, 1)
  assert.match(f.messages[0].content, /2026-11-05 · Squat · sæt 1/)
  assert.match(f.messages[0].content, /Videoanalyse: 2 registrerede gentagelser/)
  assert.ok(f.messages[0].content.endsWith(`Video-id: ${f.videos[0].id}`))
  const coach = await f.coach()
  const dom = domFixture()
  const unmount = mountConversation(dom.host, coach, { enabled: true })
  assert.match(dom.host.textContent, /Squat · sæt 1/)
  assert.ok(find(dom.host, 'li').some(node => node.dataset.key === `video:${f.videos[0].id}`))
  assert.equal(coach.snapshot().thread.filter(item => item.kind === 'video').length, 1)
  assert.match(coach.snapshot().thread.find(item => item.kind === 'message').value.content, /Squat · sæt 1/)
  const review = createReviewController({ enabled: true, conversation: coach, analysisId: f.videos[0].id, duration: 15 })
  review.reply('Syntetisk feedback: hold en rolig start.'); review.time(2)
  const tree = renderReview(h, { state: review.snapshot(), controller: review })
  assert.equal(await click(tree, 'Send tidsfeedback'), true)
  await f.conversation.refresh()
  assert.match(f.conversation.snapshot().thread.find(item => item.kind === 'message' && item.value.sender_role === 'coach').value.content,
    /hold en rolig start/)
  assert.equal(await f.controller.send(uploaded.clientAnalysisId), false)
  unmount(); review.dispose(); coach.dispose(); f.controller.dispose(); f.conversation.dispose()
})

test('analysis link: exact session/exercise filtering, history survives access reset, no synthetic empty values', async () => {
  const f = await fixture()
  f.access.open(choices[0].key); await f.access.chooseSource(); const first = f.controller.snapshot().records[0]
  f.access.reset(); f.access.open(choices[1].key); await f.access.chooseSource()
  assert.equal(f.controller.snapshot().records.length, 2)
  const dayA = f.view({ sessionId: choices[0].session_id, exerciseId: choices[0].exercise_id })
  assert.match(text(dayA), /2026-11-05/); assert.doesNotMatch(text(dayA), /2026-11-04/)
  assert.match(text(f.view({ sessionId: 'missing' })), /Ingen videoanalyse/)
  assert.match(text(f.view({ exerciseId: 'missing' })), /Ingen videoanalyse/)
  assert.equal(await click(dayA, 'Send til din coach'), true)
  assert.equal(f.controller.snapshot().records.find(row => row.clientAnalysisId === first.clientAnalysisId).phase, 'sent')
  const snapshot = f.controller.snapshot(); snapshot.records[0].analysis.path[0][1] = .99
  assert.equal(f.controller.snapshot().records[0].analysis.path[0][1], .5)
  f.controller.dispose(); f.conversation.dispose()
})

test('analysis link: message failure retries exact message and video IDs, without another upload or registration', async () => {
  const f = await fixture(); f.failMessage(true)
  f.access.open(choices[0].key); await f.access.chooseSource()
  assert.equal(await click(f.view(), 'Send til din coach'), false)
  assert.match(text(f.view()), /ikke bekræftet/)
  const failedId = f.conversation.snapshot().operation.row.id
  f.failMessage(false)
  assert.equal(await click(f.view(), 'Prøv afsendelse igen'), true)
  assert.equal(f.calls.filter(([name]) => name === 'upload').length, 1)
  assert.equal(f.submissionCalls.length, 1)
  assert.equal(f.calls.filter(([name]) => name === 'message').length, 2)
  assert.equal(f.messages[0].id, failedId)
  f.controller.dispose(); f.conversation.dispose()
})

test('analysis link: registration failure retains receipt and retries without re-upload', async () => {
  const f = await fixture(); f.failSubmission(true)
  f.access.open(choices[0].key); await f.access.chooseSource()
  assert.equal(await click(f.view(), 'Send til din coach'), false)
  assert.equal(f.messages.length, 0)
  f.failSubmission(false)
  assert.equal(await click(f.view(), 'Prøv afsendelse igen'), true)
  assert.equal(f.calls.filter(([name]) => name === 'upload').length, 1)
  assert.equal(f.submissionCalls.length, 2)
  assert.equal(f.submissionCalls[0], f.submissionCalls[1])
  f.controller.dispose(); f.conversation.dispose()
})

test('analysis link: unrelated conversation draft is preserved and blocks upload', async () => {
  const f = await fixture()
  f.access.open(choices[0].key); await f.access.chooseSource()
  f.conversation.draft('Syntetisk usendt kladde')
  assert.equal(await click(f.view(), 'Send til din coach'), false)
  assert.equal(f.conversation.snapshot().draft, 'Syntetisk usendt kladde')
  assert.equal(f.calls.filter(([name]) => name === 'upload').length, 0)
  f.conversation.draft('')
  assert.equal(await click(f.view(), 'Prøv afsendelse igen'), true)
  f.controller.dispose(); f.conversation.dispose()
})

test('analysis link: duplicate clicks, scope revocation and late upload never send a message', async () => {
  const pending = deferred()
  const f = await fixture({ callbacks: { upload: () => pending.promise } })
  f.access.open(choices[0].key); await f.access.chooseSource()
  const id = f.controller.snapshot().records[0].clientAnalysisId
  const task = f.controller.send(id); await flush()
  assert.equal(await f.controller.send(id), false)
  f.setScope('synthetic-other'); assert.deepEqual(f.controller.snapshot(), { enabled: false })
  pending.resolve({ ok: true, clientAnalysisId: id }); assert.equal(await task, false)
  assert.equal(f.messages.length, 0); assert.equal(f.submissionCalls.length, 0)
  f.setScope('synthetic-owner'); assert.deepEqual(f.controller.snapshot(), { enabled: false })
  f.conversation.dispose()
})

for (const lift of ['squat', 'bench', 'deadlift']) {
  test(`analysis link: ${lift} set-boundary survives access, analysis, prepare and upload`, async () => {
    const f = await fixture({ callbacks: { chooseSource: () => sourceFor(pausedSet(lift), 30) } })
    f.access.open(choices[0].key); assert.equal(await f.access.chooseSource(), true)
    const chosen = f.access.snapshot()
    assert.equal(chosen.setBoundary.status, 'ready'); assert.ok(chosen.window.start < 1.5)
    assert.equal(await f.access.send(), true)
    for (const [name, value] of f.calls) {
      if (name === 'analyze') assert.deepEqual(value, chosen.window)
      if (['prepare', 'upload'].includes(name)) assert.deepEqual(value.window, chosen.window)
    }
    f.controller.dispose(); f.conversation.dispose()
  })
}

test('analysis link: incomplete signal blocks analysis/send until manual interval; editing invalidates result identity', async () => {
  const f = await fixture({ callbacks: { chooseSource: () => sourceFor({ lift: 'bench', samples: [] }, 30) } })
  f.access.open(choices[0].key); await f.access.chooseSource()
  assert.equal(f.access.snapshot().analysis, null); assert.equal(await f.access.analyze(), false)
  assert.equal(await f.access.send(), false); assert.equal(f.controller.snapshot().records.length, 0)
  assert.equal(f.access.move(0), true); assert.equal(await f.access.analyze(), true)
  const previous = f.access.snapshot().clientAnalysisId
  assert.equal(f.access.resize('end', 10), true)
  assert.equal(f.access.snapshot().analysis, null)
  assert.notEqual(f.access.snapshot().clientAnalysisId, previous)
  assert.equal(await f.access.analyze(), true)
  assert.equal(await f.access.send(), true)
  const request = f.calls.find(([name]) => name === 'upload')[1]
  assert.deepEqual(request.window, { start: 0, end: 10 })
  f.controller.dispose(); f.conversation.dispose()
})

test('analysis link: invalid/missing context is rejected rather than guessed', () => {
  for (const patch of [{ session_id: undefined }, { session_date: '2026-02-30' }, { session_date: '5/11/2026' },
    { exercise_id: undefined }, { exercise_name: '' }, { set_number: 0 }])
    assert.throws(() => createVideoAnalysisController({ enabled: true, options: [{ ...choices[0], ...patch }] }))
})

test('analysis link: scoped host restore supports historical sets and deduplicates an existing confirmed summary', async () => {
  const f = await fixture()
  f.access.open(choices[0].key); await f.access.chooseSource()
  const record = f.controller.snapshot().records[0]
  assert.equal(await f.controller.send(record.clientAnalysisId), true)
  f.controller.dispose()
  let uploads = 0
  const restored = createVideoAnalysisController({ enabled: true, options: [], records: [record], conversation: f.conversation,
    callbacks: { prepare: request => ({ artifact: 'synthetic', duration: request.window.end - request.window.start }),
      upload(request) { uploads++; return { ok: true, clientAnalysisId: request.clientAnalysisId } } } })
  assert.equal(restored.snapshot().records.length, 1)
  assert.equal(await restored.send(record.clientAnalysisId), true)
  assert.equal(uploads, 1) // Host upload must also be idempotent for the same video ID across sessions.
  assert.equal(f.messages.length, 1)
  assert.equal(restored.snapshot().records[0].phase, 'sent')
  restored.dispose(); f.conversation.dispose()
  assert.throws(() => createVideoAnalysisController({ enabled: true, records: [{ ...record, window: { start: -1, end: 10 } }] }))
})

test('analysis link: cancelling an unknown upload retains the video ID and retries from the history', async () => {
  const pending = deferred(), ids = []
  const f = await fixture({ callbacks: { upload(request) {
    ids.push(request.clientAnalysisId)
    return ids.length === 1 ? pending.promise : { ok: true, clientAnalysisId: request.clientAnalysisId }
  } } })
  f.access.open(choices[0].key); await f.access.chooseSource(); f.access.close()
  const id = f.controller.snapshot().records[0].clientAnalysisId
  const task = f.controller.send(id); await flush()
  assert.equal(f.controller.cancel(id), true); assert.equal(await task, false)
  pending.resolve({ ok: true, clientAnalysisId: id }); await flush()
  assert.equal(f.messages.length, 0)
  assert.equal(await f.controller.retry(id), true)
  assert.deepEqual(ids, [id, id]); assert.equal(f.messages.length, 1)
  f.controller.dispose(); f.conversation.dispose()
})

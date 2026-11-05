import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversationAdapters } from './conversationAdapters.mjs'
import { createConversation } from './conversationController.mjs'
import { mountConversation, formatConversationTime } from './ConversationView.mjs'
import { videoLabel, timestampContent } from './conversationModel.mjs'

// Synthetic text/event host, actual copied adapters/controller/view; no React substitute.
class Element {
  constructor(tagName, ownerDocument) {
    Object.assign(this, { tagName, ownerDocument, style: {}, dataset: {}, attributes: {},
      children: [], events: new Map(), value: '', _text: '' })
  }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this._text = ''; this.children = children }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  addEventListener(type, fn) { this.events.set(type, fn) }
}
const find = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
const visible = el => el.hidden ? '' : el._text + el.children.map(visible).join(' ')
const scope = { enabled: true, role: 'athlete', ownerId: 'synthetic-owner',
  athleteId: 'synthetic', athleteUserId: 'synthetic-owner' }
const message = (id, extra = {}) => ({ id, athlete_id: 'synthetic', sender_role: 'coach',
  content: 'Bekræftet syntetisk besked', created_at: '2026-11-04T12:00:00Z', ...extra })
const safeRead = 'Samtalen kunne ikke hentes sikkert. Opdatér og prøv igen.'
const safeVideo = 'Videoen kunne ikke klargøres. Prøv igen med den valgte video.'
function view(controller) {
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('root')
  const dispose = mountConversation(root, controller, { enabled: true, now: () => new Date('2026-11-04T12:00:00Z') })
  return { root, dispose }
}
function backend({ messages = () => [], videos = () => [], identity } = {}) {
  return {
    from(table) {
      assert.equal(table, 'messages')
      const query = { select: () => query, eq: () => query, order: () => query,
        range: async (start, end) => ({ data: messages(start, end) }) }
      return query
    },
    rpc(name, args) {
      if (name === 'get_my_video_analysis_submission_identity_v3') return { single: async () => identity(args) }
      assert.equal(name, 'get_my_shared_video_analyses_v3')
      return Promise.resolve({ data: videos(args.p_offset) })
    },
  }
}
const controllerFor = (database, storage = () => null) => createConversation({ enabled: true, storage,
  adapters: createConversationAdapters({ enabled: true, database, storage, getScope: () => scope,
    pageSize: 2, maxPages: 2 }) })

test('missing/invalid/ambiguous timestamps omit only the date; valid Copenhagen/DST labels and stored video identity survive', () => {
  for (const at of [undefined, null, '', 'invalid', 0, '2026-11-04', '2026-11-04T12:00:00',
    '2026-02-30T12:00:00Z', '2026-13-01T12:00:00Z', '2026-11-04T25:00:00Z',
    '2026-11-04T12:60:00Z', '2026-11-04T12:00:60Z', '2026-11-04T12:00:00+25:00']) {
    assert.equal(formatConversationTime(at), '')
    const row = { id: 'synthetic-video', lift: 'squat', created_at: at }
    assert.equal(videoLabel(row), 'Squat-video')
    assert.equal(timestampContent(row, 3.5, 'Syntetisk feedback'),
      'Squat-video ved 3,5 s\nSyntetisk feedback\nVideo-id: synthetic-video')
  }
  assert.equal(videoLabel({}), 'Video')
  assert.equal(formatConversationTime('2026-11-04T12:00:00Z', new Date('2026-11-04T14:00:00Z')), 'i dag 13:00')
  assert.equal(formatConversationTime('2026-10-24T22:30:00Z', new Date('2026-10-25T12:00:00Z')), 'i dag 00:30')
  assert.equal(formatConversationTime('2026-10-24T21:30:00Z', new Date('2026-10-25T12:00:00Z')), 'i går 23:30')
})

test('undated confirmed messages and videos retain content, unread state, explicit opening and clean separators', async () => {
  let acknowledgements = 0, opens = 0
  const controller = createConversation({ enabled: true, storage: () => null, adapters: {
    scope: () => scope,
    load: async () => ({ messages: [message('undated', { created_at: null })], analyses: [{
      id: 'video', athlete_id: 'synthetic', status: 'shared', created_at: 'invalid',
      athlete_feedback: { focus: [{ text: 'Bekræftet syntetisk feedback' }] },
    }] }),
    seen: async item => { acknowledgements++; return { ...item.value, read_at: '2026-11-04T12:00:00Z' } },
    open: () => { opens++ },
  } })
  const f = view(controller); await controller.refresh()
  assert.equal(find(f.root, 'li').length, 2)
  assert.match(visible(f.root), /Bekræftet syntetisk besked/)
  assert.match(visible(f.root), /Bekræftet syntetisk feedback/)
  const labels = find(f.root, 'li').map(li => li.children[0].textContent).sort()
  assert.deepEqual(labels, ['Coach · Ulæst', 'Video · Ulæst'])
  assert.doesNotMatch(visible(f.root), /mangler|i dag|i går/)
  assert.equal(acknowledgements, 0)
  await find(f.root, 'li')[0].children[0].events.get('click')()
  assert.equal(acknowledgements, 1)
  await find(f.root, 'button').find(n => n.textContent === 'Åbn videofeedback').events.get('click')()
  assert.equal(opens, 1); f.dispose()
})

test('actual paged adapters reject identity/repeated/incomplete responses; thread gets one actionable error and no partial data', async () => {
  const videos = Array.from({ length: 6 }, (_, i) => ({ id: `video-${i}` }))
  const cases = [
    { messages: () => [message('foreign', { athlete_id: 'other' })] },
    { messages: () => [message('a'), message('b')] },
    { messages: offset => [message(`m-${offset}`), message(`n-${offset}`)] },
    { videos: () => [{ id: 'foreign-video', athlete_id: 'other' }] },
    { videos: () => videos },
    { videos: offset => videos.map(row => ({ id: `${row.id}-${offset}` })) },
    { messages: () => { throw Error('synthetic technical transport details') } },
  ]
  for (const options of cases) {
    const controller = controllerFor(backend(options)), f = view(controller)
    assert.equal(await controller.refresh(), false)
    assert.equal(controller.snapshot().error, safeRead)
    assert.equal(controller.snapshot().loaded, false)
    assert.deepEqual(controller.snapshot().thread, [])
    assert.equal(find(f.root, 'p').filter(n => n.attributes.role === 'alert').length, 1)
    assert.match(visible(f.root), /Samtalen kunne ikke hentes sikkert/)
    assert.doesNotMatch(visible(f.root), /Ingen beskeder endnu|Forkert|Gentaget|hentegrænse|synthetic technical/)
    f.dispose()
  }
})

test('failed refresh retains only prior confirmed content and draft; explicit retry restores loaded state', async () => {
  let fail = false
  const controller = controllerFor(backend({ messages: () => fail ? [message('foreign', { athlete_id: 'other' })] : [message('known')] }))
  const f = view(controller)
  assert.equal(await controller.refresh(), true); controller.draft('Syntetisk kladde')
  fail = true; assert.equal(await controller.refresh(), false)
  assert.equal(controller.snapshot().thread[0].value.id, 'known')
  assert.equal(controller.snapshot().draft, 'Syntetisk kladde')
  assert.equal(controller.snapshot().error, safeRead)
  fail = false; assert.equal(await controller.refresh(), true)
  assert.equal(controller.snapshot().error, ''); f.dispose()
})

test('video reference failure paths stay unconfirmed and retry the selected client identity', async () => {
  const key = 'entropi2:conversation:submissions:v1:synthetic-owner:synthetic'
  for (const fault of ['identity', 'unavailable', 'quota', 'malformed', 'limit', 'readback']) {
    let failing = true, saved = null
    const ids = [], writes = []
    const store = {
      getItem(k) {
        assert.equal(k, key)
        if (failing && fault === 'malformed') return '{invalid'
        if (failing && fault === 'limit') return JSON.stringify(Array.from({ length: 10000 }, (_, i) => `old-${i}`))
        if (failing && fault === 'readback') return null
        return saved
      },
      setItem(k, value) {
        assert.equal(k, key); writes.push(k)
        if (failing && fault === 'quota') throw Error('synthetic local storage detail')
        saved = value
      },
    }
    const database = backend({ identity: args => {
      ids.push(args.p_client_analysis_id)
      return { data: { id: 'confirmed-video', client_analysis_id: args.p_client_analysis_id,
        athlete_id: failing && fault === 'identity' ? 'other' : 'synthetic', status: 'draft' } }
    } })
    const controller = controllerFor(database, () => failing && fault === 'unavailable' ? null : store)
    const f = view(controller)
    assert.equal(await controller.submission('selected-video'), false, fault)
    assert.equal(controller.snapshot().error, safeVideo)
    assert.deepEqual(controller.snapshot().thread, [])
    assert.doesNotMatch(visible(f.root), /Video sendt|Video-id|synthetic local storage/)
    failing = false
    assert.equal(await controller.submission('selected-video'), true, fault)
    assert.deepEqual(ids, ['selected-video', 'selected-video'])
    assert.equal(controller.snapshot().thread[0].value.id, 'confirmed-video')
    assert.equal(controller.snapshot().error, '')
    assert.ok(writes.every(k => k.startsWith('entropi2:conversation:')))
    f.dispose()
  }
})

test('one empty athlete prompt, no implicit quick reply list; explicit coach choices remain available', async () => {
  for (const role of ['athlete', 'coach']) {
    const controller = createConversation({ enabled: true, storage: () => null, adapters: {
      scope: () => ({ ...scope, role }), load: async () => ({ messages: [], analyses: [] }), templates: () => [],
    } })
    const f = view(controller); await controller.refresh()
    const text = visible(f.root)
    assert.equal((text.match(/Ingen beskeder endnu/g) || []).length, 1)
    assert.doesNotMatch(text, /Ingen gemte hurtige svar|0\/12 egne hurtigsvar/)
    if (role === 'coach') {
      await find(f.root, 'button').find(n => n.textContent === 'Mine hurtigsvar').events.get('click')()
      assert.match(visible(f.root), /Nyt hurtigsvar/)
    } else assert.match(text, /Skriv til din coach herunder/)
    f.dispose()
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { indbakke2Enabled, DEFAULT_INDBAKKE2, readSharedInboxVideos, conversationThread, coachConversations, athleteUnread } from './indbakke2.mjs'
import { enterContact } from './athlete/contactLatest.mjs'
import { REL1030_FEATURES } from './rel1030.mjs'
import { createInboxController } from './dashboard/indbakke2Controller.mjs'
import { install } from './indbakke2Loader.mjs'
import * as dom from './indbakke2Dom.mjs'
install()
const { default: CoachView, InboxPanel, withInboxConversations } = await import('./dashboard/Indbakke2View.mjs')
const { default: AthleteTab } = await import('./athlete/Indbakke2Tab.mjs')
const athletes = [{ id: 'a', name: 'Alfa' }, { id: 'b', name: 'Beta' }]
const message = (id, athlete_id = 'a', extra = {}) => ({ id, athlete_id, sender_role: 'athlete',
  content: `Besked ${id}`, created_at: '2026-10-29T10:00:00Z', category: 'besked', read_by_coach: false, ...extra })
function fixture({ enabled = true, messages = [message('m1')], videos = [], storage, onChanged } = {}) {
  const db = { messages: structuredClone(messages), video_analyses: structuredClone(videos) }
  const calls = []; const failures = {}; const delays = {}
  const database = { from(table) {
    let op = 'read', payload, filters = [], page = null
    const q = {
      select() { return q }, order() { return q },
      range(start, end) { page = [start, end]; calls.push(['range', table, start, end]); return q },
      insert(value) { op = 'insert'; payload = value; return q },
      update(value) { op = 'update'; payload = value; return q },
      eq(key, value) { filters.push(row => row[key] === value); calls.push(['eq', table, key, value]); return q },
      in(key, values) { filters.push(row => values.includes(row[key])); calls.push(['in', table, key, [...values]]); return q },
      async then(resolve, reject) {
        try {
          calls.push([op, table, payload])
          if (delays[op]) await delays[op]
          if (failures[`${op}:${table}`]) return resolve({ error: { message: failures[`${op}:${table}`] } })
          if (op === 'insert') {
            const row = { ...payload, id: `sent-${db[table].length}`, created_at: '2026-10-30T10:00:00Z' }
            db[table].push(row); return resolve({ data: row })
          }
          const rows = db[table].filter(row => filters.every(fn => fn(row)))
          if (op === 'update') rows.forEach(row => Object.assign(row, payload))
          return resolve({ data: structuredClone(page ? rows.slice(page[0], page[1] + 1) : rows) })
        } catch (error) { return reject(error) }
      },
    }
    return q
  } }
  const scope = { enabled, coachId: 'coach-1', athletes, hiddenAthleteIds: new Set() }
  const controller = createInboxController({ enabled, database, getScope: () => scope, storage, onChanged })
  return { controller, scope, database, db, calls, failures, delays }
}
const click = (tree, label) => {
  const node = dom.nodes(tree).find(n => n.type === 'button' && dom.text(n).replace(/\s+/g, ' ').trim() === label)
  assert.ok(node, label); assert.ok(!node.props.disabled, `enabled ${label}`); return node.props.onClick()
}
const panel = c => InboxPanel({ controller: c, state: c.state })

test('default OFF; exact query and rel1030 opt-ins, malformed/duplicate values stay OFF', () => {
  assert.equal(DEFAULT_INDBAKKE2, false)
  for (const query of ['', '?indbakke2=0', '?indbakke2=true', '?indbakke2=1&indbakke2=0', '?rel1030=1&rel1030=1'])
    assert.equal(indbakke2Enabled(query), false, query)
  for (const query of ['?indbakke2=1', '?rel1030=1']) assert.equal(indbakke2Enabled(query), true)
  const f = fixture({ enabled: false })
  assert.deepEqual(f.calls, [])
  assert.throws(() => f.controller.select('a'))
})

test('one conversation per visible athlete, mixed chronological tracks/videos, unread first', async () => {
  const f = fixture({ messages: [message('null', 'a', { category: null }), message('technical', 'a', {
    category: 'teknik', created_at: '2026-10-29T12:00:00Z' }), message('newest', 'b', {
    read_by_coach: true, created_at: '2026-10-30T10:00:00Z' })], videos: [
    { id: 'v', athlete_id: 'a', status: 'shared', analyzed_at: '2026-10-29T11:00:00Z', athlete_feedback: { focus: [{ text: 'Hold trykket' }] } },
    { id: 'draft', athlete_id: 'a', status: 'draft' }, { id: 'foreign', athlete_id: 'private', status: 'shared' },
  ] })
  await f.controller.refresh()
  const rows = f.controller.rows()
  assert.deepEqual(rows.map(r => r.athlete.id), ['a', 'b'])
  assert.equal(rows[0].unread, 2)
  assert.deepEqual(rows[0].thread.map(i => i.key), ['message:null', 'video:v', 'message:technical'])
  await click(panel(f.controller), 'Alfa · 2 ulæste')
  assert.match(dom.text(panel(f.controller)), /Hold trykket/)
  assert.equal(f.calls.filter(c => c[0] === 'update').length, 0, 'opening never acknowledges')
  f.scope.hiddenAthleteIds.add('a')
  assert.deepEqual(f.controller.rows().map(r => r.athlete.id), ['b'])
})

test('text reply handler persists via existing message sender, double click locked, refresh failure does not duplicate', async () => {
  const f = fixture()
  await f.controller.refresh(); f.controller.select('a')
  const textarea = dom.nodes(panel(f.controller)).find(n => n.type === 'textarea')
  textarea.props.onChange({ target: { value: '  Hej atlet  ' } })
  let finish; f.delays.insert = new Promise(resolve => { finish = resolve })
  const sending = click(panel(f.controller), 'Send')
  assert.equal(await f.controller.send(), false)
  await Promise.resolve(); finish(); assert.equal(await sending, true)
  assert.deepEqual(f.calls.find(c => c[0] === 'insert')[2], {
    athlete_id: 'a', sender_role: 'coach', content: 'Hej atlet', category: 'besked',
  })
  assert.equal(f.controller.state.drafts.a, '')
  assert.equal(f.db.messages.at(-1).read_at, undefined, 'coach reply unread for athlete')
  assert.equal(athleteUnread(conversationThread([f.db.messages.at(-1)])[0]), true)
  f.controller.draft('Ny besked'); f.failures['read:messages'] = 'offline'
  assert.equal(await f.controller.send(), true)
  assert.equal(f.controller.state.drafts.a, '')
  assert.match(f.controller.state.status, /sendt/)
  assert.match(f.controller.state.error, /opdateres/)
  assert.equal(f.calls.filter(c => c[0] === 'insert').length, 2)
})

test('failed reply preserves draft; hidden/removed recipients and disabled scope cannot write', async () => {
  const f = fixture(); await f.controller.refresh(); f.controller.select('a'); f.controller.draft('Bevar tekst')
  f.failures['insert:messages'] = 'offline'
  assert.equal(await f.controller.send(), false)
  assert.equal(f.controller.state.drafts.a, 'Bevar tekst')
  delete f.failures['insert:messages']; f.scope.hiddenAthleteIds.add('a')
  assert.equal(await f.controller.send(), false)
  f.scope.hiddenAthleteIds.clear(); f.scope.enabled = false
  assert.equal(await f.controller.send(), false)
  assert.equal(f.calls.filter(c => c[0] === 'insert').length, 1)
})

test('existing quick replies are scoped storage reads and editable drafts, never auto-send', async () => {
  let key
  const f = fixture({ storage: () => ({ getItem(k) { key = k; return JSON.stringify([{ name: 'Ros', text: 'Godt, {atlet}!' }]) } }) })
  await f.controller.refresh(); f.controller.select('a')
  click(panel(f.controller), 'Eksisterende hurtige svar')
  click(panel(f.controller), 'Ros')
  assert.equal(key, 'entropi_coach_message_templates_v1:coach-1')
  assert.equal(f.controller.state.drafts.a, 'Godt, Alfa!')
  assert.equal(f.calls.filter(c => c[0] === 'insert').length, 0)
  f.controller.select('b'); assert.equal(f.controller.state.drafts.b, undefined)
  f.controller.draft('Beta tekst'); f.controller.select('a')
  assert.equal(f.controller.state.drafts.a, 'Godt, Alfa!')
})

test('mark seen without reply updates only displayed incoming snapshot; new arrivals remain unread', async () => {
  const f = fixture({ messages: [message('m1'), message('m2', 'a', { category: 'teknik' }),
    message('coach', 'a', { sender_role: 'coach' }), message('other', 'b')] })
  await f.controller.refresh(); f.controller.select('a')
  f.db.messages.push(message('arrived-after-read'))
  assert.equal(await click(panel(f.controller), 'Markér som set'), true)
  assert.equal(f.db.messages.find(m => m.id === 'm1').read_by_coach, true)
  assert.equal(f.db.messages.find(m => m.id === 'm2').read_by_coach, true)
  for (const id of ['coach', 'other', 'arrived-after-read']) assert.equal(f.db.messages.find(m => m.id === id).read_by_coach, false)
  assert.equal(f.calls.filter(c => c[0] === 'insert').length, 0)
  assert.equal(f.controller.rows().find(r => r.athlete.id === 'a').unread, 0)
  await f.controller.refresh()
  assert.equal(f.controller.rows().find(r => r.athlete.id === 'a').unread, 1)
})

test('missing read column/write failure leaves unread intact; read errors retain prior data and show error', async () => {
  const f = fixture(); await f.controller.refresh(); f.controller.select('a')
  f.failures['update:messages'] = 'column absent'
  assert.equal(await f.controller.seen(), false)
  assert.equal(f.controller.rows()[0].unread, 1)
  assert.match(dom.text(panel(f.controller)), /fortsat ulæst/)
  f.failures['read:video_analyses'] = 'offline'
  assert.equal(await f.controller.refresh(), false)
  assert.equal(f.controller.rows()[0].unread, 1)
  assert.match(dom.text(panel(f.controller)), /kunne ikke opdateres/)
})

test('no reads for empty scope; stale/unmounted refresh ignored; strict effect replay may reactivate', async () => {
  const f = fixture(); f.scope.athletes = []
  await f.controller.refresh(); assert.deepEqual(f.calls, [])
  f.scope.athletes = athletes
  let finish; f.delays.read = new Promise(resolve => { finish = resolve })
  const first = f.controller.refresh(); await Promise.resolve()
  f.controller.dispose(); finish(); assert.equal(await first, false)
  assert.deepEqual(f.controller.state.messages, [])
  f.controller.activate(); assert.equal(await f.controller.refresh(), true)
  assert.equal(f.controller.state.messages.length, 1)
})

test('actual coach component mounts injected reads and renders handler-produced reply in synthetic DOM', async () => {
  dom.reset()
  const f = fixture()
  const props = { database: f.database, coachId: f.scope.coachId, athletes, hiddenAthleteIds: new Set(), refreshCoachInbox: async () => {} }
  let tree = dom.render(CoachView, props); assert.equal(f.calls.length, 0)
  dom.flush(); await new Promise(resolve => setImmediate(resolve))
  tree = dom.render(CoachView, props)
  click(tree, 'Alfa · 1 ulæste')
  tree = dom.render(CoachView, props)
  dom.nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: '<b>Ren tekst</b>' } })
  tree = dom.render(CoachView, props); await click(tree, 'Send')
  tree = dom.render(CoachView, props)
  assert.match(dom.text(tree), /<b>Ren tekst<\/b>/)
  assert.equal(dom.nodes(tree).some(n => n.props.dangerouslySetInnerHTML), false)
  dom.reset()
})

test('actual athlete component merges feedback with both tracks and displays unread coach reply', () => {
  let applied, sent = 0
  const props = { messages: [message('t', 'a', { category: 'teknik', sender_role: 'coach', read_at: null,
    created_at: '2026-10-29T12:00:00Z' }), message('b', 'a', { created_at: '2026-10-29T10:00:00Z' })],
    sharedVideoAnalyses: [{ id: 'v', analyzed_at: '2026-10-29T11:00:00Z', athlete_seen_at: null }],
    renderSharedFeedbackCards: videos => dom.createElement('article', null, `Feedback ${videos[0].id}`),
    fetchSharedVideoAnalyses() {}, messageInput: 'Svar', setMessageInput: value => applied = value,
    sendAthleteMessage: () => sent++ }
  const tree = AthleteTab(props)
  assert.match(dom.text(tree), /2 ulæste/)
  assert.deepEqual(dom.nodes(tree).filter(n => n.type === 'li').map(n => n.props.key), ['message:b', 'video:v', 'message:t'])
  assert.match(dom.text(tree), /Coach.*Ulæst/)
  dom.nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Ny tekst' } })
  click(tree, 'Send'); assert.equal(applied, 'Ny tekst'); assert.equal(sent, 1)
  props.messages[0].read_at = '2026-10-30T10:00:00Z'; props.sharedVideoAnalyses[0].athlete_seen_at = 'seen'
  assert.match(dom.text(AthleteTab(props)), /0 ulæste/)
})

test('integration retains OFF factories and routes opt-in through existing props and no auto-read', () => {
  const coach = readFileSync(new URL('./Dashboard.jsx', import.meta.url), 'utf8')
  const athlete = readFileSync(new URL('./AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(coach, /factory=\{indbakke2 \? indbakke2Factory : indbakkeFactory\}/)
  assert.match(coach, /database: supabase, coachId: session\?\.user\?\.id/)
  assert.match(athlete, /factory=\{indbakke2 \? indbakke2Factory : beskederFactory\}/)
  assert.match(athlete, /contactLatestEnabled\(\) \|\| indbakke2/)
  assert.match(athlete, /enterContact\(\{ enabled: contactLatest/)
})

test('affected release closed list names the exact final feature set', () => {
  const source = readFileSync(new URL('../e2e/rel1030.test.js', import.meta.url), 'utf8')
  const list = source.match(/assert.deepEqual\(REL1030_FEATURES, (\[[^\n]+\])/)[1]
  assert.deepEqual(JSON.parse(list.replaceAll("'", '"')), REL1030_FEATURES)
})

test('coach reads all pages rather than truncating conversations at a row cap', async () => {
  const f = fixture({ messages: Array.from({ length: 501 }, (_, i) => message(`row-${i}`)) })
  await f.controller.refresh()
  assert.equal(f.controller.rows()[0].thread.length, 501)
  assert.deepEqual(f.calls.filter(c => c[0] === 'range' && c[1] === 'messages').map(c => c.slice(2)), [[0, 499], [500, 999]])
})

test('athlete shared-video history uses only existing RPC, including older pages and visible failure fallback', async () => {
  const calls = []
  const videos = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}` }))
  const result = await readSharedInboxVideos({ rpc: async (name, args) => {
    calls.push([name, args]); return { data: videos.slice(args.p_offset, args.p_offset + args.p_limit) }
  } })
  assert.equal(result.data.length, 8)
  assert.deepEqual(calls.map(c => c[1]), [{ p_limit: 6, p_offset: 0 }, { p_limit: 6, p_offset: 6 }])
  assert.ok(calls.every(c => c[0] === 'get_my_shared_video_analyses_v3'))
  const failed = await readSharedInboxVideos({ rpc: async () => { throw Error('mock offline') } })
  assert.match(failed.error.message, /mock offline/)
  const source = readFileSync(new URL('./athlete/laesninger.js', import.meta.url), 'utf8')
  assert.match(source, /indbakke2 = false/)
  assert.match(source, /indbakke2 \? await readSharedInboxVideos\(supabase\) : await supabase.rpc/)
})

test('actual existing contact entry reads both sources but preserves unread until an explicit action in opt-in', () => {
  const calls = []
  const callbacks = { fetchMessages: () => calls.push('messages'), fetchVideos: () => calls.push('videos'),
    markRead: track => calls.push(`read:${track}`), track: 'besked' }
  enterContact({ ...callbacks, enabled: false })
  assert.deepEqual(calls, ['messages', 'read:besked'])
  calls.length = 0; enterContact({ ...callbacks, enabled: true })
  assert.deepEqual(calls, ['messages', 'videos'])
})

test('actual mounted coach view drops drafts and selected conversation on coach identity or visibility change', async () => {
  dom.reset(); const f = fixture()
  let props = { database: f.database, coachId: 'coach-1', athletes, hiddenAthleteIds: new Set() }
  dom.render(CoachView, props); dom.flush(); await new Promise(resolve => setImmediate(resolve))
  let tree = dom.render(CoachView, props); click(tree, 'Alfa · 1 ulæste')
  tree = dom.render(CoachView, props)
  dom.nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Gammel kladde' } })
  props = { ...props, coachId: 'coach-2', hiddenAthleteIds: new Set(['a']) }
  tree = dom.render(CoachView, props); dom.flush(); await new Promise(resolve => setImmediate(resolve))
  tree = dom.render(CoachView, props)
  assert.doesNotMatch(dom.text(tree), /Alfa|Gammel kladde/)
  assert.equal(dom.nodes(tree).filter(n => n.type === 'textarea').length, 0)
  dom.reset()
})

test('combined inbox keeps briefing capabilities while replacing only the conversation panel', async () => {
  dom.reset(); const f = fixture(); let captured
  const LegacyInbox = props => { captured = props; return dom.createElement('main', null, 'Briefing og videokø', props.conversationPanel) }
  const Combined = withInboxConversations(LegacyInbox)
  const handler = () => {}
  const props = { database: f.database, coachId: 'coach-1', athletes, hiddenAthleteIds: new Set(), handleTrainingSignal: handler }
  const tree = dom.render(Combined, props)
  assert.match(dom.text(tree), /Briefing og videokø.*Indbakke/)
  assert.equal(captured.handleTrainingSignal, handler)
  assert.equal(captured.database, f.database)
  const legacy = readFileSync(new URL('./dashboard/IndbakkeView.jsx', import.meta.url), 'utf8')
  assert.match(legacy, /conversationPanel = null/)
  assert.ok(legacy.includes('{conversationPanel || (collapseConversations ? ('))
  dom.reset()
})

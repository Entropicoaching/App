import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createInboxController } from './dashboard/indbakke2Controller.mjs'
import { conversationThread, athleteUnread, indbakke2Enabled, readSharedInboxVideos } from './indbakke2.mjs'
import { install } from './indbakke2Loader.mjs'
import * as dom from './indbakke2Dom.mjs'
install()
const { InboxPanel } = await import('./dashboard/Indbakke2View.mjs')
const own = { id: 'own', athlete_id: 'a', sender_role: 'athlete', content: '<img src=x onerror=alert(1)>',
  created_at: '2026-10-29T12:00:00Z', read_by_coach: false }
function adversary() {
  const calls = []; const blocked = {}; const scope = { enabled: true, coachId: 'coach',
    athletes: [{ id: 'a', name: '<script>Atlet</script>' }], hiddenAthleteIds: new Set() }
  let messages = [own, { ...own, id: 'outsider', athlete_id: 'foreign' }]
  let videos = [{ id: 'draft', athlete_id: 'a', status: 'draft' }, { id: 'foreign-v', athlete_id: 'foreign', status: 'shared' }]
  const database = { from(table) {
    const q = { op: 'read',
      select() { return q }, order() { return q }, range() { return q }, in() { return q }, eq() { return q },
      update(payload) { q.op = 'update'; q.payload = payload; return q },
      insert(payload) { q.op = 'insert'; q.payload = payload; return q },
      async then(resolve, reject) {
        calls.push([table, q.op, q.payload])
        try {
          if (blocked[q.op]) await blocked[q.op]
          return resolve({ data: table === 'messages' ? messages : videos })
        } catch (e) { return reject(e) }
      },
    }; return q
  } }
  const controller = createInboxController({ enabled: true, database, getScope: () => scope,
    storage: () => { throw Error('Storage unavailable') } })
  return { controller, scope, calls, blocked, replace: value => { messages = value; videos = [] } }
}

test('counterexample: permissive mock returns out-of-scope records; thread never exposes foreign or unshared rows', async () => {
  const f = adversary(); await f.controller.refresh(); f.controller.select('a')
  assert.deepEqual(f.controller.state.messages.map(m => m.id), ['own'])
  assert.deepEqual(f.controller.state.videos, [])
  const tree = InboxPanel({ controller: f.controller, state: f.controller.state })
  assert.match(dom.text(tree), /<img src=x onerror=alert\(1\)>/)
  assert.equal(dom.nodes(tree).some(n => n.type === 'img' || n.type === 'script' || n.props.dangerouslySetInnerHTML), false)
  f.scope.athletes = []
  assert.equal(await f.controller.seen(), false)
  assert.equal(f.calls.some(c => c[1] === 'update'), false)
})

test('counterexample: a thrown update leaves unread state unchanged and releases lock for retry', async () => {
  const f = adversary(); await f.controller.refresh(); f.controller.select('a')
  let reject
  f.blocked.update = new Promise((_, fail) => { reject = fail })
  const first = f.controller.seen()
  assert.equal(await f.controller.seen(), false)
  await Promise.resolve(); reject(Error('mock transport'))
  assert.equal(await first, false)
  assert.equal(f.controller.rows()[0].unread, 1)
  assert.equal(f.controller.state.busy, false)
  delete f.blocked.update
  assert.equal(await f.controller.seen(), true)
  assert.equal(f.controller.rows()[0].unread, 0)
})

test('counterexample: storage failure preserves text and cannot write a message', async () => {
  const f = adversary(); await f.controller.refresh(); f.controller.select('a'); f.controller.draft('Bevar')
  f.controller.templates()
  assert.match(f.controller.state.error, /kunne ikke læses/)
  assert.equal(f.controller.state.drafts.a, 'Bevar')
  assert.equal(f.calls.some(c => c[1] === 'insert'), false)
})

test('counterexample: newer refresh wins over delayed older data', async () => {
  const f = adversary()
  let finish; f.blocked.read = new Promise(resolve => { finish = resolve })
  const first = f.controller.refresh(); await Promise.resolve()
  delete f.blocked.read
  f.replace([{ ...own, id: 'newer' }]); assert.equal(await f.controller.refresh(), true)
  f.replace([{ ...own, id: 'older' }]); finish(); assert.equal(await first, false)
  assert.equal(f.controller.state.messages[0].id, 'newer')
})

test('counterexample: OFF refresh/send/seen never touches injected database', async () => {
  const f = adversary(); f.scope.enabled = false
  assert.equal(await f.controller.refresh(), false)
  assert.equal(await f.controller.send(), false)
  assert.equal(await f.controller.seen(), false)
  assert.deepEqual(f.calls, [])
  for (const search of ['?INDBAKKE2=1', '?indbakke2=01', '?indbakke2=1&indbakke2=1', '?rel1030=true']) assert.equal(indbakke2Enabled(search), false)
})

test('counterexample: duplicate timestamps are deterministic; read coach message is not unread', () => {
  const messages = [{ ...own, id: 'b', sender_role: 'coach', read_at: 'seen' }, { ...own, id: 'a' }]
  const first = conversationThread(messages)
  assert.deepEqual(first.map(item => item.key), conversationThread(messages.reverse()).map(item => item.key))
  assert.equal(athleteUnread(first.find(item => item.value.id === 'b')), false)
})

test('counterexample: server ignoring pagination returns a visible error instead of infinite duplicate feedback', async () => {
  let calls = 0
  const page = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}` }))
  const result = await readSharedInboxVideos({ rpc: async () => { calls++; return { data: page } } })
  assert.equal(calls, 2)
  assert.match(result.error.message, /kunne ikke opdateres/)
})

// R1-APP-INDBAKKE2: source contract regression, independent of checkout EOL.
const athleteSource = () => readFileSync(new URL('./AthleteView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const lockedAthletePrefix = [
  "import NytIAppen, { nytAthleteNavigation } from './nytIAppen.mjs'",
  "import { contactLatestEnabled, enterContact, scrollContactEnd } from './athlete/contactLatest.mjs'",
  "import { VIDEO_SET_SELECTION_ENABLED, videoOptionsForDay, resolveVideoSet } from './athlete/videoSetSelection.mjs'",
  "import { findDagensPas } from './nextSet.js'",
].join('\n') + '\n'
const lockedHomeLine = "        {tab === 'hjem' && (!enkelOn || ['traening', 'alle'].includes(route)) && <MobilityHomeworkHome key={athlete?.id} enabled={mobilitetHjemme} athleteId={athlete?.id} />}"
function assertAthleteContract(source) {
  assert.ok(source.startsWith(lockedAthletePrefix), 'four initial Athlete imports remain first and exact')
  assert.ok(source.split('\n').includes(lockedHomeLine), 'complete Home JSX line survives')
  assert.match(source, /<MobilityHomeworkProgress enabled=\{mobilitetOpfoelgning === true && !coachAthleteId\} athleteId=\{athlete\?\.id\}>\s*\{tab === 'hjem'/)
}
test('R1 import repair retains all locked imports and complete wrapped Home line', () => {
  const source = athleteSource()
  assertAthleteContract(source)
  const addition = "import { indbakke2Enabled } from './indbakke2.mjs'"
  assert.equal(source.split('\n')[4], addition)
  assert.equal(source.split(addition).length - 1, 1)
  assert.match(source, /const indbakke2 = indbakke2Enabled\(/)
  assert.match(source, /indbakke2 \? indbakke2Factory : beskederFactory/)
})
test('R1 counterexamples reject the previous prepended import and a modified Home line', () => {
  const source = athleteSource()
  const addition = "import { indbakke2Enabled } from './indbakke2.mjs'\n"
  const previous = addition + source.replace(addition, '')
  assert.throws(() => assertAthleteContract(previous), /four initial Athlete imports/)
  assert.throws(() => assertAthleteContract(source.replace(lockedHomeLine, lockedHomeLine.trim())), /complete Home JSX/)
})
test('R1 actual gate remains default OFF for empty and hostile query inputs', () => {
  for (const search of ['', '?indbakke2=0', '?indbakke2=true', '?indbakke2=1&indbakke2=0', '?rel1030=1&rel1030=1']) {
    assert.equal(indbakke2Enabled(search), false)
  }
  assert.equal(indbakke2Enabled('?indbakke2=1'), true)
  assert.equal(indbakke2Enabled('?rel1030=1'), true)
})

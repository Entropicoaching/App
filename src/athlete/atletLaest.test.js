// E2-ATLET-LAEST1: med Entropi 2 tændt markerer atletens beskedfane ikke coachbeskeder som læst ved åbning.
// Den præcise effekt fra AthleteView.jsx evalueres med den faktiske enterContact og den faktiske
// markTrackRead fra beskederOgVaegt.jsx mod en syntetisk backend, der registrerer hver skrivning.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contactModules } from './contactHarness.mjs'
import { setBackend } from './contactFakes.mjs'
import { enterContact } from './contactLatest.mjs'
import { createConversationAdapters } from '../entropi2/conversation/conversationAdapters.mjs'

const { lavBeskederOgVaegt } = await contactModules()
const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
const condition = source.match(/ {2}const e2SelvKvittering = (.+?)\r?\n/)?.[1]
const body = source.match(/useEffect\(\(\) => \{ (if \(tab === 'beskeder' && athlete\?\.id\) enterContact\(\{.+?\}\)) \}, \[tab, athlete\?\.id, msgTrack, contactLatest, e2SelvKvittering\]\)/)?.[1]
const effect = new Function('e2', 'role', 'coachAthleteId', 'onExitPreview', 'athlete', 'tab', 'msgTrack', 'contactLatest',
  'enterContact', 'fetchAthleteMessages', 'markTrackRead', 'fetchSharedVideoAnalyses',
  `const e2SelvKvittering = ${condition}\n${body}`)

// Syntetisk PostgREST-kæde: registrerer metode, patch og filtre; ingen net.
function syntheticBackend(writes) {
  return {
    from(table) {
      const call = { table, method: 'GET', filters: [] }
      const chain = {
        update(patch) { call.method = 'PATCH'; call.patch = patch; return chain },
        select() { return chain },
        eq(column, value) { call.filters.push(['eq', column, value]); return chain },
        is(column, value) { call.filters.push(['is', column, value]); return chain },
        order() { return chain },
        then(resolve) {
          if (call.method === 'PATCH') writes.push(call)
          const id = call.filters.find(f => f[1] === 'id')?.[2]
          return resolve({ data: id ? [{ id }] : [], error: null })
        },
      }
      return chain
    },
  }
}

async function openMessages({ e2, role = 'athlete', coachAthleteId = null, onExitPreview = undefined, track = 'besked', contactLatest = false }) {
  const writes = [], reads = []
  setBackend(syntheticBackend(writes), async fn => { reads.push('messages'); await fn(); return { data: [], ok: true } })
  const athlete = { id: 'syn-atlet', user_id: 'syn-bruger' }
  const { fetchAthleteMessages, markTrackRead } = lavBeskederOgVaegt({ athlete, msgTrack: track, onReadError: () => () => {},
    setMessages: () => {}, setUnreadMsgCount: () => {}, sharedVideoAnalyses: [], setSharedVideoAnalyses: () => {} })
  const videos = []
  try {
    effect(e2, role, coachAthleteId, onExitPreview, athlete, 'beskeder', track, contactLatest,
      enterContact, fetchAthleteMessages, markTrackRead, () => videos.push('videos'))
    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))
  } finally { setBackend(null) }
  return { writes, reads, videos }
}

test('E2-ATLET-LAEST1: effekten og betingelsen findes i AthleteView.jsx', () => {
  assert.equal(condition, "e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id")
  assert.ok(body?.includes('markRead: e2SelvKvittering ? () => {} : markTrackRead'))
})

test('E2-ATLET-LAEST1: flaget tændt sender ingen PATCH ved åbning af Beskeder, men henter beskeder', async () => {
  for (const track of ['besked', 'teknik']) {
    const { writes, reads, videos } = await openMessages({ e2: true, track })
    assert.deepEqual(writes, [], track)
    assert.ok(reads.length >= 1, 'beskederne hentes stadig: ' + track)
    assert.deepEqual(videos, track === 'teknik' ? ['videos'] : [])
  }
})

test('E2-ATLET-LAEST1: flaget slukket markerer sporets coachbeskeder læst som før', async () => {
  for (const track of ['besked', 'teknik']) {
    const { writes } = await openMessages({ e2: false, track })
    assert.equal(writes.length, 1, track)
    const [w] = writes
    assert.equal(w.table, 'messages')
    assert.deepEqual(Object.keys(w.patch), ['read_at'])
    assert.ok(Number.isFinite(Date.parse(w.patch.read_at)))
    assert.deepEqual(w.filters, [['eq', 'athlete_id', 'syn-atlet'], ['eq', 'sender_role', 'coach'], ['eq', 'category', track], ['is', 'read_at', null]])
  }
})

test('E2-ATLET-LAEST1: coachens forhåndsvisning bruger den gamle visning og markering uændret', async () => {
  for (const props of [{ coachAthleteId: 'syn-atlet' }, { onExitPreview: () => {} }, { role: 'coach' }]) {
    const { writes } = await openMessages({ e2: true, ...props })
    assert.equal(writes.length, 1, JSON.stringify(Object.keys(props)))
  }
})

test('E2-ATLET-LAEST1: samtalens egen kvittering skriver kun den ene besked ved eksplicit åbning', async () => {
  const writes = []
  const scope = { enabled: true, role: 'athlete', ownerId: 'syn-bruger', athleteId: 'syn-atlet', athleteUserId: 'syn-bruger' }
  const adapters = createConversationAdapters({ enabled: true, database: syntheticBackend(writes), getScope: () => scope })
  const item = { kind: 'message', value: { id: 'syn-besked', athlete_id: 'syn-atlet', sender_role: 'coach', content: 'x' } }
  const saved = await adapters.seen(item)
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].filters, [['eq', 'athlete_id', 'syn-atlet'], ['eq', 'id', 'syn-besked'], ['eq', 'sender_role', 'coach']])
  assert.ok(saved.read_at)
})

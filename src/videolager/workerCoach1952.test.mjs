// ORDRE 1952 (Marc 20. nov.: "2 ja"): videolageret lader coachen sende for sin egen atlet, aldrig for en fremmed.
// Workeren spørger generalprøvens PGlite-kopi af produktionens athletes (ægte RLS) gennem en lille PostgREST;
// kun /auth/v1/user er opdigtet. Syntetiske personer fra proeveDb.mjs, R2 i hukommelsen, intet net.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRehearsalDb, PEOPLE, ATHLETES } from '../../scripts/generalproeve/proeveDb.mjs'
import { listenPgRest } from '../../e2e/pglite-postgrest.mjs'
import { handleVideolager } from './worker.js'
import { uploadTilVideolager } from './klient.js'

const ANALYSIS = '5e000000-0000-4000-8000-000000001952'
const ORIGIN = 'https://videolager.test'

function fakeBucket() {
  const store = new Map()
  return {
    store,
    async head(key) { return store.has(key) ? { size: store.get(key).length } : null },
    async put(key, body) { store.set(key, new Uint8Array(await new Response(body).arrayBuffer())) },
    async get() { return null },
  }
}

test('ordre 1952: upload-url for atlet, coachens egen atlet, fremmed atlet og anonym', { timeout: 180000 }, async () => {
  const { rest } = await createRehearsalDb({ withExtra: false })
  const server = await listenPgRest(rest, 0)
  try {
    const known = new Map(Object.values(PEOPLE).map(p => [`tok-${p.id}-lang-nok`, p.id]))
    const fetchFn = async (url, init) => {
      const token = init.headers.authorization.replace('Bearer ', '')
      const path = new URL(url).pathname
      if (path === '/auth/v1/user') return known.has(token)
        ? new Response(JSON.stringify({ id: known.get(token) }), { status: 200 }) : new Response('{}', { status: 401 })
      return fetch(String(url).replace('https://supabase.test', server.url),
        { ...init, headers: { ...init.headers, authorization: `Bearer ${token.replace(/-lang-nok$/, '')}` } })
    }
    const env = { VIDEO: fakeBucket(), SUPABASE_URL: 'https://supabase.test', SUPABASE_PUBLISHABLE_KEY: 'offentlig', ALLOWED_ORIGINS: 'https://app.test' }
    const ask = async (person, body) => {
      const response = await handleVideolager(new Request(`${ORIGIN}/upload-url`, { method: 'POST',
        headers: person ? { authorization: `Bearer tok-${person.id}-lang-nok` } : {},
        body: JSON.stringify({ client_analysis_id: ANALYSIS, mime_type: 'video/mp4', size: 5, ...body }) }), env, { fetchFn })
      return { status: response.status, data: await response.json() }
    }
    const { coach, athlete, otherCoach } = PEOPLE

    // Atleten: som i dag uden athlete_id, og med sin egen atlet.
    let answer = await ask(athlete, {})
    assert.equal(answer.status, 200); assert.equal(answer.data.key, `${ATHLETES.mine}/${ANALYSIS}.mp4`)
    answer = await ask(athlete, { athlete_id: ATHLETES.mine })
    assert.equal(answer.status, 200); assert.equal(answer.data.key, `${ATHLETES.mine}/${ANALYSIS}.mp4`)
    // Coachen for sin egen atlet: både en atlet uden login (coachens egen profil) og en atlet med eget login.
    for (const aid of [ATHLETES.unclaimed, ATHLETES.mine]) {
      answer = await ask(coach, { athlete_id: aid })
      assert.equal(answer.status, 200, aid); assert.equal(answer.data.key, `${aid}/${ANALYSIS}.mp4`)
    }
    // Aldrig for en fremmed atlet: hverken coachen, den anden coach eller atleten.
    assert.equal((await ask(coach, { athlete_id: ATHLETES.other })).status, 403)
    assert.equal((await ask(otherCoach, { athlete_id: ATHLETES.mine })).status, 403)
    assert.equal((await ask(athlete, { athlete_id: ATHLETES.other })).status, 403)
    assert.equal((await ask(athlete, { athlete_id: ATHLETES.unclaimed })).status, 403)
    // Ugyldigt eller opdigtet id giver nej, og coachen uden athlete_id får samme svar som i dag.
    assert.equal((await ask(coach, { athlete_id: 'ikke-et-id' })).status, 403)
    assert.equal((await ask(coach, { athlete_id: '5e000000-0000-4000-8000-00000000dead' })).status, 403)
    answer = await ask(otherCoach, {})
    assert.equal(answer.status, 403); assert.equal(answer.data.error, 'Kun atleter kan sende video')
    // Anonym: intet login giver 401.
    assert.equal((await ask(null, { athlete_id: ATHLETES.mine })).status, 401)

    // Appens klient sender den valgte atlet med, og klippet lander i atletens mappe i lageret.
    // Browseren sætter content-length på PUT selv; det gør Node's Request ikke.
    const lagerFetch = async (url, init) => String(url).startsWith(ORIGIN)
      ? handleVideolager(new Request(url, init.body instanceof Blob
        ? { ...init, headers: { ...init.headers, 'content-length': String(init.body.size) } } : init), env, { fetchFn })
      : fetchFn(url, init)
    const path = `${ATHLETES.unclaimed}/${ANALYSIS}.mp4`
    const sent = await uploadTilVideolager({ base: ORIGIN, token: `tok-${coach.id}-lang-nok`, athleteId: ATHLETES.unclaimed,
      clientAnalysisId: ANALYSIS, path, file: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'video/mp4' }), mimeType: 'video/mp4', fetchFn: lagerFetch })
    assert.deepEqual(sent, { data: { path }, error: null })
    assert.deepEqual([...env.VIDEO.store.get(path)], [1, 2, 3, 4, 5])
    const refused = await uploadTilVideolager({ base: ORIGIN, token: `tok-${coach.id}-lang-nok`, athleteId: ATHLETES.other,
      clientAnalysisId: ANALYSIS, path: `${ATHLETES.other}/${ANALYSIS}.mp4`, file: new Blob([new Uint8Array([1])], { type: 'video/mp4' }), mimeType: 'video/mp4', fetchFn: lagerFetch })
    assert.equal(refused.error.status, 403)
    assert.equal(env.VIDEO.store.has(`${ATHLETES.other}/${ANALYSIS}.mp4`), false)
  } finally { await server.close() }
})

// Kontrol 1952, bemærkning 1: workerens eget tjek alene, uden RLS. Opslaget giver her en fremmed række tilbage
// (som hvis RLS på athletes var for løs); workeren skal stadig sige nej.
test('ordre 1952: workeren afviser en fremmed række, selv hvis opslaget viser den', async () => {
  const USER = '5e000000-0000-4000-8000-0000000000aa'
  const FREMMED = '5e000000-0000-4000-8000-0000000000bb'
  const EGEN = '5e000000-0000-4000-8000-0000000000cc'
  const rows = { [FREMMED]: { id: FREMMED, user_id: 'en-anden', coach_id: 'en-anden-coach' }, [EGEN]: { id: EGEN, user_id: null, coach_id: USER } }
  const fetchFn = async url => {
    const u = new URL(url)
    if (u.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: USER }), { status: 200 })
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, '')
    return new Response(JSON.stringify(rows[id] ? [rows[id]] : []), { status: 200 })
  }
  const env = { VIDEO: fakeBucket(), SUPABASE_URL: 'https://supabase.test', SUPABASE_PUBLISHABLE_KEY: 'offentlig' }
  const ask = athleteId => handleVideolager(new Request(`${ORIGIN}/upload-url`, { method: 'POST',
    headers: { authorization: 'Bearer token-for-opdigtet-coach-1234567890' },
    body: JSON.stringify({ athlete_id: athleteId, client_analysis_id: ANALYSIS, mime_type: 'video/mp4', size: 5 }) }), env, { fetchFn })
  assert.equal((await ask(FREMMED)).status, 403)
  assert.equal((await ask(EGEN)).status, 200)
})

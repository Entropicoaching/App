// ORDRE 1537v0 · appens klient til videolageret prøvet mod den rigtige Worker-logik (worker.js) i hukommelsen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { handleVideolager } from './worker.js'
import { hentFraVideolager, uploadTilVideolager, videolagerUrl } from './klient.js'

const ATHLETE = '11111111-1111-4111-8111-111111111111'
const ANALYSIS = '33333333-3333-4333-8333-333333333333'
const PATH = `${ATHLETE}/${ANALYSIS}.mp4`
const BASE = 'https://videolager.test'
const TOKEN = 'token-for-opdigtet-atlet-1234567890'

function lager({ rows = [{ id: 'r1' }] } = {}) {
  const store = new Map()
  const VIDEO = {
    async head(key) { return store.has(key) ? { size: store.get(key).length } : null },
    async put(key, body) { store.set(key, new Uint8Array(await new Response(body).arrayBuffer())) },
    async get(key) { const bytes = store.get(key); return bytes ? { size: bytes.length, body: bytes, httpMetadata: {} } : null },
  }
  const supabase = async (url, init) => {
    const ok = init.headers.authorization === `Bearer ${TOKEN}`
    const path = new URL(url).pathname
    const data = !ok ? null : path === '/auth/v1/user' ? { id: 'bruger' } : path === '/rest/v1/athletes' ? [{ id: ATHLETE }] : rows
    return new Response(JSON.stringify(data || {}), { status: data ? 200 : 401 })
  }
  const env = { VIDEO, SUPABASE_URL: 'https://supabase.test', SUPABASE_PUBLISHABLE_KEY: 'offentlig', ALLOWED_ORIGINS: 'https://app.test' }
  const calls = []
  const fetchFn = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${new URL(url).pathname}`)
    if (init.signal?.aborted) throw new DOMException('afbrudt', 'AbortError')
    const headers = new Headers(init.headers)
    if (init.body instanceof Blob) headers.set('content-length', String(init.body.size))
    const body = init.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : init.body
    return handleVideolager(new Request(url, { method: init.method, headers, body }), env, { fetchFn: supabase })
  }
  return { store, fetchFn, calls }
}

const klip = () => new Blob([new Uint8Array([1, 2, 3, 4, 5, 6])], { type: 'video/mp4' })
const upload = (l, extra = {}) => uploadTilVideolager({ base: BASE, token: TOKEN, clientAnalysisId: ANALYSIS, path: PATH,
  file: klip(), mimeType: 'video/mp4', fetchFn: l.fetchFn, ...extra })

test('videolagerUrl: kun en rigtig adresse slår lageret til', () => {
  assert.equal(videolagerUrl({}), '')
  assert.equal(videolagerUrl(undefined), '')
  assert.equal(videolagerUrl({ VITE_VIDEOLAGER_URL: '  ' }), '')
  assert.equal(videolagerUrl({ VITE_VIDEOLAGER_URL: 'videolager' }), '')
  assert.equal(videolagerUrl({ VITE_VIDEOLAGER_URL: 'https://videolager.test/ ' }), 'https://videolager.test')
})

test('upload: klippet lander i lageret under appens egen sti, og samme klip igen er ikke en fejl', async () => {
  const l = lager()
  assert.deepEqual(await upload(l), { data: { path: PATH }, error: null })
  assert.deepEqual([...l.store.get(PATH)], [1, 2, 3, 4, 5, 6])
  assert.deepEqual(await upload(l), { data: { path: PATH }, error: null })
  assert.equal(l.calls.filter(c => c.startsWith('PUT')).length, 1)
})

test('upload: fejl bliver til { error } med en sætning, aldrig et kast', async () => {
  const l = lager()
  assert.equal((await upload(l, { token: '' })).error.message, 'Log ind igen')
  assert.equal((await upload(l, { token: 'forkert-token-som-er-lang-nok-123' })).error.message, 'Log ind igen')
  assert.match((await upload(l, { path: `${ATHLETE}/44444444-4444-4444-8444-444444444444.mp4` })).error.message, /anden sti/)
  assert.match((await upload(l, { mimeType: 'image/png' })).error.message, /understøttes ikke/)
  const controller = new AbortController(); controller.abort()
  assert.equal((await upload(l, { signal: controller.signal })).error.message, 'Annulleret')
  assert.equal((await upload(l, { fetchFn: async () => { throw new Error('net') } })).error.message, 'Forbindelsen blev afbrudt. Prøv igen')
  assert.equal(l.store.size, 0)
})

test('hent: adresse for klip i lageret, null for ældre klip og ved fejl (så Supabase bruges)', async () => {
  const l = lager()
  assert.equal(await hentFraVideolager({ base: BASE, token: TOKEN, videoPath: PATH, fetchFn: l.fetchFn }), null)
  await upload(l)
  const url = await hentFraVideolager({ base: BASE, token: TOKEN, videoPath: PATH, fetchFn: l.fetchFn })
  assert.match(url, /^https:\/\/videolager\.test\/blob\//)
  const hentet = await l.fetchFn(url, { method: 'GET' })
  assert.deepEqual([...new Uint8Array(await hentet.arrayBuffer())], [1, 2, 3, 4, 5, 6])
  assert.equal(await hentFraVideolager({ base: BASE, token: '', videoPath: PATH, fetchFn: l.fetchFn }), null)
  assert.equal(await hentFraVideolager({ base: BASE, token: TOKEN, videoPath: PATH, fetchFn: async () => { throw new Error('net') } }), null)
  const ingenRaekke = lager({ rows: [] })
  assert.equal(await hentFraVideolager({ base: BASE, token: TOKEN, videoPath: PATH, fetchFn: ingenRaekke.fetchFn }), null)
})

// ORDRE 1610v · en fejl i videolageret må ikke alene stoppe en indsendelse: atletens upload falder
// tilbage til Supabase, undtagen når atleten selv har afbrudt.
test('atletens upload falder tilbage til Supabase, når videolageret ikke tager imod klippet', async () => {
  const { readFileSync } = await import('node:fs')
  const hook = readFileSync(new URL('../athlete/useVideoCoachBro.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = hook.indexOf('const lagerSvar = lager'), slut = hook.indexOf('} catch (error) {', start)
  assert.ok(start > 0 && slut > start)
  const valg = hook.slice(start, slut)
  assert.match(valg, /upload = lagerSvar && \(!lagerSvar\.error \|\| controller\.signal\.aborted\) \? lagerSvar\n(\s+: !videoUploadReserveMulig\(file\.size\) [^\n]+\n)?\s+: videoUploadRetryEnabled\(\)/)
  assert.match(valg, /\.from\(VIDEOCOACH_UPLOAD_BUCKET\)\n\s+\.upload\(path, file, \{ contentType: mimeType, upsert: false \}\)/)
})

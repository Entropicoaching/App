// ORDRE 1537b · videolageret prøvet hermetisk: opdigtet Supabase (fetchFn) og en R2-bucket i hukommelsen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { handleVideolager, VIDEOLAGER_WORKER_MAX_BYTES } from './worker.js'
import { presignS3Url, signBlobUrl, verifyBlobUrl } from './signering.js'

const ATHLETE = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const ANALYSIS = '33333333-3333-4333-8333-333333333333'
const KEY = `${ATHLETE}/${ANALYSIS}.mp4`
const ORIGIN = 'https://videolager.test'
const ATHLETE_TOKEN = 'token-for-opdigtet-atlet-1234567890'
const COACH_TOKEN = 'token-for-opdigtet-coach-1234567890'

function fakeBucket() {
  const store = new Map()
  return {
    store,
    async head(key) { return store.has(key) ? { size: store.get(key).bytes.length } : null },
    async put(key, body, options) {
      store.set(key, { bytes: new Uint8Array(await new Response(body).arrayBuffer()), contentType: options?.httpMetadata?.contentType })
    },
    async get(key, options) {
      const item = store.get(key)
      if (!item) return null
      const match = /^bytes=(\d+)-(\d*)$/.exec(options?.range?.get?.('range') || '')
      const offset = match ? Number(match[1]) : 0
      const end = match && match[2] ? Number(match[2]) : item.bytes.length - 1
      return { size: item.bytes.length, body: item.bytes.slice(offset, end + 1), httpMetadata: { contentType: item.contentType },
        range: match ? { offset, length: end - offset + 1 } : undefined }
    },
  }
}

// Opdigtet Supabase: atleten har en athletes-række; coachen har ingen, men må se video_analyses.
function fakeSupabase({ rows = [] } = {}) {
  return async (url, init) => {
    const token = init.headers.authorization.replace('Bearer ', '')
    const known = token === ATHLETE_TOKEN || token === COACH_TOKEN
    const path = new URL(url).pathname
    const reply = (status, data) => new Response(JSON.stringify(data), { status })
    if (!known) return reply(401, { message: 'invalid' })
    if (path === '/auth/v1/user') return reply(200, { id: token === ATHLETE_TOKEN ? USER : 'coach' })
    if (path === '/rest/v1/athletes') return reply(200, token === ATHLETE_TOKEN ? [{ id: ATHLETE }] : [])
    if (path === '/rest/v1/video_analyses') return reply(200, rows)
    return reply(404, {})
  }
}

function setup(extraEnv = {}, supabase = {}) {
  const env = { VIDEO: fakeBucket(), SUPABASE_URL: 'https://supabase.test', SUPABASE_PUBLISHABLE_KEY: 'offentlig',
    ALLOWED_ORIGINS: 'https://app.test', ...extraEnv }
  const call = (path, { method = 'POST', token, body, headers = {}, now } = {}) => handleVideolager(
    new Request(path.startsWith('http') ? path : ORIGIN + path, { method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body == null ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body) }),
    env, { fetchFn: fakeSupabase(supabase), now })
  return { env, call }
}

const uploadBody = (size = 5) => ({ client_analysis_id: ANALYSIS, mime_type: 'video/mp4', size })

test('upload-url kræver login og en atlet', async () => {
  const { call } = setup()
  assert.equal((await call('/upload-url', { body: uploadBody() })).status, 401)
  assert.equal((await call('/upload-url', { token: 'ukendt-token-som-er-lang-nok-123', body: uploadBody() })).status, 401)
  assert.equal((await call('/upload-url', { token: COACH_TOKEN, body: uploadBody() })).status, 403)
})

test('upload-url afviser forkert format, manglende størrelse og for store klip', async () => {
  const { call } = setup()
  assert.equal((await call('/upload-url', { token: ATHLETE_TOKEN, body: { ...uploadBody(), mime_type: 'image/png' } })).status, 400)
  assert.equal((await call('/upload-url', { token: ATHLETE_TOKEN, body: uploadBody(0) })).status, 400)
  assert.equal((await call('/upload-url', { token: ATHLETE_TOKEN, body: uploadBody(VIDEOLAGER_WORKER_MAX_BYTES + 1) })).status, 413)
})

test('worker-vejen: atleten uploader til sin egen mappe, og kun den der må se rækken kan hente klippet', async () => {
  const { env, call } = setup({}, { rows: [{ id: 'r1' }] })
  const bytes = new Uint8Array([1, 2, 3, 4, 5])
  const issued = await (await call('/upload-url', { token: ATHLETE_TOKEN, body: uploadBody(bytes.length) })).json()
  assert.equal(issued.key, KEY)
  assert.equal(issued.mode, 'worker')
  const put = { method: 'PUT', body: bytes, headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } }
  assert.equal((await call(issued.url, { ...put, headers: { ...put.headers, 'content-type': 'video/webm' } })).status, 400)
  assert.equal((await call(issued.url, put)).status, 200)
  assert.deepEqual([...env.VIDEO.store.get(KEY).bytes], [...bytes])
  // et klip overskrives aldrig
  assert.equal((await call(issued.url, put)).status, 409)
  assert.deepEqual(await (await call('/upload-url', { token: ATHLETE_TOKEN, body: uploadBody(bytes.length) })).json(), { exists: true, key: KEY })

  const download = await (await call('/download-url', { token: COACH_TOKEN, body: { video_path: KEY } })).json()
  const full = await call(download.url, { method: 'GET' })
  assert.equal(full.status, 200)
  assert.deepEqual([...new Uint8Array(await full.arrayBuffer())], [...bytes])
  const part = await call(download.url, { method: 'GET', headers: { range: 'bytes=1-3' } })
  assert.equal(part.status, 206)
  assert.equal(part.headers.get('content-range'), 'bytes 1-3/5')
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [2, 3, 4])
  // en hente-adresse kan ikke bruges til at skrive, og den udløber
  assert.equal((await call(download.url, put)).status, 405)
  assert.equal((await call(download.url, { method: 'GET', now: Date.now() + 601_000 })).status, 403)
  assert.equal((await call(download.url.replace(/sig=[0-9a-f]{4}/, 'sig=0000'), { method: 'GET' })).status, 403)
})

test('download-url følger RLS: ingen synlig række giver ingen adresse', async () => {
  const { call } = setup({}, { rows: [] })
  assert.equal((await call('/download-url', { token: COACH_TOKEN, body: { video_path: KEY } })).status, 404)
  assert.equal((await call('/download-url', { token: COACH_TOKEN, body: { video_path: '../hemmelig.mp4' } })).status, 400)
  assert.equal((await call('/download-url', { token: 'ukendt-token-som-er-lang-nok-123', body: { video_path: KEY } })).status, 401)
})

test('download-url: et klip, der ikke ligger i lageret (ældre klip i Supabase), giver 404 med not_in_lager', async () => {
  const { call } = setup({}, { rows: [{ id: 'r1' }] })
  const svar = await call('/download-url', { token: COACH_TOKEN, body: { video_path: KEY } })
  assert.equal(svar.status, 404)
  assert.equal((await svar.json()).not_in_lager, true)
})

test('s3-vejen: adressen peger direkte på R2 og binder content-type og størrelse', async () => {
  const { call } = setup({ R2_ACCOUNT_ID: 'konto', R2_ACCESS_KEY_ID: 'opdigtet-id', R2_SECRET_ACCESS_KEY: 'opdigtet', R2_BUCKET_NAME: 'videocoach' })
  const issued = await (await call('/upload-url', { token: ATHLETE_TOKEN, body: uploadBody(400 * 1024 * 1024) })).json()
  const url = new URL(issued.url)
  assert.equal(issued.mode, 's3')
  assert.equal(url.host, 'konto.r2.cloudflarestorage.com')
  assert.equal(url.pathname, `/videocoach/${KEY}`)
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host')
  assert.equal(url.searchParams.get('X-Amz-Expires'), '600')
  assert.match(url.searchParams.get('X-Amz-Signature'), /^[0-9a-f]{64}$/)
})

test('CORS: kun kendte oprindelser får svarhoveder', async () => {
  const { call } = setup()
  const ok = await call('/sundhed', { method: 'OPTIONS', headers: { origin: 'https://app.test' } })
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.test')
  const other = await call('/sundhed', { method: 'OPTIONS', headers: { origin: 'https://fremmed.test' } })
  assert.equal(other.headers.get('access-control-allow-origin'), null)
})

test('signering: blob-adresser kan ikke ændres, og SigV4 rammer AWS eget eksempel', async () => {
  const url = await signBlobUrl(ORIGIN, KEY, { op: 'get', exp: 2000 }, 'hemmelig')
  assert.equal((await verifyBlobUrl(url, 'hemmelig', 1000)).key, KEY)
  assert.equal(await verifyBlobUrl(url, 'en-anden', 1000), null)
  assert.equal(await verifyBlobUrl(url, 'hemmelig', 2000), null)
  assert.equal(await verifyBlobUrl(url.replace('exp=2000', 'exp=9000'), 'hemmelig', 1000), null)
  // Eksemplet fra AWS-dokumentationen ("Authenticating Requests: Using Query Parameters").
  // Nøglerne er AWS' offentlige eksempelværdier, ikke rigtige nøgler.
  const presigned = await presignS3Url({ method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt',
    accessKeyId: 'AKIAIOSFODNN7' + 'EXAMPLE', secretAccessKey: ['wJalrXUtnFEMI', 'K7MDENG', 'bPxRfiCY' + 'EXAMPLEKEY'].join('/'),
    region: 'us-east-1', expiresSeconds: 86400, now: new Date('2013-05-24T00:00:00Z') })
  assert.equal(new URL(presigned).searchParams.get('X-Amz-Signature'), 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404')
})

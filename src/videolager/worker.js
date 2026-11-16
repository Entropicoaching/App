// ORDRE 1537b · videolager: en Cloudflare Worker, der efter Supabase-login udsteder korte
// adresser til upload og download af videocoachens klip i R2. Workeren har INGEN
// service-nøgle: den spørger Supabase med brugerens eget token, så RLS bestemmer,
// hvem der må hvad (atleten uploader til sin egen mappe; den, der kan se rækken i
// video_analyses, kan hente klippet).
//
// To veje til selve bytes:
//   s3     · R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY er sat: telefonen
//            sender direkte til R2 med en forhåndssigneret adresse (drift). R2_S3_HOST
//            sættes, hvis bucket'en ligger i EU-jurisdiktionen (<konto>.eu.r2.cloudflarestorage.com).
//   worker · ellers: adressen peger på denne Worker (/blob/...), som bruger R2-bindingen.
//            Det er vejen i `wrangler dev`, hvor lokal R2 ikke har noget S3-endepunkt.
import { buildVideoUploadPath, videoUploadMimeAllowed } from '../videoCoachUpload.js'
import { presignS3Url, signBlobUrl, verifyBlobUrl } from './signering.js'

export const VIDEOLAGER_URL_SECONDS = 600
export const VIDEOLAGER_S3_MAX_BYTES = 1024 * 1024 * 1024
// Cloudflare afviser større forespørgsler end 100 MB gennem en Worker.
export const VIDEOLAGER_WORKER_MAX_BYTES = 95 * 1024 * 1024

const KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm|m4v|3gp)$/i

// Uden URL_SIGNING_SECRET laves en tilfældig hemmelighed i hukommelsen: nok til lokal
// kørsel (én proces), og intet at gemme i en fil.
let memorySecret = null
function signingSecret(env) {
  if (env.URL_SIGNING_SECRET) return env.URL_SIGNING_SECRET
  if (!memorySecret) memorySecret = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('')
  return memorySecret
}

function lagerMode(env) {
  return env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY ? 's3' : 'worker'
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin')
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, range',
    'access-control-expose-headers': 'content-range, content-length, accept-ranges',
    'access-control-max-age': '600',
    vary: 'origin',
  }
}

async function supabaseJson(path, token, env, fetchFn) {
  const response = await fetchFn(`${env.SUPABASE_URL}${path}`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!response.ok) return null
  try { return await response.json() } catch { return null }
}

async function issueUrl(env, origin, method, key, { contentType, size } = {}, now) {
  const exp = Math.floor(now / 1000) + VIDEOLAGER_URL_SECONDS
  const headers = method === 'PUT' ? { 'content-type': contentType } : {}
  let url
  if (lagerMode(env) === 's3') {
    url = await presignS3Url({
      method, host: env.R2_S3_HOST || `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, path: `/${env.R2_BUCKET_NAME}/${key}`,
      accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      expiresSeconds: VIDEOLAGER_URL_SECONDS, now: new Date(now),
      headers: method === 'PUT' ? { ...headers, 'content-length': size } : {},
    })
  } else {
    const claims = method === 'PUT' ? { op: 'put', exp, ct: contentType, len: size } : { op: 'get', exp }
    url = await signBlobUrl(origin, key, claims, signingSecret(env))
  }
  return { url, method, headers, key, mode: lagerMode(env), expires_at: new Date(exp * 1000).toISOString() }
}

async function handleUploadUrl(request, env, ctx) {
  const body = await request.json().catch(() => null)
  const size = Number(body?.size)
  const max = lagerMode(env) === 's3' ? VIDEOLAGER_S3_MAX_BYTES : VIDEOLAGER_WORKER_MAX_BYTES
  if (!body || !videoUploadMimeAllowed(body.mime_type)) return ctx.json(400, { error: 'Videoformatet understøttes ikke' })
  if (!Number.isInteger(size) || size <= 0) return ctx.json(400, { error: 'Videoens størrelse mangler' })
  if (size > max) return ctx.json(413, { error: `Videoen er større end ${Math.round(max / 1048576)} MB`, max_bytes: max })
  const user = await supabaseJson('/auth/v1/user', ctx.token, env, ctx.fetchFn)
  if (!user?.id) return ctx.json(401, { error: 'Log ind igen' })
  const athletes = await supabaseJson(`/rest/v1/athletes?select=id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, ctx.token, env, ctx.fetchFn)
  const athleteId = Array.isArray(athletes) ? athletes[0]?.id : null
  const key = buildVideoUploadPath(athleteId, body.client_analysis_id, body.mime_type)
  if (!key) return ctx.json(403, { error: 'Kun atleter kan sende video' })
  // Samme regel som i dag (upsert: false): et klip overskrives aldrig.
  if (await env.VIDEO.head(key)) return ctx.json(200, { exists: true, key })
  return ctx.json(200, await issueUrl(env, ctx.origin, 'PUT', key, { contentType: body.mime_type, size }, ctx.now))
}

async function handleDownloadUrl(request, env, ctx) {
  const body = await request.json().catch(() => null)
  const key = typeof body?.video_path === 'string' ? body.video_path : ''
  if (!KEY_PATTERN.test(key)) return ctx.json(400, { error: 'Ugyldig videosti' })
  // RLS afgør det: kun den, der må se rækken, får en adresse.
  const rows = await supabaseJson(`/rest/v1/video_analyses?select=id&video_path=eq.${encodeURIComponent(key)}&limit=1`, ctx.token, env, ctx.fetchFn)
  if (rows === null) return ctx.json(401, { error: 'Log ind igen' })
  if (!rows.length) return ctx.json(404, { error: 'Videoen findes ikke' })
  // Ældre klip ligger i Supabase: appen spørger der, når lageret ikke har klippet.
  if (!(await env.VIDEO.head(key))) return ctx.json(404, { error: 'Videoen ligger ikke i videolageret', not_in_lager: true })
  return ctx.json(200, await issueUrl(env, ctx.origin, 'GET', key, {}, ctx.now))
}

async function handleBlob(request, env, ctx) {
  const claims = await verifyBlobUrl(request.url, signingSecret(env), Math.floor(ctx.now / 1000))
  if (!claims || !KEY_PATTERN.test(claims.key)) return ctx.json(403, { error: 'Adressen er ugyldig eller udløbet' })
  if (request.method === 'PUT' && claims.op === 'put') {
    if (request.headers.get('content-type') !== claims.ct) return ctx.json(400, { error: 'Forkert content-type' })
    if (request.headers.get('content-length') !== String(claims.len)) return ctx.json(400, { error: 'Forkert størrelse' })
    if (await env.VIDEO.head(claims.key)) return ctx.json(409, { error: 'Videoen findes allerede' })
    await env.VIDEO.put(claims.key, request.body, { httpMetadata: { contentType: claims.ct } })
    return ctx.json(200, { ok: true, key: claims.key })
  }
  if (request.method === 'GET' && claims.op === 'get') {
    const object = await env.VIDEO.get(claims.key, { range: request.headers })
    if (!object) return ctx.json(404, { error: 'Videoen findes ikke' })
    const headers = new Headers({ ...ctx.cors, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=600',
      'content-type': object.httpMetadata?.contentType || 'application/octet-stream' })
    const range = object.range
    const partial = request.headers.has('range') && range && Number.isFinite(range.offset)
    const length = partial ? (range.length ?? object.size - range.offset) : object.size
    headers.set('content-length', String(length))
    if (partial) headers.set('content-range', `bytes ${range.offset}-${range.offset + length - 1}/${object.size}`)
    return new Response(object.body, { status: partial ? 206 : 200, headers })
  }
  return ctx.json(405, { error: 'Metoden passer ikke til adressen' })
}

export async function handleVideolager(request, env, { fetchFn = fetch, now = Date.now() } = {}) {
  const url = new URL(request.url)
  const cors = corsHeaders(request, env)
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
  const ctx = { json, cors, fetchFn, now, origin: url.origin, token: null }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (url.pathname === '/sundhed' && request.method === 'GET') return json(200, { ok: true, mode: lagerMode(env) })
    if (url.pathname.startsWith('/blob/')) return await handleBlob(request, env, ctx)
    if (request.method === 'POST' && (url.pathname === '/upload-url' || url.pathname === '/download-url')) {
      const auth = request.headers.get('authorization') || ''
      if (!auth.startsWith('Bearer ') || auth.length < 20) return json(401, { error: 'Log ind igen' })
      ctx.token = auth.slice('Bearer '.length)
      return url.pathname === '/upload-url' ? await handleUploadUrl(request, env, ctx) : await handleDownloadUrl(request, env, ctx)
    }
    return json(404, { error: 'Ukendt adresse' })
  } catch {
    return json(500, { error: 'Videolageret svarede ikke' })
  }
}

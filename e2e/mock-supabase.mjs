// ORDRE 153 · commit 1 — lokal erstatning for Supabase til e2e-provet.
// -----------------------------------------------------------------------------
// Ingen atlet-data, ingen produktions-Supabase, intet netværk uden for denne
// maskine. Taler de SAMME REST-former som @supabase/supabase-js rent faktisk
// sender (læst i node_modules/@supabase/postgrest-js og .../auth-js's kilde
// før dette blev skrevet — se docs/E2E.md), så appen kan pege direkte på
// mocken via .env.e2e uden en eneste kodeændring i src/.
//
// Dækker: PostgREST-formen for GET/POST/PATCH/DELETE på /rest/v1/<tabel>
// (select med simpelt indlejret embed, eq/neq/lt/lte/gt/gte/in/is/or-filtre,
// order, limit), /rest/v1/rpc/<navn>, og GoTrue-formen for
// /auth/v1/token (password + refresh_token), /auth/v1/logout, /auth/v1/user.
//
// ORDRE 155: storage er nu et ægte in-memory objektlager (upload → signeret
// URL → hentning med Range-støtte), så "upload og gå" + coachens signerede
// afspilning kan proves med rigtige bytes, ikke kun en kvittering. Plus
// fejlinjektion (/__e2e/fault) og en rigtig get_my_shared_video_analyses_v3.
//
// ÆRLIG GRÆNSE: dette er IKKE en generel PostgREST-klon. Filtre/operatorer
// er dem appen rent faktisk bruger (grep'et i src/ før dette blev skrevet).
// RLS, storage-politikker og ægte Postgres-typer/constraints simuleres ikke —
// se docs/E2E.md.

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

// Tabel -> { embedNavn: { type: 'children'|'parent', table, fk } }
//   children: fremmedtabellens `fk`-kolonne peger PÅ denne række (én-til-mange)
//   parent:   DENNE rækkes `fk`-kolonne peger på fremmedtabellens id (mange-til-én)
// Kolonner den ægte Postgres-tabel sætter via `DEFAULT now()` og klienten
// derfor ALDRIG sender selv ved insert (grep'et i src/ før dette blev
// skrevet — se fx AthleteView.jsx's logSet(), der aldrig sætter logged_at).
// Uden denne default insertede rækker med `undefined`, og fx Dashboard.jsx's
// fetchAthleteLastLogs crashede på `.slice()` af et undefined felt — samme
// slags stille fejl ordre 153 findes for at fange, blot her i mocken selv.
const TIMESTAMP_DEFAULTS = {
  exercise_logs: ['logged_at'],
  // personal_records: AthleteView.jsx's fetchPRs sorterer på `created_at`,
  // men dashboard/AnalyseTab.jsx's PR-tidslinje sorterer samme tabel på
  // `logged_at` — ingen af de to sættes af klienten ved insert (se savePR()
  // i AthleteView.jsx). Uafklaret om det er samme kolonne under to navne i
  // den ægte DB eller et reelt navne-mismatch (se docs/E2E.md); mocken
  // sætter begge, så ingen af de to læsesider crasher.
  personal_records: ['created_at', 'logged_at'],
  messages: ['created_at'],
  readiness_logs: ['created_at'],
  video_analyses: ['created_at'],
}

// ORDRE 209 · commit 3: src/volume/rettelser.js prøver ved kørsel om
// exercise_muscle_overrides findes (ét HEAD-opslag, `select(.., {head:true,
// count:'exact'})`), og falder stille tilbage til localStorage hvis ikke.
// Uden dette ville mocken (som ellers selvopretter enhver tabel som tom —
// se `ensure()`) altid lade tabellen "findes", og localStorage-stien ville
// aldrig blive provet i e2e. Opt-in via env, IKKE en spec-fil, så ingen
// eksisterende spec ændres: `E2E_HIDE_TABLES=exercise_muscle_overrides npm
// run e2e` kører migrations-før-tilstanden; uden variablen (standard, alle
// nuværende specs) opfører tabellen sig som enhver anden — findes, tom.
const HIDDEN_TABLES = new Set(
  (process.env.E2E_HIDE_TABLES || '').split(',').map(t => t.trim()).filter(Boolean)
)

// 400, bevidst ikke 404: Node/undicis fetch fjerner altid response-body på
// et HEAD-svar (afprøvet direkte før dette blev skrevet), så
// postgrest-js's "404 + tomt body" tolkes som success (se dens
// processResponse) — en fejlstatus uden for det carve-out er nødvendig for
// at HEAD-opslaget rent faktisk rapporterer en fejl.
function sendTabelFindesIkke(res, table) {
  sendJson(res, 400, { code: '42P01', message: `relation "public.${table}" does not exist`, details: null, hint: null })
}

const EMBEDS = {
  weeks: {
    sessions: { type: 'children', table: 'sessions', fk: 'week_id' },
  },
  sessions: {
    exercises: { type: 'children', table: 'exercises', fk: 'session_id' },
    weeks: { type: 'parent', table: 'weeks', fk: 'week_id' },
  },
  exercises: {
    sessions: { type: 'parent', table: 'sessions', fk: 'session_id' },
  },
  exercise_logs: {
    exercises: { type: 'parent', table: 'exercises', fk: 'exercise_id' },
  },
}

function splitTopLevel(str) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' }
    else cur += ch
  }
  if (cur) parts.push(cur)
  return parts.map(s => s.trim()).filter(Boolean)
}

function parseSelect(selectStr) {
  return splitTopLevel(selectStr).map(tok => {
    const m = tok.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/s)
    if (m) return { embed: m[1], sub: m[2] || '*' }
    return { col: tok }
  })
}

function coerce(val) {
  if (val === 'null') return null
  if (val === 'true') return true
  if (val === 'false') return false
  return val
}

function matchOne(row, col, op, rawVal) {
  const val = coerce(rawVal)
  const cell = row[col]
  switch (op) {
    case 'eq': return String(cell) === String(val)
    case 'neq': return String(cell) !== String(val)
    case 'lt': return cell != null && cell < (isNaN(val) ? val : Number(val))
    case 'lte': return cell != null && cell <= (isNaN(val) ? val : Number(val))
    case 'gt': return cell != null && cell > (isNaN(val) ? val : Number(val))
    case 'gte': return cell != null && cell >= (isNaN(val) ? val : Number(val))
    case 'is': return val === null ? (cell === null || cell === undefined) : cell === val
    case 'in': {
      const list = String(rawVal).replace(/^\(/, '').replace(/\)$/, '').split(',').map(s => s.trim())
      return list.includes(String(cell))
    }
    case 'like':
    case 'ilike': {
      const pattern = String(val).replace(/%/g, '.*')
      const re = new RegExp(`^${pattern}$`, op === 'ilike' ? 'i' : '')
      return re.test(String(cell ?? ''))
    }
    default: return true
  }
}

function evalCondition(row, cond) {
  const [col, op, ...rest] = cond.split('.')
  return matchOne(row, col, op, rest.join('.'))
}

function applyFilters(rows, searchParams) {
  let result = rows
  for (const [key, raw] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue
    if (key === 'or') {
      const inner = raw.replace(/^\(/, '').replace(/\)$/, '')
      const conds = splitTopLevel(inner)
      result = result.filter(r => conds.some(c => evalCondition(r, c)))
      continue
    }
    const [op, ...rest] = raw.split('.')
    const val = rest.join('.')
    result = result.filter(r => matchOne(r, key, op, val))
  }
  return result
}

function applyOrder(rows, orderParam) {
  if (!orderParam) return rows
  const specs = orderParam.split(',').map(s => {
    const [col, ...mods] = s.split('.')
    return { col, desc: mods.includes('desc') }
  })
  return [...rows].sort((a, b) => {
    for (const { col, desc } of specs) {
      const av = a[col]
      const bv = b[col]
      if (av === bv) continue
      const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : 1
      return desc ? -cmp : cmp
    }
    return 0
  })
}

export function createMockSupabase({ users, tables }) {
  const db = {}
  for (const [table, rows] of Object.entries(tables || {})) {
    db[table] = rows.map(r => ({ ...r }))
  }
  const ensure = t => { if (!db[t]) db[t] = []; return db[t] }

  // e2e-brugere: email -> { id, email, password, role }. Password sammenlignes
  // i klartekst — kun til denne lokale mock, aldrig en ægte auth-server.
  const usersByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]))
  const usersById = new Map(users.map(u => [u.id, u]))
  const tokensToUser = new Map() // access_token -> userId

  // In-memory objektlager: "<bucket>/<path>" -> { buffer, contentType }. Ægte
  // bytes (ikke bare en kvittering), så coachens signerede hentning (ordre
  // 155 · commit 2) rent faktisk kan spille den samme video af.
  const storageObjects = new Map()
  const signTokens = new Map() // token -> "<bucket>/<path>"

  // ORDRE 155 · commit 3: fejlinjektion pr. kald. Sat via
  // POST /__e2e/fault { pathPrefix, method, mode: '500'|'timeout', times }.
  // 'timeout' er bevidst en øjeblikkelig forbindelsesafbrydelse, ikke et
  // ægte 12s-hæng op til appens egen fetchWithTimeout-grænse — samme
  // brugeroplevede udfald (fetch afvises), uden at gøre e2e-suiten langsom.
  // Se docs/E2E.md.
  const faultQueue = []
  function takeFault(method, pathname) {
    const idx = faultQueue.findIndex(f => f.method === method && pathname.startsWith(f.pathPrefix))
    if (idx === -1) return null
    const fault = faultQueue[idx]
    fault.remaining -= 1
    if (fault.remaining <= 0) faultQueue.splice(idx, 1)
    return fault
  }

  function fakeUser(u) {
    const now = new Date().toISOString()
    return {
      id: u.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: u.email,
      email_confirmed_at: now,
      phone: '',
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: now,
      updated_at: now,
    }
  }

  function issueSession(u) {
    const accessToken = `e2e-access-${randomUUID()}`
    const refreshToken = `e2e-refresh-${randomUUID()}`
    tokensToUser.set(accessToken, u.id)
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      // 24t — langt ud over testens levetid, så autoRefreshToken aldrig
      // rammer under et enkelt spec-løb (se supabase.js's REFRESH_MARGIN_MS).
      expires_in: 86400,
      token_type: 'bearer',
      user: fakeUser(u),
    }
  }

  function project(table, row, selectStr) {
    if (!selectStr || selectStr === '*') return { ...row }
    const tokens = parseSelect(selectStr)
    const out = {}
    let includeAll = false
    for (const tok of tokens) {
      if (tok.col === '*') { includeAll = true; continue }
      if (tok.col) { out[tok.col] = row[tok.col]; continue }
      const rel = EMBEDS[table]?.[tok.embed]
      if (!rel) { out[tok.embed] = rel === undefined ? null : out[tok.embed]; continue }
      if (rel.type === 'children') {
        const rows = (db[rel.table] || []).filter(r => r[rel.fk] === row.id)
        out[tok.embed] = rows.map(r => project(rel.table, r, tok.sub))
      } else {
        const parent = (db[rel.table] || []).find(r => r.id === row[rel.fk])
        out[tok.embed] = parent ? project(rel.table, parent, tok.sub) : null
      }
    }
    return includeAll ? { ...row, ...out } : out
  }

  function withCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
  }

  async function readJson(req) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }

  function wantsRepresentation(req) {
    return (req.headers['prefer'] || '').includes('return=representation')
  }
  function wantsSingleObject(req) {
    return (req.headers['accept'] || '') === 'application/vnd.pgrst.object+json'
  }

  async function handleAuth(req, res, url) {
    if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type')
      const body = await readJson(req) || {}
      if (grant === 'password') {
        const u = usersByEmail.get(String(body.email || '').toLowerCase())
        if (!u || u.password !== body.password) {
          return sendJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
        }
        return sendJson(res, 200, issueSession(u))
      }
      if (grant === 'refresh_token') {
        const userId = [...tokensToUser.values()].find(id => usersById.has(id))
        const u = usersById.get(userId)
        if (!u) return sendJson(res, 400, { error: 'invalid_grant', msg: 'Invalid refresh token' })
        return sendJson(res, 200, issueSession(u))
      }
      return sendJson(res, 400, { error: 'unsupported_grant_type', msg: `Ukendt grant_type: ${grant}` })
    }
    if (req.method === 'POST' && url.pathname === '/auth/v1/logout') {
      const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
      tokensToUser.delete(jwt)
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
      const userId = tokensToUser.get(jwt)
      const u = usersById.get(userId)
      if (!u) return sendJson(res, 401, { error: 'unauthorized', msg: 'Ingen session' })
      return sendJson(res, 200, fakeUser(u))
    }
    sendJson(res, 404, { error: 'not-found' })
  }

  async function handleRest(req, res, url) {
    const table = decodeURIComponent(url.pathname.replace('/rest/v1/', ''))
    if (HIDDEN_TABLES.has(table)) return sendTabelFindesIkke(res, table)
    const rows = ensure(table)
    const selectStr = url.searchParams.get('select')

    // HEAD (ordre 209 · commit 3): kun brugt til "findes tabellen"-opslag i
    // dag (rettelser.js). Ingen body — kun status + Content-Range, som
    // postgrest-js læser for `count` (se dens processResponse).
    if (req.method === 'HEAD') {
      const result = applyFilters(rows, url.searchParams)
      res.writeHead(200, { 'Content-Range': `*/${result.length}` })
      res.end()
      return
    }

    if (req.method === 'GET') {
      let result = applyFilters(rows, url.searchParams)
      result = applyOrder(result, url.searchParams.get('order'))
      const limit = url.searchParams.get('limit')
      if (limit) result = result.slice(0, Number(limit))
      const projected = result.map(r => project(table, r, selectStr))
      if (wantsSingleObject(req)) {
        return sendJson(res, 200, projected[0] ?? null)
      }
      return sendJson(res, 200, projected)
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const incoming = Array.isArray(body) ? body : [body]
      const onConflict = url.searchParams.get('on_conflict')
      const prefer = req.headers['prefer'] || ''
      const ignoreDuplicates = prefer.includes('resolution=ignore-duplicates')
      const created = []
      for (const item of incoming) {
        if (onConflict) {
          const existing = rows.find(r => r[onConflict] === item[onConflict])
          if (existing) {
            if (ignoreDuplicates) { created.push(existing); continue }
            Object.assign(existing, item)
            created.push(existing)
            continue
          }
        }
        const row = { id: randomUUID(), created_at: new Date().toISOString(), ...item }
        for (const col of TIMESTAMP_DEFAULTS[table] || []) {
          if (row[col] == null) row[col] = new Date().toISOString()
        }
        rows.push(row)
        created.push(row)
      }
      if (!wantsRepresentation(req)) { res.writeHead(201); res.end(); return }
      const projected = created.map(r => project(table, r, selectStr))
      return sendJson(res, 201, wantsSingleObject(req) ? (projected[0] ?? null) : projected)
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req) || {}
      const matched = applyFilters(rows, url.searchParams)
      for (const row of matched) Object.assign(row, body)
      if (!wantsRepresentation(req)) { res.writeHead(204); res.end(); return }
      const projected = matched.map(r => project(table, r, selectStr))
      return sendJson(res, 200, wantsSingleObject(req) ? (projected[0] ?? null) : projected)
    }

    if (req.method === 'DELETE') {
      const matched = applyFilters(rows, url.searchParams)
      const matchedIds = new Set(matched.map(r => r.id))
      db[table] = rows.filter(r => !matchedIds.has(r.id))
      // Content-Range altid sat (ordre 209 · commit 3): postgrest-js læser
      // den for `count` ved `.delete({count:'exact'})` (fjernRettelse i
      // rettelser.js), uafhængigt af return=representation. Harmløst for
      // alle andre kald, som ikke beder om count.
      if (!wantsRepresentation(req)) {
        res.writeHead(204, { 'Content-Range': `*/${matched.length}` })
        res.end()
        return
      }
      const projected = matched.map(r => project(table, r, selectStr))
      res.setHeader('Content-Range', `*/${matched.length}`)
      return sendJson(res, 200, wantsSingleObject(req) ? (projected[0] ?? null) : projected)
    }

    sendJson(res, 405, { error: 'method-not-allowed' })
  }

  // Kendte RPC'er brugt af athlete-/coach-flowet. Alt andet får et neutralt,
  // tomt svar i stedet for en fejl — appens skærme skal ikke vælte på en RPC
  // der ligger uden for denne mocks bevidst afgrænsede omfang (se docs/E2E.md).
  const rpcHandlers = {
    get_my_shared_video_analyses_v3: (args, ctx) => {
      const athlete = db.athletes?.find(a => a.user_id === ctx.userId)
      if (!athlete) return []
      const limit = Number(args?.p_limit ?? 6)
      const offset = Number(args?.p_offset ?? 0)
      const shared = (db.video_analyses || [])
        .filter(v => v.athlete_id === athlete.id && v.status === 'shared')
        .sort((a, b) => String(b.analyzed_at || '').localeCompare(String(a.analyzed_at || '')))
      return shared.slice(offset, offset + limit)
    },
    entropi_training_signals_v1: () => [],
    complete_athlete_onboarding_v1: (args, ctx) => {
      const athlete = db.athletes?.find(a => a.user_id === ctx.userId)
      if (athlete) athlete.onboarding_completed_at = new Date().toISOString()
      return null
    },
  }

  async function handleRpc(req, res, url) {
    const name = decodeURIComponent(url.pathname.replace('/rest/v1/rpc/', ''))
    const args = await readJson(req) || {}
    const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
    const ctx = { userId: tokensToUser.get(jwt) }
    const handler = rpcHandlers[name]
    const data = handler ? handler(args, ctx) : []
    return sendJson(res, 200, data)
  }

  // Minimal multipart/form-data-parser: storage-js sender en Blob-fil som ét
  // FormData-felt med tomt feltnavn (`body.append('', fileBody)`, se
  // node_modules/@supabase/storage-js's StorageFileApi.uploadOrUpdate) — kun
  // det denne mock reelt modtager skal kunne parses, ikke enhver multipart-form.
  function parseMultipart(buffer, contentType) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
    const boundary = m && (m[1] || m[2])
    if (!boundary) return []
    const marker = Buffer.from(`--${boundary}`)
    const parts = []
    let start = buffer.indexOf(marker)
    while (start !== -1) {
      const next = buffer.indexOf(marker, start + marker.length)
      if (next === -1) break
      parts.push(buffer.slice(start + marker.length, next))
      start = next
    }
    return parts.map(part => {
      if (part.slice(0, 2).toString('latin1') === '\r\n') part = part.slice(2)
      const headerEnd = part.indexOf('\r\n\r\n')
      if (headerEnd === -1) return null
      const headerStr = part.slice(0, headerEnd).toString('utf8')
      let body = part.slice(headerEnd + 4)
      if (body.slice(-2).toString('latin1') === '\r\n') body = body.slice(0, -2)
      const filenameMatch = /filename="([^"]*)"/i.exec(headerStr)
      const ctMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerStr)
      return { filename: filenameMatch?.[1], contentType: ctMatch?.[1] || 'application/octet-stream', body }
    }).filter(Boolean)
  }

  async function handleStorage(req, res, url) {
    // /storage/v1/object/sign/<bucket>/<path> — createSignedUrl(): udsteder
    // et token og lader klienten selv bygge den fulde URL (this.url + data.signedURL).
    const signMatch = url.pathname.match(/^\/storage\/v1\/object\/sign\/(.+)$/)
    if (req.method === 'POST' && signMatch) {
      await readJson(req)
      const key = decodeURIComponent(signMatch[1])
      if (!storageObjects.has(key)) return sendJson(res, 400, { error: 'not_found', message: `Objekt findes ikke: ${key}` })
      const token = randomUUID()
      signTokens.set(token, key)
      return sendJson(res, 200, { signedURL: `/object/sign/${key}?token=${token}` })
    }
    // GET af selve videoen via den signerede URL (samme sti som ovenfor, uden
    // POST-prefixet /storage/v1 — signedURL er relativ til storage-roden).
    const getSignedMatch = url.pathname.match(/^\/storage\/v1\/object\/sign\/(.+)$/)
    if (req.method === 'GET' && getSignedMatch && url.searchParams.get('token')) {
      const token = url.searchParams.get('token')
      const key = signTokens.get(token)
      const obj = key && storageObjects.get(key)
      if (!obj) return sendJson(res, 404, { error: 'not_found' })
      const range = req.headers.range
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range)
        const start = m[1] ? Number(m[1]) : 0
        const end = m[2] ? Number(m[2]) : obj.buffer.length - 1
        res.writeHead(206, {
          'Content-Type': obj.contentType, 'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${obj.buffer.length}`, 'Accept-Ranges': 'bytes',
        })
        res.end(obj.buffer.slice(start, end + 1))
        return
      }
      res.writeHead(200, { 'Content-Type': obj.contentType, 'Content-Length': obj.buffer.length, 'Accept-Ranges': 'bytes' })
      res.end(obj.buffer)
      return
    }
    // POST/PUT /storage/v1/object/<bucket>/<path> — selve uploaden.
    const objectMatch = url.pathname.match(/^\/storage\/v1\/object\/(.+)$/)
    if ((req.method === 'POST' || req.method === 'PUT') && objectMatch) {
      const key = decodeURIComponent(objectMatch[1])
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const raw = Buffer.concat(chunks)
      const upsert = req.headers['x-upsert'] === 'true'
      if (storageObjects.has(key) && !upsert) {
        return sendJson(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
      }
      const parts = parseMultipart(raw, req.headers['content-type'])
      const filePart = parts.find(p => p.filename) || parts[parts.length - 1]
      const buffer = filePart ? filePart.body : raw
      const contentType = filePart?.contentType || req.headers['content-type'] || 'application/octet-stream'
      storageObjects.set(key, { buffer, contentType })
      return sendJson(res, 200, { id: randomUUID(), path: key, fullPath: `${key}` })
    }
    sendJson(res, 404, { error: 'not-found' })
  }

  const server = createServer(async (req, res) => {
    withCors(res)
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const url = new URL(req.url, 'http://localhost')
    try {
      if (url.pathname === '/__e2e/table') {
        const t = url.searchParams.get('name')
        return sendJson(res, 200, ensure(t))
      }
      if (url.pathname === '/__e2e/storage-keys') {
        return sendJson(res, 200, [...storageObjects.keys()])
      }
      if (url.pathname === '/__e2e/fault' && req.method === 'POST') {
        const body = await readJson(req) || {}
        faultQueue.push({
          pathPrefix: body.pathPrefix, method: body.method || 'POST',
          mode: body.mode || '500', remaining: Number(body.times ?? 1),
        })
        return sendJson(res, 200, { ok: true })
      }
      if (url.pathname === '/__e2e/fault' && req.method === 'DELETE') {
        faultQueue.length = 0
        return sendJson(res, 200, { ok: true })
      }
      // Anvendes på ALT (auth/rest/rpc/storage) — en fejlinjektion skal kunne
      // ramme ethvert kald, ikke kun REST-tabeller (ordre 155 · commit 3).
      const fault = takeFault(req.method, url.pathname)
      if (fault) {
        if (fault.mode === 'timeout') { req.socket.destroy(); return }
        return sendJson(res, 500, { message: 'Synthetic e2e-fejl (injiceret)', code: 'E2E_FAULT' })
      }
      if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url)
      if (url.pathname.startsWith('/rest/v1/rpc/')) return await handleRpc(req, res, url)
      if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url)
      if (url.pathname.startsWith('/storage/v1/object')) return await handleStorage(req, res, url)
      sendJson(res, 404, { error: 'not-found', path: url.pathname })
    } catch (err) {
      sendJson(res, 500, { error: String(err?.message || err) })
    }
  })

  return {
    server,
    listen(port) {
      return new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
    },
    close() {
      return new Promise(resolve => server.close(resolve))
    },
    // Introspektion til assertions i specs — læser direkte i mockens
    // in-memory-tabeller, som ordren beder om ("Assertions mod mockens
    // tabeller"), i stedet for at gætte ud fra DOM-tekst.
    table(name) { return ensure(name) },
  }
}

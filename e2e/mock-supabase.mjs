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
// Storage er en minimal stub (uploades til en temp-mappe) — ingen af e2e-
// specsne sender en rigtig video igennem, jf. ordrens grænser.
//
// ÆRLIG GRÆNSE: dette er IKKE en generel PostgREST-klon. Filtre/operatorer
// er dem appen rent faktisk bruger (grep'et i src/ før dette blev skrevet).
// RLS, storage-politikker og ægte Postgres-typer/constraints simuleres ikke —
// se docs/E2E.md.

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

  const uploadDir = mkdtempSync(join(tmpdir(), 'entropi-e2e-storage-'))

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
    const rows = ensure(table)
    const selectStr = url.searchParams.get('select')

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
      if (!wantsRepresentation(req)) { res.writeHead(204); res.end(); return }
      const projected = matched.map(r => project(table, r, selectStr))
      return sendJson(res, 200, wantsSingleObject(req) ? (projected[0] ?? null) : projected)
    }

    sendJson(res, 405, { error: 'method-not-allowed' })
  }

  // Kendte RPC'er brugt af athlete-/coach-flowet. Alt andet får et neutralt,
  // tomt svar i stedet for en fejl — appens skærme skal ikke vælte på en RPC
  // der ligger uden for denne mocks bevidst afgrænsede omfang (se docs/E2E.md).
  const rpcHandlers = {
    get_my_shared_video_analyses_v3: () => [],
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

  async function handleStorage(req, res, url) {
    // Minimal stub: gemmer uploadede bytes i en temp-mappe. Ingen af e2e-
    // specsne sender en rigtig video igennem (jf. ordrens grænser), så dette
    // rammes ikke af de nuværende specs, men skal ikke crashe hvis det gør.
    if (req.method === 'POST' || req.method === 'PUT') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const path = join(uploadDir, randomUUID())
      writeFileSync(path, Buffer.concat(chunks))
      return sendJson(res, 200, { Key: url.pathname.replace('/storage/v1/object/', '') })
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

// Generalprøve (ordre 80): en lille PostgREST over PGlite, så appens egne kald rammer ægte
// Postgres med RLS, kolonnerettigheder og triggere, som de er i produktionen.
// Kun den del af PostgREST, som appen og edge-funktionen u8-push bruger mod de nye tabeller:
// GET/HEAD/POST/PATCH/DELETE på /rest/v1/<tabel>, select med kolonnenavne, filtrene eq, neq, gt,
// gte, lt, lte, in og is, order, limit, offset, Prefer return/count/resolution og on_conflict.
// Som PostgREST: hver forespørgsel er én transaktion med rollen fra tokenet (anon, authenticated
// eller service_role) og request.jwt.claims sat; INSERT/UPDATE/DELETE har altid RETURNING, så
// SELECT-reglerne gælder også for skrivninger; upsert sætter alle sendte kolonner; en tabel, der
// ikke findes, giver 404 PGRST205. Kun syntetiske data; intet net ud af maskinen.
import { createServer } from 'node:http'

const NAME = /^[a-z_][a-z0-9_]*$/
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
const ident = name => { if (!NAME.test(name)) throw Object.assign(Error(`ugyldigt navn ${name}`), { status: 400, code: 'PGRST100' }); return `"${name}"` }

// Værdierne i in.(...) som PostgREST: komma-separeret, med valgfri anførselstegn.
function inList(raw) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '')
  const out = []
  const re = /\s*(?:"((?:[^"\\]|\\.)*)"|([^,]*))\s*(?:,|$)/g
  let m
  while ((m = re.exec(inner)) && m[0] !== '') { out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]); if (re.lastIndex >= inner.length) break }
  return out
}

function where(params, args) {
  const parts = []
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue
    const col = ident(key)
    const dot = value.indexOf('.')
    const op = value.slice(0, dot), val = value.slice(dot + 1)
    if (OPS[op]) { args.push(val); parts.push(`${col} ${OPS[op]} $${args.length}`) }
    else if (op === 'in') { args.push(inList(val)); parts.push(`${col}::text = any($${args.length}::text[])`) }
    else if (op === 'is' && ['null', 'true', 'false'].includes(val)) parts.push(`${col} is ${val}`)
    else throw Object.assign(Error(`filter ${op} er ikke med i generalprøvens PostgREST`), { status: 400, code: 'PGRST100' })
  }
  return parts.length ? ` where ${parts.join(' and ')}` : ''
}

const columns = select => !select || select === '*' ? '*' : select.split(',').map(s => s.trim()).filter(Boolean).map(ident).join(', ')
function orderBy(order) {
  if (!order) return ''
  return ' order by ' + order.split(',').map(term => {
    const [col, ...mods] = term.split('.')
    return [ident(col), ...mods.map(m => ({ asc: 'asc', desc: 'desc', nullsfirst: 'nulls first', nullslast: 'nulls last' })[m] ?? '')].join(' ')
  }).join(', ')
}

// Postgres-fejl til PostgREST-svar (samme statuskoder som PostgREST 12).
function httpStatus(error, role) {
  const code = error.code
  if (code === '42501') return role === 'anon' ? 401 : 403
  if (code === '23505' || code === '23503') return 409
  if (code === '42P01' || code === 'PGRST205') return 404
  if (/^(22|23)/.test(code ?? '') || code === '42703' || code === 'P0001') return 400
  return error.status ?? 500
}

export function createPgRest({ db, tokenToClaims }) {
  let queue = Promise.resolve()
  const serial = fn => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run }
  // DDL undervejs (migration og tilbagerulning) går gennem samme kø, så ingen forespørgsel ser en halv tilstand.
  const exec = sql => serial(() => db.exec(sql))
  const log = []

  async function handle({ method, table, params, body, headers }) {
    const prefer = String(headers.prefer ?? '')
    const claims = tokenToClaims(String(headers.authorization ?? '').replace(/^Bearer\s+/i, '')) ?? { role: 'anon' }
    const role = ['authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon'
    return serial(async () => {
      const exists = (await db.query('select to_regclass($1) is not null as ok', [`public.${table}`])).rows[0].ok
      if (!NAME.test(table) || !exists) return { status: 404, body: { code: 'PGRST205', details: null, hint: null, message: `Could not find the table 'public.${table}' in the schema cache` } }
      const args = []
      const filter = where(params, args)
      const select = params.get('select')
      const representation = /return=representation/.test(prefer)
      let sql, countSql
      const t = `public.${ident(table)}`
      if (method === 'GET' || method === 'HEAD') {
        sql = `select ${columns(select)} from ${t}${filter}${orderBy(params.get('order'))}` +
          (params.get('limit') ? ` limit ${Number(params.get('limit'))}` : '') + (params.get('offset') ? ` offset ${Number(params.get('offset'))}` : '')
        if (/count=exact/.test(prefer)) countSql = `select count(*)::int as n from ${t}${filter}`
      } else if (method === 'POST') {
        const rows = Array.isArray(body) ? body : [body]
        const cols = params.get('columns') ? params.get('columns').split(',') : Object.keys(rows[0] ?? {})
        args.push(JSON.stringify(rows))
        const list = cols.map(ident).join(', ')
        sql = `insert into ${t} (${list}) select ${list} from json_populate_recordset(null::${t}, $${args.length})`
        const merge = /resolution=merge-duplicates/.test(prefer), ignore = /resolution=ignore-duplicates/.test(prefer)
        if (merge || ignore) {
          const target = params.get('on_conflict') ? params.get('on_conflict').split(',').map(ident).join(', ') : null
          sql += ` on conflict${target ? ` (${target})` : ''} ` + (ignore ? 'do nothing' : `do update set ${cols.map(c => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`)
        }
        sql += representation ? ` returning ${columns(select)}` : ' returning 1'
      } else if (method === 'PATCH') {
        const cols = Object.keys(body ?? {})
        args.push(JSON.stringify(body ?? {}))
        const n = args.length
        sql = `update ${t} set ${cols.map(c => `${ident(c)} = (json_populate_record(null::${t}, $${n})).${ident(c)}`).join(', ')}${filter}` +
          (representation ? ` returning ${columns(select)}` : ' returning 1')
      } else if (method === 'DELETE') {
        sql = `delete from ${t}${filter}` + (representation ? ` returning ${columns(select)}` : ' returning 1')
      } else return { status: 405, body: { message: 'metode' } }
      await db.exec('begin')
      try {
        await db.query(`select set_config('request.jwt.claims', $2, true),
          set_config('request.jwt.claim.sub', $3, true), set_config('request.jwt.claim.role', $1, true)`,
        [role, JSON.stringify(claims), claims.sub ?? ''])
        await db.exec(`set local role ${role}`)
        // Som PostgREST: svaret bygges af Postgres selv med json_agg (datoer som "2026-11-11" osv.).
        const wrapped = method === 'GET' || method === 'HEAD'
          ? `select coalesce(json_agg(pgrst_t), '[]')::text as body from (${sql}) pgrst_t`
          : `with pgrst_source as (${sql}) select coalesce(json_agg(pgrst_t), '[]')::text as body from pgrst_source pgrst_t`
        const result = { rows: JSON.parse((await db.query(wrapped, args)).rows[0].body) }
        const count = countSql ? (await db.query(countSql, args)).rows[0].n : null
        await db.exec('commit')
        log.push({ method, table, role, sub: claims.sub ?? null, rows: result.rows.length })
        const range = `${result.rows.length ? `0-${result.rows.length - 1}` : '*'}/${count ?? '*'}`
        if (method === 'GET' || method === 'HEAD') {
          if (/vnd\.pgrst\.object/.test(String(headers.accept ?? ''))) {
            if (result.rows.length !== 1) return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${result.rows.length} rows`, hint: null } }
            return { status: 200, body: result.rows[0], headers: { 'Content-Range': range } }
          }
          return { status: 200, body: method === 'HEAD' ? undefined : result.rows, headers: { 'Content-Range': range } }
        }
        if (!representation) return { status: method === 'POST' ? 201 : 204, headers: { 'Content-Range': range } }
        return { status: method === 'POST' ? 201 : 200, body: result.rows, headers: { 'Content-Range': range } }
      } catch (error) {
        await db.exec('rollback').catch(() => {})
        log.push({ method, table, role, sub: claims.sub ?? null, error: error.code })
        return { status: httpStatus(error, role), body: { code: error.code ?? 'PGRST000', details: error.detail ?? null, hint: error.hint ?? null, message: error.message } }
      }
    })
  }

  async function handleHttp(req, res, url) {
    const table = decodeURIComponent(url.pathname.replace(/^\/rest\/v1\//, ''))
    let body
    if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const text = Buffer.concat(chunks).toString('utf8')
      body = text ? JSON.parse(text) : undefined
    }
    let answer
    try { answer = await handle({ method: req.method, table, params: url.searchParams, body, headers: req.headers }) }
    catch (error) { answer = { status: error.status ?? 500, body: { code: error.code ?? 'PGRST000', message: error.message } } }
    res.writeHead(answer.status, { 'Content-Type': 'application/json; charset=utf-8', ...(answer.headers ?? {}) })
    res.end(answer.body === undefined ? undefined : JSON.stringify(answer.body))
  }

  return { handle, handleHttp, exec, log, serial }
}

// En selvstændig server (til prøver i Node): /rest/v1/* til PGlite, alt andet 404.
export function listenPgRest(rest, port) {
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname.startsWith('/rest/v1/')) return rest.handleHttp(req, res, url)
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'not found' }))
  })
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r) }),
  })))
}

// Syntetisk PostgREST-agtig klient til U7-prøverne. Kun det, U7 bruger: select, eq, in, gte,
// lte, order, limit, update(...).select, insert. tables uden navn findes ikke (42P01 som i
// e2e-mocken). Nøgler: tracking_daily_v1 (athlete_id, logged_date) giver 23505 ved dublet.
export function fakeBackend({ tables = {}, missing = [] } = {}) {
  const db = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, rows.map(r => ({ ...r }))]))
  const calls = []
  let clock = 0
  const client = {
    from(table) {
      const q = { table, filters: [], op: 'select', payload: null, limitN: null, orders: [] }
      const run = async () => {
        calls.push({ table, op: q.op, payload: q.payload, filters: q.filters.map(f => f.slice(0, 2).join(':')) })
        if (missing.includes(table)) return { data: null, error: { code: '42P01', message: `relation "public.${table}" does not exist` } }
        const rows = db[table] ?? (db[table] = [])
        const match = r => q.filters.every(([kind, col, v]) => kind === 'eq' ? r[col] === v : kind === 'in' ? v.includes(r[col])
          : kind === 'gte' ? r[col] >= v : kind === 'lte' ? r[col] <= v : true)
        if (q.op === 'insert') {
          const list = Array.isArray(q.payload) ? q.payload : [q.payload]
          for (const row of list) {
            if (table === 'tracking_daily_v1' && rows.some(r => r.athlete_id === row.athlete_id && r.logged_date === row.logged_date))
              return { data: null, error: { code: '23505', message: 'duplicate key' } }
            rows.push({ ...row, ...(table === 'nutrition_targets_v1' ? { id: `t${++clock}`, created_at: `2026-11-11T00:00:${String(clock).padStart(2, '0')}Z` } : {}) })
          }
          return { data: null, error: null }
        }
        if (q.op === 'update') {
          const hit = rows.filter(match)
          for (const r of hit) Object.assign(r, q.payload)
          return { data: hit.map(r => ({ athlete_id: r.athlete_id })), error: null }
        }
        let out = rows.filter(match)
        for (const [col, asc] of q.orders.slice().reverse()) out = out.slice().sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1))
        if (q.limitN != null) out = out.slice(0, q.limitN)
        return { data: out.map(r => ({ ...r })), error: null }
      }
      const b = {
        select: () => b, eq: (c, v) => (q.filters.push(['eq', c, v]), b), in: (c, v) => (q.filters.push(['in', c, v]), b),
        gte: (c, v) => (q.filters.push(['gte', c, v]), b), lte: (c, v) => (q.filters.push(['lte', c, v]), b),
        order: (c, o = {}) => (q.orders.push([c, o.ascending !== false]), b), limit: n => (q.limitN = n, b),
        not: () => b,
        update: payload => (q.op = 'update', q.payload = payload, b),
        insert: payload => (q.op = 'insert', q.payload = payload, b),
        then: (resolve, reject) => run().then(resolve, reject),
      }
      return b
    },
  }
  return { client, db, calls, writes: () => calls.filter(c => c.op !== 'select') }
}

export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() { return map.size },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: k => { map.delete(k) },
    dump: () => Object.fromEntries(map),
  }
}

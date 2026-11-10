// Kun til prøver. En lille falsk Supabase-klient over syntetiske tabeller. Den
// returnerer kun de kolonner, select beder om, og tæller alle kald.
function columns(select) {
  const out = []
  let depth = 0, current = ''
  for (const ch of String(select)) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(current.trim()); current = '' } else current += ch
  }
  if (current.trim()) out.push(current.trim())
  return out.map(c => c.split('(')[0].trim())
}

export function fakeU3Client(tables = {}, { fail = new Set(), delay = null } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      const call = { table, select: null, filters: [], args: [], limit: null, range: null }
      calls.push(call)
      const builder = {
        select(cols) { call.select = cols; return builder },
        eq(col, value) { call.filters.push(r => r[col] === value); return builder },
        neq(col, value) { call.filters.push(r => r[col] !== value); return builder },
        gte(col, value) { call.filters.push(r => r[col] >= value); return builder },
        gt(col, value) { call.filters.push(r => r[col] > value); return builder },
        lte(col, value) { call.filters.push(r => r[col] <= value); return builder },
        lt(col, value) { call.filters.push(r => r[col] < value); return builder },
        in(col, values) { call.args.push(['in', col, values]); call.filters.push(r => values.includes(r[col])); return builder },
        not(col, op, value) { call.filters.push(r => op === 'is' && value === null ? r[col] != null : true); return builder },
        order() { return builder },
        limit(n) { call.limit = n; return builder },
        range(from, to) { call.range = [from, to]; return builder },
        then(resolve, reject) {
          const run = () => {
            if (fail.has(table)) return { data: null, error: { message: 'syntetisk fejl' } }
            const keep = columns(call.select ?? '*')
            let rows = (tables[table] ?? []).filter(r => call.filters.every(f => f(r)))
            if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
            if (call.limit !== null) rows = rows.slice(0, call.limit)
            const data = keep.includes('*') ? rows.map(r => ({ ...r }))
              : rows.map(r => Object.fromEntries(keep.filter(k => Object.hasOwn(r, k)).map(k => [k, r[k]])))
            return { data, error: null }
          }
          const promise = delay ? delay(call).then(run) : Promise.resolve(run())
          return promise.then(resolve, reject)
        },
      }
      return builder
    },
  }
  return client
}

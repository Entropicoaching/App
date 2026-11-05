import assert from 'node:assert/strict'

export const tableNames = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']
export function syntheticTables(options = {}) {
  const data = Object.fromEntries(tableNames.map(name => [name, []])), calls = []
  let sequence = 0, lost = options.lost
  const id = () => `20000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
  const client = { from(table) {
    assert.ok(tableNames.includes(table), `Only namespace access: ${table}`)
    const filters = [], call = { table, action: 'select', limit: Infinity, filters }
    calls.push(call)
    const q = {
      select(columns) { call.columns = columns; return q },
      limit(n) { call.limit = n; return q },
      eq(key, value) { filters.push([key, 'eq', value]); return q },
      lte(key, value) { filters.push([key, 'lte', value]); return q },
      in(key, value) { filters.push([key, 'in', value]); return q },
      insert(payload) { call.action = 'insert'; call.payload = structuredClone(payload); return q },
      then(resolve, reject) {
        return Promise.resolve().then(async () => {
          await options.before?.(call)
          if (options.missing === table || options.missing === true) return { data: null, error: { code: options.missingCode ?? 'PGRST205' } }
          if (options.error) return { data: null, error: { code: options.error } }
          if (call.action === 'insert') {
            const payload = call.payload
            if (table === tableNames[2]) assert.deepEqual(Object.keys(payload).sort(), ['approval_kind', 'version_id'])
            if (table === tableNames[0]) assert.deepEqual(Object.keys(payload).sort(), ['athlete_id', 'id', 'valid_from'])
            if (table === tableNames[1]) assert.deepEqual(Object.keys(payload).sort(), ['basis_as_of', 'calculation_basis', 'effective_from', 'goal', 'id', 'intensity', 'meals', 'plan_id', 'rationale', 'version_no'])
            if (table === tableNames[1]) {
              assert.equal(payload.rationale, 'Coachen har gennemgået og aktiveret den lokale dagsplan.')
              assert.doesNotMatch(payload.rationale, /\u00c3/)
            }
            let row = structuredClone(payload)
            if (table === tableNames[0]) row.status = 'forslag'
            if (table === tableNames[2]) {
              const version = data[tableNames[1]].find(v => v.id === payload.version_id)
              const plan = data[tableNames[0]].find(p => p.id === version?.plan_id)
              assert.ok(plan && version.meals.length)
              assert.equal(data[table].some(a => a.version_id === version.id), false)
              row = { ...row, id: id(), athlete_id: plan.athlete_id, plan_id: plan.id,
                approved_at: new Date(Date.UTC(2026, 10, 5, 12, 0, ++sequence)).toISOString() }
              plan.status = 'godkendt'
            }
            data[table].push(row)
            if (lost === table) { lost = null; throw Error('Synthetic lost response after commit') }
            return options.response?.(call, [structuredClone(row)]) ?? { data: [structuredClone(row)], error: null }
          }
          let found = data[table].filter(row => filters.every(([key, op, value]) => op === 'eq' ? row[key] === value : op === 'lte' ? row[key] <= value : value.includes(row[key])))
          found = structuredClone(found.slice(0, call.limit))
          return options.response?.(call, found) ?? { data: found, error: null }
        }).then(resolve, reject)
      },
    }
    return q
  } }
  return { client, data, calls, options, writes: () => calls.filter(c => c.action === 'insert') }
}
export const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve() }

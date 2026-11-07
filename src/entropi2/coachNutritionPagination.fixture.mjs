import assert from 'node:assert/strict'

// Synthetic server projection: filters and all order terms precede range and
// the server Max rows cap. No business logic, network or unselected columns.
export function nutritionDatabase(rows = [], options = {}) {
  const calls = [], goals = options.goals ?? [
    { id: 'synthetic-day-athlete', kcal_target: 2400, protein_target: 160 },
    { id: 'synthetic-other-athlete', kcal_target: 2000, protein_target: 120 },
  ]
  const client = { from(table) {
    assert.ok(['meal_logs', 'athletes'].includes(table))
    const call = { table, filters: [], orders: [] }; calls.push(call)
    const q = {
      select(columns) { call.columns = columns.split(',').map(key => key.trim()); return q },
      in(key, values) { call.filters.push([key, 'in', [...values]]); return q },
      gte(key, value) { call.filters.push([key, 'gte', value]); return q },
      lte(key, value) { call.filters.push([key, 'lte', value]); return q },
      order(key, { ascending = true } = {}) { call.orders.push([key, ascending]); return q },
      limit(cap) { call.cap = cap; return q },
      range(from, through) { call.range = [from, through]; return q },
      then(resolve, reject) {
        return Promise.resolve().then(async () => {
          await options.before?.(call)
          if (options.throwTable === table) throw Error('Synthetic transport failure')
          if (options.errorTable === table) return { error: { code: '42501' }, data: null }
          if (options.malformedTable === table) return { error: null, data: null }
          const selected = (table === 'meal_logs' ? rows : goals).filter(row => call.filters.every(([key, op, value]) =>
            op === 'in' ? value.includes(row[key]) : op === 'gte' ? row[key] >= value : row[key] <= value))
            .sort((a, b) => {
              for (const [key, ascending] of call.orders) {
                const diff = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0
                if (diff) return ascending ? diff : -diff
              }
              return 0
            })
          const [from, through] = call.range ?? [0, (call.cap ?? Infinity) - 1]
          const cap = Math.min(options.serverCap ?? Infinity, call.cap ?? Infinity, through - from + 1)
          const data = selected.slice(from, from + cap).map(row => Object.fromEntries(call.columns.map(key => [key, row[key]])))
          return options.response ? options.response(call, data) : { error: null, data }
        }).then(resolve, reject)
      },
    }
    return q
  } }
  return { client, calls, goals }
}

export const nutritionMeal = (i, patch = {}) => ({ id: i + 1, athlete_id: 'synthetic-day-athlete',
  date: '2026-11-05', meal: 'Synthetic meal', kcal: 500, protein: 40, carb: 50, fat: 15, ...patch })

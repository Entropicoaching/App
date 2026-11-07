import assert from 'node:assert/strict'
import { syntheticTables, tableNames } from '../coach/activation.fixture.mjs'
import { createPlanSnapshot } from '../planSnapshot.mjs'

export const athleteId = 'synthetic-day-athlete', date = '2026-11-05'
export const flush = () => new Promise(resolve => setImmediate(resolve))
export function fixture(options = {}) {
  const plan = syntheticTables(options), rows = [], calls = [], values = new Map(), writes = []
  let sequence = 0
  const client = { from(table) {
    if (table !== 'meal_logs') return plan.client.from(table)
    const call = { table, action: 'select', filters: [] }; calls.push(call)
    const q = {
      select() { return q }, order() { return q },
      eq(key, value) { call.filters.push([key, 'eq', value]); return q },
      gte(key, value) { call.filters.push([key, 'gte', value]); return q },
      lte(key, value) { call.filters.push([key, 'lte', value]); return q },
      insert(value) { call.action = 'insert'; call.value = structuredClone(value); return q },
      update(value) { call.action = 'update'; call.value = structuredClone(value); return q },
      delete() { call.action = 'delete'; return q },
      then(resolve, reject) {
        return Promise.resolve().then(async () => {
          await options.beforeLog?.(call)
          if (options.logError) return { error: { code: 'synthetic-error' }, data: null }
          let found = rows.filter(row => call.filters.every(([key, op, value]) => op === 'eq' ? row[key] === value : op === 'gte' ? row[key] >= value : row[key] <= value))
          if (call.action === 'insert') {
            assert.equal(call.value.athlete_id, athleteId)
            const row = { ...call.value, id: `synthetic-diary-${++sequence}` }; rows.push(row); found = [row]
            if (options.lostInsert) throw Error('Synthetic lost insert response')
          }
          if (call.action === 'update') found.forEach(row => Object.assign(row, call.value))
          if (call.action === 'delete') for (const row of found) rows.splice(rows.indexOf(row), 1)
          return { data: structuredClone(found), error: null }
        }).then(resolve, reject)
      },
    }
    return q
  } }
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { writes.push(key); values.set(key, value) } }
  function approve() {
    const id = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
    const snapshot = createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
      { name: 'Frokost <syntetisk>', portions: [{ grams: 200, food: {
        id: 'synthetic-food', name: 'Syntetisk mad', source: { citation: 'synthetic fixture', verification: 'synthetic' },
        nutrientsPer100g: { energyKcal: 100, proteinG: 10, carbohydrateG: 12, fatG: 2 },
      } }] },
      { name: 'Aftensmad', portions: [{ grams: 300, food: {
        id: 'synthetic-food-2', name: 'Syntetisk mad 2', source: { citation: 'synthetic fixture', verification: 'synthetic' },
        nutrientsPer100g: { energyKcal: 100, proteinG: 10, carbohydrateG: 12, fatG: 2 },
      } }] },
    ] })
    plan.data[tableNames[0]].push({ id: id(1), athlete_id: athleteId, valid_from: date, status: 'godkendt' })
    plan.data[tableNames[1]].push({ id: id(2), plan_id: id(1), effective_from: date, version_no: 1, ...snapshot })
    plan.data[tableNames[2]].push({ athlete_id: athleteId, plan_id: id(1), version_id: id(2), approved_at: date + 'T12:00:00Z', approval_kind: 'coach' })
  }
  return { client, plan, rows, calls, storage, writes, values, approve }
}

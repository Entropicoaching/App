// Local draft contract only. No client, storage, permission cache or UI activation.
import { supportedFoodSnapshot } from '../kostplan/sqlSnapshot.mjs'
import { MICRONUTRIENTS, NUTRIENTS } from '../kostplan/foedevarer/catalog.mjs'
import { nutritionValues, calendarTime } from '../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'

export const INTAKE_EVIDENCE_VERSION = 1
export const INTAKE_LIMITS = Object.freeze({ grams: 100000, decimalPlaces: 6, foodBytes: 16384, rows: 1000 })
const macros = Object.freeze({ kcal: 'energyKcal', protein: 'proteinG', carb: 'carbohydrateG', fat: 'fatG' })
const micros = Object.values(MICRONUTRIENTS).map(v => v.nutrient)
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const exact = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const text = (v, max) => {
  if (typeof v !== 'string' || !v.trim()) return false
  const chars = Array.from(v)
  return chars.length <= max && chars.every(c => {
    const code = c.codePointAt(0)
    return code > 31 && (code < 127 || code > 159)
  })
}
const dateOK = v => calendarTime(v) !== null && v >= '1900-01-01' && v <= '9999-12-31'
const timestamp = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)
  && calendarTime(v.slice(0, 10)) !== null && Number.isFinite(Date.parse(v))
const fail = () => { throw new TypeError('Ugyldig indtagsreference v1') }
function foodSnapshot(input) {
  // Original product validator runs before normalization can discard unknown keys.
  const food = supportedFoodSnapshot(input)
  if (!text(food.id, 128) || !text(food.name, 256) || !text(food.preparation, 256)
    || !text(food.source.citation, 2048) || !text(food.source.verification, 256)
    || new TextEncoder().encode(JSON.stringify(food)).length > INTAKE_LIMITS.foodBytes) fail()
  if (Object.values(macros).some(k => food.nutrientsPer100g[k] === null)) fail()
  return food
}
function captured(food, grams) {
  const values = nutritionValues(Object.fromEntries(Object.entries(macros).map(([k, n]) => [k, food.nutrientsPer100g[n]])), grams / 100)
  if (!values || Object.values(values).some(v => !Number.isSafeInteger(v) || v > 2147483647)) fail()
  return values
}

// Keep requestId unchanged across an uncertain response. A new intentional log
// needs a new UUID. Food/source strings are user-reported reference provenance.
export function createIntakeEvidenceRequest(input) {
  if (!exact(input, ['athleteId', 'date', 'requestId', 'grams', 'meal', 'food'])
    || !uuid(input.athleteId) || !uuid(input.requestId) || !dateOK(input.date)
    || !text(input.meal, 512) || isDayReceipt({ meal: input.meal.trimStart() })
    || typeof input.grams !== 'number' || !Number.isFinite(input.grams) || input.grams <= 0
    || input.grams > INTAKE_LIMITS.grams || Math.round(input.grams * 1e6) / 1e6 !== input.grams) fail()
  const food = foodSnapshot(input.food)
  captured(food, input.grams)
  return Object.freeze({ version: 1, requestId: input.requestId.toLowerCase(), athleteId: input.athleteId.toLowerCase(),
    date: input.date, grams: input.grams, meal: input.meal, food })
}

// Read with freshly fetched parent rows. This validates pairing, never authority.
// RLS/UID authorization belongs to SQL. Historical edits cannot be detected if
// an old parent response is supplied; callers must reload both in current scope.
export function readIntakeEvidence(parent, evidence, { athleteId, date } = {}) {
  try {
    if (!uuid(athleteId) || !dateOK(date) || !uuid(parent?.id)
      || parent.athlete_id !== athleteId || parent.date !== date || isDayReceipt({ meal: parent.meal?.trimStart?.() })) return null
    if (!exact(evidence, ['meal_log_id', 'request_id', 'athlete_id', 'date', 'version', 'food', 'grams', 'meal',
      'kcal', 'protein', 'carb', 'fat', 'created_at']) || evidence.version !== 1
      || evidence.meal_log_id !== parent.id || evidence.request_id !== parent.id
      || evidence.athlete_id !== athleteId || evidence.date !== date
      || !timestamp(evidence.created_at)
      || !exact(evidence.food, ['id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source'])
      || !exact(evidence.food.nutrientsPer100g, Object.keys(NUTRIENTS))) return null
    const request = createIntakeEvidenceRequest({ athleteId, date, requestId: evidence.request_id,
      grams: evidence.grams, meal: evidence.meal, food: evidence.food })
    const values = captured(request.food, request.grams)
    if (parent.meal !== request.meal || Object.keys(macros).some(k => parent[k] !== values[k] || evidence[k] !== values[k])) return null
    return Object.freeze({ version: 1, mealLogId: parent.id, requestId: request.requestId, athleteId, date,
      grams: request.grams, meal: request.meal, food: request.food,
      referenceKind: 'user-reported-reference',
      nutrients: Object.freeze(Object.fromEntries(micros.map(k => [k, request.food.nutrientsPer100g[k] === null
        ? null : request.food.nutrientsPer100g[k] * (request.grams / 100)]))) })
  } catch { return null }
}

// Completeness means every supplied current-day food row has a known reference
// for that nutrient, not dietary sufficiency or confirmation of a full day's log.
// Input arrays must be the caller's complete freshly fetched RLS-scoped results.
export function summarizeIntakeEvidence({ athleteId, date, mealLogs, evidenceRows } = {}) {
  if (!uuid(athleteId) || !dateOK(date) || !Array.isArray(mealLogs) || !Array.isArray(evidenceRows)
    || mealLogs.length > INTAKE_LIMITS.rows || evidenceRows.length > INTAKE_LIMITS.rows) fail()
  const logs = mealLogs.filter(r => r?.athlete_id === athleteId && r.date === date && !isDayReceipt({ meal: r.meal?.trimStart?.() }))
  const scopedEvidence = evidenceRows.filter(e => e?.athlete_id === athleteId && e.date === date)
  const entries = logs.map(row => {
    const found = scopedEvidence.filter(e => e.meal_log_id === row.id)
    return logs.filter(r => r.id === row.id).length === 1 && found.length === 1
      ? readIntakeEvidence(row, found[0], { athleteId, date }) : null
  })
  return Object.freeze({ athleteId, date, recordedRows: logs.length, referenceKind: 'user-reported-reference',
    nutrients: Object.freeze(Object.fromEntries(micros.map(k => {
      const values = entries.map(e => e?.nutrients[k] ?? null), known = values.filter(v => v !== null)
      const complete = logs.length > 0 && known.length === logs.length
      const subtotal = known.length ? known.reduce((a, b) => a + b, 0) : null
      return [k, Object.freeze({ unit: NUTRIENTS[k].unit, state: !logs.length ? 'no-recorded-food' : complete ? 'complete' : 'incomplete',
        complete, knownRows: known.length, unknownRows: logs.length - known.length, knownSubtotal: subtotal, total: complete ? subtotal : null })]
    }))) })
}

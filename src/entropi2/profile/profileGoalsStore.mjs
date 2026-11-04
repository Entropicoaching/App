import { athleteGoals, goalFields, goalWeight, goalDate } from './profileGoalsModel.mjs'

const schema = 'entropi2-profile-goals/v1'
const validId = value => typeof value === 'string' && value.trim().length > 0
export function ownGoalScope(scope) {
  return scope?.enabled === true && validId(scope.ownerId) && validId(scope.athleteId) && scope.athleteUserId === scope.ownerId
}
export function goalStorageKey(scope) {
  if (!ownGoalScope(scope)) throw Error('scope')
  return `entropi2:profile:goals:v1:${encodeURIComponent(scope.ownerId)}:${encodeURIComponent(scope.athleteId)}`
}

function checkedFields(fields) {
  if (!fields || Array.isArray(fields) || typeof fields !== 'object' ||
      Object.keys(fields).some(key => !goalFields.includes(key))) throw Error('local format')
  const result = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'goal') {
      // A full local snapshot may retain the coach's existing free text.
      if (value !== null && (typeof value !== 'string' || !value.trim() || value !== value.trim())) throw Error('local goal')
    } else if (key === 'competition_date') {
      if (goalDate(value) === undefined || value !== goalDate(value)) throw Error('local date')
    } else if (goalWeight(value) === undefined || value !== goalWeight(value)) throw Error('local weight')
    result[key] = value
  }
  return result
}

// Public read adapter for future nutrition/forecast consumers. Call on demand
// with an explicit current owner and athlete; OFF never touches data/storage.
export function readProfileGoals(options = {}) {
  if (options.enabled !== true) return null
  const { scope, athlete, storage, isCurrent = () => true } = options
  if (!ownGoalScope(scope) || athlete?.id !== scope.athleteId || athlete?.user_id !== scope.ownerId) return null
  const values = athleteGoals(athlete)
  if (!isCurrent()) throw Error('scope changed')
  const store = storage?.()
  if (!isCurrent()) throw Error('scope changed')
  if (!store || typeof store.getItem !== 'function') throw Error('local unavailable')
  const raw = store.getItem(goalStorageKey(scope)) ?? null
  if (!isCurrent()) throw Error('scope changed')
  let local = {}
  if (raw != null) {
    const record = JSON.parse(raw)
    if (record?.schema !== schema) throw Error('local schema')
    local = checkedFields(record.fields)
  }
  return { values: { ...values, ...local }, local, raw }
}

export function writeProfileGoals(scope, fields, storage, options = {}) {
  const key = goalStorageKey(scope), checked = checkedFields(fields)
  const isCurrent = options.isCurrent ?? (() => true)
  if (!isCurrent()) throw Error('scope changed')
  const store = storage?.()
  if (!isCurrent()) throw Error('scope changed')
  if (!store || typeof store.setItem !== 'function' || typeof store.getItem !== 'function') throw Error('local unavailable')
  if (Object.hasOwn(options, 'expectedRaw') && (store.getItem(key) ?? null) !== options.expectedRaw) throw Error('local changed')
  if (!isCurrent()) throw Error('scope changed')
  const raw = JSON.stringify({ schema, fields: checked })
  store.setItem(key, raw)
  return raw
}

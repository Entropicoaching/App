// Local-only draft contract. Importing this module never reads or writes storage.
export const COMMENT_LIMIT = 2000
export const FIELDS = ['sleep', 'energy', 'stress', 'pain', 'comment']
const ranges = { sleep: [0, 24, 0.5], energy: [1, 5, 1], stress: [1, 5, 1], pain: [0, 10, 1] }

export function emptyDraft() {
  return { sleep: '', energy: '', stress: '', pain: '', comment: '' }
}

export function draftKey(athleteId, weekStart) {
  if (typeof athleteId !== 'string' || !athleteId.trim() || athleteId.length > 128 ||
      typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null
  const date = new Date(`${weekStart}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== weekStart ||
      date.getUTCDay() !== 1) return null
  try {
    return `entropi2:checkin:v1:${encodeURIComponent(athleteId)}:${weekStart}`
  } catch {
    return null
  }
}

function isDraftKey(key) {
  if (typeof key !== 'string') return false
  const match = /^entropi2:checkin:v1:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(key)
  try {
    return !!match && draftKey(decodeURIComponent(match[1]), match[2]) === key
  } catch {
    return false
  }
}

export function validDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) ||
      typeof draft.comment !== 'string' || draft.comment.length > COMMENT_LIMIT) return false
  return Object.entries(ranges).every(([name, [min, max, step]]) => {
    const value = draft[name]
    if (value === '') return true
    if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return false
    const number = Number(value)
    return Number.isFinite(number) && number >= min && number <= max && Number.isInteger(number / step)
  })
}

// The getter is deliberately inside each try/catch: accessing localStorage itself
// can throw. Tests provide an in-memory storage object; no browser is needed.
const storageFor = supplied => supplied === undefined ? globalThis.localStorage : supplied

export function loadDraft(key, supplied) {
  if (!isDraftKey(key)) return { draft: emptyDraft(), status: 'unavailable' }
  try {
    const raw = storageFor(supplied).getItem(key)
    if (raw === null) return { draft: emptyDraft(), status: 'empty' }
    if (typeof raw !== 'string' || raw.length > 20000) throw new Error('Invalid draft')
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !validDraft(value.draft)) throw new Error('Invalid draft')
    return { draft: Object.fromEntries(FIELDS.map(field => [field, value.draft[field]])), status: 'saved' }
  } catch {
    return { draft: emptyDraft(), status: 'unavailable' }
  }
}

export function saveDraft(key, draft, supplied) {
  if (!isDraftKey(key) || !validDraft(draft)) return false
  try {
    const clean = Object.fromEntries(FIELDS.map(field => [field, draft[field]]))
    storageFor(supplied).setItem(key, JSON.stringify({ version: 1, draft: clean }))
    return true
  } catch {
    return false
  }
}

export function clearDraft(key, supplied) {
  if (!isDraftKey(key)) return false
  try {
    storageFor(supplied).removeItem(key)
    return true
  } catch {
    return false
  }
}

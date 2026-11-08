import { calendarDay } from '../../../calendarDate.js'
import { calendarTime } from '../../../athlete/kostNumbers.mjs'

// Technical record bounds, not a recommendation or a daily water target.
export const waterLimits = Object.freeze({ entries: 100, ml: 10000, text: 16000, actor: 128 })
const schema = 'entropi2-water-day/v1'
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const actorValid = value => typeof value === 'string' && value.length > 0 && value.length <= waterLimits.actor
  && value === value.trim() && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
export const waterQuantity = value => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value)
  if (!/^\d{1,5}$/.test(text)) return null
  const ml = Number(text)
  return Number.isInteger(ml) && ml > 0 && ml <= waterLimits.ml ? ml : null
}
export function waterDayKey(athleteId, date) {
  if (!actorValid(athleteId) || calendarTime(date) === null) return null
  try { return `entropi2:water-intake:v1:${encodeURIComponent(athleteId)}:${date}` } catch { return null }
}
function decode(raw, athleteId, date) {
  if (raw === null) return []
  if (typeof raw !== 'string' || raw.length > waterLimits.text) throw Error('record')
  const value = JSON.parse(raw)
  if (!exact(value, ['schema', 'athleteId', 'date', 'entries']) || value.schema !== schema
    || value.athleteId !== athleteId || value.date !== date || !Array.isArray(value.entries)
    || value.entries.length > waterLimits.entries) throw Error('record')
  const ids = new Set()
  return value.entries.map(entry => {
    if (!exact(entry, ['id', 'ml', 'at']) || !Number.isSafeInteger(entry.id) || entry.id < 1 || ids.has(entry.id)
      || typeof entry.ml !== 'number' || waterQuantity(entry.ml) === null
      || typeof entry.at !== 'string' || entry.at.length !== 24
      || !Number.isFinite(Date.parse(entry.at)) || new Date(entry.at).toISOString() !== entry.at
      || calendarDay(entry.at) !== date) throw Error('entry')
    ids.add(entry.id)
    return Object.freeze({ ...entry })
  })
}

// Owns only one new exact key. Opening never writes, scans, migrates or deletes.
// All writes are synchronous explicit actions; disposed/stale callbacks are inert.
export function createWaterDayLog({ enabled, athleteId, date, storage, currentDay, isCurrent = () => true } = {}) {
  const key = waterDayKey(athleteId, date)
  if (enabled !== true || !key) return null
  let disposed = false, entries = [], status = 'ready', raw = null, writable = true, device, pendingUpdate = null
  const current = () => {
    try { return !disposed && isCurrent() === true && calendarDay() === date
      && (currentDay === undefined || (typeof currentDay === 'function' && currentDay() === date)) } catch { return false }
  }
  if (!current()) return null
  try {
    device = storage === undefined ? globalThis.localStorage : storage
    if (!device || typeof device.getItem !== 'function' || typeof device.setItem !== 'function') throw Error('storage')
    raw = device.getItem(key)
    entries = decode(raw, athleteId, date)
  } catch {
    writable = false; status = 'unreadable'
  }
  const snapshot = () => Object.freeze({ entries: Object.freeze([...entries]), status,
    totalMl: entries.reduce((sum, entry) => sum + entry.ml, 0) })
  const persist = (next, editEntry = null) => {
    if (!current()) return false
    // Add/remove keep their legacy local fallback. An edit succeeds only after
    // readback; failed edits retain the exact original entries and draft owner.
    if (editEntry && !writable) return false
    let before
    if (editEntry) {
      try {
        before = device.getItem(key)
        if (!current()) return false
        // Retry only the original record or our exact prior attempted bytes,
        // bound to this entry AND transaction snapshot; never a loose id match.
        if (before !== raw && !(pendingUpdate?.entries === entries && pendingUpdate.entry === editEntry
          && before === pendingUpdate.value)) { status = 'conflict'; return false }
      } catch { status = 'unconfirmed'; return false }
    }
    if (!editEntry) entries = next
    status = 'unconfirmed'
    if (!writable) return true
    const value = JSON.stringify({ schema, athleteId, date, entries: next })
    if (value.length > waterLimits.text) {
      if (!editEntry) writable = false
      return !editEntry
    }
    try {
      if (!editEntry) before = device.getItem(key)
      if (!current()) return false
      if (!editEntry && before !== raw) { writable = false; return true }
      if (editEntry) pendingUpdate = { entries, entry: editEntry, value }
      device.setItem(key, value)
      if (!current()) return false
      const after = device.getItem(key)
      if (!current()) return false
      if (after !== value) {
        if (!editEntry) writable = false
        return !editEntry
      }
      entries = next; raw = value; status = 'saved'; pendingUpdate = null
    } catch {
      if (!editEntry) writable = false
      return !editEntry
    }
    return true
  }
  return Object.freeze({
    snapshot,
    isCurrent: current,
    add(value) {
      if (!current()) return false
      const ml = waterQuantity(value), id = Math.max(0, ...entries.map(entry => entry.id)) + 1
      if (ml === null || entries.length >= waterLimits.entries || !Number.isSafeInteger(id)) return false
      const at = new Date().toISOString()
      if (calendarDay(at) !== date) return false
      return persist([...entries, Object.freeze({ id, ml, at })])
    },
    remove(id) {
      if (!current() || !entries.some(entry => entry.id === id)) return false
      return persist(entries.filter(entry => entry.id !== id))
    },
    update(entry, value) {
      if (!current() || !entries.includes(entry)) return false
      const ml = waterQuantity(value)
      if (ml === null) return false
      return persist(entries.map(item => item === entry ? Object.freeze({ ...item, ml }) : item), entry)
    },
    dispose() { disposed = true },
  })
}

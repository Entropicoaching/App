import { dayNumber, inWindow, requireId, windowEnding } from './trackingDates.mjs'

// Defense in depth only. The database is the authorization boundary.
export function mayReadCycle({ viewerId, athlete, consents = [] }) {
  if (!viewerId || !athlete?.id || !athlete.user_id) return false
  if (viewerId === athlete.user_id) return true
  return viewerId === athlete.coach_id && Array.isArray(consents) && consents.some(consent =>
    consent?.athlete_id === athlete.id && consent.coach_id === viewerId && consent.sharing_enabled === true)
}

export function projectCycle({ viewerId, athlete, consents, rows = [], weekEnd }) {
  // Do not inspect rows, dates, counts or produce metadata on the denied path.
  if (!mayReadCycle({ viewerId, athlete, consents })) return null
  requireId(athlete.id)
  const window = windowEnding(weekEnd, 7)
  const entries = rows.filter(row => row?.athlete_id === athlete.id).filter(row => {
    dayNumber(row.logged_date)
    return inWindow(row.logged_date, window)
  }).map(row => {
    if (!['none', 'spotting', 'light', 'medium', 'heavy'].includes(row.bleeding)) throw new TypeError('Invalid bleeding')
    if (row.cycle_day != null && (!Number.isInteger(row.cycle_day) || row.cycle_day < 1 || row.cycle_day > 120)) throw new TypeError('Invalid cycle day')
    if (row.note != null && (typeof row.note !== 'string' || row.note.length > 1000)) throw new TypeError('Invalid note')
    return { logged_date: row.logged_date, bleeding: row.bleeding, cycle_day: row.cycle_day ?? null, note: row.note ?? null }
  }).sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  if (new Set(entries.map(row => row.logged_date)).size !== entries.length) throw new TypeError('Duplicate cycle date')
  return { window, entries } // No inferred phase, readiness, fertility or signals.
}

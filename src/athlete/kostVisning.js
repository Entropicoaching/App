import { calendarTime, parseInputNumber } from './kostNumbers.mjs'

export const KOST_I_DAG_FLAG = 'entropi:kost-i-dag'

// Opt-in for this browser only. Missing or inaccessible storage keeps the old view.
export function kostIDagEnabled(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(KOST_I_DAG_FLAG) === 'true'
  } catch {
    return false
  }
}

// Count distinct, dated observations, never rows or elapsed days. Invalid values
// make that day's total unknown. Future dates cannot unlock estimates.
export function kostDage(logs, asOfDate) {
  if (calendarTime(asOfDate) === null) return []
  const days = new Map()
  for (const log of logs || []) {
    if (calendarTime(log.date) === null || log.date > asOfDate) continue
    const kcal = parseInputNumber(log.kcal)
    const previous = days.get(log.date) ?? { date: log.date, kcal: 0 }
    const total = previous.kcal === null || kcal === null ? null : previous.kcal + kcal
    days.set(log.date, { date: log.date, kcal: Number.isFinite(total) ? total : null })
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function harKostGrundlag(logs, asOfDate) {
  return kostDage(logs, asOfDate).filter(day => day.kcal !== null).length >= 7
}

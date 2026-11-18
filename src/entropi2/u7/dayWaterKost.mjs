import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { formatNumber } from '../u3/format.mjs'

// Væske og kostvane de seneste 7 dage fra tracking_daily_v1-rækker. Ét regnestykke til både
// coachens dagslinje (coachData.dayNumbersLine) og atletens ugekort (u3/athleteWeekModel), så de to
// ikke kan regne forskelligt. Kun det der findes; ingen dage giver ingen dele.
export const DAILY_DAYS = 7

const dayOf = value => typeof value === 'string' ? calendarDay(value.slice(0, 10)) : null
export function within(rows, day, days) {
  // days dage tilbage fra i dag, i dag medregnet: 7 betyder i dag og de 6 dage før.
  const from = addCalendarDays(day, -(days - 1))
  return (Array.isArray(rows) ? rows : []).filter(r => { const d = dayOf(r?.logged_date); return d && d >= from && d <= day })
}

export function waterKostParts(rows, today) {
  const day = calendarDay(today)
  if (!day) return []
  const recent = within(rows, day, DAILY_DAYS)
  const water = recent.map(r => r?.water_ml).filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
  const kost = recent.filter(r => typeof r?.kost_done_at === 'string' && r.kost_done_at !== '').length
  const goal = recent.map(r => r?.water_goal_ml).find(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
  const parts = []
  if (water.length) parts.push(`Væske ${formatNumber(water.reduce((n, v) => n + v, 0) / water.length / 1000, 1)}${goal ? ` af ${formatNumber(goal / 1000, 1)} l` : ' l'} i snit (${water.length} ${water.length === 1 ? 'dag' : 'dage'})`)
  if (kost) parts.push(`Kostvane ${kost} af 7 dage`)
  return parts
}

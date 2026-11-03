import { calendarTime, parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { mealTemplateItems } from '../../athlete/kostSkabeloner.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'

const DAY = 86400000
const keys = ['kcal', 'protein']
// 324 decimal places cover every finite JS number, including Number.MIN_VALUE.
// BigInt sums and comparisons never round meals or apply a goal tolerance.
const PLACES = 324
const EXTRA = 10n ** 20n
function units(value) {
  if (parseInputNumber(value) === null) return null
  const [mantissa, exponent = '0'] = String(value).trim().replace(',', '.').toLowerCase().split('e')
  const [whole, fraction = ''] = mantissa.replace(/^\+/, '').split('.')
  const digits = (whole + fraction).replace(/^0+/, '')
  if (!digits) return 0n
  // Normalize trailing zeros before checking precision. More than 324 meaningful
  // fractional places are unknown rather than silently rounded or underflowed.
  const trimmed = digits.replace(/0+$/, '')
  const power = PLACES + Number(exponent) - fraction.length + digits.length - trimmed.length
  if (!Number.isSafeInteger(power) || power < 0 || power > PLACES + 309) return null
  return BigInt(trimmed) * 10n ** BigInt(power)
}

function average(sum, count) {
  if (!count || sum === null) return null
  // Divide as integers before conversion, so an overflowing weekly total can
  // still have a finite mean. Extra digits retain subnormal output precision.
  const value = Number(`${sum * EXTRA / BigInt(count)}e-${PLACES + 20}`)
  return Number.isFinite(value) ? value : null
}

/**
 * Four Monday/Sunday calendar weeks, oldest first, including the current week.
 * Inputs are snapshot.historyRows, snapshot.targets ({kcal, protein}), and its
 * ISO date. Only rows on/before date count; the current week is partial.
 * Logged days count distinct non-receipt dates, including invalid meal days.
 * A bad meal makes both averages and configured reached counts unknown for its
 * week. Missing/nonpositive goals give null counts; an empty known week has 0.
 * Means are Numbers (rounded only at output), goal comparisons are exact.
 * Invalid date returns []; no input is mutated, clock/read/write is not used.
 */
export function weeklyTrend(historyRows, targets, date) {
  const end = calendarTime(date)
  if (end === null) return []
  const monday = end - ((new Date(end).getUTCDay() + 6) % 7) * DAY
  const start = monday - 21 * DAY
  const iso = time => new Date(time).toISOString().slice(0, 10)
  const goals = Object.fromEntries(keys.map(key => {
    const value = units(targets?.[key])
    return [key, value !== null && value > 0n ? value : null]
  }))
  const weeks = Array.from({ length: 4 }, (_, i) => ({
    weekStart: iso(start + i * 7 * DAY),
    weekEnd: iso(start + (i * 7 + 6) * DAY),
    days: new Map(),
  }))
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    const time = calendarTime(row?.date)
    if (time === null || time < start || time > end || isDayReceipt(row)) continue
    const days = weeks[Math.floor((time - start) / (7 * DAY))].days
    let day = days.get(row.date)
    if (!day) { day = { kcal: 0n, protein: 0n }; days.set(row.date, day) }
    const meal = mealTemplateItems([row])?.[0]
    const values = keys.map(key => units(row[key]))
    if (!meal || isDayReceipt({ meal: meal.meal.trimStart() }) || values.includes(null)) {
      day.kcal = day.protein = null
    } else if (day.kcal !== null) {
      keys.forEach((key, i) => { day[key] += values[i] })
    }
  }
  return weeks.map(({ weekStart, weekEnd, days }) => {
    const entries = [...days.values()]
    const unknown = entries.some(day => day.kcal === null)
    return {
      weekStart, weekEnd, loggedDays: entries.length,
      averages: Object.fromEntries(keys.map(key => [key,
        average(unknown ? null : entries.reduce((sum, day) => sum + day[key], 0n), entries.length),
      ])),
      reached: Object.fromEntries(keys.map(key => [key,
        goals[key] === null || unknown ? null : entries.filter(day => day[key] >= goals[key]).length,
      ])),
    }
  })
}

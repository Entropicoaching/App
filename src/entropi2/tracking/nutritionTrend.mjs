import { calendarTime, parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { mealTemplateItems } from '../../athlete/kostSkabeloner.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'

const DAY = 86400000
const KEYS = ['kcal', 'protein']
const PLACES = 324

// Same exact decimal representation as nutrition/weeklyTrend.mjs. Never round
// individual meals or use a tolerance to decide whether a target was reached.
function units(value) {
  if (parseInputNumber(value) === null) return null
  const [mantissa, exponent = '0'] = String(value).trim().replace(',', '.').toLowerCase().split('e')
  const [whole, fraction = ''] = mantissa.replace(/^\+/, '').split('.')
  const digits = (whole + fraction).replace(/^0+/, '')
  if (!digits) return 0n
  const trimmed = digits.replace(/0+$/, '')
  const power = PLACES + Number(exponent) - fraction.length + digits.length - trimmed.length
  if (!Number.isSafeInteger(power) || power < 0 || power > PLACES + 309) return null
  return BigInt(trimmed) * 10n ** BigInt(power)
}

function value(sum, count = 1) {
  if (sum === null || !count) return null
  const number = Number(`${sum * 10n ** 20n / BigInt(count)}e-${PLACES + 20}`)
  return Number.isFinite(number) ? number : null
}

/**
 * Pure, unwired model for one athlete's already scoped meal_logs rows.
 * targets: { kcal_target, protein_target }; date: explicit ISO calendar day.
 * Four Monday/Sunday weeks include the partial current week, oldest first.
 * Daily entries contain logged dates only. Unknown meals invalidate that day;
 * receipts, invalid dates and future rows are excluded. Identical meals count.
 * Weekly targets cover logged days, not unlogged days; means use logged days.
 * The signal uses the last seven logged dates across ALL supplied history,
 * even before the four-week window. Seven known dates and a protein goal are
 * required. Strictly below 80% on at least four dates yields 'lavt protein'.
 * Missing goals, insufficient history or unknown recent meals give null signal.
 * Targets are a current-goal comparison, not reconstructed historical goals.
 * Numbers are converted only for output; overflow is null, never Infinity.
 * No I/O, implicit clock, mutation, identity filtering or goal prescription.
 */
export function nutritionTrend(historyRows, targets, date) {
  const end = calendarTime(date)
  if (end === null) return { days: [], weeks: [], recent: null, signal: null }
  const monday = end - ((new Date(end).getUTCDay() + 6) % 7) * DAY
  const start = monday - 21 * DAY
  const iso = time => new Date(time).toISOString().slice(0, 10)
  // The range must remain representable as four-digit ISO calendar dates.
  if (calendarTime(iso(start)) === null || calendarTime(iso(monday + 6 * DAY)) === null) {
    return { days: [], weeks: [], recent: null, signal: null }
  }
  const goals = Object.fromEntries(KEYS.map(key => {
    const goal = units(targets?.[`${key}_target`])
    return [key, goal !== null && goal > 0n ? goal : null]
  }))
  const grouped = new Map()
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    const time = calendarTime(row?.date)
    if (time === null || time > end || isDayReceipt(row)) continue
    let day = grouped.get(row.date)
    if (!day) {
      day = { date: row.date, meals: 0, kcal: 0n, protein: 0n }
      grouped.set(row.date, day)
    }
    day.meals++
    const meal = mealTemplateItems([row])?.[0]
    const amounts = KEYS.map(key => units(row[key]))
    if (!meal || isDayReceipt({ meal: meal.meal.trimStart() }) || amounts.includes(null)) {
      day.kcal = day.protein = null
    } else if (day.kcal !== null) {
      KEYS.forEach((key, i) => { day[key] += amounts[i] })
    }
  }
  const ordered = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date))
  const compare = (sum, goal) => sum === null || goal === null ? null : sum >= goal
  const days = ordered.filter(day => day.date >= iso(start)).map(day => ({
    date: day.date, meals: day.meals,
    totals: Object.fromEntries(KEYS.map(key => [key, value(day[key])])),
    targets: Object.fromEntries(KEYS.map(key => [key, value(goals[key])])),
    reached: Object.fromEntries(KEYS.map(key => [key, compare(day[key], goals[key])])),
    belowProtein80: day.protein === null || goals.protein === null ? null
      : day.protein * 5n < goals.protein * 4n,
  }))
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const weekStart = iso(start + i * 7 * DAY), weekEnd = iso(start + (i * 7 + 6) * DAY)
    const entries = ordered.filter(day => day.date >= weekStart && day.date <= weekEnd)
    const sums = Object.fromEntries(KEYS.map(key => [key, entries.some(day => day[key] === null)
      ? null : entries.reduce((sum, day) => sum + day[key], 0n)]))
    const reached = goals.protein === null || sums.protein === null ? null
      : entries.filter(day => day.protein >= goals.protein).length
    return {
      weekStart, weekEnd, loggedDays: entries.length,
      totals: Object.fromEntries(KEYS.map(key => [key, entries.length ? value(sums[key]) : null])),
      averages: Object.fromEntries(KEYS.map(key => [key, value(sums[key], entries.length)])),
      targets: Object.fromEntries(KEYS.map(key => [key, goals[key] === null || !entries.length
        ? null : value(goals[key] * BigInt(entries.length))])),
      proteinReachedDays: reached,
      proteinReachedShare: reached === null || !entries.length ? null : reached / entries.length,
    }
  })
  const last = ordered.slice(-7)
  const known = goals.protein !== null && last.every(day => day.protein !== null)
  const belowDays = known ? last.filter(day => day.protein * 5n < goals.protein * 4n).length : null
  const sufficient = last.length === 7 && known
  return { days, weeks,
    recent: { dates: last.map(day => day.date), loggedDays: last.length, belowProtein80Days: belowDays },
    signal: sufficient && belowDays >= 4 ? 'lavt protein' : null,
  }
}

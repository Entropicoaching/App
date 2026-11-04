// Date-only values stay calendar dates in the browser's zone; "today" is Danish.
export function calendarToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]))
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00')
  return Number.isFinite(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10))
}

export function createWeekDate(weeks) {
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number)
  // A malformed stored date must not silently roll into another month.
  if (sorted.some(w => w.start_date && !validDay(w.start_date))) return null
  const anchor = sorted.find(w => w.start_date)
  if (!anchor) return null
  return no => {
    const week = sorted.find(w => w.week_number === no)
    const date = new Date((week?.start_date || anchor.start_date) + 'T12:00:00')
    if (!week?.start_date) date.setDate(date.getDate() + (no - anchor.week_number) * 7)
    return date
  }
}

const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
const mondayOf = date => {
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}
const shiftWeeks = (date, count) => {
  const result = new Date(date)
  result.setDate(result.getDate() + count * 7)
  return result
}

// Local date labels survive DST; the bounded window always includes this week.
export function createTimelineScale(placed, today0, COL_W) {
  const todayMon = mondayOf(today0)
  let minMon = todayMon, maxMon = todayMon
  for (const r of placed) for (const w of r.wks) {
    const date = r.weekDate(w.week_number)
    if (!Number.isFinite(date.getTime())) continue
    const monday = mondayOf(date)
    if (monday < minMon) minMon = monday
    if (monday > maxMon) maxMon = monday
  }
  minMon = shiftWeeks(minMon, -1)
  maxMon = shiftWeeks(maxMon, 1)
  const nCols = Math.min((dayNumber(maxMon) - dayNumber(minMon)) / 7 + 1, 60)
  if (nCols === 60) {
    const centered = shiftWeeks(todayMon, -29)
    const lastStart = shiftWeeks(maxMon, -59)
    minMon = new Date(Math.max(minMon.getTime(), Math.min(centered.getTime(), lastStart.getTime())))
  }
  const colOf = date => (dayNumber(mondayOf(date)) - dayNumber(minMon)) / 7
  const todayCol = colOf(today0)
  const todayLeft = (todayCol + (((today0.getDay() + 6) % 7) + 0.5) / 7) * COL_W
  const trackW = nCols * COL_W
  const cols = Array.from({ length: nCols }, (_, i) => shiftWeeks(minMon, i))
  return { nCols, colOf, todayCol, todayLeft, trackW, cols }
}

// Callback refs may reattach on hover/edit. Focus once per mounted track/layout/day.
const focusedTracks = new WeakMap()
export function focusTimelineToday(node, todayLeft, day) {
  if (!node || node.clientWidth <= 0) return
  const key = `${day}:${todayLeft}:${node.clientWidth}`
  if (focusedTracks.get(node) === key) return
  node.scrollLeft = Math.max(0, Math.min(todayLeft - node.clientWidth / 2, node.scrollWidth - node.clientWidth))
  focusedTracks.set(node, key)
}

export function createWeekDate(weeks) {
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number)
  const anchor = sorted.find(w => w.start_date)
  if (!anchor) return null
  return no => {
    const week = sorted.find(w => w.week_number === no)
    const date = new Date((week?.start_date || anchor.start_date) + 'T12:00:00')
    if (!week?.start_date) date.setDate(date.getDate() + (no - anchor.week_number) * 7)
    return date
  }
}

// Kolonneskalaen bruger lokale kalenderdage ved begge tidsskift.
export function createTimelineScale(placed, today0, COL_W) {
  const dayMs = 86400000
  const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
  let minMon = mondayOf(today0), maxMon = mondayOf(today0)
  for (const r of placed) for (const w of r.wks) {
    const m = mondayOf(r.weekDate(w.week_number))
    if (m < minMon) minMon = m
    if (m > maxMon) maxMon = m
  }
  minMon = new Date(minMon); minMon.setDate(minMon.getDate() - 7)
  maxMon = new Date(maxMon); maxMon.setDate(maxMon.getDate() + 7)
  const nCols = Math.min(Math.round((maxMon - minMon) / (7 * dayMs)) + 1, 60)
  const colOf = (d) => Math.round((mondayOf(d) - minMon) / (7 * dayMs))
  const todayCol = colOf(today0)
  const trackW = nCols * COL_W
  const cols = Array.from({ length: nCols }, (_, i) => {
    const date = new Date(minMon)
    date.setDate(date.getDate() + i * 7)
    return date
  })
  return { nCols, colOf, todayCol, trackW, cols }
}

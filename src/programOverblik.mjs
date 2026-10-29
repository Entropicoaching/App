// Read-only calendar arithmetic. Date-only model values are civil days;
// instants are interpreted in Copenhagen, independently of the device timezone.
export const DEFAULT_PROGRAM_OVERBLIK = false
const DAY = 86400000
const copenhagen = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function programOverblikEnabled(search = '') {
  const params = new URLSearchParams(search)
  const optedIn = key => {
    const values = params.getAll(key)
    return values.length === 1 && values[0] === '1'
  }
  return optedIn('programOverblik') || optedIn('rel1030')
}

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / DAY : null
}

export function copenhagenDay(value = new Date()) {
  if (typeof value === 'string' && dayNumber(value) !== null) return value
  // Reject ambiguous local datetime strings and invalid civil dates.
  if (!(value instanceof Date) && !(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))) return null
  if (typeof value === 'string' && dayNumber(value.slice(0, 10)) === null) return null
  const instant = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(instant.getTime())) return null
  const parts = Object.fromEntries(copenhagen.formatToParts(instant).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const iso = day => new Date(day * DAY).toISOString().slice(0, 10)
function isoWeek(day) {
  const thursday = day + 3 - ((new Date(day * DAY).getUTCDay() + 6) % 7)
  const year = new Date(thursday * DAY).getUTCFullYear()
  const jan4 = dayNumber(`${year}-01-04`)
  const firstThursday = jan4 + 3 - ((new Date(jan4 * DAY).getUTCDay() + 6) % 7)
  return { year, week: 1 + (thursday - firstThursday) / 7 }
}

export function buildProgramOverblik({ athletes = [], calendarWeeks = {}, today = new Date() } = {}) {
  const now = dayNumber(copenhagenDay(today))
  if (now === null) return []
  return athletes.filter(Boolean).map(athlete => {
    const weeks = Array.isArray(calendarWeeks?.[athlete.id]) ? calendarWeeks[athlete.id] : []
    // An empty week is not planned training. A dated week covers its seven civil days.
    const planned = weeks.filter(w => w && Number(w.exercise_count) > 0)
    const dated = planned.filter(w => dayNumber(w.start_date) !== null)
      .slice().sort((a, b) => a.start_date.localeCompare(b.start_date) || Number(a.week_number) - Number(b.week_number))
    const last = dated.at(-1)
    const end = last ? dayNumber(last.start_date) + 6 : null
    const daysLeft = end === null ? null : end - now
    const competition = dayNumber(athlete.competition_date)
    return {
      athlete,
      status: last ? 'planned' : planned.length ? 'undated' : 'empty',
      lastDate: end === null ? null : iso(end),
      lastWeek: last?.week_number ?? null,
      calendarWeek: end === null ? null : isoWeek(end),
      daysLeft,
      weeksLeft: daysLeft === null ? null : Math.max(0, daysLeft / 7),
      urgency: daysLeft === null ? 'unknown' : daysLeft < 7 ? 'red' : daysLeft < 14 ? 'yellow' : 'normal',
      nextCompetition: competition !== null && competition >= now ? athlete.competition_date : null,
    }
  }).sort((a, b) => ({ planned: 0, undated: 1, empty: 2 }[a.status] - { planned: 0, undated: 1, empty: 2 }[b.status])
    || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity)
    || a.athlete.name?.localeCompare(b.athlete.name || '', 'da') || 0)
}

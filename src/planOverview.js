const DAY_MS = 24 * 60 * 60 * 1000

function isoAtNoon(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateAtNoon(value) {
  const date = value instanceof Date ? new Date(value) : isoAtNoon(value)
  if (!date || Number.isNaN(date.getTime())) return null
  date.setHours(12, 0, 0, 0)
  return date
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function formatDate(iso) {
  const date = isoAtNoon(iso)
  return date ? date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) : null
}

function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

function weeksLabel(days) {
  const weeks = Math.max(0, Math.ceil(days / 7))
  return `${weeks} uge${weeks === 1 ? '' : 'r'}`
}

function entryForAthlete(athlete, weekRows, today) {
  const datedWeeks = [...weekRows]
    .map(week => ({ ...week, _date: isoAtNoon(week.start_date) }))
    .filter(week => week._date)
    .sort((left, right) => left._date - right._date || Number(left.week_number) - Number(right.week_number))

  const base = {
    athlete,
    week_count: weekRows.length,
    dated_week_count: datedWeeks.length,
    last_week: datedWeeks.at(-1) || null,
    coverage_end: null,
    competition_date: athlete.competition_date || null,
    status: 'needs_plan',
    tone: 'danger',
    headline: 'Ingen plan',
    sparring: 'Vælg retning, første checkpoint og en passende bloklængde.',
    suggested_focus: athlete.competition_date ? 'competition' : 'strength',
  }

  if (!weekRows.length) return base
  if (!datedWeeks.length) {
    return {
      ...base,
      status: 'needs_dates',
      tone: 'warning',
      headline: 'Blokke uden dato',
      sparring: 'Sæt datoer først. Ellers kan tempo og vej mod et stævne ikke vurderes.',
    }
  }

  const lastWeek = datedWeeks.at(-1)
  const coverageEndDate = new Date(lastWeek._date.getTime() + 6 * DAY_MS)
  const coverageEnd = isoDate(coverageEndDate)
  const daysOfCoverage = daysBetween(today, coverageEndDate)
  const competition = isoAtNoon(athlete.competition_date)
  const daysToCompetition = competition ? daysBetween(today, competition) : null
  const shared = {
    ...base,
    last_week: lastWeek,
    coverage_end: coverageEnd,
    days_of_coverage: daysOfCoverage,
    days_to_competition: daysToCompetition,
  }

  if (daysOfCoverage < 0) {
    return {
      ...shared,
      status: 'plan_ended',
      tone: 'danger',
      headline: `Plan sluttede ${formatDate(coverageEnd)}`,
      sparring: 'Afgør næste blok og dens formål, før programmet forlænges.',
    }
  }
  if (competition && daysToCompetition >= 0 && coverageEndDate < competition) {
    return {
      ...shared,
      status: 'competition_gap',
      tone: 'danger',
      headline: `Planen slutter ${weeksLabel(daysBetween(coverageEndDate, competition))} før stævne`,
      sparring: 'Afgør om du vil forlænge planen, eller om der bevidst skal ligge en overgang før stævnet.',
      suggested_focus: 'competition',
    }
  }
  if (daysOfCoverage <= 28) {
    return {
      ...shared,
      status: 'review_soon',
      tone: 'warning',
      headline: `Plan dækker til ${formatDate(coverageEnd)}`,
      sparring: 'Tag næste blokbeslutning nu, mens der stadig er tid til at justere uden hast.',
    }
  }
  return {
    ...shared,
    status: 'covered',
    tone: 'ready',
    headline: `Dækker til ${formatDate(coverageEnd)}`,
    sparring: 'Ingen ny blokbeslutning nu. Brug næste review til at bekræfte retning og checkpoint.',
  }
}

const PRIORITY = {
  needs_plan: 0,
  needs_dates: 1,
  plan_ended: 2,
  competition_gap: 3,
  review_soon: 4,
  covered: 5,
}

/**
 * Ren, forklarbar planstatus. Den giver aldrig programforskrifter og skriver
 * intet til databasen; brugeren åbner selv den enkelte atlets planassistent.
 */
export function buildPlanOverview({ athletes = [], calendarWeeks = {}, today = new Date() }) {
  const now = dateAtNoon(today) || new Date()
  return athletes
    .map(athlete => entryForAthlete(athlete, calendarWeeks[athlete.id] || [], now))
    .sort((left, right) => PRIORITY[left.status] - PRIORITY[right.status]
      || String(left.athlete.name || '').localeCompare(String(right.athlete.name || ''), 'da'))
}

export function planOverviewCounts(entries) {
  return entries.reduce((counts, entry) => ({
    ...counts,
    [entry.status]: (counts[entry.status] || 0) + 1,
  }), {})
}

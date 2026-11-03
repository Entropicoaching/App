import { weekSessions } from '../../session/weekSessions.mjs'

const days = ['Søn.', 'Man.', 'Tir.', 'Ons.', 'Tor.', 'Fre.', 'Lør.']
const validId = value => typeof value === 'string' ? value.trim() !== '' : Number.isSafeInteger(value)

// One already scoped week, using the E2-PAS-UGEPLAN1 contract unchanged.
// No ambient clock, reads, writes, navigation or independent completion rules.
export function weekPlanModel(input = {}) {
  const { week, athleteId } = input ?? {}
  if (!validId(athleteId) || !week ||
      (week.athlete_id != null && week.athlete_id !== athleteId)) {
    return { state: 'missing', rows: [] }
  }
  const plan = weekSessions(input)
  if (!plan.start || !plan.today || !Array.isArray(week.sessions)) {
    return { state: 'missing', rows: [] }
  }
  const rows = plan.sessions.map((session, index) => {
    const date = session.date
    const day = date ? `${days[new Date(`${date}T12:00:00Z`).getUTCDay()]} ${Number(date.slice(8))}/${Number(date.slice(5, 7))}` : 'Dag ukendt'
    const status = session.dataMissing ? 'unknown' : session.status === 'klaret' ? 'done'
      : !date ? 'undated' : date === plan.today ? 'today' : date > plan.today ? 'upcoming' : 'unfinished'
    const label = { unknown: 'Status ukendt', done: 'Klaret', today: 'I dag',
      upcoming: 'Kommende', unfinished: 'Ikke klaret', undated: 'Planlagt' }[status]
    const title = typeof session.title === 'string' && session.title.trim() ? session.title.trim() : 'Pas uden navn'
    return { key: `${index}:${session.sessionId ?? ''}`, date, day, title, status, label,
      // "Klaret" includes skipped sets in the shared model; preserve that detail.
      detail: session.skipped > 0 ? `${session.skipped} sæt sprunget over` : null }
  })
  return { state: rows.length ? 'ready' : 'empty', rows }
}

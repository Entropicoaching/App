import { addCalendarDays, calendarDay } from '../calendarDate.js'

// Lokal tilvalskontakt. Ingen miljøvariabler eller ændringer i databasen.
export const SAMLET_ATLETPROFIL_FLAG = 'entropi_coach_samlet_atletprofil'

export function samletAtletprofilEnabled(storage) {
  try {
    return (storage ?? window.localStorage).getItem(SAMLET_ATLETPROFIL_FLAG) === 'true'
  } catch {
    return false
  }
}

export function kostmaalTekst(athlete) {
  return [
    Number(athlete.kcal_target) > 0 && `${athlete.kcal_target} kcal`,
    Number(athlete.protein_target) > 0 && `${athlete.protein_target} g protein`,
  ].filter(Boolean).join(' · ')
}

const newest = rows => [...rows].sort((a, b) =>
  String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null

// Status kommer fra de allerede hentede rækker. Identiteten kontrolleres også
// her, så en sen besvarelse fra en anden profil aldrig bliver vist i status.
export function atletStatus({ athleteId, weeks = [], logs = [], messages = [], videos = [], now = new Date() }) {
  const today = calendarDay(now)
  if (!today) return { week: null, next: null, message: null, video: null }
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
  const monday = addCalendarDays(today, -weekday)
  const sunday = addCalendarDays(monday, 6)
  const ownWeeks = weeks.filter(w => w.athlete_id === athleteId)
  const ownLogs = logs.filter(l => l.athlete_id === athleteId)
  const sessions = ownWeeks.flatMap(w => (w.sessions || []).map(session => ({
    ...session,
    date: w.start_date && calendarDay(w.start_date) && Number.isInteger(session.weekday) && session.weekday >= 0 && session.weekday < 7
      ? addCalendarDays(w.start_date, session.weekday) : null,
    weekStart: w.start_date ? calendarDay(w.start_date) : null,
  })))
  const sessionByExercise = new Map(sessions.flatMap(s => (s.exercises || []).map(e => [e.id, s.id])))
  const weekLogs = ownLogs.filter(l => {
    const day = l.logged_at ? calendarDay(l.logged_at) : null
    return !l.skipped && day && day >= monday && day <= sunday
  })
  const loggedSessions = new Set(weekLogs.map(l =>
    l.exercises?.session_id || l.exercises?.sessions?.id || sessionByExercise.get(l.exercise_id)).filter(Boolean))
  const plannedSessions = sessions.filter(s => s.date
    ? s.date >= monday && s.date <= sunday
    : s.weekStart && s.weekStart >= monday && s.weekStart <= sunday)
  const completedSets = new Set(ownLogs.map(l => `${l.exercise_id}:${l.set_number}`))
  const complete = s => s.exercises?.length > 0 && s.exercises.every(e =>
    Number(e.sets) > 0 && Array.from({ length: Number(e.sets) }, (_, i) => i + 1)
      .every(n => completedSets.has(`${e.id}:${n}`)))
  const next = sessions.filter(s => s.date && s.date >= today && s.exercises?.length && !complete(s))
    .sort((a, b) => a.date.localeCompare(b.date) || a.session_order - b.session_order)[0] || null

  return {
    week: plannedSessions.length || loggedSessions.size
      ? { planned: plannedSessions.length || null, logged: loggedSessions.size } : null,
    next,
    message: newest(messages.filter(m => m.athlete_id === athleteId)),
    video: newest(videos.filter(v => v.athlete_id === athleteId && v.status === 'draft')),
  }
}

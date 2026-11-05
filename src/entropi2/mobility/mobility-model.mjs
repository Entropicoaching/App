import { nextTrainingHome } from '../../athlete/nextTrainingHome.mjs'
import { findDagensPas } from '../../nextSet.js'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { calendarTime } from '../../athlete/kostNumbers.mjs'
import { sessionMobilityPlan } from '../../athlete/mobilityBeforeSession.mjs'
import { WARMUP_BASE } from '../../athlete/mobilityCatalog.mjs'
import { focusPlan } from '../../athlete/mobilityFocus.mjs'
import { readCoachChoices, coachCatalog } from '../../athlete/coachMobility.mjs'
import { readHomework, homeworkLibrary, HOMEWORK_NOTICE } from '../../mobilityHomework.mjs'
import { recommendMobilityRoutine } from './mobility-recommendation.mjs'

export const DEFAULT_ENTROPI2_MOBILITY = false
const validId = id => typeof id === 'string' && !!id.trim() && id.length <= 200

// Calendar projection follows nextTrainingHome's pinned anchor rule. Selection
// itself uses nextTrainingHome (future/rest) and findDagensPas (next actual set).
function startOf(week, weeks, active, today) {
  if (calendarTime(week.start_date) !== null) return week.start_date
  if (week.start_date) return null
  const anchor = [...weeks].sort((a, b) => a.week_number - b.week_number)
    .find(w => calendarTime(w.start_date) !== null && Number.isInteger(w.week_number))
  const monday = addCalendarDays(today, -((new Date(calendarTime(today)).getUTCDay() + 6) % 7))
  if (!Number.isInteger(week.week_number)) return week === active ? monday : null
  return anchor ? addCalendarDays(anchor.start_date, (week.week_number - anchor.week_number) * 7)
    : Number.isInteger(active.week_number) ? addCalendarDays(monday, (week.week_number - active.week_number) * 7) : null
}

export function nextMobilitySession({ allWeeks, currentWeek, exerciseLogs, now }) {
  const today = calendarDay(now)
  if (!today || !validId(currentWeek?.id) || !Array.isArray(allWeeks) || allWeeks.some(w => !w || !validId(w.id)) || !Array.isArray(exerciseLogs) ||
      exerciseLogs.some(l => !l || typeof l !== 'object')) return null
  const weeks = [...allWeeks]
  if (!weeks.some(w => w.id === currentWeek.id)) weeks.push(currentWeek)
  if (weeks.some(w => !w || !Array.isArray(w.sessions) || w.sessions.some(s => !s || !validId(s.id) ||
    !Array.isArray(s.exercises) || s.exercises.some(e => !e || !validId(e.id) ||
      !Number.isInteger(e.sets) || e.sets < 0)))) return null
  const active = weeks.find(w => w.id === currentWeek.id)
  const preview = nextTrainingHome({ enabled: true, allWeeks: weeks, currentWeek: active, exerciseLogs, now })
  const candidates = []
  for (const week of weeks) {
    const start = startOf(week, weeks, active, today)
    if (!start) continue
    for (const session of week.sessions) {
      const fixed = Number.isInteger(session.weekday) && session.weekday >= 0 && session.weekday <= 6
      if (!fixed && session.weekday != null) continue
      const date = fixed ? addCalendarDays(start, session.weekday) : null
      if (preview?.kind === 'next') {
        // Isolate the session without dropping weeks/anchors. This reuses the
        // existing selector rather than resolving ambiguous titles or lift names.
        const isolated = weeks.map(w => ({ ...w, sessions: w === week ? [session] : [] }))
        const one = nextTrainingHome({ enabled: true, allWeeks: isolated,
          currentWeek: isolated.find(w => w.id === active.id), exerciseLogs, now })
        if (one?.kind !== 'next') continue
      } else if (preview !== null || !(date === today || (!fixed && start <= today && today <= addCalendarDays(start, 6)))) continue
      const pas = findDagensPas([week], { ...week, sessions: [session] }, exerciseLogs)
      if (pas?.status === 'open' && pas.next) candidates.push({ week, session, date, pas, order: date || start })
    }
  }
  if (preview === null) {
    // Today's eligible sessions retain the supplied next-set order. A flexible
    // session has no appointment date; its week start must not outrank today.
    for (const week of weeks) {
      const eligible = candidates.filter(candidate => candidate.week === week)
      const pas = findDagensPas(weeks, { ...week, sessions: eligible.map(candidate => candidate.session) }, exerciseLogs)
      if (pas?.status === 'open' && pas.next) {
        return { ...eligible.find(candidate => candidate.session === pas.session), pas }
      }
    }
    return null
  }
  candidates.sort((a, b) => a.order.localeCompare(b.order) ||
    (a.session.session_order ?? 0) - (b.session.session_order ?? 0))
  return candidates[0] || null
}

export function mobilityModel(options = {}) {
  if (options.enabled !== true || !validId(options.athlete?.id)) return null
  const { athlete, storage, homeworkEnabled = false, coachEnabled = false } = options
  const exerciseLogs = Array.isArray(options.exerciseLogs) ? options.exerciseLogs.filter(l =>
    !l?.athlete_id || l.athlete_id === athlete.id) : options.exerciseLogs
  const selected = nextMobilitySession({ ...options, exerciseLogs })
  const seed = selected ? sessionMobilityPlan(selected.pas, exerciseLogs) : []
  // Keep the existing eligibility guard: no routine for stale/started/unknown
  // sessions. Eligible sessions use the complete recommendation and catalog doses.
  const recommendation = seed.length ? recommendMobilityRoutine(selected.session) : null
  const routine = recommendation?.routine || []
  const problems = homeworkLibrary()
  const homework = homeworkEnabled === true ? readHomework(athlete.id, storage) : { value: null, error: null }
  const problem = problems.find(p => p.id === homework.value?.problemId)
  const assigned = problem ? homework.value.exerciseIds.map(id => problem.exercises.find(e => e.id === id)) : []
  const coach = coachEnabled === true ? readCoachChoices(true, athlete.id, athlete.notes, WARMUP_BASE) : { choices: {}, error: null }
  const choices = Object.entries(coach.choices).map(([lift, choice]) => ({ lift, need: choice.need,
    exercises: choice.ids.length ? choice.ids.map(id => coachCatalog(lift, WARMUP_BASE).find(e => e.id === id))
      : focusPlan(lift, choice.need, WARMUP_BASE).exercises }))
  return { athleteId: athlete.id, selected, lift: recommendation?.lift, routine, recommendation,
    screenDate: calendarDay(options.now),
    routineId: routine.length ? 'recommendation:v1:' + routine.map(ex => ex.id).join(':') : null,
    assigned, choices, problems,
    homeworkNotice: HOMEWORK_NOTICE, error: [homework.error, coach.error].filter(Boolean).join(' '),
    coachName: validId(athlete.coach_id) && options.coach?.id === athlete.coach_id &&
      typeof options.coach.name === 'string' && options.coach.name.trim() ? options.coach.name.trim() : null,
    // Local homework stores no author. Never attribute it to a fabricated name.
    homeworkAuthor: 'Fra din coach' }
}

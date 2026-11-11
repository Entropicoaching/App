// u8d: lukkede prøve-loadere tillader ingen ny import; samme regel som danskTal.mjs.
const komma = value => String(value ?? '').replace(/(\d)\.(\d)/, '$1,$2')
import { createElement as h } from 'react'
import { buildFourWeeks } from './coachFourWeeks.mjs'
import { isSessionDone } from '../nextSet.js'
import { heaviestSetPerWeek } from '../exerciseProgress.js'
import { calendarDay } from '../calendarDate.js'
import { parseInputNumber } from '../inputValues.js'
import { ATHLETE_LOGS_LIMIT } from './coachKonstanter.js'

export const DEFAULT_PROFILE_WEEK = false
export function profileWeekFlag(search = '') {
  const values = new URLSearchParams(search).getAll('coachProfilUge')
  return values.length === 1 && values[0] === '1'
}

// Reuse the existing calendar buckets, session completion and heaviest-set rule.
// No reads, writes, estimates or new training score in this presentation.
export function profileWeekLines({ athleteId, reads = {}, today = new Date() } = {}) {
  const model = buildFourWeeks({ athleteId, reads, today })
  const week = model.weeks[0]
  const ready = kind => reads[kind]?.athleteId === athleteId && reads[kind]?.status === 'ready' && Array.isArray(reads[kind].rows)
  const unavailable = kind => reads[kind]?.athleteId === athleteId && reads[kind]?.status === 'error'
    ? 'Kunne ikke indlæses.' : 'Indlæser…'
  const logsReady = ready('logs') && reads.logs.rows.length < ATHLETE_LOGS_LIMIT
  const logStatus = ready('logs') && !logsReady ? 'Ufuldstændigt loggrundlag.' : unavailable('logs')
  if (!week) return { title: 'Seneste uge', lines: ['Pas: Ukendt uge.', 'Bedste sæt: Ukendt uge.', 'Seneste fra atleten: Ukendt uge.'] }
  const sessions = week.plans.flatMap(plan => plan.sessions || [])
  const completed = sessions.filter(session => isSessionDone(session, week.logs.filter(log => !log.skipped)))
  // Reuse the Danish day already assigned by buildFourWeeks for one week bucket.
  const best = logsReady ? heaviestSetPerWeek(week.logs.map(log => ({ ...log, logged_at: log.day })))[0] : null
  const bestLog = best && week.logs.find(log => !log.skipped && parseInputNumber(log.weight) === best.weight && parseInputNumber(log.reps_completed) === best.reps)
  const candidates = [
    ...(ready('messages') ? reads.messages.rows.filter(row => row?.athlete_id === athleteId && row.sender_role === 'athlete')
      .map(row => ({ at: row.created_at, text: `Besked: ${row.content || 'Tom besked'}` })) : []),
    ...week.videos.filter(row => row.source_mode === 'athlete_submission')
      .map(row => ({ at: row.created_at || row.analyzed_at, text: `Video: ${row.lift || 'Løft'}` })),
  ].filter(row => {
    const day = calendarDay(row.at)
    return day && day >= week.start && day <= model.day && day <= week.end
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return { title: `Seneste uge: ${week.start} til ${model.day}`, lines: [
    `Pas: ${!ready('weeks') ? unavailable('weeks') : !logsReady ? logStatus : !week.plans.length ? 'Ingen dateret plan denne uge.' : `${completed.length} af ${sessions.length} gennemført`}`,
    `Bedste sæt (tungest): ${!logsReady ? logStatus : best ? `${bestLog?.exercises?.name || 'Øvelse'} ${komma(best.weight)} kg × ${best.reps}` : 'Ingen gennemførte sæt denne uge.'}`,
    `Seneste fra atleten: ${!ready('messages') ? unavailable('messages') : !ready('videos') ? unavailable('videos') : reads.videos.rows.length >= 30 ? 'Ufuldstændigt videogrundlag.' : candidates[0]?.text || 'Ingen besked eller video denne uge.'}`,
  ] }
}

export function ProfileWeekSummary({ enabled = DEFAULT_PROFILE_WEEK, ...props }) {
  if (enabled !== true) return null
  const model = profileWeekLines(props)
  return h('section', { 'aria-label': model.title, 'data-profile-week': true,
    style: { marginBottom: '1rem', padding: '0.85rem', border: '1px solid #59564c', color: '#edeae2', overflowWrap: 'anywhere' } },
    h('h2', { style: { fontSize: '1rem', margin: '0 0 8px' } }, model.title),
    ...model.lines.map((line, index) => h('p', { key: index, style: { margin: '4px 0', whiteSpace: 'pre-wrap' } }, line)))
}

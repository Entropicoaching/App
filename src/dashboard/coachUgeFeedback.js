import { calendarDay, addCalendarDays } from '../calendarDate.js'
import { summarizeWeek } from '../athlete/ugeFeedback.js'
import { coachTekstForslag } from './coachTekstForslag.js'
import { coachTekstTree } from './coachTekstTree.js'

// Calendar closure, independent of log coverage. No guessed end for undated weeks.
export function erAfsluttetUge(week, now) {
  const start = calendarDay(week?.start_date || '')
  const end = start && addCalendarDays(start, 7)
  const today = now instanceof Date ? calendarDay(now) : null
  return !!(end && today && today >= end)
}

// ProgramTab receives athlete-scoped logs. Keep this week's known exercise ids,
// and unknown/deleted exercises only when their pinned session belongs here.
export function logsForUge(week, logs) {
  const sessions = week?.sessions || []
  const sessionIds = new Set(sessions.map(s => s.id))
  const exerciseIds = new Set(sessions.flatMap(s => (s.exercises || []).map(e => e.id)))
  return (Array.isArray(logs) ? logs : []).filter(l => l && (
    exerciseIds.has(l.exercise_id) || (l.exercises?.session_id != null && sessionIds.has(l.exercises.session_id))
  ))
}

export function afvigelseTekst(a) {
  const name = a.ovelse || 'Øvelse'
  switch (a.type) {
    case 'ikke_logget': return `${name}: ingen registrerede sæt (planlagt ${a.planlagt}).`
    case 'faerre_saet': return `${name}: ${a.gennemfoert}/${a.planlagt} gennemførte sæt, ${a.sprunget} sprunget over.`
    case 'flere_saet': return `${name}: ${a.gennemfoert}/${a.planlagt} gennemførte sæt.`
    case 'faerre_reps': return `${name}: ${a.saet} sæt under planens ${a.planlagt} reps.`
    case 'anden_vaegt': return `${name}: ${a.saet} sæt med anden vægt end anbefalet ${a.anbefalet} kg.`
    case 'ukendt_ovelse_log': return `${a.antal} registreringer på øvelser uden for ugeplanen.`
    default: return 'Ukendt afvigelse; gennemgå loggen.'
  }
}

const STATUS = { tom: 'Ingen planlagte sæt', ingen_logs: 'Ingen registrerede sæt', sprunget_over: 'Sprunget over', delvis: 'Delvist gennemført', fuld: 'Fuldt gennemført' }
const PAS_STATUS = { ingen_saet_planlagt: 'Ingen planlagte sæt', ikke_logget: 'Ikke logget', delvis: 'Delvist gennemført', gennemfoert: 'Gennemført' }

// Pure element tree. React supplies h in the app; producer probes use a small fake.
export function ugeFeedbackTree(h, feedback, ugeNr, scope = ugeNr, navne = {}) {
  if (!feedback) return null
  const list = (title, lines) => h('div', { key: title },
    h('h4', { 'aria-level': 5 }, title),
    lines.length ? h('ul', null, ...lines.map((line, i) => h('li', { key: i }, line))) : h('p', null, 'Ingen registreret.'))
  const r = feedback.rpe
  return h('section', { 'aria-label': `Coachens ugeoverblik for uge ${ugeNr}`, style: { color: '#edeae2', background: '#1c1c18', padding: '1rem', marginBottom: '0.75rem', overflowWrap: 'anywhere' } },
    h('h3', { 'aria-level': 4 }, `Uge ${ugeNr} · Coachens ugeoverblik`),
    h('p', null, `Afsluttet kalenderuge · ${STATUS[feedback.status] || feedback.status}`),
    h('p', null, 'Overblikket bygger på de indlæste logs. Coachen vurderer spørgsmålene sammen med atleten. Programmet ændres ikke automatisk.'),
    list('Pas og sæt', feedback.pas.map(p => `${p.titel || 'Pas'}: ${PAS_STATUS[p.status] || p.status}. ${p.gennemfoertSaet}/${p.planlagtSaet} gennemførte sæt; ${p.sprunget} sprunget over.${p.manglendeOevelser.length ? ' Uden fuld dækning: ' + p.manglendeOevelser.join(', ') + '.' : ''}`)),
    list('Afvigelser', feedback.afvigelser.map(afvigelseTekst)),
    list('Atletens noter', feedback.noter.map(n => n.tekst)),
    h('h4', { 'aria-level': 5 }, 'RPE'),
    h('p', null, r.kilde),
    h('p', null, `Gennemsnit: ${r.gennemsnit ?? 'ukendt'} · Maks: ${r.max ?? 'ukendt'} · Med RPE: ${r.saetMedRpe} · Uden RPE: ${r.saetUdenRpe} · Ugyldige: ${r.ugyldigeRpe}`),
    list('Spørgsmål til coachen', feedback.spoergsmaal),
    coachTekstTree(h, coachTekstForslag(feedback, navne), scope))
}

export function coachUgeFeedback(week, athleteLogs, now) {
  if (!erAfsluttetUge(week, now) || !Array.isArray(athleteLogs)) return null
  // App logs store actual RPE in rpe_actual; the pure summary accepts rpe.
  const logs = logsForUge(week, athleteLogs).map(log => ({ ...log, rpe: log.rpe_actual }))
  return summarizeWeek(week, logs)
}

// Rene uge-/dato-hjaelpere, parsePlannedRpe og logFrontendError — flyttet
// uaendret ud af AthleteView.jsx (ordre 373). Delt af AthleteView, forsidens
// komponenter og handler-fabrikkerne (ProgramTab faar nogle af dem som props).
import { supabase } from '../supabase'

function parsePlannedRpe(intensity) {
  if (!intensity) return null
  const m = intensity.match(/RPE\s*(\d+(?:[.,]\d+)?)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

// Best-effort log til frontend_errors (samme tabel som ErrorBoundary.jsx bruger)
// for fejl der oversættes til en venlig besked i UI'en — detaljen skal ikke gå
// tabt selvom atleten kun ser én sætning.
function logFrontendError(message, error, athleteId) {
  try {
    supabase.from('frontend_errors').insert({
      message: String(message).slice(0, 1000),
      stack: String(error?.message || error || '').slice(0, 4000),
      url: window.location.href,
      user_agent: navigator.userAgent,
      user_id: athleteId ?? null,
    }).then(() => {}).catch(() => {})
  } catch { /* logging må aldrig selv vælte visningen */ }
}

// Den "aktive" uge atleten lander på.
// 1) Foretræk en dateret uge hvis 7-dages-spænd indeholder i dag (den uge man
//    reelt træner i nu) — så man ikke hopper forbi til et højere ugenummer uden dato.
// 2) Ellers: seneste ikke-fremtidige uge (uger uden start_date tæller som tilgængelige,
//    fremtidige datoer udelukkes, så man ikke lander på en tom planlagt uge).
function computeActiveWeekIdx(weeks) {
  if (!weeks || !weeks.length) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let containing = -1
  weeks.forEach((w, i) => {
    if (!w.start_date) return
    const d = new Date(w.start_date + 'T00:00:00')
    d.setHours(0, 0, 0, 0)
    const end = new Date(d.getTime())
    end.setDate(end.getDate() + 7)
    if (d <= today && today < end) containing = i
  })
  if (containing >= 0) return containing
  let active = -1
  weeks.forEach((w, i) => {
    let isFuture = false
    if (w.start_date) {
      const d = new Date(w.start_date + 'T00:00:00')
      d.setHours(0, 0, 0, 0)
      isFuture = d > today
    }
    if (!isFuture) active = i
  })
  return active >= 0 ? active : 0
}

// En uge regnes som fuldt logget når alle planlagte sæt har en log.
// Skippede/auto-udfyldte sæt tæller med, samme "done"-regel
// som per-session isDone i programmet. Tomme uger/sessioner tæller som ikke-done.
function weekFullyLogged(week, logs) {
  const sessions = week?.sessions || []
  if (!sessions.length) return false
  return sessions.every(s => {
    const total = (s.exercises || []).reduce((a, e) => a + (e.sets || 0), 0)
    if (total === 0) return false
    return (s.exercises || []).every(e => {
      for (let setNumber = 1; setNumber <= (e.sets || 0); setNumber++) {
        if (!(logs || []).some(l => l.exercise_id === e.id && l.set_number === setNumber)) return false
      }
      return true
    })
  })
}

// Brug ugens egen startdato, ellers den tidligste daterede uge (anker + 7 dage pr.
// uge), så selv delvist daterede atleter får et datointerval på hver uge —
// samme princip som coach-kalenderen, så datoerne er konsistente på tværs af
// appen. Returnerer null hvis ingen uge har en dato.
function weekStartDate(weeks, weekNumber) {
  if (!weeks?.length) return null
  const selected = weeks.find(w => w.week_number === weekNumber)
  if (selected?.start_date) return new Date(selected.start_date + 'T12:00:00')
  const anchor = [...weeks].sort((a, b) => a.week_number - b.week_number).find(w => w.start_date)
  if (!anchor) return null
  const start = new Date(anchor.start_date + 'T12:00:00')
  start.setDate(start.getDate() + (weekNumber - anchor.week_number) * 7)
  return start
}
function fmtWeekRange(start) {
  if (!start) return null
  const end = new Date(start.getTime() + 6 * 86400000)
  const f = (d) => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  return `${f(start)} – ${f(end)}`
}
// Valgfri fast ugedag pr. session (0=mandag .. 6=søndag). null = ingen fast dag.
const WEEKDAYS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

export { computeActiveWeekIdx, weekFullyLogged, weekStartDate, fmtWeekRange,
  WEEKDAYS_LONG, WEEKDAYS_SHORT, parsePlannedRpe, logFrontendError }

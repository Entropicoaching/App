import { useState, useEffect, useRef } from 'react'
import { supabase, withRetry, queueWrite, signOutHard, createAbortableUploadClient } from './supabase'
import { mergeAthleteSetInputs, nextAthleteSetInput } from './athleteTrainingInputs'
import { sanitizeVideoCoachFeedbackEvidence } from './videoCoachFeedbackEvidence'
import { videoCoachPersonalBaselineAthleteText, videoCoachPersonalBaselineForAnalysis } from './videoCoachPersonalFeedback'
import { VIDEOCOACH_LIFT_LABELS as ATHLETE_VIDEO_LIFTS, videoCoachVariationLabel as athleteVideoVariationLabel } from './videoCoachLabels'
import { ATHLETE_ONBOARDING_GUIDE_STEPS, hasCompletedOnboardingGuide, isLastOnboardingGuideStep } from './athleteOnboardingGuide'
import { runGuardedWrite } from './athleteWriteGuard'
import { runGuardedRead } from './athleteReadGuard'
import { loadReadinessDraft, saveReadinessDraft, clearReadinessDraft, isEmptyReadinessDraft } from './readinessDraft'
import { recordSilentFail, attachPendingSilentFails, clearPendingSilentFails, markUploadInflight,
  clearUploadInflight, takeStaleUploadInflight } from './athleteSilentFailLog'
import { compareReadiness, readinessComparisonText, readinessTrainingNote, summarizeReadinessForCoach, lastCheckinDrivenChange } from './readinessInsight'
import { remainingSeconds } from './restTimer'
import { findDagensPas, lastHeaviestSet } from './nextSet'
import { applySetEdit } from './editLoggedSet'
import { shouldNudgeCheckin } from './checkinReminder'
import { restSecondsForExercise } from './restBetweenSets'
import { startRestPause, loadRestPause, clearRestPause } from './restPause'
import { saveOfflineSet, loadOfflineSets, clearOfflineSet, countOfflineSets } from './offlineSetQueue'
import { loadShowNextSetPreview, saveShowNextSetPreview } from './nextSetPreview'
import { estimatedOneRepMax, HOVEDLOEFT_FAMILIER } from './exerciseProgress'
import { parseRepsPrescription } from './repsPrescription'
import { defaultSetWeight, defaultSetReps, stepWeight, stepReps, stepRepsInInputs, autoFillSetInput } from './setLogDefaults'
import { fremgangLogsQuery, fremgangLogsKronologisk } from './fremgangLogs'
import { calcWarmupSets, isMainLift } from './warmup'
import { applyWarmupCorrection, saveWarmupOverride, suggestWarmupOverride } from './warmupOverride'
import { flushVideoCoachDraftQueue, isRetryableVideoCoachError,
  queueVideoCoachDraft, saveVideoCoachDraft,
  validateVideoCoachPayloadBounds } from './videoCoachSubmission'
import { VIDEOCOACH_BUILD_ID } from './videoCoachVersion'
import { buildAwaitingAnalysisRow, buildVideoUploadPath, validateVideoUploadRequest,
  videoUploadAlreadyExistsError, VIDEOCOACH_UPLOAD_BUCKET } from './videoCoachUpload'
import LazyBoundary from './LazyBoundary'
import { s, shiftDate, today, unitsForFood } from './athleteShared'
import UgensStatusKort from './athlete/UgensStatusKort'

const ATHLETE_VIDEOCOACH_PREFIX = 'entropi:videocoach:v3'
const ATHLETE_VIDEOCOACH_QUEUE_CHANGED = 'entropi:videocoach:queue-changed'
const ATHLETE_VIDEOCOACH_URL = `videocoach.html?mode=athlete&bridge=athlete-v1&v=${VIDEOCOACH_BUILD_ID}`
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ATHLETE_VIDEOCOACH_COLUMNS = new Set([
  'client_analysis_id', 'athlete_id', 'athlete_name', 'source_mode', 'status',
  'lift', 'variation', 'load_kg', 'rpe', 'reps_count', 'rep_details',
  'session_context', 'capture_context', 'schema_version', 'schema_v',
  'engine_version', 'tracker_version', 'skeleton_version', 'feedback_version',
  'low_conf_pct', 'position_quality_pct', 'quality_flags', 'metrics', 'skeleton',
  'findings', 'coach_note', 'athlete_feedback', 'ai_draft', 'bar_path',
  'analyzed_at', 'reps', 'load_note', 'bias_note', 'rom_cm', 'loss_pct',
  'stick_pct', 'dip_pct', 'drift_cm', 'extra', 'ai_text',
])

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function validateAthleteVideoCoachRow(row, athleteId) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 'Ugyldig analysepayload'
  if (Object.keys(row).some(key => !ATHLETE_VIDEOCOACH_COLUMNS.has(key)))
    return 'Analysen indeholder et felt, som atletbroen ikke tillader'
  if (row.schema_version !== 3 || row.schema_v !== 3 || row.status !== 'draft')
    return 'Kun schema-v3 kladder kan sendes til coachen'
  if (row.source_mode !== 'athlete_submission' || row.athlete_id !== athleteId)
    return 'Analysen er ikke knyttet til den indloggede atlet'
  if (!isUuid(row.client_analysis_id)) return 'Analysen mangler et gyldigt klient-id'
  if (!['squat', 'bench', 'deadlift'].includes(row.lift)) return 'Ugyldigt løft'
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(row.variation || ''))
    return 'Ugyldig variation'
  if (!Array.isArray(row.reps) || row.reps.some(value => typeof value !== 'number'))
    return 'Repdata skal være numeriske'
  if (!Array.isArray(row.rep_details) || row.reps_count !== row.rep_details.length)
    return 'Repantal og repdetaljer stemmer ikke'
  const boundsError = validateVideoCoachPayloadBounds(row)
  if (boundsError) return boundsError
  const athleteNote = row.session_context?.athlete_note
  if (athleteNote != null && (typeof athleteNote !== 'string' || athleteNote.length > 1000))
    return 'Notatet til coachen er ugyldigt eller for langt'
  return null
}

function athleteVideoPathPreview(barPath) {
  if (!barPath || !Array.isArray(barPath.dx) || !Array.isArray(barPath.dy) ||
      barPath.dx.length !== barPath.dy.length || barPath.dx.length > 240 ||
      !Number.isFinite(Number(barPath.x0)) || !Number.isFinite(Number(barPath.y0))) return null
  let x = Number(barPath.x0), y = Number(barPath.y0)
  const path = [{ x, y }]
  for (let i = 0; i < barPath.dx.length; i++) {
    const dx = Number(barPath.dx[i]), dy = Number(barPath.dy[i])
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1000 || Math.abs(dy) > 1000)
      return null
    x += dx; y += dy; path.push({ x, y })
  }
  if (path.length < 2) return null
  const xs = path.map(point => point.x), ys = path.map(point => point.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = Math.max(30, maxX - minX), height = Math.max(60, maxY - minY)
  const padX = Math.max(12, width * 0.22), padY = Math.max(12, height * 0.1)
  return {
    points: path.map(point => `${point.x},${point.y}`).join(' '),
    viewBox: `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`,
    start: path[0], end: path[path.length - 1], referenceX: path[0].x,
    y1: minY - padY, y2: maxY + padY,
  }
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
  const dayMs = 86400000
  let containing = -1
  weeks.forEach((w, i) => {
    if (!w.start_date) return
    const d = new Date(w.start_date)
    d.setHours(0, 0, 0, 0)
    if (d <= today && today < new Date(d.getTime() + 7 * dayMs)) containing = i
  })
  if (containing >= 0) return containing
  let active = -1
  weeks.forEach((w, i) => {
    let isFuture = false
    if (w.start_date) {
      const d = new Date(w.start_date)
      d.setHours(0, 0, 0, 0)
      isFuture = d > today
    }
    if (!isFuture) active = i
  })
  return active >= 0 ? active : 0
}

// En uge regnes som fuldt logget når hver session har lige så mange logs som
// planlagte sæt (skippede/auto-udfyldte sæt tæller med — samme "done"-regel
// som per-session isDone i programmet). Tomme uger/sessioner tæller som ikke-done.
function weekFullyLogged(week, logs) {
  const sessions = week?.sessions || []
  if (!sessions.length) return false
  return sessions.every(s => {
    const total = (s.exercises || []).reduce((a, e) => a + (e.sets || 0), 0)
    if (total === 0) return false
    const ids = new Set((s.exercises || []).map(e => e.id))
    return logs.filter(l => ids.has(l.exercise_id)).length >= total
  })
}

// Udled en uges startdato fra den tidligste daterede uge (anker + 7 dage pr.
// uge), så selv delvist daterede atleter får et datointerval på hver uge —
// samme princip som coach-kalenderen, så datoerne er konsistente på tværs af
// appen. Returnerer null hvis ingen uge har en dato.
function weekStartDate(weeks, weekNumber) {
  if (!weeks?.length) return null
  const anchor = [...weeks].sort((a, b) => a.week_number - b.week_number).find(w => w.start_date)
  if (!anchor) return null
  return new Date(new Date(anchor.start_date + 'T12:00:00').getTime() + (weekNumber - anchor.week_number) * 7 * 86400000)
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

// Ugekalender på forsiden: 7 celler (man-søn) med ugens sessioner placeret på
// deres weekday. Klik på en dag med session åbner den i Program-fanen.
//
// ORDRE 330 · blok 1 — Marcs dom: man så ikke tydeligt hvilken dag man stod
// på, og dagene flød sammen til én blok. Derfor bæres hver tilstand nu af
// FORM, ikke kun en farvenuance:
//   - den viste dag (dagens pas' dag, `shownWd`): 2 px kant, fed ugedag,
//     lille trekant under cellen,
//   - i dag: datoen står i en udfyldt lys cirkel (aria-current="date"),
//   - pas-dage: fast kant + prik, klarede pas: ✓,
//   - hviledage: stiplet kant, "hvile" i stedet for prik, dæmpet.
// Og der er luft (0.5rem) mellem dagene. Uden datoer på ugen (ældre
// programmer) regnes den aktive uge som denne uge, så "i dag" stadig vises.
function WeekCalendar({ week, weekStart, exerciseLogs, onOpenSession, shownWd }) {
  const sessions = week?.sessions || []
  if (!sessions.length) return null
  const sessDone = s => (s.exercises || []).length > 0 &&
    (s.exercises || []).every(ex => exerciseLogs.some(l => l.exercise_id === ex.id))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayWd = (today.getDay() + 6) % 7
  const days = [...Array(7)].map((_, wd) => {
    let date = null
    if (weekStart) { date = new Date(weekStart.getTime() + wd * 86400000); date.setHours(0, 0, 0, 0) }
    return { wd, date, sessions: sessions.filter(s => s.weekday === wd) }
  })
  const flex = sessions.filter(s => s.weekday == null)
  const mono = "'IBM Plex Mono', monospace"
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div data-dagstrimmel="" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
        {days.map(d => {
          const isToday = d.date ? d.date.getTime() === today.getTime() : d.wd === todayWd
          const has = d.sessions.length > 0
          const allDone = has && d.sessions.every(sessDone)
          const isShown = shownWd != null && d.wd === shownWd
          const state = !has ? 'hvile' : allDone ? 'klaret' : 'pas'
          const border = isShown ? '2px solid #c8923a'
            : state === 'klaret' ? '1px solid rgba(108,186,108,0.45)'
            : state === 'pas' ? '1px solid rgba(237,234,226,0.22)'
            : '1px dashed rgba(237,234,226,0.1)'
          const bg = isShown ? 'rgba(200,146,58,0.14)' : state === 'klaret' ? 'rgba(108,186,108,0.07)' : state === 'pas' ? 'rgba(237,234,226,0.04)' : 'transparent'
          const open = has ? (d.sessions.find(s => !sessDone(s)) || d.sessions[0]) : null
          const label = [
            WEEKDAYS_LONG[d.wd],
            isToday && 'i dag',
            has ? d.sessions.map(s => s.title).join(', ') : 'hviledag',
            allDone && 'klaret',
            isShown && 'vises nu',
          ].filter(Boolean).join(' · ')
          return (
            <button
              key={d.wd}
              type="button"
              data-dag={state}
              data-vist={isShown ? 'ja' : undefined}
              aria-current={isToday ? 'date' : undefined}
              aria-label={label}
              onClick={() => open && onOpenSession(open.id)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                minWidth: 0, minHeight: '64px', boxSizing: 'border-box',
                padding: isShown ? '0.4rem 0 0.35rem' : '0.45rem 0 0.4rem', background: bg,
                border, borderRadius: 4,
                cursor: has ? 'pointer' : 'default', fontFamily: mono,
                opacity: state === 'hvile' && !isToday ? 0.7 : 1,
              }}
            >
              <span data-ugedag="" style={{ fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: isShown ? 700 : 400, color: isShown ? '#c8923a' : isToday ? '#edeae2' : '#7a7770' }}>
                {WEEKDAYS_SHORT[d.wd]}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '1.45rem', height: '1.45rem', borderRadius: '50%',
                fontFamily: "'Playfair Display', serif", fontSize: '0.85rem', lineHeight: 1,
                fontWeight: isShown || isToday ? 700 : 400,
                background: isToday ? '#edeae2' : 'transparent',
                color: isToday ? '#141410' : has ? '#edeae2' : '#4a4844',
              }}>
                {d.date ? d.date.getDate() : ''}
              </span>
              <span style={{ fontSize: state === 'hvile' ? '0.4rem' : '0.55rem', letterSpacing: state === 'hvile' ? '0.06em' : 0, lineHeight: 1, height: '0.6rem', textTransform: 'uppercase', color: allDone ? '#6cba6c' : isShown ? '#c8923a' : has ? '#a9a69e' : '#4a4844' }}>
                {allDone ? '✓' : has ? '●' : 'hvile'}
              </span>
              {isShown && (
                <span aria-hidden="true" style={{ position: 'absolute', bottom: '-7px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #c8923a' }} />
              )}
            </button>
          )
        })}
      </div>
      {flex.length > 0 && (
        <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '0.5rem' }}>
          + {flex.length} fleksibel{flex.length > 1 ? 'le' : ''} session{flex.length > 1 ? 'er' : ''} uden fast dag
        </div>
      )}
    </div>
  )
}

// ORDRE 263 · commit 1 — "Dagens pas": øverst på forsiden, præcis det næste
// sæt (øvelse, vægt, reps, RPE), stort nok til at læses på armslængde, med
// log/spring over lige ved hånden (samme skrivefunktioner som Program-fanen
// — logInputs-nøglen er `${exerciseId}_${setNumber}`, delt på tværs af
// begge faner). Under det: resten af DENNE session i kort form. `pas` kommer
// fra findDagensPas (src/nextSet.js, ren funktion, se dens tests).
function DagensPasCard({ pas, exerciseHistory, exerciseLogs, logInputs, setLogInputs, onLogSet, skipSet, suggestNextWeight, onOpenSession, todayStr, checkinNudge, lastLoggedSet, onUndoLastSet, onUpdateLoggedSet, pendingSyncCount }) {
  const activeNext = pas && pas.status === 'open' ? pas.next : null

  // ORDRE 314 · blok 1 — Marcs dom: man kunne se det næste sæt, men ikke
  // hvilket sæt man var på. Løsning: kun det AKTUELLE sæt har fulde felter,
  // allerede klarede sæt (samme øvelse) er kompakte linjer, og "næste sæt" er
  // højst én dæmpet linje uden felter — og kan slås fra (se nextSetPreview.js).
  const [showNextPreview, setShowNextPreview] = useState(() => loadShowNextSetPreview())

  // ORDRE 320 · blok 1 — "ret" på et klaret sæt åbner det til redigering IN
  // PLACE (ingen sletning af log-rækken, se onUpdateLoggedSet). editingSet
  // holder BÅDE øvelse- og sætnummer (ikke kun sætnummer), så en gemt
  // redigerings-tilstand aldrig ved et uheld matcher et andet sætnummer på
  // en anden øvelse, hvis kortet skifter øvelse mens redigeringen står åben.
  const [editingSet, setEditingSet] = useState(null) // { exerciseId, setNumber } | null
  const [editInput, setEditInput] = useState({ weight: '', reps: '' })
  const startEditingSet = (exerciseId, setNumber, log) => {
    setEditingSet({ exerciseId, setNumber })
    setEditInput({ weight: log.skipped ? '' : String(log.weight ?? ''), reps: log.skipped ? '' : String(log.reps_completed ?? '') })
  }

  // ORDRE 280 · commit 1 — når sættet ÅBNES (bliver "næste"), udfyldes vægt/
  // reps som en ægte værdi i input-state (ikke kun en visuel hint — ellers
  // ville et upåvirket "Godkendt"-tryk logge 0/tomt). Sidste gang på samme
  // øvelse vinder, ellers planens tal, ellers tomt (se setLogDefaults.js).
  // ORDRE 293 · F3: kører også igen når exerciseHistory er hentet (første
  // øvelse åbnes før historikken ankommer og fik ellers planens tal for
  // altid). autoFillSetInput rører aldrig et felt atleten selv har tastet/
  // trinnet (touchedRef) — kun et felt der stadig står som vores egen
  // forudfyldning byttes ud (autoFilledRef). Ikke logInputs i deps: ville
  // køre igen ved hver tastning.
  const autoFilledRef = useRef({})
  const touchedRef = useRef(new Set())
  useEffect(() => {
    if (!activeNext) return
    const { exercise: ex, setNumber } = activeNext
    const key = `${ex.id}_${setNumber}`
    const last = lastHeaviestSet(exerciseHistory, ex.name, todayStr)
    const repsPrescription = parseRepsPrescription(ex.reps)
    const repsIsEditable = repsPrescription.type !== 'fixed'
    const suggestion = ex.recommended_weight == null ? suggestNextWeight(ex.name, ex.intensity) : null
    const weightDefault = defaultSetWeight('', { lastWeight: last?.weight, recommendedWeight: ex.recommended_weight ?? suggestion?.weight })
    const repsDefaultValue = repsIsEditable
      ? defaultSetReps('', { lastReps: last?.reps, planReps: repsPrescription.type === 'range' ? repsPrescription.min : null })
      : ''
    const lastAuto = autoFilledRef.current[key]
    const touched = touchedRef.current.has(key)
    const decide = current => autoFillSetInput({ current, lastAuto, touched, weightDefault, repsDefault: repsDefaultValue })
    if (!decide(logInputs[key])) return
    autoFilledRef.current[key] = { weight: weightDefault, reps: repsDefaultValue }
    setLogInputs(p => { const next = decide(p[key]); return next ? { ...p, [key]: next } : p })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kør kun når sættet (øvelse+sætnummer) skifter eller historikken ankommer
  }, [activeNext?.exercise?.id, activeNext?.setNumber, exerciseHistory])

  if (!pas) return null

  // ORDRE 267 · commit 3 — rolig linje, ikke en mail/notifikation, ingen rød
  // farve: vises kun de sidste to dage af ugen, hvis ingen check-in er
  // logget den uge endnu (se shouldNudgeCheckin, src/checkinReminder.js).
  const nudge = checkinNudge && (
    <button
      type="button"
      onClick={checkinNudge.onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,234,226,0.08)', padding: '0 0 0.6rem', marginBottom: '0.85rem', cursor: 'pointer' }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#a9a69e' }}>
        Ugens check-in mangler stadig.
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.06em', color: '#c8923a', flexShrink: 0 }}>
        Log den →
      </span>
    </button>
  )

  if (pas.status !== 'open') {
    const up = pas.upcoming
    return (
      <div style={s.card}>
        {nudge}
        <div style={s.cardLabel}>Dagens pas</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '0.5rem' }}>
          {pas.status === 'done' ? 'Passet er færdigt. ✓' : 'Intet pas i dag.'}
        </div>
        {up ? (
          <button
            type="button"
            onClick={() => onOpenSession(up.session.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.13)', padding: '0.75rem', cursor: 'pointer' }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.3rem' }}>
              Næste: uge {up.week.week_number}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#edeae2' }}>{up.session.title}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginTop: '0.2rem' }}>
              {(up.session.exercises || []).map(e => e.name).join(' · ')}
            </div>
          </button>
        ) : (
          <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Der er ikke planlagt mere endnu.</div>
        )}
      </div>
    )
  }

  const { session, next } = pas
  if (!next) return null // alle sæt i "åbne" session logget i samme render — næste render finder den rigtige session
  const { exercise: ex, setNumber, totalSets } = next
  const key = `${ex.id}_${setNumber}`
  const input = logInputs[key] || { weight: '', note: '', rpe: '', reps: '' }
  const plannedRpe = parsePlannedRpe(ex.intensity)
  const repsPrescription = parseRepsPrescription(ex.reps)
  const repsIsEditable = repsPrescription.type !== 'fixed'
  const repsDefault = repsPrescription.type === 'range' ? String(repsPrescription.min) : ''
  const repsValue = input.reps || repsDefault
  const repsToLog = repsIsEditable ? repsValue : ex.reps
  const last = lastHeaviestSet(exerciseHistory, ex.name, todayStr)
  const suggestion = ex.recommended_weight == null ? suggestNextWeight(ex.name, ex.intensity) : null
  const sessionExercises = session.exercises || []
  const exIdx = sessionExercises.findIndex(e => e.id === ex.id)
  const nextExercise = exIdx >= 0 ? sessionExercises[exIdx + 1] || null : null
  const laterCount = exIdx >= 0 ? Math.max(0, sessionExercises.length - exIdx - 2) : 0
  const stepWeightBy = delta => { touchedRef.current.add(key); setLogInputs(p => ({ ...p, [key]: { ...(p[key] || input), weight: stepWeight(p[key]?.weight ?? input.weight, delta) } })) }
  const stepRepsBy = delta => { touchedRef.current.add(key); setLogInputs(p => stepRepsInInputs(p, key, input, repsValue, delta)) }

  // ORDRE 314 · blok 1 — sæt 1..setNumber-1 på DENNE øvelse er altid logget
  // (nextSetInSession finder det første ULOGGEDE sæt i rækkefølge, så der kan
  // ikke være huller foran "next"). Vises som kompakte linjer, ikke fulde felter.
  const priorSetNumbers = Array.from({ length: setNumber - 1 }, (_, i) => i + 1)
  const nextSetNumber = setNumber + 1
  const nextSetReps = repsIsEditable ? (last?.reps ?? (repsPrescription.type === 'range' ? repsPrescription.min : null)) : ex.reps
  const nextSetWeight = ex.recommended_weight ?? suggestion?.weight ?? last?.weight ?? null

  return (
    <div style={s.card}>
      {nudge}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={s.cardLabel}>Dagens pas</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#7a7770' }}>Sæt {setNumber}/{totalSets}</div>
      </div>

      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '0.25rem' }}>
        {ex.name}
      </div>
      {last && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
          Sidste gang: {last.weight}kg × {last.reps}{last.rpe ? ` @${last.rpe}` : ''}
        </div>
      )}
      {ex.recommended_weight != null ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', marginBottom: '0.5rem' }}>Anbefalet: {ex.recommended_weight}kg</div>
      ) : suggestion ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', marginBottom: '0.5rem' }}>
          Forslag: {suggestion.weight}kg <span style={{ color: '#7a7770' }}>(RPE {suggestion.fromRpe})</span>
        </div>
      ) : null}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.85rem' }}>
        {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
      </div>

      {/* ORDRE 314 · blok 1, rettet i ORDRE 320 · blok 1 — klarede sæt på DENNE
          øvelse: én kompakt linje pr. sæt (ikke fulde felter, det er
          forbeholdt det aktuelle sæt), med et "ret"-tryk der åbner sættet til
          redigering UDEN at slette log-rækken (se onUpdateLoggedSet/
          docs/KRITIK-314.md fund 1+3 — den gamle onUndoLastSet-genbrug slettede
          rækken, hvilket gjorde senere sæt "usynlige" for nextSetInSession). */}
      {priorSetNumbers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
          {priorSetNumbers.map(n => {
            const log = (exerciseLogs || []).find(l => l.exercise_id === ex.id && l.set_number === n)
            if (!log) return null
            const isEditingThis = editingSet && editingSet.exerciseId === ex.id && editingSet.setNumber === n
            if (isEditingThis) {
              return (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', marginBottom: '0.2rem', border: '1px solid rgba(200,146,58,0.25)', background: 'rgba(200,146,58,0.04)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#c8923a' }}>Retter sæt {n}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button" aria-label="2,5 kg mindre (ret)"
                      onClick={() => setEditInput(p => ({ ...p, weight: stepWeight(p.weight, -2.5) }))}
                      style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                    >−</button>
                    <input
                      aria-label={`Vægt, ret sæt ${n}`}
                      style={{ ...s.fieldInput, width: '80px', minWidth: '80px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0, textAlign: 'center' }}
                      type="text" inputMode="decimal" value={editInput.weight}
                      onChange={e => {
                        const v = e.target.value.replace(',', '.')
                        if (v === '' || /^\d*\.?\d*$/.test(v)) setEditInput(p => ({ ...p, weight: v }))
                      }}
                    />
                    <button
                      type="button" aria-label="2,5 kg mere (ret)"
                      onClick={() => setEditInput(p => ({ ...p, weight: stepWeight(p.weight, 2.5) }))}
                      style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                    >+</button>
                    {repsIsEditable && (
                      <>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9rem', color: '#c8923a' }}>×</span>
                        <button
                          type="button" aria-label="1 rep mindre (ret)"
                          onClick={() => setEditInput(p => ({ ...p, reps: stepReps(p.reps, -1) }))}
                          style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                        >−</button>
                        <input
                          aria-label={`Reps, ret sæt ${n}`}
                          style={{ ...s.fieldInput, width: '56px', minWidth: '56px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0, textAlign: 'center' }}
                          type="text" inputMode="numeric" value={editInput.reps}
                          onChange={e => {
                            const v = e.target.value
                            if (v === '' || /^\d*$/.test(v)) setEditInput(p => ({ ...p, reps: v }))
                          }}
                        />
                        <button
                          type="button" aria-label="1 rep mere (ret)"
                          onClick={() => setEditInput(p => ({ ...p, reps: stepReps(p.reps, 1) }))}
                          style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                        >+</button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      aria-label={`Godkendt, ret sæt ${n}`}
                      style={{ ...s.btnPrimary, flex: 1, minHeight: '44px', boxSizing: 'border-box' }}
                      onClick={async () => {
                        const ok = await onUpdateLoggedSet(ex.id, n, editInput)
                        if (ok) setEditingSet(null)
                      }}
                    >Godkendt</button>
                    <button
                      type="button"
                      aria-label={`Fortryd, ret sæt ${n}`}
                      style={{ ...s.btnGhost, minHeight: '44px', boxSizing: 'border-box' }}
                      onClick={() => setEditingSet(null)}
                    >Fortryd</button>
                  </div>
                </div>
              )
            }
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', color: '#7a7770' }}>
                <span>
                  Sæt {n}: {log.skipped ? 'Sprunget over' : `${log.weight}kg × ${log.reps_completed}${log.rpe_actual != null ? `, RPE ${log.rpe_actual}` : ''}`}
                </span>
                <button
                  type="button"
                  aria-label={`Ret sæt ${n}`}
                  disabled={editingSet != null}
                  onClick={() => startEditingSet(ex.id, n, log)}
                  style={{ background: 'none', border: 'none', color: '#4a4844', cursor: editingSet != null ? 'default' : 'pointer', opacity: editingSet != null ? 0.35 : 1, fontSize: '0.58rem', letterSpacing: '0.04em', padding: 0, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0 }}
                >ret</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ORDRE 314 · blok 1 (F4-rettelse) — vægt og reps/RPE står nu i to
          rækker i stedet for én flexWrap-række, der brækkede midt i
          reps-kontrollerne ved 360–390 px (se docs/KRITIK-288.md F4): fire
          44 px-trykflader + to felter kan ikke være på samme linje som RPE-
          mærkatet i en ~310 px kortflade uden at gå under 44 px, så hver
          feltgruppe holdes samlet på sin egen linje i stedet. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* ORDRE 280 · commit 1 — store plus/minus (2,5 kg / 1 rep) ved siden af
            felterne: en atlet med kridt på hænderne skal kunne justere uden at
            skulle ramme et lille tastatur. Feltet kan stadig tastes i (samme
            onChange som før), men skal ikke. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button" aria-label="2,5 kg mindre"
            onClick={() => stepWeightBy(-2.5)}
            style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
          >−</button>
          <input
            aria-label={`Vægt, sæt ${setNumber}`}
            style={{ ...s.fieldInput, width: '96px', minWidth: '96px', minHeight: '52px', boxSizing: 'border-box', flexShrink: 0, padding: '0.65rem 0.5rem', fontSize: '1.3rem', textAlign: 'center' }}
            type="text" inputMode="decimal" placeholder="kg" value={input.weight}
            onChange={e => {
              const v = e.target.value.replace(',', '.')
              if (v === '' || /^\d*\.?\d*$/.test(v)) { touchedRef.current.add(key); setLogInputs(p => ({ ...p, [key]: { ...p[key], weight: v } })) }
            }}
          />
          <button
            type="button" aria-label="2,5 kg mere"
            onClick={() => stepWeightBy(2.5)}
            style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
          >+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {repsIsEditable ? (
            <>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', color: '#c8923a' }}>×</span>
              <button
                type="button" aria-label="1 rep mindre"
                onClick={() => stepRepsBy(-1)}
                style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
              >−</button>
              <input
                aria-label={`Reps, sæt ${setNumber}`}
                style={{ ...s.fieldInput, width: '64px', minWidth: '64px', minHeight: '52px', boxSizing: 'border-box', flexShrink: 0, padding: '0.65rem 0.3rem', fontSize: '1.3rem', textAlign: 'center' }}
                type="text" inputMode="numeric" placeholder="reps" value={repsValue}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || /^\d*$/.test(v)) { touchedRef.current.add(key); setLogInputs(p => ({ ...p, [key]: { ...p[key], reps: v } })) }
                }}
              />
              <button
                type="button" aria-label="1 rep mere"
                onClick={() => stepRepsBy(1)}
                style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
              >+</button>
            </>
          ) : (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', color: '#c8923a', whiteSpace: 'nowrap' }}>× {ex.reps || '—'}</span>
          )}
          {plannedRpe != null && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770', letterSpacing: '0.06em', border: '1px solid rgba(237,234,226,0.13)', padding: '0.3rem 0.5rem', minHeight: '52px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>RPE {input.rpe || plannedRpe}</span>
          )}
        </div>
      </div>
      {/* ORDRE 280 · commit 2 — "Godkendt" er den mest gentagne handling i hele
          appen (ét tryk pr. sæt, hele træningen), derfor flex:1 og 60px høj —
          rammes med en tommelfinger nederst i kortet, også med handsker.
          Ingen dialog, ingen bekræftelse: gemmer sættet som det står med det
          samme (samme optimistiske onLogSet som før, se logDagensPasSet). */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
        <button
          style={{ ...s.btnPrimary, flex: 1, minHeight: '60px', boxSizing: 'border-box', fontSize: '0.85rem' }}
          onClick={() => onLogSet(ex, setNumber, totalSets, repsToLog, plannedRpe)}
        >Godkendt</button>
        <button
          style={{ ...s.btnGhost, minHeight: '60px', boxSizing: 'border-box', fontSize: '0.6rem' }}
          onClick={() => skipSet(ex.id, setNumber, plannedRpe)}
        >Spring over</button>
      </div>
      {/* Fortryd — kun mens man ikke har forladt øvelsen: næste sæt i kortet
          skal stadig høre til den øvelse man lige loggede et sæt på. */}
      {lastLoggedSet && lastLoggedSet.exerciseId === ex.id && (
        <button
          type="button"
          onClick={() => onUndoLastSet(lastLoggedSet.exerciseId, lastLoggedSet.setNumber)}
          style={{ ...s.btnGhost, marginTop: '0.5rem', width: '100%', minHeight: '44px', boxSizing: 'border-box', fontSize: '0.56rem', color: '#7a7770' }}
        >↺ Fortryd sidste sæt</button>
      )}
      {pendingSyncCount > 0 && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#7a7770', marginTop: '0.5rem', textAlign: 'center' }}>
          ☁ {pendingSyncCount} {pendingSyncCount === 1 ? 'sæt' : 'sæt'} gemt lokalt — sendes når forbindelsen er tilbage
        </div>
      )}

      {/* ORDRE 314 · blok 1 — "næste sæt" er højst ÉN dæmpet linje, aldrig med
          felter (dem har kun det aktuelle sæt), og kan slås fra her (se
          nextSetPreview.js). Vises kun når der faktisk ER et næste sæt på
          DENNE øvelse. */}
      {nextSetNumber <= totalSets && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.6rem' }}>
          {showNextPreview ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', letterSpacing: '0.02em' }}>
              Næste: {nextSetReps || '—'} reps{nextSetWeight != null ? ` @ ${nextSetWeight} kg` : ''}
            </div>
          ) : <span />}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', flexShrink: 0, minHeight: '44px', boxSizing: 'border-box' }}>
            <input
              type="checkbox" checked={showNextPreview}
              onChange={e => { setShowNextPreview(e.target.checked); saveShowNextSetPreview(e.target.checked) }}
              style={{ accentColor: '#c8923a', width: '13px', height: '13px' }}
            />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>Vis næste sæt</span>
          </label>
        </div>
      )}

      {/* ORDRE 330 · blok 2 — forsiden skal være rolig: "Resten af passet"
          (en liste over alle øvrige øvelser) er skåret ned til ÉN linje om
          den næste øvelse efter denne. Hele passet ligger i Program-fanen. */}
      {nextExercise && (
        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(237,234,226,0.07)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#7a7770', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Næste øvelse: <span style={{ color: '#b8b4a8' }}>{nextExercise.name}</span>
          {[nextExercise.sets && ` · ${nextExercise.sets} sæt`, nextExercise.reps && ` × ${nextExercise.reps}`].filter(Boolean).join('')}
          {laterCount > 0 ? ` (+${laterCount})` : ''}
        </div>
      )}
    </div>
  )
}

// ORDRE 263 · commit 2 — pausen der starter af sig selv når et sæt logges
// (se logSet). Samme tidsstempel-baserede mønster som ProgramTab.jsx's
// ExerciseTimer (remainingSeconds, genberegning ved visibilitychange, ALDRIG
// "s => s - 1" pr. tick, se verify:athlete-rest-timer-drift) — kun
// starttidspunkt + varighed er sandheden, så pausen ikke driver eller
// springer hvis skærmen slukkes eller fanen lukkes midt i den (restPause.js
// persisterer dem, uafhængigt af om komponentet selv overlever).
//
// ORDRE 280 · commit 3 — flyttet ud af DagensPasCard og fastgjort nederst på
// skærmen (over bundnavigationen): en rolig linje, ikke et stort ur, der
// bliver ved med at være synlig når man ruller væk fra kortet, og siger
// hvilket sæt der er næste — uden at stjæle plads fra "Godkendt"-knappen i
// kortet (helt separat element, egen position).
function RestPauseFooter({ athleteId, pause, onClear, nextLabel }) {
  const [liveSeconds, setLiveSeconds] = useState(() => remainingSeconds(pause.durationSeconds, pause.startedAt))

  useEffect(() => {
    const recompute = () => setLiveSeconds(remainingSeconds(pause.durationSeconds, pause.startedAt))
    recompute()
    const id = setInterval(recompute, 250)
    const onVisible = () => { if (document.visibilityState === 'visible') recompute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [pause.startedAt, pause.durationSeconds])

  const done = liveSeconds <= 0
  const frac = pause.durationSeconds > 0 ? Math.max(0, Math.min(1, liveSeconds / pause.durationSeconds)) : 0
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: '54px', zIndex: 90, background: '#141410', borderTop: `1px solid ${done ? 'rgba(108,186,108,0.25)' : 'rgba(200,146,58,0.2)'}` }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: done ? '#6cba6c' : '#c8923a', whiteSpace: 'nowrap' }}>
          {done ? 'Pause slut' : 'Pause'}{pause.label ? ` · ${pause.label}` : ''}
        </span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', lineHeight: 1, whiteSpace: 'nowrap' }}>{done ? '✓' : `${liveSeconds}s`}</span>
        {nextLabel && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {nextLabel}
          </span>
        )}
        <button
          type="button"
          aria-label="Skjul pausetimer"
          onClick={() => { clearRestPause(athleteId); onClear() }}
          style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.75rem', minWidth: '32px', minHeight: '32px', flexShrink: 0 }}
        >✕</button>
      </div>
      {!done && (
        <div style={{ height: '2px', background: 'rgba(237,234,226,0.08)' }}>
          <div style={{ height: '100%', width: `${frac * 100}%`, background: '#c8923a', transition: 'width 1s linear' }} />
        </div>
      )}
    </div>
  )
}

// Søjlediagram over ugentlig tonnage (sum af vægt × reps pr. uge, seneste ~10
// uger). Seneste uge fremhæves; første/største/seneste søjle får værdi-label.
function WeeklyTonnageChart({ data }) {
  if (!data || data.length < 2) return null
  const W = 400, H = 120, PL = 6, PR = 6, PT = 16, PB = 18
  const max = Math.max(...data.map(d => d.total))
  if (!max) return null
  const bw = (W - PL - PR) / data.length
  const mono = 'IBM Plex Mono,monospace'
  const fmt = t => t >= 10000 ? `${Math.round(t / 1000)}t` : t >= 1000 ? `${(t / 1000).toFixed(1).replace('.', ',')}t` : `${Math.round(t)}`
  const maxIdx = data.findIndex(d => d.total === max)
  const labelIs = new Set([0, maxIdx, data.length - 1])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.08)" strokeWidth="1" />
      {data.map((d, i) => {
        const h = (d.total / max) * (H - PT - PB)
        const x = PL + i * bw
        const last = i === data.length - 1
        return (
          <g key={d.weekStart}>
            <rect x={x + bw * 0.18} y={H - PB - h} width={bw * 0.64} height={Math.max(h, 1.5)}
              fill={last ? '#c8923a' : 'rgba(200,146,58,0.35)'} />
            {labelIs.has(i) && (
              <text x={x + bw / 2} y={H - PB - h - 4} textAnchor="middle" fontSize="7.5"
                fill={last ? '#edeae2' : '#7a7770'} fontFamily={mono}>{fmt(d.total)}</text>
            )}
            {(i === 0 || last) && (
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="7"
                fill="#4a4844" fontFamily={mono}>{d.weekStart.slice(5).replace('-', '/')}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Multi-linje graf over ugentligt bedste e1RM (Epley: vægt × (1 + reps/30))
// pr. hovedløft. Svarer på "bliver jeg stærkere?" direkte på forsiden.
function E1RMChart({ series }) {
  const drawn = series.filter(sr => sr.points.length >= 2)
  if (!drawn.length) return null
  const W = 400, H = 150, PL = 8, PR = 40, PT = 10, PB = 16
  const allKeys = [...new Set(drawn.flatMap(sr => sr.points.map(p => p.weekStart)))].sort()
  if (allKeys.length < 2) return null
  const allVals = drawn.flatMap(sr => sr.points.map(p => p.val))
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const range = (maxV - minV) || 1
  const x = k => PL + (allKeys.indexOf(k) / (allKeys.length - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - minV) / range) * (H - PT - PB)
  const mono = 'IBM Plex Mono,monospace'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.08)" strokeWidth="1" />
      {drawn.map(sr => {
        const pts = sr.points.map(p => `${x(p.weekStart).toFixed(1)},${y(p.val).toFixed(1)}`).join(' ')
        const last = sr.points[sr.points.length - 1]
        return (
          <g key={sr.label}>
            <polyline points={pts} fill="none" stroke={sr.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            {sr.points.map(p => <circle key={p.weekStart} cx={x(p.weekStart)} cy={y(p.val)} r="2" fill={sr.color} />)}
            <text x={x(last.weekStart) + 5} y={y(last.val) + 3} fontSize="7.5" fill={sr.color} fontFamily={mono}>
              {Math.round(last.val)}
            </text>
          </g>
        )
      })}
      {[allKeys[0], allKeys[allKeys.length - 1]].map((k, i) => (
        <text key={k} x={x(k)} y={H - 4} textAnchor={i === 0 ? 'start' : 'end'} fontSize="7" fill="#4a4844" fontFamily={mono}>
          {k.slice(5).replace('-', '/')}
        </text>
      ))}
    </svg>
  )
}

// ORDRE 100 commit 2: lille, stille 14-dages parathedskurve — samme
// visuelle sprog som E1RMChart ovenfor (én linje, ingen akser med tal ud
// over min og max). Bruges udelukkende på dagens gemte log.
function ReadinessSparkline({ points }) {
  if (points.length < 2) return null
  const W = 400, H = 70, PL = 22, PR = 4, PT = 8, PB = 4
  const vals = points.map(p => p.score)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = (maxV - minV) || 1
  const mono = 'IBM Plex Mono,monospace'
  const x = i => PL + (i / (points.length - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - minV) / range) * (H - PT - PB)
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '0.25rem 0' }}>
      <text x={PL - 3} y={PT + 5} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily={mono}>{Math.round(maxV)}</text>
      <text x={PL - 3} y={H - PB} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily={mono}>{Math.round(minV)}</text>
      <polyline points={pts} fill="none" stroke="#c8923a" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.score)} r={i === points.length - 1 ? 3.5 : 2} fill={i === points.length - 1 ? '#edeae2' : '#c8923a'} />
      ))}
    </svg>
  )
}

const LOCAL_FOODS = [
  // Mejeri
  { name: 'Mælk minimælk', kcal100: 42, protein100: 3, carb100: 5, fat100: 1 },
  { name: 'Mælk letmælk', kcal100: 47, protein100: 3, carb100: 5, fat100: 2 },
  { name: 'Mælk sødmælk', kcal100: 61, protein100: 3, carb100: 5, fat100: 4 },
  { name: 'Havremælk', kcal100: 45, protein100: 1, carb100: 7, fat100: 2 },
  { name: 'Sojamælk', kcal100: 33, protein100: 3, carb100: 1, fat100: 2 },
  { name: 'Skyr naturel', kcal100: 63, protein100: 11, carb100: 4, fat100: 0 },
  { name: 'Skyr vanilje', kcal100: 75, protein100: 8, carb100: 10, fat100: 0 },
  { name: 'Græsk yoghurt 0%', kcal100: 57, protein100: 10, carb100: 4, fat100: 0 },
  { name: 'Græsk yoghurt 2%', kcal100: 73, protein100: 10, carb100: 4, fat100: 2 },
  { name: 'Yoghurt naturel', kcal100: 61, protein100: 4, carb100: 5, fat100: 3 },
  { name: 'A38', kcal100: 45, protein100: 4, carb100: 5, fat100: 1 },
  { name: 'Kvark naturel', kcal100: 67, protein100: 12, carb100: 4, fat100: 1 },
  { name: 'Cottage cheese', kcal100: 98, protein100: 11, carb100: 3, fat100: 4 },
  { name: 'Hytteost', kcal100: 98, protein100: 11, carb100: 3, fat100: 4 },
  { name: 'Ost 45+', kcal100: 358, protein100: 26, carb100: 0, fat100: 28 },
  { name: 'Ost 30+', kcal100: 295, protein100: 28, carb100: 0, fat100: 20 },
  { name: 'Mozzarella', kcal100: 280, protein100: 18, carb100: 2, fat100: 22 },
  { name: 'Feta', kcal100: 264, protein100: 14, carb100: 4, fat100: 22 },
  { name: 'Parmesan', kcal100: 431, protein100: 38, carb100: 3, fat100: 29 },
  { name: 'Flødeost', kcal100: 250, protein100: 7, carb100: 3, fat100: 24 },
  { name: 'Cremefraiche 9%', kcal100: 118, protein100: 3, carb100: 4, fat100: 9 },
  { name: 'Cremefraiche 18%', kcal100: 180, protein100: 3, carb100: 4, fat100: 18 },
  { name: 'Piskefløde', kcal100: 357, protein100: 2, carb100: 3, fat100: 38 },
  { name: 'Smør', kcal100: 717, protein100: 1, carb100: 1, fat100: 81 },
  { name: 'Kakaomælk', kcal100: 70, protein100: 3, carb100: 12, fat100: 1 },
  // Æg
  { name: 'Æg helt', kcal100: 143, protein100: 13, carb100: 1, fat100: 10 },
  { name: 'Æggehvide', kcal100: 52, protein100: 11, carb100: 1, fat100: 0 },
  { name: 'Æggeblomme', kcal100: 322, protein100: 16, carb100: 1, fat100: 28 },
  // Kød
  { name: 'Kyllingebryst', kcal100: 110, protein100: 23, carb100: 0, fat100: 2 },
  { name: 'Kyllingelår u/skind', kcal100: 150, protein100: 19, carb100: 0, fat100: 8 },
  { name: 'Kyllingelår m/skind', kcal100: 177, protein100: 18, carb100: 0, fat100: 12 },
  { name: 'Kylling hel', kcal100: 155, protein100: 18, carb100: 0, fat100: 9 },
  { name: 'Kalkun', kcal100: 135, protein100: 22, carb100: 0, fat100: 5 },
  { name: 'Hakket oksekød 8%', kcal100: 172, protein100: 20, carb100: 0, fat100: 10 },
  { name: 'Hakket oksekød 15%', kcal100: 215, protein100: 18, carb100: 0, fat100: 16 },
  { name: 'Hakket oksekød 20%', kcal100: 250, protein100: 17, carb100: 0, fat100: 20 },
  { name: 'Bøf/oksefilet', kcal100: 150, protein100: 22, carb100: 0, fat100: 7 },
  { name: 'Oksemørbrad', kcal100: 158, protein100: 26, carb100: 0, fat100: 6 },
  { name: 'Hakket svinekød', kcal100: 195, protein100: 17, carb100: 0, fat100: 14 },
  { name: 'Svinekam', kcal100: 135, protein100: 22, carb100: 0, fat100: 5 },
  { name: 'Nakkefilet svin', kcal100: 220, protein100: 18, carb100: 0, fat100: 16 },
  { name: 'Svinekød mørbrad', kcal100: 121, protein100: 22, carb100: 0, fat100: 4 },
  { name: 'Lammekød', kcal100: 212, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Bacon', kcal100: 417, protein100: 13, carb100: 1, fat100: 42 },
  { name: 'Skinke mager', kcal100: 107, protein100: 18, carb100: 1, fat100: 3 },
  { name: 'Leverpostej', kcal100: 281, protein100: 10, carb100: 5, fat100: 25 },
  { name: 'Medisterpølse', kcal100: 336, protein100: 13, carb100: 3, fat100: 30 },
  { name: 'Pølse grillpølse', kcal100: 290, protein100: 11, carb100: 3, fat100: 26 },
  { name: 'Pølse wienerpølse', kcal100: 270, protein100: 11, carb100: 2, fat100: 24 },
  // Fisk og skaldyr
  { name: 'Laks fersk', kcal100: 206, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Laks røget', kcal100: 185, protein100: 23, carb100: 0, fat100: 10 },
  { name: 'Tun i vand', kcal100: 103, protein100: 23, carb100: 0, fat100: 1 },
  { name: 'Tun i olie', kcal100: 185, protein100: 22, carb100: 0, fat100: 10 },
  { name: 'Torsk', kcal100: 82, protein100: 18, carb100: 0, fat100: 1 },
  { name: 'Tilapia', kcal100: 96, protein100: 20, carb100: 0, fat100: 2 },
  { name: 'Rødspætte', kcal100: 91, protein100: 18, carb100: 0, fat100: 2 },
  { name: 'Hellefisk', kcal100: 116, protein100: 21, carb100: 0, fat100: 3 },
  { name: 'Makrel i tomat', kcal100: 170, protein100: 14, carb100: 4, fat100: 11 },
  { name: 'Makrel røget', kcal100: 305, protein100: 19, carb100: 0, fat100: 25 },
  { name: 'Sild marineret', kcal100: 190, protein100: 12, carb100: 5, fat100: 14 },
  { name: 'Sardiner i olie', kcal100: 208, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Rejer', kcal100: 85, protein100: 18, carb100: 1, fat100: 1 },
  { name: 'Blæksprutte', kcal100: 82, protein100: 15, carb100: 3, fat100: 1 },
  // Korn og brød
  { name: 'Havregryn', kcal100: 370, protein100: 13, carb100: 58, fat100: 7 },
  { name: 'Havregrød kogt', kcal100: 68, protein100: 2, carb100: 12, fat100: 1 },
  { name: 'Rugbrød', kcal100: 220, protein100: 8, carb100: 40, fat100: 3 },
  { name: 'Franskbrød', kcal100: 265, protein100: 9, carb100: 50, fat100: 3 },
  { name: 'Grovbrød', kcal100: 230, protein100: 9, carb100: 42, fat100: 3 },
  { name: 'Knækbrød', kcal100: 330, protein100: 10, carb100: 65, fat100: 4 },
  { name: 'Tortilla wrap', kcal100: 290, protein100: 8, carb100: 50, fat100: 6 },
  { name: 'Pasta tør', kcal100: 352, protein100: 13, carb100: 70, fat100: 2 },
  { name: 'Pasta kogt', kcal100: 131, protein100: 5, carb100: 25, fat100: 1 },
  { name: 'Fuldkornspasta kogt', kcal100: 124, protein100: 5, carb100: 25, fat100: 1 },
  { name: 'Ris tør', kcal100: 361, protein100: 7, carb100: 79, fat100: 1 },
  { name: 'Ris kogt', kcal100: 130, protein100: 3, carb100: 28, fat100: 0 },
  { name: 'Fuldkornsris kogt', kcal100: 140, protein100: 3, carb100: 29, fat100: 1 },
  { name: 'Brune ris kogte', kcal100: 111, protein100: 3, carb100: 23, fat100: 1 },
  { name: 'Quinoa kogt', kcal100: 120, protein100: 4, carb100: 21, fat100: 2 },
  { name: 'Bulgur kogt', kcal100: 83, protein100: 3, carb100: 19, fat100: 0 },
  { name: 'Couscous kogt', kcal100: 112, protein100: 4, carb100: 23, fat100: 0 },
  { name: 'Boghvede kogt', kcal100: 92, protein100: 3, carb100: 20, fat100: 1 },
  { name: 'Cornflakes', kcal100: 357, protein100: 7, carb100: 84, fat100: 1 },
  { name: 'Müsli uden sukker', kcal100: 350, protein100: 10, carb100: 58, fat100: 7 },
  { name: 'Müsli med sukker', kcal100: 380, protein100: 9, carb100: 68, fat100: 7 },
  { name: 'Hvedemel', kcal100: 341, protein100: 11, carb100: 72, fat100: 1 },
  { name: 'Speltmel', kcal100: 338, protein100: 14, carb100: 68, fat100: 2 },
  // Grøntsager
  { name: 'Kartofler kogte', kcal100: 87, protein100: 2, carb100: 19, fat100: 0 },
  { name: 'Søde kartofler', kcal100: 86, protein100: 2, carb100: 20, fat100: 0 },
  { name: 'Broccoli', kcal100: 34, protein100: 3, carb100: 7, fat100: 0 },
  { name: 'Blomkål', kcal100: 25, protein100: 2, carb100: 5, fat100: 0 },
  { name: 'Rosenkål', kcal100: 43, protein100: 3, carb100: 9, fat100: 0 },
  { name: 'Grønkål', kcal100: 49, protein100: 4, carb100: 9, fat100: 1 },
  { name: 'Spinat', kcal100: 23, protein100: 3, carb100: 4, fat100: 0 },
  { name: 'Rucola', kcal100: 25, protein100: 3, carb100: 4, fat100: 0 },
  { name: 'Salat iceberg', kcal100: 14, protein100: 1, carb100: 2, fat100: 0 },
  { name: 'Gulerod', kcal100: 41, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Tomat', kcal100: 18, protein100: 1, carb100: 4, fat100: 0 },
  { name: 'Agurk', kcal100: 12, protein100: 1, carb100: 2, fat100: 0 },
  { name: 'Peberfrugt rød', kcal100: 31, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Peberfrugt gul', kcal100: 27, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Løg', kcal100: 40, protein100: 1, carb100: 9, fat100: 0 },
  { name: 'Hvidløg', kcal100: 149, protein100: 6, carb100: 33, fat100: 0 },
  { name: 'Champignon', kcal100: 22, protein100: 3, carb100: 3, fat100: 0 },
  { name: 'Grønne bønner', kcal100: 31, protein100: 2, carb100: 7, fat100: 0 },
  { name: 'Ærter frosne', kcal100: 81, protein100: 5, carb100: 14, fat100: 0 },
  { name: 'Majs kogt', kcal100: 86, protein100: 3, carb100: 19, fat100: 1 },
  { name: 'Hvidkål', kcal100: 25, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Asparges', kcal100: 20, protein100: 2, carb100: 4, fat100: 0 },
  { name: 'Rødbede kogte', kcal100: 44, protein100: 2, carb100: 10, fat100: 0 },
  { name: 'Squash', kcal100: 17, protein100: 1, carb100: 3, fat100: 0 },
  { name: 'Aubergine', kcal100: 25, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Selleri', kcal100: 16, protein100: 1, carb100: 3, fat100: 0 },
  { name: 'Porre', kcal100: 31, protein100: 2, carb100: 7, fat100: 0 },
  { name: 'Avokado', kcal100: 160, protein100: 2, carb100: 9, fat100: 15 },
  { name: 'Kikærter kogte', kcal100: 164, protein100: 9, carb100: 27, fat100: 3 },
  { name: 'Linser kogte', kcal100: 116, protein100: 9, carb100: 20, fat100: 0 },
  { name: 'Bønner kidney', kcal100: 127, protein100: 9, carb100: 23, fat100: 0 },
  { name: 'Sorte bønner kogte', kcal100: 132, protein100: 9, carb100: 24, fat100: 0 },
  // Frugt
  { name: 'Banan', kcal100: 89, protein100: 1, carb100: 23, fat100: 0 },
  { name: 'Æble', kcal100: 52, protein100: 0, carb100: 14, fat100: 0 },
  { name: 'Appelsin', kcal100: 47, protein100: 1, carb100: 12, fat100: 0 },
  { name: 'Pære', kcal100: 57, protein100: 0, carb100: 15, fat100: 0 },
  { name: 'Drue', kcal100: 69, protein100: 1, carb100: 18, fat100: 0 },
  { name: 'Jordbær', kcal100: 32, protein100: 1, carb100: 8, fat100: 0 },
  { name: 'Blåbær', kcal100: 57, protein100: 1, carb100: 14, fat100: 0 },
  { name: 'Hindbær', kcal100: 52, protein100: 1, carb100: 12, fat100: 1 },
  { name: 'Kirsebær', kcal100: 63, protein100: 1, carb100: 16, fat100: 0 },
  { name: 'Mango', kcal100: 60, protein100: 1, carb100: 15, fat100: 0 },
  { name: 'Ananas', kcal100: 50, protein100: 1, carb100: 13, fat100: 0 },
  { name: 'Vandmelon', kcal100: 30, protein100: 1, carb100: 8, fat100: 0 },
  { name: 'Melon', kcal100: 36, protein100: 1, carb100: 9, fat100: 0 },
  { name: 'Kiwi', kcal100: 61, protein100: 1, carb100: 15, fat100: 1 },
  { name: 'Grapefrugt', kcal100: 42, protein100: 1, carb100: 11, fat100: 0 },
  { name: 'Fersken', kcal100: 39, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Blommer', kcal100: 46, protein100: 1, carb100: 11, fat100: 0 },
  // Nødder og frø
  { name: 'Mandler', kcal100: 579, protein100: 21, carb100: 22, fat100: 50 },
  { name: 'Valnødder', kcal100: 654, protein100: 15, carb100: 14, fat100: 65 },
  { name: 'Cashewnødder', kcal100: 553, protein100: 18, carb100: 30, fat100: 44 },
  { name: 'Pistacienødder', kcal100: 562, protein100: 20, carb100: 28, fat100: 45 },
  { name: 'Hasselnødder', kcal100: 628, protein100: 15, carb100: 17, fat100: 61 },
  { name: 'Peanuts', kcal100: 567, protein100: 26, carb100: 16, fat100: 49 },
  { name: 'Peanutbutter', kcal100: 588, protein100: 25, carb100: 20, fat100: 50 },
  { name: 'Mandelsmør', kcal100: 614, protein100: 21, carb100: 19, fat100: 56 },
  { name: 'Solsikkekerner', kcal100: 584, protein100: 21, carb100: 20, fat100: 51 },
  { name: 'Græskarkerner', kcal100: 559, protein100: 30, carb100: 11, fat100: 49 },
  { name: 'Chiafrø', kcal100: 486, protein100: 17, carb100: 42, fat100: 31 },
  { name: 'Hørfrø', kcal100: 534, protein100: 18, carb100: 29, fat100: 42 },
  { name: 'Sesamfrø', kcal100: 573, protein100: 17, carb100: 23, fat100: 50 },
  // Fedt og olier
  { name: 'Olivenolie', kcal100: 884, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Rapsolie', kcal100: 884, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Kokosolie', kcal100: 862, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Kokosmælk', kcal100: 230, protein100: 2, carb100: 6, fat100: 24 },
  // Protein og kosttilskud
  { name: 'Proteinpulver whey', kcal100: 380, protein100: 75, carb100: 8, fat100: 5 },
  { name: 'Proteinpulver kasein', kcal100: 370, protein100: 78, carb100: 6, fat100: 4 },
  { name: 'Planteprotein', kcal100: 370, protein100: 70, carb100: 10, fat100: 5 },
  { name: 'Proteinbar', kcal100: 350, protein100: 30, carb100: 35, fat100: 10 },
  { name: 'Proteinshake færdig', kcal100: 50, protein100: 6, carb100: 4, fat100: 1 },
  // Drikkevarer
  { name: 'Appelsinjuice', kcal100: 45, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Smoothie frugt', kcal100: 55, protein100: 1, carb100: 13, fat100: 0 },
  { name: 'Sportsdrik', kcal100: 25, protein100: 0, carb100: 6, fat100: 0 },
  // Saucer og tilbehør
  { name: 'Hummus', kcal100: 166, protein100: 8, carb100: 14, fat100: 10 },
  { name: 'Mayo', kcal100: 680, protein100: 1, carb100: 2, fat100: 75 },
  { name: 'Soja sauce', kcal100: 53, protein100: 8, carb100: 5, fat100: 0 },
  { name: 'Ketchup', kcal100: 100, protein100: 1, carb100: 24, fat100: 0 },
  { name: 'Honning', kcal100: 304, protein100: 0, carb100: 82, fat100: 0 },
  { name: 'Syltetøj', kcal100: 250, protein100: 0, carb100: 65, fat100: 0 },
  // Snacks og sødt
  { name: 'Havrebar', kcal100: 380, protein100: 8, carb100: 62, fat100: 12 },
  { name: 'Mørk chokolade 70%', kcal100: 546, protein100: 5, carb100: 46, fat100: 38 },
  { name: 'Mælkechokolade', kcal100: 535, protein100: 8, carb100: 57, fat100: 30 },
  { name: 'Hvid chokolade', kcal100: 539, protein100: 6, carb100: 60, fat100: 30 },
  { name: 'Nøddecreme (nutella)', kcal100: 539, protein100: 6, carb100: 58, fat100: 31 },
  { name: 'Riskager naturel', kcal100: 385, protein100: 8, carb100: 82, fat100: 3 },
  { name: 'Popcorn luftpoppet', kcal100: 375, protein100: 11, carb100: 74, fat100: 4 },
  { name: 'Chips', kcal100: 536, protein100: 7, carb100: 53, fat100: 34 },
  { name: 'Kiks/digestive', kcal100: 480, protein100: 7, carb100: 65, fat100: 21 },
  { name: 'Sukker', kcal100: 400, protein100: 0, carb100: 100, fat100: 0 },
  { name: 'Ahornsirup', kcal100: 260, protein100: 0, carb100: 67, fat100: 0 },
  // Planteprodukter
  { name: 'Tofu fast', kcal100: 76, protein100: 8, carb100: 2, fat100: 4 },
  { name: 'Tofu silke', kcal100: 55, protein100: 5, carb100: 2, fat100: 3 },
  { name: 'Edamame bønner', kcal100: 121, protein100: 11, carb100: 9, fat100: 5 },
  { name: 'Seitan', kcal100: 120, protein100: 25, carb100: 4, fat100: 2 },
  { name: 'Tempeh', kcal100: 193, protein100: 19, carb100: 9, fat100: 11 },
  // Færdigretter og street food
  { name: 'Kebabkød', kcal100: 220, protein100: 18, carb100: 2, fat100: 16 },
  { name: 'Falafel', kcal100: 333, protein100: 13, carb100: 32, fat100: 18 },
  { name: 'Pizza (gennemsnit)', kcal100: 266, protein100: 11, carb100: 33, fat100: 10 },
  // Tilbehør og krydderier
  { name: 'Sennep', kcal100: 60, protein100: 4, carb100: 6, fat100: 3 },
  { name: 'Remoulade', kcal100: 328, protein100: 1, carb100: 13, fat100: 30 },
  { name: 'Dressing let', kcal100: 90, protein100: 1, carb100: 12, fat100: 4 },
  { name: 'Dressing normal', kcal100: 330, protein100: 1, carb100: 8, fat100: 32 },
  { name: 'Pesto', kcal100: 430, protein100: 6, carb100: 7, fat100: 43 },
  { name: 'Tomatpuré', kcal100: 82, protein100: 4, carb100: 16, fat100: 0 },
  { name: 'Salsa', kcal100: 36, protein100: 2, carb100: 7, fat100: 0 },
  // Dansk klassisk tilbehør
  { name: 'Rødkål', kcal100: 92, protein100: 1, carb100: 22, fat100: 0 },
  { name: 'Agurkesalat', kcal100: 20, protein100: 1, carb100: 4, fat100: 0 },
  { name: 'Kartoffelmos', kcal100: 95, protein100: 2, carb100: 17, fat100: 3 },
  // Drikkevarer udvidet
  { name: 'Proteinmælk', kcal100: 42, protein100: 6, carb100: 3, fat100: 1 },
  { name: 'Kaffe sort', kcal100: 2, protein100: 0, carb100: 0, fat100: 0 },
  { name: 'Te uden sukker', kcal100: 1, protein100: 0, carb100: 0, fat100: 0 },
  { name: 'Cola', kcal100: 42, protein100: 0, carb100: 11, fat100: 0 },
  { name: 'Cola zero', kcal100: 0, protein100: 0, carb100: 0, fat100: 0 },
]

const NAV_ITEMS = [
  {
    key: 'hjem',
    label: 'Hjem',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 2l9 7.5V21H15v-7H9v7H3V9.5z" />
      </svg>
    ),
  },
  {
    key: 'program',
    label: 'Program',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="6" y1="12" x2="18" y2="12" />
        <rect x="3" y="8.5" width="3" height="7" rx="1" />
        <rect x="18" y="8.5" width="3" height="7" rx="1" />
        <line x1="1" y1="10" x2="1" y2="14" />
        <line x1="23" y1="10" x2="23" y2="14" />
      </svg>
    ),
  },
  {
    key: 'volumen',
    label: 'Volumen',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="20" y2="21" />
        <rect x="5.5" y="13" width="3" height="8" />
        <rect x="10.5" y="8" width="3" height="13" />
        <rect x="15.5" y="4" width="3" height="17" />
      </svg>
    ),
  },
  {
    key: 'fremgang',
    label: 'Fremgang',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 17 9 11 13 15 21 5" />
        <polyline points="15 5 21 5 21 11" />
      </svg>
    ),
  },
  {
    key: 'kost',
    label: 'Kost',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M3 2v5a3 3 0 0 0 6 0V2" />
        <line x1="6" y1="7" x2="6" y2="22" />
        <line x1="21" y1="2" x2="21" y2="22" />
        <path d="M17 2a4 4 0 0 1 4 4" />
      </svg>
    ),
  },
  {
    key: 'mobilisering',
    label: 'Mobilitet',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    ),
  },
  {
    key: 'beskeder',
    label: 'Beskeder',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: 'stævnedag',
    label: 'Stævne',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
]

// Indlæses via LazyBoundary (ordre 232 · commit 2), samme mønster som Dashboard.jsx's fire faner.
const mobiliseringFactory = () => import('./athlete/MobiliseringTab')
const staevnedagFactory = () => import('./athlete/StaevnedagTab')
const programFactory = () => import('./athlete/ProgramTab')
// ORDRE 259 · commit 1: samme lazy-chunk-mønster, ny fane.
const volumenFactory = () => import('./athlete/VolumenTab')
// ORDRE 284 · commit 1: samme lazy-chunk-mønster, ny fane.
const fremgangFactory = () => import('./athlete/FremgangTab')
const kostFactory = () => import('./athlete/KostTab')
const beskederFactory = () => import('./athlete/BeskederTab')
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

export default function AthleteView({ session, onExitPreview, role, coachAthleteId, onRecheckRole }) {
  const [tab, setTab] = useState('hjem')
  const [recheckingRole, setRecheckingRole] = useState(false)
  const [recheckMsg, setRecheckMsg] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  // Undgår setState efter unmount: lykkes genopslaget og rollen bliver
  // 'coach', skifter App.jsx denne gren ud med Dashboard FØR onRecheckRole's
  // promise resolver — komponentet er da allerede væk.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])
  async function handleRecheckRole() {
    setRecheckingRole(true); setRecheckMsg('')
    await onRecheckRole?.()
    if (!mountedRef.current) return
    setRecheckingRole(false)
    setRecheckMsg('Din konto er registreret som atlet — ingen coach-adgang fundet.')
  }
  const [athlete, setAthlete] = useState(null)
  // ORDRE 263 · commit 2: den automatiske pause mellem sæt (null = ingen
  // aktiv pause). Se restPause.js.
  const [restPause, setRestPause] = useState(null)
  // ORDRE 280 · commit 4: antal sæt der ligger lokalt og venter på net (se
  // offlineSetQueue.js). Kun til "Dagens pas"-kortets linje — Program-fanens
  // Log-knap er urørt.
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const athleteVideoCoachRef = useRef(null)
  const athleteVideoCoachFrameRef = useRef(null)
  const athleteVideoCoachClientsRef = useRef(new Set())
  // ORDRE 61 · commit 2: aktive upload-and-go-forsøg, keyet på requestId, så
  // en abort-upload-besked fra VideoCoach kan afbryde netop DEN overførsel.
  const athleteVideoUploadAbortsRef = useRef(new Map())
  const [athleteVideoCoachOpen, setAthleteVideoCoachOpen] = useState(false)
  // ORDRE 262 · commit 1: "Film et sæt" åbner det SAMME VideoCoach-værktøj,
  // men i et instant-flow (?instant=1) der ikke autosender - se videocoach.html.
  const [athleteVideoCoachInstant, setAthleteVideoCoachInstant] = useState(false)
  const [sharedVideoAnalyses, setSharedVideoAnalyses] = useState([])
  const [sharedVideoLoading, setSharedVideoLoading] = useState(false)
  const [sharedVideoError, setSharedVideoError] = useState(null)
  const [openSharedVideoId, setOpenSharedVideoId] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // G1: skelner "programmet er tomt" fra "programmet kunne ikke hentes", så
  // en fejlet fetchProgram ikke viser samme skærm som en atlet uden program.
  const [programError, setProgramError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  // Rå streng (ikke number) så feltet kan ryddes/skrives frit — fx "0" eller
  // midlertidigt tomt — uden at snappe tilbage til 0. Parses hvor der regnes.
  const [amount, setAmount] = useState('100')
  const [unitIdx, setUnitIdx] = useState(0)
  const [customFoods, setCustomFoods] = useState([])
  const [showCreateFood, setShowCreateFood] = useState(false)
  const [createFood, setCreateFood] = useState({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
  const [shareFood, setShareFood] = useState(true)
  const [mealTemplates, setMealTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateNameInput, setTemplateNameInput] = useState('')
  const [historicalMealLogs, setHistoricalMealLogs] = useState([])
  const [frequentFoods, setFrequentFoods] = useState([])
  const [kostDate, setKostDate] = useState(today())
  const [showTdee, setShowTdee] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editGrams, setEditGrams] = useState('')
  const [editMacros, setEditMacros] = useState({ kcal: '', protein: '', carb: '', fat: '' })

  // Messages state
  const [messages, setMessages] = useState([])
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [messageInput, setMessageInput] = useState('')
  const [msgTrack, setMsgTrack] = useState('besked')  // 'teknik' | 'besked' — to spor, ét sted

  // Program state
  const [currentWeek, setCurrentWeek] = useState(null)
  const [allWeeks, setAllWeeks] = useState([])
  const [viewingWeekIdx, setViewingWeekIdx] = useState(0)
  const [pastLogs, setPastLogs] = useState([])
  const [progOpenSession, setProgOpenSession] = useState(null)
  const [exerciseLogs, setExerciseLogs] = useState([])
  const [prs, setPrs] = useState([]) // atletens egne rekorder (personal_records)
  const [prsError, setPrsError] = useState(false) // se fetchPRs — ordre 163 · del 3
  const [logInputs, setLogInputs] = useState({})
  const [lastLogByExerciseName, setLastLogByExerciseName] = useState({})
  const [exerciseHistory, setExerciseHistory] = useState({})
  // ORDRE 280 · commit 2 — Dagens pas' "Fortryd sidste sæt": kun det senest
  // loggede sæt FRA DEN KORT (ikke Program-fanen), og kun synligt så længe
  // pas.next stadig peger på samme øvelse (se DagensPasCard).
  const [lastLoggedSet, setLastLoggedSet] = useState(null) // { exerciseId, setNumber }
  // ORDRE 259 · commit 1: atletens egen volumen pr. muskelgruppe-fane —
  // rå exercise_logs-rækker (kun feltet VolumenTab.jsx behøver), hentet når
  // fanen åbnes, se effekten ved fetchMeetPlan/fetchMeetResults nedenfor.
  const [volumeLogs, setVolumeLogs] = useState([])
  const [volumeLoading, setVolumeLoading] = useState(false)
  // ORDRE 268 · commit 2: "hele forløbet" i UgensStatusKort (Hjem) — lazy-
  // hentet først når atleten faktisk skifter til den visning (se
  // UgensStatusKort's onAabnForloeb), samme mønster som volumeLogs ovenfor.
  const [forloebLogs, setForloebLogs] = useState(null)
  const [forloebLoading, setForloebLoading] = useState(false)
  // ORDRE 284 · commit 1: al historik (ikke kun et par uger) til Fremgang-
  // fanens pr.-øvelse-kurver — lazy-hentet først når fanen åbnes, samme
  // mønster som volumeLogs/forloebLogs ovenfor.
  const [fremgangLogs, setFremgangLogs] = useState([])
  const [fremgangLoading, setFremgangLoading] = useState(false)
  const [weeklyTonnage, setWeeklyTonnage] = useState([])
  const [liftProgress, setLiftProgress] = useState([])
  const [weightLogs, setWeightLogs] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  // PR toast state
  const [prToast, setPrToast] = useState(null)
  const [prToastFading, setPrToastFading] = useState(false)
  const [setConfirm, setSetConfirm] = useState({})
  // Serialiseret skrivning pr. sæt-nøgle (exerciseId_setNumber). Hurtige gentagne
  // tryk på samme sæt (fx en vægtkorrektion mens den forrige skrivning stadig
  // kører) må hverken lave dubletter eller tabe den nyeste værdi: første skrivning
  // INSERT'er og fanger rækkens rigtige id, resten UPDATE'er samme række.
  const setWriteRef = useRef({}) // key -> { realId, chain }
  // Fortryd-toast (sletning) + beskeder auto-scroll
  const [undoToast, setUndoToast] = useState(null)
  const [undoPending, setUndoPending] = useState(false)
  const undoTimerRef = useRef(null)
  // Session-niveau skriv-tilstand ("<sessionId>:skip"|"autofill"|"feedback") — knapperne
  // deaktiveres og viser "..."/"Gemmer..." mens skrivningen afventer svar fra Supabase.
  const [pendingSessionAction, setPendingSessionAction] = useState(null)
  const messagesEndRef = useRef(null)
  const readinessCardRef = useRef(null)
  // ORDRE 330 · blok 2 — alt på forsiden der ikke skal bruges NU ligger bag
  // folden "Mere" (lukket fra start, ikke husket mellem besøg).
  const [mereOpen, setMereOpen] = useState(false)
  // Session-kort refs, så vi kan scrolle en nyåbnet session op i toppen
  // (accordion: når en session over kollapser, hopper layoutet ellers så man
  // lander midt/nederst i den nye session i stedet for ved første øvelse).
  const sessionRefs = useRef({})
  // In-app toast + bekræftelses-modal (erstatter native alert/confirm)
  const [flash, setFlash] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const flashTimerRef = useRef(null)
  const [skipConfirmEx, setSkipConfirmEx] = useState(null)
  const [openRpePicker, setOpenRpePicker] = useState(null)

  // Session feedback state
  const [dismissedFeedback, setDismissedFeedback] = useState(new Set())
  const [feedbackInputs, setFeedbackInputs] = useState({})

  const [showRpeGuide, setShowRpeGuide] = useState(false)

  // Warmup state
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [warmupChecked, setWarmupChecked] = useState({})
  const [exWarmupExpanded, setExWarmupExpanded] = useState(new Set())
  const [exWarmupWeightOverride, setExWarmupWeightOverride] = useState({})
  const [exWarmupWeightEditing, setExWarmupWeightEditing] = useState(null)
  // Atletens rettelse af ét opvarmningssæts vægt (ordre 105, commit 2) —
  // `${exKey}_${index}` mens feltet redigeres. Selve rettelsen gemmes
  // straks i warmupOverride.js's storage; tick'et her tvinger et re-render,
  // så suggestWarmupOverride læses igen efter en gemt rettelse.
  const [warmupSetEditing, setWarmupSetEditing] = useState(null)
  const [warmupOverrideTick, setWarmupOverrideTick] = useState(0)
  const [warmupPhase, setWarmupPhase] = useState('focus')
  const [warmupFocus, setWarmupFocus] = useState(null)
  const [warmupSubtype, setWarmupSubtype] = useState(null)
  const [warmupProblems, setWarmupProblems] = useState(new Set())
  const [warmupExercises, setWarmupExercises] = useState([])
  const [warmupStep, setWarmupStep] = useState(0)
  // Valgt øvelses-option pr. slot i opvarmnings-guiden (slot-index → option-index).
  // Nulstilles ved hver guide-start, så default altid er den første variant.
  const [warmupChoice, setWarmupChoice] = useState({})
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  // G5: { remainingAtStart, startedAt } for det aktive segment — læses kun
  // inde i effekten nedenfor, aldrig under selve renderet.
  const timerStartRef = useRef(null)

  // Mobilitet-hub state — fanen er en intent-landing (null) med tre døre
  const [mobilityMode, setMobilityMode] = useState(null) // null=landing | 'opvarmning' | 'mobilitet'

  // Mobilitets-session (on-demand: byg en session nu, ingen persistens/streak)
  const [mobilityPhase, setMobilityPhase] = useState('design')  // 'design' | 'guide' | 'done' (intake-porten droppet)
  const [mobilityIntake, setMobilityIntake] = useState({ time: 10, sitting: 'med', lifts: [], problems: [], soreAreas: [] })
  const [mobilitySlots, setMobilitySlots] = useState([])        // valgte øvelser: [{ area, choiceIdx }]
  const [mobilityStep, setMobilityStep] = useState(0)

  // Stævnedag state
  const [hasMeetPlan, setHasMeetPlan] = useState(false)
  const [meetType, setMeetType] = useState('sbd')
  const [meetPlanNotes, setMeetPlanNotes] = useState('')
  const [meetWarmupEditing, setMeetWarmupEditing] = useState(null)
  const [meetWarmupDraft, setMeetWarmupDraft] = useState([])
  const [meetWarmupOverrides, setMeetWarmupOverrides] = useState({})
  const [meetResults, setMeetResults] = useState([])
  const [meetAttempts, setMeetAttempts] = useState({
    squat:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
    bench:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
    deadlift: [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
  })

  // Onboarding — klik-guiden ved foerste login. onboardingDone kommer fra
  // athletes.onboarding_completed_at (server-side, pr. bruger). guideOpen lader
  // guiden genaabnes manuelt fra kontomenuen uden at paavirke den gemte tilstand.
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(0)

  // Readiness state
  const [readinessLog, setReadinessLog] = useState(null)
  const [lastReadiness, setLastReadiness] = useState(null) // seneste tidligere log → "samme som i går"
  const [readinessHistory, setReadinessHistory] = useState([]) // op til 14 forudgående dage → dagens svar + kurve (ORDRE 100)
  const [readinessInput, setReadinessInput] = useState({ sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] })
  const [savingReadiness, setSavingReadiness] = useState(false)
  const [readinessError, setReadinessError] = useState(null)
  // G12: parathedsudkastet skal overleve en lukket fane. restoredForAthleteRef
  // holder styr på hvilken atlet vi allerede har forsøgt at genindsætte et
  // udkast for, så gem-effekten nedenfor ikke rydder det udkast den lige har
  // hentet, før genindsættelsen har nået at slå igennem i state.
  const readinessDraftRestoredForRef = useRef(null)

  useEffect(() => {
    if (!athlete?.id) return
    if (readinessDraftRestoredForRef.current !== athlete.id) {
      readinessDraftRestoredForRef.current = athlete.id
      const draft = loadReadinessDraft(athlete.id, today())
      if (draft && !isEmptyReadinessDraft(draft)) {
        setReadinessInput(draft)
        return
      }
    }
    if (isEmptyReadinessDraft(readinessInput)) clearReadinessDraft(athlete.id, today())
    else saveReadinessDraft(athlete.id, today(), readinessInput)
  }, [readinessInput, athlete?.id])

  // ORDRE 267 · commit 1 — "to minutter": det eneste felt appen reelt kan
  // udlede er "sandsynligvis som sidst" (atletens egen seneste log). Før
  // krævede det et eksplicit tryk på "↺ Samme som sidst"; nu forudfyldes
  // formularen automatisk, første gang lastReadiness er hentet — stadig frit
  // at rette hvert felt bagefter. Et påbegyndt, ikke-tomt udkast (draft-
  // effekten ovenfor) har forrang og forhindrer denne forudfyldning.
  const readinessPrefillDoneForRef = useRef(null)
  useEffect(() => {
    if (!athlete?.id || !lastReadiness) return
    if (readinessPrefillDoneForRef.current === athlete.id) return
    readinessPrefillDoneForRef.current = athlete.id
    if (!isEmptyReadinessDraft(readinessInput)) return
    setReadinessInput({
      sleep: lastReadiness.sleep_hours != null ? String(lastReadiness.sleep_hours) : '',
      energy: lastReadiness.energy ?? null,
      motivation: lastReadiness.motivation ?? null,
      stress: lastReadiness.stress ?? null,
      soreness: lastReadiness.soreness_level ?? null,
      soreZones: lastReadiness.sore_zones || [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readinessInput bevidst ikke i deps, kun læst ved selve kaldet (samme mønster som draft-effekten ovenfor)
  }, [athlete?.id, lastReadiness])

  useEffect(() => {
    athleteVideoCoachRef.current = athlete
    if (!athlete?.id) return
    const config = { type: `${ATHLETE_VIDEOCOACH_PREFIX}:config`,
      athletes: [{ id: athlete.id, name: athlete.name }], selectedAthleteId: athlete.id,
      submissionMode: 'athlete' }
    for (const client of athleteVideoCoachClientsRef.current) {
      if (!client || client.closed) { athleteVideoCoachClientsRef.current.delete(client); continue }
      try { client.postMessage(config, window.location.origin) }
      catch { athleteVideoCoachClientsRef.current.delete(client) }
    }
  }, [athlete])

  useEffect(() => {
    const onAthleteVideoCoachMessage = async event => {
      if (event.origin !== window.location.origin || !event.source) return
      const message = event.data || {}
      const currentAthlete = athleteVideoCoachRef.current
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:close`) {
        const frameWindow = athleteVideoCoachFrameRef.current?.contentWindow
        if (event.source !== frameWindow && !athleteVideoCoachClientsRef.current.has(event.source)) return
        athleteVideoCoachClientsRef.current.delete(event.source)
        setAthleteVideoCoachOpen(false)
        setAthleteVideoCoachInstant(false)
        return
      }
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:ready`) {
        if (!currentAthlete?.id) return
        athleteVideoCoachClientsRef.current.add(event.source)
        event.source.postMessage({ type: `${ATHLETE_VIDEOCOACH_PREFIX}:config`,
          athletes: [{ id: currentAthlete.id, name: currentAthlete.name }],
          selectedAthleteId: currentAthlete.id, submissionMode: 'athlete' }, event.origin)
        window.dispatchEvent(new Event(ATHLETE_VIDEOCOACH_QUEUE_CHANGED))
        return
      }
      // ORDRE 61 · commit 2: atleten kan fortryde, mens filen stadig overføres.
      // Selve fetch-kaldet afbrydes (se upload-and-go nedenfor) - ikke bare
      // ventetiden - så en abort her giver ALDRIG en afventende række.
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:abort-upload`) {
        const controller = athleteVideoUploadAbortsRef.current.get(message.requestId)
        if (controller) controller.abort()
        return
      }
      // ORDRE 57 · commit 1: "upload og gå" - atleten sender selve videoen,
      // ikke sporede tal. Kun appen har en autentificeret Supabase-klient
      // (VideoCoach har ingen), så både storage-uploaden og rækkens indsættelse
      // sker her. Filen rejser i selve beskeden (File/Blob er struktur-klonbar).
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:upload-and-go`) {
        // G16 (ordre 131): reply() er det ENESTE sted der er sikret at køre for
        // ethvert bekræftet udfald (succes, fejl, annullering) - marker-oprydning
        // sker derfor her, ét sted, i stedet for ved hvert enkelt return nedenfor.
        const reply = result => {
          if (currentAthlete?.id) clearUploadInflight(currentAthlete.id)
          try { event.source.postMessage({ type: `${ATHLETE_VIDEOCOACH_PREFIX}:upload-result`,
            requestId: message.requestId, ...result }, event.origin); return true }
          catch { return false }
        }
        if (!athleteVideoCoachClientsRef.current.has(event.source) || !currentAthlete?.id) {
          reply({ ok: false, error: 'VideoCoach-forbindelsen er ikke registreret' })
          return
        }
        const file = message.file
        const requestError = validateVideoUploadRequest({
          athleteId: currentAthlete.id, clientAnalysisId: message.clientAnalysisId,
          lift: message.lift, variation: message.variation, mimeType: message.mimeType,
          fileSize: file?.size, loadKg: message.loadKg, rpe: message.rpe,
          athleteNote: message.athleteNote, plateCalibration: message.plateCalibration,
        })
        if (requestError || !(file instanceof Blob)) {
          reply({ ok: false, error: requestError || 'Ugyldig video' })
          return
        }
        const path = buildVideoUploadPath(currentAthlete.id, message.clientAnalysisId, message.mimeType)
        if (!path) { reply({ ok: false, error: 'Videoformatet kunne ikke gemmes' }); return }
        // ORDRE 61 · commit 2: supabase-js's storage.upload() tager ikke en
        // AbortSignal (ingen af FileOptions dækker det), så selve fetch-kaldet
        // skal afbrydes via klientens fetch-option i stedet - se
        // createAbortableUploadClient. En engangsklient her, ikke den delte
        // `supabase`, så en afbrudt upload aldrig kan afbryde andre samtidige kald.
        const controller = new AbortController()
        athleteVideoUploadAbortsRef.current.set(message.requestId, controller)
        // G16 (ordre 131): sat FØR selve overførslen, ryddet af reply() ovenfor
        // ved ethvert bekræftet udfald - se athleteSilentFailLog.js.
        markUploadInflight(currentAthlete.id, message.requestId)
        let upload
        try {
          upload = await createAbortableUploadClient(controller.signal).storage
            .from(VIDEOCOACH_UPLOAD_BUCKET)
            .upload(path, file, { contentType: message.mimeType, upsert: false })
        } finally {
          athleteVideoUploadAbortsRef.current.delete(message.requestId)
        }
        if (upload.error) {
          if (controller.signal.aborted) {
            reply({ ok: false, aborted: true, error: 'Annulleret · intet blev sendt' })
            return
          }
          if (!videoUploadAlreadyExistsError(upload.error)) {
            reply({ ok: false, error: `Video kunne ikke uploades: ${upload.error.message || 'ukendt fejl'}` })
            return
          }
        }
        const row = buildAwaitingAnalysisRow({
          athleteId: currentAthlete.id, athleteName: currentAthlete.name,
          clientAnalysisId: message.clientAnalysisId, lift: message.lift, variation: message.variation,
          loadKg: message.loadKg, rpe: message.rpe, athleteNote: message.athleteNote, videoPath: path,
          plateCalibration: message.plateCalibration,
        })
        // ORDRE 131 · commit 3: rid coachen med en videorække der reelt bliver
        // gemt - ventende stille-fejl-koder (G14/G15/G16) lægges kun ind her,
        // rydningen sker nedenfor FØRST når gemningen er bekræftet, så en
        // fejlet gemning ikke selv taber koderne.
        row.session_context = attachPendingSilentFails(row.session_context, currentAthlete.id)
        const saved = await saveVideoCoachDraft(supabase, row, { athleteSubmission: true })
        if (saved.error) {
          // Videoen er allerede lagt i bucket'en (idempotent sti pr. client_analysis_id) -
          // kun selve rækken mangler. Et nyt tryk på "Prøv at sende igen" er nok.
          reply({ ok: false, error: saved.error.message || 'Videoen blev uploadet, men analysen kunne ikke oprettes · prøv igen' })
          return
        }
        clearPendingSilentFails(currentAthlete.id)
        reply({ ok: true, data: { ...saved.data, duplicate: saved.duplicate } })
        window.dispatchEvent(new Event(ATHLETE_VIDEOCOACH_QUEUE_CHANGED))
        return
      }
      if (message.type !== `${ATHLETE_VIDEOCOACH_PREFIX}:save-draft`) return
      const reply = result => {
        try { event.source.postMessage({ type: `${ATHLETE_VIDEOCOACH_PREFIX}:save-result`,
          requestId: message.requestId, ...result }, event.origin); return true }
        catch { return false }
      }
      if (!athleteVideoCoachClientsRef.current.has(event.source) || !currentAthlete?.id) {
        reply({ ok: false, error: 'VideoCoach-forbindelsen er ikke registreret' })
        return
      }
      const validationError = validateAthleteVideoCoachRow(message.row, currentAthlete.id)
      if (validationError) { reply({ ok: false, error: validationError }); return }
      const safeRow = {
        ...message.row,
        athlete_id: currentAthlete.id,
        athlete_name: currentAthlete.name,
        source_mode: 'athlete_submission',
        status: 'draft',
        coach_note: null,
        bias_note: null,
        session_context: {
          training_session_id: null,
          program_item_id: null,
          coach_note_snapshot: null,
          baseline_snapshot: [],
          athlete_note: typeof message.row.session_context?.athlete_note === 'string'
            ? (message.row.session_context.athlete_note.trim().slice(0, 1000) || null)
            : null,
          feedback_evidence: sanitizeVideoCoachFeedbackEvidence(
            message.row.session_context?.feedback_evidence),
        },
      }
      // ORDRE 131 · commit 3: samme mønster som upload-and-go ovenfor - ventende
      // koder følger med i selve rækken (også hvis den ender i den lokale
      // retry-kø nedenfor), og ryddes kun ved en BEKRÆFTET gemning.
      safeRow.session_context = attachPendingSilentFails(safeRow.session_context, currentAthlete.id)
      const result = await saveVideoCoachDraft(supabase, safeRow, { athleteSubmission: true })
      if (result.error) {
        if (isRetryableVideoCoachError(result.error) &&
            queueVideoCoachDraft(safeRow, globalThis.localStorage, session.user.id)) {
          // Koderne er nu bagt ind i safeRow, som selve kø-funktionen persisterer
          // lokalt til senere automatisk afsendelse (flushVideoCoachDraftQueue) -
          // trygt at rydde den ADSKILTE ventekø her, de er ikke tabt.
          clearPendingSilentFails(currentAthlete.id)
          window.dispatchEvent(new Event(ATHLETE_VIDEOCOACH_QUEUE_CHANGED))
          reply({ ok: true, data: { client_analysis_id: safeRow.client_analysis_id,
            athlete_id: currentAthlete.id, status: 'draft', queued: true } })
          return
        }
        reply({ ok: false, error: result.error.message || 'Analysen kunne ikke sendes' })
        return
      }
      clearPendingSilentFails(currentAthlete.id)
      reply({ ok: true, data: { ...result.data, duplicate: result.duplicate } })
    }
    window.addEventListener('message', onAthleteVideoCoachMessage)
    return () => window.removeEventListener('message', onAthleteVideoCoachMessage)
  }, [session.user.id])

  useEffect(() => {
    if (!athlete?.id) return undefined
    let cancelled = false
    let retryTimer = null
    let retryAttempt = 0
    let inFlight = false
    const maxRetries = 5

    const notifyVideoCoachQueue = result => {
      const message = { type: `${ATHLETE_VIDEOCOACH_PREFIX}:queue-status`, ...result }
      for (const client of athleteVideoCoachClientsRef.current) {
        if (!client || client.closed) { athleteVideoCoachClientsRef.current.delete(client); continue }
        try { client.postMessage(message, window.location.origin) }
        catch { athleteVideoCoachClientsRef.current.delete(client) }
      }
      if (result.sent > 0) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlash({ message: 'Din gemte videoanalyse er nu sendt til coachen.', kind: 'info' })
        flashTimerRef.current = setTimeout(() => setFlash(null), 4500)
      } else if (result.expired > 0 || result.invalid > 0) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlash({ message: 'En lokalt gemt videoanalyse kunne ikke sendes. Åbn VideoCoach og send den igen.', kind: 'error' })
        flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
      }
    }

    const flushPendingVideoCoach = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      const result = await flushVideoCoachDraftQueue(
        supabase, athlete.id, globalThis.localStorage, session.user.id)
      inFlight = false
      if (cancelled) return
      notifyVideoCoachQueue(result)
      if (result.remaining > 0 && retryAttempt < maxRetries) {
        const delay = Math.min(80_000, 5000 * (2 ** retryAttempt))
        retryAttempt++
        retryTimer = setTimeout(flushPendingVideoCoach, delay)
      } else if (result.remaining > 0) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlash({ message: 'Videoanalysen er stadig gemt lokalt. Vi prøver igen næste gang VideoCoach åbnes.', kind: 'error' })
        flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
      } else {
        retryAttempt = 0
      }
    }
    flushPendingVideoCoach()
    const retryWhenOnline = () => {
      retryAttempt = 0
      if (retryTimer) clearTimeout(retryTimer)
      flushPendingVideoCoach()
    }
    const retryWhenQueueChanges = () => {
      retryAttempt = 0
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(flushPendingVideoCoach, 5000)
    }
    window.addEventListener('online', retryWhenOnline)
    window.addEventListener(ATHLETE_VIDEOCOACH_QUEUE_CHANGED, retryWhenQueueChanges)
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', retryWhenOnline)
      window.removeEventListener(ATHLETE_VIDEOCOACH_QUEUE_CHANGED, retryWhenQueueChanges)
    }
  }, [athlete?.id, session.user.id])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- kører bevidst kun ved mount; coachAthleteId/role/session er faste for denne AthleteView-instans (nyt preview = nyt mount, se App.jsx)
  useEffect(() => { fetchAthlete() }, [])
  // G16 (ordre 131): opdager en videoupload der blev afbrudt af at fanen/appen
  // lukkede eller genindlæste midt i overførslen (ingen kode når at køre
  // færdig i det tilfælde, så intet andet sted kan vise fejlen). Kører kun
  // ved en reel app-åbning (athlete.id sat første gang), ikke ved genrender.
  useEffect(() => {
    if (!athlete?.id) return
    if (!takeStaleUploadInflight(athlete.id)) return
    recordSilentFail(athlete.id, 'silent:video-upload-interrupted')
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message: 'Din seneste video blev muligvis afbrudt, mens den blev sendt. Åbn VideoCoach og send den igen for at være sikker.', kind: 'error' })
    flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
  }, [athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLogs er ren ift. sine parametre (athleteId, dato), begge allerede i deps
  useEffect(() => { if (athlete?.id) fetchLogs(athlete.id, kostDate) }, [kostDate, athlete?.id])
  // ORDRE 280 · commit 4 — ventende sæt (offlineSetQueue.js) sendes igen ved
  // app-åbning og hver gang forbindelsen kommer tilbage ('online'-event).
  useEffect(() => {
    if (!athlete?.id) return
    setPendingSyncCount(countOfflineSets(athlete.id))
    flushOfflineSets()
    window.addEventListener('online', flushOfflineSets)
    return () => window.removeEventListener('online', flushOfflineSets)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushOfflineSets læser kun athlete/currentWeek/exerciseLogs, alle friske ved kald (samme mønster som fetchAthlete ovenfor)
  }, [athlete?.id])
  useEffect(() => {
    if (role === 'athlete' && athlete?.id) fetchSharedVideoAnalyses()
  }, [role, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- begge kaldes synkront i denne kørsel og læser kun athlete/msgTrack, som allerede er i deps
  useEffect(() => { if (tab === 'beskeder' && athlete?.id) { fetchAthleteMessages(); markTrackRead(msgTrack); if (msgTrack === 'teknik') fetchSharedVideoAnalyses() } }, [tab, athlete?.id, msgTrack])
  useEffect(() => { if (tab === 'beskeder') messagesEndRef.current?.scrollIntoView({ block: 'end' }) }, [messages, tab])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- begge er rene ift. athlete.id, som allerede er i deps
  useEffect(() => { if (tab === 'stævnedag' && athlete?.id) { fetchMeetPlan(athlete.id); fetchMeetResults(athlete.id) } }, [tab, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchVolumeLogs er ren ift. athleteId, som allerede er i deps
  useEffect(() => { if (tab === 'volumen' && athlete?.id) fetchVolumeLogs(athlete.id) }, [tab, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFremgangLogs er ren ift. athleteId, som allerede er i deps
  useEffect(() => { if (tab === 'fremgang' && athlete?.id) fetchFremgangLogs(athlete.id) }, [tab, athlete?.id])

  useEffect(() => {
    if (tab === 'mobilisering' && mobilityMode === 'opvarmning' && currentWeek && warmupPhase === 'focus' && !warmupFocus) {
      for (const session of currentWeek.sessions || []) {
        for (const ex of session.exercises || []) {
          const n = (ex.name || '').toLowerCase()
          if (n.includes('squat')) { setWarmupFocus('Squat'); return }
          if (n.includes('bænk') || n.includes('bench')) { setWarmupFocus('Bænkpres'); return }
          if (n.includes('sumo')) { setWarmupFocus('Dødløft'); setWarmupSubtype('Sumo'); return }
          if (n.includes('dødl') || n.includes('deadlift')) { setWarmupFocus('Dødløft'); return }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- skal kun forsøge auto-detektion når fanen/uge/tilstand ændres, ikke når seedingen selv sætter warmupFocus
  }, [tab, currentWeek, mobilityMode])

  useEffect(() => {
    // G5: regn ud fra tidsstempler (hvornår segmentet startede, og hvornår
    // "nu" faktisk er), ikke ud fra hvor mange ticks der nåede at køre — en
    // låst skærm/baggrundsfane throttler eller pauser setTimeout-kæder, men
    // uret går videre. genregner desuden med det samme ved visibilitychange,
    // så en genoptaget fane ikke venter på næste 250ms-tick for at rette sig.
    if (!timerActive) return
    timerStartRef.current = { remainingAtStart: timerSeconds, startedAt: Date.now() }
    const recompute = () => {
      const live = remainingSeconds(timerStartRef.current.remainingAtStart, timerStartRef.current.startedAt)
      setTimerSeconds(live)
      if (live <= 0) { setTimerActive(false); setTimerDone(true) }
    }
    recompute()
    const id = setInterval(recompute, 250)
    const onVisible = () => { if (document.visibilityState === 'visible') recompute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved start/stop af segmentet; 'timerSeconds' bruges kun som startpunkt for DET segment
  }, [timerActive])

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoadError(true), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  // G1: fælles fejlvisning for baggrundslæsninger (fetchPRs, fetchWeightLogs,
  // ...). Logger detaljen til frontend_errors og viser en oversat, ærlig
  // linje — samme sprog som skrivefejlene (showFlash, se athleteWriteGuard-
  // kaldene). Kalderen skal IKKE opdatere sin state når denne kaldes, så det
  // sidst kendte indhold forbliver på skærmen.
  function onReadError(label, athleteId) {
    return (error) => {
      logFrontendError(`${label} kunne ikke hentes`, error, athleteId)
      showFlash(`${label} kunne ikke hentes. Tjek din forbindelse og prøv igen.`, 'error')
    }
  }

  async function fetchAthlete() {
    if (!coachAthleteId && role !== 'athlete') { setLoading(false); return }
    let data
    let error
    if (coachAthleteId) {
      ({ data, error } = await withRetry(() =>
        supabase.from('athletes').select('*').eq('id', coachAthleteId).maybeSingle()
      ))
    } else {
      ({ data, error } = await withRetry(() =>
        supabase.from('athletes').select('*').eq('user_id', session.user.id).maybeSingle()
      ))
      if (!error && !data) {
        const claim = await withRetry(() => supabase.rpc('claim_athlete_profile_v3'))
        if (claim.error || !isUuid(claim.data)) {
          setLoadError(true)
          return
        }
        ({ data, error } = await withRetry(() =>
          supabase.from('athletes').select('*')
            .eq('user_id', session.user.id)
            .eq('id', claim.data)
            .maybeSingle()
        ))
        if (!error && !data) {
          setLoadError(true)
          return
        }
      }
    }
    // Reel fejl: vis fejl/retry-skærmen i stedet for misvisende "ikke tilknyttet".
    // (Bliver i loading-tilstanden, som renderer loadError-grenen med "Prøv igen".)
    if (error) { setLoadError(true); return }
    if (data) {
      if (!coachAthleteId) {
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id)
        setOnboardingDone(hasCompletedOnboardingGuide(data))
      }
      setAthlete(data)
      // ORDRE 263 · commit 2: en igangværende pause overlever et lukket/
      // genåbnet vindue (persisteret i localStorage, se restPause.js) —
      // genindlæses her, ét kald, samme sted som resten af login-opstarten.
      setRestPause(loadRestPause(data.id))
      // Ordre 163 · del 4 (billig gevinst, ingen ny state-model): det der
      // faktisk vises først — "hjem" er standardfanen — hentes med det
      // samme. Resten (kost/beskeder/opvarmning/stævne, alt på faner
      // brugeren endnu ikke har åbnet) udskydes ét tick med setTimeout(0),
      // så disse kald ikke konkurrerer om de første forbindelser/båndbredde
      // med det der rent faktisk skal males på skærmen på en langsom profil.
      fetchProgram(data.id)
      fetchLogs(data.id)
      fetchReadiness(data.id)
      setTimeout(() => {
        fetchCustomFoods(data.id)
        fetchMealTemplates(data.id)
        fetchHistoricalMealLogs(data.id)
        fetchFrequentFoods(data.id)
        fetchAthleteMessages(data.id)
        fetchWeightLogs(data.id)
        fetchPRs(data.id)
        fetchWarmupTemplates(data.id)
        fetchMeetPlan(data.id)
        fetchMeetResults(data.id)
      }, 0)
    }
    setLoading(false)
  }

  async function fetchSharedVideoAnalyses() {
    setSharedVideoLoading(true)
    setSharedVideoError(null)
    const { data, error } = await supabase.rpc('get_my_shared_video_analyses_v3', {
      p_limit: 6,
      p_offset: 0,
    })
    if (error) {
      setSharedVideoError(error.message || 'Dine analyser kunne ikke hentes')
      setSharedVideoLoading(false)
      return
    }
    const analyses = Array.isArray(data) ? data.filter(item => item && item.id) : []
    setSharedVideoAnalyses(analyses)
    setOpenSharedVideoId(analyses[0]?.id || null)
    setSharedVideoLoading(false)
  }

  // G3 (ordre 163 · del 3): "Personlige rekorder" var kaldet der fejlede ved
  // åbning. Det stoppede allerede ikke resten af siden (runGuardedRead), men
  // meldte fejlen med onReadError's app-brede røde toast for noget der kun
  // rører ét kort. Nu: fejlen markeres kun i selve "Dine rekorder"-kortet
  // (prsError, se render nedenfor), og der forsøges roligt igen i baggrunden
  // med stigende ventetid — uden at brugeren skal røre noget.
  async function fetchPRs(athleteId, attempt = 0) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('personal_records')
        .select('exercise_name, weight, reps, created_at')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false }),
      (error) => {
        logFrontendError('Personlige rekorder kunne ikke hentes', error, athleteId)
        if (mountedRef.current) setPrsError(true)
      },
    )
    if (!ok) {
      if (attempt < 3) {
        setTimeout(() => { if (mountedRef.current) fetchPRs(athleteId, attempt + 1) }, 1500 * (attempt + 1))
      }
      return
    }
    if (!mountedRef.current) return
    setPrsError(false)
    setPrs(data || [])
  }

  async function fetchMeetPlan(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase.from('meet_plans').select('*').eq('athlete_id', athleteId).maybeSingle(),
      onReadError('Stævneplanen', athleteId),
    )
    if (!ok) return
    setHasMeetPlan(!!data)
    if (data) {
      setMeetType(data.meet_type || 'sbd')
      setMeetPlanNotes(data.notes || '')
      setMeetAttempts({
        squat:    [{ w: data.squat1 ?? '', r: null }, { w: data.squat2 ?? '', r: null }, { w: data.squat3 ?? '', r: null }],
        bench:    [{ w: data.bench1 ?? '', r: null }, { w: data.bench2 ?? '', r: null }, { w: data.bench3 ?? '', r: null }],
        deadlift: [{ w: data.dead1  ?? '', r: null }, { w: data.dead2  ?? '', r: null }, { w: data.dead3  ?? '', r: null }],
      })
    }
  }

  // ORDRE 259 · commit 1: samme kilde (exercise_logs) som coachens
  // fetchAthleteLogs (Dashboard.jsx). ORDRE 259 · commit 2: udvidet fra
  // ~8 dage til ~5 uger — nok til VolumenTab.jsx's "seneste 4 uger"-trend
  // med en uges margin til ugegrænser, stadig uden coachens fulde
  // 2000-sæt-historik. Ingen rettelser (exercise_muscle_overrides) hentes
  // her — atleten har ikke læseadgang til dem, se docs/RAPPORT-259.md.
  async function fetchVolumeLogs(athleteId) {
    setVolumeLoading(true)
    const since = new Date(Date.now() - 5 * 7 * 86400000).toISOString()
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('logged_at, skipped, exercises(name)')
        .eq('athlete_id', athleteId)
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
        .limit(2000),
      onReadError('Din volumen', athleteId),
    )
    setVolumeLoading(false)
    if (!ok) return
    setVolumeLogs(data || [])
  }

  // ORDRE 284 · commit 1: al historik for Fremgang-fanen — ingen datogrænse
  // (til forskel fra fetchVolumeLogs's 5 uger), for fremgang på et løft skal
  // kunne ses over måneder, ikke kun de seneste uger. Kun gennemførte sæt
  // med en rigtig vægt (samme filtre som fetchExerciseHistory). ORDRE 293
  // (F2): hentes faldende og vendes, så en grænse aldrig koster de nyeste sæt
  // (se src/fremgangLogs.js).
  async function fetchFremgangLogs(athleteId) {
    setFremgangLoading(true)
    const { data, ok } = await runGuardedRead(
      () => fremgangLogsQuery(supabase, athleteId),
      onReadError('Fremgang', athleteId),
    )
    setFremgangLoading(false)
    if (!ok) return
    setFremgangLogs(fremgangLogsKronologisk(data))
  }

  // ORDRE 268 · commit 2: "hele forløbet" i UgensStatusKort — samme kilde
  // (exercise_logs) og samme grænse (2000, som coachens fetchAthleteLogs i
  // Dashboard.jsx) som resten af appen, ingen dato-afgrænsning (til forskel
  // fra fetchVolumeLogs's 5 uger) fordi "hele forløbet" pr. definition kan
  // strække sig længere tilbage end det. beregnForloebUger matcher kun på
  // logged_at, ikke exercise_id. ORDRE 276 · blok 2 genbruger SAMME logs til
  // "sidste uge ved siden af denne" (beregnUgeDage, som matcher på
  // exercise_id) — derfor er `exercise_id` med i select'en her, selvom
  // beregnForloebUger ikke selv bruger den.
  async function fetchForloebLogs(athleteId) {
    setForloebLoading(true)
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('exercise_id, weight, reps_completed, skipped, logged_at')
        .eq('athlete_id', athleteId)
        .order('logged_at', { ascending: true })
        .limit(2000),
      onReadError('Ugen som planlagt', athleteId),
    )
    setForloebLoading(false)
    if (!ok) return
    setForloebLogs(data || [])
  }

  async function fetchMeetResults(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meet_results')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('meet_date', { ascending: false }),
      onReadError('Stævneresultater', athleteId),
    )
    if (!ok) return
    setMeetResults(data || [])
  }

  async function fetchWarmupTemplates(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('warmup_templates')
        .select('*')
        .eq('athlete_id', athleteId),
      onReadError('Opvarmningsskabeloner', athleteId),
    )
    if (!ok) return
    setWarmupTemplates(data || [])
  }

  // ORDRE 231 · commit 2: de tre opslag herunder er uafhængige af hinandens
  // DATA (samme tabel, tre forskellige datofiltre) men blev kørt i serie —
  // kaeden-tegn.mjs (commit 1) fandt 0-1ms gab mellem dem, en ren await-kæde,
  // ikke netværksstøj. Kørt samtidig via Promise.all i stedet; hver gren
  // beholder sin egen fejlmelding (onReadError) og opdaterer kun sin egen
  // state ved success, præcis som før.
  async function fetchReadiness(athleteId) {
    const [today_, prev_, hist_] = await Promise.all([
      runGuardedRead(
        () => supabase
          .from('readiness_logs')
          .select('*')
          .eq('athlete_id', athleteId)
          .eq('logged_date', today())
          .maybeSingle(),
        onReadError('Dagens parathed', athleteId),
      ),
      runGuardedRead(
        () => supabase
          .from('readiness_logs')
          .select('*')
          .eq('athlete_id', athleteId)
          .lt('logged_date', today())
          .order('logged_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        onReadError('Sidste parathed', athleteId),
      ),
      // ORDRE 100: op til 14 forudgående dage — grundlaget for "sat op mod
      // dit eget snit" og for den lille 14-dages-kurve. Ekskluderer i dag med
      // vilje, så dagens egen score ikke er med i det den sammenlignes mod.
      runGuardedRead(
        () => supabase
          .from('readiness_logs')
          // ORDRE 267 · commit 2: sleep_hours/sore_zones tilføjet ud over de
          // to oprindelige kolonner — samme forespørgsel, kun flere felter —
          // så "hvad coachen ser"-kortet kan regne gns. søvn/hyppigste ømme
          // zone uden endnu et opslag (se summarizeReadinessForCoach).
          .select('logged_date, readiness_score, sleep_hours, sore_zones')
          .eq('athlete_id', athleteId)
          .lt('logged_date', today())
          .order('logged_date', { ascending: false })
          .limit(14),
        onReadError('Parathedshistorik', athleteId),
      ),
    ])
    if (today_.ok) setReadinessLog(today_.data || null)
    if (prev_.ok) setLastReadiness(prev_.data || null)
    if (hist_.ok) setReadinessHistory(hist_.data || [])
  }

  function suggestNextWeight(exName, intensity) {
    const targetRpe = parsePlannedRpe(intensity)
    if (!targetRpe) return null
    const hist = exerciseHistory[exName?.toLowerCase()] || []
    if (!hist.length) return null
    const lastSession = hist[0]
    if (lastSession.date === today()) return null // currently logging this session
    const setsWithRpe = lastSession.sets.filter(s => s.rpe != null && s.weight > 0)
    if (!setsWithRpe.length) return null
    const ref = setsWithRpe[setsWithRpe.length - 1]
    const roundTo25 = w => Math.round(w / 2.5) * 2.5
    const suggested = roundTo25(ref.weight * (1 + (targetRpe - ref.rpe) * 0.03))
    if (suggested <= 0) return null
    return { weight: suggested, fromRpe: ref.rpe, baseWeight: ref.weight }
  }

  function calcReadinessScore({ sleep, energy, motivation, stress, soreness }) {
    // Vægtet model: hvert element scores 0-100 og vægtes til samlet parathed.
    // Neutrale svar (3/5 + 7-9t søvn) → ~63; kun friske svar nærmer sig 100.
    const sub = [] // [delscore, vægt]
    const h = parseFloat(sleep) || 0
    if (h > 0) {
      let sleepScore
      if (h >= 7 && h <= 9) sleepScore = 100
      else if (h > 9 && h <= 10) sleepScore = 85
      else if (h >= 6 && h < 7) sleepScore = 80
      else if (h >= 5 && h < 6) sleepScore = 55
      else if (h > 10) sleepScore = 70
      else sleepScore = 30 // < 5t
      sub.push([sleepScore, 0.25])
    }
    const lin = v => ((v - 1) / 4) * 100 // 1→0, 3→50, 5→100 (højere = bedre)
    const inv = v => ((5 - v) / 4) * 100 // 1→100, 3→50, 5→0 (lavere = bedre)
    if (energy) sub.push([lin(energy), 0.25])
    if (motivation) sub.push([lin(motivation), 0.15])
    if (stress) sub.push([inv(stress), 0.15])
    if (soreness) sub.push([inv(soreness), 0.20])
    if (!sub.length) return null
    const totalW = sub.reduce((a, [, w]) => a + w, 0)
    const score = sub.reduce((a, [s, w]) => a + s * w, 0) / totalW
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async function saveReadiness() {
    if (!athlete) return
    const missing = []
    if (!readinessInput.energy) missing.push('energi')
    if (!readinessInput.motivation) missing.push('motivation')
    if (!readinessInput.stress) missing.push('stress')
    if (!readinessInput.soreness) missing.push('ømhed')
    if (missing.length) { setReadinessError('Mangler: ' + missing.join(', ')); return }
    setSavingReadiness(true)
    setReadinessError(null)
    const score = calcReadinessScore(readinessInput)
    const payload = {
      athlete_id: athlete.id,
      logged_date: today(),
      sleep_hours: parseFloat(readinessInput.sleep) || null,
      energy: readinessInput.energy,
      motivation: readinessInput.motivation,
      stress: readinessInput.stress,
      soreness_level: readinessInput.soreness,
      sore_zones: readinessInput.soreZones.length > 0 ? readinessInput.soreZones : null,
      readiness_score: score,
    }
    const { error } = await supabase.from('readiness_logs').insert(payload)
    setSavingReadiness(false)
    if (error) {
      // Atleten skal ikke se en rå Supabase-fejlbesked — detaljen går til
      // frontend_errors, hvor den kan slås op, hvis mønsteret gentager sig.
      logFrontendError('saveReadiness fejlede', error, athlete.id)
      setReadinessError('Kunne ikke gemme parathed. Tjek din forbindelse og prøv igen.')
    } else {
      setReadinessLog({ ...payload })
      // G12: en gemt log gør udkastet forældet — ryd det, så en genåbning
      // ikke genindsætter data der allerede er logget.
      clearReadinessDraft(athlete.id, today())
    }
  }

  async function fetchProgram(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('weeks')
        .select('*, sessions(*, exercises(*))')
        .eq('athlete_id', athleteId)
        .order('week_number', { ascending: true }),
      onReadError('Dit program', athleteId),
    )
    if (!ok) { setProgramError(true); return }
    // Bekræftet svar (om end evt. tomt) — en tidligere fejlvisning er ikke
    // længere retvisende.
    setProgramError(false)
    if (!data || data.length === 0) return
    const weeks = data.map(w => ({
      ...w,
      sessions: (w.sessions || [])
        .sort((a, b) => a.session_order - b.session_order)
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => a.exercise_order - b.exercise_order) }))
    }))
    setAllWeeks(weeks)
    const dateIdx = computeActiveWeekIdx(weeks)
    // Lås næste uge op tidligt: er den dato-aktuelle uge fuldt logget, og findes
    // der en næste uge med indhold, så ryk den aktive uge frem — så atleten kan
    // se næste uges anbefalede vægte/opvarmning og logge i forvejen før mandag.
    // Sker KUN ved 100% færdiglogning; en glemt dag holder den aktuelle uge aktiv.
    let activeIdx = dateIdx
    const next = weeks[dateIdx + 1]
    const nextHasContent = (next?.sessions || []).some(s => (s.exercises || []).length > 0)
    if (nextHasContent) {
      const dateLogs = await fetchWeekLogs(athleteId, weeks[dateIdx])
      if (weekFullyLogged(weeks[dateIdx], dateLogs)) activeIdx = dateIdx + 1
    }
    setViewingWeekIdx(activeIdx)
    const activeWeek = weeks[activeIdx]
    setCurrentWeek(activeWeek)
    fetchExerciseLogs(athleteId, activeWeek)
    fetchLastLogs(athleteId, activeWeek)
    fetchExerciseHistory(athleteId)
    fetchWeeklyTonnage(athleteId)
  }

  // Ugentlig tonnage (sum af vægt × reps) + ugentligt bedste e1RM pr. hovedløft
  // til forsidens grafer. Grupperes på ugens mandag ud fra logged_at; ~12 ugers logs.
  async function fetchWeeklyTonnage(athleteId) {
    const since = new Date(Date.now() - 84 * 86400000).toISOString()
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('weight, reps_completed, logged_at, exercises(name)')
        .eq('athlete_id', athleteId)
        .eq('skipped', false)
        .gt('weight', 0)
        .gte('logged_at', since)
        .order('logged_at', { ascending: true })
        .limit(4000),
      onReadError('Tonnage-grafen', athleteId),
    )
    if (!ok || !data) return
    // Kun stang-varianter tæller med i hovedløfts-e1RM — maskiner/håndvægte
    // (belt squat, hack squat, DB-pres ...) giver misvisende høje tal. Samme
    // familie-definition som ordre 284's øvelsesvælger (exerciseProgress.js),
    // så "Squat" her og i Fremgang-fanen aldrig kan komme til at betyde to
    // forskellige ting.
    const byWeek = {}
    const liftByWeek = HOVEDLOEFT_FAMILIER.map(() => ({}))
    for (const l of data) {
      const d = new Date(l.logged_at)
      d.setHours(12, 0, 0, 0)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // tilbage til mandag
      const key = d.toISOString().slice(0, 10)
      byWeek[key] = (byWeek[key] || 0) + (l.weight || 0) * (l.reps_completed || 0)
      const name = (l.exercises?.name || '').toLowerCase()
      const reps = l.reps_completed || 0
      if (name && reps >= 1 && reps <= 12) {
        const e1rm = estimatedOneRepMax(l.weight, reps)
        HOVEDLOEFT_FAMILIER.forEach((lift, i) => {
          if (lift.match(name) && e1rm > (liftByWeek[i][key] || 0)) liftByWeek[i][key] = e1rm
        })
      }
    }
    const rows = Object.entries(byWeek)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([weekStart, total]) => ({ weekStart, total: Math.round(total) }))
    setWeeklyTonnage(rows.slice(-10))
    setLiftProgress(HOVEDLOEFT_FAMILIER.map((lift, i) => ({
      label: lift.label,
      color: lift.color,
      points: Object.entries(liftByWeek[i])
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([weekStart, val]) => ({ weekStart, val }))
        .slice(-10),
    })))
  }

  // Henter en uges logs (kun det nødvendige til færdig-tjek) og returnerer dem,
  // i modsætning til fetchExerciseLogs der sætter state.
  async function fetchWeekLogs(athleteId, week) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) return []
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('exercise_id')
        .eq('athlete_id', athleteId)
        .in('exercise_id', exerciseIds),
      onReadError('Ugens log-status', athleteId),
    )
    if (!ok) return []
    return data || []
  }

  // Åbn/luk en session i programmet. Ved åbning scrolles dens header op i
  // toppen (efter accordion'en har foldet/foldet ud), så man altid lander ved
  // første øvelse — ikke midt/nederst i sessionen.
  function openSession(sessionId) {
    setProgOpenSession(sessionId)
    if (sessionId) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        sessionRefs.current[sessionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }))
    }
  }

  function openReadiness() {
    setTab('hjem')
    setMereOpen(true)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = readinessCardRef.current
      if (!card) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }))
  }

  // Gemmer serverside via RPC (queueWrite: overlever cold-start/midlertidige
  // netvaerksfejl uden at blokere UI'en) og opdaterer lokal tilstand med det
  // samme, saa guiden lukker uafhaengigt af skrivningens svar. Spring-over
  // kalder denne PRAECIS som "gennemfoert" gør, saa de to sætter samme tilstand.
  function completeOnboardingGuide() {
    queueWrite(() => supabase.rpc('complete_athlete_onboarding_v1'))
    setOnboardingDone(true)
    setGuideOpen(false)
    setGuideStep(0)
  }

  function advanceOnboardingGuide() {
    if (isLastOnboardingGuideStep(guideStep)) {
      completeOnboardingGuide()
      setTab(currentWeek ? 'program' : 'hjem')
      return
    }
    setGuideStep(i => i + 1)
  }

  // Det ene faste sted guiden kan genstartes fra: kontomenuen (se topbar).
  function restartOnboardingGuide() {
    setGuideStep(0)
    setGuideOpen(true)
  }

  async function fetchPastLogs(week, athleteId) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setPastLogs([]); return }
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .in('exercise_id', exerciseIds),
      onReadError('Tidligere logs', athleteId),
    )
    if (!ok) return
    setPastLogs(data || [])
  }

  async function fetchExerciseLogs(athleteId, week) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setExerciseLogs([]); return }
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .in('exercise_id', exerciseIds),
      onReadError('Sæt-loggen', athleteId),
    )
    if (!ok) return
    const rows = data || []
    setExerciseLogs(prev => {
      // Behold endnu-ikke-bekræftede optimistiske rækker (baggrundsskrivning stadig
      // i kø), så et flueben ikke blinker væk mens en anden skrivning er undervejs.
      const pending = prev.filter(l => l._optimistic &&
        !rows.some(r => r.exercise_id === l.exercise_id && r.set_number === l.set_number))
      return [...rows, ...pending]
    })
    setLogInputs(prev => mergeAthleteSetInputs(prev, rows))
  }

  async function fetchLastLogs(athleteId, week) {
    const exerciseNames = [...new Set((week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.name)))]
    if (exerciseNames.length === 0) return
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('weight, reps_completed, logged_at, exercises(name)')
        .eq('athlete_id', athleteId)
        .order('logged_at', { ascending: false })
        .limit(500),
      onReadError('Seneste vægte', athleteId),
    )
    if (!ok || !data) return
    const map = {}
    for (const log of data) {
      const name = log.exercises?.name
      if (name && !map[name.toLowerCase()] && (log.weight > 0 || log.reps_completed > 0)) {
        map[name.toLowerCase()] = { weight: log.weight, reps_completed: log.reps_completed }
      }
    }
    setLastLogByExerciseName(map)
  }

  async function fetchExerciseHistory(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('weight, reps_completed, rpe_actual, logged_at, set_number, exercises(name)')
        .eq('athlete_id', athleteId)
        .eq('skipped', false)
        .gt('weight', 0)
        .order('logged_at', { ascending: false })
        .limit(1500),
      onReadError('Øvelseshistorik', athleteId),
    )
    if (!ok || !data) return
    const byName = {}
    for (const log of data) {
      const name = log.exercises?.name?.toLowerCase()
      if (!name) continue
      const date = log.logged_at.slice(0, 10)
      if (!byName[name]) byName[name] = {}
      if (!byName[name][date]) byName[name][date] = []
      byName[name][date].push({ weight: log.weight, reps: log.reps_completed, rpe: log.rpe_actual, set: log.set_number })
    }
    const history = {}
    for (const [name, dateMap] of Object.entries(byName)) {
      const dates = Object.keys(dateMap).sort().reverse().slice(0, 3)
      history[name] = dates.map(date => ({ date, sets: dateMap[date].sort((a, b) => a.set - b.set) }))
    }
    setExerciseHistory(history)
  }

  // Skriver ét sæt til databasen, serialiseret pr. nøgle. Fordi skridtene kædes
  // (chain.then), ser en efterfølgende skrivning altid det rigtige id fra den
  // foregående INSERT → aldrig dubletter, og seneste værdi vinder. Returnerer
  // { data, error } fra det underliggende kald, så kalderen kan rulle tilbage.
  function persistSetLog(key, exerciseId, setNumber, payload, realExistingId) {
    const ref = setWriteRef.current[key] || (setWriteRef.current[key] = { realId: null, chain: Promise.resolve() })
    if (realExistingId) ref.realId = realExistingId
    const task = ref.chain.then(async () => {
      if (ref.realId) {
        const upd = await queueWrite(() => supabase.from('exercise_logs').update(payload).eq('id', ref.realId).select('id'))
        if (upd.error) return upd                                   // transient fejl → lad kalderen vise fejl/retry (ingen dublet)
        if (Array.isArray(upd.data) && upd.data.length) return upd  // rækken blev opdateret
        ref.realId = null                                           // rækken findes ikke mere (fx slettet) → INSERT nedenfor
      }
      const res = await queueWrite(() => supabase
        .from('exercise_logs')
        .insert({ exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload })
        .select('id').single())
      if (res?.data?.id) ref.realId = res.data.id
      return res
    })
    // Hold kæden i live selv hvis en skrivning fejler/kaster.
    ref.chain = task.then(() => {}, () => {})
    return task
  }

  async function logSet(exerciseId, setNumber, totalSets, repsCompleted, plannedRpe, { localFallback = false } = {}) {
    const key = `${exerciseId}_${setNumber}`
    const input = logInputs[key] || {}
    const payload = {
      weight: parseFloat(input.weight) || 0,
      reps_completed: parseInt(repsCompleted) || 0,
      note: input.note || null,
      // Ingen egen RPE valgt → gem den planlagte RPE, så vi altid har data at
      // autoregulere på. Rører atleten vælgeren, gemmes deres værdi i stedet.
      rpe_actual: input.rpe ? parseFloat(input.rpe) : (plannedRpe ?? null),
      rpe_planned: plannedRpe ?? null,
      skipped: false,
    }
    // Kun en rigtig (bekræftet) række afgør INSERT vs. UPDATE i databasen — en
    // optimistisk række har ikke et gyldigt db-id at opdatere på.
    const realExisting = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)

    // OPTIMISTISK: vis fluebenet ØJEBLIKKELIGT og skriv i baggrunden. Atleten skal
    // aldrig vente på netværket for at se at sættet er registreret — det var netop
    // ventetiden (op til ~60s på det første kald efter app-åbning) der var buggen.
    const optimisticId = `optimistic_${key}`
    if (existing) {
      setExerciseLogs(prev => prev.map(l => l.id === existing.id ? { ...l, ...payload } : l))
    } else {
      setExerciseLogs(prev => [
        ...prev,
        { id: optimisticId, exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload, _optimistic: true },
      ])
    }
    // ORDRE 263 · commit 2: pausen starter automatisk, med det samme
    // (optimistisk, ligesom resten af denne funktion) — ikke først når
    // skrivningen har svaret. "Den pause der står i programmet" læses fra
    // øvelsens note (se restBetweenSets.js); ingen note → en fornuftig
    // standard. Persisteres (restPause.js), så den overlever et lukket/
    // genåbnet vindue.
    const loggedExercise = allWeeks.flatMap(w => w.sessions || []).flatMap(sess => sess.exercises || []).find(e => e.id === exerciseId)
    const restSeconds = restSecondsForExercise(loggedExercise)
    startRestPause(athlete.id, restSeconds, loggedExercise?.name)
    setRestPause({ startedAt: Date.now(), durationSeconds: restSeconds, label: loggedExercise?.name || null })
    setSetConfirm(p => ({ ...p, [key]: 'saved' }))
    let fadeTimer
    const scheduleFade = () => {
      fadeTimer = setTimeout(() => {
        setSetConfirm(p => ({ ...p, [key]: 'fading' }))
        setTimeout(() => setSetConfirm(p => { const n = { ...p }; delete n[key]; return n }), 300)
      }, 1700)
    }
    scheduleFade()
    // Auto-fill next set weight if empty
    if (setNumber < totalSets) {
      const nextKey = `${exerciseId}_${setNumber + 1}`
      setLogInputs(p => ({
        ...p,
        [nextKey]: nextAthleteSetInput(input, p[nextKey]),
      }))
    }

    // Baggrundsskrivning: serialiseret pr. sæt-nøgle + retry-kø (se persistSetLog).
    // Ved fejl: vis en diskret fejl og rul den optimistiske ændring tilbage, så
    // UI matcher virkeligheden. Program-fanens egen Log-knap bruger denne gren
    // uændret (verify:athlete-write-failures/e2e:fejl låser den).
    // ORDRE 293 · F5: "Godkendt" (localFallback) lægger sættet i den lokale kø
    // FØR skrivningen forsøges, og fjerner det igen ved succes (nedenfor). Før
    // stod køen først efter queueWrites fire forsøg (~4 s, længere på et dårligt
    // net) — lukkes/dræbes fanen i det vindue, var et bekræftet sæt væk.
    // pendingSyncCount røres først ved en fejlet skrivning: "gemt lokalt"-
    // linjen må ikke blinke ved hver vellykket skrivning.
    if (localFallback) saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload })
    const { error } = await persistSetLog(key, exerciseId, setNumber, payload, realExisting?.id)
    if (error) {
      // ORDRE 280 · commit 4 — "Godkendt" i Dagens pas beder om localFallback:
      // sættet er allerede vist som logget (optimistisk, ovenfor); i stedet
      // for at rulle det tilbage til en fejlbesked, gemmes payloaden lokalt
      // (offlineSetQueue.js) og sendes igen når forbindelsen er der (se
      // flushOfflineSets). Ingen ny tabel — samme exercise_logs-række som
      // ellers, bare forsinket. (Selve kø-posten er lagt FØR skrivningen, se
      // ovenfor; her skrives den igen, hvis den første gang ikke kunne gemmes.)
      if (localFallback) {
        saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload })
        setPendingSyncCount(countOfflineSets(athlete.id))
        return
      }
      clearTimeout(fadeTimer)
      setSetConfirm(p => ({ ...p, [key]: 'error' }))
      if (realExisting) {
        // Fortryd den optimistiske opdatering — sæt rækken tilbage til db-værdien.
        setExerciseLogs(prev => prev.map(l => l.id === realExisting.id ? realExisting : l))
      } else {
        setExerciseLogs(prev => prev.filter(l => !(l._optimistic && l.exercise_id === exerciseId && l.set_number === setNumber)))
      }
      return
    }
    if (localFallback) {
      clearOfflineSet(athlete.id, key)
      setPendingSyncCount(countOfflineSets(athlete.id))
    }
    fetchExerciseLogs(athlete.id, currentWeek)

    // PR-detektion (est. 1RM-baseret, Epley) — skelner vægt/rep/styrke-PR
    const newReps = parseInt(repsCompleted) || 0
    if (payload.weight > 0 && newReps > 0) {
      const exerciseName = allWeeks
        .flatMap(w => w.sessions || [])
        .flatMap(s => s.exercises || [])
        .find(e => e.id === exerciseId)?.name
      if (exerciseName) {
        const e1rm = r => estimatedOneRepMax(r.weight, r.reps || 1)
        const newSet = { weight: payload.weight, reps: newReps }
        const { data: prData, error: prFetchError } = await supabase
          .from('personal_records')
          .select('weight, reps')
          .eq('athlete_id', athlete.id)
          .eq('exercise_name', exerciseName)
        // G14 (ordre 131): en fejlet INSERT her blev tidligere aldrig tjekket —
        // atleten kunne se PR-fejringen ("PR!") selvom rækken aldrig nåede
        // databasen. queueWrite giver samme genforsøg-med-backoff som resten af
        // appens skrivninger; lykkes den stadig ikke, vises INGEN fejring (en
        // udeblevet fejring er rigtigere end en løgnagtig), og coachen kan se
        // det via session_context næste gang atleten uploader en video.
        const savePR = () => queueWrite(() => supabase.from('personal_records').insert({
          athlete_id: athlete.id,
          exercise_name: exerciseName,
          weight: newSet.weight,
          reps: newSet.reps,
        }))
        if (prFetchError) {
          // En fejlet SELECT er IKKE det samme som "ingen tidligere data" — tolkes
          // den sådan, overskrives en ægte baseline af det aktuelle sæt. Springes
          // over her; selve sætloggen er allerede gemt ovenfor.
          logFrontendError('PR-detektion sprunget over: SELECT på personal_records fejlede', prFetchError, athlete.id)
        } else if ((prData || []).length === 0) {
          // Allerførste registrering på øvelsen → gem baseline uden notifikation
          const { error: baselineError } = await savePR()
          if (baselineError) {
            logFrontendError('PR-detektion: baseline-INSERT på personal_records fejlede', baselineError, athlete.id)
            recordSilentFail(athlete.id, 'silent:pr-insert-failed')
          }
        } else {
          const rows = prData
          const bestWeight = Math.max(...rows.map(r => r.weight || 0))
          const bestE1rm = Math.max(...rows.map(e1rm))
          // Flest reps tidligere på en vægt mindst lige så tung som det nye sæt
          const repsAtWeight = rows.filter(r => (r.weight || 0) >= newSet.weight).map(r => r.reps || 0)
          const bestRepsAtWeight = repsAtWeight.length ? Math.max(...repsAtWeight) : 0
          let prType = null
          if (newSet.weight > bestWeight) prType = 'vægt'
          else if (bestRepsAtWeight > 0 && newSet.reps > bestRepsAtWeight) prType = 'rep'
          else if (e1rm(newSet) > bestE1rm * 1.001) prType = 'styrke'
          if (prType) {
            const { error: prSaveError } = await savePR()
            if (prSaveError) {
              logFrontendError('PR-detektion: INSERT på personal_records fejlede', prSaveError, athlete.id)
              recordSilentFail(athlete.id, 'silent:pr-insert-failed')
            } else {
              setPrToast({ name: exerciseName, type: prType })
              setPrToastFading(false)
              setTimeout(() => setPrToastFading(true), 2400)
              setTimeout(() => setPrToast(null), 3000)
            }
          }
        }
      }
    }
  }

  // ORDRE 280 · commit 2 — Dagens pas' "Godkendt"-knap kalder logSet gennem
  // her (i stedet for direkte), så kortet kan huske hvilket sæt der lige blev
  // logget (til "Fortryd sidste sæt" nedenfor). Program-fanens egen Log-knap
  // rører IKKE dette — den kalder stadig logSet direkte, uændret adfærd
  // (verify:athlete-write-failures/e2e:fejl låser den offline-fejlflowet der).
  async function logDagensPasSet(ex, setNumber, totalSets, repsToLog, plannedRpe) {
    setLastLoggedSet({ exerciseId: ex.id, setNumber })
    await logSet(ex.id, setNumber, totalSets, repsToLog, plannedRpe, { localFallback: true })
  }

  // ORDRE 280 · commit 4 — sender ventende sæt (offlineSetQueue.js) igen når
  // forbindelsen er der. Kaldes ved athlete-load og ved 'online'-event; en
  // fejlet skrivning her bliver liggende i køen til næste forsøg.
  async function flushOfflineSets() {
    if (!athlete?.id) return
    const queue = loadOfflineSets(athlete.id)
    const keys = Object.keys(queue)
    if (!keys.length) return
    for (const key of keys) {
      const { exerciseId, setNumber, payload } = queue[key]
      let realId = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)?.id
      if (!realId) {
        // ORDRE 293 · F5: køen står nu FØR skrivningen, så en post kan høre til
        // et sæt serveren allerede har taget imod (appen døde før svaret kom
        // tilbage). Slå rækken op først, så genafspilningen bliver en UPDATE
        // og ikke en dublet. Kan opslaget ikke gennemføres, ligger posten
        // stadig i køen til næste forsøg.
        const { data: found, error: lookupError } = await supabase
          .from('exercise_logs').select('id')
          .eq('athlete_id', athlete.id).eq('exercise_id', exerciseId).eq('set_number', setNumber)
          .limit(1)
        if (lookupError) continue
        realId = found?.[0]?.id
      }
      const { error } = await persistSetLog(key, exerciseId, setNumber, payload, realId)
      if (!error) clearOfflineSet(athlete.id, key)
    }
    setPendingSyncCount(countOfflineSets(athlete.id))
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  // "Fortryd sidste sæt": sletter log-rækken igen (samme mønster som
  // unskipSet), rydder den pause sættet startede, og genåbner sættet til
  // redigering — logInputs er ikke rørt, så vægt/reps stadig står der.
  // Kø'et via setWriteRef (samme kæde som persistSetLog), så en sletning
  // aldrig løber forbi en INSERT der endnu er undervejs (ville efterlade en
  // spøgelsesrække, hvis sletningen ramte databasen FØR insertet).
  async function undoLoggedSet(exerciseId, setNumber) {
    const key = `${exerciseId}_${setNumber}`
    setExerciseLogs(prev => prev.filter(l => !(l.exercise_id === exerciseId && l.set_number === setNumber)))
    clearRestPause(athlete.id)
    setRestPause(null)
    setLastLoggedSet(null)
    // Sættet kan være ventende lokalt (blev "Godkendt" uden net, se
    // flushOfflineSets) — fortryd skal ikke sende det senere.
    clearOfflineSet(athlete.id, key)
    setPendingSyncCount(countOfflineSets(athlete.id))
    const ref = setWriteRef.current[key]
    const chain = ref ? ref.chain : Promise.resolve()
    const task = chain.then(async () => {
      const idToDelete = ref?.realId
      if (!idToDelete) return
      const { error } = await queueWrite(() => supabase.from('exercise_logs').delete().eq('id', idToDelete))
      if (error) { logFrontendError('Fortryd sæt: sletning fejlede', error, athlete.id); return }
      if (ref.realId === idToDelete) ref.realId = null
    })
    if (ref) ref.chain = task.then(() => {}, () => {})
    await task
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  // ORDRE 320 · blok 1 — "ret" på et allerede klaret sæt (Dagens pas) skal
  // IKKE slette log-rækken (det gjorde undoLoggedSet ovenfor, se
  // docs/KRITIK-314.md fund 3: sletningen fik nextSetInSession til at anse
  // sættet for uloggede igen, hvilket skjulte alle senere sæt og fik
  // gen-godkendelse til at springe stille forbi dem). Genbruger i stedet den
  // opdateringsvej der allerede findes: persistSetLog opdaterer samme række
  // (samme id) når ref.realId er sat — ingen ny skrivevej, ingen migration.
  // Samme offline-mønster som logSet's localFallback (saveOfflineSet/
  // clearOfflineSet), så "ret" også virker uden forbindelse (se 293).
  async function updateLoggedSet(exerciseId, setNumber, updates) {
    const key = `${exerciseId}_${setNumber}`
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)
    if (!existing) return false
    const payload = {
      weight: parseFloat(updates.weight) || 0,
      reps_completed: parseInt(updates.reps) || 0,
      note: existing.note ?? null,
      rpe_actual: existing.rpe_actual ?? null,
      rpe_planned: existing.rpe_planned ?? null,
      skipped: false,
    }
    setExerciseLogs(prev => applySetEdit(prev, exerciseId, setNumber, payload))
    saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload })
    const { error } = await persistSetLog(key, exerciseId, setNumber, payload, existing.id)
    if (error) {
      // Samme optimistiske fallback som logSet: forbliver rettet i UI,
      // ligger i offline-køen til flushOfflineSets sender den igen.
      logFrontendError('Ret sæt: opdatering fejlede, lagt i offline-kø', error, athlete.id)
      setPendingSyncCount(countOfflineSets(athlete.id))
      return true
    }
    clearOfflineSet(athlete.id, key)
    setPendingSyncCount(countOfflineSets(athlete.id))
    fetchExerciseLogs(athlete.id, currentWeek)
    return true
  }

  async function skipSet(exerciseId, setNumber, plannedRpe) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    const payload = { skipped: true, weight: 0, reps_completed: 0, note: null, rpe_actual: null, rpe_planned: plannedRpe ?? null }
    const ok = await runGuardedWrite(
      () => existing
        ? supabase.from('exercise_logs').update(payload).eq('id', existing.id)
        : supabase.from('exercise_logs').insert({ exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload }),
      () => showFlash('Sættet kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function skipExercise(ex) {
    const plannedRpe = parsePlannedRpe(ex.intensity)
    const toSkip = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).filter(setNum =>
      !exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum)
    )
    if (toSkip.length === 0) return
    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(
        toSkip.map(setNum => ({ exercise_id: ex.id, athlete_id: athlete.id, set_number: setNum, skipped: true, weight: 0, reps_completed: 0, rpe_planned: plannedRpe ?? null }))
      ),
      () => showFlash('Øvelsen kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function unskipSet(exerciseId, setNumber) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (!existing) return
    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').delete().eq('id', existing.id),
      () => showFlash('Kunne ikke fortryde spring over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function saveFeedback(sessionId) {
    const input = feedbackInputs[sessionId] || {}
    if (!input.rating) return
    setPendingSessionAction(`${sessionId}:feedback`)
    const ok = await runGuardedWrite(
      () => supabase.from('sessions').update({
        athlete_rating: input.rating,
        athlete_comment: input.comment || null,
      }).eq('id', sessionId),
      () => showFlash('Feedbacken blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return
    setAllWeeks(prev => prev.map(w => ({
      ...w,
      sessions: (w.sessions || []).map(s => s.id === sessionId ? { ...s, athlete_rating: input.rating, athlete_comment: input.comment || null } : s),
    })))
  }

  async function fetchWeightLogs(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('weight_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('logged_at', { ascending: false })
        .limit(30),
      onReadError('Vægtloggen', athleteId),
    )
    if (!ok) return
    setWeightLogs(data || [])
  }

  // G15 (ordre 131): var før et rent "fyr og glem" — feltet blev ryddet og
  // ingen fejl vist uanset om skrivningen lykkedes. En fejlet vægtlogning så
  // derfor ud som en gemt vægt; kun et efterfølgende (uændret) tal i grafen
  // afslørede det, og kun hvis atleten selv lagde mærke til det.
  async function logWeight() {
    if (!weightInput || !athlete) return
    setSavingWeight(true)
    const todayStr = today()
    const existing = weightLogs.find(l => l.logged_at === todayStr)
    const ok = await runGuardedWrite(
      () => existing
        ? supabase.from('weight_logs').update({ weight: parseFloat(weightInput) }).eq('id', existing.id)
        : supabase.from('weight_logs').insert({ athlete_id: athlete.id, weight: parseFloat(weightInput), logged_at: todayStr }),
      error => {
        logFrontendError('logWeight fejlede', error, athlete.id)
        recordSilentFail(athlete.id, 'silent:weight-log-failed')
        showFlash('Vægten blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error')
      },
    )
    setSavingWeight(false)
    if (!ok) return // input bevares bevidst, så atleten ikke skal taste tallet igen
    setWeightInput('')
    fetchWeightLogs(athlete.id)
  }

  async function fetchAthleteMessages(id) {
    const athleteId = id || athlete?.id
    if (!athleteId) return
    const { data, ok } = await runGuardedRead(
      () => supabase.from('messages').select('*').eq('athlete_id', athleteId).order('created_at'),
      onReadError('Beskederne', athleteId),
    )
    if (!ok) return
    const msgs = data || []
    setMessages(msgs)
    const unread = msgs.filter(m => m.sender_role === 'coach' && !m.read_at).length
    setUnreadMsgCount(unread)
  }

  // Markér ét spor som set: coach-beskeder i sporet (read_at) og — for teknik —
  // også de delte målinger (athlete_seen_at), så coachen kan se at feedback er set.
  async function markTrackRead(track) {
    if (!athlete) return
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('athlete_id', athlete.id)
      .eq('sender_role', 'coach')
      .eq('category', track)
      .is('read_at', null)
    fetchAthleteMessages(athlete.id)
  }

  // Markér én delt måling som set når atleten åbner den ("Se måling"), så
  // coachen kan se at feedbacken faktisk er set (parity med read_by_coach).
  async function markVideoSeen(id) {
    const target = sharedVideoAnalyses.find(a => a.id === id)
    if (!target || target.athlete_seen_at) return
    const now = new Date().toISOString()
    // Fejl her (RLS/net) må ikke vælte visningen; prøves igen næste åbning.
    const { error } = await supabase.from('video_analyses').update({ athlete_seen_at: now }).eq('id', id)
    if (!error) setSharedVideoAnalyses(prev => prev.map(a => a.id === id ? { ...a, athlete_seen_at: now } : a))
  }

  async function sendAthleteMessage() {
    if (!messageInput.trim() || !athlete) return
    const content = messageInput.trim()
    // Ryd IKKE feltet før skrivningen er bekræftet — ellers ser en fejlet
    // afsendelse ud som en succes, og beskeden er væk uden mulighed for at prøve igen.
    const ok = await runGuardedWrite(
      () => supabase.from('messages').insert({ athlete_id: athlete.id, sender_role: 'athlete', content, category: msgTrack }),
      () => showFlash('Beskeden blev ikke sendt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    setMessageInput('')
    fetchAthleteMessages(athlete.id)
  }

  function formatMsgTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayDiff = Math.floor((today - msgDay) / 86400000)
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    if (dayDiff === 0) return time
    if (dayDiff === 1) return `I går ${time}`
    if (dayDiff < 7) return d.toLocaleDateString('da-DK', { weekday: 'long' }) + ' ' + time
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  // Coachens delte videofeedback som udfoldelige kort (én kilde: video_analyses).
  // Bruges både på hjem og i "Teknik & løft"-sporet — "se måling" udfolder banen.
  const renderSharedFeedbackCards = () => (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      {sharedVideoAnalyses.map(analysis => {
        const open = openSharedVideoId === analysis.id
        const preview = athleteVideoPathPreview(analysis.bar_path)
        const feedback = analysis.athlete_feedback || {}
        const works = Array.isArray(feedback.works) ? feedback.works.filter(item => item?.text).slice(0, 2) : []
        const focus = Array.isArray(feedback.focus) ? feedback.focus.filter(item => item?.text).slice(0, 2) : []
        const nextSet = Array.isArray(feedback.next_set) ? feedback.next_set.filter(item => item?.text).slice(0, 2) : []
        const personalBaseline = videoCoachPersonalBaselineForAnalysis(feedback, analysis,
          athlete?.id)
        return (
          <div key={analysis.id} style={{ border: '1px solid rgba(237,234,226,0.08)', background: 'rgba(20,20,16,0.55)' }}>
            <button onClick={() => { const opening = !open; setOpenSharedVideoId(opening ? analysis.id : null); if (opening) markVideoSeen(analysis.id) }} style={{ width: '100%', border: 0, background: 'transparent', color: '#edeae2', cursor: 'pointer', padding: '0.75rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.7rem' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.78rem' }}>
                  {!analysis.athlete_seen_at && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#c8923a', marginRight: 6, verticalAlign: 'middle' }} />}
                  {ATHLETE_VIDEO_LIFTS[analysis.lift] || analysis.lift} · {athleteVideoVariationLabel(analysis.lift, analysis.variation)}
                </span>
                <span style={{ display: 'block', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', marginTop: '0.25rem' }}>
                  {new Date(analysis.analyzed_at).toLocaleDateString('da-DK')}{analysis.load_kg != null ? ` · ${analysis.load_kg} kg` : ''}{analysis.reps_count ? ` · ${analysis.reps_count} reps` : ''}{analysis.rpe != null ? ` · RPE ${analysis.rpe}` : ''}
                </span>
              </span>
              <span style={{ color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {open ? 'Skjul' : 'Se måling'}<span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
              </span>
            </button>
            {open && (
              <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem' }}>
                {preview && (
                  <div style={{ minHeight: '170px', background: '#141410', border: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem' }}>
                    <svg viewBox={preview.viewBox} width="100%" height="170" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
                      <line x1={preview.referenceX} y1={preview.y1} x2={preview.referenceX} y2={preview.y2} stroke="rgba(237,234,226,0.14)" strokeWidth="1" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                      <polyline points={preview.points} fill="none" stroke="#c8923a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={preview.start.x} cy={preview.start.y} r="4" fill="#67dff5" vectorEffect="non-scaling-stroke" />
                      <circle cx={preview.end.x} cy={preview.end.y} r="4" fill="#edeae2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                )}
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {personalBaseline && <div style={{ borderLeft: '2px solid #c8923a', background: 'rgba(200,146,58,0.04)', padding: '0.55rem 0.65rem' }}><div style={{ ...s.fieldLabel, color: '#c8923a' }}>Din udvikling</div><div style={{ color: '#c9b47f', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{videoCoachPersonalBaselineAthleteText(personalBaseline)}</div><div style={{ color: '#77746d', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', lineHeight: 1.4, marginTop: '0.25rem' }}>Sammenlignet med {personalBaseline.evidence_ref.n_analyses} kvalitetssikrede analyser af samme løft og variation.</div></div>}
                  {works.length > 0 && <div><div style={s.fieldLabel}>Det fungerer</div>{works.map((item, index) => <div key={index} style={{ color: '#9fbd9a', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{item.text}</div>)}</div>}
                  {focus.length > 0 && <div><div style={s.fieldLabel}>Dit fokus</div>{focus.map((item, index) => <div key={index} style={{ color: '#d79a83', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{item.text}</div>)}</div>}
                  {nextSet.length > 0 && <div><div style={s.fieldLabel}>Næste gang</div>{nextSet.map((item, index) => <div key={index} style={{ color: '#c9b47f', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{item.text}</div>)}</div>}
                  {!works.length && !focus.length && !nextSet.length && <div style={{ color: '#7a7770', fontSize: '0.66rem', lineHeight: 1.45 }}>Coachen har delt målingen uden en særskilt tekstkommentar.</div>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  async function fetchLogs(athleteId, date = kostDate) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .eq('date', date)
        .order('created_at'),
      onReadError('Dagens kostlog', athleteId),
    )
    if (!ok) return
    setLogs(data || [])
  }

  async function fetchHistoricalMealLogs(athleteId) {
    const from = new Date()
    from.setDate(from.getDate() - 28)
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_logs')
        .select('date, kcal')
        .eq('athlete_id', athleteId)
        .gte('date', from.toISOString().slice(0, 10))
        .order('date'),
      onReadError('Kosthistorikken', athleteId),
    )
    if (!ok) return
    setHistoricalMealLogs(data || [])
  }

  // Find de fødevarer atleten oftest logger (sidste 30 dage) til hurtig gen-log.
  async function fetchFrequentFoods(athleteId) {
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_logs')
        .select('meal, kcal, protein, carb, fat, date')
        .eq('athlete_id', athleteId)
        .gte('date', from.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
      onReadError('Hyppige fødevarer', athleteId),
    )
    if (!ok) return
    const map = new Map()
    for (const l of data || []) {
      if (!map.has(l.meal)) map.set(l.meal, { meal: l.meal, kcal: l.kcal, protein: l.protein, carb: l.carb, fat: l.fat, count: 0 })
      map.get(l.meal).count++
    }
    const list = [...map.values()].filter(f => f.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8)
    setFrequentFoods(list)
  }

  async function quickLogFood(f) {
    if (!athlete) return
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert({
        athlete_id: athlete.id, date: kostDate,
        meal: f.meal, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat,
      }),
      () => showFlash('Måltidet blev ikke logget. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (ok) fetchLogs(athlete.id)
  }

  async function fetchMealTemplates(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_templates')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false }),
      onReadError('Skabelonerne', athleteId),
    )
    if (!ok) return
    setMealTemplates(data || [])
  }

  async function copyYesterday() {
    const yStr = shiftDate(kostDate, -1) // dagen før den viste dag
    const { data } = await supabase
      .from('meal_logs')
      .select('meal, kcal, protein, carb, fat')
      .eq('athlete_id', athlete.id)
      .eq('date', yStr)
    if (!data || data.length === 0) return
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert(
        data.map(item => ({ ...item, athlete_id: athlete.id, date: kostDate }))
      ),
      () => showFlash('Måltiderne kunne ikke kopieres. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (ok) fetchLogs(athlete.id)
  }

  async function saveTemplate() {
    if (!templateNameInput.trim() || !logs.length || !athlete) return
    const items = logs.map(({ meal, kcal, protein, carb, fat }) => ({ meal, kcal, protein, carb, fat }))
    const ok = await runGuardedWrite(
      () => supabase.from('meal_templates').insert({ athlete_id: athlete.id, name: templateNameInput.trim(), items }),
      () => showFlash('Skabelonen blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchMealTemplates(athlete.id)
    setShowSaveTemplate(false)
    setTemplateNameInput('')
  }

  async function logTemplate(template) {
    if (!athlete) return
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert(
        template.items.map(item => ({ ...item, athlete_id: athlete.id, date: kostDate }))
      ),
      () => showFlash('Skabelonen kunne ikke logges. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchLogs(athlete.id)
    setShowTemplates(false)
  }

  async function deleteTemplate(id) {
    await supabase.from('meal_templates').delete().eq('id', id)
    setMealTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function fetchCustomFoods(athleteId) {
    // RLS returnerer delte fødevarer (is_shared) + egne. Tag 'mine' til badges/sletning.
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('custom_foods')
        .select('*')
        .order('name', { ascending: true }),
      onReadError('Fødevarelisten', athleteId),
    )
    if (!ok) return
    setCustomFoods((data || []).map(f => ({ ...f, mine: f.athlete_id === athleteId })))
  }

  function onSearchInput(e) {
    const q = e.target.value
    setSearchQuery(q)
    setSelectedFood(null)
    if (q.length < 2) { setSearchResults([]); return }
    const ql = q.toLowerCase()
    const custom = customFoods
      .filter(f => f.name.toLowerCase().includes(ql))
      .map(f => ({ ...f, isCustom: f.mine, isShared: !f.mine }))
    const builtin = LOCAL_FOODS.filter(f => f.name.toLowerCase().includes(ql))
    setSearchResults([...custom, ...builtin])
  }

  function selectFood(f) {
    setSelectedFood(f)
    setSearchQuery(f.name)
    setSearchResults([])
    // Hvis fødevaren har en stk-enhed, default til 1 af den (hurtigere); ellers 100 g.
    const units = unitsForFood(f)
    if (units.length > 1) { setUnitIdx(1); setAmount('1') }
    else { setUnitIdx(0); setAmount('100') }
  }

  async function addFromSearch() {
    if (!selectedFood || !athlete) return
    const units = unitsForFood(selectedFood)
    const unit = units[unitIdx] || units[0]
    const amt = parseFloat(amount) || 0
    const grams = amt * unit.grams
    const ratio = grams / 100
    // Beskriv portionen i navnet når enheden ikke er gram, så loggen er læsbar.
    const label = unit.label === 'g'
      ? `${selectedFood.name} · ${Math.round(grams)} g`
      : `${selectedFood.name} · ${amt} ${unit.label} (${Math.round(grams)} g)`
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert({
        athlete_id: athlete.id,
        date: kostDate,
        meal: label,
        kcal: Math.round(selectedFood.kcal100 * ratio),
        protein: Math.round(selectedFood.protein100 * ratio),
        carb: Math.round(selectedFood.carb100 * ratio),
        fat: Math.round(selectedFood.fat100 * ratio),
      }),
      () => showFlash('Fødevaren blev ikke logget. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    setSelectedFood(null)
    setSearchQuery('')
    fetchLogs(athlete.id)
  }

  // Hurtig-tilføj direkte fra søgeresultatet: 1 stk-enhed hvis den findes, ellers 100 g.
  // Rydder IKKE søgningen, så man kan trykke + på flere varer i træk (multi-add).
  async function quickAddSearchFood(f) {
    if (!athlete) return
    const units = unitsForFood(f)
    const unit = units.length > 1 ? units[1] : units[0]
    const amt = unit.label === 'g' ? 100 : 1
    const grams = amt * unit.grams
    const ratio = grams / 100
    const label = unit.label === 'g'
      ? `${f.name} · ${Math.round(grams)} g`
      : `${f.name} · ${amt} ${unit.label} (${Math.round(grams)} g)`
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert({
        athlete_id: athlete.id,
        date: kostDate,
        meal: label,
        kcal: Math.round(f.kcal100 * ratio),
        protein: Math.round(f.protein100 * ratio),
        carb: Math.round(f.carb100 * ratio),
        fat: Math.round(f.fat100 * ratio),
      }),
      () => showFlash(`${f.name} blev ikke logget. Tjek din forbindelse og prøv igen.`, 'error'),
    )
    if (!ok) return
    fetchLogs(athlete.id)
    showFlash(`${f.name} tilføjet`)
  }

  async function saveCustomFood() {
    if (!createFood.name.trim() || !athlete) return
    const food = {
      athlete_id: athlete.id,
      name: createFood.name.trim(),
      kcal100: parseFloat(createFood.kcal100) || 0,
      protein100: parseFloat(createFood.protein100) || 0,
      carb100: parseFloat(createFood.carb100) || 0,
      fat100: parseFloat(createFood.fat100) || 0,
      unit_label: createFood.unit_label.trim() || null,
      unit_grams: parseFloat(createFood.unit_grams) || null,
      is_shared: shareFood,
    }
    const { data } = await supabase.from('custom_foods').insert(food).select().maybeSingle()
    if (data) {
      const saved = { ...data, isCustom: true, mine: true }
      setCustomFoods(prev => [saved, ...prev])
      selectFood(saved)
      setShowCreateFood(false)
      setCreateFood({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
    }
  }

  async function autoCompleteSession(session) {
    const exerciseIds = (session.exercises || []).map(e => e.id)
    if (exerciseIds.length === 0) { showFlash('Ingen øvelser fundet i sessionen.', 'error'); return }

    setPendingSessionAction(`${session.id}:autofill`)
    const { data: existing, error: fetchErr } = await supabase
      .from('exercise_logs')
      .select('exercise_id, set_number')
      .eq('athlete_id', athlete.id)
      .in('exercise_id', exerciseIds)
    if (fetchErr) { setPendingSessionAction(null); showFlash('Sættene kunne ikke tjekkes. Tjek din forbindelse og prøv igen.', 'error'); return }

    const logged = new Set((existing || []).map(l => `${l.exercise_id}_${l.set_number}`))
    const rows = []
    for (const ex of (session.exercises || [])) {
      const last = lastLogByExerciseName[ex.name?.toLowerCase()]
      const weight = last?.weight ?? parseFloat(ex.recommended_weight) ?? 0
      const reps = last?.reps_completed ?? parseInt(ex.reps) ?? 0
      // Ikke-skippede sæt får planlagt RPE som faktisk RPE (samme logik som logSet).
      const plannedRpe = parsePlannedRpe(ex.intensity)
      for (let n = 1; n <= (parseInt(ex.sets) || 0); n++) {
        if (logged.has(`${ex.id}_${n}`)) continue
        rows.push({ exercise_id: ex.id, athlete_id: athlete.id, set_number: n, weight, reps_completed: reps, note: null, rpe_actual: plannedRpe ?? null, rpe_planned: plannedRpe ?? null, skipped: false })
      }
    }

    if (rows.length === 0) {
      setPendingSessionAction(null)
      showFlash('Alle sæt er allerede logget.')
      return
    }

    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(rows),
      () => showFlash('Sættene kunne ikke udfyldes. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return

    showFlash(`${rows.length} sæt udfyldt.`)
    await fetchExerciseLogs(athlete.id, currentWeek)
    await fetchPastLogs(allWeeks[viewingWeekIdx], athlete.id)
  }

  // Markér alle ikke-loggede sæt i sessionen som sprunget over. Bruges når atleten
  // ikke nåede hele træningen og bare vil lukke den (fjerner "Fortsæt"-naget) uden
  // at fabrikere gennemførte sæt — i modsætning til autoCompleteSession.
  async function skipRemainingSets(session) {
    const exerciseIds = (session.exercises || []).map(e => e.id)
    if (exerciseIds.length === 0) { showFlash('Ingen øvelser fundet i sessionen.', 'error'); return }

    setPendingSessionAction(`${session.id}:skip`)
    const { data: existing, error: fetchErr } = await supabase
      .from('exercise_logs')
      .select('exercise_id, set_number')
      .eq('athlete_id', athlete.id)
      .in('exercise_id', exerciseIds)
    if (fetchErr) { setPendingSessionAction(null); showFlash('Sættene kunne ikke tjekkes. Tjek din forbindelse og prøv igen.', 'error'); return }

    const logged = new Set((existing || []).map(l => `${l.exercise_id}_${l.set_number}`))
    const rows = []
    for (const ex of (session.exercises || [])) {
      for (let n = 1; n <= (parseInt(ex.sets) || 0); n++) {
        if (logged.has(`${ex.id}_${n}`)) continue
        rows.push({ exercise_id: ex.id, athlete_id: athlete.id, set_number: n, weight: null, reps_completed: null, note: null, rpe_actual: null, rpe_planned: null, skipped: true })
      }
    }

    if (rows.length === 0) {
      setPendingSessionAction(null)
      showFlash('Alle sæt er allerede logget.')
      return
    }

    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(rows),
      () => showFlash('Sættene kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return

    showFlash(`${rows.length} sæt sprunget over.`)
    await fetchExerciseLogs(athlete.id, currentWeek)
    await fetchPastLogs(allWeeks[viewingWeekIdx], athlete.id)
  }

  async function deleteLog(l) {
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').delete().eq('id', l.id),
      () => showFlash('Måltidet blev ikke slettet. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchLogs(athlete.id)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast({
      label: 'Måltid slettet',
      restore: { athlete_id: athlete.id, date: l.date, meal: l.meal, kcal: l.kcal, protein: l.protein, carb: l.carb, fat: l.fat },
    })
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000)
  }

  function showFlash(message, kind = 'info') {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message, kind })
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000)
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm })
  }

  async function undoDelete() {
    const t = undoToast
    if (!t || undoPending) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoPending(true)
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert(t.restore),
      () => showFlash('Måltidet kunne ikke gendannes. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setUndoPending(false)
    if (!ok) return
    setUndoToast(null)
    fetchLogs(athlete.id)
  }

  // Find gram-mængden i et logget måltidsnavn, fx "Kyllingebryst · 250 g" eller
  // "... (300 g)". Returnerer { base, grams } eller null hvis den ikke kan læses.
  function parseLoggedGrams(meal) {
    const m = String(meal).match(/(\d+)\s*g\)?\s*$/)
    if (!m) return null
    const grams = parseInt(m[1])
    if (!grams) return null
    return { base: String(meal).split(' · ')[0], grams }
  }

  function startEditLog(l) {
    setEditingLogId(l.id)
    const parsed = parseLoggedGrams(l.meal)
    if (parsed) setEditGrams(String(parsed.grams))
    else setEditGrams('')
    setEditMacros({ kcal: String(l.kcal ?? ''), protein: String(l.protein ?? ''), carb: String(l.carb ?? ''), fat: String(l.fat ?? '') })
  }

  async function saveEditLog(l) {
    const parsed = parseLoggedGrams(l.meal)
    let update
    if (parsed) {
      // Gram-skalering: vægt op/ned proportionalt og opdater gram i navnet.
      const newGrams = parseFloat(editGrams) || 0
      if (newGrams <= 0) return
      const factor = newGrams / parsed.grams
      update = {
        meal: `${parsed.base} · ${Math.round(newGrams)} g`,
        kcal: Math.round((l.kcal || 0) * factor),
        protein: Math.round((l.protein || 0) * factor),
        carb: Math.round((l.carb || 0) * factor),
        fat: Math.round((l.fat || 0) * factor),
      }
    } else {
      // Fallback: rediger makroerne direkte.
      update = {
        kcal: parseInt(editMacros.kcal) || 0,
        protein: parseInt(editMacros.protein) || 0,
        carb: parseInt(editMacros.carb) || 0,
        fat: parseInt(editMacros.fat) || 0,
      }
    }
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').update(update).eq('id', l.id),
      () => showFlash('Ændringen blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    setEditingLogId(null)
    fetchLogs(athlete.id)
  }

  const totKcal = logs.reduce((a, l) => a + (l.kcal || 0), 0)
  const totProtein = logs.reduce((a, l) => a + (l.protein || 0), 0)
  const totCarb = logs.reduce((a, l) => a + (l.carb || 0), 0)
  const totFat = logs.reduce((a, l) => a + (l.fat || 0), 0)
  const kcalPct = athlete?.kcal_target ? Math.min(100, Math.round(totKcal / athlete.kcal_target * 100)) : 0
  const proteinPct = athlete?.protein_target ? Math.min(100, Math.round(totProtein / athlete.protein_target * 100)) : 0

  const pKcal = totProtein * 4
  const cKcal = totCarb * 4
  const fKcal = totFat * 9
  const macroTotal = pKcal + cKcal + fKcal || 1
  const circ = 2 * Math.PI * 48
  const pLen = (pKcal / macroTotal) * circ
  const cLen = (cKcal / macroTotal) * circ
  const fLen = (fKcal / macroTotal) * circ

  const tdeeEstimate = (() => {
    const kcalByDate = {}
    for (const log of historicalMealLogs) {
      kcalByDate[log.date] = (kcalByDate[log.date] || 0) + (log.kcal || 0)
    }
    const kcalDays = Object.values(kcalByDate)
    if (kcalDays.length < 7) return { ready: false, missingKcalDays: Math.max(0, 7 - kcalDays.length) }
    const wLogs = [...weightLogs].sort((a, b) => a.logged_at > b.logged_at ? 1 : -1)
    if (wLogs.length < 2) return { ready: false, missingWeight: true }
    const oldest = wLogs[0]
    const newest = wLogs[wLogs.length - 1]
    const daySpan = (new Date(newest.logged_at) - new Date(oldest.logged_at)) / 86400000
    if (daySpan < 7) return { ready: false, missingWeight: true }
    const avgKcal = kcalDays.reduce((a, b) => a + b, 0) / kcalDays.length
    const weightChangePrDay = (newest.weight - oldest.weight) / daySpan
    const tdee = Math.round(avgKcal - weightChangePrDay * 7700)
    const confidence = kcalDays.length >= 14 && daySpan >= 21 ? 'høj' : kcalDays.length >= 10 && daySpan >= 14 ? 'moderat' : 'lav'
    return { ready: true, tdee, avgKcal: Math.round(avgKcal), kcalDays: kcalDays.length, daySpan: Math.round(daySpan), confidence }
  })()

  const now = new Date()
  const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']

  // Ferie: atleten er sat på ferie (ingen slutdato, eller slutdato i dag/fremtid).
  const onHoliday = athlete?.status === 'ferie' && (!athlete.vacation_until || athlete.vacation_until >= today())
  const holidayReturn = athlete?.vacation_until
    ? (() => { const d = new Date(athlete.vacation_until + 'T12:00:00'); return `${d.getDate()}. ${months[d.getMonth()]}` })()
    : null

  const backBtn = onExitPreview && (
    <button
      onClick={onExitPreview}
      style={{ background: 'rgba(200,146,58,0.12)', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(200,146,58,0.35)', padding: '0.35rem 0.85rem', cursor: 'pointer' }}
    >← Coach view</button>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {loadError ? (
        <>
          <div style={{ color: '#7a7770' }}>Kunne ikke indlæse data.</div>
          {backBtn || <button style={s.btnGhost} onClick={() => window.location.reload()}>Prøv igen</button>}
        </>
      ) : 'Indlæser...'}
      {!loadError && backBtn}
    </div>
  )

  if (!athlete) {
    // Første skærm en atlet møder hvis mailen ikke matcher en profil. Rolig,
    // menneskelig, handlingsanvisende — ingen teknisk fejltekst.
    const stuckEmail = session?.user?.email || ''
    const coachMail = `mailto:coach@entropicoaching.dk?subject=${encodeURIComponent('Kobl min konto til min atletprofil')}&body=${encodeURIComponent(`Hej coach\n\nJeg er logget ind i Entropi som ${stuckEmail || '(min mail)'}, men min konto er ikke koblet til min atletprofil endnu. Kan du koble mig til?\n\nTak!`)}`
    return (
      <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: 430, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.9rem' }}>Entropi Coaching</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '1rem' }}>Næsten klar.</h1>
          <p style={{ color: '#b8b4a8', fontSize: '0.92rem', lineHeight: 1.65, marginBottom: '1.35rem' }}>
            Din konto er endnu ikke koblet til en atletprofil. Det sker automatisk, når du logger ind med den mail, du fik invitationen på.
          </p>
          <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1.35rem' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem' }}>Du er logget ind som</div>
            <div style={{ color: '#edeae2', fontSize: '0.9rem', wordBreak: 'break-all' }}>{stuckEmail || '—'}</div>
          </div>
          <p style={{ color: '#7a7770', fontSize: '0.8rem', lineHeight: 1.65, marginBottom: '1.6rem' }}>
            Brugte du en anden mail end den fra invitationen? Log ud og prøv igen. Er du i tvivl, så skriv til din coach — så kobler han dig til.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <a href={coachMail} style={{ ...s.btnPrimary, textDecoration: 'none', display: 'block', padding: '0.85rem 1rem' }}>Skriv til din coach</a>
            {backBtn || <button style={s.btnGhost} onClick={() => signOutHard()}>Log ud og skift mail</button>}
          </div>
        </div>
      </div>
    )
  }

  const progressBars = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {[
        { label: 'Kalorier', val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
        { label: 'Protein', val: totProtein, target: athlete.protein_target, unit: 'g', pct: proteinPct, color: '#6cba6c' },
      ].map(({ label, val, target, unit, pct, color }) => (
        <div key={label} style={s.card}>
          <div style={s.cardLabel}>{label}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1, marginBottom: '0.6rem' }}>
            {val} <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem', color: '#7a7770', fontWeight: 300 }}>/ {target || '?'} {unit}</span>
          </div>
          <div style={{ height: '3px', background: '#242420', borderRadius: '2px' }}>
            <div style={{ height: '3px', width: pct + '%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.35rem' }}>{pct}%</div>
        </div>
      ))}
    </div>
  )

  // Kompakt kost-status til forsiden: ét slankt, klikbart kort i stedet for to
  // store. Fylder minimalt når der ikke er logget noget ("mindre in your face"),
  // og viser tal + tynde bars når dagen er i gang. Kost-fanen har den fulde visning.
  const kostCompact = (
    <div
      onClick={() => setTab('kost')}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
      style={{ ...s.card, cursor: 'pointer', padding: '0.7rem 1rem', marginBottom: '1.5rem' }}
    >
      {(totKcal > 0 || totProtein > 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ ...s.cardLabel, marginBottom: 0, flexShrink: 0 }}>Kost i dag</span>
          {[
            { val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
            { val: totProtein, target: athlete.protein_target, unit: 'g protein', pct: proteinPct, color: '#6cba6c' },
          ].map(({ val, target, unit, pct, color }) => (
            <span key={unit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#edeae2', whiteSpace: 'nowrap' }}>
                {val}<span style={{ color: '#7a7770' }}> / {target || '?'} {unit}</span>
              </span>
              <span style={{ width: 44, height: 3, background: '#242420', borderRadius: 2, flexShrink: 0 }}>
                <span style={{ display: 'block', width: `${Math.min(pct, 100)}%`, height: 3, background: color, borderRadius: 2 }} />
              </span>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844' }}>→</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...s.cardLabel, marginBottom: 0 }}>Kost</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.05em' }}>
            Ingen måltider logget i dag
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844' }}>→</span>
        </div>
      )}
    </div>
  )

  if ((!onboardingDone || guideOpen) && !coachAthleteId) {
    const guideStepData = ATHLETE_ONBOARDING_GUIDE_STEPS[guideStep] || ATHLETE_ONBOARDING_GUIDE_STEPS[0]
    const isIntroStep = guideStepData.variant === 'intro'
    const isLastGuideStep = isLastOnboardingGuideStep(guideStep)
    return (
      <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '2.75rem', letterSpacing: '0.02em' }}>
            Entropi<span style={{ color: '#c8923a' }}>.</span>
          </div>

          {isIntroStep ? (
            <>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.1rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '1rem' }}>
                Velkommen, <em style={{ fontStyle: 'italic', color: '#c8923a' }}>{athlete.name.split(' ')[0]}</em>.
              </h1>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.92rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '2.5rem' }}>
                {guideStepData.body}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2.5rem' }}>
                {[
                  {
                    label: 'Program',
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="12" x2="18" y2="12" /><rect x="2" y="9.5" width="4" height="5" rx="1" /><rect x="18" y="9.5" width="4" height="5" rx="1" /><line x1="4" y1="9.5" x2="4" y2="14.5" /><line x1="20" y1="9.5" x2="20" y2="14.5" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Kostlog',
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><line x1="7" y1="2" x2="7" y2="22" /><path d="M21 15V2a5 5 0 0 0-5 5v6h3v7a1 1 0 0 0 2 0V15z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Readiness',
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    ),
                  },
                ].map(({ label, icon }) => (
                  <div key={label} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ color: '#c8923a' }}>{icon}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a7770' }}>{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.85rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.2, marginBottom: '1rem' }}>
                {guideStepData.heading}
              </h1>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.92rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '2.75rem' }}>
                {guideStepData.body}
              </p>
            </>
          )}

          {/* Trin-indikator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '2rem' }}>
            {ATHLETE_ONBOARDING_GUIDE_STEPS.map((step, index) => (
              <span key={step.key} style={{ width: '6px', height: '6px', borderRadius: '50%', background: index === guideStep ? '#c8923a' : 'rgba(237,234,226,0.15)' }} />
            ))}
          </div>

          <button
            onClick={advanceOnboardingGuide}
            style={{ ...s.btnPrimary, fontSize: '0.7rem', padding: '0.85rem 2.75rem', letterSpacing: '0.14em' }}
          >
            {isLastGuideStep ? (currentWeek ? 'Se dit program →' : 'Gå til forsiden →') : 'Videre →'}
          </button>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={completeOnboardingGuide}
              style={{ background: 'none', border: 'none', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: '0.4rem' }}
            >
              Spring guiden over
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {role === 'athlete' && athleteVideoCoachOpen && (
        <div
          role="dialog"
          aria-label="VideoCoach"
          style={{ position: 'fixed', inset: 0, zIndex: 12000, background: '#0f0e0b' }}
        >
          <iframe
            ref={athleteVideoCoachFrameRef}
            src={athleteVideoCoachInstant ? `${ATHLETE_VIDEOCOACH_URL}&instant=1` : ATHLETE_VIDEOCOACH_URL}
            title="VideoCoach"
            allow="fullscreen"
            allowFullScreen
            style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#0f0e0b' }}
          />
        </div>
      )}
      {openRpePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpenRpePicker(null)} />
      )}
      {showRpeGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowRpeGuide(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: '480px', padding: '1.5rem 1.25rem 2rem', fontFamily: "'IBM Plex Mono', monospace" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: '#c8923a', textTransform: 'uppercase' }}>RPE-skala (RTS)</span>
              <button onClick={() => setShowRpeGuide(false)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
            </div>
            {[
              { rpe: '10',  label: 'Ingen gentagelser tilbage' },
              { rpe: '9.5', label: 'Muligvis 1 tilbage' },
              { rpe: '9',   label: '1 tilbage' },
              { rpe: '8.5', label: '1–2 tilbage' },
              { rpe: '8',   label: '2 tilbage' },
              { rpe: '7.5', label: '2–3 tilbage' },
              { rpe: '7',   label: '3 tilbage' },
              { rpe: '6.5', label: '3–4 tilbage' },
              { rpe: '6',   label: '4 tilbage' },
              { rpe: '5.5', label: '4–5 tilbage' },
            ].map(({ rpe, label }) => (
              <div key={rpe} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                <span style={{ fontSize: '0.82rem', color: '#c8923a', minWidth: '36px', textAlign: 'right' }}>{rpe}</span>
                <span style={{ fontSize: '0.72rem', color: '#edeae2', letterSpacing: '0.02em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* PR toast — ORDRE 330 · blok 2 (F12 fra 292): lagt UNDER topbaren
          (52 px, sticky) i stedet for oven på den, og må bryde linjen i
          stedet for at løbe ud over en 360 px skærm. */}
      {prToast && (
        <div style={{
          position: 'fixed', top: 'calc(52px + 0.6rem)', left: 0, right: 0, margin: '0 auto', width: 'fit-content',
          background: '#1c1c18', border: '1px solid rgba(200,146,58,0.55)',
          padding: '0.65rem 1.1rem', zIndex: 9999, maxWidth: 'calc(100vw - 2rem)', boxSizing: 'border-box', textAlign: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem',
          color: '#c8923a', letterSpacing: '0.08em',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
          opacity: prToastFading ? 0 : 1, transition: 'opacity 0.6s ease',
        }}>
          {prToast.type === 'vægt' ? '🏆 Ny personlig rekord (vægt)' : prToast.type === 'rep' ? '🔥 Ny personlig rekord (reps)' : '⚡ Stærkeste sæt'} på {prToast.name}
        </div>
      )}
      {/* Fortryd-toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: '1px solid rgba(237,234,226,0.18)',
          padding: '0.6rem 0.75rem 0.6rem 1.1rem', zIndex: 9999, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '0.9rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#b8b4a8', letterSpacing: '0.06em' }}>{undoToast.label}</span>
          <button onClick={undoDelete} disabled={undoPending} style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.3rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.45)', opacity: undoPending ? 0.6 : 1 }}>{undoPending ? '...' : 'Fortryd'}</button>
        </div>
      )}
      {/* Toast — samme placering under topbaren som PR-toasten (ORDRE 330). */}
      {flash && (
        <div style={{
          position: 'fixed', top: 'calc(52px + 0.6rem)', left: 0, right: 0, margin: '0 auto', width: 'fit-content',
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', zIndex: 10000, maxWidth: '90vw',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
      {/* Bekræftelses-modal */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', padding: '1.5rem', maxWidth: '360px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.95rem', color: '#edeae2', lineHeight: 1.5, marginBottom: '1.25rem' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDialog(null)}>Annuller</button>
              <button style={s.btnPrimary} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn && fn() }}>Bekræft</button>
            </div>
          </div>
        </div>
      )}
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.logo}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
          {backBtn}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>{today()}</div>
          {/* BUG (ORDRE 20): denne konto-menu fandtes slet ikke før — en atlet
              (eller en coach der ved en fejl var havnet her) havde ingen vej ud
              af appen uden at rydde browser-data manuelt. Log ud skal ALTID
              kunne nås; "Skift til coach-visning" dækker det Marc oplevede: en
              coach-konto der (fx pga. et cachet rolle-opslag, se App.jsx)
              stod fast i atlet-visningen uden at skulle logge helt ud og ind. */}
          {!onExitPreview && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setAccountMenuOpen(o => !o)}
                aria-label="Konto"
                style={{ background: 'transparent', border: 'none', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.1em', cursor: 'pointer', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >⋯</button>
              {accountMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.4rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 6, padding: '0.35rem', minWidth: '190px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {onRecheckRole && (
                    <button
                      onClick={() => { setAccountMenuOpen(false); handleRecheckRole() }}
                      disabled={recheckingRole}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#b8b4a8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.5rem', cursor: recheckingRole ? 'default' : 'pointer' }}
                    >{recheckingRole ? 'Tjekker…' : 'Skift til coach-visning'}</button>
                  )}
                  <button
                    onClick={() => { setAccountMenuOpen(false); restartOnboardingGuide() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#b8b4a8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.5rem', cursor: 'pointer' }}
                  >Se guiden igen</button>
                  <button
                    onClick={() => { setAccountMenuOpen(false); askConfirm('Log ud af Entropi? Du skal logge ind igen for at fortsætte.', () => signOutHard()) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#e05555', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.5rem', cursor: 'pointer' }}
                  >Log ud</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {recheckMsg && !onExitPreview && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#7a7770', textAlign: 'right', padding: '0.4rem 1.5rem 0' }}>{recheckMsg}</div>
      )}

      {/* Page content */}
      <div style={s.page}>

        {/* HJEM */}
        {tab === 'hjem' && onHoliday && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 1.25rem', minHeight: '60vh', justifyContent: 'center' }}>
            <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: '1.25rem' }}>🌴</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>
              Du er på <em style={{ fontStyle: 'italic', color: '#5b9bb5' }}>ferie</em>
            </h1>
            <div style={{ fontSize: '0.95rem', color: '#7a7770', marginTop: '0.85rem', maxWidth: '320px', lineHeight: 1.5 }}>
              Nyd pausen — lad kroppen restituere. Din træning venter, når du er tilbage.
            </div>
            {holidayReturn && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5b9bb5', marginTop: '1.5rem', padding: '0.5rem 1rem', border: '1px solid rgba(91,155,181,0.3)', borderRadius: 4 }}>
                Tilbage d. {holidayReturn}
              </div>
            )}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '1.75rem' }}>
              Vil du alligevel træne? Åbn Program-fanen nedenfor.
            </div>
          </div>
        )}
        {tab === 'hjem' && !onHoliday && (
          <>
            {(() => {
              const dagensPas = findDagensPas(allWeeks, currentWeek, exerciseLogs)
              const next = dagensPas?.status === 'open' ? dagensPas.next : null
              const nextLabel = next ? `Næste: ${next.exercise?.name || ''} · sæt ${next.setNumber}/${next.totalSets}` : null
              // ORDRE 330 · blok 1 — én tydelig overskrift øverst: hvilken dags
              // pas er det man ser ("Onsdag · Dag 1 — Squat"). Dagen er passets
              // faste ugedag; uden fast ugedag (fleksibelt pas) er det i dag.
              // Samme dag markeres i ugestrimlen lige under (shownWd).
              const todayWd = (now.getDay() + 6) % 7
              const pasSession = dagensPas?.status === 'open' ? dagensPas.session : null
              const shownWd = pasSession ? (pasSession.weekday ?? todayWd) : todayWd
              const headingRest = pasSession ? pasSession.title
                : dagensPas?.status === 'done' ? 'Ugens pas er klaret'
                : 'Intet pas i dag'
              const isTodayShown = shownWd === todayWd
              return (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.55rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, margin: 0 }}>
                      {`${WEEKDAYS_LONG[shownWd]} · ${headingRest}`}
                    </h1>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginTop: '0.35rem' }}>
                      {isTodayShown ? 'I dag' : `I dag er det ${days[now.getDay()]}`} · {now.getDate()}. {months[now.getMonth()]}
                    </div>
                  </div>

                  {currentWeek ? (
                    <WeekCalendar
                      week={currentWeek}
                      weekStart={weekStartDate(allWeeks, currentWeek.week_number)}
                      exerciseLogs={exerciseLogs}
                      onOpenSession={(id) => { setTab('program'); openSession(id) }}
                      shownWd={pasSession ? shownWd : null}
                    />
                  ) : (
                    // Reserverer WeekCalendars typiske højde: FØR ugedata (allWeeks)
                    // er hentet, findes dette element slet ikke (WeekCalendar
                    // returnerer null / hele blokken er ugengivet), og når det
                    // dukker op skubber det alt nedenfor — bl.a. "Dagens parathed"-
                    // kortet — ned. Målt som appens største reelle layoutskift
                    // (CLS 0,106) i ordre 173's rigtige, autentificerede måling; den
                    // isolerede harness i ordre 167 kunne aldrig se dette, den havde
                    // altid statisk data fra første billede.
                    <div style={{ height: '64px', marginBottom: '1.25rem' }} />
                  )}

                  <DagensPasCard
                    pas={dagensPas}
                    exerciseHistory={exerciseHistory}
                    exerciseLogs={exerciseLogs}
                    logInputs={logInputs}
                    setLogInputs={setLogInputs}
                    onLogSet={logDagensPasSet}
                    skipSet={skipSet}
                    suggestNextWeight={suggestNextWeight}
                    onOpenSession={(id) => { setTab('program'); openSession(id) }}
                    lastLoggedSet={lastLoggedSet}
                    onUndoLastSet={undoLoggedSet}
                    onUpdateLoggedSet={updateLoggedSet}
                    pendingSyncCount={pendingSyncCount}
                    todayStr={today()}
                    checkinNudge={(() => {
                      // ORDRE 267 · commit 3: samme uge-udregning som WeekCalendar
                      // ovenfor (weekStartDate + 6 dage), ingen ny hentning — kun
                      // readinessLog/readinessHistory, som allerede er hentet.
                      if (!currentWeek) return null
                      const start = weekStartDate(allWeeks, currentWeek.week_number)
                      if (!start) return null
                      const end = new Date(start.getTime() + 6 * 86400000)
                      const loggedDates = [readinessLog?.logged_date, ...readinessHistory.map(r => r.logged_date)].filter(Boolean)
                      return shouldNudgeCheckin({
                        weekStartStr: start.toISOString().slice(0, 10),
                        weekEndStr: end.toISOString().slice(0, 10),
                        todayStr: today(),
                        loggedDates,
                      }) ? { onClick: openReadiness } : null
                    })()}
                  />
                  {restPause && (
                    <RestPauseFooter
                      athleteId={athlete?.id}
                      pause={restPause}
                      onClear={() => setRestPause(null)}
                      nextLabel={nextLabel}
                    />
                  )}
                </>
              )
            })()}

            {/* ORDRE 330 · blok 2 — Marcs dom: forsiden var for "meget". Over
                folden står nu kun dagens pas og ÉN række med højst tre
                sekundære ting (parathed, besked, film et sæt — pausen har sin
                egen faste linje nederst, RestPauseFooter). Alt andet
                (ugestatus, program, parathedskort, kropsvægt, rekorder,
                tonnage, styrke, kost, VideoCoach, feedback) ligger bag "Mere". */}
            {(() => {
              const chipStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', minWidth: 0, minHeight: '52px', boxSizing: 'border-box', padding: '0.45rem 0.25rem', background: 'transparent', border: '1px solid rgba(237,234,226,0.13)', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace" }
              const chipLabel = { fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#edeae2', whiteSpace: 'nowrap' }
              const chipSub = { fontSize: '0.5rem', letterSpacing: '0.04em', color: '#7a7770', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }
              const chips = [
                <button key="parathed" type="button" onClick={openReadiness} style={chipStyle}>
                  <span style={chipLabel}>Parathed</span>
                  <span style={{ ...chipSub, color: readinessLog ? '#7a7770' : '#c8923a' }}>{readinessLog ? `${readinessLog.readiness_score ?? '–'} / 100` : 'Ikke logget'}</span>
                </button>,
                <button key="besked" type="button" onClick={() => setTab('beskeder')} style={chipStyle}>
                  <span style={chipLabel}>Besked</span>
                  {unreadMsgCount > 0 && <span style={{ ...chipSub, color: '#c8923a' }}>{`${unreadMsgCount} ${unreadMsgCount === 1 ? 'ny' : 'nye'}`}</span>}
                </button>,
                role === 'athlete' && (
                  <button key="film" type="button" onClick={() => { if (!athlete?.id) return; setAthleteVideoCoachInstant(true); setAthleteVideoCoachOpen(true) }} style={chipStyle}>
                    <span style={chipLabel}>Film et sæt</span>
                  </button>
                ),
              ].filter(Boolean)
              return (
                <div data-sekundaer="" style={{ display: 'grid', gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))`, gap: '0.5rem', marginBottom: '1rem' }}>
                  {chips}
                </div>
              )
            })()}

            <button
              type="button"
              aria-expanded={mereOpen}
              onClick={() => setMereOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', minHeight: '44px', boxSizing: 'border-box', background: 'transparent', border: 'none', borderTop: '1px solid rgba(237,234,226,0.07)', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: mereOpen ? '1.25rem' : 0 }}
            >
              <span>Mere</span>
              <span aria-hidden="true" style={{ display: 'inline-block', transform: mereOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {mereOpen && (<>
            {currentWeek && (() => {
              // ORDRE 276 · blok 2: "sidste uge" = programugen lige før den
              // aktive (week_number - 1), samme princip som Dashboard.jsx
              // allerede bruger week_number til at navigere uger. Findes den
              // ikke (fx uge 1), får UgensStatusKort null og siger det selv.
              const forrigeUge = (allWeeks || []).find(w => w.week_number === currentWeek.week_number - 1) || null
              return (
                <UgensStatusKort
                  week={currentWeek}
                  weekStart={weekStartDate(allWeeks, currentWeek.week_number)}
                  exerciseLogs={exerciseLogs}
                  allWeeks={allWeeks}
                  forloebLogs={forloebLogs}
                  forloebLoading={forloebLoading}
                  onAabnForloeb={() => fetchForloebLogs(athlete.id)}
                  forrigeUge={forrigeUge}
                  forrigeUgeStart={forrigeUge ? weekStartDate(allWeeks, forrigeUge.week_number) : null}
                />
              )
            })()}

            <div style={s.card}>
              <div style={s.cardLabel}>Mit program</div>
              {!currentWeek ? (
                <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Intet program tilknyttet endnu.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>
                      Uge {currentWeek.week_number}{(() => { const r = fmtWeekRange(weekStartDate(allWeeks, currentWeek.week_number)); return r ? ` · ${r}` : '' })()}
                    </span>
                    {currentWeek.block_name && (
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>
                        {currentWeek.block_name}
                      </span>
                    )}
                  </div>
                  {(currentWeek.sessions || []).length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(() => {
                        const sessDone = s => (s.exercises || []).length > 0 && (s.exercises || []).every(ex => exerciseLogs.some(l => l.exercise_id === ex.id))
                        const nextS = (currentWeek.sessions || []).find(s => !sessDone(s))
                        return (currentWeek.sessions || []).map(sess => {
                        const done = sessDone(sess)
                        const isNext = nextS && sess.id === nextS.id
                        const started = !done && (sess.exercises || []).some(ex => exerciseLogs.some(l => l.exercise_id === ex.id))
                        const wdLabel = sess.weekday != null ? WEEKDAYS_LONG[sess.weekday] : null
                        return (
                        <button
                          key={sess.id}
                          onClick={() => { setTab('program'); openSession(sess.id) }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isNext ? 'rgba(200,146,58,0.1)' : 'rgba(237,234,226,0.03)',
                            border: `1px solid ${isNext ? 'rgba(200,146,58,0.45)' : 'rgba(237,234,226,0.07)'}`,
                            color: '#edeae2',
                            padding: '0.6rem 0.75rem',
                            minHeight: '44px',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            fontWeight: 300,
                            opacity: done ? 0.55 : 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.55)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = isNext ? 'rgba(200,146,58,0.45)' : 'rgba(237,234,226,0.07)'}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            {isNext && <span style={{ color: '#c8923a', fontSize: '0.7rem', flexShrink: 0 }}>▶</span>}
                            {done && <span style={{ color: '#6cba6c', fontSize: '0.8rem', flexShrink: 0 }}>✓</span>}
                            <span style={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.title}</span>
                            {isNext && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#141410', background: '#c8923a', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{started ? 'Fortsæt' : 'Næste'}</span>}
                            {!isNext && !done && wdLabel && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7770', flexShrink: 0 }}>{wdLabel}</span>}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', flexShrink: 0, marginLeft: '0.75rem' }}>
                            {(sess.exercises || []).length} øvelser →
                          </span>
                        </button>
                      )}) })()}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Readiness check */}
            {!readinessLog ? (
              <div ref={readinessCardRef} style={{ ...s.card, scrollMarginTop: '5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ ...s.cardLabel, marginBottom: 0 }}>Dagens parathed</div>
                  {lastReadiness && (
                    <button
                      onClick={() => setReadinessInput({
                        sleep: lastReadiness.sleep_hours != null ? String(lastReadiness.sleep_hours) : '',
                        energy: lastReadiness.energy ?? null,
                        motivation: lastReadiness.motivation ?? null,
                        stress: lastReadiness.stress ?? null,
                        soreness: lastReadiness.soreness_level ?? null,
                        soreZones: lastReadiness.sore_zones || [],
                      })}
                      style={{ background: 'none', border: '1px solid rgba(237,234,226,0.13)', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.35rem 0.6rem', cursor: 'pointer', flexShrink: 0 }}
                    >↺ Samme som sidst</button>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={s.fieldLabel}>Søvn</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      aria-label="Søvn, timer"
                      type="number" min="0" max="24" step="0.5" placeholder="timer"
                      value={readinessInput.sleep}
                      onChange={e => setReadinessInput(p => ({ ...p, sleep: e.target.value }))}
                      style={{ ...s.fieldInput, maxWidth: '90px', fontSize: '1.1rem', padding: '0.7rem 0.6rem', textAlign: 'center' }}
                    />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#7a7770', letterSpacing: '0.06em' }}>timer</span>
                  </div>
                </div>

                {[
                  ['energy', 'Energiniveau', '1 = ingen energi  ·  5 = fuld energi'],
                  ['motivation', 'Motivation', '1 = ingen lyst  ·  5 = klar til at løfte'],
                  ['stress', 'Stress', '1 = helt rolig  ·  5 = meget stresset'],
                  ['soreness', 'Muskelømhed', '1 = ingen ømhed  ·  5 = meget øm'],
                ].map(([key, label, hint]) => (
                  <div key={key} style={{ marginBottom: '1rem' }}>
                    <div style={s.fieldLabel}>{label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{hint}</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v}
                          type="button"
                          aria-label={`${label}: ${v}`}
                          aria-pressed={readinessInput[key] === v}
                          onClick={() => setReadinessInput(p => ({ ...p, [key]: v }))}
                          style={{ flex: 1, padding: '0.9rem 0', minHeight: '44px', boxSizing: 'border-box', fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', fontWeight: 500, border: `1px solid ${readinessInput[key] === v ? '#c8923a' : 'rgba(237,234,226,0.13)'}`, background: readinessInput[key] === v ? 'rgba(200,146,58,0.15)' : '#141410', color: readinessInput[key] === v ? '#c8923a' : '#7a7770', cursor: 'pointer' }}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={s.fieldLabel}>Lokal ømhed <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.04em', textTransform: 'none', fontWeight: 400 }}>(valgfrit)</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {['Ben', 'Ryg', 'Skuldre/Arme', 'Core'].map(zone => {
                      const sel = readinessInput.soreZones.includes(zone)
                      return (
                        <button key={zone}
                          type="button"
                          aria-pressed={sel}
                          onClick={() => setReadinessInput(p => ({ ...p, soreZones: sel ? p.soreZones.filter(z => z !== zone) : [...p.soreZones, zone] }))}
                          style={{ padding: '0.5rem 0.9rem', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${sel ? '#c8923a' : 'rgba(237,234,226,0.13)'}`, background: sel ? 'rgba(200,146,58,0.15)' : '#141410', color: sel ? '#c8923a' : '#7a7770', cursor: 'pointer' }}
                        >{zone}</button>
                      )
                    })}
                  </div>
                </div>

                {readinessError && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#e05555', marginBottom: '0.75rem', letterSpacing: '0.06em' }}>
                    {readinessError}
                  </div>
                )}
                {(() => {
                  const missing = []
                  if (!readinessInput.energy) missing.push('energi')
                  if (!readinessInput.motivation) missing.push('motivation')
                  if (!readinessInput.stress) missing.push('stress')
                  if (!readinessInput.soreness) missing.push('ømhed')
                  if (!missing.length) return null
                  return (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                      Udfyld {missing.join(', ')} for at logge
                    </div>
                  )
                })()}
                <button
                  // G10: ~27px høj — samme metode som F13-F16/F26 (ordre 68): minHeight + boxSizing på selve knappen, ikke i den delte s.btnPrimary (rører 20 andre knapper).
                  style={{ ...s.btnPrimary, width: '100%', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: (!readinessInput.energy || !readinessInput.motivation || !readinessInput.stress || !readinessInput.soreness) ? 0.45 : 1 }}
                  onClick={saveReadiness}
                  disabled={savingReadiness}
                >{savingReadiness ? 'Gemmer...' : 'Log parathed'}</button>
              </div>
            ) : (() => {
              const sc = readinessLog.readiness_score
              const sig = sc >= 75 ? { color: '#6cba6c', text: 'Kroppen er klar 💪', bg: 'rgba(108,186,108,0.07)' }
                : sc >= 50 ? { color: '#c8923a', text: 'Tag det lidt roligt i dag', bg: 'rgba(200,146,58,0.07)' }
                : { color: '#e05555', text: 'Overvej en let session i dag', bg: 'rgba(224,85,85,0.07)' }
              // ORDRE 100: dagens score sat op mod atletens eget snit for de
              // sidste 14 dage — den eneste daglige rutine der hidtil ikke
              // spejlede noget tilbage. Ren logik i readinessInsight.js
              // (enhedstestet), kun teksten valgt her.
              const cmp = compareReadiness(sc, readinessHistory.map(r => r.readiness_score))
              const comparisonText = readinessComparisonText(cmp.status)
              const trainingNote = readinessTrainingNote(cmp.status)
              // Kurvens punkter: historikken (allerede sorteret nyest-først
              // fra fetchReadiness) vendt til kronologisk rækkefølge, plus
              // dagens egen score til sidst — op til 14 dage i alt.
              const chartPoints = [...readinessHistory].filter(r => r.readiness_score != null).reverse()
                .map(r => ({ date: r.logged_date, score: r.readiness_score }))
              if (sc != null) chartPoints.push({ date: readinessLog.logged_date, score: sc })
              const sparklinePoints = chartPoints.slice(-14)
              return (
                <div style={{ ...s.card, background: sig.bg }}>
                  <div style={s.cardLabel}>Dagens parathed</div>
                  <div style={{ fontSize: '1.05rem', color: sig.color, marginBottom: '0.75rem' }}>{sig.text}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.6rem', fontWeight: 500, color: sig.color, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                    {readinessLog.readiness_score}
                    <span style={{ fontSize: '0.6rem', color: '#4a4844', fontWeight: 400, marginLeft: '0.3rem' }}>/ 100</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {readinessLog.sleep_hours != null && <div><div style={s.fieldLabel}>Søvn</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.sleep_hours}t</div></div>}
                    {readinessLog.energy != null && <div><div style={s.fieldLabel}>Energi</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.energy}/5</div></div>}
                    {readinessLog.motivation != null && <div><div style={s.fieldLabel}>Motivation</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.motivation}/5</div></div>}
                    {readinessLog.stress != null && <div><div style={s.fieldLabel}>Stress</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.stress}/5</div></div>}
                    {readinessLog.soreness_level != null && <div><div style={s.fieldLabel}>Ømhed</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.soreness_level}/5</div></div>}
                    {readinessLog.sore_zones?.length > 0 && <div><div style={s.fieldLabel}>Lokalt</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#7a7770' }}>{readinessLog.sore_zones.join(', ')}</div></div>}
                  </div>
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(237,234,226,0.07)', fontSize: '0.82rem', color: '#a9a69e', lineHeight: 1.55 }}>
                    {comparisonText}{trainingNote ? ` ${trainingNote}` : ''}
                  </div>
                  <ReadinessSparkline points={sparklinePoints} />
                </div>
              )
            })()}

            {readinessLog && (() => {
              // ORDRE 267 · commit 2 — "atleten kan se at det blev brugt": to
              // stille kort efter afsendelse, begge udledt af data der
              // allerede er hentet (ingen nyt opslag). Fremgangsmåde og
              // grænser: se readinessInsight.js.
              const sc = readinessLog.readiness_score
              const historyWithToday = [
                ...readinessHistory,
                { logged_date: readinessLog.logged_date, readiness_score: sc, sleep_hours: readinessLog.sleep_hours, sore_zones: readinessLog.sore_zones },
              ]
              const coachSummary = summarizeReadinessForCoach(historyWithToday)
              const planChange = lastCheckinDrivenChange(historyWithToday, allWeeks)
              const fmtD = str => { const d = new Date(str + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }
              return (
                <>
                  {coachSummary && (
                    <div style={s.card}>
                      <div style={s.cardLabel}>Det din coach ser</div>
                      <div style={{ fontSize: '0.82rem', color: '#b8b4a8', lineHeight: 1.55 }}>
                        {coachSummary.logsCount} {coachSummary.logsCount === 1 ? 'parathedslog' : 'parathedslogs'} i din seneste historik
                        {coachSummary.avgSleep != null ? `, gns. søvn ${String(coachSummary.avgSleep).replace('.', ',')} timer` : ''}
                        {coachSummary.topZone ? `, oftest øm: ${coachSummary.topZone[0]}` : ''}.
                      </div>
                      {coachSummary.lowStreak >= 3 && (
                        <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#c8923a' }}>
                          Din coach ser at parathed har været under 50 i {coachSummary.lowStreak} dage i træk.
                        </div>
                      )}
                    </div>
                  )}
                  {planChange && (
                    <div style={s.card}>
                      <div style={s.cardLabel}>Sidst det gjorde en forskel</div>
                      <div style={{ fontSize: '0.82rem', color: '#b8b4a8', lineHeight: 1.55 }}>
                        Efter dit check-in d. {fmtD(planChange.checkinDate)} med lav parathed, skrev din coach denne note til ugen der startede d. {fmtD(planChange.weekStartDate)}:
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#edeae2', fontStyle: 'italic' }}>
                        "{planChange.note}"
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            <div style={{ ...s.card, cursor: 'pointer' }} onClick={() => setTab('beskeder')}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.25)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
            >
              <div style={s.cardLabel}>Seneste besked fra coach</div>
              {(() => {
                const lastCoach = [...messages].reverse().find(m => m.sender_role === 'coach')
                if (!lastCoach) return <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen beskeder endnu.</div>
                return (
                  <>
                    <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.6, marginBottom: '0.4rem' }}>{lastCoach.content}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{formatMsgTime(lastCoach.created_at)}</div>
                  </>
                )
              })()}
            </div>

            {(() => {
              const sorted = [...weightLogs].sort((a, b) => a.logged_at > b.logged_at ? 1 : -1)
              const todayStr = today()
              const todayLog = weightLogs.find(l => l.logged_at === todayStr)
              const showInput = !todayLog || weightInput !== ''
              const chartEntries = sorted.slice(-30)
              const hasChart = chartEntries.length >= 2

              // Median of last 5 as current weight
              const last5 = sorted.slice(-5).map(l => l.weight).sort((a, b) => a - b)
              const currentWeight = last5.length > 0 ? last5[Math.floor(last5.length / 2)] : null

              // Trend: avg of last 7 vs avg of prior 7
              let trendText = null
              if (sorted.length >= 4) {
                const r = sorted.slice(-7).map(l => l.weight)
                const p = sorted.slice(Math.max(0, sorted.length - 14), sorted.length - 7).map(l => l.weight)
                if (r.length >= 2 && p.length >= 1) {
                  const rAvg = r.reduce((s, v) => s + v, 0) / r.length
                  const pAvg = p.reduce((s, v) => s + v, 0) / p.length
                  const diff = rAvg - pAvg
                  if (Math.abs(diff) < 0.3) trendText = '= stabil'
                  else if (diff > 0) trendText = `↑ +${diff.toFixed(1)}kg siden forrige uge`
                  else trendText = `↓ ${Math.abs(diff).toFixed(1)}kg siden forrige uge`
                }
              }

              // SVG line chart
              let chartEl = null
              if (hasChart) {
                const W = 400, H = 100, PL = 30, PR = 4, PT = 8, PB = 18
                const ws = chartEntries.map(l => l.weight)
                const minW = Math.min(...ws) - 0.5
                const maxW = Math.max(...ws) + 0.5
                const range = maxW - minW
                const cx = i => PL + (i / (chartEntries.length - 1)) * (W - PL - PR)
                const cy = w => PT + (1 - (w - minW) / range) * (H - PT - PB)
                const pts = chartEntries.map((l, i) => `${cx(i).toFixed(1)},${cy(l.weight).toFixed(1)}`).join(' ')
                const labelIs = chartEntries.length > 2
                  ? [0, Math.floor((chartEntries.length - 1) / 2), chartEntries.length - 1]
                  : [0, chartEntries.length - 1]

                chartEl = (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '0.25rem 0' }}>
                    <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="rgba(237,234,226,0.06)" strokeWidth="1" />
                    <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.06)" strokeWidth="1" />
                    <text x={PL - 3} y={PT + 5} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily="IBM Plex Mono,monospace">{Math.max(...ws).toFixed(1)}</text>
                    <text x={PL - 3} y={H - PB} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily="IBM Plex Mono,monospace">{Math.min(...ws).toFixed(1)}</text>
                    <polyline points={pts} fill="none" stroke="#c8923a" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                    {chartEntries.map((l, i) => (
                      <circle key={i} cx={cx(i)} cy={cy(l.weight)} r={i === chartEntries.length - 1 ? 3.5 : 2} fill={i === chartEntries.length - 1 ? '#edeae2' : '#c8923a'} />
                    ))}
                    {labelIs.map(i => (
                      <text key={i} x={cx(i)} y={H - 2} textAnchor={i === 0 ? 'start' : i === chartEntries.length - 1 ? 'end' : 'middle'} fontSize="7" fill="#4a4844" fontFamily="IBM Plex Mono,monospace">
                        {chartEntries[i].logged_at.slice(5).replace('-', '/')}
                      </text>
                    ))}
                  </svg>
                )
              }

              return (
                <div style={s.card}>
                  <div style={s.cardLabel}>Kropsvægt</div>

                  {currentWeight != null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: '#edeae2', lineHeight: 1 }}>{currentWeight}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770' }}>kg</span>
                      {trendText && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.04em' }}>{trendText}</span>
                      )}
                    </div>
                  )}

                  {hasChart ? chartEl : (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', margin: '0.5rem 0 0.75rem', letterSpacing: '0.04em' }}>
                      Log din vægt for at se udviklingen
                    </div>
                  )}

                  {showInput ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                      <input
                        style={{ ...s.fieldInput, maxWidth: '90px', fontSize: '1rem', padding: '0.5rem 0.6rem' }}
                        type="number" step="0.1" placeholder="kg"
                        value={weightInput}
                        onChange={e => setWeightInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && logWeight()}
                      />
                      <button style={s.btnPrimary} onClick={logWeight} disabled={savingWeight || !weightInput}>
                        {savingWeight ? '...' : 'Log'}
                      </button>
                      {todayLog && <button style={s.btnGhost} onClick={() => setWeightInput('')}>Annuller</button>}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844', letterSpacing: '0.06em' }}>Logget i dag · {todayLog.weight} kg</span>
                      {/* G10: ~17px høj — samme metode som F13-F16/F26 (ordre 68): minHeight + boxSizing, bredden bevares. */}
                      <button style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.2rem 0.5rem', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }} onClick={() => setWeightInput(todayLog.weight.toString())}>Ret</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Dine rekorder — maks + bedste løft pr. øvelse (motivation; data findes allerede) */}
            {(() => {
              const hasMax = athlete.squat || athlete.bench || athlete.deadlift
              const bestByEx = {}
              for (const r of prs) {
                const cur = bestByEx[r.exercise_name]
                if (!cur || (r.weight || 0) > cur.weight) bestByEx[r.exercise_name] = { weight: r.weight || 0, reps: r.reps || 0 }
              }
              // Prioritér hovedløft/konkurrenceløft (squat/bænk/dødløft + varianter) før
              // accessory: ellers kan et tungt assistance-løft skubbe et mere relevant løft
              // ud af top-6. Inden for hver gruppe sorteres efter vægt.
              const bestList = Object.entries(bestByEx)
                .map(([name, v]) => ({ name, ...v, main: isMainLift(name) }))
                .sort((a, b) => (b.main - a.main) || (b.weight - a.weight))
                .slice(0, 6)
              if (!hasMax && !bestList.length && !prsError) return null
              return (
                <div style={s.card}>
                  <div style={s.cardLabel}>Dine rekorder</div>
                  {prsError && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em', color: '#7a7770', marginBottom: bestList.length || hasMax ? '0.75rem' : 0 }}>
                      Rekorder kunne ikke hentes lige nu. Prøver igen i baggrunden…
                    </div>
                  )}
                  {hasMax && (
                    <>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: bestList.length ? '1.1rem' : 0 }}>
                        {[['Squat', athlete.squat], ['Bænk', athlete.bench], ['Dødløft', athlete.deadlift]].map(([label, val]) => (
                          <div key={label}>
                            <div style={s.fieldLabel}>{label}</div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: val ? '#edeae2' : '#3a3a36', lineHeight: 1 }}>{val || '–'}<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#7a7770', marginLeft: '0.2rem' }}>kg</span></div>
                          </div>
                        ))}
                        {(athlete.squat && athlete.bench && athlete.deadlift) ? (
                          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={s.fieldLabel}>Total</div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#c8923a', lineHeight: 1 }}>{(athlete.squat || 0) + (athlete.bench || 0) + (athlete.deadlift || 0)}<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#7a7770', marginLeft: '0.2rem' }}>kg</span></div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                  {bestList.length > 0 && (
                    <>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Bedste løft pr. øvelse</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {bestList.map((b, i) => (
                          <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', padding: '0.4rem 0', borderBottom: i < bestList.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none' }}>
                            <span style={{ fontSize: '0.85rem', color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', whiteSpace: 'nowrap', flexShrink: 0 }}>{b.weight} kg{b.reps ? ` × ${b.reps}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {weeklyTonnage.length >= 2 && (
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.6rem' }}>
                  <div style={{ ...s.cardLabel, marginBottom: 0 }}>Ugentlig volumen</div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em', textTransform: 'uppercase' }}>vægt × reps · t = ton</span>
                </div>
                <WeeklyTonnageChart data={weeklyTonnage} />
              </div>
            )}

            {liftProgress.some(sr => sr.points.length >= 2) && (
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <div style={{ ...s.cardLabel, marginBottom: 0 }}>Styrkeudvikling</div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em', textTransform: 'uppercase' }}>bedste e1RM pr. uge, kg</span>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                  e1RM er et regnestykke ud fra din vægt og dine reps, der viser hvor stærk du cirka er lige nu — ikke et forsøg du faktisk har taget.
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  {liftProgress.filter(sr => sr.points.length >= 2).map(sr => (
                    <span key={sr.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7770' }}>
                      <span style={{ width: 10, height: 2, background: sr.color, display: 'inline-block' }} />{sr.label}
                    </span>
                  ))}
                </div>
                <E1RMChart series={liftProgress} />
              </div>
            )}

            {kostCompact}

            {/* VideoCoach — flyttet fra topbaren ned som selvstændigt kort */}
            <div
              onClick={() => {
                if (!athlete?.id) return
                if (role === 'athlete') { setAthleteVideoCoachInstant(false); setAthleteVideoCoachOpen(true); return }
                // Coach-preview kan ikke sende: RLS tillader kun atleten selv at
                // oprette sin egen draft (created_by = auth.uid()). Åbn derfor ikke
                // et blindt værktøj uden bridge — forklar det ærligt i stedet.
                alert('VideoCoach-indsendelse sker fra atletens egen login. Dette er en coach-forhåndsvisning, så du kan ikke sende herfra.')
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
              style={{ ...s.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
            >
              <div style={{ width: 46, height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(200,146,58,0.35)', borderRadius: 4, background: 'rgba(200,146,58,0.08)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="13" height="12" rx="2" />
                  <path d="M15 10.5 22 7v10l-7-3.5" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...s.cardLabel, marginBottom: '0.2rem' }}>VideoCoach</div>
                <div style={{ fontSize: '0.85rem', color: '#edeae2', lineHeight: 1.4 }}>
                  Film dit løft og mål stanghastighed
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', marginTop: '0.3rem' }}>
                  Åbn kamera-analyse →
                </div>
              </div>
            </div>

            {/* ORDRE 262 · commit 1: "Film et sæt" — flyttet op i den sekundære
                række over folden i ORDRE 330 · blok 2 (samme handling). */}
            {role === 'athlete' && (sharedVideoLoading || sharedVideoError || sharedVideoAnalyses.length > 0) && (
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.7rem', marginBottom: '0.8rem' }}>
                  <div>
                    <div style={{ ...s.cardLabel, marginBottom: '0.2rem' }}>Feedback fra din coach</div>
                    <div style={{ color: '#7a7770', fontSize: '0.68rem', lineHeight: 1.4 }}>Godkendte bevægelsesanalyser og næste fokus.</div>
                  </div>
                  {!sharedVideoLoading && <button onClick={fetchSharedVideoAnalyses} style={{ ...s.btnGhost, padding: '0.3rem 0.55rem', fontSize: '0.5rem', flexShrink: 0 }}>Opdatér</button>}
                </div>

                {sharedVideoLoading && <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', padding: '0.5rem 0' }}>Henter analyser…</div>}
                {sharedVideoError && !sharedVideoLoading && (
                  <div style={{ color: '#d79a83', fontSize: '0.66rem', lineHeight: 1.45 }}>{sharedVideoError}</div>
                )}

                {!sharedVideoLoading && !sharedVideoError && sharedVideoAnalyses.length > 0 && renderSharedFeedbackCards()}
              </div>
            )}
            </>)}
          </>
        )}

        {/* PROGRAM */}
        {tab === 'program' && (
          <LazyBoundary
            factory={programFactory} label="Program" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              WEEKDAYS_LONG, allWeeks, applyWarmupCorrection, askConfirm, athlete, autoCompleteSession,
              calcWarmupSets, computeActiveWeekIdx, currentWeek, dismissedFeedback, exWarmupExpanded,
              exWarmupWeightEditing, exWarmupWeightOverride, exerciseHistory, exerciseLogs, feedbackInputs,
              fetchPastLogs, fetchProgram, fmtWeekRange, lastLogByExerciseName, logInputs, logSet,
              openReadiness, openRpePicker, openSession, parsePlannedRpe, pastLogs, pendingSessionAction,
              progOpenSession, programError, readinessLog, saveFeedback, saveWarmupOverride, sessionRefs,
              setConfirm, setDismissedFeedback, setExWarmupExpanded, setExWarmupWeightEditing,
              setExWarmupWeightOverride, setFeedbackInputs, setLogInputs, setOpenRpePicker, setPastLogs,
              setProgOpenSession, setShowRpeGuide, setSkipConfirmEx, setViewingWeekIdx, setWarmupChecked,
              setWarmupOverrideTick, setWarmupSetEditing, skipConfirmEx, skipExercise, skipRemainingSets,
              skipSet, suggestNextWeight, suggestWarmupOverride, unskipSet, viewingWeekIdx, warmupChecked,
              warmupOverrideTick, warmupSetEditing, weekStartDate,
            }}
          />
        )}

        {/* VOLUMEN */}
        {tab === 'volumen' && (
          <LazyBoundary
            factory={volumenFactory} label="Volumen" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{ volumeLogs, volumeLoading }}
          />
        )}

        {/* FREMGANG */}
        {tab === 'fremgang' && (
          <LazyBoundary
            factory={fremgangFactory} label="Fremgang" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{ fremgangLogs, fremgangLoading, allWeeks }}
          />
        )}

        {/* KOST */}
        {tab === 'kost' && (
          <LazyBoundary
            factory={kostFactory} label="Kost" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              addFromSearch, amount, athlete, cKcal, cLen, circ, copyYesterday, createFood,
              deleteLog, deleteTemplate, editGrams, editMacros, editingLogId, fKcal, fLen,
              frequentFoods, kostDate, logTemplate, logs, macroTotal, mealTemplates,
              onSearchInput, pKcal, pLen, parseLoggedGrams, progressBars, quickAddSearchFood,
              quickLogFood, saveCustomFood, saveEditLog, saveTemplate, searchQuery,
              searchResults, selectFood, selectedFood, setAmount, setCreateFood, setEditGrams,
              setEditMacros, setEditingLogId, setKostDate, setSearchQuery, setSelectedFood,
              setShareFood, setShowCreateFood, setShowSaveTemplate, setShowTdee,
              setShowTemplates, setTemplateNameInput, setUnitIdx, shareFood, showCreateFood,
              showSaveTemplate, showTdee, showTemplates, startEditLog, tdeeEstimate,
              templateNameInput, totCarb, totFat, totKcal, totProtein, unitIdx,
            }}
          />
        )}

        {/* BESKEDER */}
        {tab === 'beskeder' && (
          <LazyBoundary
            factory={beskederFactory} label="Beskeder" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              fetchSharedVideoAnalyses, formatMsgTime, messageInput, messagesEndRef, messages,
              msgTrack, renderSharedFeedbackCards, sendAthleteMessage, setMessageInput, setMsgTrack,
              sharedVideoAnalyses, sharedVideoError, sharedVideoLoading,
            }}
          />
        )}

        {/* MOBILITET */}
        {tab === 'mobilisering' && (
          <LazyBoundary
            factory={mobiliseringFactory} label="Mobilitet" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              currentWeek, mobilityIntake, mobilityMode, mobilityPhase, mobilitySlots, mobilityStep,
              readinessLog, setMobilityIntake, setMobilityMode, setMobilityPhase, setMobilitySlots,
              setMobilityStep, setTimerActive, setTimerDone, setTimerSeconds, setWarmupChoice,
              setWarmupExercises, setWarmupFocus, setWarmupPhase, setWarmupProblems, setWarmupStep,
              setWarmupSubtype, timerActive, timerDone, timerSeconds, warmupChoice, warmupExercises,
              warmupFocus, warmupPhase, warmupProblems, warmupStep, warmupSubtype, warmupTemplates,
            }}
          />
        )}

        {/* STÆVNEDAG */}
        {tab === 'stævnedag' && (
          <LazyBoundary
            factory={staevnedagFactory} label="Stævnedag" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              athlete, coachAthleteId, hasMeetPlan, meetAttempts, meetPlanNotes, meetResults,
              meetType, meetWarmupDraft, meetWarmupEditing, meetWarmupOverrides, setAthlete,
              setMeetAttempts, setMeetType, setMeetWarmupDraft, setMeetWarmupEditing,
              setMeetWarmupOverrides, showFlash,
            }}
          />
        )}
      </div>

      {/* Bottom navigation — Stævne vises kun når den er relevant (stævnedato/plan),
          ellers fylder den en fast plads for de 7/8 atleter uden et stævne på vej. */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', zIndex: 100 }}>
        {NAV_ITEMS.filter(n => n.key !== 'stævnedag' || athlete?.competition_date || hasMeetPlan).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.7rem 0',
              color: tab === key ? '#c8923a' : '#4a4844',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.46rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{ position: 'relative' }}>
              {icon}
              {key === 'beskeder' && (unreadMsgCount + sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length) > 0 && (
                <div style={{ position: 'absolute', top: -3, right: -4, width: '8px', height: '8px', borderRadius: '50%', background: '#c8923a', border: '1.5px solid #1c1c18' }} />
              )}
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

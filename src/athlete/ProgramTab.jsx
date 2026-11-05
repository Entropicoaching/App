import OpvarmStige from './WarmupLadderView.mjs'
import { upcomingProgramWeek, programDayPreview } from './programNaesteUge.mjs'
import IntensityExplanation from './IntensityExplanation.jsx'
import { createElement } from 'react'
import { blockWeeks, renderProgramBlockOverview, DEFAULT_ENTROPI2 } from './programBlockOverview.mjs'
import RestDays from './RestDays.jsx'
import { isRestSession } from './restDays.mjs'
import { chooseRpeInput, visibleRpeNote } from '../rpeEvidence.mjs'
import { parseInputNumber } from '../inputValues.js'

// Program-fanen (ugeplan, sæt-logger, opvarmning, session-feedback) —
// udskilt fra AthleteView.jsx (ordre 232 · commit 3) som sin egen
// lazy-loadede chunk, samme LazyBoundary-mønster som Dashboard.jsx's fire
// faner (130/163/228) og src/athlete/MobiliseringTab.jsx + StaevnedagTab.jsx
// (232 · commit 2). Ren udflytning af JSX'en — ingen logikændring, kun frie
// variable gjort eksplicitte som props. Skrivefunktionerne (logSet,
// skipSet, ...) bliver i AthleteView.jsx (verify:athlete-write-failures
// læser dem der). `ExerciseTimer` (+ dens `parseDuration`-hjælper) er kun
// brugt her og flyttet helt ind — verify:athlete-rest-timer-drift opdateret
// til at læse den fra sin nye fil.
import { useState, useEffect, useRef } from 'react'
import { remainingSeconds } from '../restTimer.js'
import { parseRepsPrescription } from '../repsPrescription.js'
import { fixedRepsEntry } from '../fixedRepsEntry.js'
import { exerciseViewGroups, exerciseViewRows } from '../exerciseSetView.js'
import CountdownRing from './CountdownRing.jsx'
import { s } from '../athleteShared.js'
import { SMERTE_LINJE } from '../saetSmerte.js'

// The inline input styles reset outline; keep this override inside the program namespace.
const programFocusCss = `[data-program-accessible] :is(input, textarea, select, button):focus-visible,
[data-program-accessible] summary:focus-visible,
[data-program-week-navigation] button:focus-visible {
  outline: 3px solid #c8923a !important;
  outline-offset: 3px;
}`

const RPE_VALUES = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

// Round-one Entropi 2 palette, applied to the mounted athlete program only.
const programColors = { surface: '#1c1c18', text: '#edeae2', muted: '#c4c0b5',
  accent: '#c8923a', done: '#b9d5a0', border: '#777267' }
const programLayout = {
  label: { fontSize: 14, lineHeight: 1.5, letterSpacing: 'normal', textTransform: 'none',
    whiteSpace: 'normal', overflowWrap: 'anywhere' },
  weekText: { fontSize: '1rem', lineHeight: 1.5, letterSpacing: 'normal',
    textTransform: 'none', whiteSpace: 'normal', overflowWrap: 'anywhere' },
  block: { padding: 16, borderRadius: 12, background: programColors.surface,
    borderInlineStart: `4px solid ${programColors.accent}`, boxSizing: 'border-box' },
  week: { padding: 16, borderRadius: 12, background: programColors.surface,
    border: `1px solid ${programColors.border}`, borderInlineStart: `4px solid ${programColors.accent}`,
    minWidth: 0, overflowWrap: 'anywhere', boxSizing: 'border-box' },
  badge: { display: 'inline-block', padding: '3px 8px', borderRadius: 6,
    border: '1px solid currentColor', color: programColors.accent, fontSize: '0.8rem',
    lineHeight: 1.5, textTransform: 'none', letterSpacing: 'normal', maxWidth: '100%',
    overflowWrap: 'anywhere', boxSizing: 'border-box' },
}
function programBlockElement(options, appearanceOn) {
  const block = renderProgramBlockOverview(createElement, options)
  if (!appearanceOn) return block
  // Move historical navigation into its own closed fold. Keep the existing
  // renderer's rows (including volume/date/status) and original week indices.
  const previous = options.allWeeks.slice(0, options.activeWeekIdx)
  const history = new Map(previous.map(week => [String(week.id), null]))
  const split = (node, path = 'block') => {
    if (Array.isArray(node)) return node.map((child, index) => split(child, `${path}-${index}`))
    if (!node || typeof node !== 'object' || !node.props) return node
    const key = String(node.key ?? node.props.key)
    if (node.type === 'li' && history.has(key)) { history.set(key, node); return null }
    return createElement(node.type, { ...node.props, key: node.key ?? node.props.key ?? path }, split(node.props.children, path))
  }
  const content = split(block.props.children)
  const earlier = !options.programError && previous.length > 0 && createElement('details', { 'data-program-history': true },
    createElement('summary', { style: { cursor: 'pointer', minHeight: 44, padding: '0.75rem 0' } }, 'Vis tidligere uger'),
    createElement('ul', { style: { listStyle: 'none', padding: 0, display: 'grid', gap: 8 } },
      previous.map((week, index) => history.get(String(week.id)) || createElement('li', { key: week.id },
        createElement('button', { type: 'button', onClick: () => options.goToWeek(index),
          'aria-pressed': index === options.viewingWeekIdx,
          style: { ...s.btnGhost, minHeight: 44, width: '100%', whiteSpace: 'normal', textAlign: 'left' } },
        `Uge ${week.week_number}${week.block_name ? ` · ${week.block_name}` : ''}`)))))
  // Mark and style the renderer's root; accessible copy can change independently.
  return createElement(block.type, { ...block.props, 'data-program-block-overview': true,
    style: { ...block.props.style, ...programLayout.block } }, content, earlier)
}

// Keep unlike prescriptions as coach-written text, never average RPE and percent.
function programWeekIntensity(week) {
  const targets = new Set()
  if (!Array.isArray(week?.sessions) || week?.readEvidence?.complete === false) return { targets: [], unavailable: true }
  let missing = false
  for (const session of week?.sessions || []) {
    if (!Array.isArray(session?.exercises)) { missing = true; continue }
    for (const exercise of session.exercises) {
      const value = typeof exercise?.intensity === 'string' ? exercise.intensity.trim() : ''
      if (value) targets.add(value)
      else missing = true
    }
  }
  return { targets: [...targets], missing }
}

// Use the displayed week's civil date, not the active-week anchor (which can advance).
function programTodaySession(week, session, weekStart, today) {
  if (!Number.isInteger(session.weekday) || session.weekday < 0 || session.weekday > 6) return false
  const start = week.start_date || (weekStart instanceof Date && Number.isFinite(weekStart.getTime())
    ? `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}` : null)
  if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return false
  const date = new Date(start + 'T12:00:00Z')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) return false
  date.setUTCDate(date.getUTCDate() + session.weekday)
  return date.toISOString().slice(0, 10) === today
}

// A green completion marker needs every exact prescribed set, with no skipped sets.
// The logger's existing isDone rule and write handlers are left intact.
function programSessionCompletion(session, logs) {
  if (!Array.isArray(session.exercises) || !session.exercises.length) return null
  let count = 0, skipped = false
  for (const exercise of session.exercises) {
    const rawSets = exercise?.sets
    const sets = typeof rawSets === 'number' || (typeof rawSets === 'string' && rawSets.trim()) ? Number(rawSets) : NaN
    if (!exercise?.id || !Number.isSafeInteger(sets) || sets < 0) return null
    for (let number = 1; number <= sets; number++) {
      const log = logs.find(row => row.exercise_id === exercise.id && row.set_number === number)
      if (!log) return null
      skipped ||= !!log.skipped
      count++
    }
  }
  return count ? (skipped ? 'closed' : 'done') : null
}

// The existing program reader supplies logs; unknown plans/logs never suggest a pass.
function nextProgramSession(weeks, activeIndex, currentLogs, upcomingLogs) {
  for (let index = activeIndex; index < weeks.length; index++) {
    const week = weeks[index]
    const logs = index === activeIndex ? currentLogs : upcomingLogs
    if (!week?.id || !Array.isArray(logs) || !Array.isArray(week.sessions) || week.readEvidence?.complete === false) return null
    for (const session of week.sessions) {
      if (!session?.id || !Array.isArray(session.exercises)) return null
      if (!session.exercises.length) continue
      if (session.exercises.some(ex => !ex?.id || !(typeof ex.sets === 'number' || (typeof ex.sets === 'string' && ex.sets.trim())) || !Number.isSafeInteger(Number(ex.sets)) || Number(ex.sets) < 0)) return null
      if (!session.exercises.some(ex => Number(ex.sets) > 0)) continue
      // A skipped pass is closed, as in the existing logger, rather than suggested again.
      if (!programSessionCompletion(session, logs)) return { index, weekId: week.id, sessionId: session.id, title: session.title }
    }
  }
  return null
}
function programWeekStorageKey(athleteId) {
  return typeof athleteId === 'string' && athleteId ? `entropi2:athlete:${encodeURIComponent(athleteId)}:program:last-week` : null
}

const BLOCK_PALETTE = ['#4e8fcf','#c8923a','#6cba6c','#9b6bd4','#cf6b4e','#4ec8b4']
function blockColor(name) {
  if (!name) return '#4a4844'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BLOCK_PALETTE[h % BLOCK_PALETTE.length]
}
function computePhases(weeks) {
  if (!weeks.length) return []
  const phases = []
  let cur = { name: weeks[0].block_name || null, weeks: [weeks[0]] }
  for (let i = 1; i < weeks.length; i++) {
    const n = weeks[i].block_name || null
    if (n === cur.name) cur.weeks.push(weeks[i])
    else { phases.push(cur); cur = { name: n, weeks: [weeks[i]] } }
  }
  phases.push(cur)
  return phases
}

// Find en holdetid (i sekunder) i en øvelses reps/intensity-tekst. Genkender
// "30 sek", "50s", "1 min", "1:30" m.m. Returnerer { seconds, text } eller null,
// hvor text er den rå streng der matchede (så fx "pr side" kan vises).
function parseDuration(...parts) {
  for (const p of parts) {
    if (!p) continue
    const str = String(p).trim()
    const low = str.toLowerCase()
    let m = low.match(/(\d+):(\d{2})/)
    if (m) return { seconds: +m[1] * 60 + +m[2], text: str }
    m = low.match(/(\d+(?:[.,]\d+)?)\s*min/)
    if (m) return { seconds: Math.round(parseFloat(m[1].replace(',', '.')) * 60), text: str }
    m = low.match(/(\d+)\s*(?:sek|sec|s)\b/)
    if (m) return { seconds: +m[1], text: str }
  }
  return null
}

// Selvstændigt stopur til tids-øvelser (fx planke) i programmet. Samme look og
// adfærd som mobilitetens timer (CountdownRing + start/pause/fortsæt/gentag), men
// med sin EGEN state så flere kan stå på siden uden at kollidere med hinanden
// eller med den delte mobilitets-timer.
function ExerciseTimer({ duration, label, accessible = false, context, entropi2 = false }) {
  const control = entropi2 === true ? { ...s.btnGhost, minHeight: 44, minWidth: 44, boxSizing: 'border-box', color: programColors.muted } : s.btnGhost
  // G5: 'remaining' er sekunder tilbage NÅR ikke aktiv (frosset ved
  // pause/klar/gentag). Mens aktiv driver 'liveSeconds' visningen, opdateret
  // af effekten nedenfor ud fra tidsstempler i startRef — aldrig ved at
  // tælle ticks ned. Se restTimer.js. startRef læses kun inde i effekten
  // (aldrig under selve renderet), så et evt. baggrunds-throttlet interval
  // ikke giver en forkert værdi: næste tick (eller visibilitychange) regner
  // altid den rigtige, aktuelle rest ud fra uret, ikke fra sidste tick.
  const [remaining, setRemaining] = useState(duration)
  const [active, setActive] = useState(false)
  const [done, setDone] = useState(false)
  const [liveSeconds, setLiveSeconds] = useState(duration)
  const startRef = useRef(null) // { remainingAtStart, startedAt } for det igangværende aktive segment

  const seconds = active ? liveSeconds : remaining

  useEffect(() => {
    if (!active) return
    startRef.current = { remainingAtStart: remaining, startedAt: Date.now() }
    const recompute = () => {
      const live = remainingSeconds(startRef.current.remainingAtStart, startRef.current.startedAt)
      setLiveSeconds(live)
      if (live <= 0) { setRemaining(0); setActive(false); setDone(true) }
    }
    recompute()
    const id = setInterval(recompute, 250)
    const onVisible = () => { if (document.visibilityState === 'visible') recompute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved start/stop af det aktive segment; 'remaining' er kun brugt som startpunkt for DET segment
  }, [active])

  return (
    <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
      <div style={{ marginBottom: '0.6rem' }}>
        <CountdownRing total={duration} remaining={seconds > 0 ? seconds : duration} done={done} />
      </div>
      {label && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: entropi2 === true ? programColors.muted : '#7a7770', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>{label}</div>}
      {!done ? (
        <button {...(accessible ? { type: 'button', 'aria-label': `${active ? 'Pause' : seconds > 0 && seconds < duration ? 'Fortsæt' : 'Start timer'} · ${context}` } : {})} style={{ ...control, padding: '0.5rem 1.25rem' }} onClick={() => {
          if (active) { setRemaining(seconds); setActive(false) } else setActive(true)
        }}>
          {active ? '⏸ Pause' : (seconds > 0 && seconds < duration) ? '▶ Fortsæt' : '▶ Start timer'}
        </button>
      ) : (
        <button {...(accessible ? { type: 'button', 'aria-label': `Gentag timer · ${context}` } : {})} style={{ ...control, padding: '0.5rem 1.25rem' }} onClick={() => { setRemaining(duration); setDone(false); setActive(false) }}>↺ Gentag</button>
      )}
    </div>
  )
}

// Mounted only for strict Entropi 2 ON; report state is separate from the legacy logger.
function ProgramBlokslut({ allWeeks, athlete, programError }) {
  const [blokslut, setBlokslut] = useState(null)
  const [blokslutRetry, setBlokslutRetry] = useState(0)
  // Lazy analysis owns its full-block reader. OFF never loads it or touches storage.
  const athleteId = athlete?.id
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' })
  const weekStart = allWeeks.map(week => week.start_date)
    .filter(start => typeof start === 'string' && start <= day).at(-1)
  const blokslutWeek = weekStart + ':' + Math.floor(
    (new Date(day + 'T12:00:00Z') - new Date(weekStart + 'T12:00:00Z')) / 604800000)
  // Plan content, not array identity or per-set logs, defines the read snapshot.
  const blokslutPlan = JSON.stringify(allWeeks)
  // Keep this athlete's previous report visible while confirming/reading a new one.
  const blokslutCurrent = blokslut?.athleteId === athleteId ? blokslut : null
  useEffect(() => {
    const weeks = JSON.parse(blokslutPlan)
    if (!athleteId || !weeks.length) return
    let cancelled = false
    const now = new Date()
    import('../entropi2/analysis/blokslut/programBlokslut.mjs').then(async api => {
      const reportBlock = await api.confirmProgramBlock(athleteId, weeks, now)
      if (cancelled || !reportBlock) { if (!cancelled) setBlokslut(null); return }
      const key = api.blokslutSeenKey(athleteId, reportBlock)
      let storage
      try { storage = globalThis.localStorage } catch { /* Optional persistence. */ }
      const scope = { athleteId, key, api, storage }
      setBlokslut(previous => previous?.athleteId === athleteId && previous.model ? previous :
        { ...scope, open: !api.wasBlokslutSeen(storage, key), model: { status: 'loading', message: 'Henter blokkens data.' } })
      const model = await api.programBlokslutModel({ athleteId, block: reportBlock, now, programError })
      if (!cancelled) setBlokslut(previous => ({ ...scope,
        open: previous?.key === key ? previous.open : !api.wasBlokslutSeen(storage, key), model }))
    }).catch(() => { if (!cancelled) setBlokslut({ athleteId, planError: true }) })
    return () => { cancelled = true }
  }, [blokslutPlan, athleteId, programError, blokslutWeek, blokslutRetry])
  useEffect(() => {
    if (blokslutCurrent?.model?.status === 'ready')
      blokslutCurrent.api.markBlokslutSeen(blokslutCurrent.storage, blokslutCurrent.key)
  }, [blokslutCurrent])
  if (blokslutCurrent?.planError) return (
    <div role="alert" style={{ marginBottom: 20, color: '#edeae2' }}>
      Blokrapporten kunne ikke hentes.
      <button type="button" style={{ minHeight: 44, padding: '8px 16px' }}
        onClick={() => setBlokslutRetry(value => value + 1)}>Prøv igen</button>
    </div>
  )
  return (blokslutCurrent && blokslutCurrent.api.renderProgramBlokslut(createElement, blokslutCurrent.model, {
    open: blokslutCurrent.open,
    onToggle: event => {
      const open = event.currentTarget.open
      setBlokslut(previous => previous?.key === blokslutCurrent.key ? { ...previous, open } : previous)
    },
    onRetry: () => setBlokslutRetry(value => value + 1),
  }))
}

export default function ProgramTab({
  readOnly = false, opvarmStige = false, hviledageListe = false, restMobility, programIntensityHelp = false, programUgeFoerst = false, programNaesteUge = false, programBlokOversigt = false, fetchProgramBlockLogs,
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
  warmupOverrideTick, warmupSetEditing, weekStartDate, vaerdF6 = false, entropi2 = DEFAULT_ENTROPI2,
}) {
          // Følg den aktive uge der blev ankret i fetchProgram (kan være rykket
          // frem til næste uge når den aktuelle er fuldt logget). Fald tilbage til
          // den rene dato-beregning hvis ankeret ikke findes.
          const blockOverviewOn = entropi2 === true || programBlokOversigt === true
          const ugeFoerst = programUgeFoerst === true && !blockOverviewOn
          const anchoredIdx = allWeeks.findIndex(w => w.id === currentWeek?.id)
          const activeWeekIdx = anchoredIdx >= 0 ? anchoredIdx : computeActiveWeekIdx(allWeeks)
          const block = blockWeeks(allWeeks, activeWeekIdx)
          const [blockStatus, setBlockStatus] = useState(null)
          useEffect(() => {
            if (!blockOverviewOn || !athlete?.id || !block.length) return
            let cancelled = false
            setBlockStatus(null)
            Promise.resolve().then(() => fetchProgramBlockLogs(athlete.id, entropi2 === true ? allWeeks.slice(activeWeekIdx) : block.map(row => row.week)))
              .then(logs => { if (!cancelled) setBlockStatus({ weeks: allWeeks, athleteId: athlete.id, activeWeekIdx, logs }) })
              .catch(() => { if (!cancelled) setBlockStatus(null) })
            return () => { cancelled = true }
            // The reader is recreated by the parent; data changes trigger a fresh status read.
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [blockOverviewOn, entropi2, allWeeks, activeWeekIdx, athlete?.id, exerciseLogs, pastLogs])
          const viewedWeek = allWeeks[viewingWeekIdx] || null
          const viewedRange = viewedWeek ? fmtWeekRange(weekStartDate(allWeeks, viewedWeek.week_number)) : null
          const isCurrentWeek = viewingWeekIdx === activeWeekIdx
          const isFutureWeek = viewingWeekIdx > activeWeekIdx
          const logsForView = isCurrentWeek ? exerciseLogs : pastLogs
          const programAppearanceOn = entropi2 === true
          const a11y = attributes => programAppearanceOn ? attributes : {}
          const programGhost = programAppearanceOn ? { ...s.btnGhost, color: programColors.muted } : s.btnGhost
          const programTapTarget = programAppearanceOn ? { minHeight: 44, minWidth: 44, boxSizing: 'border-box' } : {}
          const intensity = programAppearanceOn && !programError ? programWeekIntensity(viewedWeek) : null
          const programToday = programAppearanceOn ? new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' }) : null
          const viewedStart = programAppearanceOn && viewedWeek ? weekStartDate(allWeeks, viewedWeek.week_number) : null
          const upcomingPreview = programNaesteUge === true && upcomingProgramWeek(
            viewedWeek ? weekStartDate(allWeeks, viewedWeek.week_number) : null, isFutureWeek,
          )

          const storageKey = programAppearanceOn ? programWeekStorageKey(athlete?.id) : null
          const [restoredKey, setRestoredKey] = useState(null)
          const [pendingJump, setPendingJump] = useState(null)
          const knownUpcomingLogs = blockStatus?.activeWeekIdx === activeWeekIdx && blockStatus?.weeks === allWeeks
            && blockStatus?.athleteId === athlete?.id ? blockStatus.logs : null
          const nextSession = programAppearanceOn && !programError
            ? nextProgramSession(allWeeks, activeWeekIdx, exerciseLogs, knownUpcomingLogs) : null
          const goToWeek = (gi) => {
            if (!allWeeks[gi]) return
            setViewingWeekIdx(gi)
            setProgOpenSession(null)
            if (gi < activeWeekIdx) fetchPastLogs(allWeeks[gi], athlete.id)
            else setPastLogs(programAppearanceOn && gi > activeWeekIdx && Array.isArray(knownUpcomingLogs) ? knownUpcomingLogs : [])
            if (storageKey) {
              try { globalThis.localStorage?.setItem(storageKey, JSON.stringify(allWeeks[gi].id)) } catch { /* navigation still works without storage */ }
            }
          }
          useEffect(() => {
            if (!storageKey || restoredKey === storageKey || !allWeeks.length || programError) return
            let id
            try { id = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? 'null') }
            catch { setRestoredKey(storageKey); return }
            if (typeof id !== 'string') { setRestoredKey(storageKey); return }
            const index = allWeeks.findIndex(week => week.id === id)
            // The parent may still hold the prior athlete's weeks during a switch.
            // Retry a saved identity when the new program arrives; never save a fallback.
            if (index < 0) return
            setRestoredKey(storageKey)
            if (index === viewingWeekIdx) return
            setViewingWeekIdx(index)
            setProgOpenSession(null)
            if (index < activeWeekIdx) fetchPastLogs(allWeeks[index], athlete.id)
            else setPastLogs([])
            // Restore only once per athlete; refreshes must not undo a deliberate navigation.
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [storageKey, restoredKey, allWeeks, programError])
          useEffect(() => {
            if (!programAppearanceOn || !pendingJump) return
            if (pendingJump.athleteId !== athlete?.id || programError) { setPendingJump(null); return }
            if (viewedWeek?.id !== pendingJump.weekId || progOpenSession !== pendingJump.sessionId) return
            const target = sessionRefs?.current?.[pendingJump.sessionId]
            if (target) {
              target.scrollIntoView?.({ block: 'start', behavior: 'instant' })
              target.focus?.({ preventScroll: true })
            }
            setPendingJump(null)
          }, [programAppearanceOn, pendingJump, athlete?.id, programError, viewedWeek?.id, progOpenSession, sessionRefs])

          const blokOversigt = allWeeks.length > 0 && (() => {
                    const compDate = athlete?.competition_date
                    const compMs = compDate ? new Date(compDate + 'T12:00:00') - new Date() : null
                    const weeksToComp = compMs != null ? Math.ceil(compMs / (7 * 24 * 3600 * 1000)) : null

                    const phases = computePhases(allWeeks)
                    const totalWeeks = allWeeks.length

                    // Globalt start-index pr. fase
                    const phaseStart = []
                    { let acc = 0; for (const p of phases) { phaseStart.push(acc); acc += p.weeks.length } }

                    // Fasen for den uge man KIGGER på (så navigation føles sammenhængende)
                    let viewedPhaseIdx = 0
                    for (let i = 0; i < phases.length; i++) {
                      if (phaseStart[i] + phases[i].weeks.length > viewingWeekIdx) { viewedPhaseIdx = i; break }
                    }
                    const phase = phases[viewedPhaseIdx]
                    const startGlobal = phaseStart[viewedPhaseIdx]
                    const color = programAppearanceOn ? programColors.accent : phase.name ? blockColor(phase.name) : '#7a7770'

                    const fmt = ds => new Date(ds + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                    const firstDate = phase.weeks[0]?.start_date
                    const lastStart = phase.weeks[phase.weeks.length - 1]?.start_date
                    const dateRange = firstDate && lastStart
                      ? `${fmt(firstDate)} til ${fmt(new Date(new Date(lastStart + 'T12:00:00').getTime() + 6 * 86400000).toISOString().slice(0, 10))}`
                      : null



                    const prevPhase = viewedPhaseIdx > 0 ? phases[viewedPhaseIdx - 1] : null
                    const nextPhase = viewedPhaseIdx < phases.length - 1 ? phases[viewedPhaseIdx + 1] : null

                    const chipStyle = {
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em',
                      color: (programAppearanceOn ? programColors.muted : '#7a7770'), whiteSpace: 'nowrap', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis',
                      // G9: kun 17px høj med nul vandret padding — samme mønster/metode som F13-F16
                      // (ordre 68): minHeight + boxSizing, bredden på tekstknappen bevares.
                      minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center',
                      ...(programAppearanceOn ? { ...programLayout.weekText, overflow: 'visible', textOverflow: 'clip' } : {}),
                    }

                    return (
                      <div {...a11y({ 'data-program-week-navigation': true })} style={{ marginBottom: '1.5rem', ...(programAppearanceOn ? programLayout.block : {}) }}>
                        {weeksToComp != null && weeksToComp > 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#c8923a', letterSpacing: '0.1em', marginBottom: '0.7rem', ...(programAppearanceOn ? programLayout.weekText : {}) }}>
                            🏆 {weeksToComp} uger til stævne
                          </div>
                        )}
                        {weeksToComp != null && weeksToComp <= 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.7rem', ...(programAppearanceOn ? programLayout.weekText : {}) }}>
                            🏆 Stævne passeret
                          </div>
                        )}

                        {/* Blok-skift */}
                        {(prevPhase || nextPhase) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            {prevPhase
                              ? <button style={{ ...programTapTarget, ...chipStyle }} onClick={() => goToWeek(phaseStart[viewedPhaseIdx - 1])}>‹ {prevPhase.name || 'Tidligere'}</button>
                              : <span />}
                            {nextPhase
                              ? <button style={{ ...programTapTarget, ...chipStyle, textAlign: 'right', justifyContent: 'flex-end' }} onClick={() => goToWeek(phaseStart[viewedPhaseIdx + 1])}>{nextPhase.name || 'Næste blok'} ›</button>
                              : <span />}
                          </div>
                        )}

                        {/* Blok-header */}
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', ...(programAppearanceOn ? { flexWrap: 'wrap' } : {}) }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(programAppearanceOn ? { whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.5 } : {}) }}>
                              {phase.name || 'Ingen blok'}
                            </span>
                          </div>
                          {dateRange && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: programAppearanceOn ? programColors.muted : '#7a7770', letterSpacing: '0.04em', whiteSpace: 'nowrap', ...(programAppearanceOn ? programLayout.weekText : {}) }}>{dateRange}</span>
                          )}
                        </div>

                        {/* Uge-prikker */}
                        {!blockOverviewOn && <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                          {phase.weeks.map((w, j) => {
                            const gi = startGlobal + j
                            const isViewed = gi === viewingWeekIdx
                            const isActive = gi === activeWeekIdx
                            const isDone = gi < activeWeekIdx
                            return (
                              <div key={w.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, position: 'relative' }}>
                                {j > 0 && (
                                  <div style={{ position: 'absolute', top: '10px', right: '50%', left: '-50%', height: '2px', background: gi <= activeWeekIdx ? color + 'aa' : 'rgba(237,234,226,0.12)' }} />
                                )}
                                <button
                                  onClick={() => goToWeek(gi)}
                                  style={{
                                    position: 'relative', zIndex: 1,
                                    width: isViewed ? '22px' : '20px', height: isViewed ? '22px' : '20px', borderRadius: '50%',
                                    background: isViewed ? color : isDone ? color + 'cc' : isActive ? color + '33' : 'transparent',
                                    border: `2px solid ${isViewed || isActive ? color : isDone ? color + 'cc' : 'rgba(237,234,226,0.22)'}`,
                                    boxShadow: isViewed ? `0 0 0 4px ${color}22` : 'none',
                                    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {isDone && !isViewed && <span style={{ color: '#141410', fontSize: '0.62rem', lineHeight: 1 }}>✓</span>}
                                </button>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: isViewed ? color : isDone ? '#7a7770' : '#4a4844', marginTop: '0.45rem' }}>
                                  {w.week_number}
                                </span>
                              </div>
                            )
                          })}
                        </div>}

                        {/* Caption */}
                        <div style={{ marginTop: '0.9rem', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', ...(programAppearanceOn ? programLayout.weekText : {}) }}>
                          {/* Brug det faktiske week_number, så caption og blok-overskrift
                              aldrig modsiger hinanden (fx uge 0 der før stod som "uge 1 af 1"). */}
                          {viewingWeekIdx === activeWeekIdx
                            ? <span style={{ color }}>● Du er her · uge {viewedWeek?.week_number}</span>
                            : viewingWeekIdx > activeWeekIdx
                              ? <span style={{ color: programAppearanceOn ? programColors.muted : '#7a7770' }}>Planlagt · uge {viewedWeek?.week_number}</span>
                              : <span style={{ color: programAppearanceOn ? programColors.muted : '#7a7770' }}>Historisk · uge {viewedWeek?.week_number}</span>}
                          {viewedRange && <span style={{ color: '#a8a498' }}> · {viewedRange}</span>}
                          {!blockOverviewOn && <span style={{ color: '#a8a498' }}> · aktiv uge {activeWeekIdx + 1} af {totalWeeks}</span>}
                        </div>
                      </div>
                    )
                  })()
          const blokTekst = viewedWeek ? (
            <>
                  {viewedWeek.coach_note && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), marginBottom: '1rem', letterSpacing: '0.04em' }}>
                      {viewedWeek.coach_note}
                    </div>
                  )}

                  {viewedWeek.block_description && (
                    <div style={{ borderLeft: '2px solid rgba(200,146,58,0.3)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.3rem' }}>Fra din coach</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300, color: (programAppearanceOn ? programColors.muted : '#7a7770'), fontStyle: 'italic', lineHeight: 1.6 }}>{viewedWeek.block_description}</div>
                    </div>
                  )}

            </>
          ) : null

          const programContent = (
            <>
              {allWeeks.length === 0 ? (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: (programAppearanceOn ? programColors.muted : '#4a4844'), marginBottom: '0.5rem' }}>Program</div>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Dit program.</h1>
                  </div>
                  {programAppearanceOn ? (
                    <section data-program-empty-state="" role={programError ? 'alert' : 'status'} data-program-accessible=""
                      style={{ ...programLayout.week, padding: 20, borderRadius: 16, color: programColors.text }}>
                      {!programError && <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem',
                        color: programColors.accent, marginBottom: 12, letterSpacing: '0.02em' }}>Entropi.</div>}
                      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400,
                        color: programColors.text, lineHeight: 1.3, margin: '0 0 12px' }}>
                        {programError ? 'Dit program kunne ikke hentes.' : 'Dit program er på vej.'}
                      </h2>
                      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, lineHeight: 1.6,
                        letterSpacing: 'normal', color: programColors.muted, margin: 0 }}>
                        {programError ? 'Tjek din forbindelse og prøv igen.'
                          : 'Din coach sætter det op inden din næste træning.'}
                      </p>
                      {programError && <button type="button" style={{ ...programTapTarget, ...programGhost, minHeight: 48, marginTop: 16,
                        fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 16, lineHeight: 1.5,
                        letterSpacing: 'normal', textTransform: 'none', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                        onClick={() => fetchProgram(athlete.id)}>Prøv igen</button>}
                    </section>
                  ) : programError ? (
                    // G1: en fejlet hentning må aldrig ligne "du har intet program" —
                    // ærlig fejllinje + en vej til at prøve igen, ikke stilhed.
                    <div style={{ ...s.card, textAlign: 'center', padding: '3rem 1.5rem' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.75rem' }}>Dit program kunne ikke hentes.</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), letterSpacing: '0.08em', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                        Tjek din forbindelse og prøv igen.
                      </div>
                      <button style={{ ...programTapTarget, ...programGhost }} onClick={() => fetchProgram(athlete.id)}>Prøv igen</button>
                    </div>
                  ) : (
                    <div style={{ ...s.card, textAlign: 'center', padding: '3rem 1.5rem' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#c8923a', marginBottom: '1rem', letterSpacing: '0.02em' }}>Entropi.</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.75rem' }}>Dit program er på vej.</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), letterSpacing: '0.08em', lineHeight: 1.7 }}>
                        Din coach sætter det op inden din næste træning.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {nextSession && <button type="button" data-program-next=""
                    style={{ ...programTapTarget, ...s.btnPrimary, minHeight: 48, width: '100%', marginBottom: 16, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                    onClick={() => {
                      goToWeek(nextSession.index)
                      setProgOpenSession(nextSession.sessionId)
                      setPendingJump({ ...nextSession, athleteId: athlete?.id })
                    }}>Næste pas · {nextSession.title || 'Åbn pas'}</button>}
                  {blockOverviewOn && programBlockElement({
                    allWeeks, activeWeekIdx, viewingWeekIdx, weekStartDate, programError,
                    onRetry: () => fetchProgram(athlete.id),
                    logs: blockStatus?.activeWeekIdx === activeWeekIdx && blockStatus?.weeks === allWeeks && blockStatus?.athleteId === athlete?.id ? blockStatus.logs : null,
                    goToWeek,
                  }, programAppearanceOn)}
                  {entropi2 === true && <ProgramBlokslut allWeeks={allWeeks} athlete={athlete} programError={programError} />}
                  {/* Readiness → træning: ærlig autoregulerings-cue ud fra dagens parathed
                      (kun aktuel uge; readinessLog er allerede i state). */}
                  {isCurrentWeek && readinessLog && readinessLog.readiness_score != null && readinessLog.readiness_score < 75 && (() => {
                    const sc = readinessLog.readiness_score
                    const low = sc < 50
                    return (
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.85rem 1rem', marginBottom: '1.25rem', background: low ? 'rgba(224,85,85,0.07)' : 'rgba(200,146,58,0.07)', border: `1px solid ${low ? 'rgba(224,85,85,0.25)' : 'rgba(200,146,58,0.2)'}` }}>
                        <span style={{ color: low ? '#e05555' : '#c8923a', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{low ? '⚠' : '◐'}</span>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: low ? '#e05555' : '#c8923a', marginBottom: '0.3rem', ...(programAppearanceOn ? programLayout.label : {}) }}>Parathed {sc}/100 i dag</div>
                          <div style={{ fontSize: '0.82rem', color: '#b8b4a8', lineHeight: 1.6 }}>
                            {low
                              ? 'Lav parathed. Du kan skrue intensiteten ned, droppe de sidste sæt, eller tage en let session. Skriv til din coach, hvis det varer ved.'
                              : 'Moderat parathed. Kør planen, men lyt til kroppen og pres ikke topsæt hvis det føles tungt.'}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  {!readOnly && isCurrentWeek && !readinessLog && (
                    <button type="button" onClick={openReadiness} style={{ ...programTapTarget, display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.7rem 1rem', marginBottom: '1.25rem', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.13)', cursor: 'pointer' }}>
                      <span style={{ color: '#c8923a', fontSize: '0.9rem', flexShrink: 0 }}>◐</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.06em', lineHeight: 1.5, ...(programAppearanceOn ? programLayout.label : {}) }}>Log dagens parathed for en tilpasset anbefaling →</span>
                    </button>
                  )}

                  {!ugeFoerst && blokOversigt}

                  {/* Week header — navigation only shown when multiple weeks exist */}
                  <div {...a11y({ 'data-program-week-navigation': true })} style={{ marginBottom: '1.25rem', ...(programAppearanceOn ? programLayout.week : {}) }}>
                    {allWeeks.length > 1 ? (
                      <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...(programAppearanceOn ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 } : {}) }}>
                        <button
                          style={{ ...programTapTarget, ...programGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: viewingWeekIdx === 0 ? 0.25 : 1, ...(programAppearanceOn ? { ...programLayout.weekText, minHeight: 44 } : {}) }}
                          disabled={viewingWeekIdx === 0}
                          onClick={() => {
                            const ni = viewingWeekIdx - 1
                            if (programAppearanceOn) { goToWeek(ni); return }
                            setViewingWeekIdx(ni)
                            setProgOpenSession(null)
                            fetchPastLogs(allWeeks[ni], athlete.id)
                          }}
                        >← Forrige uge</button>
                        <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem', ...(programAppearanceOn ? { gridColumn: '1 / -1', gridRow: 1, minWidth: 0 } : {}) }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', ...(programAppearanceOn ? programLayout.weekText : {}) }}>
                            Uge {viewedWeek.week_number}{viewedRange ? ` · ${viewedRange}` : ''}
                            {isFutureWeek && <span style={{ color: (programAppearanceOn ? programColors.muted : '#4a4844'), marginLeft: '0.5em' }}>· planlagt</span>}
                            {!isCurrentWeek && !isFutureWeek && <span style={{ color: (programAppearanceOn ? programColors.muted : '#4a4844'), marginLeft: '0.5em' }}>· historisk</span>}
                          </div>
                          {!ugeFoerst && viewedWeek.block_name && (
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2', marginTop: '0.1rem' }}>{viewedWeek.block_name}</div>
                          )}
                        </div>
                        <button
                          style={{ ...programTapTarget, ...programGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: viewingWeekIdx >= allWeeks.length - 1 ? 0.25 : 1, ...(programAppearanceOn ? { ...programLayout.weekText, minHeight: 44 } : {}) }}
                          disabled={viewingWeekIdx >= allWeeks.length - 1}
                          onClick={() => {
                            const ni = viewingWeekIdx + 1
                            if (programAppearanceOn) { goToWeek(ni); return }
                            setViewingWeekIdx(ni)
                            setProgOpenSession(null)
                            if (ni < activeWeekIdx) {
                              fetchPastLogs(allWeeks[ni], athlete.id)
                            } else {
                              setPastLogs([])
                            }
                          }}
                        >Næste uge →</button>
                      </div>
                      {!isCurrentWeek && (
                        <div style={{ textAlign: 'center', marginTop: '0.6rem' }}>
                          <button
                            style={{ ...programTapTarget, ...programGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)', ...(programAppearanceOn ? programLayout.weekText : {}) }}
                            onClick={() => {
                              if (programAppearanceOn) { goToWeek(activeWeekIdx); return }
                              setViewingWeekIdx(activeWeekIdx)
                              setProgOpenSession(null)
                              setPastLogs([])
                            }}
                          >↩ Tilbage til denne uge</button>
                        </div>
                      )}
                      </>
                    ) : (
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem', ...(programAppearanceOn ? programLayout.weekText : {}) }}>
                          Uge {viewedWeek.week_number}
                        </div>
                        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                          {ugeFoerst ? 'Dit program' : viewedWeek.block_name || 'Dit program'}.
                        </h1>
                      </div>
                    )}
                    {programAppearanceOn && (
                      <div data-program-intensity="" style={{ marginTop: 16, color: programColors.muted, lineHeight: 1.6 }}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 500, color: programColors.text }}>Ugens intensitet · plan</h2>
                        {programError || intensity.unavailable ? 'Intensiteten er ikke tilgængelig.' : intensity.targets.length ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {intensity.targets.map(target => <span key={target} style={programLayout.badge}>{target}</span>)}
                          </div>
                        ) : 'Ikke angivet i planen.'}
                        {!programError && intensity.missing && intensity.targets.length > 0 && <p style={{ margin: '8px 0 0' }}>Ikke angivet for alle øvelser.</p>}
                      </div>
                    )}
                  </div>

                  {!ugeFoerst && blokTekst}

                  {hviledageListe === true && <RestDays restMobility={restMobility} week={viewedWeek} weekStart={weekStartDate(allWeeks, viewedWeek.week_number)} />}

                  {(viewedWeek.sessions || []).filter(session => hviledageListe !== true || !isRestSession(viewedWeek, session)).map((session, sessionIdx) => {
                    const sessionContext = `${session.title || 'Træningspas'} · pas ${sessionIdx + 1}, uge ${viewedWeek.week_number}`
                    const panelId = `program-session-${encodeURIComponent(viewedWeek.id)}-${encodeURIComponent(session.id)}`
                    const isOpen = progOpenSession === session.id
                    const preview = upcomingPreview ? programDayPreview(session.exercises) : null
                    const sessionExIds = (session.exercises || []).map(e => e.id)
                    const sessionLogs = logsForView.filter(l => sessionExIds.includes(l.exercise_id))
                    const totalSets = (session.exercises || []).reduce((acc, e) => acc + (e.sets || 0), 0)
                    // Et sæt taeller een gang (oevelse + saetnummer), saa et rettet/gen-logget saet
                    // aldrig giver "5/4".
                    const loggedSets = new Set(sessionLogs.filter(l => !l.skipped).map(l => `${l.exercise_id}|${l.set_number}`)).size
                    const isDone = totalSets > 0 && new Set(sessionLogs.map(l => `${l.exercise_id}|${l.set_number}`)).size >= totalSets
                    const isToday = programAppearanceOn && !programError && viewedWeek.readEvidence?.complete !== false
                      && programTodaySession(viewedWeek, session, viewedStart, programToday)
                    const completion = programAppearanceOn && !programError && viewedWeek.readEvidence?.complete !== false
                      ? programSessionCompletion(session, sessionLogs) : null
                    const sessionAccent = completion === 'done' ? programColors.done : isToday || isOpen ? programColors.accent : programColors.border
                    const sessionActions = !readOnly && !upcomingPreview && !isDone && totalSets > 0 && (
                      <>
                        <button
                          style={{ ...programTapTarget, ...programGhost, fontSize: '0.62rem', padding: '0.35rem 0.7rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), borderColor: 'rgba(237,234,226,0.18)', opacity: pendingSessionAction?.startsWith(`${session.id}:`) ? 0.6 : 1, ...(programAppearanceOn ? programLayout.label : {}) }}
                          disabled={pendingSessionAction?.startsWith(`${session.id}:`)}
                          {...a11y({ type: 'button', 'aria-label': `Spring resten over · ${sessionContext}` })}
                          onClick={e => { e.stopPropagation(); askConfirm('Spring de resterende sæt over? De markeres som ikke gennemført, så træningen lukkes.', () => skipRemainingSets(session)) }}
                        >{pendingSessionAction === `${session.id}:skip` ? '...' : 'Spring resten over'}</button>
                        <button
                          style={{ ...programTapTarget, ...programGhost, fontSize: '0.62rem', padding: '0.35rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)', opacity: pendingSessionAction?.startsWith(`${session.id}:`) ? 0.6 : 1, ...(programAppearanceOn ? programLayout.label : {}) }}
                          disabled={pendingSessionAction?.startsWith(`${session.id}:`)}
                          {...a11y({ type: 'button', 'aria-label': `Auto-udfyld · ${sessionContext}` })}
                          onClick={e => { e.stopPropagation(); askConfirm('Udfyld manglende sæt med sidst loggede vægt og reps? Brug kun hvis du faktisk lavede sættene.', () => autoCompleteSession(session)) }}
                        >{pendingSessionAction === `${session.id}:autofill` ? '...' : 'Auto-udfyld'}</button>
                      </>
                    )

                    return (
                      <div
                        key={session.id}
                        {...a11y({ tabIndex: -1, 'data-program-accessible': true })}
                        ref={el => { sessionRefs.current[session.id] = el }}
                        style={{ marginBottom: programAppearanceOn ? '1.25rem' : '0.75rem', scrollMarginTop: '64px', ...(programAppearanceOn ? { minWidth: 0, overflowWrap: 'anywhere' } : {}) }}
                      >
                        <div
                          style={{ ...s.card, marginBottom: 0, cursor: programAppearanceOn ? 'default' : 'pointer', borderLeft: isDone ? '3px solid #6cba6c' : isOpen ? '3px solid #c8923a' : '3px solid transparent', ...(programAppearanceOn ? { border: `1px solid ${sessionAccent}`, borderInlineStart: `4px solid ${sessionAccent}`, borderRadius: isOpen ? '12px 12px 0 0' : 12, padding: 16, background: isToday ? '#292216' : programColors.surface } : {}) }}
                          {...(!programAppearanceOn ? { onClick: () => openSession(isOpen ? null : session.id) } : {})}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...(programAppearanceOn ? { flexWrap: 'wrap', gap: 16 } : {}) }}>
                            <div {...(programAppearanceOn ? { style: { minWidth: 0, flex: '1 1 180px' } } : {})}>
                              <div style={{ ...s.cardLabel, marginBottom: '0.3rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {programAppearanceOn ? <h2 style={{ margin: 0, width: '100%', font: 'inherit', fontSize: '1.1rem', color: programColors.text, letterSpacing: 'normal', textTransform: 'none' }}>
                                  <button type="button" aria-expanded={isOpen} aria-controls={isOpen ? panelId : undefined}
                                    aria-label={sessionContext}
                                    onClick={() => openSession(isOpen ? null : session.id)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%', minHeight: 44, padding: 0, border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', overflowWrap: 'anywhere' }}>
                                    {session.title || 'Træningspas'} <span aria-hidden="true" style={{ fontSize: '0.65rem' }}>{isOpen ? '▲' : '▼'}</span>
                                  </button>
                                </h2> : session.title}
                                {isToday && <span style={programLayout.badge}>I dag</span>}
                                {session.weekday != null && WEEKDAYS_LONG[session.weekday] && (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.04em', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.1rem 0.35rem', ...(programAppearanceOn ? programLayout.label : {}) }}>{WEEKDAYS_LONG[session.weekday]}</span>
                                )}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: programAppearanceOn ? programColors.muted : '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em', ...(programAppearanceOn ? programLayout.label : {}) }}>
                                {exerciseViewGroups(session.exercises).length} {exerciseViewGroups(session.exercises).length === 1 ? 'øvelse' : 'øvelser'} · {loggedSets}/{totalSets} sæt logget{sessionLogs.filter(l => l.skipped).length > 0 ? ` · ${sessionLogs.filter(l => l.skipped).length} skippet` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {programAppearanceOn ? (
                                completion && <span style={{ ...programLayout.badge, color: completion === 'done' ? programColors.done : programColors.muted }}>
                                  {completion === 'done' ? 'Gennemført ✓' : 'Afsluttet · sæt sprunget over'}
                                </span>
                              ) : isDone && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6cba6c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Færdig ✓</span>}
                              {!programAppearanceOn && sessionActions}
                              {!programAppearanceOn && <span style={{ color: '#4a4844', fontSize: '0.65rem' }}>{isOpen ? '▲' : '▼'}</span>}
                            </div>
                          </div>
                          {programAppearanceOn && sessionActions && (
                            <details data-program-session-actions={session.id} style={{ marginTop: 8, minWidth: 0 }}>
                              <summary aria-label={`Flere handlinger for passet · ${sessionContext}`}
                                style={{ ...programTapTarget, ...programLayout.label, padding: '12px 0', color: programColors.muted, cursor: 'pointer' }}>
                                Flere handlinger for passet
                              </summary>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
                                {sessionActions}
                              </div>
                            </details>
                          )}
                        </div>

                        {preview && (
                          <div data-program-day-preview={session.id} style={{ ...s.card, marginTop: 0, borderTop: 'none' }}>
                            {preview.lines.length === 0 ? <div>Hviledag</div> : (
                              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                {preview.lines.map((line, index) => (
                                  <li key={index} title={line} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }}>{line}</li>
                                ))}
                              </ul>
                            )}
                            {preview.more > 0 && <div>+{preview.more} flere</div>}
                          </div>
                        )}

                        {isOpen && (
                          <div {...a11y({ id: panelId })} style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.07)', borderTop: 'none', padding: '1rem', ...(programAppearanceOn ? { borderColor: programColors.border, borderRadius: '0 0 12px 12px', minWidth: 0 } : {}) }}>


                            {!readOnly && opvarmStige === true && isCurrentWeek && !upcomingPreview && createElement(OpvarmStige, { enabled: true, exercises: session.exercises, scope: `${athlete?.id}|${viewedWeek.id}|${session.id}` })}
                            {exerciseViewRows(session.exercises).map(({ ex, name, label, startsGroup, endsGroup, showPrescription }, exIdx) => {
                              const exerciseContext = `${sessionContext}, ${name || 'Øvelse'}, øvelse ${exIdx + 1}`
                              const isLast = exIdx === session.exercises.length - 1
                              return (
                                <div key={ex.id} style={{ marginBottom: isLast ? 0 : '1.25rem', paddingBottom: isLast || !endsGroup ? 0 : '1.25rem', borderBottom: isLast || !endsGroup ? 'none' : '1px solid rgba(237,234,226,0.06)' }}>
                                  <div style={{ marginBottom: '0.6rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.1rem' }}>
                                      {startsGroup && (programAppearanceOn ? <h3 data-exercise-heading={name} style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: programColors.text }}>{name}</h3> : <div data-exercise-heading={name} style={{ fontSize: '1.05rem', color: '#edeae2' }}>{name}</div>)}
                                      {!readOnly && isCurrentWeek && (() => {
                                        const allSetsLogged = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1)
                                          .every(setNum => exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum))
                                        if (allSetsLogged) return null
                                        if (skipConfirmEx === ex.id) return (
                                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), letterSpacing: '0.06em' }}>Er du sikker?</span>
                                            <button
                                              style={{ ...programTapTarget, ...programGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.3)' }}
                                              {...a11y({ type: 'button', 'aria-label': `Ja, spring øvelsen over · ${exerciseContext}` })}
                                              onClick={() => { skipExercise(ex); setSkipConfirmEx(null) }}
                                            >Ja</button>
                                            <button
                                              style={{ ...programTapTarget, ...programGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }}
                                              {...a11y({ type: 'button', 'aria-label': `Annuller spring over · ${exerciseContext}` })}
                                              onClick={() => setSkipConfirmEx(null)}
                                            >Annuller</button>
                                          </div>
                                        )
                                        return (
                                          <button
                                            style={{ ...programTapTarget, ...programGhost, fontSize: '0.5rem', padding: '0.2rem 0.5rem', flexShrink: 0, color: (programAppearanceOn ? programColors.muted : '#4a4844'), borderColor: 'rgba(237,234,226,0.08)' }}
                                            {...a11y({ type: 'button', 'aria-label': `Spring ${label.toLowerCase()} over · ${exerciseContext}` })}
                                            onClick={() => setSkipConfirmEx(ex.id)}
                                          >Spring {label.toLowerCase()} over</button>
                                        )
                                      })()}
                                    </div>
                                    {isCurrentWeek && (
                                      <>
                                        {showPrescription && (ex.recommended_weight != null ? (
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                            Anbefalet: {ex.recommended_weight}kg
                                          </div>
                                        ) : (() => {
                                          const s = suggestNextWeight(ex.name, ex.intensity, ex.reps)
                                          if (!s) return null
                                          if (s.stop) return <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), marginBottom: '0.2rem' }}>{SMERTE_LINJE}</div>
                                          const diff = s.weight - s.baseWeight
                                          const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='
                                          return (
                                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                              Forslag: {s.weight} kg <span style={{ color: (programAppearanceOn ? programColors.muted : '#7a7770') }}>({diffStr} kg · RPE {s.fromRpe})</span>{s.basisDates && <small>Grundlag: {s.basisDates.join(', ')}</small>}
                                            </div>
                                          )
                                        })())}
                                        {(exerciseHistory[ex.name?.toLowerCase()] || []).map(({ date, sets }) => {
                                          const d = new Date(date + 'T12:00:00')
                                          const label = `${d.getDate()}/${d.getMonth() + 1}`
                                          const setsStr = sets.map(s => `${s.weight}×${s.reps}${s.rpe ? ` @${s.rpe}` : ''}`).join('  ')
                                          return (
                                            <div key={date} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), marginBottom: '0.1rem' }}>
                                              <span style={{ color: (programAppearanceOn ? programColors.muted : '#7a7770'), marginRight: '0.5rem' }}>{label}</span>{setsStr}
                                            </div>
                                          )
                                        })}
                                      </>
                                    )}
                                    {showPrescription && <div data-exercise-prescription style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1rem' }}>
                                      {programIntensityHelp === true ? <>
                                        {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`].filter(Boolean).join(' · ')}
                                        {ex.intensity && <>{(ex.sets || ex.reps) ? ' · ' : ''}<IntensityExplanation key={ex.intensity} intensity={ex.intensity} /></>}
                                      </> : [ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
                                    </div>}
                                    {ex.note && (
                                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), marginTop: '0.1rem', fontStyle: 'italic' }}>{ex.note}</div>
                                    )}
                                  </div>

                                  {/* Per-øvelse opvarmningssæt */}
                                  {!readOnly && isCurrentWeek && (() => {
                                    const baseW = ex.recommended_weight || lastLogByExerciseName[ex.name?.toLowerCase()]?.weight
                                    const exKey = ex.id
                                    const w = exWarmupWeightOverride[exKey] ?? baseW
                                    if (!w || w < 20) return null
                                    // eslint-disable-next-line no-unused-vars -- warmupOverrideTick tvinger genlæsning af storage efter en gemt rettelse
                                    const _tick = warmupOverrideTick
                                    const egneVægte = suggestWarmupOverride(athlete.id, ex.name, w)
                                    const usingOwn = !!egneVægte
                                    const sets = egneVægte || calcWarmupSets(w, ex.reps, ex.name)
                                    const isOpen = exWarmupExpanded.has(exKey)
                                    const exChecked = warmupChecked[exKey] || {}
                                    const doneCnt = Object.values(exChecked).filter(Boolean).length
                                    const isEditingWeight = exWarmupWeightEditing === exKey
                                    const korrigerSæt = (index, correction) => {
                                      const næste = applyWarmupCorrection(sets, index, correction)
                                      saveWarmupOverride(athlete.id, ex.name, w, næste)
                                      setWarmupSetEditing(null)
                                      setWarmupOverrideTick(t => t + 1)
                                    }
                                    return (
                                      <div style={{ marginBottom: '0.75rem', border: '1px solid rgba(237,234,226,0.07)', borderLeft: '2px solid rgba(200,146,58,0.3)' }}>
                                        <div
                                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', cursor: 'pointer' }}
                                          onClick={() => setExWarmupExpanded(prev => {
                                            const next = new Set(prev)
                                            next.has(exKey) ? next.delete(exKey) : next.add(exKey)
                                            return next
                                          })}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: (programAppearanceOn ? programColors.muted : '#7a7770') }}>Opvarmningssæt</span>
                                            {isEditingWeight ? (
                                              <input
                                                {...a11y({ 'aria-label': `Arbejdsvægt til opvarmning · ${exerciseContext}` })}
                                                autoFocus
                                                type="number"
                                                defaultValue={w}
                                                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', width: '52px', background: 'rgba(200,146,58,0.1)', border: '1px solid rgba(200,146,58,0.5)', color: '#c8923a', padding: '0 4px', textAlign: 'center' }}
                                                onClick={e => e.stopPropagation()}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    const val = parseInputNumber(e.target.value)
                                                    if (val >= 20) setExWarmupWeightOverride(prev => ({ ...prev, [exKey]: val }))
                                                    setExWarmupWeightEditing(null)
                                                  }
                                                  if (e.key === 'Escape') setExWarmupWeightEditing(null)
                                                }}
                                                onBlur={e => {
                                                  const val = parseInputNumber(e.target.value)
                                                  if (val >= 20) setExWarmupWeightOverride(prev => ({ ...prev, [exKey]: val }))
                                                  setExWarmupWeightEditing(null)
                                                }}
                                              />
                                            ) : (
                                              <span
                                                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: exWarmupWeightOverride[exKey] ? '#c8923a' : (programAppearanceOn ? programColors.muted : '#7a7770'), textDecoration: 'underline dotted', cursor: 'text' }}
                                                onClick={e => { e.stopPropagation(); setExWarmupWeightEditing(exKey) }}
                                              >{w}kg</span>
                                            )}
                                            {doneCnt > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#6cba6c' }}>{doneCnt}/{sets.length}</span>}
                                            {usingOwn && <span title="Genbruger dine egne vægte fra sidste gang (samme øvelse, arbejdsvægt inden for 5%)" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', letterSpacing: '0.06em', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.05rem 0.3rem' }}>{vaerdF6 === true ? 'Din lokale rettelse af opvarmningen' : 'dine sidste'}</span>}
                                          </div>
                                          <span style={{ color: (programAppearanceOn ? programColors.muted : '#4a4844'), fontSize: '0.55rem' }}>{isOpen ? '▲' : '▼'}</span>
                                        </div>
                                        {isOpen && (
                                          <div style={{ padding: '0 0.75rem 0.6rem' }}>
                                            {sets.map((ws, i) => {
                                              const k = `ws_${i}`
                                              const done = exChecked[k]
                                              const editKey = `${exKey}_${i}`
                                              const isEditingSet = warmupSetEditing === editKey
                                              return (
                                                <div
                                                  key={i}
                                                  style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', cursor: 'pointer' }}
                                                  onClick={() => setWarmupChecked(prev => ({
                                                    ...prev,
                                                    [exKey]: { ...(prev[exKey] || {}), [k]: !done }
                                                  }))}
                                                >
                                                  <div style={{ width: '14px', height: '14px', border: `1px solid ${done ? '#6cba6c' : 'rgba(237,234,226,0.2)'}`, background: done ? 'rgba(108,186,108,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {done && <span style={{ color: '#6cba6c', fontSize: '0.55rem', lineHeight: 1 }}>✓</span>}
                                                  </div>
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: done ? (programAppearanceOn ? programColors.muted : '#4a4844') : '#c8923a', minWidth: '28px' }}>{ws.pct}</span>
                                                  {isEditingSet ? (
                                                    <input
                                                      {...a11y({ 'aria-label': `Opvarmningsvægt, sæt ${i + 1} · ${exerciseContext}` })}
                                                      autoFocus
                                                      type="number"
                                                      defaultValue={ws.weight}
                                                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', width: '56px', background: 'rgba(200,146,58,0.1)', border: '1px solid rgba(200,146,58,0.5)', color: '#c8923a', padding: '0.1rem 0.2rem', textAlign: 'center' }}
                                                      onClick={e => e.stopPropagation()}
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter') korrigerSæt(i, { weight: e.target.value })
                                                        if (e.key === 'Escape') setWarmupSetEditing(null)
                                                      }}
                                                      onBlur={e => korrigerSæt(i, { weight: e.target.value })}
                                                    />
                                                  ) : (
                                                    <span
                                                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem', color: done ? (programAppearanceOn ? programColors.muted : '#4a4844') : '#edeae2', textDecoration: done ? 'line-through' : 'underline dotted', cursor: 'text' }}
                                                      onClick={e => { e.stopPropagation(); setWarmupSetEditing(editKey) }}
                                                    >{ws.weight}kg</span>
                                                  )}
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: (programAppearanceOn ? programColors.muted : '#7a7770') }}>× {ws.reps}</span>
                                                  <button
                                                    {...a11y({ type: 'button', 'aria-label': `Spring opvarmningssæt ${i + 1} over · ${exerciseContext}` })}
                                                    title="Spring dette opvarmningssæt over"
                                                    onClick={e => { e.stopPropagation(); korrigerSæt(i, { skipped: true }) }}
                                                    style={{ ...programTapTarget, marginLeft: 'auto', background: 'none', border: 'none', color: (programAppearanceOn ? programColors.muted : '#4a4844'), cursor: 'pointer', fontSize: '0.6rem', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box' }}
                                                  >✕</button>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}

                                  {/* Stopur for tids-øvelser (fx planke) — samme som ved mobilitet */}
                                  {!readOnly && isCurrentWeek && (() => {
                                    const dur = parseDuration(ex.reps, ex.intensity)
                                    if (!dur) return null
                                    return <ExerciseTimer key={`tmr_${ex.id}`} duration={dur.seconds} label={dur.text} {...a11y({ accessible: true, context: exerciseContext })} entropi2={programAppearanceOn} />
                                  })()}

                                  {Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).map(setNum => {
                                    const key = `${ex.id}_${setNum}`
                                    const logged = logsForView.find(l => l.exercise_id === ex.id && l.set_number === setNum)

                                    if (readOnly || !isCurrentWeek) {
                                      return (
                                        <div key={setNum} style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '80px', flexShrink: 0, whiteSpace: 'nowrap' }}>{label} {setNum}</div>
                                          {logged?.skipped ? (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: (programAppearanceOn ? programColors.muted : '#4a4844') }}>✕ Sprunget over</span>
                                          ) : logged ? (
                                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{logged.weight}kg × {logged.reps_completed}</span>
                                              {logged.rpe_actual != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: (programAppearanceOn ? programColors.muted : '#7a7770') }}>RPE {logged.rpe_actual}</span>}
                                              {logged.note && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), fontStyle: 'italic' }}>{visibleRpeNote(logged.note)}</span>}
                                            </div>
                                          ) : (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: (programAppearanceOn ? programColors.muted : '#4a4844') }}>—</span>
                                          )}
                                        </div>
                                      )
                                    }

                                    const setContext = `${exerciseContext}, ${label.toLowerCase()} ${setNum}`
                                    const input = logInputs[key] || { weight: '', note: '', rpe: '', reps: '' }
                                    const plannedRpe = parsePlannedRpe(ex.intensity)
                                    // Numeric, range and free prescriptions log actual reps per set.
                                    // Text prescriptions retain their existing display.
                                    const repsPrescription = parseRepsPrescription(ex.reps)
                                    const repsIsEditable = repsPrescription.type !== 'fixed' || fixedRepsEntry(ex.reps) !== null
                                    const repsDefault = fixedRepsEntry(ex.reps) ?? (repsPrescription.type === 'range' ? String(repsPrescription.min) : '')
                                    const repsValue = input.reps || repsDefault
                                    const repsToLog = repsIsEditable ? repsValue : ex.reps

                                    if (logged?.skipped) return (
                                      <div key={setNum} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '80px', flexShrink: 0, whiteSpace: 'nowrap' }}>{label} {setNum}</div>
                                        <span style={{ color: (programAppearanceOn ? programColors.muted : '#4a4844'), fontSize: '1rem' }}>✕</span>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sprunget over</span>
                                        <button
                                          style={{ ...programTapTarget, ...programGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', color: (programAppearanceOn ? programColors.muted : '#7a7770') }}
                                          {...a11y({ type: 'button', 'aria-label': `Fortryd spring over · ${setContext}` })}
                                          onClick={() => unskipSet(ex.id, setNum)}
                                        >Fortryd</button>
                                      </div>
                                    )

                                    return (
                                      <div key={setNum} style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '80px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            {label} {setNum}
                                          </div>
                                          <input
                                            aria-label={programAppearanceOn ? `Vægt · ${setContext}` : `Vægt, sæt ${setNum}`}
                                            style={{ ...s.fieldInput, width: '80px', minWidth: '80px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0, padding: '0.65rem 0.5rem', fontSize: '1.1rem', textAlign: 'center' }}
                                            type="text" inputMode="decimal" placeholder="kg" value={input.weight}
                                            onChange={e => {
                                              // type=text + inputMode=decimal: numerisk tastatur, men fuld
                                              // kontrol — så feltet kan ryddes helt og "0" kan skrives.
                                              // Dansk komma → punktum; kun cifre + ét decimaltegn.
                                              const v = e.target.value.replace(',', '.')
                                              if (v === '' || /^\d*\.?\d*$/.test(v)) {
                                                setLogInputs(p => ({ ...p, [key]: { ...p[key], weight: v } }))
                                              }
                                            }}
                                          />
                                          {repsIsEditable ? (
                                            <>
                                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.88rem', color: '#c8923a' }}>×</span>
                                              <input
                                                aria-label={programAppearanceOn ? `Reps · ${setContext}` : `Reps, sæt ${setNum}`}
                                                style={{ ...s.fieldInput, width: '52px', minWidth: '52px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0, padding: '0.65rem 0.3rem', fontSize: '1.1rem', textAlign: 'center' }}
                                                type="text" inputMode="numeric" placeholder="reps" value={repsValue}
                                                onChange={e => {
                                                  const v = e.target.value
                                                  if (v === '' || /^\d*$/.test(v)) {
                                                    setLogInputs(p => ({ ...p, [key]: { ...p[key], reps: v } }))
                                                  }
                                                }}
                                              />
                                            </>
                                          ) : (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.88rem', color: '#c8923a', whiteSpace: 'nowrap' }}>× {ex.reps || '—'}</span>
                                          )}
                                          {/* Log/Spring over rammes efter hvert eneste sæt, hele træningen igennem —
                                              den mest gentagne tryk-handling i appen. min-height 44px holder dem
                                              inden for anbefalet tommelfinger-trykflade, også med svedige hænder. */}
                                          <button
                                            style={{ ...programTapTarget, ...s.btnPrimary, minHeight: '44px', boxSizing: 'border-box', padding: '0.65rem 1rem', fontSize: '0.65rem', background: logged ? '#6cba6c' : '#c8923a' }}
                                            {...a11y({ type: 'button', 'aria-label': `${logged ? 'Gemt ✓, opdatér sæt' : 'Log sæt'} · ${setContext}` })}
                                            onClick={() => logSet(ex.id, setNum, ex.sets, repsToLog, plannedRpe)}
                                          >{logged ? (programAppearanceOn ? 'Gemt ✓' : '✓') : 'Log'}</button>
                                          <button
                                            style={{ ...programTapTarget, ...programGhost, minHeight: '44px', boxSizing: 'border-box', padding: '0.65rem 0.75rem', fontSize: '0.55rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), borderColor: 'rgba(237,234,226,0.08)' }}
                                            {...a11y({ type: 'button', 'aria-label': `Spring over · ${setContext}` })}
                                            onClick={() => skipSet(ex.id, setNum, plannedRpe)}
                                          >Spring over</button>
                                        </div>
                                        <div style={{ paddingLeft: 'calc(80px + 0.5rem)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <div style={{ position: 'relative' }}>
                                            <button
                                              {...a11y({ type: 'button', 'aria-label': `Vælg RPE ${input.rpe || (plannedRpe != null ? plannedRpe : '–')} · ${setContext}`, 'aria-expanded': openRpePicker === key })}
                                              onClick={() => setOpenRpePicker(openRpePicker === key ? null : key)}
                                              style={{ ...programTapTarget,
                                                background: input.rpe ? 'rgba(200,146,58,0.15)' : 'rgba(237,234,226,0.04)',
                                                border: `1px solid ${input.rpe ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.13)'}`,
                                                color: input.rpe ? '#c8923a' : (programAppearanceOn ? programColors.muted : '#7a7770'),
                                                fontFamily: "'IBM Plex Mono', monospace",
                                                fontSize: '0.6rem',
                                                letterSpacing: '0.08em',
                                                padding: '0.3rem 0.6rem',
                                                minHeight: '44px',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >RPE {input.rpe || (plannedRpe != null ? plannedRpe : '–')}</button>
                                            {openRpePicker === key && (
                                              <div
                                                ref={node => { if (node) { const sel = node.querySelector('[data-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'instant' }) } }}
                                                style={{
                                                  position: 'absolute',
                                                  bottom: '100%',
                                                  left: 0,
                                                  background: '#1c1c18',
                                                  border: '1px solid rgba(237,234,226,0.13)',
                                                  zIndex: 200,
                                                  maxHeight: '200px',
                                                  overflowY: 'auto',
                                                  minWidth: '80px',
                                                  marginBottom: '2px',
                                                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                                }}
                                              >
                                                {RPE_VALUES.map(v => {
                                                  const cur = parseInputNumber(input.rpe !== '' ? input.rpe : plannedRpe)
                                                  const isSelected = cur === v
                                                  return (
                                                    <button
                                                      key={v}
                                                      {...a11y({ type: 'button', 'aria-label': `RPE ${v} · ${setContext}`, 'aria-pressed': isSelected })}
                                                      data-selected={isSelected ? 'true' : 'false'}
                                                      onClick={() => {
                                                        setLogInputs(p => chooseRpeInput(p, key, v))
                                                        setOpenRpePicker(null)
                                                      }}
                                                      style={{ ...programTapTarget,
                                                        display: 'block',
                                                        width: '100%',
                                                        background: isSelected ? 'rgba(200,146,58,0.15)' : 'transparent',
                                                        color: isSelected ? '#c8923a' : '#edeae2',
                                                        border: 'none',
                                                        borderBottom: '1px solid rgba(237,234,226,0.07)',
                                                        fontFamily: "'IBM Plex Mono', monospace",
                                                        fontSize: '0.72rem',
                                                        padding: '0.5rem 0.75rem',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        letterSpacing: '0.04em',
                                                      }}
                                                    >{programAppearanceOn && isSelected ? `${v} ✓` : v}</button>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            {...a11y({ type: 'button', 'aria-label': `Hvad er RPE? · ${setContext}` })}
                                            onClick={() => setShowRpeGuide(true)}
                                            title="Hvad er RPE? Din egen vurdering af, hvor hårdt et sæt føltes. Det er subjektivt og afhænger af dig og dagsformen, så to personer kan give samme sæt forskellige tal. Tallet svarer til gentagelser i reserve: 10 betyder ingen tilbage, 9 én, 8 to, og så videre. Vurderingen kan ramme ved siden af, og i gennemsnit har man omkring én gentagelse mere tilbage, end man tror. Den bliver mere præcis, jo tættere på grænsen sættet er. Kilderne er uenige om erfaring: én finder, at øvede vurderer bedre, andre finder ingen forskel. Er du ny, så øv dig i at notere tallet, men lad det ikke stå alene."
                                            style={{ ...programTapTarget, background: 'none', border: 'none', color: (programAppearanceOn ? programColors.muted : '#4a4844'), cursor: 'pointer', fontSize: '0.75rem', padding: '0.3rem 0.2rem', lineHeight: 1, flexShrink: 0 }}
                                          >ℹ</button>
                                          <input
                                            style={{ ...s.fieldInput, flex: 1, fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: (programAppearanceOn ? programColors.muted : '#7a7770'), fontStyle: 'italic' }}
                                            {...a11y({ 'aria-label': `Note · ${setContext}` })}
                                            type="text" placeholder="Tilføj note..." value={input.note}
                                            onChange={e => setLogInputs(p => ({ ...p, [key]: { ...p[key], note: e.target.value } }))}
                                          />
                                        </div>
                                        {(programAppearanceOn || setConfirm[key]) && (
                                          <div {...a11y({ role: 'status', 'aria-atomic': true })} style={{
                                            paddingLeft: 'calc(80px + 0.5rem)',
                                            fontFamily: "'IBM Plex Mono', monospace",
                                            fontSize: '0.52rem',
                                            letterSpacing: '0.08em',
                                            color: setConfirm[key] === 'error' ? '#e05555' : '#6cba6c',
                                            marginTop: '0.2rem',
                                            opacity: setConfirm[key] === 'fading' ? 0 : 1,
                                            transition: 'opacity 0.3s ease',
                                          }}>
                                            {programAppearanceOn && setConfirm[key] ? `${setContext}: ` : null}
                                            {setConfirm[key] ? (setConfirm[key] === 'error' ? 'Ikke gemt. Prøv igen' : 'Gemt ✓') : null}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                            {(session.exercises || []).length === 0 && (
                              <div style={{ fontSize: '0.85rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), fontStyle: 'italic' }}>Ingen øvelser i denne træning endnu.</div>
                            )}
                            {programAppearanceOn && !readOnly && isDone && isCurrentWeek && !!session.athlete_rating && (
                              <div role="status" style={{ color: programColors.done, marginTop: '1rem' }}>
                                Træningsfeedback gemt · {sessionContext}: {session.athlete_rating} af 5
                              </div>
                            )}
                            {!readOnly && isDone && isCurrentWeek && !session.athlete_rating && !dismissedFeedback.has(session.id) && (
                              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.15)' }}>
                                <div style={{ ...s.cardLabel, marginBottom: '0.75rem' }}>Træningsfeedback</div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div style={s.fieldLabel}>Hvordan gik træningen?</div>
                                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                    {[1, 2, 3, 4, 5].map(n => {
                                      const fi = feedbackInputs[session.id] || {}
                                      return (
                                        <button key={n}
                                          {...a11y({ type: 'button', 'aria-label': `Vurder træningen ${n} af 5 · ${sessionContext}`, 'aria-pressed': fi.rating === n })}
                                          onClick={() => setFeedbackInputs(p => ({ ...p, [session.id]: { ...(p[session.id] || {}), rating: n } }))}
                                          // G13: 40×40px, lige under 44px — samme metode som F13-F16 (ordre 68).
                                          style={{ ...programTapTarget, width: '44px', height: '44px', boxSizing: 'border-box', border: fi.rating === n ? '2px solid #c8923a' : '1px solid rgba(237,234,226,0.13)', background: fi.rating === n ? 'rgba(200,146,58,0.15)' : 'transparent', color: fi.rating === n ? '#c8923a' : (programAppearanceOn ? programColors.muted : '#7a7770'), fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.95rem', cursor: 'pointer' }}
                                        >{programAppearanceOn && fi.rating === n ? `${n} ✓` : n}</button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <textarea
                                  style={{ ...s.fieldInput, minHeight: '60px', resize: 'vertical', fontSize: '0.82rem', lineHeight: 1.6, boxSizing: 'border-box' }}
                                  {...a11y({ 'aria-label': `Kommentar til træningsfeedback · ${sessionContext}` })}
                                  placeholder="Tilføj en kommentar..."
                                  maxLength={200}
                                  value={(feedbackInputs[session.id] || {}).comment || ''}
                                  onChange={e => setFeedbackInputs(p => ({ ...p, [session.id]: { ...(p[session.id] || {}), comment: e.target.value } }))}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                  <button {...a11y({ type: 'button', 'aria-label': `Spring træningsfeedback over · ${sessionContext}` })} style={{ ...programTapTarget, ...programGhost }} onClick={() => setDismissedFeedback(p => new Set([...p, session.id]))}>Spring over</button>
                                  <button
                                    style={{ ...programTapTarget, ...s.btnPrimary, opacity: !(feedbackInputs[session.id]?.rating) || pendingSessionAction === `${session.id}:feedback` ? 0.4 : 1 }}
                                    {...a11y({ type: 'button', 'aria-label': `Gem feedback · ${sessionContext}` })}
                                    onClick={() => saveFeedback(session.id)}
                                    disabled={!feedbackInputs[session.id]?.rating || pendingSessionAction === `${session.id}:feedback`}
                                  >{pendingSessionAction === `${session.id}:feedback` ? 'Gemmer...' : 'Gem feedback'}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {(viewedWeek.sessions || []).length === 0 && (
                    <div style={s.card}>
                      <div style={{ fontSize: '0.85rem', color: (programAppearanceOn ? programColors.muted : '#4a4844'), fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                    </div>
                  )}
                  {ugeFoerst && (
                    <details key={viewedWeek.id} style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                      <summary style={{ cursor: 'pointer', minHeight: '44px', padding: '0.75rem', boxSizing: 'border-box', color: '#edeae2' }}>
                        Blokinfo: {viewedWeek.block_name || 'Dit program'}
                      </summary>
                      {blokOversigt}
                      {blokTekst}
                    </details>
                  )}
                </>
              )}
              {programAppearanceOn && <style>{programFocusCss}</style>}
            </>
          )
          // A layout-neutral scope for motion preferences, only in Entropi 2.
          return programAppearanceOn ? createElement('div', {
            'data-entropi2-program-motion': '', style: { display: 'contents' },
          }, programContent) : programContent
}

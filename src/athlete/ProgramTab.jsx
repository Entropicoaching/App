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
import { remainingSeconds } from '../restTimer'
import { parseRepsPrescription } from '../repsPrescription'
import CountdownRing from './CountdownRing'
import { s } from '../athleteShared'

const RPE_VALUES = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

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
function ExerciseTimer({ duration, label }) {
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
      {label && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>{label}</div>}
      {!done ? (
        <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => {
          if (active) { setRemaining(seconds); setActive(false) } else setActive(true)
        }}>
          {active ? '⏸ Pause' : (seconds > 0 && seconds < duration) ? '▶ Fortsæt' : '▶ Start timer'}
        </button>
      ) : (
        <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { setRemaining(duration); setDone(false); setActive(false) }}>↺ Gentag</button>
      )}
    </div>
  )
}

export default function ProgramTab({
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
}) {
          // Følg den aktive uge der blev ankret i fetchProgram (kan være rykket
          // frem til næste uge når den aktuelle er fuldt logget). Fald tilbage til
          // den rene dato-beregning hvis ankeret ikke findes.
          const anchoredIdx = allWeeks.findIndex(w => w.id === currentWeek?.id)
          const activeWeekIdx = anchoredIdx >= 0 ? anchoredIdx : computeActiveWeekIdx(allWeeks)
          const viewedWeek = allWeeks[viewingWeekIdx] || null
          const viewedRange = viewedWeek ? fmtWeekRange(weekStartDate(allWeeks, viewedWeek.week_number)) : null
          const isCurrentWeek = viewingWeekIdx === activeWeekIdx
          const isFutureWeek = viewingWeekIdx > activeWeekIdx
          const logsForView = isCurrentWeek ? exerciseLogs : pastLogs

          return (
            <>
              {allWeeks.length === 0 ? (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Program</div>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Dit program.</h1>
                  </div>
                  {programError ? (
                    // G1: en fejlet hentning må aldrig ligne "du har intet program" —
                    // ærlig fejllinje + en vej til at prøve igen, ikke stilhed.
                    <div style={{ ...s.card, textAlign: 'center', padding: '3rem 1.5rem' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.75rem' }}>Dit program kunne ikke hentes.</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', letterSpacing: '0.08em', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                        Tjek din forbindelse og prøv igen.
                      </div>
                      <button style={s.btnGhost} onClick={() => fetchProgram(athlete.id)}>Prøv igen</button>
                    </div>
                  ) : (
                    <div style={{ ...s.card, textAlign: 'center', padding: '3rem 1.5rem' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#c8923a', marginBottom: '1rem', letterSpacing: '0.02em' }}>Entropi.</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.75rem' }}>Dit program er på vej.</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', letterSpacing: '0.08em', lineHeight: 1.7 }}>
                        Din coach sætter det op inden din næste træning.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Readiness → træning: ærlig autoregulerings-cue ud fra dagens parathed
                      (kun aktuel uge; readinessLog er allerede i state). */}
                  {isCurrentWeek && readinessLog && readinessLog.readiness_score != null && readinessLog.readiness_score < 75 && (() => {
                    const sc = readinessLog.readiness_score
                    const low = sc < 50
                    return (
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.85rem 1rem', marginBottom: '1.25rem', background: low ? 'rgba(224,85,85,0.07)' : 'rgba(200,146,58,0.07)', border: `1px solid ${low ? 'rgba(224,85,85,0.25)' : 'rgba(200,146,58,0.2)'}` }}>
                        <span style={{ color: low ? '#e05555' : '#c8923a', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{low ? '⚠' : '◐'}</span>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: low ? '#e05555' : '#c8923a', marginBottom: '0.3rem' }}>Parathed {sc}/100 i dag</div>
                          <div style={{ fontSize: '0.82rem', color: '#b8b4a8', lineHeight: 1.6 }}>
                            {low
                              ? 'Lav parathed. Overvej at skrue intensiteten ned, droppe de sidste sæt, eller tage en let session — og skriv til din coach hvis det varer ved.'
                              : 'Moderat parathed. Kør planen, men lyt til kroppen og pres ikke topsæt hvis det føles tungt.'}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  {isCurrentWeek && !readinessLog && (
                    <button type="button" onClick={openReadiness} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.7rem 1rem', marginBottom: '1.25rem', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.13)', cursor: 'pointer' }}>
                      <span style={{ color: '#c8923a', fontSize: '0.9rem', flexShrink: 0 }}>◐</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.06em', lineHeight: 1.5 }}>Log dagens parathed for en tilpasset anbefaling →</span>
                    </button>
                  )}

                  {/* Periodisering — uge-stepper */}
                  {allWeeks.length > 0 && (() => {
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
                    const color = phase.name ? blockColor(phase.name) : '#7a7770'

                    const fmt = ds => new Date(ds + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                    const firstDate = phase.weeks[0]?.start_date
                    const lastStart = phase.weeks[phase.weeks.length - 1]?.start_date
                    const dateRange = firstDate && lastStart
                      ? `${fmt(firstDate)} – ${fmt(new Date(new Date(lastStart + 'T12:00:00').getTime() + 6 * 86400000).toISOString().slice(0, 10))}`
                      : null

                    const goToWeek = (gi) => {
                      setViewingWeekIdx(gi)
                      setProgOpenSession(null)
                      if (gi < activeWeekIdx) fetchPastLogs(allWeeks[gi], athlete.id)
                      else setPastLogs([])
                    }

                    const prevPhase = viewedPhaseIdx > 0 ? phases[viewedPhaseIdx - 1] : null
                    const nextPhase = viewedPhaseIdx < phases.length - 1 ? phases[viewedPhaseIdx + 1] : null

                    const chipStyle = {
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em',
                      color: '#7a7770', whiteSpace: 'nowrap', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis',
                      // G9: kun 17px høj med nul vandret padding — samme mønster/metode som F13-F16
                      // (ordre 68): minHeight + boxSizing, bredden på tekstknappen bevares.
                      minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center',
                    }

                    return (
                      <div style={{ marginBottom: '1.5rem' }}>
                        {weeksToComp != null && weeksToComp > 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#c8923a', letterSpacing: '0.1em', marginBottom: '0.7rem' }}>
                            🏆 {weeksToComp} uger til stævne
                          </div>
                        )}
                        {weeksToComp != null && weeksToComp <= 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.7rem' }}>
                            🏆 Stævne passeret
                          </div>
                        )}

                        {/* Blok-skift */}
                        {(prevPhase || nextPhase) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            {prevPhase
                              ? <button style={chipStyle} onClick={() => goToWeek(phaseStart[viewedPhaseIdx - 1])}>‹ {prevPhase.name || 'Tidligere'}</button>
                              : <span />}
                            {nextPhase
                              ? <button style={{ ...chipStyle, textAlign: 'right', justifyContent: 'flex-end' }} onClick={() => goToWeek(phaseStart[viewedPhaseIdx + 1])}>{nextPhase.name || 'Næste blok'} ›</button>
                              : <span />}
                          </div>
                        )}

                        {/* Blok-header */}
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {phase.name || 'Ingen blok'}
                            </span>
                          </div>
                          {dateRange && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{dateRange}</span>
                          )}
                        </div>

                        {/* Uge-prikker */}
                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
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
                        </div>

                        {/* Caption */}
                        <div style={{ marginTop: '0.9rem', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {/* Brug det faktiske week_number, så caption og blok-overskrift
                              aldrig modsiger hinanden (fx uge 0 der før stod som "uge 1 af 1"). */}
                          {viewingWeekIdx === activeWeekIdx
                            ? <span style={{ color }}>● Du er her · uge {viewedWeek?.week_number}</span>
                            : viewingWeekIdx > activeWeekIdx
                              ? <span style={{ color: '#7a7770' }}>Planlagt · uge {viewedWeek?.week_number}</span>
                              : <span style={{ color: '#7a7770' }}>Historisk · uge {viewedWeek?.week_number}</span>}
                          {viewedRange && <span style={{ color: '#4a4844' }}> · {viewedRange}</span>}
                          <span style={{ color: '#4a4844' }}> · total {activeWeekIdx + 1}/{totalWeeks}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Week header — navigation only shown when multiple weeks exist */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    {allWeeks.length > 1 ? (
                      <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: viewingWeekIdx === 0 ? 0.25 : 1 }}
                          disabled={viewingWeekIdx === 0}
                          onClick={() => {
                            const ni = viewingWeekIdx - 1
                            setViewingWeekIdx(ni)
                            setProgOpenSession(null)
                            fetchPastLogs(allWeeks[ni], athlete.id)
                          }}
                        >← Forrige uge</button>
                        <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>
                            Uge {viewedWeek.week_number}{viewedRange ? ` · ${viewedRange}` : ''}
                            {isFutureWeek && <span style={{ color: '#4a4844', marginLeft: '0.5em' }}>· planlagt</span>}
                            {!isCurrentWeek && !isFutureWeek && <span style={{ color: '#4a4844', marginLeft: '0.5em' }}>· historisk</span>}
                          </div>
                          {viewedWeek.block_name && (
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2', marginTop: '0.1rem' }}>{viewedWeek.block_name}</div>
                          )}
                        </div>
                        <button
                          style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: viewingWeekIdx >= allWeeks.length - 1 ? 0.25 : 1 }}
                          disabled={viewingWeekIdx >= allWeeks.length - 1}
                          onClick={() => {
                            const ni = viewingWeekIdx + 1
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
                            style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)' }}
                            onClick={() => {
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
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>
                          Uge {viewedWeek.week_number}
                        </div>
                        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                          {viewedWeek.block_name || 'Dit program'}.
                        </h1>
                      </div>
                    )}
                  </div>

                  {viewedWeek.coach_note && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#7a7770', marginBottom: '1rem', letterSpacing: '0.04em' }}>
                      {viewedWeek.coach_note}
                    </div>
                  )}

                  {viewedWeek.block_description && (
                    <div style={{ borderLeft: '2px solid rgba(200,146,58,0.3)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.3rem' }}>Fra din coach</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300, color: '#7a7770', fontStyle: 'italic', lineHeight: 1.6 }}>{viewedWeek.block_description}</div>
                    </div>
                  )}

                  {(viewedWeek.sessions || []).map(session => {
                    const isOpen = progOpenSession === session.id
                    const sessionExIds = (session.exercises || []).map(e => e.id)
                    const sessionLogs = logsForView.filter(l => sessionExIds.includes(l.exercise_id))
                    const totalSets = (session.exercises || []).reduce((acc, e) => acc + (e.sets || 0), 0)
                    const loggedSets = sessionLogs.filter(l => !l.skipped).length
                    const isDone = totalSets > 0 && sessionLogs.length >= totalSets

                    return (
                      <div
                        key={session.id}
                        ref={el => { sessionRefs.current[session.id] = el }}
                        style={{ marginBottom: '0.75rem', scrollMarginTop: '64px' }}
                      >
                        <div
                          style={{ ...s.card, marginBottom: 0, cursor: 'pointer', borderLeft: isDone ? '3px solid #6cba6c' : isOpen ? '3px solid #c8923a' : '3px solid transparent' }}
                          onClick={() => openSession(isOpen ? null : session.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ ...s.cardLabel, marginBottom: '0.3rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {session.title}
                                {session.weekday != null && WEEKDAYS_LONG[session.weekday] && (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.04em', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.1rem 0.35rem' }}>{WEEKDAYS_LONG[session.weekday]}</span>
                                )}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {(session.exercises || []).length} øvelser · {loggedSets}/{totalSets} sæt logget{sessionLogs.filter(l => l.skipped).length > 0 ? ` · ${sessionLogs.filter(l => l.skipped).length} skippet` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {isDone && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6cba6c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Færdig ✓</span>}
                              {!isDone && totalSets > 0 && (
                                <>
                                  <button
                                    style={{ ...s.btnGhost, fontSize: '0.62rem', padding: '0.35rem 0.7rem', color: '#7a7770', borderColor: 'rgba(237,234,226,0.18)', opacity: pendingSessionAction?.startsWith(`${session.id}:`) ? 0.6 : 1 }}
                                    disabled={pendingSessionAction?.startsWith(`${session.id}:`)}
                                    onClick={e => { e.stopPropagation(); askConfirm('Spring de resterende sæt over? De markeres som ikke gennemført, så træningen lukkes.', () => skipRemainingSets(session)) }}
                                  >{pendingSessionAction === `${session.id}:skip` ? '...' : 'Spring resten over'}</button>
                                  <button
                                    style={{ ...s.btnGhost, fontSize: '0.62rem', padding: '0.35rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)', opacity: pendingSessionAction?.startsWith(`${session.id}:`) ? 0.6 : 1 }}
                                    disabled={pendingSessionAction?.startsWith(`${session.id}:`)}
                                    onClick={e => { e.stopPropagation(); askConfirm('Udfyld manglende sæt med sidst loggede vægt og reps? Brug kun hvis du faktisk lavede sættene.', () => autoCompleteSession(session)) }}
                                  >{pendingSessionAction === `${session.id}:autofill` ? '...' : 'Auto-udfyld'}</button>
                                </>
                              )}
                              <span style={{ color: '#4a4844', fontSize: '0.65rem' }}>{isOpen ? '▲' : '▼'}</span>
                            </div>
                          </div>
                        </div>

                        {isOpen && (
                          <div style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.07)', borderTop: 'none', padding: '1rem' }}>


                            {(session.exercises || []).map((ex, exIdx) => {
                              const isLast = exIdx === session.exercises.length - 1
                              return (
                                <div key={ex.id} style={{ marginBottom: isLast ? 0 : '1.25rem', paddingBottom: isLast ? 0 : '1.25rem', borderBottom: isLast ? 'none' : '1px solid rgba(237,234,226,0.06)' }}>
                                  <div style={{ marginBottom: '0.6rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.1rem' }}>
                                      <div style={{ fontSize: '1.05rem', color: '#edeae2' }}>{ex.name}</div>
                                      {isCurrentWeek && (() => {
                                        const allSetsLogged = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1)
                                          .every(setNum => exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum))
                                        if (allSetsLogged) return null
                                        if (skipConfirmEx === ex.id) return (
                                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', letterSpacing: '0.06em' }}>Er du sikker?</span>
                                            <button
                                              style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.3)' }}
                                              onClick={() => { skipExercise(ex); setSkipConfirmEx(null) }}
                                            >Ja</button>
                                            <button
                                              style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }}
                                              onClick={() => setSkipConfirmEx(null)}
                                            >Annuller</button>
                                          </div>
                                        )
                                        return (
                                          <button
                                            style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.2rem 0.5rem', flexShrink: 0, color: '#4a4844', borderColor: 'rgba(237,234,226,0.08)' }}
                                            onClick={() => setSkipConfirmEx(ex.id)}
                                          >Spring øvelse over</button>
                                        )
                                      })()}
                                    </div>
                                    {isCurrentWeek && (
                                      <>
                                        {ex.recommended_weight != null ? (
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                            Anbefalet: {ex.recommended_weight}kg
                                          </div>
                                        ) : (() => {
                                          const s = suggestNextWeight(ex.name, ex.intensity)
                                          if (!s) return null
                                          const diff = s.weight - s.baseWeight
                                          const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='
                                          return (
                                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                              Forslag: {s.weight} kg <span style={{ color: '#7a7770' }}>({diffStr} kg · RPE {s.fromRpe})</span>
                                            </div>
                                          )
                                        })()}
                                        {(exerciseHistory[ex.name?.toLowerCase()] || []).map(({ date, sets }) => {
                                          const d = new Date(date + 'T12:00:00')
                                          const label = `${d.getDate()}/${d.getMonth() + 1}`
                                          const setsStr = sets.map(s => `${s.weight}×${s.reps}${s.rpe ? ` @${s.rpe}` : ''}`).join('  ')
                                          return (
                                            <div key={date} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', marginBottom: '0.1rem' }}>
                                              <span style={{ color: '#7a7770', marginRight: '0.5rem' }}>{label}</span>{setsStr}
                                            </div>
                                          )
                                        })}
                                      </>
                                    )}
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1rem' }}>
                                      {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
                                    </div>
                                    {ex.note && (
                                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770', marginTop: '0.1rem', fontStyle: 'italic' }}>{ex.note}</div>
                                    )}
                                  </div>

                                  {/* Per-øvelse opvarmningssæt */}
                                  {isCurrentWeek && (() => {
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
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>Opvarmningssæt —</span>
                                            {isEditingWeight ? (
                                              <input
                                                autoFocus
                                                type="number"
                                                defaultValue={w}
                                                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', width: '52px', background: 'rgba(200,146,58,0.1)', border: '1px solid rgba(200,146,58,0.5)', color: '#c8923a', padding: '0 4px', textAlign: 'center' }}
                                                onClick={e => e.stopPropagation()}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    const val = parseFloat(e.target.value)
                                                    if (val >= 20) setExWarmupWeightOverride(prev => ({ ...prev, [exKey]: val }))
                                                    setExWarmupWeightEditing(null)
                                                  }
                                                  if (e.key === 'Escape') setExWarmupWeightEditing(null)
                                                }}
                                                onBlur={e => {
                                                  const val = parseFloat(e.target.value)
                                                  if (val >= 20) setExWarmupWeightOverride(prev => ({ ...prev, [exKey]: val }))
                                                  setExWarmupWeightEditing(null)
                                                }}
                                              />
                                            ) : (
                                              <span
                                                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: exWarmupWeightOverride[exKey] ? '#c8923a' : '#7a7770', textDecoration: 'underline dotted', cursor: 'text' }}
                                                onClick={e => { e.stopPropagation(); setExWarmupWeightEditing(exKey) }}
                                              >{w}kg</span>
                                            )}
                                            {doneCnt > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#6cba6c' }}>{doneCnt}/{sets.length}</span>}
                                            {usingOwn && <span title="Genbruger dine egne vægte fra sidste gang (samme øvelse, arbejdsvægt inden for 5%)" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', letterSpacing: '0.06em', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.05rem 0.3rem' }}>dine sidste</span>}
                                          </div>
                                          <span style={{ color: '#4a4844', fontSize: '0.55rem' }}>{isOpen ? '▲' : '▼'}</span>
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
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: done ? '#4a4844' : '#c8923a', minWidth: '28px' }}>{ws.pct}</span>
                                                  {isEditingSet ? (
                                                    <input
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
                                                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem', color: done ? '#4a4844' : '#edeae2', textDecoration: done ? 'line-through' : 'underline dotted', cursor: 'text' }}
                                                      onClick={e => { e.stopPropagation(); setWarmupSetEditing(editKey) }}
                                                    >{ws.weight}kg</span>
                                                  )}
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770' }}>× {ws.reps}</span>
                                                  <button
                                                    title="Spring dette opvarmningssæt over"
                                                    onClick={e => { e.stopPropagation(); korrigerSæt(i, { skipped: true }) }}
                                                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.6rem', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box' }}
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
                                  {isCurrentWeek && (() => {
                                    const dur = parseDuration(ex.reps, ex.intensity)
                                    if (!dur) return null
                                    return <ExerciseTimer key={`tmr_${ex.id}`} duration={dur.seconds} label={dur.text} />
                                  })()}

                                  {Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).map(setNum => {
                                    const key = `${ex.id}_${setNum}`
                                    const logged = logsForView.find(l => l.exercise_id === ex.id && l.set_number === setNum)

                                    if (!isCurrentWeek) {
                                      return (
                                        <div key={setNum} style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>Sæt {setNum}</div>
                                          {logged?.skipped ? (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#4a4844' }}>✕ Sprunget over</span>
                                          ) : logged ? (
                                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{logged.weight}kg × {logged.reps_completed}</span>
                                              {logged.rpe_actual != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770' }}>RPE {logged.rpe_actual}</span>}
                                              {logged.note && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#4a4844', fontStyle: 'italic' }}>{logged.note}</span>}
                                            </div>
                                          ) : (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#4a4844' }}>—</span>
                                          )}
                                        </div>
                                      )
                                    }

                                    const input = logInputs[key] || { weight: '', note: '', rpe: '', reps: '' }
                                    const plannedRpe = parsePlannedRpe(ex.intensity)
                                    // Interval ("4-6") eller "frit" ordination → atleten logger de reps der
                                    // faktisk blev lavet, sæt for sæt. Fast ordination opfører sig som før.
                                    const repsPrescription = parseRepsPrescription(ex.reps)
                                    const repsIsEditable = repsPrescription.type !== 'fixed'
                                    const repsDefault = repsPrescription.type === 'range' ? String(repsPrescription.min) : ''
                                    const repsValue = input.reps || repsDefault
                                    const repsToLog = repsIsEditable ? repsValue : ex.reps

                                    if (logged?.skipped) return (
                                      <div key={setNum} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>Sæt {setNum}</div>
                                        <span style={{ color: '#4a4844', fontSize: '1rem' }}>✕</span>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sprunget over</span>
                                        <button
                                          style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', color: '#7a7770' }}
                                          onClick={() => unskipSet(ex.id, setNum)}
                                        >Fortryd</button>
                                      </div>
                                    )

                                    return (
                                      <div key={setNum} style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>
                                            Sæt {setNum}
                                          </div>
                                          <input
                                            aria-label={`Vægt, sæt ${setNum}`}
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
                                                aria-label={`Reps, sæt ${setNum}`}
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
                                            style={{ ...s.btnPrimary, minHeight: '44px', boxSizing: 'border-box', padding: '0.65rem 1rem', fontSize: '0.65rem', background: logged ? '#6cba6c' : '#c8923a' }}
                                            onClick={() => logSet(ex.id, setNum, ex.sets, repsToLog, plannedRpe)}
                                          >{logged ? '✓' : 'Log'}</button>
                                          <button
                                            style={{ ...s.btnGhost, minHeight: '44px', boxSizing: 'border-box', padding: '0.65rem 0.75rem', fontSize: '0.55rem', color: '#4a4844', borderColor: 'rgba(237,234,226,0.08)' }}
                                            onClick={() => skipSet(ex.id, setNum, plannedRpe)}
                                          >Spring over</button>
                                        </div>
                                        <div style={{ paddingLeft: 'calc(52px + 0.5rem)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <div style={{ position: 'relative' }}>
                                            <button
                                              onClick={() => setOpenRpePicker(openRpePicker === key ? null : key)}
                                              style={{
                                                background: input.rpe ? 'rgba(200,146,58,0.15)' : 'rgba(237,234,226,0.04)',
                                                border: `1px solid ${input.rpe ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.13)'}`,
                                                color: input.rpe ? '#c8923a' : '#7a7770',
                                                fontFamily: "'IBM Plex Mono', monospace",
                                                fontSize: '0.6rem',
                                                letterSpacing: '0.08em',
                                                padding: '0.3rem 0.6rem',
                                                minHeight: '44px',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >RPE {input.rpe || (plannedRpe != null ? plannedRpe : 8)}</button>
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
                                                  const cur = parseFloat(input.rpe !== '' ? input.rpe : (plannedRpe != null ? plannedRpe : 8))
                                                  const isSelected = cur === v
                                                  return (
                                                    <button
                                                      key={v}
                                                      data-selected={isSelected ? 'true' : 'false'}
                                                      onClick={() => {
                                                        setLogInputs(p => ({ ...p, [key]: { ...p[key], rpe: v.toString() } }))
                                                        setOpenRpePicker(null)
                                                      }}
                                                      style={{
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
                                                    >{v}</button>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => setShowRpeGuide(true)}
                                            style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.75rem', padding: '0.3rem 0.2rem', lineHeight: 1, flexShrink: 0 }}
                                          >ℹ</button>
                                          <input
                                            style={{ ...s.fieldInput, flex: 1, fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#7a7770', fontStyle: 'italic' }}
                                            type="text" placeholder="Tilføj note..." value={input.note}
                                            onChange={e => setLogInputs(p => ({ ...p, [key]: { ...p[key], note: e.target.value } }))}
                                          />
                                        </div>
                                        {setConfirm[key] && (
                                          <div style={{
                                            paddingLeft: 'calc(52px + 0.5rem)',
                                            fontFamily: "'IBM Plex Mono', monospace",
                                            fontSize: '0.52rem',
                                            letterSpacing: '0.08em',
                                            color: setConfirm[key] === 'error' ? '#e05555' : '#6cba6c',
                                            marginTop: '0.2rem',
                                            opacity: setConfirm[key] === 'fading' ? 0 : 1,
                                            transition: 'opacity 0.3s ease',
                                          }}>
                                            {setConfirm[key] === 'error' ? 'Fejl — prøv igen' : 'Gemt ✓'}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                            {(session.exercises || []).length === 0 && (
                              <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen øvelser i denne træning endnu.</div>
                            )}
                            {isDone && isCurrentWeek && !session.athlete_rating && !dismissedFeedback.has(session.id) && (
                              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.15)' }}>
                                <div style={{ ...s.cardLabel, marginBottom: '0.75rem' }}>Træningsfeedback</div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div style={s.fieldLabel}>Hvordan gik træningen?</div>
                                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                    {[1, 2, 3, 4, 5].map(n => {
                                      const fi = feedbackInputs[session.id] || {}
                                      return (
                                        <button key={n}
                                          onClick={() => setFeedbackInputs(p => ({ ...p, [session.id]: { ...(p[session.id] || {}), rating: n } }))}
                                          // G13: 40×40px, lige under 44px — samme metode som F13-F16 (ordre 68).
                                          style={{ width: '44px', height: '44px', boxSizing: 'border-box', border: fi.rating === n ? '2px solid #c8923a' : '1px solid rgba(237,234,226,0.13)', background: fi.rating === n ? 'rgba(200,146,58,0.15)' : 'transparent', color: fi.rating === n ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.95rem', cursor: 'pointer' }}
                                        >{n}</button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <textarea
                                  style={{ ...s.fieldInput, minHeight: '60px', resize: 'vertical', fontSize: '0.82rem', lineHeight: 1.6, boxSizing: 'border-box' }}
                                  placeholder="Tilføj en kommentar..."
                                  maxLength={200}
                                  value={(feedbackInputs[session.id] || {}).comment || ''}
                                  onChange={e => setFeedbackInputs(p => ({ ...p, [session.id]: { ...(p[session.id] || {}), comment: e.target.value } }))}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                  <button style={s.btnGhost} onClick={() => setDismissedFeedback(p => new Set([...p, session.id]))}>Spring over</button>
                                  <button
                                    style={{ ...s.btnPrimary, opacity: !(feedbackInputs[session.id]?.rating) || pendingSessionAction === `${session.id}:feedback` ? 0.4 : 1 }}
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
                      <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                    </div>
                  )}
                </>
              )}
            </>
          )
}

// HJEM-fanen (ferie-skaermen og forsiden: overskrift, ugestrimmel, Dagens pas,
// pauselinje, chips og alt bag "Mere") — JSX'en flyttet uaendret ud af
// AthleteView.jsx (ordre 373). Ikke lazy: det er standardfanen. Ingen egen
// tilstand; alt kommer ind som props med samme navne som i AthleteView.

import { isMainLift } from '../warmup'
import { findDagensPas } from '../nextSet'
import { shouldNudgeCheckin } from '../checkinReminder'
import { compareReadiness, readinessComparisonText, readinessTrainingNote, summarizeReadinessForCoach, lastCheckinDrivenChange } from '../readinessInsight'
import { s, today } from '../athleteShared'
import { weekStartDate, fmtWeekRange, WEEKDAYS_LONG } from './ugeHjaelp'
import UgensStatusKort from './UgensStatusKort'
import WeekCalendar from './WeekCalendar'
import DagensPasCard from './DagensPasCard'
import RestPauseFooter from './RestPauseFooter'
import { WeeklyTonnageChart, E1RMChart, ReadinessSparkline } from './ForsideGrafer'

function HjemTab({
  allWeeks, athlete, currentWeek, days, exerciseHistory, exerciseLogs, fetchForloebLogs, fetchSharedVideoAnalyses,
  forloebLoading, forloebLogs, formatMsgTime, holidayReturn, kostCompact, lastLoggedSet, lastReadiness, liftProgress,
  logDagensPasSet, logInputs, logWeight, mereOpen, messages, months, now, onHoliday,
  openReadiness, openSession, pendingSyncCount, prs, prsError, readinessCardRef, readinessError, readinessHistory,
  readinessInput, readinessLog, renderSharedFeedbackCards, restPause, role, saveReadiness, savingReadiness, savingWeight,
  setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setLogInputs, setMereOpen, setReadinessInput, setRestPause, setTab, setWeightInput,
  sharedVideoAnalyses, sharedVideoError, sharedVideoLoading, skipSet, suggestNextWeight, tab, toastSlot, undoLoggedSet,
  unreadMsgCount, updateLoggedSet, weeklyTonnage, weightInput, weightLogs,
}) {
  return (
    <>
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

                  {toastSlot}

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
    </>
  )
}

export default HjemTab

// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Log: træningslog pr. uge og øvelsesfilter.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { parsePlannedRpe } from '../dashboardShared'

export default function LogTab({
  athleteLogs, logExerciseFilter, openLogWeeks, setLogExerciseFilter, setOpenLogWeeks,
}) {
              // Build trend index: exName → sorted [{ date, avg }]
              const trendEntries = {}
              for (const log of athleteLogs) {
                const name = log.exercises?.name
                if (!name) continue
                const date = log.logged_at?.slice(0, 10) || ''
                const tk = `${name}|${date}`
                if (!trendEntries[tk]) trendEntries[tk] = { name, date, weights: [] }
                if (log.weight) trendEntries[tk].weights.push(log.weight)
              }
              const trendIndex = {}
              for (const { name, date, weights } of Object.values(trendEntries)) {
                if (!trendIndex[name]) trendIndex[name] = []
                if (weights.length > 0) trendIndex[name].push({ date, avg: weights.reduce((a, b) => a + b, 0) / weights.length })
              }
              for (const arr of Object.values(trendIndex)) arr.sort((a, b) => a.date.localeCompare(b.date))

              function getTrend(exName, currentDate) {
                const history = (trendIndex[exName] || []).filter(e => e.date <= currentDate)
                if (history.length < 2) return null
                const curr = history[history.length - 1]
                const prev = history[history.length - 2]
                if (curr.date !== currentDate) return null
                const diff = Math.round((curr.avg - prev.avg) * 10) / 10
                if (diff > 0.4) return { text: `↑ +${diff}kg siden sidst`, color: '#6cba6c' }
                if (diff < -0.4) return { text: `↓ ${Math.abs(diff)}kg siden sidst`, color: '#e05555' }
                return { text: '= Samme som sidst', color: '#7a7770' }
              }

              // Group logs by date + session
              const grouped = {}
              for (const log of athleteLogs) {
                const ex = log.exercises
                const sess = ex?.sessions
                const date = log.logged_at?.slice(0, 10) || ''
                const sessId = sess?.id || 'unknown'
                const key = `${date}|${sessId}`
                if (!grouped[key]) grouped[key] = { date, sessionTitle: sess?.title || '—', weekNum: sess?.weeks?.week_number, sessionRating: sess?.athlete_rating ?? null, sessionComment: sess?.athlete_comment ?? null, exerciseMap: {} }
                const exId = log.exercise_id
                if (!grouped[key].exerciseMap[exId]) {
                  grouped[key].exerciseMap[exId] = {
                    name: ex?.name || '—',
                    plannedSets: ex?.sets || 0,
                    plannedReps: ex?.reps || '',
                    intensity: ex?.intensity || '',
                    sets: [],
                  }
                }
                grouped[key].exerciseMap[exId].sets.push({ n: log.set_number, weight: log.weight, reps: log.reps_completed, note: log.note, rpe_actual: log.rpe_actual, rpe_planned: parsePlannedRpe(log.exercises?.intensity), skipped: log.skipped })
              }
              const logSessions = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date))

              // Gruppér loggede træninger pr. uge (seneste uge øverst), sammenklappelige
              const wgMap = {}
              const weekGroups = []
              for (const sess of logSessions) {
                const key = sess.weekNum != null ? sess.weekNum : '—'
                if (!wgMap[key]) { wgMap[key] = { key, weekNum: sess.weekNum, sessions: [], latestDate: sess.date, totalSets: 0 }; weekGroups.push(wgMap[key]) }
                const g = wgMap[key]
                g.sessions.push(sess)
                if (sess.date > g.latestDate) g.latestDate = sess.date
                g.totalSets += Object.values(sess.exerciseMap).reduce((acc, ex) => acc + ex.sets.length, 0)
              }
              weekGroups.sort((a, b) => b.latestDate.localeCompare(a.latestDate))
              const latestKey = weekGroups[0]?.key
              const openSet = openLogWeeks ?? new Set(latestKey != null ? [latestKey] : [])
              const toggleWeek = key => setOpenLogWeeks(prev => {
                const base = prev ?? new Set(latestKey != null ? [latestKey] : [])
                const next = new Set(base)
                if (next.has(key)) next.delete(key); else next.add(key)
                return next
              })

              // Øvelses-filter: liste over loggede øvelser + progression for den valgte
              const exerciseNames = [...new Set(athleteLogs.map(l => l.exercises?.name).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'da'))
              const filterName = logExerciseFilter && exerciseNames.includes(logExerciseFilter) ? logExerciseFilter : null
              const e1rmOf = s => (s.weight || 0) * (1 + (s.reps || 1) / 30)
              const progression = filterName ? logSessions.map(sess => {
                const entries = Object.values(sess.exerciseMap).filter(ex => ex.name === filterName)
                if (!entries.length) return null
                const sets = entries.flatMap(e => e.sets).filter(s => !s.skipped && (s.weight || 0) > 0)
                if (!sets.length) return null
                const sortedSets = [...sets].sort((a, b) => a.n - b.n)
                const best = sets.reduce((m, s) => (e1rmOf(s) > m.v ? { v: e1rmOf(s), s } : m), { v: 0, s: null })
                const planText = [entries[0].plannedSets && `${entries[0].plannedSets} sæt`, entries[0].plannedReps && `× ${entries[0].plannedReps}`, entries[0].intensity].filter(Boolean).join(' · ')
                return { date: sess.date, weekNum: sess.weekNum, sortedSets, e1rm: Math.round(best.v * 10) / 10, planText }
              }).filter(Boolean) : []

              const renderSession = (sess, i) => {
                    const exercises = Object.values(sess.exerciseMap)
                    const totalPlanned = exercises.reduce((acc, ex) => acc + ex.plannedSets, 0)
                    const totalLogged = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
                    const allWeights = exercises.flatMap(ex => ex.sets.map(s => s.weight || 0)).filter(w => w > 0)
                    const sessAvg = allWeights.length > 0 ? Math.round(allWeights.reduce((a, b) => a + b, 0) / allWeights.length * 10) / 10 : 0

                    return (
                      <div key={i} style={{ marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid rgba(237,234,226,0.05)' }}>
                        {/* Session header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sess.date}</div>
                              {sess.weekNum && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase' }}>Uge {sess.weekNum}</div>}
                            </div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>{sess.sessionTitle}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: totalLogged >= totalPlanned && totalPlanned > 0 ? '#6cba6c' : '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {totalLogged}/{totalPlanned} sæt
                            </div>
                            {sessAvg > 0 && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase', marginTop: '0.15rem' }}>
                                Ø {sessAvg} kg
                              </div>
                            )}
                          </div>
                        </div>

                        {sess.sessionRating && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', letterSpacing: '0.04em' }}>
                              {'★'.repeat(sess.sessionRating)}{'☆'.repeat(5 - sess.sessionRating)}
                            </div>
                            {sess.sessionComment && (
                              <div style={{ fontSize: '0.75rem', color: '#7a7770', fontStyle: 'italic' }}>{sess.sessionComment}</div>
                            )}
                          </div>
                        )}

                        {/* Exercises */}
                        {exercises.map((ex, j) => {
                          const sortedSets = [...ex.sets].sort((a, b) => a.n - b.n)
                          const weights = sortedSets.map(s => s.weight || 0).filter(w => w > 0)
                          const exAvg = weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length * 10) / 10 : 0
                          const maxW = weights.length > 0 ? Math.max(...weights) : 0
                          const completion = ex.plannedSets > 0 ? Math.min(1, ex.sets.length / ex.plannedSets) : 0
                          const trend = getTrend(ex.name, sess.date)
                          const planText = [ex.plannedSets && `${ex.plannedSets} sæt`, ex.plannedReps && `× ${ex.plannedReps}`, ex.intensity].filter(Boolean).join(' · ')
                          const borderColor = completion >= 1 ? '#6cba6c' : completion > 0 ? '#c8923a' : 'rgba(237,234,226,0.07)'

                          return (
                            <div key={j} style={{ marginBottom: '1rem', paddingLeft: '0.75rem', borderLeft: `2px solid ${borderColor}` }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                                <div style={{ fontSize: '0.85rem', color: '#b8b4a8' }}>{ex.name}</div>
                                {trend && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: trend.color, letterSpacing: '0.06em', flexShrink: 0, marginLeft: '0.75rem' }}>{trend.text}</div>}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginBottom: '0.4rem' }}>
                                Plan: {planText}
                              </div>
                              {ex.plannedSets > 0 && (
                                <div style={{ marginBottom: '0.45rem' }}>
                                  <div style={{ height: '3px', background: '#242420', borderRadius: '2px', marginBottom: '0.25rem' }}>
                                    <div style={{ height: '3px', width: `${completion * 100}%`, background: completion >= 1 ? '#6cba6c' : '#c8923a', borderRadius: '2px' }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>{ex.sets.length}/{ex.plannedSets} sæt</div>
                                    {exAvg > 0 && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#7a7770' }}>Ø {exAvg}kg{maxW > exAvg ? ` · maks ${maxW}kg` : ''}</div>}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {sortedSets.map(set => {
                                  if (set.skipped) return (
                                    <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.06)', padding: '0.2rem 0.5rem', color: '#4a4844' }}>
                                      <span>S{set.n} </span><span>✕</span>
                                    </div>
                                  )
                                  const rpeColor = set.rpe_actual != null && set.rpe_planned != null
                                    ? (set.rpe_actual >= set.rpe_planned + 1 ? '#c8923a' : Math.abs(set.rpe_actual - set.rpe_planned) <= 0.5 ? '#6cba6c' : '#edeae2')
                                    : '#7a7770'
                                  return (
                                    <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.5rem', color: '#edeae2' }}>
                                      <span style={{ color: '#4a4844' }}>S{set.n} </span>
                                      <span style={{ color: '#c8923a' }}>{set.weight}kg</span>
                                      {set.reps && <span style={{ color: '#7a7770' }}> × {set.reps}</span>}
                                      {set.rpe_actual != null && (
                                        <span style={{ color: rpeColor, marginLeft: '0.3rem' }}>
                                          RPE {set.rpe_actual}{set.rpe_planned != null ? `/${set.rpe_planned}` : ''}
                                        </span>
                                      )}
                                      {set.note && <span style={{ color: '#4a4844', marginLeft: '0.3rem', fontStyle: 'italic' }}>{set.note}</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                }

                return (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1.25rem' }}>
                      Træningslog
                    </div>
                    {logSessions.length === 0 ? (
                      <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Ingen loggede træninger endnu
                      </div>
                    ) : (
                      <>
                        {/* Øvelses-filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>Øvelse</span>
                          <select
                            value={filterName || ''}
                            onChange={e => setLogExerciseFilter(e.target.value || null)}
                            style={{ background: '#1c1c18', color: '#edeae2', border: '1px solid rgba(237,234,226,0.15)', borderRadius: 4, padding: '0.4rem 0.6rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', cursor: 'pointer', maxWidth: '100%' }}
                          >
                            <option value="">Alle øvelser</option>
                            {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>

                        {filterName ? (
                          progression.length === 0 ? (
                            <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                              Ingen loggede sæt for {filterName} endnu
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2', marginBottom: '1rem' }}>{filterName}</div>
                              {progression.map((row, idx) => {
                                const older = progression[idx + 1]
                                let delta = null
                                if (older && row.e1rm > 0 && older.e1rm > 0) {
                                  const d = Math.round((row.e1rm - older.e1rm) * 10) / 10
                                  delta = d > 0.4 ? { text: `↑ +${d}kg e1RM`, color: '#6cba6c' }
                                    : d < -0.4 ? { text: `↓ ${Math.abs(d)}kg e1RM`, color: '#e05555' }
                                    : { text: '= samme', color: '#7a7770' }
                                }
                                return (
                                  <div key={row.date + idx} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(237,234,226,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', minWidth: 0 }}>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{row.date}</span>
                                        {row.weekNum != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase' }}>Uge {row.weekNum}</span>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexShrink: 0 }}>
                                        {row.e1rm > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#b8b4a8' }}>e1RM {row.e1rm}kg</span>}
                                        {delta && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: delta.color, letterSpacing: '0.06em' }}>{delta.text}</span>}
                                      </div>
                                    </div>
                                    {row.planText && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginBottom: '0.4rem' }}>Plan: {row.planText}</div>}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                      {row.sortedSets.map(set => (
                                        <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.5rem', color: '#edeae2' }}>
                                          <span style={{ color: '#4a4844' }}>S{set.n} </span>
                                          <span style={{ color: '#c8923a' }}>{set.weight}kg</span>
                                          {set.reps && <span style={{ color: '#7a7770' }}> × {set.reps}</span>}
                                          {set.rpe_actual != null && <span style={{ color: '#7a7770', marginLeft: '0.3rem' }}>RPE {set.rpe_actual}{set.rpe_planned != null ? `/${set.rpe_planned}` : ''}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        ) : weekGroups.map(g => {
                          const open = openSet.has(g.key)
                          return (
                            <div key={g.key} style={{ marginBottom: '0.5rem' }}>
                              <button onClick={() => toggleWeek(g.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', borderRadius: 4, padding: '0.65rem 0.85rem', cursor: 'pointer', marginBottom: open ? '1rem' : 0 }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#edeae2' }}>
                                  {g.weekNum != null ? `Uge ${g.weekNum}` : 'Uden uge'}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>{g.sessions.length} træning{g.sessions.length === 1 ? '' : 'er'} · {g.totalSets} sæt</span>
                                  <span style={{ color: '#c8923a', fontSize: '0.7rem' }}>{open ? '▾' : '▸'}</span>
                                </span>
                              </button>
                              {open && (
                                <div style={{ paddingLeft: '0.25rem' }}>
                                  {g.sessions.map((sess, i) => renderSession(sess, i))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
}

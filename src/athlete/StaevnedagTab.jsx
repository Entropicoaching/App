// Stævnedag-fanen (sæt-loggeren til åbnere/attempts på stævnedagen) —
// udskilt fra AthleteView.jsx (ordre 232 · commit 2) som sin egen
// lazy-loadede chunk, samme LazyBoundary-mønster som Dashboard.jsx's fire
// faner (130/163/228). Ren udflytning af JSX'en — ingen logikændring, kun
// frie variable gjort eksplicitte som props. Fanen er den sjældneste af de
// seks: vises kun i bundnavigationen når atleten har en stævnedato eller
// -plan sat (se NAV_ITEMS-filteret i AthleteView.jsx).
import { runGuardedWrite } from '../athleteWriteGuard'
import { supabase } from '../supabase'
import { s } from '../athleteShared'

export default function StaevnedagTab({
  athlete, coachAthleteId, hasMeetPlan, meetAttempts, meetPlanNotes, meetResults,
  meetType, meetWarmupDraft, meetWarmupEditing, meetWarmupOverrides, setAthlete,
  setMeetAttempts, setMeetType, setMeetWarmupDraft, setMeetWarmupEditing,
  setMeetWarmupOverrides, showFlash,
}) {
          const round = w => Math.round(w / 2.5) * 2.5

          function calcCompWarmup(opener) {
            if (!opener || opener <= 20) return []
            return [
              { weight: 20, reps: 5, pct: 'Stang' },
              { weight: round(opener * 0.50), reps: 3, pct: '50%' },
              { weight: round(opener * 0.70), reps: 2, pct: '70%' },
              { weight: round(opener * 0.85), reps: 1, pct: '85%' },
              { weight: round(opener * 0.93), reps: 1, pct: '93%' },
            ].filter((s, i, arr) => i === 0 || s.weight !== arr[i - 1].weight)
          }

          function setAttempt(lift, idx, field, val) {
            setMeetAttempts(prev => {
              const next = { ...prev, [lift]: prev[lift].map((a, i) => i === idx ? { ...a, [field]: val } : a) }
              return next
            })
          }

          function bestLift(lift) {
            const good = meetAttempts[lift].filter(a => a.r === 'good' && parseFloat(a.w) > 0)
            if (!good.length) return null
            return Math.max(...good.map(a => parseFloat(a.w)))
          }

          const lifts = meetType === 'sbd'
            ? [{ key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bænkpres' }, { key: 'deadlift', label: 'Dødløft' }]
            : [{ key: 'bench', label: 'Bænkpres' }]

          const total = lifts.reduce((sum, l) => sum + (bestLift(l.key) || 0), 0)
          const allHaveBest = lifts.every(l => bestLift(l.key) !== null)

          async function markGoodAndSave(key, i) {
            const current = meetAttempts[key]
            const isAlreadyGood = current[i].r === 'good'
            setAttempt(key, i, 'r', isAlreadyGood ? null : 'good')
            if (!isAlreadyGood && athlete && !coachAthleteId) {
              const updated = current.map((a, j) => j === i ? { ...a, r: 'good' } : a)
              const good = updated.filter(a => a.r === 'good' && parseFloat(a.w) > 0)
              if (!good.length) return
              const best = Math.max(...good.map(a => parseFloat(a.w)))
              const colMap = { squat: 'squat', bench: 'bench', deadlift: 'deadlift' }
              const col = colMap[key]
              if (col) {
                // Skærmen skal aldrig vise et stævnemaks RPC'en ikke har bekræftet —
                // ellers står coachen med et forkert tal, når den ægte databaseværdi afviger.
                const ok = await runGuardedWrite(
                  () => supabase.rpc('update_competition_max', { p_lift: col, p_weight: best }),
                  () => showFlash('Stævnemakset blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
                )
                if (ok) setAthlete(prev => ({ ...prev, [col]: best }))
              }
            }
          }

          const meetHistoryCard = meetResults.length > 0 ? (
            <div style={{ ...s.card, marginTop: '1.5rem' }}>
              <div style={s.cardLabel}>Tidligere stævner</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace" }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#4a4844', fontSize: '0.46rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.35rem 0.4rem 0.35rem 0', fontWeight: 500 }}>Dato</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500 }}>Stævne</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>S</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>B</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>D</th>
                      <th style={{ padding: '0.35rem 0 0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetResults.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid rgba(237,234,226,0.06)', fontSize: '0.72rem', color: '#edeae2' }}>
                        <td style={{ padding: '0.5rem 0.4rem 0.5rem 0', whiteSpace: 'nowrap' }}>{new Date(m.meet_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                        <td style={{ padding: '0.5rem 0.4rem', color: '#b8b4a8', fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.meet_name || '—'}</td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: m.squat != null ? '#edeae2' : '#3a3a36' }}>{m.squat != null ? m.squat : '–'}</td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: m.bench != null ? '#edeae2' : '#3a3a36' }}>{m.bench != null ? m.bench : '–'}</td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: m.deadlift != null ? '#edeae2' : '#3a3a36' }}>{m.deadlift != null ? m.deadlift : '–'}</td>
                        <td style={{ padding: '0.5rem 0 0.5rem 0.4rem', textAlign: 'right', color: '#c8923a' }}>{m.total != null ? m.total : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null

          // STANDBY — ingen stævneplan
          if (!hasMeetPlan) {
            const compDate = athlete.competition_date
            const daysLeft = compDate ? Math.ceil((new Date(compDate + 'T12:00:00') - new Date()) / 86400000) : null
            return (
            <>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Stævne</div>
                {compDate && daysLeft > 0 ? (
                  <>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                      {daysLeft} dage<br />til stævne.
                    </h1>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#c8923a', letterSpacing: '0.08em', marginTop: '0.6rem' }}>
                      {new Date(compDate + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', marginTop: '0.5rem' }}>
                      Din coach har endnu ikke sat forsøgsplan.
                    </div>
                  </>
                ) : (
                  <>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Ingen stævne<br />planlagt.</h1>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#4a4844', letterSpacing: '0.06em', lineHeight: 1.7, marginTop: '0.75rem' }}>
                      Din coach har ikke sat en stævneplan endnu.
                    </div>
                  </>
                )}
              </div>

              {(athlete.squat || athlete.bench || athlete.deadlift) && (
                <div style={s.card}>
                  <div style={s.cardLabel}>Konkurrencemaks</div>
                  {[['Squat', athlete.squat], ['Bænkpres', athlete.bench], ['Dødløft', athlete.deadlift]].map(([label, val]) => val ? (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>{val} <span style={{ fontSize: '0.7rem', color: '#4a4844' }}>kg</span></div>
                    </div>
                  ) : null)}
                  {(athlete.squat && athlete.bench && athlete.deadlift) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.75rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: '#c8923a' }}>{(athlete.squat || 0) + (athlete.bench || 0) + (athlete.deadlift || 0)} <span style={{ fontSize: '0.8rem', color: '#7a7770' }}>kg</span></div>
                    </div>
                  )}
                </div>
              )}
              {meetHistoryCard}
            </>
          )}

          return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Stævnedag</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                  {athlete.name?.split(' ')[0] || 'Atlet'}.
                </h1>
              </div>

              {/* Coach note */}
              {meetPlanNotes && (
                <div style={{ ...s.card, borderColor: 'rgba(200,146,58,0.25)', marginBottom: '1.5rem' }}>
                  <div style={s.cardLabel}>Fra din coach</div>
                  <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.7 }}>{meetPlanNotes}</div>
                </div>
              )}

              {/* Type toggle */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.75rem' }}>
                {[['sbd', 'SBD'], ['bench', 'Bænkpres']].map(([key, label]) => (
                  <button key={key} onClick={() => setMeetType(key)} style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500,
                    letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                    padding: '0.5rem 1.1rem',
                    background: meetType === key ? '#c8923a' : 'rgba(237,234,226,0.07)',
                    color: meetType === key ? '#141410' : '#7a7770',
                  }}>{label}</button>
                ))}
              </div>

              {/* Lift sections */}
              {lifts.map(({ key, label }) => {
                const attempts = meetAttempts[key]
                const best = bestLift(key)
                const opener = parseFloat(attempts[0].w) || 0
                const warmup = calcCompWarmup(opener)

                return (
                  <div key={key} style={{ marginBottom: '1.75rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>
                      {label}
                      {best && <span style={{ color: '#6cba6c', marginLeft: '0.75rem' }}>Bedste: {best} kg</span>}
                    </div>

                    {/* Attempt rows */}
                    <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', marginBottom: '0.75rem' }}>
                      {attempts.map((att, i) => {
                        const bg = att.r === 'good' ? 'rgba(108,186,108,0.08)' : att.r === 'fail' ? 'rgba(224,85,85,0.08)' : 'transparent'
                        const border = att.r === 'good' ? 'rgba(108,186,108,0.25)' : att.r === 'fail' ? 'rgba(224,85,85,0.25)' : 'rgba(237,234,226,0.07)'
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: i < 2 ? `1px solid rgba(237,234,226,0.06)` : 'none', background: bg, borderLeft: `3px solid ${border}` }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: '24px' }}>{i + 1}.</div>
                            <input
                              type="number"
                              placeholder="kg"
                              value={att.w}
                              onChange={e => setAttempt(key, i, 'w', e.target.value)}
                              style={{ width: '72px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,234,226,0.2)', color: '#edeae2', fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, outline: 'none', padding: '0.1rem 0', textAlign: 'center' }}
                            />
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844' }}>kg</div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                              <button
                                onClick={() => markGoodAndSave(key, i)}
                                style={{ background: att.r === 'good' ? 'rgba(108,186,108,0.2)' : 'transparent', border: `1px solid ${att.r === 'good' ? '#6cba6c' : 'rgba(237,234,226,0.15)'}`, color: att.r === 'good' ? '#6cba6c' : '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', padding: '0.4rem 0.7rem', cursor: 'pointer', minWidth: '42px' }}
                              >✓</button>
                              <button
                                onClick={() => setAttempt(key, i, 'r', att.r === 'fail' ? null : 'fail')}
                                style={{ background: att.r === 'fail' ? 'rgba(224,85,85,0.2)' : 'transparent', border: `1px solid ${att.r === 'fail' ? '#e05555' : 'rgba(237,234,226,0.15)'}`, color: att.r === 'fail' ? '#e05555' : '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', padding: '0.4rem 0.7rem', cursor: 'pointer', minWidth: '42px' }}
                              >✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Competition warmup */}
                    {warmup.length > 0 && (
                      <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.07)', borderLeft: '2px solid rgba(200,146,58,0.3)' }}>
                        <div style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>
                            Opvarmning til åbner {opener}kg
                          </span>
                          {meetWarmupEditing === key ? (
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }} onClick={() => setMeetWarmupEditing(null)}>Annuller</button>
                              <button style={{ ...s.btnPrimary, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }} onClick={() => {
                                setMeetWarmupOverrides(prev => ({ ...prev, [key]: meetWarmupDraft }))
                                setMeetWarmupEditing(null)
                              }}>Gem</button>
                            </div>
                          ) : (
                            <button style={{ ...s.btnGhost, fontSize: '0.46rem', padding: '0.15rem 0.45rem' }} onClick={() => {
                              setMeetWarmupEditing(key)
                              setMeetWarmupDraft((meetWarmupOverrides[key] || warmup).map(ws => ({ ...ws })))
                            }}>Rediger</button>
                          )}
                        </div>

                        {meetWarmupEditing === key ? (
                          <div style={{ padding: '0 0.75rem 0.75rem' }}>
                            {meetWarmupDraft.map((ws, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                <input
                                  type="number"
                                  value={ws.weight}
                                  onChange={e => setMeetWarmupDraft(prev => prev.map((s, j) => j === i ? { ...s, weight: parseFloat(e.target.value) || 0 } : s))}
                                  style={{ width: '64px', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.15)', color: '#edeae2', fontFamily: "'Playfair Display', serif", fontSize: '1rem', padding: '0.3rem 0.4rem', outline: 'none', textAlign: 'center' }}
                                />
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>kg ×</span>
                                <input
                                  type="number"
                                  value={ws.reps}
                                  onChange={e => setMeetWarmupDraft(prev => prev.map((s, j) => j === i ? { ...s, reps: parseInt(e.target.value) || 1 } : s))}
                                  style={{ width: '40px', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.15)', color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', padding: '0.3rem 0.4rem', outline: 'none', textAlign: 'center' }}
                                />
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>reps</span>
                                <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e05555', cursor: 'pointer', fontSize: '0.7rem' }} onClick={() => setMeetWarmupDraft(prev => prev.filter((_, j) => j !== i))}>✕</button>
                              </div>
                            ))}
                            <button style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.6rem', marginTop: '0.25rem' }} onClick={() => {
                              const last = meetWarmupDraft[meetWarmupDraft.length - 1]
                              setMeetWarmupDraft(prev => [...prev, { weight: last ? last.weight + 10 : 20, reps: 1, pct: '' }])
                            }}>+ Tilføj sæt</button>
                          </div>
                        ) : (
                          <div style={{ padding: '0 0.75rem 0.6rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {(meetWarmupOverrides[key] || warmup).map((ws, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '0.4rem 0.6rem', minWidth: '52px' }}>
                                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>{ws.weight}</span>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#4a4844', marginTop: '0.1rem' }}>× {ws.reps}</span>
                                {ws.pct && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', color: '#c8923a', marginTop: '0.1rem' }}>{ws.pct}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Total */}
              {total > 0 && (
                <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.25rem', marginTop: '0.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: allHaveBest ? '#6cba6c' : '#7a7770', marginBottom: '0.35rem' }}>
                    {allHaveBest ? 'Total' : 'Foreløbig total'}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', fontWeight: 400, color: '#edeae2', lineHeight: 1 }}>
                    {total} <span style={{ fontSize: '1rem', color: '#7a7770' }}>kg</span>
                  </div>
                </div>
              )}

              {/* Reset */}
              {total > 0 && (
                <button
                  style={{ ...s.btnGhost, width: '100%', padding: '0.65rem', textAlign: 'center', marginTop: '1rem' }}
                  onClick={() => setMeetAttempts({
                    squat:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
                    bench:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
                    deadlift: [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
                  })}
                >
                  Nulstil
                </button>
              )}
              {meetHistoryCard}
            </>
          )
}

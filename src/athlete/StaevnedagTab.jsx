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
import MeetDayPlanner from './MeetDayPlanner.jsx'

export default function StaevnedagTab({
  athlete, coachAthleteId, hasMeetPlan, meetAttempts, meetPlanNotes, meetResults,
  meetType, meetWarmupDraft, meetWarmupEditing, meetWarmupOverrides, setAthlete,
  setMeetAttempts, setMeetType, setMeetWarmupDraft, setMeetWarmupEditing,
  setMeetWarmupOverrides, showFlash,
}) {
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

              <MeetDayPlanner
                key={JSON.stringify([coachAthleteId || athlete.id || 'atlet', athlete.competition_date || '', meetAttempts.squat?.[0]?.w, meetAttempts.bench?.[0]?.w, meetAttempts.deadlift?.[0]?.w])}
                meetAttempts={meetAttempts}
                meetType={meetType}
              />

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

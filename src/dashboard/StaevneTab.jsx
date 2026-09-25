// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Stævne: stævneplan, historik og rekorder.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'
import { supabase } from '../supabase'

export default function StaevneTab({
  a, athletePRs, deleteMeetResult, meetPlan, meetPlanForm, meetResults,
  openMeetResult, saveMeetPlan, savingMeetPlan, setMeetPlan, setMeetPlanForm,
}) {
              const lifts = meetPlanForm.meet_type === 'sbd'
                ? [{ key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bænkpres' }, { key: 'deadlift', label: 'Dødløft' }]
                : [{ key: 'bench', label: 'Bænkpres' }]
              const fieldMap = { squat: ['squat1','squat2','squat3'], bench: ['bench1','bench2','bench3'], deadlift: ['dead1','dead2','dead3'] }

              return (
                <>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Stævneplan — {a.name.split(' ')[0]}
                    {meetPlan && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#6cba6c', marginLeft: '0.75rem' }}>Gemt</span>}
                  </div>

                  {/* Type toggle */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={s.fieldLabel}>Stævnetype</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[['sbd', 'SBD'], ['bench', 'Kun bænkpres']].map(([key, label]) => (
                        <button key={key} onClick={() => setMeetPlanForm(p => ({ ...p, meet_type: key }))} style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500,
                          letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                          padding: '0.4rem 0.85rem',
                          background: meetPlanForm.meet_type === key ? '#c8923a' : 'rgba(237,234,226,0.07)',
                          color: meetPlanForm.meet_type === key ? '#141410' : '#7a7770',
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Attempt inputs per lift */}
                  {lifts.map(({ key, label }) => (
                    <div key={key} style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#edeae2', marginBottom: '0.6rem' }}>{label}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {fieldMap[key].map((field, i) => (
                          <div key={field}>
                            <div style={s.fieldLabel}>{i + 1}. forsøg</div>
                            <input
                              type="number"
                              placeholder="kg"
                              value={meetPlanForm[field]}
                              onChange={e => setMeetPlanForm(p => ({ ...p, [field]: e.target.value }))}
                              style={{ ...s.fieldInput, textAlign: 'center' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Notes */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={s.fieldLabel}>Note til atleten</div>
                    <textarea
                      style={{ ...s.fieldInput, minHeight: '72px', resize: 'vertical', lineHeight: 1.7 }}
                      placeholder="Taktik, strategi, påmindelser..."
                      value={meetPlanForm.notes}
                      onChange={e => setMeetPlanForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>

                  <button style={s.btnPrimary} onClick={() => saveMeetPlan(a.id)} disabled={savingMeetPlan}>
                    {savingMeetPlan ? 'Gemmer...' : 'Gem plan'}
                  </button>

                  {meetPlan && (
                    <button style={{ ...s.btnDanger, marginLeft: '0.75rem' }} onClick={async () => {
                      await supabase.from('meet_plans').delete().eq('athlete_id', a.id)
                      setMeetPlan(null)
                      setMeetPlanForm({ meet_type: 'sbd', squat1: '', squat2: '', squat3: '', bench1: '', bench2: '', bench3: '', dead1: '', dead2: '', dead3: '', notes: '' })
                    }}>
                      Slet plan
                    </button>
                  )}
                </div>

                {/* Stævnehistorik */}
                <div style={{ ...s.card, marginTop: '1.5rem' }}>
                  <div style={s.cardLabel}>
                    Stævnehistorik
                    <button style={s.btnEdit} onClick={() => openMeetResult()}>Registrér resultat</button>
                  </div>
                  {meetResults.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen stævner registreret endnu.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace" }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#4a4844', fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.4rem 0.5rem 0.4rem 0', fontWeight: 500 }}>Dato</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>Stævne</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>S</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>B</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>D</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.4rem 0 0.4rem 0.5rem' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {meetResults.map(m => (
                            <tr key={m.id} style={{ borderTop: '1px solid rgba(237,234,226,0.07)', fontSize: '0.78rem', color: '#edeae2' }}>
                              <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', whiteSpace: 'nowrap' }}>{new Date(m.meet_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                              <td style={{ padding: '0.5rem', color: '#b8b4a8', fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.meet_name || <span style={{ color: '#4a4844' }}>—</span>}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: m.squat != null ? '#edeae2' : '#3a3a36' }}>{m.squat != null ? m.squat : '–'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: m.bench != null ? '#edeae2' : '#3a3a36' }}>{m.bench != null ? m.bench : '–'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: m.deadlift != null ? '#edeae2' : '#3a3a36' }}>{m.deadlift != null ? m.deadlift : '–'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#c8923a' }}>{m.total != null ? m.total : '–'}</td>
                              <td style={{ padding: '0.5rem 0 0.5rem 0.5rem', textAlign: 'right' }}>
                                <button onClick={() => deleteMeetResult(m.id)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }} title="Slet">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* PRs */}
                <div style={{ ...s.card, marginTop: '1.5rem' }}>
                  <div style={s.cardLabel}>Rekorder</div>
                  {athletePRs.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen PR'er registreret endnu.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {athletePRs.map(pr => (
                        <div key={pr.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', color: '#edeae2', fontWeight: 300 }}>{pr.exercise_name}</span>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexShrink: 0 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.95rem', color: '#c8923a' }}>{pr.weight} kg</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em' }}>{pr.logged_at.slice(0, 10)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </>
              )
}

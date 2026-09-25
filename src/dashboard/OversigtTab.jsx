// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Oversigt: sidst aktiv, parathed, resultater, kostmål, stævne, volumenkort.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s, readinessSignal } from '../dashboardShared'
import LazyBoundary from '../LazyBoundary'

export default function OversigtTab({
  a, athleteLogs, athleteReadiness, currentWeight, editData, editing,
  isMobile, openMeetResult, profilesLastSeen, saveEdit, saving, session,
  setActiveTab, setEditData, setEditing, startEdit, total, trainingTotal,
  volumenKortFactory, weeks, weightTrend,
}) {
  return (
              <div>
              {(() => {
                const rawTs = profilesLastSeen[a.user_id]
                if (!rawTs) return null
                const d = new Date(rawTs)
                const exact = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) + ' kl. ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', color: '#4a4844', marginBottom: '1rem' }}>
                    Sidst aktiv: {exact}
                  </div>
                )
              })()}
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const todayR = athleteReadiness.find(r => r.logged_date === todayStr)
                if (!todayR) return (
                  <div style={{ ...s.card, marginBottom: '1.5rem', color: '#7a7770', fontSize: '0.78rem' }}>
                    Ingen check-in logget i dag endnu.
                  </div>
                )
                const sig = readinessSignal(todayR.readiness_score)
                const prevR = athleteReadiness.find(r => r.logged_date < todayStr)
                let trend = null
                if (prevR && todayR.readiness_score != null && prevR.readiness_score != null) {
                  const d = todayR.readiness_score - prevR.readiness_score
                  trend = d > 2 ? { text: `↑ +${d} vs. sidst`, color: '#6cba6c' }
                    : d < -2 ? { text: `↓ ${d} vs. sidst`, color: '#e05555' }
                    : { text: '= som sidst', color: '#7a7770' }
                }
                const params = [
                  todayR.sleep_hours != null && ['Søvn', `${todayR.sleep_hours}t`],
                  todayR.energy != null && ['Energi', `${todayR.energy}/5`],
                  todayR.motivation != null && ['Motivation', `${todayR.motivation}/5`],
                  todayR.stress != null && ['Stress', `${todayR.stress}/5`],
                  todayR.soreness_level != null && ['Ømhed', `${todayR.soreness_level}/5`],
                ].filter(Boolean)
                return (
                  <div style={{ ...s.card, background: sig.bg, marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem' }}>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.3rem' }}>Parathed i dag</div>
                          <div style={{ fontSize: '0.95rem', color: sig.color }}>{sig.text}</div>
                          {trend && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: trend.color, letterSpacing: '0.06em', marginTop: '0.25rem' }}>{trend.text}</div>}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.6rem', fontWeight: 500, color: sig.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {todayR.readiness_score}<span style={{ fontSize: '0.55rem', color: '#4a4844', fontWeight: 400, marginLeft: '0.2rem' }}>/100</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
                        {params.map(([label, val]) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={s.fieldLabel}>{label}</div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: '#edeae2' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {todayR.sore_zones?.length > 0 && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <div style={s.fieldLabel}>Lokal ømhed</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770' }}>{todayR.sore_zones.join(', ')}</div>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Resultater
                    <button style={s.btnEdit} onClick={() => startEdit('stats', { squat: a.squat, bench: a.bench, deadlift: a.deadlift, training_squat: a.training_squat, training_bench: a.training_bench, training_deadlift: a.training_deadlift, status: a.status, weight_class: a.weight_class, age: a.age, competition_date: a.competition_date || '', vacation_until: a.vacation_until || '' })}>Rediger</button>
                  </div>
                  {editing === 'stats' ? (
                    <div>
                      {[['Alder', 'age'], ['Vægtklasse (kg)', 'weight_class']].map(([label, key]) => (
                        <div key={key} style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type="number" value={editData[key] || ''} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', margin: '1rem 0 0.5rem' }}>Konkurrencemaks</div>
                      {[['Squat (kg)', 'squat'], ['Bænkpres (kg)', 'bench'], ['Dødløft (kg)', 'deadlift']].map(([label, key]) => (
                        <div key={key} style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type="number" value={editData[key] || ''} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', margin: '1rem 0 0.5rem' }}>Træningsmaks</div>
                      {[['Squat (kg)', 'training_squat'], ['Bænkpres (kg)', 'training_bench'], ['Dødløft (kg)', 'training_deadlift']].map(([label, key]) => (
                        <div key={key} style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type="number" value={editData[key] || ''} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={s.fieldLabel}>Status</div>
                        <select style={s.fieldSelect} value={editData.status} onChange={e => setEditData(prev => ({ ...prev, status: e.target.value }))}>
                          <option value="active">Aktiv</option>
                          <option value="peaking">Peaking</option>
                          <option value="offseason">Off-season</option>
                          <option value="ferie">Ferie</option>
                        </select>
                      </div>
                      {editData.status === 'ferie' && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>Tilbage d. <span style={{ textTransform: 'none', fontWeight: 400, color: '#4a4844' }}>(valgfrit — tom = indtil du ændrer status)</span></div>
                          <input style={s.fieldInput} type="date" value={editData.vacation_until || ''} onChange={e => setEditData(prev => ({ ...prev, vacation_until: e.target.value }))} />
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginTop: '0.3rem', letterSpacing: '0.04em' }}>Atleten er ude af Prioritet under ferien og dukker op igen som "planlæg" når datoen er passeret.</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                        <button style={s.btnPrimary} onClick={() => saveEdit()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                        <div><div style={s.fieldLabel}>Alder</div><div style={{ fontSize: '0.9rem', color: '#b8b4a8' }}>{a.age ? a.age + ' år' : 'Ikke angivet'}</div></div>
                        <div><div style={s.fieldLabel}>Vægtklasse</div><div style={{ fontSize: '0.9rem', color: '#b8b4a8' }}>{a.weight_class ? a.weight_class + ' kg' : 'Ikke angivet'}</div></div>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.5rem' }}>Konkurrencemaks</div>
                      <div style={s.statRow}>
                        <div style={s.statCell}><div style={s.statNum}>{a.squat || 0}</div><div style={s.statLabel}>Squat</div></div>
                        <div style={s.statCell}><div style={s.statNum}>{a.bench || 0}</div><div style={s.statLabel}>Bænk</div></div>
                        <div style={s.statCell}><div style={s.statNum}>{a.deadlift || 0}</div><div style={s.statLabel}>Dødløft</div></div>
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>Træningsmaks</div>
                        <div style={s.statRow}>
                          <div style={s.statCell}><div style={s.statNum}>{a.training_squat || 0}</div><div style={s.statLabel}>Squat</div></div>
                          <div style={s.statCell}><div style={s.statNum}>{a.training_bench || 0}</div><div style={s.statLabel}>Bænk</div></div>
                          <div style={s.statCell}><div style={s.statNum}>{a.training_deadlift || 0}</div><div style={s.statLabel}>Dødløft</div></div>
                        </div>
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div><div style={s.fieldLabel}>Comp total</div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>{total} <span style={{ fontSize: '0.9rem', color: '#7a7770' }}>kg</span></div></div>
                        <div><div style={s.fieldLabel}>Trænings total</div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#7a7770' }}>{trainingTotal} <span style={{ fontSize: '0.9rem', color: '#4a4844' }}>kg</span></div></div>
                      </div>
                      {currentWeight !== null && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                          <div style={s.fieldLabel}>Aktuel kropsvægt</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>
                              {currentWeight} <span style={{ fontSize: '0.9rem', color: '#7a7770', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300 }}>kg</span>
                            </div>
                            {weightTrend !== null && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: weightTrend > 0 ? '#c8923a' : weightTrend < 0 ? '#6cba6c' : '#7a7770' }}>
                                {weightTrend > 0 ? '↑ +' : weightTrend < 0 ? '↓ ' : '→ '}{weightTrend}kg siden forrige uge
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={s.card}>
                  <div style={s.cardLabel}>Kostmål</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <div style={s.fieldLabel}>Dagligt kcal-mål</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: a.kcal_target ? '#edeae2' : '#4a4844' }}>{a.kcal_target || 'Ikke sat'} {a.kcal_target ? <span style={{ fontSize: '0.85rem', color: '#7a7770', fontFamily: 'sans-serif' }}>kcal</span> : ''}</div>
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Dagligt proteinmål</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: a.protein_target ? '#edeae2' : '#4a4844' }}>{a.protein_target || 'Ikke sat'} {a.protein_target ? <span style={{ fontSize: '0.85rem', color: '#7a7770', fontFamily: 'sans-serif', fontWeight: 300 }}>g</span> : ''}</div>
                    </div>
                    <button style={{ ...s.btnGhost, alignSelf: 'flex-start', marginTop: '0.5rem' }} onClick={() => { setActiveTab('kost'); setEditing('setup') }}>Rediger mål</button>
                  </div>
                </div>
              </div>

              {/* Competition date card */}
              <div style={{ ...s.card, marginTop: '1.5rem' }}>
                <div style={s.cardLabel}>
                  Næste stævne
                  {editing !== 'competition' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.btnEdit} onClick={() => openMeetResult()}>Registrér resultat</button>
                      <button style={s.btnEdit} onClick={() => startEdit('competition', { competition_date: a.competition_date || '' })}>
                        {a.competition_date ? 'Rediger' : 'Tilføj dato'}
                      </button>
                    </div>
                  )}
                </div>
                {editing === 'competition' ? (
                  <div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={s.fieldLabel}>Stævnedato</div>
                      <input style={s.fieldInput} type="date" value={editData.competition_date || ''} onChange={e => setEditData(prev => ({ ...prev, competition_date: e.target.value || null }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                      <button style={s.btnPrimary} onClick={() => saveEdit()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                    </div>
                  </div>
                ) : a.competition_date ? (() => {
                  const compMs = new Date(a.competition_date + 'T12:00:00') - new Date()
                  const weeksLeft = Math.ceil(compMs / (7 * 24 * 3600 * 1000))
                  return (
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '0.4rem' }}>
                        {new Date(a.competition_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: weeksLeft > 0 ? '#c8923a' : '#6cba6c', letterSpacing: '0.06em' }}>
                        {weeksLeft > 0 ? `${weeksLeft} uger til stævne` : 'Stævne passeret'}
                      </div>
                    </div>
                  )
                })() : (
                  <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen stævnedato sat endnu.</div>
                )}
              </div>

              <LazyBoundary
                factory={volumenKortFactory} label="Volumenkort" loading={<div style={s.page}>Indlæser…</div>}
                componentProps={{ athleteLogs, weeks, coachId: session.user.id }}
              />
              </div>
  )
}

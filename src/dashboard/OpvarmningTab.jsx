// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Opvarmning: atlet-specifik og standard opvarmning.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function OpvarmningTab({
  a, deleteWarmupTemplate, editingWarmup, saveWarmupTemplate, saving, setEditingWarmup,
  setWarmupDraftSteps, setWarmupNewStep, warmupDraftSteps, warmupNewStep, warmupTemplates,
}) {
              const CATEGORIES = ['Squat', 'Bænkpres', 'Dødløft']
              const athleteId = a.id

              function getTemplate(category, forAthleteId) {
                return warmupTemplates.find(t => t.exercise_category === category && t.athlete_id === forAthleteId)
              }

              function startEdit(category, forAthleteId) {
                const tpl = getTemplate(category, forAthleteId)
                setEditingWarmup({ category, athleteId: forAthleteId })
                setWarmupDraftSteps(tpl ? [...tpl.steps] : [])
                setWarmupNewStep('')
              }

              return (
                <div>
                  <div style={{ ...s.card, marginBottom: '0.5rem' }}>
                    <div style={s.cardLabel}>Atlet-specifik opvarmning — {a.name.split(' ')[0]}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>
                      Tilsidesætter standard. Vises til atleten når de åbner en session med det pågældende løft.
                    </div>
                    {CATEGORIES.map(category => {
                      const tpl = getTemplate(category, athleteId)
                      const stdTpl = getTemplate(category, null)
                      const isEditing = editingWarmup?.category === category && editingWarmup?.athleteId === athleteId
                      return (
                        <div key={category} style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#edeae2' }}>{category}</div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {tpl && !isEditing && (
                                <button style={s.btnDanger} onClick={() => deleteWarmupTemplate(tpl.id)}>Slet</button>
                              )}
                              {!isEditing && (
                                <button style={s.btnEdit} onClick={() => startEdit(category, athleteId)}>
                                  {tpl ? 'Rediger' : 'Opret'}
                                </button>
                              )}
                            </div>
                          </div>

                          {!isEditing && !tpl && stdTpl && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace', monospace", fontSize: '0.52rem', color: '#4a4844', fontStyle: 'italic' }}>Bruger standard ({stdTpl.steps.length} trin)</div>
                              <button style={s.btnEdit} onClick={() => { setEditingWarmup({ category, athleteId }); setWarmupDraftSteps([...stdTpl.steps]); setWarmupNewStep('') }}>Tilpas til atlet</button>
                            </div>
                          )}
                          {!isEditing && !tpl && !stdTpl && (
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen skabelon sat</div>
                          )}
                          {!isEditing && tpl && (
                            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                              {tpl.steps.map((step, i) => (
                                <li key={i} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8', marginBottom: '0.25rem' }}>{step}</li>
                              ))}
                            </ol>
                          )}

                          {isEditing && (
                            <div>
                              <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.2rem' }}>
                                {warmupDraftSteps.map((step, i) => (
                                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <span style={{ flex: 1, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8' }}>{step}</span>
                                    <button
                                      style={{ ...s.btnEdit, fontSize: '0.48rem', padding: '0.1rem 0.4rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.25)' }}
                                      onClick={() => setWarmupDraftSteps(prev => prev.filter((_, j) => j !== i))}
                                    >✕</button>
                                  </li>
                                ))}
                              </ol>
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <input
                                  style={{ ...s.fieldInput, flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                                  placeholder='F.eks. "Hip circles 2×10"'
                                  value={warmupNewStep}
                                  onChange={e => setWarmupNewStep(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && warmupNewStep.trim()) {
                                      setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()])
                                      setWarmupNewStep('')
                                    }
                                  }}
                                />
                                <button
                                  style={s.btnEdit}
                                  onClick={() => { if (warmupNewStep.trim()) { setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()]); setWarmupNewStep('') } }}
                                >+ Tilføj</button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button style={s.btnGhost} onClick={() => { setEditingWarmup(null); setWarmupNewStep('') }}>Annuller</button>
                                <button style={s.btnPrimary} onClick={() => saveWarmupTemplate(category, warmupDraftSteps, athleteId)} disabled={saving}>Gem</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={s.card}>
                    <div style={s.cardLabel}>Standard opvarmning — alle atleter</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>
                      Bruges hvis ingen atlet-specifik skabelon er sat.
                    </div>
                    {CATEGORIES.map(category => {
                      const stdTpl = getTemplate(category, null)
                      const isEditing = editingWarmup?.category === category && editingWarmup?.athleteId === null
                      return (
                        <div key={category} style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>{category}</div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {stdTpl && !isEditing && (
                                <button style={s.btnDanger} onClick={() => deleteWarmupTemplate(stdTpl.id)}>Slet</button>
                              )}
                              {!isEditing && (
                                <button style={s.btnEdit} onClick={() => { setEditingWarmup({ category, athleteId: null }); setWarmupDraftSteps(stdTpl ? [...stdTpl.steps] : []); setWarmupNewStep('') }}>
                                  {stdTpl ? 'Rediger' : 'Opret'}
                                </button>
                              )}
                            </div>
                          </div>
                          {!isEditing && !stdTpl && (
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen standard sat</div>
                          )}
                          {!isEditing && stdTpl && (
                            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                              {stdTpl.steps.map((step, i) => (
                                <li key={i} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8', marginBottom: '0.25rem' }}>{step}</li>
                              ))}
                            </ol>
                          )}
                          {isEditing && (
                            <div>
                              <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.2rem' }}>
                                {warmupDraftSteps.map((step, i) => (
                                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <span style={{ flex: 1, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8' }}>{step}</span>
                                    <button
                                      style={{ ...s.btnEdit, fontSize: '0.48rem', padding: '0.1rem 0.4rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.25)' }}
                                      onClick={() => setWarmupDraftSteps(prev => prev.filter((_, j) => j !== i))}
                                    >✕</button>
                                  </li>
                                ))}
                              </ol>
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <input
                                  style={{ ...s.fieldInput, flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                                  placeholder='F.eks. "Foam roll 5 min"'
                                  value={warmupNewStep}
                                  onChange={e => setWarmupNewStep(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && warmupNewStep.trim()) {
                                      setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()])
                                      setWarmupNewStep('')
                                    }
                                  }}
                                />
                                <button
                                  style={s.btnEdit}
                                  onClick={() => { if (warmupNewStep.trim()) { setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()]); setWarmupNewStep('') } }}
                                >+ Tilføj</button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button style={s.btnGhost} onClick={() => { setEditingWarmup(null); setWarmupNewStep('') }}>Annuller</button>
                                <button style={s.btnPrimary} onClick={() => saveWarmupTemplate(category, warmupDraftSteps, null)} disabled={saving}>Gem</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
}

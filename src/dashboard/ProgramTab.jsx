// Program-fanen (ugeplan, sessioner, øvelsesformular) — udskilt fra
// Dashboard.jsx (ordre 130 · commit 2) som sin egen lazy-loadede chunk, så
// atletlisten og check-in-gennemgangen ikke skal hente program-redigeringen
// for at boote. Ren udflytning af JSX'en fra "activeTab === 'program'"-
// blokken - ingen logikændring, kun frie variable gjort eksplicitte som props.
import { supabase } from '../supabase'
import { draftExerciseForForecast, FORECAST_FIELD_LABELS } from '../progressionDraft'
import { blockPurpose, withBlockPurposes } from '../periodizationAssistant'
import { targetPrescriptionForExercise } from '../../supabase/functions/_shared/progressionState.js'
import { BLOCK_NAMES, BLOCK_PRESETS, blockColor, computePhases, currentWeekNo, WEEKDAYS_LONG, s } from '../dashboardShared'

export default function ProgramTab({
  addExercise, addingExercise, addingSession, addingWeek, addSession, addWeek,
  applyPeriodizationSuggestion,
  approveDraftProgressionState, approvingProgression, assignEdits, athleteLogs, bestLog,
  blockPlan, copyExerciseToSession, copyingExercise, copyingSession, copySessionToWeek, copyWeek,
  deleteExercise, deleteSession, deleteWeek, editDraftForecast, editingExercise, editingRecommended,
  editingSession, editingWeek, exFormRow, fetchWeeks, generateWeeksFromPlan, gotoWeek, isMobile,
  openSessionId, openWeekId, parseIntensity, planAssistantFocus, planStartDate, programActiveStart,
  programBlockStart, programShownWeeks, recommendedInput, renameValue, renamingBlock, reorderExercise, reorderSession,
  saveRecommendedWeight, selectedAthlete, sendingDraft, sessionForm, sessionLogStatus, setAddingExercise,
  setAddingSession, setAddingWeek, setAssignEdits, setBlockPlan, setCopyingExercise,
  setCopyingSession, setDraftForecastOverrideReason, setEditingExercise, setEditingRecommended,
  setEditingSession, setEditingWeek, setExerciseForm, setOpenSessionId, setOpenWeekId,
  setPlanAssistantFocus, setPlanStartDate, setProgramBlockStart, setRecommendedInput,
  setRenameValue, setRenamingBlock, setSendingDraft, setSessionForm, setShowBlockPlanner,
  setWeekDraft, setWeekForm, showBlockPlanner, showFlash, updateExercise, updateSession,
  updateWeek, weekdayPicker, weekDraft, weekForm, weeks,
}) {
  return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a7770' }}>
                    {weeks.length} uge{weeks.length !== 1 ? 'r' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ ...s.btnGhost, color: showBlockPlanner ? '#c8923a' : '#7a7770', borderColor: showBlockPlanner ? 'rgba(200,146,58,0.4)' : undefined }} onClick={() => {
                      if (!showBlockPlanner) {
                        const weeksWithDate = weeks.filter(w => w.start_date).sort((a, b) => b.week_number - a.week_number)
                        const suggestDate = weeksWithDate.length
                          ? new Date(new Date(weeksWithDate[0].start_date + 'T12:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
                          : new Date().toISOString().slice(0, 10)
                        setPlanStartDate(suggestDate)
                        setAssignEdits(Object.fromEntries(weeks.map(w => [w.id, w.block_name || ''])))
                      }
                      setShowBlockPlanner(p => !p)
                    }}>
                      Periodiseringsplan
                    </button>
                    {weeks.length > 0 && (
                      <button style={s.btnGhost} onClick={() => copyWeek(weeks[weeks.length - 1].id)}>
                        Kopiér seneste uge →
                      </button>
                    )}
                    {weeks.length > 0 && (
                      <button
                        style={{ ...s.btnGhost, color: weekDraft ? '#c8923a' : '#7a7770', borderColor: weekDraft ? 'rgba(200,146,58,0.4)' : undefined }}
                        disabled={weekDraft?.loading}
                        onClick={async () => {
                          if (weekDraft) { setWeekDraft(null); return }
                          setWeekDraft({ loading: true })
                          const { data, error } = await supabase.functions.invoke('draft-next-week', {
                            body: { mode: 'preview', athlete_id: selectedAthlete.id },
                          })
                          if (error || data?.error) {
                            let msg = data?.error || error?.message || 'Ukendt fejl'
                            try { const body = await error?.context?.json(); if (body?.error) msg = body.error } catch { /* behold msg */ }
                            setWeekDraft({ error: msg })
                          } else setWeekDraft({ data })
                        }}
                      >
                        {weekDraft?.loading ? 'Genererer…' : '⚡ Generér næste uge'}
                      </button>
                    )}
                    <button style={s.btnPrimary} onClick={() => {
                      const weeksWithDate = weeks.filter(w => w.start_date).sort((a, b) => b.week_number - a.week_number)
                      const suggestDate = weeksWithDate.length
                        ? new Date(new Date(weeksWithDate[0].start_date + 'T12:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                      setAddingWeek(true)
                      setWeekForm({ week_number: '', block_name: '', coach_note: '', block_description: '', start_date: suggestDate })
                    }}>
                      + Ny uge
                    </button>
                  </div>
                </div>

                {/* Auto-udkast panel (draft-next-week edge function) */}
                {weekDraft && !weekDraft.loading && (
                  <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                    {weekDraft.error ? (
                      <>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#e05555', lineHeight: 1.6, marginBottom: '0.75rem' }}>{weekDraft.error}</div>
                        <button style={s.btnGhost} onClick={() => setWeekDraft(null)}>Luk</button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>
                          Udkast: uge {weekDraft.data.draft.p_payload.week} · start {weekDraft.data.draft.start_date}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', marginBottom: '0.85rem' }}>
                          Kopieret fra uge {weekDraft.data.source_week.week_number} ({weekDraft.data.source_week.block_name || 'uden blok'})
                          {' · '}{weekDraft.data.draft.p_payload.sessions.length} sessioner
                        </div>
                        {weekDraft.data.planned_target && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#6cba6c', lineHeight: 1.5, marginTop: '-0.45rem', marginBottom: '0.85rem' }}>
                            Planlagt måluge · {weekDraft.data.planned_target.block_name || 'uden blok'}
                            {weekDraft.data.planned_target.block_description ? ` — ${weekDraft.data.planned_target.block_description}` : ''}
                          </div>
                        )}
                        {weekDraft.data.progression && (() => {
                          const progression = weekDraft.data.progression
                          const proposal = progression.proposal
                          const forecastState = progression.display_state || proposal
                          const forecast = forecastState?.expected_progression?.exercises || []
                          const statusLabel = progression.status === 'approved_for_draft'
                            ? 'Godkendt for dette udkast'
                            : progression.status === 'approval_required'
                              ? 'Kræver godkendelse'
                              : 'Mangler kontekst'
                           const decisionLabel = {
                             increase: 'stigning', decrease: 'reduktion', repeat: 'gentag', hold: 'hold', manual_load: 'manuel vægt',
                           }
                           return (
                             <div style={{ marginBottom: '0.85rem', padding: '0.75rem', border: '1px solid rgba(200,146,58,0.28)', background: 'rgba(200,146,58,0.06)' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.42rem' }}>
                                 <div style={{ ...s.fieldLabel, color: '#c8923a' }}>Forventet progression</div>
                                 <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: progression.can_commit ? '#6cba6c' : '#c8923a' }}>{statusLabel}</div>
                               </div>
                               <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', lineHeight: 1.45, marginBottom: '0.6rem' }}>
                                 Ret kladden her. En manuel ændring kræver begrundelse og ny godkendelse, før den kan sendes.
                               </div>
                               {progression.reasons?.map((reason, index) => (
                                 <div key={index} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#c8923a', lineHeight: 1.55, marginBottom: '0.28rem' }}>⚠ {reason}</div>
                               ))}
                               {progression.approval_error && (
                                 <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#e05555', lineHeight: 1.55, marginBottom: '0.28rem' }}>{progression.approval_error}</div>
                               )}
                               {forecast.map(item => {
                                 const draftExercise = draftExerciseForForecast(weekDraft.data.draft.p_payload, item.key)
                                 if (!draftExercise) return null
                                 const prescription = item.expected?.prescription || targetPrescriptionForExercise(draftExercise)
                                 const override = item.override
                                 const missingReason = override && !String(override.reason || '').trim()
                                 return (
                                   <div key={item.key} style={{ padding: '0.65rem 0', borderTop: '1px solid rgba(237,234,226,0.08)' }}>
                                     <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#d8d4ca', lineHeight: 1.55, marginBottom: '0.45rem' }}>
                                       {item.session_label}: {item.exercise_name} · {decisionLabel[item.expected?.decision] || 'review'}
                                     </div>
                                     <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(88px, 1fr))', gap: '0.45rem' }}>
                                       <label style={{ ...s.fieldLabel, color: '#7a7770' }}>Sæt
                                         <input style={{ ...s.fieldInput, marginTop: '0.2rem', padding: '0.35rem 0.45rem' }} type="number" min="1" step="1" value={prescription.set_count} disabled={approvingProgression} onChange={e => editDraftForecast(item.key, 'sets', e.target.value)} />
                                       </label>
                                       <label style={{ ...s.fieldLabel, color: '#7a7770' }}>Reps
                                         <input style={{ ...s.fieldInput, marginTop: '0.2rem', padding: '0.35rem 0.45rem' }} value={prescription.reps || ''} disabled={approvingProgression} onChange={e => editDraftForecast(item.key, 'reps', e.target.value)} />
                                       </label>
                                       <label style={{ ...s.fieldLabel, color: '#7a7770' }}>Vægt (kg)
                                         <input style={{ ...s.fieldInput, marginTop: '0.2rem', padding: '0.35rem 0.45rem' }} type="number" min="0" step="0.5" value={prescription.load_kg ?? ''} disabled={approvingProgression} onChange={e => editDraftForecast(item.key, 'load_kg', e.target.value)} />
                                       </label>
                                       <label style={{ ...s.fieldLabel, color: '#7a7770' }}>RPE
                                         <input style={{ ...s.fieldInput, marginTop: '0.2rem', padding: '0.35rem 0.45rem' }} type="number" min="0" max="10" step="0.5" value={prescription.rpe_target ?? ''} disabled={approvingProgression} onChange={e => editDraftForecast(item.key, 'rpe_target', e.target.value)} />
                                       </label>
                                     </div>
                                     {override && (
                                       <div style={{ marginTop: '0.5rem' }}>
                                         <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                           Manuel ændring: {override.fields.map(field => FORECAST_FIELD_LABELS[field]).join(', ')}
                                         </div>
                                         <input
                                           style={{ ...s.fieldInput, borderColor: missingReason ? 'rgba(224,85,85,0.72)' : undefined, padding: '0.4rem 0.5rem' }}
                                           placeholder="Begrundelse for ændringen"
                                           value={override.reason || ''}
                                           disabled={approvingProgression}
                                           onChange={e => setDraftForecastOverrideReason(item.key, e.target.value)}
                                         />
                                         {missingReason && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#e05555', marginTop: '0.2rem' }}>Begrundelse kræves før godkendelse.</div>}
                                       </div>
                                     )}
                                   </div>
                                 )
                               })}
                              {progression.status === 'approval_required' && proposal && (
                                <button style={{ ...s.btnGhost, marginTop: '0.6rem' }} disabled={approvingProgression} onClick={approveDraftProgressionState}>
                                  {approvingProgression ? 'Godkender…' : 'Godkend progressionstilstand'}
                                </button>
                              )}
                              {!progression.can_commit && (
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', marginTop: '0.5rem', lineHeight: 1.45 }}>Ugen kan ikke sendes, før forventningen er komplet og godkendt.</div>
                              )}
                            </div>
                          )
                        })()}
                        {weekDraft.data.changes.length > 0 ? (
                          <div style={{ marginBottom: '0.85rem' }}>
                            <div style={{ ...s.fieldLabel, marginBottom: '0.4rem' }}>Automatiske justeringer</div>
                            {weekDraft.data.changes.map((c, i) => (
                              <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#edeae2', lineHeight: 1.7 }}>• {c}</div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', marginBottom: '0.85rem' }}>Ingen automatiske justeringer — ren kopi af kildeugen.</div>
                        )}
                        {weekDraft.data.warnings.length > 0 && (
                          <div style={{ marginBottom: '0.85rem' }}>
                            {weekDraft.data.warnings.map((w, i) => (
                              <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', lineHeight: 1.7 }}>⚠ {w}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={s.btnPrimary} disabled={sendingDraft || weekDraft.data.progression?.can_commit !== true} onClick={async () => {
                            if (weekDraft.data.progression?.can_commit !== true) return
                            setSendingDraft(true)
                            const { data, error } = await supabase.functions.invoke('draft-next-week', {
                              body: { mode: 'commit', athlete_id: selectedAthlete.id, payload: weekDraft.data.draft },
                            })
                            setSendingDraft(false)
                            if (error || data?.error) {
                              let msg = data?.error || error?.message || 'Ukendt fejl'
                              try { const body = await error?.context?.json(); if (body?.error) msg = body.error } catch { /* behold msg */ }
                              setWeekDraft({ error: msg })
                              return
                            }
                            if (data?.progression_warning) showFlash(data.progression_warning, 'warning')
                            else if (data?.planned_week) showFlash(`Planlagt uge ${data.week_number} er udfyldt`, 'success')
                            else showFlash(`Uge ${data?.week_number || ''} er oprettet`, 'success')
                            setWeekDraft(null)
                            fetchWeeks(selectedAthlete.id)
                          }}>
                            {sendingDraft ? 'Sender…' : weekDraft.data.draft.target_week_id ? 'Udfyld planlagt uge' : 'Send til atleten'}
                          </button>
                          <button style={s.btnGhost} disabled={sendingDraft} onClick={() => setWeekDraft(null)}>Annuller</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Periodiseringsplan panel */}
                {showBlockPlanner && (() => {
                  const totalWeeks = blockPlan.reduce((s, b) => s + (b.weeks || 0), 0)
                  const endDate = totalWeeks > 0 && planStartDate
                    ? new Date(new Date(planStartDate + 'T12:00:00').getTime() + totalWeeks * 7 * 24 * 3600 * 1000 - 24 * 3600 * 1000)
                    : null
                  const compDate = selectedAthlete?.competition_date
                  const compDateObj = compDate ? new Date(compDate + 'T12:00:00') : null
                  const diffDays = endDate && compDateObj ? Math.round((compDateObj - endDate) / (24 * 3600 * 1000)) : null
                  const fmtD = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
                  const fmtShort = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                  return (
                    <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1rem' }}>Periodiseringsplan</div>

                      {/* Planassistent: udfylder kun det lokale blokudkast. Oprettelse sker altid separat nederst. */}
                      <div style={{ marginBottom: '1.25rem', padding: '0.85rem', border: '1px solid rgba(200,146,58,0.24)', background: 'rgba(200,146,58,0.055)' }}>
                        <div style={{ ...s.fieldLabel, marginBottom: '0.3rem', color: '#c8923a' }}>Planassistent — udkast</div>
                        <div style={{ fontSize: '0.68rem', color: '#98948a', lineHeight: 1.45, marginBottom: '0.65rem' }}>Laver kun et redigerbart blokudkast. Uger oprettes først nederst, når du vælger det.</div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <select value={planAssistantFocus} onChange={e => setPlanAssistantFocus(e.target.value)} style={{ ...s.fieldSelect, minWidth: '142px', padding: '0.4rem 0.55rem', fontSize: '0.65rem' }}>
                            <option value="competition">Mod stævne</option>
                            <option value="strength">Grundstyrke</option>
                            <option value="offseason">Off-season</option>
                          </select>
                          <button style={{ ...s.btnGhost, fontSize: '0.56rem', padding: '0.4rem 0.7rem' }} onClick={applyPeriodizationSuggestion}>Lav forslag</button>
                          {planAssistantFocus === 'competition' && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: compDate ? '#7a7770' : '#b36a58' }}>{compDate ? `Stævne: ${new Date(compDate + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Mangler stævnedato'}</span>}
                        </div>
                      </div>

                      {/* Skabeloner — hurtig-start, form videre efter behov */}
                      <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                        <div style={{ ...s.fieldLabel, marginBottom: '0.5rem' }}>Skabelon — hurtig-start</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {BLOCK_PRESETS.map(preset => (
                            <button
                              key={preset.label}
                              onClick={() => setBlockPlan(withBlockPurposes(preset.blocks).map((b, i) => ({ id: Date.now() + i, ...b })))}
                              style={{ ...s.btnGhost, fontSize: '0.56rem', padding: '0.4rem 0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', lineHeight: 1.2 }}
                            >
                              <span style={{ color: '#b8b4a8' }}>{preset.label}</span>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#7a7770', letterSpacing: '0.04em' }}>{preset.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Eksisterende uger — tilknyt blokke */}
                      {weeks.length > 0 && (
                        <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                          <div style={{ ...s.fieldLabel, marginBottom: '0.6rem' }}>Tilknyt blok til eksisterende uger</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                            {weeks.map(w => (
                              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', minWidth: '52px' }}>Uge {w.week_number}</span>
                                {w.start_date && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', minWidth: '80px' }}>{new Date(w.start_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
                                <select
                                  value={assignEdits[w.id] ?? w.block_name ?? ''}
                                  onChange={e => setAssignEdits(p => ({ ...p, [w.id]: e.target.value }))}
                                  style={{ ...s.fieldSelect, padding: '0.25rem 0.5rem', fontSize: '0.62rem', flex: 1, maxWidth: '180px' }}
                                >
                                  <option value="">— ingen blok —</option>
                                  {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                          <button style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.75rem' }} onClick={async () => {
                            await Promise.all(weeks.map(w => {
                              const newName = assignEdits[w.id] !== undefined ? (assignEdits[w.id] || null) : (w.block_name || null)
                              if (newName === (w.block_name || null)) return Promise.resolve()
                              return supabase.from('weeks').update({ block_name: newName }).eq('id', w.id)
                            }))
                            fetchWeeks(selectedAthlete.id)
                          }}>Gem tilknytninger</button>
                        </div>
                      )}

                      <div style={{ marginBottom: '1rem' }}>
                        <div style={s.fieldLabel}>Nye uger — startdato{weeks.length > 0 && <span style={{ color: '#4a4844', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (fortsætter fra uge {Math.max(...weeks.map(w => w.week_number)) + 1})</span>}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <input style={{ ...s.fieldInput, maxWidth: '180px' }} type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} />
                          {/* Regn baglæns: sæt startdato så planen slutter ugen før stævnet.
                              Snap til mandag, så uge 1 starter på en normal træningsuge. */}
                          {compDate && totalWeeks > 0 && (
                            <button
                              style={{ ...s.btnGhost, fontSize: '0.54rem', padding: '0.4rem 0.75rem' }}
                              onClick={() => {
                                const comp = new Date(compDate + 'T12:00:00')
                                const start = new Date(comp.getTime() - totalWeeks * 7 * 24 * 3600 * 1000)
                                const dow = (start.getDay() + 6) % 7 // 0=mandag
                                start.setDate(start.getDate() - dow) // snap tilbage til mandag
                                setPlanStartDate(start.toISOString().slice(0, 10))
                              }}
                            >← Regn baglæns fra stævne</button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        {blockPlan.map((block, i) => (
                          <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: blockColor(block.name), flexShrink: 0 }} />
                            <select
                              value={block.name}
                              onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, name: e.target.value, description: blockPurpose(e.target.value) } : b))}
                              style={{ ...s.fieldSelect, width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
                            >
                              {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                type="number" min="1" max="20"
                                value={block.weeks}
                                onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, weeks: Math.max(1, parseInt(e.target.value) || 1) } : b))}
                                style={{ ...s.fieldInput, width: '52px', padding: '0.35rem 0.5rem', fontSize: '0.72rem', textAlign: 'center' }}
                              />
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>uge{block.weeks !== 1 ? 'r' : ''}</span>
                            </div>
                            <button onClick={() => setBlockPlan(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>✕</button>
                          </div>
                        ))}
                        <button
                          onClick={() => setBlockPlan(p => [...p, { id: Date.now(), name: BLOCK_NAMES[0], weeks: 2, description: blockPurpose(BLOCK_NAMES[0]) }])}
                          style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}
                        >+ Tilføj blok</button>
                      </div>

                      {/* Tidslinje */}
                      {totalWeeks > 0 && planStartDate && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', width: '100%', height: '32px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                            {blockPlan.map((block) => {
                              const pct = (block.weeks / totalWeeks) * 100
                              return (
                                <div key={block.id} title={`${block.name}: ${block.weeks} uge${block.weeks !== 1 ? 'r' : ''}`}
                                  style={{ width: `${pct}%`, flexShrink: 0, background: blockColor(block.name), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {block.weeks >= 2 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#141410', fontWeight: 600, letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>{block.name}</span>}
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770' }}>{fmtShort(new Date(planStartDate + 'T12:00:00'))}</span>
                            {endDate && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770' }}>slutter {fmtShort(endDate)}</span>}
                          </div>
                        </div>
                      )}

                      {/* Status */}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', marginBottom: '1rem' }}>
                        <span style={{ color: '#7a7770' }}>Total: {totalWeeks} uger</span>
                        {endDate && <span style={{ color: '#7a7770' }}> · slutter {fmtD(endDate)}</span>}
                        {diffDays != null && (
                          <span style={{ marginLeft: '0.75rem', color: diffDays >= 0 ? '#6cba6c' : '#e05555', fontWeight: 600 }}>
                            {diffDays >= 0 ? `✓ ${diffDays} dage før stævne` : `⚠ ${Math.abs(diffDays)} dage efter stævne`}
                          </span>
                        )}
                        {!compDate && <span style={{ color: '#4a4844', marginLeft: '0.75rem' }}>— sæt stævnedato i Oversigt for tjek</span>}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button style={s.btnGhost} onClick={() => setShowBlockPlanner(false)}>Luk</button>
                        <button style={s.btnPrimary} onClick={generateWeeksFromPlan} disabled={!planStartDate || totalWeeks === 0}>
                          Opret {totalWeeks} uger
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Block overview grid */}
                {weeks.length > 0 && (() => {
                  const compDate = selectedAthlete?.competition_date
                  const compMs = compDate ? new Date(compDate + 'T12:00:00') - new Date() : null
                  const weeksToComp = compMs != null ? Math.ceil(compMs / (7 * 24 * 3600 * 1000)) : null
                  const latestWeekNum = weeks[weeks.length - 1]?.week_number
                  const compWeekNum = weeksToComp != null ? latestWeekNum + weeksToComp - 1 : null

                  const complianceByWeekNum = {}
                  for (const log of athleteLogs) {
                    const wn = log.exercises?.sessions?.weeks?.week_number
                    if (wn == null || log.skipped) continue
                    complianceByWeekNum[wn] = (complianceByWeekNum[wn] || 0) + 1
                  }
                  const totalSetsByWeekNum = {}
                  for (const week of weeks) {
                    totalSetsByWeekNum[week.week_number] = (week.sessions || [])
                      .flatMap(s => s.exercises || [])
                      .reduce((acc, e) => acc + (e.sets || 0), 0)
                  }

                  // Højeste ugenummer atleten faktisk har logget i = den uge de
                  // træner nu. Driver blok-fremdrift uafhængigt af start_date/sets
                  // (som ofte mangler), hvor den gamle rene dato-logik fejlede.
                  const loggedWeekNums = weeks.map(w => w.week_number).filter(wn => (complianceByWeekNum[wn] || 0) > 0)
                  const maxLoggedWk = loggedWeekNums.length ? Math.max(...loggedWeekNums) : null
                  // Foretræk daterede uger (samme "nu" som kalender + atlet); ellers logget fremdrift.
                  const currentWk = currentWeekNo(weeks, maxLoggedWk)

                  const phases = computePhases(weeks)

                  return (
                    <div style={{ marginBottom: '1.5rem' }}>
                      {compDate && weeksToComp != null && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: weeksToComp > 0 ? '#c8923a' : '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                          {weeksToComp > 0 ? `${weeksToComp} uger til stævne` : 'Stævne passeret'} · {new Date(compDate + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}

                      {/* Blok-tidslinje (overblik) */}
                      {phases.some(p => p.name) && (() => {
                        const today = new Date(); today.setHours(12, 0, 0, 0)
                        const fmt = ds => new Date(ds + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                        return (
                          <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.6rem' }}>
                            Periodisering · klik ✎ for at omdøbe blok
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            {phases.map((phase, pi) => {
                              const color = phase.name ? blockColor(phase.name) : '#7a7770'
                              const first = phase.weeks[0]
                              const last = phase.weeks[phase.weeks.length - 1]
                              const range = first.week_number === last.week_number
                                ? `uge ${first.week_number}`
                                : `uge ${first.week_number}–${last.week_number}`
                              const fd = first.start_date, ld = last.start_date
                              const dates = fd && ld
                                ? `${fmt(fd)} – ${fmt(new Date(new Date(ld + 'T12:00:00').getTime() + 6 * 86400000).toISOString().slice(0, 10))}`
                                : null
                              let isDone = false, isActive = false
                              if (currentWk != null) {
                                // Nuværende uge (dato-foretrukket, ellers logget fremdrift).
                                // Forbi blokken = fuldført; uge i blokken = aktiv.
                                isDone = last.week_number < currentWk
                                isActive = first.week_number <= currentWk && currentWk <= last.week_number
                              } else if (fd && ld) {
                                // Ingen logs endnu → fald tilbage til datoer hvis sat.
                                const blockStart = new Date(fd + 'T12:00:00')
                                const blockEnd = new Date(new Date(ld + 'T12:00:00').getTime() + 7 * 86400000)
                                isDone = today >= blockEnd
                                isActive = today >= blockStart && today < blockEnd
                              }
                              return (
                                <div
                                  key={pi}
                                  onClick={() => gotoWeek(first)}
                                  style={{
                                    minWidth: '128px', flexShrink: 0, cursor: 'pointer',
                                    background: isActive ? color + '1f' : '#1c1c18',
                                    border: `1px solid ${isActive ? color : isDone ? color + '55' : 'rgba(237,234,226,0.08)'}`,
                                    borderLeft: `3px solid ${phase.name ? color : 'rgba(237,234,226,0.15)'}`,
                                    padding: '0.7rem 0.8rem',
                                    opacity: !phase.name || (!isActive && !isDone) ? 0.78 : 1,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    {renamingBlock === first.id ? (
                                      <input
                                        autoFocus
                                        value={renameValue}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRenamingBlock(null) }}
                                        onBlur={async () => {
                                          const name = renameValue.trim() || null
                                          setRenamingBlock(null)
                                          if (name !== (phase.name || null)) {
                                            await supabase.from('weeks').update({ block_name: name }).in('id', phase.weeks.map(w => w.id))
                                            fetchWeeks(selectedAthlete.id)
                                          }
                                        }}
                                        style={{ flex: 1, minWidth: 0, background: '#141410', border: `1px solid ${color}`, color: '#edeae2', fontSize: '0.78rem', padding: '2px 5px' }}
                                      />
                                    ) : (
                                      <>
                                        <span style={{ fontSize: '0.82rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{phase.name || 'Uden blok'}</span>
                                        {isDone && <span style={{ color, fontSize: '0.6rem', lineHeight: 1 }}>✓</span>}
                                        {isActive && (
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.1em', textTransform: 'uppercase', color, border: `1px solid ${color}`, padding: '1px 4px', borderRadius: '2px' }}>nu</span>
                                        )}
                                        <button
                                          onClick={e => { e.stopPropagation(); setRenameValue(phase.name || ''); setRenamingBlock(first.id) }}
                                          title="Omdøb blok"
                                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px', flexShrink: 0 }}
                                        >✎</button>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7770' }}>
                                    {range} · {phase.weeks.length}u
                                  </div>
                                  {dates && (
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#4a4844', marginTop: '0.18rem' }}>{dates}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          </div>
                        )
                      })()}

                      {/* Periodiserings-graf: volumen (søjler) + intensitet (linje) */}
                      {weeks.length >= 2 && (() => {
                        const today = new Date(); today.setHours(12, 0, 0, 0)
                        const weekData = weeks.map(w => {
                          const exs = (w.sessions || []).flatMap(s => s.exercises || [])
                          const sets = exs.reduce((a, e) => a + (e.sets || 0), 0)
                          let rpeSum = 0, rpeSets = 0
                          for (const e of exs) {
                            const txt = /rpe/i.test(e.intensity || '') ? e.intensity : ''
                            const m = /([0-9]+(?:[.,][0-9]+)?)/.exec(txt || '')
                            if (m && e.sets) { rpeSum += parseFloat(m[1].replace(',', '.')) * e.sets; rpeSets += e.sets }
                          }
                          let active = false
                          if (w.start_date) {
                            const ws = new Date(w.start_date + 'T12:00:00')
                            active = today >= ws && today < new Date(ws.getTime() + 7 * 86400000)
                          }
                          return { w, sets, avgRpe: rpeSets ? rpeSum / rpeSets : null, color: w.block_name ? blockColor(w.block_name) : '#7a7770', active }
                        })
                        const n = weekData.length
                        const hasRpe = weekData.some(d => d.avgRpe != null)
                        const maxSets = Math.max(1, ...weekData.map(d => d.sets))
                        const PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 18
                        const colW = 40, H = 150
                        const W = PAD_L + PAD_R + n * colW
                        const chartH = H - PAD_T - PAD_B
                        const rpeMin = 5, rpeMax = 10
                        const cx = i => PAD_L + i * colW + colW / 2
                        const barW = Math.min(22, colW * 0.5)
                        const yVol = v => PAD_T + chartH * (1 - v / maxSets)
                        const yRpe = r => PAD_T + chartH * (1 - (Math.min(rpeMax, Math.max(rpeMin, r)) - rpeMin) / (rpeMax - rpeMin))
                        const rpePts = weekData.map((d, i) => d.avgRpe != null ? `${cx(i)},${yRpe(d.avgRpe)}` : null).filter(Boolean).join(' ')

                        return (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844' }}>Volumen &amp; intensitet</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#7a7770' }}>
                                <span style={{ width: '8px', height: '8px', background: 'rgba(237,234,226,0.3)' }} /> sæt/uge
                              </span>
                              {hasRpe && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#7a7770' }}>
                                  <span style={{ width: '12px', height: '2px', background: '#c8923a' }} /> ø RPE
                                </span>
                              )}
                            </div>
                            <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
                              <svg viewBox={`0 0 ${W} ${H}`} width={n > 8 ? W : '100%'} height={H} preserveAspectRatio="xMinYMid meet" style={{ display: 'block', maxWidth: '100%' }}>
                                {/* baseline */}
                                <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="rgba(237,234,226,0.12)" strokeWidth="1" />
                                {/* volume bars */}
                                {weekData.map((d, i) => {
                                  const h = chartH * d.sets / maxSets
                                  return (
                                    <g key={d.w.id}>
                                      <rect
                                        x={cx(i) - barW / 2} y={yVol(d.sets)} width={barW} height={h}
                                        fill={d.color + (d.active ? 'dd' : '66')}
                                        stroke={d.active ? d.color : 'none'} strokeWidth={d.active ? 1.5 : 0}
                                        rx="2"
                                      />
                                      <text x={cx(i)} y={PAD_T + chartH + 12} textAnchor="middle" fontSize="7" fill={d.active ? '#c8923a' : '#7a7770'} fontFamily="'IBM Plex Mono', monospace">{d.w.week_number}</text>
                                    </g>
                                  )
                                })}
                                {/* intensity line */}
                                {hasRpe && rpePts && (
                                  <polyline points={rpePts} fill="none" stroke="#c8923a" strokeWidth="1.5" strokeLinejoin="round" />
                                )}
                                {hasRpe && weekData.map((d, i) => d.avgRpe != null && (
                                  <circle key={'c' + d.w.id} cx={cx(i)} cy={yRpe(d.avgRpe)} r={d.active ? 3 : 2.2} fill="#1c1c18" stroke="#c8923a" strokeWidth="1.5" />
                                ))}
                              </svg>
                            </div>
                          </div>
                        )
                      })()}

                      <div style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem', width: '100%' }}>
                        {weeks.map(week => {
                          const isLatest = week.week_number === latestWeekNum
                          const isCompWeek = compWeekNum != null && week.week_number === compWeekNum
                          const isPostComp = compWeekNum != null && week.week_number > compWeekNum
                          const logged = complianceByWeekNum[week.week_number] || 0
                          const total = totalSetsByWeekNum[week.week_number] || 0
                          const pct = total > 0 && logged > 0 ? Math.round(logged / total * 100) : null
                          const pctColor = pct == null ? '#4a4844' : pct >= 80 ? '#6cba6c' : pct >= 50 ? '#c8923a' : '#e05555'
                          return (
                            <div
                              key={week.id}
                              style={{
                                minWidth: '90px', flexShrink: 0,
                                background: isLatest ? 'rgba(200,146,58,0.1)' : '#1c1c18',
                                border: `1px solid ${isLatest ? '#c8923a' : isCompWeek ? 'rgba(108,186,108,0.5)' : 'rgba(237,234,226,0.07)'}`,
                                padding: '0.65rem 0.75rem',
                                cursor: 'pointer',
                                opacity: isPostComp ? 0.35 : 1,
                              }}
                              onClick={() => gotoWeek(week)}
                            >
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isLatest ? '#c8923a' : '#7a7770', marginBottom: '0.2rem' }}>
                                UGE {week.week_number}{isCompWeek ? ' 🏆' : ''}
                              </div>
                              {week.block_name && (
                                <div style={{ fontSize: '0.76rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{week.block_name}</div>
                              )}
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', marginTop: '0.25rem' }}>{week.sessions?.length || 0} træninger</div>
                              {pct != null && (
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: pctColor, marginTop: '0.2rem' }}>{pct}%</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Add week form */}
                {addingWeek && (
                  <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>Ny uge</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.5fr 1fr 1fr 1.5fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={s.fieldLabel}>Uge nr.</div>
                        <input style={s.fieldInput} type="number" placeholder="Auto" value={weekForm.week_number} onChange={e => setWeekForm(p => ({ ...p, week_number: e.target.value }))} />
                      </div>
                      <div>
                        <div style={s.fieldLabel}>Startdato</div>
                        <input style={s.fieldInput} type="date" value={weekForm.start_date} onChange={e => setWeekForm(p => ({ ...p, start_date: e.target.value }))} />
                      </div>
                      <div>
                        <div style={s.fieldLabel}>Blok</div>
                        <input style={s.fieldInput} list="block-names-list" placeholder="Vælg blok…" value={weekForm.block_name} onChange={e => setWeekForm(p => ({ ...p, block_name: e.target.value }))} />
                        <datalist id="block-names-list">{BLOCK_NAMES.map(n => <option key={n} value={n} />)}</datalist>
                      </div>
                      <div>
                        <div style={s.fieldLabel}>Coach-note</div>
                        <input style={s.fieldInput} type="text" placeholder="Note…" value={weekForm.coach_note} onChange={e => setWeekForm(p => ({ ...p, coach_note: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={s.fieldLabel}>Blok-beskrivelse</div>
                      <textarea style={{ ...s.fieldInput, minHeight: '72px', resize: 'vertical', lineHeight: 1.5 }} placeholder="Forklar formålet med denne blok…" value={weekForm.block_description} onChange={e => setWeekForm(p => ({ ...p, block_description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.btnGhost} onClick={() => setAddingWeek(false)}>Annuller</button>
                      <button style={s.btnPrimary} onClick={addWeek}>Tilføj uge</button>
                    </div>
                  </div>
                )}

                {weeks.length === 0 && !addingWeek && (
                  <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2rem 0' }}>
                    Ingen uger endnu — tilføj den første
                  </div>
                )}

                {/* Blok-faner: vis kun én bloks uger ad gangen, så listen ikke bliver uoverskuelig */}
                {weeks.length > 0 && (() => {
                  const phases = computePhases(weeks)
                  if (phases.length <= 1 && programBlockStart !== 'all') return null // kun én blok → ingen grund til faner
                  const active = programActiveStart()
                  const chip = (key, label, isActive, color) => (
                    <button key={key} onClick={() => { setProgramBlockStart(key); setOpenWeekId(null) }}
                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em', padding: '0.4rem 0.7rem', cursor: 'pointer',
                        background: isActive ? (color ? color + '22' : 'rgba(200,146,58,0.15)') : 'transparent',
                        border: `1px solid ${isActive ? (color ? color + '88' : 'rgba(200,146,58,0.5)') : 'rgba(237,234,226,0.12)'}`,
                        color: isActive ? (color || '#c8923a') : '#7a7770' }}>{label}</button>
                  )
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      {phases.map((phase) => {
                        const start = phase.weeks[0].week_number
                        const end = phase.weeks[phase.weeks.length - 1].week_number
                        const range = start === end ? `uge ${start}` : `uge ${start}–${end}`
                        return chip(start, `${phase.name || 'Uden blok'} · ${range}`, active === start, phase.name ? blockColor(phase.name) : null)
                      })}
                      {chip('all', `Alle (${weeks.length})`, programBlockStart === 'all', null)}
                    </div>
                  )
                })()}

                {programShownWeeks().map(week => (
                  <div key={week.id} id={`week-row-${week.id}`} style={{ marginBottom: '0.75rem' }}>
                    {/* Week header */}
                    {editingWeek === week.id ? (
                      <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.5fr 1fr 1fr 1.5fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={s.fieldLabel}>Uge nr.</div>
                            <input style={s.fieldInput} type="number" value={weekForm.week_number} onChange={e => setWeekForm(p => ({ ...p, week_number: e.target.value }))} />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Startdato</div>
                            <input style={s.fieldInput} type="date" value={weekForm.start_date} onChange={e => setWeekForm(p => ({ ...p, start_date: e.target.value }))} />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Blok</div>
                            <input style={s.fieldInput} list="block-names-list" value={weekForm.block_name} onChange={e => setWeekForm(p => ({ ...p, block_name: e.target.value }))} />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Coach-note</div>
                            <input style={s.fieldInput} type="text" value={weekForm.coach_note} onChange={e => setWeekForm(p => ({ ...p, coach_note: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>Blok-beskrivelse</div>
                          <textarea style={{ ...s.fieldInput, minHeight: '72px', resize: 'vertical', lineHeight: 1.5 }} placeholder="Forklar formålet med denne blok…" value={weekForm.block_description} onChange={e => setWeekForm(p => ({ ...p, block_description: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={s.btnGhost} onClick={() => setEditingWeek(null)}>Annuller</button>
                          <button style={s.btnPrimary} onClick={() => updateWeek(week.id)}>Gem</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', borderLeft: openWeekId === week.id ? '3px solid #c8923a' : '3px solid transparent', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                        onClick={() => setOpenWeekId(openWeekId === week.id ? null : week.id)}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>Uge {week.week_number}</span>
                            {week.start_date && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em' }}>{new Date(week.start_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} – {new Date(new Date(week.start_date + 'T12:00:00').getTime() + 6 * 24 * 3600 * 1000).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
                            {week.block_name && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>{week.block_name}</span>}
                          </div>
                          {week.coach_note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', marginTop: '0.2rem' }}>{week.coach_note}</div>}
                          {week.block_description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.78rem', color: '#4a4844', fontStyle: 'italic', marginTop: '0.2rem' }}>{week.block_description}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase' }}>{week.sessions?.length || 0} træninger</span>
                          <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingWeek(week.id); setWeekForm({ week_number: week.week_number, block_name: week.block_name || '', coach_note: week.coach_note || '', block_description: week.block_description || '', start_date: week.start_date || '' }) }}>Rediger</button>
                          <button style={s.btnDanger} onClick={e => { e.stopPropagation(); deleteWeek(week.id) }}>Slet</button>
                          <span style={{ color: '#4a4844', fontSize: '0.65rem', marginLeft: '0.25rem' }}>{openWeekId === week.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    )}

                    {/* Sessions (expanded week) */}
                    {openWeekId === week.id && (
                      <div style={{ marginLeft: isMobile ? '0.5rem' : '1.5rem', borderLeft: '2px solid rgba(200,146,58,0.15)', paddingLeft: isMobile ? '0.5rem' : '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                        {(week.sessions || []).map((session, sessionIdx, sessionsArr) => (
                          <div key={session.id} style={{ marginBottom: '0.5rem' }}>
                            {/* Session header */}
                            {editingSession === session.id ? (
                              <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.2)', padding: '0.75rem', marginBottom: '0.4rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={s.fieldLabel}>Titel</div>
                                    <input style={s.fieldInput} type="text" value={sessionForm.title} onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} />
                                  </div>
                                </div>
                                {weekdayPicker}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button style={s.btnGhost} onClick={() => setEditingSession(null)}>Annuller</button>
                                  <button style={s.btnPrimary} onClick={() => updateSession(session.id)}>Gem</button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.06)', borderLeft: `3px solid ${sessionLogStatus(session).color}`, padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                                onClick={() => setOpenSessionId(openSessionId === session.id ? null : session.id)}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.88rem', color: '#edeae2', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {session.title}
                                    {session.weekday != null && WEEKDAYS_LONG[session.weekday] && (
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.12rem 0.4rem' }}>{WEEKDAYS_LONG[session.weekday]}</span>
                                    )}
                                    {(() => {
                                      const st = sessionLogStatus(session)
                                      if (st.total === 0 && st.logged === 0) return null
                                      const label = st.kind === 'done' ? '✓ Logget' : st.kind === 'partial' ? `${st.logged}/${st.total} sæt` : 'Ikke logget'
                                      return <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: st.color, border: `1px solid ${st.color}66`, padding: '0.12rem 0.4rem' }}>{label}</span>
                                    })()}
                                  </div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
                                    {session.exercises?.length || 0} øvelser
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                                  <button aria-label={`Flyt ${session.title} op`} style={{ ...s.btnEdit, opacity: sessionIdx === 0 ? 0.25 : 1 }} onClick={e => { e.stopPropagation(); reorderSession(week.id, session.id, 'up') }} disabled={sessionIdx === 0}>↑</button>
                                  <button aria-label={`Flyt ${session.title} ned`} style={{ ...s.btnEdit, opacity: sessionIdx === sessionsArr.length - 1 ? 0.25 : 1 }} onClick={e => { e.stopPropagation(); reorderSession(week.id, session.id, 'down') }} disabled={sessionIdx === sessionsArr.length - 1}>↓</button>
                                  {copyingSession === session.id ? (
                                    <>
                                      <select
                                        style={{ ...s.fieldInput, fontSize: '0.6rem', padding: '0.2rem 0.4rem', width: 'auto', cursor: 'pointer' }}
                                        defaultValue=""
                                        onChange={e => { if (e.target.value) copySessionToWeek(session, e.target.value) }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <option value="" disabled>Kopiér til uge...</option>
                                        {weeks.filter(w => w.id !== week.id).map(w => (
                                          <option key={w.id} value={w.id}>Uge {w.week_number}{w.block_name ? ` — ${w.block_name}` : ''}</option>
                                        ))}
                                      </select>
                                      <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.2rem 0.4rem' }} onClick={e => { e.stopPropagation(); setCopyingSession(null) }}>✕</button>
                                    </>
                                  ) : (
                                    <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setCopyingSession(session.id) }}>Kopiér</button>
                                  )}
                                  <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingSession(session.id); setSessionForm({ title: session.title, weekday: session.weekday ?? null }) }}>Rediger</button>
                                  <button style={s.btnDanger} onClick={e => { e.stopPropagation(); deleteSession(session.id) }}>Slet</button>
                                  <span style={{ color: '#4a4844', fontSize: '0.6rem', marginLeft: '0.2rem' }}>{openSessionId === session.id ? '▲' : '▼'}</span>
                                </div>
                              </div>
                            )}

                            {/* Exercises (expanded session) */}
                            {openSessionId === session.id && (
                              <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.06)', borderTop: 'none', padding: '0.75rem' }}>
                                {(session.exercises || []).map((ex, exIdx, exArr) => (
                                  <div key={ex.id}>
                                    {editingExercise === ex.id ? (
                                      <div style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)', marginBottom: '0.5rem' }}>
                                        {exFormRow}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                          <button style={s.btnGhost} onClick={() => setEditingExercise(null)}>Annuller</button>
                                          <button style={s.btnPrimary} onClick={() => updateExercise(ex.id)}>Gem</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)', gap: isMobile ? '0.4rem' : 0 }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#b8b4a8', minWidth: '120px' }}>{ex.name}</div>
                                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>
                                              {ex.sets && `${ex.sets} sæt`}{ex.reps && ` × ${ex.reps}`}{ex.intensity && ` · ${ex.intensity}`}
                                            </div>
                                            {ex.note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', fontStyle: 'italic' }}>{ex.note}</div>}
                                          </div>
                                          {editingRecommended === ex.id ? (
                                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.3rem', alignItems: 'center' }}>
                                              <input
                                                style={{ ...s.fieldInput, fontSize: '0.72rem', padding: '0.2rem 0.4rem', width: '80px' }}
                                                type="number"
                                                placeholder="kg"
                                                value={recommendedInput}
                                                onChange={e => setRecommendedInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveRecommendedWeight(ex.id); if (e.key === 'Escape') setEditingRecommended(null) }}
                                                autoFocus
                                              />
                                              <button style={{ ...s.btnPrimary, fontSize: '0.55rem', padding: '0.2rem 0.5rem' }} onClick={() => saveRecommendedWeight(ex.id)}>Gem</button>
                                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.2rem 0.5rem' }} onClick={() => setEditingRecommended(null)}>Annuller</button>
                                            </div>
                                          ) : (
                                            (() => {
                                              const last = bestLog(ex.name, ex.reps)
                                              if (ex.recommended_weight != null) return (
                                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#c8923a', marginTop: '0.25rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => { setEditingRecommended(ex.id); setRecommendedInput(ex.recommended_weight.toString()) }}>
                                                  Anbefalet: {ex.recommended_weight}kg <span style={{ opacity: 0.6 }}>✎</span>
                                                </div>
                                              )
                                              if (last) return (
                                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginTop: '0.25rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => { setEditingRecommended(ex.id); setRecommendedInput('') }}>
                                                  Sidst logget: {last.weight}kg × {last.reps_completed} reps <span style={{ opacity: 0.6 }}>✎</span>
                                                </div>
                                              )
                                              return (
                                                <button style={{ ...s.btnSm, marginTop: '0.25rem', fontSize: '0.5rem' }} onClick={() => { setEditingRecommended(ex.id); setRecommendedInput('') }}>
                                                  + Anbefalet vægt
                                                </button>
                                              )
                                            })()
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0, marginLeft: isMobile ? 0 : '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                          {copyingExercise === ex.id ? (
                                            <>
                                              <select
                                                style={{ ...s.fieldInput, fontSize: '0.65rem', padding: '0.2rem 0.4rem', width: 'auto', cursor: 'pointer' }}
                                                defaultValue=""
                                                onChange={e => { if (e.target.value) copyExerciseToSession(ex, e.target.value) }}
                                              >
                                                <option value="" disabled>Kopiér til...</option>
                                                {weeks.map(w => {
                                                  const otherSessions = (w.sessions || []).filter(s => s.id !== session.id)
                                                  if (!otherSessions.length) return null
                                                  return (
                                                    <optgroup key={w.id} label={`Uge ${w.week_number}${w.block_name ? ` — ${w.block_name}` : ''}`}>
                                                      {otherSessions.map(s => (
                                                        <option key={s.id} value={s.id}>{s.title}</option>
                                                      ))}
                                                    </optgroup>
                                                  )
                                                })}
                                              </select>
                                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.2rem 0.4rem' }} onClick={() => setCopyingExercise(null)}>✕</button>
                                            </>
                                          ) : (
                                            <button style={s.btnEdit} onClick={() => setCopyingExercise(ex.id)}>Kopiér</button>
                                          )}
                                          <button aria-label={`Flyt ${ex.name} op`} style={{ ...s.btnEdit, opacity: exIdx === 0 ? 0.25 : 1 }} disabled={exIdx === 0} onClick={() => reorderExercise(session.id, ex.id, 'up')}>↑</button>
                                          <button aria-label={`Flyt ${ex.name} ned`} style={{ ...s.btnEdit, opacity: exIdx === exArr.length - 1 ? 0.25 : 1 }} disabled={exIdx === exArr.length - 1} onClick={() => reorderExercise(session.id, ex.id, 'down')}>↓</button>
                                          <button aria-label={`Rediger ${ex.name}`} style={s.btnEdit} onClick={() => { setEditingExercise(ex.id); const { intensityPrefix, intensity } = parseIntensity(ex.intensity); setExerciseForm({ name: ex.name, sets: ex.sets || '', reps: ex.reps || '', intensity, intensityPrefix, note: ex.note || '' }) }}>✎</button>
                                          <button aria-label={`Slet ${ex.name}`} style={s.btnDanger} onClick={() => deleteExercise(ex.id)}>✕</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {/* Add exercise */}
                                {addingExercise === session.id ? (
                                  <div style={{ paddingTop: '0.75rem' }}>
                                    {exFormRow}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      <button style={s.btnGhost} onClick={() => setAddingExercise(null)}>Annuller</button>
                                      <button style={s.btnPrimary} onClick={() => addExercise(session.id)}>Tilføj</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button style={{ ...s.btnSm, marginTop: '0.5rem' }} onClick={() => { setAddingExercise(session.id); setExerciseForm({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' }) }}>
                                    + Tilføj øvelse
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add session */}
                        {addingSession === week.id ? (
                          <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.2)', padding: '0.75rem', marginTop: '0.5rem' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                              <div style={s.fieldLabel}>Titel</div>
                              <input style={s.fieldInput} type="text" placeholder="f.eks. Træning A" value={sessionForm.title} onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            {weekdayPicker}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button style={s.btnGhost} onClick={() => setAddingSession(null)}>Annuller</button>
                              <button style={s.btnPrimary} onClick={() => addSession(week.id)}>Tilføj</button>
                            </div>
                          </div>
                        ) : (
                          <button style={{ ...s.btnGhost, marginTop: '0.5rem', fontSize: '0.54rem' }} onClick={() => { setAddingSession(week.id); setSessionForm({ title: '', weekday: null }) }}>
                            + Tilføj træning
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>)
}

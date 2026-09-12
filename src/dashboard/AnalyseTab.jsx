// Analyse-fanen (videoer + træningsgrafer) — udskilt fra Dashboard.jsx (ordre
// 130 · commit 2) som sin egen lazy-loadede chunk, så atletlisten og check-in-
// gennemgangen ikke skal hente VideoCoach-gennemgangen og graf-koden for at
// boote. Ren udflytning af JSX'en fra "activeTab === 'analyse'"-blokken -
// ingen logikændring, kun frie variable gjort eksplicitte som props.
import { buildVideoCoachBaselineProfiles, countReadyVideoCoachBaselineProfiles } from '../videoCoachBaselineProgress'
import { videoCoachFeedbackQuality } from '../videoCoachFeedbackQuality'
import { VIDEOCOACH_LIFT_LABELS as VIDEOCOACH_LIFTS, videoCoachVariationLabel } from '../videoCoachLabels'
import { byggKategoriOpslag, kategoriFor } from '../exerciseNames'
import {
  s, VIDEOCOACH_STATUS, VIDEOCOACH_METRICS, videoCoachMetric, videoCoachBaseline,
  videoCoachMetricText, videoCoachBaselineText, parsePlannedRpe, buildLiftSeries,
} from '../dashboardShared'
import { BarChart, LineChart, ScatterPlot } from '../dashboardCharts'
import AthleteSilentFailNote from '../AthleteSilentFailNote' // ORDRE 131 · commit 3, flyttet hertil ordre 137 · commit 1 (Dashboard.jsx splittet under 130) — eneste rendering, se RAPPORT-131.md

export default function AnalyseTab({
  a, aiExportCopied, aiExportText, aiExportWeeks, athleteLogs, athletePRHistory, athleteReadiness,
  athleteWeightLogs, exerciseLibrary, fetchVideoCoachHistory, generateAIReport, isMobile,
  openAwaitingAnalysisVideo, openVideoAnalysisReview, openVideoCoachV3, reviewVideoAnalysis,
  selectedAthlete, setAiExportCopied, setAiExportText, setAiExportWeeks, setShowAiExport,
  setVideoLiftFilter, showAiExport, videoAnalyses, videoAnalysisError, videoAnalysisLoading,
  videoAnalysisReviewError, videoAnalysisReviewLoadingId, videoAnalysisUpdatingId, videoBaselines,
  videoLiftFilter, weeks,
}) {
              const now = new Date()
              const d28 = new Date(now); d28.setDate(now.getDate() - 28)
              const d28str = d28.toISOString().slice(0, 10)
              const recentLogs = athleteLogs.filter(l => l.logged_at.slice(0, 10) >= d28str)
              const completedSessionIds = new Set(recentLogs.map(l => l.exercises?.session_id).filter(Boolean))
              const totalPlannedSessions = weeks.reduce((s, w) => s + (w.sessions?.length || 0), 0)
              const lastActivityDate = athleteLogs.length ? athleteLogs[0]?.logged_at.slice(0, 10) : null
              const totalSets4w = recentLogs.length

              const nameToCat = byggKategoriOpslag(exerciseLibrary)
              const squatS = buildLiftSeries(athleteLogs, 'squat', nameToCat, 'Squat')
              const benchS = buildLiftSeries(athleteLogs, 'bænk', nameToCat, 'Bænkpres')
              const deadS = buildLiftSeries(athleteLogs, 'dødl', nameToCat, 'Dødløft')
              // OHP vises kun for atleter der faktisk træner det (keyword-match, ingen
              // egen kategori) — så intet ændrer sig for rene SBD-atleter.
              const ohpS = buildLiftSeries(athleteLogs, 'ohp', nameToCat, '')
              const lifts = [
                { label: 'Squat', s: squatS },
                { label: 'Bænkpres', s: benchS },
                { label: 'Dødløft', s: deadS },
                ...(ohpS.hasData ? [{ label: 'OHP', s: ohpS }] : []),
              ]

              const weightChartData = [...athleteWeightLogs]
                .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
                .map(l => { const d = new Date(l.logged_at + 'T12:00:00'); return { y: l.weight, label: `${d.getDate()}/${d.getMonth() + 1}` } })

              const sessionMap = {}
              for (const log of athleteLogs) {
                const sid = log.exercises?.session_id
                if (!sid) continue
                if (!sessionMap[sid]) sessionMap[sid] = { id: sid, title: log.exercises?.sessions?.title || 'Ukendt', date: log.logged_at.slice(0, 10), setsLogged: 0, exSets: {} }
                if (log.logged_at.slice(0, 10) > sessionMap[sid].date) sessionMap[sid].date = log.logged_at.slice(0, 10)
                sessionMap[sid].setsLogged++
                if (!sessionMap[sid].exSets[log.exercise_id]) sessionMap[sid].exSets[log.exercise_id] = log.exercises?.sets || 0
              }
              const recentSessions = Object.values(sessionMap)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 10)
                .map(s => ({ ...s, plannedSets: Object.values(s.exSets).reduce((acc, v) => acc + v, 0) }))

              const fmtDate = date => new Date(date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
              const hasPlanVsActual = lifts.some(l => l.s.plannedData.length > 0)
              const filteredVideoAnalyses = videoLiftFilter === 'all'
                ? videoAnalyses : videoAnalyses.filter(item => item.lift === videoLiftFilter)
              const draftVideoCount = videoAnalyses.filter(item => item.status === 'draft').length
              const approvedVideoCount = videoAnalyses.filter(item =>
                item.status === 'coach_approved' || item.status === 'shared').length
              const visibleApprovedVideoCount = filteredVideoAnalyses.filter(item =>
                item.status === 'coach_approved' || item.status === 'shared').length
              const baselineProfiles = buildVideoCoachBaselineProfiles(videoBaselines, videoAnalyses)
              const visibleBaselineProfiles = videoLiftFilter === 'all'
                ? baselineProfiles : baselineProfiles.filter(profile => profile.lift === videoLiftFilter)
              const baselineReadyCount = countReadyVideoCoachBaselineProfiles(baselineProfiles)
              const latestVideo = videoAnalyses[0] || null

              return (
                <div>
                  {/* AI Rapport */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.4rem 0.9rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)' }} onClick={() => { setAiExportText(''); setShowAiExport(true) }}>AI Rapport</button>
                  </div>

                  {showAiExport && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowAiExport(false)}>
                      <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.12)', padding: '1.5rem', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={s.cardLabel}>AI Rapport — {selectedAthlete?.name}</div>
                          <button style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontSize: '1rem' }} onClick={() => setShowAiExport(false)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={s.fieldLabel}>Periode:</span>
                          {[4, 8, 12, 16].map(n => (
                            <button key={n} style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.7rem', color: aiExportWeeks === n ? '#c8923a' : '#7a7770', borderColor: aiExportWeeks === n ? 'rgba(200,146,58,0.5)' : 'rgba(237,234,226,0.15)', background: aiExportWeeks === n ? 'rgba(200,146,58,0.08)' : 'transparent' }} onClick={() => setAiExportWeeks(n)}>{n} uger</button>
                          ))}
                          <input
                            type="number" min="1" max="52"
                            value={aiExportWeeks}
                            onChange={e => setAiExportWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ ...s.input, width: '60px', padding: '0.3rem 0.5rem', fontSize: '0.7rem', textAlign: 'center' }}
                          />
                          <button style={{ ...s.btnPrimary, fontSize: '0.6rem', padding: '0.4rem 0.9rem' }} onClick={() => generateAIReport(aiExportWeeks)}>Generer</button>
                        </div>
                        {aiExportText && (
                          <>
                            <textarea
                              readOnly
                              value={aiExportText}
                              style={{ flex: 1, minHeight: '340px', background: '#141410', border: '1px solid rgba(237,234,226,0.1)', color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', lineHeight: 1.6, padding: '0.75rem', resize: 'vertical', outline: 'none' }}
                              onClick={e => e.target.select()}
                            />
                            <button
                              style={{ ...s.btnPrimary, fontSize: '0.6rem', padding: '0.5rem 1rem', alignSelf: 'flex-end', background: aiExportCopied ? '#4a7a4a' : undefined }}
                              onClick={() => { navigator.clipboard.writeText(aiExportText); setAiExportCopied(true); setTimeout(() => setAiExportCopied(false), 2000) }}
                            >{aiExportCopied ? '✓ Kopieret!' : 'Kopiér til udklipsholder'}</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VideoCoach v3 · individuel historik (read-only første lag) */}
                  <div style={{ ...s.card, borderColor: 'rgba(200,146,58,0.24)', background: 'linear-gradient(145deg, rgba(200,146,58,0.055), #1c1c18 38%)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={s.cardLabel}>VideoCoach · individuelle bevægelsesanalyser</div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.78rem', color: '#b8b4a8', marginTop: '0.35rem', maxWidth: '620px', lineHeight: 1.5 }}>
                          Samme atlet, løft og variation sammenlignes over tid. Kun coach-godkendte analyser må forme den personlige baseline.
                        </div>
                      </div>
                      <button style={{ ...s.btnPrimary, fontSize: '0.58rem', padding: '0.45rem 0.8rem' }} onClick={openVideoCoachV3}>
                        Ny videoanalyse →
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: '1px', background: 'rgba(237,234,226,0.07)', marginBottom: '1rem' }}>
                      {[
                        ['Analyser', videoAnalyses.length],
                        ['Afventer coach', draftVideoCount],
                        ['Godkendte', approvedVideoCount],
                        ['Profiler klare', baselineReadyCount],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: '#191915', padding: '0.85rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <div style={{ fontFamily: "'Playfair Display', serif", color: '#edeae2', fontSize: '1.25rem' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                      {[['all', 'Alle'], ['squat', 'Squat'], ['bench', 'Bænk'], ['deadlift', 'Dødløft']].map(([key, label]) => (
                        <button key={key} onClick={() => setVideoLiftFilter(key)} style={{ ...s.btnGhost, padding: '0.3rem 0.65rem', fontSize: '0.52rem', color: videoLiftFilter === key ? '#c8923a' : '#7a7770', borderColor: videoLiftFilter === key ? 'rgba(200,146,58,0.42)' : 'rgba(237,234,226,0.1)', background: videoLiftFilter === key ? 'rgba(200,146,58,0.07)' : 'transparent' }}>
                          {label}
                        </button>
                      ))}
                      {latestVideo && (
                        <span style={{ marginLeft: isMobile ? 0 : 'auto', fontFamily: "'IBM Plex Mono', monospace", color: '#7a7770', fontSize: '0.5rem' }}>
                          Senest {new Date(latestVideo.analyzed_at).toLocaleDateString('da-DK')}
                        </span>
                      )}
                    </div>

                    {visibleBaselineProfiles.length > 0 && (
                      <div style={{ border: '1px solid rgba(103,223,245,0.14)', background: 'rgba(103,223,245,0.025)', padding: isMobile ? '0.75rem' : '0.85rem 0.95rem', marginBottom: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
                          <div style={s.cardLabel}>Personlig baseline</div>
                          <span style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem' }}>5 brugbare, godkendte = klar</span>
                        </div>
                        <div style={{ display: 'grid', gap: '0.6rem' }}>
                          {visibleBaselineProfiles.map(profile => {
                            const ready = profile.stage === 'ready'
                            const preliminary = profile.stage === 'preliminary'
                            const statusText = ready
                              ? `${profile.nAnalyses} målinger · klar`
                              : preliminary
                                ? `${profile.nAnalyses}/5 · foreløbig · mangler ${profile.remaining}`
                                : `${profile.nAnalyses}/5 · mangler ${profile.remaining}`
                            return (
                              <div key={profile.key}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', marginBottom: '0.28rem' }}>
                                  <span style={{ color: '#b8b4a8', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.66rem', minWidth: 0 }}>{profile.label}</span>
                                  <span style={{ color: ready ? '#7fa188' : preliminary ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', flexShrink: 0 }}>{statusText}</span>
                                </div>
                                <div style={{ height: 3, background: 'rgba(237,234,226,0.08)', overflow: 'hidden' }}>
                                  <div style={{ width: `${profile.progressPct}%`, height: '100%', background: ready ? '#6cba6c' : preliminary ? '#c8923a' : '#527d84', transition: 'width 180ms ease-out' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {visibleBaselineProfiles.length === 0 && visibleApprovedVideoCount > 0 && (
                      <div style={{ border: '1px solid rgba(103,223,245,0.14)', background: 'rgba(103,223,245,0.025)', padding: '0.75rem 0.9rem', marginBottom: '0.9rem', color: '#8f918b', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.68rem', lineHeight: 1.5 }}>
                        Den nye kvalitetssikrede baseline bygges fra målinger med dokumenteret tracking-confidence. Den tidligere historik er bevaret, men bruges ikke til automatiske sammenligninger.
                      </div>
                    )}

                    {videoAnalysisLoading && (
                      <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', padding: '1rem 0' }}>Henter bevægelsesanalyser…</div>
                    )}
                    {videoAnalysisError && !videoAnalysisLoading && (
                      <div style={{ border: '1px solid rgba(207,107,78,0.28)', background: 'rgba(207,107,78,0.06)', padding: '0.85rem', color: '#d79a83', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', lineHeight: 1.5 }}>
                        {videoAnalysisError} <button onClick={() => fetchVideoCoachHistory(selectedAthlete.id)} style={{ background: 'none', border: 0, padding: 0, color: '#c8923a', cursor: 'pointer', font: 'inherit' }}>Prøv igen</button>
                      </div>
                    )}
                    {videoAnalysisReviewError && (
                      <div style={{ border: '1px solid rgba(207,107,78,0.28)', background: 'rgba(207,107,78,0.06)', padding: '0.7rem 0.85rem', color: '#d79a83', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', lineHeight: 1.5, marginBottom: '0.7rem' }}>
                        {videoAnalysisReviewError}
                      </div>
                    )}
                    {!videoAnalysisLoading && !videoAnalysisError && filteredVideoAnalyses.length === 0 && (
                      <div style={{ border: '1px dashed rgba(237,234,226,0.12)', padding: isMobile ? '1rem' : '1.3rem', textAlign: 'center' }}>
                        <div style={{ color: '#b8b4a8', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.76rem', marginBottom: '0.35rem' }}>
                          {videoAnalyses.length ? 'Ingen analyser for dette løft endnu.' : 'Første bevægelsesprofil er ikke oprettet endnu.'}
                        </div>
                        <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', lineHeight: 1.5 }}>
                          Efter 3 godkendte analyser vises en foreløbig personlig retning. Ved 5+ kan baseline bruges i feedback.
                        </div>
                      </div>
                    )}

                    {!videoAnalysisLoading && filteredVideoAnalyses.length > 0 && (
                      <div style={{ display: 'grid', gap: '0.65rem' }}>
                        {filteredVideoAnalyses.slice(0, isMobile ? 4 : 8).map(analysis => {
                          // ORDRE 57 · commit 2: en afventende video har ingen tal at vise endnu -
                          // eget, enklere kort med ét klik til at spore den.
                          if (analysis.analysis_state === 'awaiting_analysis') {
                            const opening = videoAnalysisReviewLoadingId === analysis.id
                            return (
                              <div key={analysis.id || analysis.client_analysis_id} style={{ border: '1px solid rgba(103,223,245,0.28)', background: 'rgba(103,223,245,0.05)', padding: isMobile ? '0.8rem' : '0.95rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
                                  <div>
                                    <div style={{ color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem' }}>
                                      {VIDEOCOACH_LIFTS[analysis.lift] || analysis.lift} · {videoCoachVariationLabel(analysis.lift, analysis.variation)}
                                    </div>
                                    <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', marginTop: '0.25rem' }}>
                                      Modtaget {new Date(analysis.created_at).toLocaleDateString('da-DK')}{analysis.load_kg != null ? ` · ${analysis.load_kg} kg` : ''}{analysis.rpe != null ? ` · RPE ${analysis.rpe}` : ''}
                                    </div>
                                  </div>
                                  <span style={{ color: '#67dff5', border: '1px solid rgba(103,223,245,0.4)', background: 'rgba(103,223,245,0.1)', padding: '0.2rem 0.45rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Afventer sporing
                                  </span>
                                </div>
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                                  <button disabled={opening} onClick={() => openAwaitingAnalysisVideo(analysis)} style={{ ...s.btnPrimary, padding: '0.38rem 0.7rem', fontSize: '0.52rem', opacity: opening ? 0.55 : 1 }}>
                                    {opening ? 'Åbner…' : 'Spor nu →'}
                                  </button>
                                </div>
                              </div>
                            )
                          }
                          const status = VIDEOCOACH_STATUS[analysis.status] || VIDEOCOACH_STATUS.draft
                          const feedback = analysis.athlete_feedback || {}
                          const focus = feedback.focus?.[0]?.text
                          const nextSet = feedback.next_set?.[0]?.text
                          const feedbackQuality = videoCoachFeedbackQuality(feedback)
                          const updating = videoAnalysisUpdatingId === analysis.id
                          return (
                            <div key={analysis.id || analysis.client_analysis_id} style={{ border: '1px solid rgba(237,234,226,0.075)', background: 'rgba(20,20,16,0.58)', padding: isMobile ? '0.8rem' : '0.95rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem' }}>
                                    {VIDEOCOACH_LIFTS[analysis.lift] || analysis.lift} · {videoCoachVariationLabel(analysis.lift, analysis.variation)}
                                  </div>
                                  <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', marginTop: '0.25rem' }}>
                                    {new Date(analysis.analyzed_at).toLocaleDateString('da-DK')} · {analysis.load_kg != null ? `${analysis.load_kg} kg` : 'kg ikke angivet'} · {analysis.reps_count || 0} reps{analysis.rpe != null ? ` · RPE ${analysis.rpe}` : ''}
                                  </div>
                                  {analysis.source_mode === 'athlete_submission' && (
                                    <div style={{ color: '#67dff5', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', marginTop: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                      Sendt af atleten
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <button disabled={videoAnalysisReviewLoadingId === analysis.id} onClick={() => openVideoAnalysisReview(analysis)} style={{ ...s.btnGhost, padding: '0.24rem 0.5rem', fontSize: '0.46rem', opacity: videoAnalysisReviewLoadingId === analysis.id ? 0.55 : 0.9 }}>
                                    {videoAnalysisReviewLoadingId === analysis.id ? 'Åbner…' : 'Gennemgå måling'}
                                  </button>
                                  <span style={{ color: status.color, border: `1px solid ${status.color}55`, background: `${status.color}10`, padding: '0.2rem 0.45rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    {status.label}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                                {VIDEOCOACH_METRICS.map(def => {
                                  const metric = videoCoachMetric(analysis, def.key)
                                  if (!metric) return null
                                  const baseline = videoCoachBaseline(videoBaselines, analysis, def.key)
                                  const baselineText = videoCoachBaselineText(baseline, metric)
                                  return (
                                    <div key={def.key} style={{ minWidth: 0 }}>
                                      <div style={s.fieldLabel}>{def.label}</div>
                                      <div style={{ color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem' }}>{videoCoachMetricText(metric)}</div>
                                      {baselineText && <div style={{ color: '#7a9f78', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.43rem', marginTop: '0.18rem', lineHeight: 1.35 }}>{baselineText}</div>}
                                    </div>
                                  )
                                })}
                              </div>

                              {(focus || nextSet) && (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
                                  {focus && <div style={{ borderLeft: '2px solid #c8923a', paddingLeft: '0.55rem' }}><div style={s.fieldLabel}>Fokus</div><div style={{ color: '#b8b4a8', fontSize: '0.66rem', lineHeight: 1.45 }}>{focus}</div></div>}
                                  {nextSet && <div style={{ borderLeft: '2px solid #6cba6c', paddingLeft: '0.55rem' }}><div style={s.fieldLabel}>Næste sæt</div><div style={{ color: '#b8b4a8', fontSize: '0.66rem', lineHeight: 1.45 }}>{nextSet}</div></div>}
                                </div>
                              )}

                              {analysis.status === 'draft' && (
                                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '0.7rem', flexDirection: isMobile ? 'column' : 'row' }}>
                                  <div style={{ color: '#8f8b82', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', lineHeight: 1.45 }}>
                                    Kontrollér bane og feedback. Godkend kun en brugbar måling.
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    <button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'coach_approved')} style={{ ...s.btnPrimary, padding: '0.38rem 0.7rem', fontSize: '0.52rem', background: '#4f7d50', opacity: updating ? 0.55 : 1 }}>
                                      {updating ? 'Gemmer…' : 'Godkend til baseline'}
                                    </button>
                                    <button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'invalid')} style={{ ...s.btnGhost, padding: '0.38rem 0.7rem', fontSize: '0.52rem', opacity: updating ? 0.55 : 1 }}>
                                      Udelad
                                    </button>
                                  </div>
                                </div>
                              )}

                              {analysis.status === 'coach_approved' && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', flexWrap: 'wrap' }}>
                                  <span style={{ color: '#7a9f78', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem' }}>Indgår i personlig baseline</span>
                                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <button disabled={updating} onClick={() => feedbackQuality.level === 'strong' ? reviewVideoAnalysis(analysis, 'shared') : openVideoAnalysisReview(analysis)} style={{ ...s.btnPrimary, padding: '0.34rem 0.62rem', fontSize: '0.48rem', background: feedbackQuality.level === 'strong' ? '#3f7c87' : '#8a6b36', opacity: updating ? 0.55 : 1 }}>
                                      {updating ? 'Deler…' : feedbackQuality.level === 'strong' ? 'Del med atlet' : 'Gennemgå feedback'}
                                    </button>
                                    <button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'invalid')} style={{ ...s.btnGhost, padding: '0.28rem 0.55rem', fontSize: '0.46rem', opacity: updating ? 0.55 : 0.78 }}>
                                      Fjern fra baseline
                                    </button>
                                  </div>
                                </div>
                              )}

                              {analysis.status === 'shared' && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(237,234,226,0.07)', color: '#67dff5', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem' }}>
                                  Synlig for atleten · indgår fortsat i personlig baseline
                                </div>
                              )}

                              {analysis.status === 'invalid' && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', flexWrap: 'wrap' }}>
                                  <span style={{ color: '#b07b68', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem' }}>Tæller ikke med i baseline</span>
                                  <button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'draft')} style={{ ...s.btnGhost, padding: '0.28rem 0.55rem', fontSize: '0.46rem', opacity: updating ? 0.55 : 0.9 }}>
                                    {updating ? 'Gemmer…' : 'Tilbage til kladde'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 1. Træningsoverblik */}
                  <div style={s.card}>
                    <div style={s.cardLabel}>Træningsoverblik</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)', marginBottom: '1rem' }}>
                      {[
                        ['Sessioner (4 uger)', completedSessionIds.size],
                        ['Sæt logget (4 uger)', totalSets4w],
                        ['Sessioner i program', totalPlannedSessions || '—'],
                        ['Seneste aktivitet', lastActivityDate ? fmtDate(lastActivityDate) : '—'],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: '#1c1c18', padding: '1rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {totalPlannedSessions > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          Compliance
                        </div>
                        <div style={{ flex: 1, height: '3px', background: '#242420', borderRadius: '2px', maxWidth: '180px' }}>
                          <div style={{ height: '3px', width: `${Math.min(100, Math.round(completedSessionIds.size / totalPlannedSessions * 100))}%`, background: '#c8923a', borderRadius: '2px' }} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#c8923a' }}>
                          {completedSessionIds.size}/{totalPlannedSessions}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Træningskonsistens heatmap */}
                  {(() => {
                    const trainingDates = new Set(athleteLogs.map(l => l.logged_at.slice(0, 10)))
                    const todayDate = new Date()
                    const WEEKS = 16, CELL = 22, GAP = 3, STEP = CELL + GAP
                    const PAD_LEFT = 18, PAD_TOP = 20
                    const W = PAD_LEFT + WEEKS * STEP + 2
                    const H = PAD_TOP + 7 * STEP
                    const monday = new Date(todayDate)
                    monday.setDate(todayDate.getDate() - ((todayDate.getDay() || 7) - 1) - (WEEKS - 1) * 7)
                    monday.setHours(12, 0, 0, 0)
                    const todayStr = todayDate.toISOString().slice(0, 10)
                    const cells = []
                    const monthLabels = []
                    for (let w = 0; w < WEEKS; w++) {
                      for (let d = 0; d < 7; d++) {
                        const dt = new Date(monday); dt.setDate(monday.getDate() + w * 7 + d)
                        const str = dt.toISOString().slice(0, 10)
                        cells.push({ w, d, str, trained: trainingDates.has(str), today: str === todayStr, future: dt > todayDate })
                      }
                      const wd = new Date(monday); wd.setDate(monday.getDate() + w * 7)
                      if (wd.getDate() <= 7) monthLabels.push({ w, label: ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'][wd.getMonth()] })
                    }
                    const totalDays = cells.filter(c => !c.future && c.trained).length
                    const totalPossible = cells.filter(c => !c.future).length
                    const pct = totalPossible > 0 ? Math.round(totalDays / totalPossible * 100) : 0
                    return (
                      <div style={s.card}>
                        <div style={{ ...s.cardLabel, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                          <span>Træningskonsistens</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#c8923a', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'none' }}>{totalDays} dage · {pct}% de seneste {WEEKS} uger</span>
                        </div>
                        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                          {['M','','O','','F','','S'].map((lbl, i) => lbl && (
                            <text key={i} x={PAD_LEFT - 4} y={PAD_TOP + i * STEP + CELL / 2 + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{lbl}</text>
                          ))}
                          {monthLabels.map(({ w, label }) => (
                            <text key={w} x={PAD_LEFT + w * STEP + CELL / 2} y={11} textAnchor="middle" fill="#7a7770" fontSize="9" fontFamily="IBM Plex Mono">{label}</text>
                          ))}
                          {cells.map(({ w, d, trained, today, future }) => (
                            <rect key={`${w}-${d}`} x={PAD_LEFT + w * STEP} y={PAD_TOP + d * STEP} width={CELL} height={CELL} rx={4}
                              fill={future ? 'rgba(237,234,226,0.02)' : trained ? '#c8923a' : '#1c1c18'}
                              opacity={future ? 0.3 : trained ? 0.82 : 1}
                              stroke={today ? 'rgba(200,146,58,0.6)' : 'rgba(237,234,226,0.05)'}
                              strokeWidth={today ? 1.5 : 0.5}
                            />
                          ))}
                        </svg>
                      </div>
                    )
                  })()}

                  {/* 3. Primære løft */}
                  <div style={s.card}>
                    <div style={s.cardLabel}>Primære løft — sværeste sæt per session</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${lifts.length}, 1fr)`, gap: '1.5rem' }}>
                      {lifts.map(({ label, s: ls }) => (
                        <div key={label}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                          <LineChart series={[{ data: ls.actualData, color: '#c8923a' }]} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Planlagt vs faktisk */}
                  {hasPlanVsActual && (
                    <div style={s.card}>
                      <div style={s.cardLabel}>
                        Planlagt vs faktisk
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          {[['#c8923a', false, 'Faktisk'], ['#7a7770', true, 'Planlagt']].map(([color, dashed, lbl]) => (
                            <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                              <svg width="16" height="8" style={{ flexShrink: 0 }}>
                                <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" strokeDasharray={dashed ? '4,3' : undefined} />
                              </svg>
                              {lbl}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${lifts.length}, 1fr)`, gap: '1.5rem' }}>
                        {lifts.map(({ label, s: ls }) => (
                          <div key={label}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                            <LineChart series={[
                              { data: ls.actualData, color: '#c8923a' },
                              { data: ls.plannedData, color: '#7a7770', dashed: true },
                            ]} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Ugentligt volumen */}
                  {(() => {
                    function buildWeeklyVolume(category) {
                      const weekMap = {}
                      for (const log of athleteLogs) {
                        if (log.skipped || !log.weight || !log.reps_completed) continue
                        const cat = kategoriFor(log.exercises?.name, nameToCat)
                        if (cat !== category) continue
                        const d = new Date(log.logged_at.slice(0, 10) + 'T12:00:00')
                        const day = d.getDay() || 7
                        const monday = new Date(d); monday.setDate(d.getDate() - day + 1)
                        const weekKey = monday.toISOString().slice(0, 10)
                        weekMap[weekKey] = (weekMap[weekKey] || 0) + log.weight * log.reps_completed
                      }
                      const weeks = Object.keys(weekMap).sort().slice(-10)
                      return weeks.map(w => {
                        const d = new Date(w + 'T12:00:00')
                        return { y: Math.round(weekMap[w] / 100) / 10, label: `${d.getDate()}/${d.getMonth() + 1}` }
                      })
                    }
                    const volLifts = [
                      { label: 'Squat', data: buildWeeklyVolume('Squat'), color: '#c8923a' },
                      { label: 'Bænkpres', data: buildWeeklyVolume('Bænkpres'), color: '#6cba6c' },
                      { label: 'Dødløft', data: buildWeeklyVolume('Dødløft'), color: '#6b9fd4' },
                    ]
                    if (!volLifts.some(l => l.data.length > 1)) return null
                    return (
                      <div style={s.card}>
                        <div style={s.cardLabel}>
                          Ugentligt volumen
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#4a4844', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>tons (vægt × reps / 1000)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                          {volLifts.map(({ label, color, data }) => data.length > 0 && (
                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color }}>
                              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" /></svg>
                              {label}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                          {volLifts.map(({ label, data, color }) => data.length > 1 && (
                            <div key={label}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                              <LineChart series={[{ data, color }]} height={110} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 5. PR-tidslinje */}
                  {athletePRHistory.length > 0 && (() => {
                    const mainLifts = ['squat', 'bænk', 'bench', 'dødl', 'deadlift']
                    const isMain = name => mainLifts.some(k => name.toLowerCase().includes(k))
                    const fmtPRDate = d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()} ${['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'][dt.getMonth()]} ${dt.getFullYear()}` }
                    const grouped = {}
                    for (const pr of athletePRHistory) {
                      if (!grouped[pr.exercise_name]) grouped[pr.exercise_name] = []
                      grouped[pr.exercise_name].push(pr)
                    }
                    const mainEntries = Object.entries(grouped).filter(([name]) => isMain(name))
                    const otherEntries = Object.entries(grouped).filter(([name]) => !isMain(name))
                    const ordered = [...mainEntries, ...otherEntries].slice(0, 6)
                    if (!ordered.length) return null
                    return (
                      <div style={s.card}>
                        <div style={s.cardLabel}>PR-tidslinje</div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1.25rem' }}>
                          {ordered.map(([name, prs]) => {
                            const sorted = [...prs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
                            return (
                              <div key={name}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isMain(name) ? '#c8923a' : '#7a7770', marginBottom: '0.5rem' }}>{name}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {sorted.map((pr, i) => {
                                    const isLatest = i === sorted.length - 1
                                    return (
                                      <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLatest ? '#c8923a' : 'rgba(237,234,226,0.15)', flexShrink: 0 }} />
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: isLatest ? '#edeae2' : '#7a7770', fontWeight: isLatest ? 500 : 400 }}>
                                          {pr.weight} kg{pr.reps > 1 ? ` × ${pr.reps}` : ''}
                                        </span>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginLeft: 'auto' }}>{fmtPRDate(pr.logged_at.slice(0, 10))}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* ORDRE 131 · commit 3 — eneste rendering, se RAPPORT-131.md */}
                  <AthleteSilentFailNote key={selectedAthlete?.id} athleteId={selectedAthlete?.id} />

                  {/* 6. Kropsvægt */}
                  {weightChartData.length > 1 && (
                    <div style={s.card}>
                      <div style={s.cardLabel}>Kropsvægt</div>
                      <LineChart series={[{ data: weightChartData, color: '#6cba6c' }]} height={120} />
                    </div>
                  )}

                  {/* 5. Seneste sessioner */}
                  <div style={s.card}>
                    <div style={s.cardLabel}>Seneste sessioner</div>
                    {recentSessions.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen loggede sessioner endnu.</div>
                    ) : recentSessions.map((sess, i) => (
                      <div key={sess.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < recentSessions.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', color: '#b8b4a8' }}>{sess.title}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fmtDate(sess.date)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem' }}>
                            <span style={{ color: sess.plannedSets > 0 && sess.setsLogged >= sess.plannedSets ? '#6cba6c' : '#c8923a' }}>{sess.setsLogged}</span>
                            {sess.plannedSets > 0 && <span style={{ color: '#4a4844' }}>/{sess.plannedSets}</span>}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a4844' }}>sæt</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 6. RPE analyse */}
                  {(() => {
                    const rpeCategories = ['Squat', 'Bænkpres', 'Dødløft']
                    const logsWithRpe = athleteLogs.filter(l => l.rpe_actual != null && !l.skipped)
                    if (logsWithRpe.length === 0) return null

                    const lbl = date => { const d = new Date(date + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }

                    function buildRpeSeries(category) {
                      const filtered = logsWithRpe.filter(l => kategoriFor(l.exercises?.name, nameToCat) === category)
                      if (!filtered.length) return { actualData: [], plannedData: [] }
                      const dateMap = {}
                      for (const log of filtered) {
                        const date = log.logged_at.slice(0, 10)
                        if (!dateMap[date]) dateMap[date] = { actual: [], planned: [] }
                        dateMap[date].actual.push(log.rpe_actual)
                        const p = parsePlannedRpe(log.exercises?.intensity)
                        if (p) dateMap[date].planned.push(p)
                      }
                      const dates = Object.keys(dateMap).sort()
                      const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
                      return {
                        actualData: dates.map(date => ({ y: Math.round(avg(dateMap[date].actual) * 10) / 10, label: lbl(date) })),
                        plannedData: dates.filter(d => dateMap[d].planned.length > 0).map(date => ({ y: Math.round(avg(dateMap[date].planned) * 10) / 10, label: lbl(date) })),
                      }
                    }

                    const rpeSeries = rpeCategories.map(cat => ({ label: cat, ...buildRpeSeries(cat) }))
                    const hasRpeCharts = rpeSeries.some(s => s.actualData.length > 0)

                    // RPE afvigelse
                    const deviations = logsWithRpe.map(l => {
                      const p = parsePlannedRpe(l.exercises?.intensity)
                      return p != null ? l.rpe_actual - p : null
                    }).filter(d => d !== null)
                    const avgDev = deviations.length > 0 ? Math.round(deviations.reduce((a, b) => a + b, 0) / deviations.length * 10) / 10 : null

                    // Fatigue trend: session-level avg RPE over time
                    const sessRpeMap = {}
                    for (const log of logsWithRpe) {
                      const date = log.logged_at.slice(0, 10)
                      if (!sessRpeMap[date]) sessRpeMap[date] = []
                      sessRpeMap[date].push(log.rpe_actual)
                    }
                    const sessRpeDates = Object.keys(sessRpeMap).sort()
                    const sessRpeAvgs = sessRpeDates.map(d => sessRpeMap[d].reduce((a, b) => a + b, 0) / sessRpeMap[d].length)
                    const last3 = sessRpeAvgs.slice(-3)
                    const fatigueWarning = last3.length >= 3 && last3[2] > last3[1] + 0.1 && last3[1] > last3[0] + 0.1

                    return (
                      <>
                        {fatigueWarning && (
                          <div style={{ ...s.card, borderLeft: '3px solid #c8923a', background: 'rgba(200,146,58,0.06)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.5rem' }}>
                              ⚠ Stigende RPE-trend
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b8b4a8' }}>
                              RPE har steget i de seneste {last3.length} sessioner ({last3.map(v => Math.round(v * 10) / 10).join(' → ')}). Dette kan indikere akkumuleret træthed.
                            </div>
                          </div>
                        )}

                        {avgDev != null && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>RPE afvigelse</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)' }}>
                              {[
                                ['Gns. afvigelse', `${avgDev > 0 ? '+' : ''}${avgDev}`, avgDev > 1 ? '#c8923a' : avgDev < -0.5 ? '#6cba6c' : '#edeae2'],
                                ['Sæt med RPE', deviations.length, '#edeae2'],
                              ].map(([label, value, color]) => (
                                <div key={label} style={{ background: '#1c1c18', padding: '1rem' }}>
                                  <div style={s.fieldLabel}>{label}</div>
                                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color, lineHeight: 1 }}>{value}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.75rem', letterSpacing: '0.06em' }}>
                              Positiv afvigelse = faktisk RPE højere end planlagt
                            </div>
                          </div>
                        )}

                        {hasRpeCharts && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>
                              RPE — planlagt vs faktisk
                              <div style={{ display: 'flex', gap: '1rem' }}>
                                {[['#c8923a', false, 'Faktisk'], ['#7a7770', true, 'Planlagt']].map(([color, dashed, lbl]) => (
                                  <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                                    <svg width="16" height="8" style={{ flexShrink: 0 }}>
                                      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" strokeDasharray={dashed ? '4,3' : undefined} />
                                    </svg>
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                              {rpeSeries.map(({ label, actualData, plannedData }) => actualData.length > 0 && (
                                <div key={label}>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                                  <LineChart series={[
                                    { data: actualData, color: '#c8923a' },
                                    { data: plannedData, color: '#7a7770', dashed: true },
                                  ]} height={110} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* 7. Readiness analyse */}
                  {(() => {
                    if (athleteReadiness.length === 0) return null
                    const fmtR = date => { const d = new Date(date + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }
                    const scoreData = [...athleteReadiness].reverse().map(r => ({ y: r.readiness_score, label: fmtR(r.logged_date) }))
                    // eslint-disable-next-line react-hooks/purity -- uændret adfærd fra Dashboard.jsx; flaget først nu fordi denne kode er en topniveau-komponent i stedet for en indlejret IIFE
                    const d14str = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
                    const last14 = athleteReadiness.filter(r => r.logged_date >= d14str)
                    const sleepEntries = last14.filter(r => r.sleep_hours != null)
                    const avgSleep = sleepEntries.length > 0 ? Math.round(sleepEntries.reduce((s, r) => s + r.sleep_hours, 0) / sleepEntries.length * 10) / 10 : null
                    const soreMap = {}
                    for (const r of athleteReadiness) for (const z of (r.sore_zones || [])) soreMap[z] = (soreMap[z] || 0) + 1
                    const topZones = Object.entries(soreMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
                    const sorted = [...athleteReadiness].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
                    let lowStreak = 0
                    for (const r of sorted) { if (r.readiness_score < 50) lowStreak++; else break }

                    return (
                      <>
                        {lowStreak >= 3 && (
                          <div style={{ ...s.card, borderLeft: '3px solid #e05555', background: 'rgba(224,85,85,0.05)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e05555', marginBottom: '0.5rem' }}>
                              ⚠ Lav parathed {lowStreak} dage i træk
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b8b4a8' }}>
                              Atleten har haft parathedsscore under 50 i {lowStreak} dage i træk. Overvej en lettere session eller fri dag.
                            </div>
                          </div>
                        )}
                        <div style={s.card}>
                          <div style={s.cardLabel}>Parathed over tid</div>
                          {scoreData.length > 1
                            ? <LineChart series={[{ data: scoreData, color: '#6cba6c' }]} height={110} />
                            : <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ikke nok data endnu.</div>}
                        </div>
                        <div style={s.card}>
                          <div style={s.cardLabel}>Parathed — nøgletal</div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)', marginBottom: topZones.length > 0 ? '1rem' : 0 }}>
                            {[
                              ['Logs i alt', athleteReadiness.length],
                              ['Gns. søvn (2 uger)', avgSleep != null ? `${avgSleep}t` : '—'],
                              ['Seneste score', athleteReadiness[0]?.readiness_score ?? '—'],
                            ].map(([label, value]) => (
                              <div key={label} style={{ background: '#1c1c18', padding: '1rem' }}>
                                <div style={s.fieldLabel}>{label}</div>
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {topZones.length > 0 && (
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>Hyppigst ømme zoner</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {topZones.map(([zone, count]) => (
                                  <div key={zone} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.6rem', color: '#b8b4a8' }}>
                                    {zone} <span style={{ color: '#4a4844' }}>× {count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}

                  {/* === EXTENDED ANALYSE === */}
                  {(() => {
                    // Build session rating map (session_id → { date, rating })
                    const sessRatingMap = {}
                    for (const log of athleteLogs) {
                      const sid = log.exercises?.session_id
                      const rating = log.exercises?.sessions?.athlete_rating
                      if (sid && rating != null && !sessRatingMap[sid]) {
                        sessRatingMap[sid] = { date: log.logged_at.slice(0, 10), rating }
                      }
                    }

                    // --- 1. Restitutionssignal ---
                    const sortedRead = [...athleteReadiness].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
                    let streak60 = 0
                    for (const r of sortedRead) { if (r.readiness_score < 60) streak60++; else break }
                    const logsWithPlannedRpe = athleteLogs.filter(l => !l.skipped && l.rpe_actual != null && parsePlannedRpe(l.exercises?.intensity) != null)
                    const recentRpeDevs = logsWithPlannedRpe.slice(-20).map(l => l.rpe_actual - parsePlannedRpe(l.exercises?.intensity))
                    const avgRpeDev30 = recentRpeDevs.length > 0 ? recentRpeDevs.reduce((a, b) => a + b, 0) / recentRpeDevs.length : 0
                    const overtrainingAlert = streak60 >= 3 && avgRpeDev30 > 0.5

                    // --- 2. Belastningsoverblik (weekly volume) ---
                    const weekVol = {}
                    for (const log of athleteLogs) {
                      if (log.skipped) continue
                      const wn = log.exercises?.sessions?.weeks?.week_number
                      if (!wn) continue
                      if (!weekVol[wn]) weekVol[wn] = { logged: 0, planned: 0 }
                      weekVol[wn].logged++
                    }
                    for (const week of weeks) {
                      const wn = week.week_number
                      if (!weekVol[wn]) weekVol[wn] = { logged: 0, planned: 0 }
                      for (const sess of (week.sessions || []))
                        for (const ex of (sess.exercises || []))
                          weekVol[wn].planned += ex.sets || 0
                    }
                    const weekBars = Object.entries(weekVol)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .slice(-8)
                      .map(([wn, d]) => ({ label: `U${wn}`, value: d.logged, planned: d.planned, highlight: d.planned > 0 && d.logged / d.planned < 0.7 }))

                    // --- 3. Readiness vs RPE scatter ---
                    const trainingDayData = {}
                    for (const log of athleteLogs) {
                      if (log.skipped) continue
                      const date = log.logged_at.slice(0, 10)
                      const p = parsePlannedRpe(log.exercises?.intensity)
                      if (log.rpe_actual != null && p != null) {
                        if (!trainingDayData[date]) trainingDayData[date] = { rpeDevs: [] }
                        trainingDayData[date].rpeDevs.push(log.rpe_actual - p)
                      }
                    }
                    for (const r of athleteReadiness) {
                      if (trainingDayData[r.logged_date]) trainingDayData[r.logged_date].readiness = r.readiness_score
                    }
                    const scatterPoints = Object.entries(trainingDayData)
                      .filter(([, d]) => d.readiness != null && d.rpeDevs.length > 0)
                      .map(([, d]) => ({ x: d.readiness, y: Math.round(d.rpeDevs.reduce((a, b) => a + b, 0) / d.rpeDevs.length * 10) / 10 }))
                    const lowRead = scatterPoints.filter(p => p.x < 60)
                    const highRead = scatterPoints.filter(p => p.x >= 60)
                    const avgDevLow = lowRead.length > 0 ? Math.round(lowRead.reduce((a, b) => a + b.y, 0) / lowRead.length * 10) / 10 : null
                    const avgDevHigh = highRead.length > 0 ? Math.round(highRead.reduce((a, b) => a + b.y, 0) / highRead.length * 10) / 10 : null
                    const readInsight = avgDevLow != null && avgDevHigh != null
                      ? avgDevLow > avgDevHigh + 0.5
                        ? `Når readiness er under 60 løfter ${a.name.split(' ')[0]} typisk over planlagt RPE (Ø ${avgDevLow > 0 ? '+' : ''}${avgDevLow} vs ${avgDevHigh > 0 ? '+' : ''}${avgDevHigh})`
                        : `Ingen klar sammenhæng mellem parathed og RPE-afvigelse (data: ${scatterPoints.length} træningsdage)`
                      : null

                    // --- 4. Sleep vs feedback ---
                    const sleepFeedbackPairs = []
                    for (const r of athleteReadiness) {
                      if (r.sleep_hours == null) continue
                      const sessionsOnDay = Object.values(sessRatingMap).filter(s => s.date === r.logged_date)
                      if (sessionsOnDay.length > 0) {
                        const avgRating = sessionsOnDay.reduce((a, b) => a + b.rating, 0) / sessionsOnDay.length
                        sleepFeedbackPairs.push({ sleep: r.sleep_hours, rating: avgRating })
                      }
                    }
                    const sleepBuckets = {}
                    for (const p of sleepFeedbackPairs) {
                      const b = p.sleep < 6 ? '<6t' : p.sleep < 7 ? '6-7t' : p.sleep < 8 ? '7-8t' : '8t+'
                      if (!sleepBuckets[b]) sleepBuckets[b] = []
                      sleepBuckets[b].push(p.rating)
                    }
                    const sleepBucketAvgs = Object.entries(sleepBuckets)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([k, vs]) => ({ bucket: k, avg: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 10) / 10, n: vs.length }))
                    const bestBucket = sleepBucketAvgs.length > 0 ? sleepBucketAvgs.reduce((best, cur) => cur.avg > best.avg ? cur : best, sleepBucketAvgs[0]) : null

                    // --- 5. Lift trend ---
                    function liftTrend(data) {
                      if (data.length < 3) return null
                      const half = Math.ceil(data.length / 2)
                      const avg = arr => arr.reduce((a, b) => a + b.y, 0) / arr.length
                      const diff = avg(data.slice(-half)) - avg(data.slice(0, half))
                      if (diff > 2) return { text: '↑ Fremgang', color: '#6cba6c' }
                      if (diff < -2) return { text: '↓ Tilbagegang', color: '#e05555' }
                      return { text: '→ Stabilt', color: '#c8923a' }
                    }
                    function trendLine(data) {
                      const n = data.length
                      if (n < 2) return []
                      const xs = data.map((_, i) => i), ys = data.map(d => d.y)
                      const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0)
                      const sxy = xs.reduce((a, xi, i) => a + xi * ys[i], 0), sx2 = xs.reduce((a, xi) => a + xi * xi, 0)
                      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx)
                      const intercept = (sy - slope * sx) / n
                      return [{ y: intercept, label: data[0].label }, { y: intercept + slope * (n - 1), label: data[n - 1].label }]
                    }

                    return (
                      <>
                        {overtrainingAlert && (
                          <div style={{ ...s.card, borderLeft: '3px solid #e05555', background: 'rgba(224,85,85,0.06)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e05555', marginBottom: '0.5rem' }}>
                              ⚠ Mulig overtræning — overvej deload
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b8b4a8' }}>
                              Parathed under 60 i {streak60} dage i træk og RPE konsekvent over planlagt (Ø +{Math.round(avgRpeDev30 * 10) / 10}). Overvej en deload-uge eller hviledage.
                            </div>
                          </div>
                        )}

                        {weekBars.length > 0 && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>Belastningsoverblik — sæt per uge</div>
                            <BarChart bars={weekBars} height={110} />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                              {[['#c8923a', 'Normal'], ['#e05555', 'Under 70% compliance']].map(([color, lbl]) => (
                                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color }}>
                                  <span style={{ width: 10, height: 10, background: color, display: 'inline-block', opacity: 0.75, flexShrink: 0 }} />{lbl}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {scatterPoints.length >= 3 && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>Readiness vs RPE-afvigelse</div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                              <div>
                                <ScatterPlot points={scatterPoints} height={130} />
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                                  {[['#6cba6c', 'Readiness ≥ 60'], ['#e05555', 'Readiness < 60']].map(([color, lbl]) => (
                                    <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color }}>
                                      <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={color} opacity="0.7" /></svg>{lbl}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.75rem', paddingTop: isMobile ? 0 : '1rem' }}>
                                {avgDevLow != null && (
                                  <div style={{ background: '#141410', padding: '0.75rem' }}>
                                    <div style={s.fieldLabel}>Lav readiness (&lt;60)</div>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: avgDevLow > 0.5 ? '#e05555' : '#edeae2' }}>{avgDevLow > 0 ? '+' : ''}{avgDevLow}</div>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase' }}>Ø RPE-afvigelse</div>
                                  </div>
                                )}
                                {avgDevHigh != null && (
                                  <div style={{ background: '#141410', padding: '0.75rem' }}>
                                    <div style={s.fieldLabel}>Høj readiness (≥60)</div>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#edeae2' }}>{avgDevHigh > 0 ? '+' : ''}{avgDevHigh}</div>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase' }}>Ø RPE-afvigelse</div>
                                  </div>
                                )}
                                {readInsight && (
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', lineHeight: 1.6, letterSpacing: '0.02em' }}>{readInsight}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {sleepFeedbackPairs.length >= 2 && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>Søvn vs. træningsfeedback</div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                              {sleepBucketAvgs.map(({ bucket, avg, n }) => (
                                <div key={bucket} style={{ textAlign: 'center', padding: '0.75rem 1rem', background: '#141410', border: '1px solid rgba(237,234,226,0.07)', flex: '1 1 60px', minWidth: '60px' }}>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{bucket}</div>
                                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: avg >= 4 ? '#6cba6c' : avg >= 3 ? '#c8923a' : '#e05555' }}>{avg}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#4a4844', textTransform: 'uppercase', marginTop: '0.1rem' }}>{n} log{n !== 1 ? 's' : ''}</div>
                                </div>
                              ))}
                            </div>
                            {bestBucket && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.04em' }}>
                                Bedste træningsfeedback ved {bestBucket.bucket} søvn — Ø {bestBucket.avg}/5
                              </div>
                            )}
                          </div>
                        )}

                        {lifts.some(l => l.s.actualData.length >= 3) && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>
                              Fremgang på primære løft
                              <div style={{ display: 'flex', gap: '1rem' }}>
                                {[['#c8923a', false, 'Løftet'], ['rgba(200,146,58,0.4)', true, 'Trend']].map(([color, dashed, lbl]) => (
                                  <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                                    <svg width="16" height="8" style={{ flexShrink: 0 }}>
                                      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" strokeDasharray={dashed ? '4,3' : undefined} />
                                    </svg>
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                              {lifts.map(({ label, s: ls }) => {
                                if (ls.actualData.length < 2) return null
                                const trend = liftTrend(ls.actualData)
                                const tl = trendLine(ls.actualData)
                                return (
                                  <div key={label}>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>{label}</span>
                                      {trend && <span style={{ color: trend.color, letterSpacing: '0.06em' }}>{trend.text}</span>}
                                    </div>
                                    <LineChart series={[
                                      { data: ls.actualData, color: '#c8923a' },
                                      { data: tl, color: 'rgba(200,146,58,0.4)', dashed: true },
                                    ]} height={100} />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                </div>
              )}

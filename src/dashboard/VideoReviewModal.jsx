// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// "Gennemgå måling" (video-review-modalen).
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { VIDEOCOACH_STATUS, s, VIDEOCOACH_METRICS, videoCoachMetric, videoCoachBaseline, videoCoachMetricText, videoCoachBaselineText } from '../dashboardShared'
import { videoCoachPathPreview } from './coachVideoHjaelp'
import { sanitizeVideoCoachFeedbackEvidence } from '../videoCoachFeedbackEvidence'
import { videoCoachPersonalBaselineOptions, videoCoachPersonalBaselineForAnalysis } from '../videoCoachPersonalFeedback'
import { videoCoachFeedbackQuality } from '../videoCoachFeedbackQuality'
import { videoCoachBaselineReviewImpact } from '../videoCoachBaselineProgress'
import { VIDEOCOACH_LIFT_LABELS as VIDEOCOACH_LIFTS, videoCoachVariationLabel } from '../videoCoachLabels'

export default function VideoReviewModal({
  closeVideoAnalysisReview, discardVideoAnalysisFeedback, isMobile, reviewVideoAnalysis, saveVideoAnalysisFeedback, selectedAthlete,
  setVideoAnalysisBaselineFindingId, setVideoAnalysisCloseWarning, setVideoAnalysisFeedbackDirty, setVideoAnalysisFeedbackDraft, videoAnalyses, videoAnalysisBaselineFindingId,
  videoAnalysisCloseWarning, videoAnalysisFeedbackDirty, videoAnalysisFeedbackDraft, videoAnalysisReview, videoAnalysisUpdatingId, videoBaselines,
}) {
        const analysis = videoAnalysisReview
        const status = VIDEOCOACH_STATUS[analysis.status] || VIDEOCOACH_STATUS.draft
        const pathPreview = videoCoachPathPreview(analysis.bar_path)
        const findings = Array.isArray(analysis.findings)
          ? analysis.findings.filter(item => item && typeof item.summary === 'string').slice(0, 6) : []
        const baselineSnapshot = Array.isArray(analysis.session_context?.baseline_snapshot)
          ? analysis.session_context.baseline_snapshot : []
        const athleteNote = typeof analysis.session_context?.athlete_note === 'string'
          ? analysis.session_context.athlete_note.trim() : ''
        // ORDRE 109 · commit 3: "atleten kalibrerede manuelt" uden at Marc skal
        // spørge - kort årsag sat af videocoach.html (docs/videocoach/
        // SKIVEN-FINDES-IKKE.md), auto-kalibrering uden problemer giver ingen tekst.
        const plateCalibrationText = {
          'plate:manual:ok': 'Atleten kalibrerede skiven manuelt (auto-genkendelsen fandt den ikke).',
          'plate:fail:auto': 'Auto-genkendelsen af skiven fejlede først, men blev rettet manuelt.',
          'plate:fail:small-video': 'Auto-genkendelsen fejlede først (lav videoopløsning), men blev rettet manuelt.',
        }[analysis.session_context?.plate_calibration] || null
        const feedbackEvidence = sanitizeVideoCoachFeedbackEvidence(
          analysis.session_context?.feedback_evidence)
        const athleteFeedback = analysis.athlete_feedback || {}
        const personalBaselineOptions = videoCoachPersonalBaselineOptions(videoBaselines,
          analysis, selectedAthlete?.id)
        const sharedPersonalBaseline = videoCoachPersonalBaselineForAnalysis(
          athleteFeedback, analysis, selectedAthlete?.id)
        const athleteFeedbackSections = [
          ['Det fungerer', athleteFeedback.works, '#8caf88'],
          ['Atletens fokus', athleteFeedback.focus, '#d79a83'],
          ['Næste gang', athleteFeedback.next_set, '#c9b47f'],
        ].map(([label, items, color]) => ({
          label,
          color,
          items: Array.isArray(items) ? items.filter(item => item?.text).slice(0, 2) : [],
        })).filter(section => section.items.length > 0)
        const feedbackEditable = analysis.status === 'draft' || analysis.status === 'coach_approved'
        const feedbackEditorFields = [
          ['works', 'Det fungerer'],
          ['focus', 'Atletens fokus'],
          ['next_set', 'Næste gang'],
        ]
        const feedbackQuality = videoCoachFeedbackQuality(feedbackEditable
          ? videoAnalysisFeedbackDraft : athleteFeedback)
        const feedbackQualityColor = ({ strong: '#6cba6c', review: '#c8923a', blocked: '#cf6b4e' })[feedbackQuality.level]
        const baselineImpact = videoCoachBaselineReviewImpact(videoBaselines, videoAnalyses, analysis)
        const updating = videoAnalysisUpdatingId === analysis.id
        return (
          <div role="dialog" aria-modal="true" style={{ ...s.overlay, padding: isMobile ? 0 : '1.5rem', alignItems: isMobile ? 'stretch' : 'center', overflow: 'hidden', zIndex: 10020 }} onClick={e => { if (e.target === e.currentTarget) closeVideoAnalysisReview() }}>
            <div style={{ ...s.modal, width: '100%', maxWidth: isMobile ? 'none' : '760px', height: isMobile ? '100dvh' : undefined, maxHeight: isMobile ? '100dvh' : '90vh', boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', border: isMobile ? 'none' : s.modal.border, padding: isMobile ? '1rem' : '1.4rem' }} onClick={e => e.stopPropagation()}>
              {isMobile && (
                <div style={{ minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', margin: '-1rem -1rem 1rem', padding: '0.55rem 1rem', position: 'sticky', top: 0, zIndex: 2, background: '#1c1c18', borderBottom: '1px solid rgba(237,234,226,0.08)', boxSizing: 'border-box' }}>
                  <div style={s.cardLabel}>Gennemgå måling</div>
                  <button onClick={closeVideoAnalysisReview} style={{ ...s.btnGhost, minHeight: 42, padding: '0.35rem 0.65rem', flexShrink: 0 }}>Luk</button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  {!isMobile && <div style={s.cardLabel}>Gennemgå måling</div>}
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? '1.15rem' : '1.4rem', color: '#edeae2', marginTop: isMobile ? 0 : '0.25rem' }}>
                    {VIDEOCOACH_LIFTS[analysis.lift] || analysis.lift} · {videoCoachVariationLabel(analysis.lift, analysis.variation)}
                  </div>
                  <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', marginTop: '0.3rem' }}>
                    {new Date(analysis.analyzed_at).toLocaleDateString('da-DK')} · {analysis.load_kg != null ? `${analysis.load_kg} kg` : 'kg ikke angivet'} · {analysis.reps_count || 0} reps{analysis.rpe != null ? ` · RPE ${analysis.rpe}` : ''}
                  </div>
                  {analysis.source_mode === 'athlete_submission' && <div style={{ color: '#67dff5', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', marginTop: '0.35rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Sendt af atleten</div>}
                </div>
                {!isMobile && <button onClick={closeVideoAnalysisReview} style={{ ...s.btnGhost, padding: '0.28rem 0.55rem', flexShrink: 0 }}>Luk</button>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px,0.8fr) minmax(0,1.2fr)', gap: '0.9rem' }}>
                <div style={{ border: '1px solid rgba(237,234,226,0.09)', background: '#141410', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem' }}>
                  {pathPreview ? (
                    <svg viewBox={pathPreview.viewBox} width="100%" height="260" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
                      <line x1={pathPreview.referenceX} y1={pathPreview.y1} x2={pathPreview.referenceX} y2={pathPreview.y2} stroke="rgba(237,234,226,0.16)" strokeWidth="1" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                      <polyline points={pathPreview.points} fill="none" stroke="#c8923a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={pathPreview.start.x} cy={pathPreview.start.y} r="4" fill="#67dff5" vectorEffect="non-scaling-stroke" />
                      <circle cx={pathPreview.end.x} cy={pathPreview.end.y} r="4" fill="#edeae2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  ) : (
                    <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', lineHeight: 1.5, textAlign: 'center' }}>Ingen gyldig, gemt stangbane på denne analyse.</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                    <span style={{ color: status.color, border: `1px solid ${status.color}55`, padding: '0.22rem 0.45rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase' }}>{status.label}</span>
                    <span style={{ color: Number(analysis.low_conf_pct) > 15 ? '#cf6b4e' : '#7a9f78', border: '1px solid rgba(237,234,226,0.1)', padding: '0.22rem 0.45rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem' }}>Lav tracking-confidence {Number(analysis.low_conf_pct || 0).toLocaleString('da-DK', { maximumFractionDigits: 1 })}%</span>
                    {analysis.position_quality_pct != null && <span style={{ color: Number(analysis.position_quality_pct) > 25 ? '#cf6b4e' : '#7a9f78', border: '1px solid rgba(237,234,226,0.1)', padding: '0.22rem 0.45rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem' }}>Positionsafvigelse {Number(analysis.position_quality_pct).toLocaleString('da-DK', { maximumFractionDigits: 1 })}%</span>}
                  </div>

                  {baselineImpact && (() => {
                    const impactColor = ({
                      ready: '#6cba6c',
                      preliminary: '#c8923a',
                      building: '#67dff5',
                      included: '#7fa188',
                      blocked: '#cf6b4e',
                      excluded: '#7a7770',
                    })[baselineImpact.kind] || '#7a7770'
                    return (
                      <div style={{ borderLeft: `2px solid ${impactColor}`, background: `${impactColor}0a`, padding: '0.6rem 0.7rem', marginBottom: '0.85rem' }}>
                        <div style={{ ...s.fieldLabel, color: impactColor }}>Baseline-effekt</div>
                        <div style={{ color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.7rem', marginTop: '0.2rem' }}>{baselineImpact.title}</div>
                        <div style={{ color: '#8f8b82', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', lineHeight: 1.45, marginTop: '0.22rem' }}>{baselineImpact.detail}</div>
                      </div>
                    )
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.6rem', marginBottom: '0.9rem' }}>
                    {VIDEOCOACH_METRICS.map(def => {
                      const metric = videoCoachMetric(analysis, def.key)
                      if (!metric) return null
                      const baseline = videoCoachBaseline(videoBaselines, analysis, def.key)
                      return <div key={def.key}><div style={s.fieldLabel}>{def.label}</div><div style={{ color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem' }}>{videoCoachMetricText(metric)}</div>{videoCoachBaselineText(baseline, metric) && <div style={{ color: '#7a9f78', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', marginTop: '0.18rem', lineHeight: 1.35 }}>{videoCoachBaselineText(baseline, metric)}</div>}</div>
                    })}
                  </div>

                  {findings.length > 0 && <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '0.75rem' }}><div style={s.fieldLabel}>Fund</div><div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>{findings.map((finding, index) => <div key={finding.id || index} style={{ color: finding.kind === 'focus' ? '#d79a83' : finding.kind === 'works' ? '#8caf88' : '#b8b4a8', fontSize: '0.66rem', lineHeight: 1.45 }}>{finding.summary}</div>)}</div></div>}
                  {baselineSnapshot.length > 0 && <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', lineHeight: 1.45, marginTop: '0.75rem' }}>Personlig baseline blev brugt på {baselineSnapshot.length} tydelig{baselineSnapshot.length === 1 ? 't' : 'e'} signal{baselineSnapshot.length === 1 ? '' : 'er'}.</div>}
                  {plateCalibrationText && <div style={{ color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', lineHeight: 1.45, marginTop: '0.35rem' }}>{plateCalibrationText}</div>}
                </div>
              </div>

              {athleteNote && (
                <div style={{ marginTop: '0.9rem', borderLeft: '2px solid #67dff5', background: 'rgba(103,223,245,0.04)', padding: '0.7rem 0.8rem' }}>
                  <div style={s.fieldLabel}>Atletens notat</div>
                  <div style={{ color: '#c7c3b9', fontSize: '0.7rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: '0.3rem' }}>{athleteNote}</div>
                </div>
              )}

              {feedbackEvidence && (
                <div style={{ marginTop: '0.9rem', borderLeft: '2px solid #c8923a', background: 'rgba(200,146,58,0.045)', padding: '0.7rem 0.8rem' }}>
                  <div style={{ ...s.fieldLabel, color: '#c8923a' }}>Målegrundlag for feedbackudkastet</div>
                  {feedbackEvidence.priority && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{ color: '#edeae2', fontSize: '0.7rem', lineHeight: 1.45 }}>{feedbackEvidence.priority.title}</div>
                      {feedbackEvidence.priority.why && <div style={{ color: '#b8b4a8', fontSize: '0.64rem', lineHeight: 1.5, marginTop: '0.2rem' }}>{feedbackEvidence.priority.why}</div>}
                      <div style={{ color: '#c9b47f', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', lineHeight: 1.45, marginTop: '0.3rem' }}>{feedbackEvidence.priority.evidence}</div>
                    </div>
                  )}
                  {feedbackEvidence.strength && (
                    <div style={{ marginTop: feedbackEvidence.priority ? '0.55rem' : '0.4rem', paddingTop: feedbackEvidence.priority ? '0.5rem' : 0, borderTop: feedbackEvidence.priority ? '1px solid rgba(237,234,226,0.07)' : 'none' }}>
                      <div style={{ color: '#8caf88', fontSize: '0.64rem', lineHeight: 1.45 }}>{feedbackEvidence.strength.title} · {feedbackEvidence.strength.evidence}</div>
                    </div>
                  )}
                  <div style={{ color: '#77746d', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', lineHeight: 1.45, marginTop: '0.45rem' }}>Coach-only · automatisk udgangspunkt, som kan redigeres før deling</div>
                </div>
              )}

              <div style={{ marginTop: '0.9rem', border: '1px solid rgba(103,223,245,0.18)', background: 'rgba(103,223,245,0.035)', padding: '0.75rem 0.8rem' }}>
                <div style={{ ...s.fieldLabel, color: '#67dff5' }}>Det atleten ser</div>
                {feedbackEditable ? (
                  <div style={{ display: 'grid', gap: '0.7rem', marginTop: '0.55rem' }}>
                    {feedbackEditorFields.map(([key, label]) => (
                      <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={s.fieldLabel}>{label}</span>
                        <textarea rows="2" maxLength="600" value={videoAnalysisFeedbackDraft[key]} disabled={updating}
                          placeholder={key === 'works' ? 'Hvad skal atleten tage med som positivt?' : key === 'focus' ? 'Hvad er det vigtigste fokus?' : 'Hvad skal atleten gøre næste gang?'}
                          onChange={event => { setVideoAnalysisFeedbackDraft(current => ({ ...current, [key]: event.target.value })); setVideoAnalysisFeedbackDirty(true); setVideoAnalysisCloseWarning(false) }}
                          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '58px', border: '1px solid rgba(237,234,226,0.12)', background: '#141410', color: '#edeae2', padding: '0.55rem 0.6rem', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.68rem', lineHeight: 1.45 }} />
                      </label>
                    ))}
                    <fieldset disabled={updating} style={{ margin: 0, border: '1px solid rgba(200,146,58,0.2)', background: 'rgba(200,146,58,0.035)', padding: '0.7rem' }}>
                      <legend style={{ ...s.fieldLabel, color: '#c8923a', padding: '0 0.25rem' }}>Personlig baseline · valgfri</legend>
                      <div style={{ color: '#9f9b91', fontSize: '0.6rem', lineHeight: 1.45, marginBottom: '0.5rem' }}>
                        Vælg højst ét kvalitetssikret fund. Intet deles automatisk.
                      </div>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', color: '#b8b4a8', fontSize: '0.64rem', lineHeight: 1.4, cursor: 'pointer' }}>
                        <input type="radio" name={`personal-baseline-${analysis.id}`} checked={!videoAnalysisBaselineFindingId}
                          onChange={() => { setVideoAnalysisBaselineFindingId(''); setVideoAnalysisFeedbackDirty(true); setVideoAnalysisCloseWarning(false) }} />
                        Ingen personlig sammenligning
                      </label>
                      {personalBaselineOptions.map(option => (
                        <label key={option.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', color: '#edeae2', fontSize: '0.64rem', lineHeight: 1.45, cursor: 'pointer', marginTop: '0.5rem' }}>
                          <input type="radio" name={`personal-baseline-${analysis.id}`} checked={videoAnalysisBaselineFindingId === option.id}
                            onChange={() => { setVideoAnalysisBaselineFindingId(option.id); setVideoAnalysisFeedbackDirty(true); setVideoAnalysisCloseWarning(false) }} />
                          <span>
                            <span style={{ display: 'block' }}>{option.text}</span>
                            <span style={{ display: 'block', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', marginTop: '0.18rem' }}>
                              {VIDEOCOACH_METRICS.find(metric => metric.key === option.evidence_ref.metric_key)?.label || 'Målepunkt'} · samme målemetode · n={option.evidence_ref.n_analyses}
                            </span>
                          </span>
                        </label>
                      ))}
                      {personalBaselineOptions.length === 0 && (
                        <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', lineHeight: 1.45, marginTop: '0.45rem' }}>
                          Intet fund opfylder endnu identitets-, metode- og confidencekravene (mindst 3 analyser).
                        </div>
                      )}
                    </fieldset>
                    <div style={{ borderLeft: `2px solid ${feedbackQualityColor}`, background: `${feedbackQualityColor}0b`, padding: '0.6rem 0.7rem' }}>
                      <div style={{ ...s.fieldLabel, color: feedbackQualityColor }}>{feedbackQuality.title}</div>
                      <div style={{ color: '#b8b4a8', fontSize: '0.62rem', lineHeight: 1.45, marginTop: '0.22rem' }}>{feedbackQuality.detail}</div>
                      {feedbackQuality.blockers.length > 1 && <div style={{ color: '#8f8b82', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{feedbackQuality.blockers.slice(1).join(' · ')}</div>}
                    </div>
                    {videoAnalysisCloseWarning && <div style={{ border: '1px solid rgba(200,146,58,0.28)', background: 'rgba(200,146,58,0.065)', color: '#c9b58f', padding: '0.55rem 0.65rem', fontSize: '0.62rem', lineHeight: 1.45 }}>Du har ugemte ændringer. Gem dem, eller vælg Fortryd ændringer før du lukker.</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem' }}>Højst 2 observationer · præcis ét cue til næste sæt</span>
                      <span style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {videoAnalysisFeedbackDirty && <button disabled={updating} onClick={() => discardVideoAnalysisFeedback(analysis)} style={{ ...s.btnGhost, padding: '0.36rem 0.65rem', fontSize: '0.5rem', opacity: updating ? 0.5 : 1 }}>Fortryd ændringer</button>}
                        <button disabled={!videoAnalysisFeedbackDirty || updating} onClick={() => saveVideoAnalysisFeedback(analysis)} style={{ ...s.btnPrimary, padding: '0.36rem 0.65rem', fontSize: '0.5rem', opacity: !videoAnalysisFeedbackDirty || updating ? 0.5 : 1 }}>
                          {updating ? 'Gemmer…' : videoAnalysisFeedbackDirty ? 'Gem feedback' : 'Feedback gemt ✓'}
                        </button>
                      </span>
                    </div>
                  </div>
                ) : athleteFeedbackSections.length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.55rem' }}>
                    {sharedPersonalBaseline && (
                      <div style={{ borderLeft: '2px solid #c8923a', paddingLeft: '0.6rem' }}>
                        <div style={{ ...s.fieldLabel, color: '#c8923a', marginBottom: '0.22rem' }}>Personlig udvikling</div>
                        <div style={{ color: '#c9b47f', fontSize: '0.68rem', lineHeight: 1.45 }}>{sharedPersonalBaseline.text}</div>
                        <div style={{ color: '#77746d', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', marginTop: '0.2rem' }}>Samme løft og variation · n={sharedPersonalBaseline.evidence_ref.n_analyses}</div>
                      </div>
                    )}
                    {athleteFeedbackSections.map(section => (
                      <div key={section.label}>
                        <div style={{ ...s.fieldLabel, marginBottom: '0.22rem' }}>{section.label}</div>
                        {section.items.map((item, index) => <div key={index} style={{ color: section.color, fontSize: '0.68rem', lineHeight: 1.45 }}>{item.text}</div>)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#7a7770', fontSize: '0.66rem', lineHeight: 1.45, marginTop: '0.35rem' }}>Målingen har ingen særskilt tekstfeedback. Atleten vil kun se den godkendte stangbane.</div>
                )}
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(237,234,226,0.08)' }}>
                <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', lineHeight: 1.45, marginBottom: '0.7rem' }}>Reviewet viser den gemte måling. Originalvideoen lagres ikke i appen endnu.</div>
                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {analysis.status === 'draft' && <><button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'invalid')} style={{ ...s.btnGhost, opacity: updating ? 0.55 : 1 }}>{updating ? 'Gemmer…' : 'Udelad måling'}</button><button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'coach_approved')} style={{ ...s.btnPrimary, background: '#4f7d50', opacity: updating ? 0.55 : 1 }}>{updating ? 'Gemmer…' : 'Godkend til baseline'}</button></>}
                  {analysis.status === 'coach_approved' && <><button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'invalid')} style={{ ...s.btnGhost, opacity: updating ? 0.55 : 1 }}>{updating ? 'Gemmer…' : 'Fjern fra baseline'}</button><button disabled={updating || videoAnalysisFeedbackDirty || !feedbackQuality.canShare} onClick={() => reviewVideoAnalysis(analysis, 'shared')} style={{ ...s.btnPrimary, background: '#3f7c87', opacity: updating || videoAnalysisFeedbackDirty || !feedbackQuality.canShare ? 0.5 : 1 }}>{updating ? 'Deler…' : videoAnalysisFeedbackDirty ? 'Gem feedback først' : !feedbackQuality.canShare ? 'Ret feedback først' : 'Del feedback med atlet'}</button></>}
                  {analysis.status === 'shared' && <button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'invalid')} style={{ ...s.btnGhost, opacity: updating ? 0.55 : 1 }}>{updating ? 'Gemmer…' : 'Skjul og udelad måling'}</button>}
                  {analysis.status === 'invalid' && <button disabled={updating} onClick={() => reviewVideoAnalysis(analysis, 'draft')} style={{ ...s.btnGhost, opacity: updating ? 0.55 : 1 }}>{updating ? 'Gemmer…' : 'Tilbage til kladde'}</button>}
                </div>
              </div>
            </div>
          </div>
        )
}

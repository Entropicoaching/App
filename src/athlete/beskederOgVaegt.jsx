// Kropsvaegt (hent/log), beskeder (hent, marker laest, send, tidsformat) og
// coachens delte videofeedback som kort (renderSharedFeedbackCards, bruges paa
// forsiden og i Beskeder) — flyttet uaendret ud af AthleteView.jsx (ordre 373)
// som en fabrik, samme moenster som kostHandlinger.js.
import { supabase } from '../supabase'
import { runGuardedWrite } from '../athleteWriteGuard'
import { runGuardedRead } from '../athleteReadGuard'
import { recordSilentFail } from '../athleteSilentFailLog'
import { videoCoachPersonalBaselineAthleteText, videoCoachPersonalBaselineForAnalysis } from '../videoCoachPersonalFeedback'
import { VIDEOCOACH_LIFT_LABELS as ATHLETE_VIDEO_LIFTS, videoCoachVariationLabel as athleteVideoVariationLabel } from '../videoCoachLabels'
import { s, today } from '../athleteShared'
import { athleteVideoPathPreview } from './videoCoachBro'
import { logFrontendError } from './ugeHjaelp'

export function lavBeskederOgVaegt({
  athlete, messageInput, msgTrack, onReadError, openSharedVideoId, setMessageInput, setMessages, setOpenSharedVideoId,
  setSavingWeight, setSharedVideoAnalyses, setUnreadMsgCount, setWeightInput, setWeightLogs, sharedVideoAnalyses, showFlash, weightInput,
  weightLogs,
}) {
  async function fetchWeightLogs(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('weight_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('logged_at', { ascending: false })
        .limit(30),
      onReadError('Vægtloggen', athleteId),
    )
    if (!ok) return
    setWeightLogs(data || [])
  }

  // G15 (ordre 131): var før et rent "fyr og glem" — feltet blev ryddet og
  // ingen fejl vist uanset om skrivningen lykkedes. En fejlet vægtlogning så
  // derfor ud som en gemt vægt; kun et efterfølgende (uændret) tal i grafen
  // afslørede det, og kun hvis atleten selv lagde mærke til det.
  async function logWeight() {
    if (!weightInput || !athlete) return
    setSavingWeight(true)
    const todayStr = today()
    const existing = weightLogs.find(l => l.logged_at === todayStr)
    const ok = await runGuardedWrite(
      () => existing
        ? supabase.from('weight_logs').update({ weight: parseFloat(weightInput) }).eq('id', existing.id)
        : supabase.from('weight_logs').insert({ athlete_id: athlete.id, weight: parseFloat(weightInput), logged_at: todayStr }),
      error => {
        logFrontendError('logWeight fejlede', error, athlete.id)
        recordSilentFail(athlete.id, 'silent:weight-log-failed')
        showFlash('Vægten blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error')
      },
    )
    setSavingWeight(false)
    if (!ok) return // input bevares bevidst, så atleten ikke skal taste tallet igen
    setWeightInput('')
    fetchWeightLogs(athlete.id)
  }

  async function fetchAthleteMessages(id) {
    const athleteId = id || athlete?.id
    if (!athleteId) return
    const { data, ok } = await runGuardedRead(
      () => supabase.from('messages').select('*').eq('athlete_id', athleteId).order('created_at'),
      onReadError('Beskederne', athleteId),
    )
    if (!ok) return
    const msgs = data || []
    setMessages(msgs)
    const unread = msgs.filter(m => m.sender_role === 'coach' && !m.read_at).length
    setUnreadMsgCount(unread)
  }

  // Markér ét spor som set: coach-beskeder i sporet (read_at) og — for teknik —
  // også de delte målinger (athlete_seen_at), så coachen kan se at feedback er set.
  async function markTrackRead(track) {
    if (!athlete) return
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('athlete_id', athlete.id)
      .eq('sender_role', 'coach')
      .eq('category', track)
      .is('read_at', null)
    fetchAthleteMessages(athlete.id)
  }

  // Markér én delt måling som set når atleten åbner den ("Se måling"), så
  // coachen kan se at feedbacken faktisk er set (parity med read_by_coach).
  async function markVideoSeen(id) {
    const target = sharedVideoAnalyses.find(a => a.id === id)
    if (!target || target.athlete_seen_at) return
    const now = new Date().toISOString()
    // Fejl her (RLS/net) må ikke vælte visningen; prøves igen næste åbning.
    const { error } = await supabase.from('video_analyses').update({ athlete_seen_at: now }).eq('id', id)
    if (!error) setSharedVideoAnalyses(prev => prev.map(a => a.id === id ? { ...a, athlete_seen_at: now } : a))
  }

  async function sendAthleteMessage() {
    if (!messageInput.trim() || !athlete) return
    const content = messageInput.trim()
    // Ryd IKKE feltet før skrivningen er bekræftet — ellers ser en fejlet
    // afsendelse ud som en succes, og beskeden er væk uden mulighed for at prøve igen.
    const ok = await runGuardedWrite(
      () => supabase.from('messages').insert({ athlete_id: athlete.id, sender_role: 'athlete', content, category: msgTrack }),
      () => showFlash('Beskeden blev ikke sendt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    setMessageInput('')
    fetchAthleteMessages(athlete.id)
  }

  function formatMsgTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayDiff = Math.floor((today - msgDay) / 86400000)
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    if (dayDiff === 0) return time
    if (dayDiff === 1) return `I går ${time}`
    if (dayDiff < 7) return d.toLocaleDateString('da-DK', { weekday: 'long' }) + ' ' + time
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  // Coachens delte videofeedback som udfoldelige kort (én kilde: video_analyses).
  // Bruges både på hjem og i "Teknik & løft"-sporet — "se måling" udfolder banen.
  const renderSharedFeedbackCards = () => (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      {sharedVideoAnalyses.map(analysis => {
        const open = openSharedVideoId === analysis.id
        const preview = athleteVideoPathPreview(analysis.bar_path)
        const feedback = analysis.athlete_feedback || {}
        const works = Array.isArray(feedback.works) ? feedback.works.filter(item => item?.text).slice(0, 2) : []
        const focus = Array.isArray(feedback.focus) ? feedback.focus.filter(item => item?.text).slice(0, 2) : []
        const nextSet = Array.isArray(feedback.next_set) ? feedback.next_set.filter(item => item?.text).slice(0, 2) : []
        const personalBaseline = videoCoachPersonalBaselineForAnalysis(feedback, analysis,
          athlete?.id)
        return (
          <div key={analysis.id} style={{ border: '1px solid rgba(237,234,226,0.08)', background: 'rgba(20,20,16,0.55)' }}>
            <button onClick={() => { const opening = !open; setOpenSharedVideoId(opening ? analysis.id : null); if (opening) markVideoSeen(analysis.id) }} style={{ width: '100%', border: 0, background: 'transparent', color: '#edeae2', cursor: 'pointer', padding: '0.75rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.7rem' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.78rem' }}>
                  {!analysis.athlete_seen_at && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#c8923a', marginRight: 6, verticalAlign: 'middle' }} />}
                  {ATHLETE_VIDEO_LIFTS[analysis.lift] || analysis.lift} · {athleteVideoVariationLabel(analysis.lift, analysis.variation)}
                </span>
                <span style={{ display: 'block', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', marginTop: '0.25rem' }}>
                  {new Date(analysis.analyzed_at).toLocaleDateString('da-DK')}{analysis.load_kg != null ? ` · ${analysis.load_kg} kg` : ''}{analysis.reps_count ? ` · ${analysis.reps_count} reps` : ''}{analysis.rpe != null ? ` · RPE ${analysis.rpe}` : ''}
                </span>
              </span>
              <span style={{ color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {open ? 'Skjul' : 'Se måling'}<span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
              </span>
            </button>
            {open && (
              <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem' }}>
                {preview && (
                  <div style={{ minHeight: '170px', background: '#141410', border: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem' }}>
                    <svg viewBox={preview.viewBox} width="100%" height="170" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
                      <line x1={preview.referenceX} y1={preview.y1} x2={preview.referenceX} y2={preview.y2} stroke="rgba(237,234,226,0.14)" strokeWidth="1" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                      <polyline points={preview.points} fill="none" stroke="#c8923a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={preview.start.x} cy={preview.start.y} r="4" fill="#67dff5" vectorEffect="non-scaling-stroke" />
                      <circle cx={preview.end.x} cy={preview.end.y} r="4" fill="#edeae2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                )}
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {personalBaseline && <div style={{ borderLeft: '2px solid #c8923a', background: 'rgba(200,146,58,0.04)', padding: '0.55rem 0.65rem' }}><div style={{ ...s.fieldLabel, color: '#c8923a' }}>Din udvikling</div><div style={{ color: '#c9b47f', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{videoCoachPersonalBaselineAthleteText(personalBaseline)}</div><div style={{ color: '#77746d', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', lineHeight: 1.4, marginTop: '0.25rem' }}>Sammenlignet med {personalBaseline.evidence_ref.n_analyses} kvalitetssikrede analyser af samme løft og variation.</div></div>}
                  {works.length > 0 && <div><div style={s.fieldLabel}>Det fungerer</div>{works.map((item, index) => <div key={index} style={{ color: '#9fbd9a', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{item.text}</div>)}</div>}
                  {focus.length > 0 && <div><div style={s.fieldLabel}>Dit fokus</div>{focus.map((item, index) => <div key={index} style={{ color: '#d79a83', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{item.text}</div>)}</div>}
                  {nextSet.length > 0 && <div><div style={s.fieldLabel}>Næste gang</div>{nextSet.map((item, index) => <div key={index} style={{ color: '#c9b47f', fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{item.text}</div>)}</div>}
                  {!works.length && !focus.length && !nextSet.length && <div style={{ color: '#7a7770', fontSize: '0.66rem', lineHeight: 1.45 }}>Coachen har delt målingen uden en særskilt tekstkommentar.</div>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return {
    fetchWeightLogs, logWeight, fetchAthleteMessages, markTrackRead, sendAthleteMessage, formatMsgTime, renderSharedFeedbackCards,
  }
}

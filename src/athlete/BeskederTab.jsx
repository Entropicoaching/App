// Beskeder-fanen (coach-tråd + delt videofeedback) — udskilt fra
// AthleteView.jsx (ordre 232 · commit 3) som sin egen lazy-loadede chunk,
// samme LazyBoundary-mønster som Dashboard.jsx's fire faner (130/163/228)
// og src/athlete/MobiliseringTab.jsx + StaevnedagTab.jsx (232 · commit 2).
// Ren udflytning af JSX'en — ingen logikændring, kun frie variable gjort
// eksplicitte som props. `renderSharedFeedbackCards` og `formatMsgTime`
// bruges også af HJEM-fanen (eager) og bliver derfor i AthleteView.jsx,
// sendt ned som props.
import { s } from '../athleteShared'

export default function BeskederTab({
  fetchSharedVideoAnalyses, formatMsgTime, messageInput, messagesEndRef, messages,
  msgTrack, renderSharedFeedbackCards, sendAthleteMessage, setMessageInput, setMsgTrack,
  sharedVideoAnalyses, sharedVideoError, sharedVideoLoading,
}) {
          const trackOf = m => (m.category || 'besked') === 'teknik' ? 'teknik' : 'besked'
          const shown = messages.filter(m => trackOf(m) === msgTrack)
          const pinnedShown = messages.filter(m => m.pinned && trackOf(m) === msgTrack)
          const beskedUnread = messages.filter(m => trackOf(m) === 'besked' && m.sender_role === 'coach' && !m.read_at).length
          const teknikMsgUnread = messages.filter(m => trackOf(m) === 'teknik' && m.sender_role === 'coach' && !m.read_at).length
          const teknikUnread = teknikMsgUnread + sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length
          const trackTab = (id, label, count) => {
            const on = msgTrack === id
            return (
              <button onClick={() => setMsgTrack(id)} style={{ flex: 1, padding: '0.55rem 0.5rem', background: on ? 'rgba(200,146,58,0.12)' : 'transparent', border: `1px solid ${on ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.1)'}`, color: on ? '#c8923a' : '#7a7770', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                {label}
                {count > 0 && <span style={{ background: '#c8923a', color: '#141410', borderRadius: 999, minWidth: 15, height: 15, fontSize: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{count}</span>}
              </button>
            )
          }
          return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Beskeder</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Din coach.</h1>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                {trackTab('teknik', 'Teknik & løft', teknikUnread)}
                {trackTab('besked', 'Beskeder', beskedUnread)}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', lineHeight: 1.5, marginBottom: '0.8rem' }}>
                {msgTrack === 'teknik'
                  ? 'Til spørgsmål om teknik og løft, og til coachens videofeedback.'
                  : 'Til alt andet — status, spørgsmål og det der ellers fylder.'}
              </div>

              <div style={s.card}>
                {/* Teknik-spor: coachens delte videofeedback inline (kilde: video_analyses) */}
                {msgTrack === 'teknik' && (
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.7rem', marginBottom: '0.7rem' }}>
                      <div style={{ ...s.cardLabel }}>Videofeedback fra din coach</div>
                      {!sharedVideoLoading && <button onClick={fetchSharedVideoAnalyses} style={{ ...s.btnGhost, padding: '0.3rem 0.55rem', fontSize: '0.5rem', flexShrink: 0 }}>Opdatér</button>}
                    </div>
                    {sharedVideoLoading && <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', padding: '0.4rem 0' }}>Henter analyser…</div>}
                    {sharedVideoError && !sharedVideoLoading && <div style={{ color: '#d79a83', fontSize: '0.66rem', lineHeight: 1.45 }}>{sharedVideoError}</div>}
                    {!sharedVideoLoading && !sharedVideoError && sharedVideoAnalyses.length === 0 && (
                      <div style={{ color: '#7a7770', fontSize: '0.66rem', lineHeight: 1.5 }}>Ingen delte målinger endnu. Send et løft via VideoCoach, så dukker coachens feedback op her.</div>
                    )}
                    {!sharedVideoLoading && !sharedVideoError && sharedVideoAnalyses.length > 0 && renderSharedFeedbackCards()}
                  </div>
                )}

                {/* Pinned (i det aktive spor) */}
                {pinnedShown.length > 0 && (
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                      </svg>
                      Fastgjorte beskeder
                    </div>
                    {pinnedShown.map(msg => (
                      <div key={msg.id} style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.18)', padding: '0.65rem 0.75rem', marginBottom: '0.4rem' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                          {msg.sender_role === 'coach' ? 'Coach' : 'Dig'} · {formatMsgTime(msg.created_at)}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.55 }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message thread (aktivt spor) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '460px', overflowY: 'auto' }}>
                  {shown.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', color: '#4a4844', marginBottom: '0.4rem' }}>{msgTrack === 'teknik' ? 'Ingen teknik-beskeder endnu.' : 'Ingen beskeder endnu.'}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', lineHeight: 1.7 }}>{msgTrack === 'teknik' ? 'Skriv til din coach om teknik og løft her.' : 'Din coach vil skrive til dig her.'}</div>
                    </div>
                  ) : shown.map(msg => {
                    const isMe = msg.sender_role === 'athlete'
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.4rem' }}>
                        <div style={{ maxWidth: '78%' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem', textAlign: isMe ? 'right' : 'left' }}>
                            {formatMsgTime(msg.created_at)}
                          </div>
                          <div style={{
                            background: isMe ? 'rgba(200,146,58,0.11)' : '#141410',
                            border: isMe ? '1px solid rgba(200,146,58,0.22)' : '1px solid rgba(237,234,226,0.07)',
                            padding: '0.6rem 0.8rem',
                            fontSize: '0.88rem',
                            color: '#edeae2',
                            lineHeight: 1.55,
                          }}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send input (sender i det aktive spor) */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
                  <input
                    style={{ ...s.fieldInput, flex: 1 }}
                    type="text"
                    placeholder={msgTrack === 'teknik' ? 'Skriv om teknik eller løft…' : 'Skriv en besked til din coach...'}
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAthleteMessage()}
                  />
                  <button style={s.btnPrimary} onClick={sendAthleteMessage}>Send</button>
                </div>
              </div>
            </>
          )
}

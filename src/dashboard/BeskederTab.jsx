// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Beskeder: spor, fastgjorte og tråd, send.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function BeskederTab({
  a, coachMsgTrack, fetchMessages, formatMsgTime, messageInput, messages,
  messageSendError, messageThreadError, sendCoachMessage, sendingMessage, setCoachMsgTrack, setMessageInput,
  setMessageSendError, togglePin,
}) {
              const trackOf = m => (m.category || 'besked') === 'teknik' ? 'teknik' : 'besked'
              const shownMsgs = messages.filter(m => trackOf(m) === coachMsgTrack)
              const pinnedMsgs = messages.filter(m => m.pinned && trackOf(m) === coachMsgTrack)
              const beskedUnread = messages.filter(m => trackOf(m) === 'besked' && m.sender_role === 'athlete' && !m.read_by_coach).length
              const teknikUnread = messages.filter(m => trackOf(m) === 'teknik' && m.sender_role === 'athlete' && !m.read_by_coach).length
              const trackTab = (id, label, count) => {
                const on = coachMsgTrack === id
                return (
                  <button disabled={sendingMessage} onClick={() => { setCoachMsgTrack(id); setMessageSendError(null) }} style={{ flex: 1, padding: '0.5rem', background: on ? 'rgba(200,146,58,0.12)' : 'transparent', border: `1px solid ${on ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.1)'}`, color: on ? '#c8923a' : '#7a7770', cursor: sendingMessage ? 'default' : 'pointer', opacity: sendingMessage ? 0.6 : 1, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    {label}
                    {count > 0 && <span style={{ background: '#c8923a', color: '#141410', borderRadius: 999, minWidth: 15, height: 15, fontSize: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{count}</span>}
                  </button>
                )
              }
              return (
              <div style={s.card}>
                <div style={s.cardLabel}>Beskeder med {a.name}</div>

                <div style={{ display: 'flex', gap: '0.4rem', margin: '0.6rem 0 1rem' }}>
                  {trackTab('teknik', 'Teknik & løft', teknikUnread)}
                  {trackTab('besked', 'Beskeder', beskedUnread)}
                </div>
                {coachMsgTrack === 'teknik' && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#7a7770', letterSpacing: '0.05em', marginBottom: '0.9rem', lineHeight: 1.5 }}>
                    Tekniske cues og formsnak. Videoanalyser gennemgås og deles via review-køen.
                  </div>
                )}

                {messageThreadError && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.9rem', padding: '0.55rem 0.6rem', border: '1px solid rgba(224,85,85,0.18)', background: 'rgba(224,85,85,0.035)' }}>
                    <span style={{ color: '#d79a83', fontSize: '0.64rem', lineHeight: 1.45 }}>{messageThreadError}</span>
                    <button onClick={() => fetchMessages(a.id)} style={{ ...s.btnGhost, minHeight: 34, padding: '0.3rem 0.55rem', fontSize: '0.45rem', flexShrink: 0 }}>Prøv igen</button>
                  </div>
                )}

                {/* Pinned messages (aktivt spor) */}
                {pinnedMsgs.length > 0 && (
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                      </svg>
                      Fastgjorte
                    </div>
                    {pinnedMsgs.map(msg => (
                      <div key={msg.id} style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.18)', padding: '0.65rem 0.75rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                            {msg.sender_role === 'coach' ? 'Coach' : a.name} · {formatMsgTime(msg.created_at)}
                          </div>
                          <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.55 }}>{msg.content}</div>
                        </div>
                        <button onClick={() => togglePin(msg.id, msg.pinned)} title="Løsn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8923a', padding: '0.1rem', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M5 17H19V13L15 9V4H9V9L5 13V17Z M12 17v5" strokeWidth="2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message thread */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {!messageThreadError && shownMsgs.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>{coachMsgTrack === 'teknik' ? 'Ingen teknik-beskeder endnu.' : 'Ingen beskeder endnu.'}</div>
                  ) : shownMsgs.map(msg => {
                    const isCoach = msg.sender_role === 'coach'
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: isCoach ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.4rem' }}>
                        <div style={{ maxWidth: '72%' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem', textAlign: isCoach ? 'right' : 'left' }}>
                            {formatMsgTime(msg.created_at)}
                          </div>
                          <div style={{
                            background: isCoach ? 'rgba(200,146,58,0.11)' : '#1c1c18',
                            border: isCoach ? '1px solid rgba(200,146,58,0.22)' : '1px solid rgba(237,234,226,0.07)',
                            padding: '0.6rem 0.8rem',
                            fontSize: '0.88rem',
                            color: '#edeae2',
                            lineHeight: 1.55,
                          }}>
                            {msg.content}
                          </div>
                        </div>
                        <button
                          onClick={() => togglePin(msg.id, msg.pinned)}
                          title={msg.pinned ? 'Løsn' : 'Fastgør'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.pinned ? '#c8923a' : '#2e2e2a', padding: '0.3rem', flexShrink: 0, marginBottom: '0.1rem', transition: 'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#c8923a'}
                          onMouseLeave={e => e.currentTarget.style.color = msg.pinned ? '#c8923a' : '#2e2e2a'}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill={msg.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Send input */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
                  <input
                    style={{ ...s.fieldInput, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder={coachMsgTrack === 'teknik' ? 'Teknik-cue eller formsnak…' : 'Skriv en besked...'}
                    value={messageInput}
                    disabled={sendingMessage}
                    onChange={e => { setMessageInput(e.target.value); if (messageSendError) setMessageSendError(null) }}
                    onKeyDown={e => e.key === 'Enter' && sendCoachMessage()}
                  />
                  <button style={{ ...s.btnPrimary, opacity: sendingMessage ? 0.6 : 1 }} disabled={sendingMessage} onClick={sendCoachMessage}>{sendingMessage ? 'Sender…' : 'Send'}</button>
                </div>
                {messageSendError && <div style={{ color: '#d79a83', fontSize: '0.64rem', lineHeight: 1.45, marginTop: '0.55rem' }}>{messageSendError}</div>}
              </div>
              )
}

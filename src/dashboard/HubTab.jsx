// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Hjem (hub): statuslinje og sektionsgitter.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { readinessSignal, s } from '../dashboardShared'
import { HUB_SECTIONS } from './hubSektioner'

export default function HubTab({
  a, athleteReadiness, isMobile, setActiveTab, setEditing, unreadCounts,
  videoAnalyses, weeklyActivity,
}) {
              const todayStr = new Date().toISOString().slice(0, 10)
              const todayR = athleteReadiness.find(r => r.logged_date === todayStr)
              const sig = todayR && todayR.readiness_score != null ? readinessSignal(todayR.readiness_score) : null
              const trainings = weeklyActivity[a.id]?.sessions ?? 0
              const unread = unreadCounts[a.id] ?? 0
              const pendingVideoCount = videoAnalyses.filter(item => item.status === 'draft').length
              const compDate = a.competition_date
              const weeksToComp = compDate ? Math.ceil((new Date(compDate + 'T12:00:00') - new Date()) / (7 * 24 * 3600 * 1000)) : null
              const stat = [
                sig && { label: 'Parathed i dag', value: todayR.readiness_score, sub: sig.text, color: sig.color },
                { label: 'Træninger denne uge', value: trainings, sub: weeklyActivity[a.id]?.sets ? `${weeklyActivity[a.id].sets} sæt` : 'logget', color: '#edeae2' },
                { label: 'Ulæste beskeder', value: unread, sub: unread > 0 ? 'fra atleten' : 'ingen nye', color: unread > 0 ? '#c8923a' : '#7a7770' },
                pendingVideoCount > 0 && { label: 'Målinger til review', value: pendingVideoCount, sub: 'afventer dig', color: '#67dff5' },
                weeksToComp != null && { label: 'Til stævne', value: weeksToComp > 0 ? weeksToComp : '0', sub: weeksToComp > 0 ? 'uger' : 'passeret', color: '#c8923a' },
              ].filter(Boolean)
              return (
                <div>
                  {/* Statuslinje */}
                  {stat.length > 0 && (
                    <div style={{ ...s.card, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${stat.length}, 1fr)`, gap: '1rem' }}>
                      {stat.map((st, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderLeft: i > 0 && !isMobile ? '1px solid rgba(237,234,226,0.07)' : 'none', paddingLeft: i > 0 && !isMobile ? '1rem' : 0 }}>
                          <div style={s.fieldLabel}>{st.label}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: st.color, lineHeight: 1 }}>{st.value}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.06em' }}>{st.sub}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sektionsgitter */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '1rem' }}>
                    {HUB_SECTIONS.map(sec => (
                      <button
                        key={sec.key}
                        onClick={() => { setActiveTab(sec.key); setEditing(null) }}
                        style={{
                          background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', textAlign: 'left',
                          padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.6rem',
                          position: 'relative', transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,146,58,0.4)'; e.currentTarget.style.background = '#211f1a' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'; e.currentTarget.style.background = '#1c1c18' }}
                      >
                        <div style={{ color: '#c8923a' }}>{sec.icon}</div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '1rem', color: '#edeae2', fontWeight: 400 }}>{sec.label}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770', letterSpacing: '0.04em', lineHeight: 1.4 }}>{sec.desc}</div>
                        {sec.key === 'beskeder' && unread > 0 && (
                          <span style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.55rem', padding: '0.1rem 0.4rem', fontWeight: 600 }}>{unread}</span>
                        )}
                        {sec.key === 'analyse' && pendingVideoCount > 0 && (
                          <span style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#67dff5', color: '#141410', borderRadius: '999px', fontSize: '0.55rem', padding: '0.1rem 0.4rem', fontWeight: 600 }}>{pendingVideoCount}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
}

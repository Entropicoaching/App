// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilens hoved: tilbage/kø-kontekst, aktuel opgave, profilkort, sektions-navigation.
// Samme navne som props som i Dashboard; linjerne står i et fragment (ingen DOM-ændring).
import { s, initials, formatLastSeen } from '../dashboardShared'
import { statusLabels } from './coachKonstanter'
import { HUB_SECTIONS } from './hubSektioner'

export default function ProfilHoved({
  a, activeTab, isMobile, navMenuOpen, nextPriorityItem, openCoachPriorityItem,
  priorityQueueContext, profilePriorityContext, profileReturnView, profilesLastSeen, setActiveTab, setEditing,
  setNavMenuOpen, setShowDeleteModal, setView, showFlash, unreadCounts,
}) {
  return (
    <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <button onClick={() => setView(profileReturnView)} style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', cursor: 'pointer', padding: 0 }}>
                ← Tilbage til {profileReturnView === 'inbox' ? 'indbakken' : 'atleter'}
              </button>
              {priorityQueueContext && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: priorityQueueContext.state === 'complete' ? '#6cba6c' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {priorityQueueContext.state === 'complete'
                      ? 'Køen er ryddet ✓'
                      : priorityQueueContext.state === 'last'
                        ? 'Sidste opgave'
                        : `${priorityQueueContext.remainingCount} tilbage${priorityQueueContext.currentOpen ? ' efter denne' : ''}`}
                  </span>
                  {nextPriorityItem && (
                    <button onClick={() => openCoachPriorityItem(nextPriorityItem, 'inbox')}
                      style={{ ...s.btnGhost, minHeight: 36, padding: '0.35rem 0.6rem', fontSize: '0.46rem', flexShrink: 0 }}>
                      Næste opgave →
                    </button>
                  )}
                </div>
              )}
            </div>

            {profilePriorityContext && (
              <div style={{ ...s.card, marginBottom: '1rem', padding: '0.75rem 0.85rem', borderColor: `${profilePriorityContext.color}38`, background: `${profilePriorityContext.color}08` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: profilePriorityContext.color, boxShadow: `0 0 0 3px ${profilePriorityContext.color}16` }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770' }}>Aktuel opgave</span>
                  <span style={{ color: profilePriorityContext.color, border: `1px solid ${profilePriorityContext.color}44`, padding: '0.08rem 0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{profilePriorityContext.label}</span>
                </div>
                <div style={{ color: '#d8d4ca', fontSize: '0.72rem', lineHeight: 1.45 }}>{profilePriorityContext.summary}</div>
                {profilePriorityContext.detail && <div style={{ color: '#7a7770', fontSize: '0.64rem', lineHeight: 1.45, marginTop: '0.22rem' }}>{profilePriorityContext.detail}</div>}
              </div>
            )}

            <div style={{ ...s.card, display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : 'auto 1fr auto', alignItems: 'center', gap: isMobile ? '0.85rem' : '1.5rem', marginBottom: '1.5rem', ...(isMobile ? { flexWrap: 'wrap', padding: '0.85rem 1rem' } : {}) }}>
              <div style={{ ...s.avatar, width: isMobile ? '44px' : '56px', height: isMobile ? '44px' : '56px', fontSize: isMobile ? '1rem' : '1.3rem', flexShrink: 0 }}>{initials(a.name)}</div>
              <div style={isMobile ? { flex: 1, minWidth: 0 } : undefined}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 400, color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>{a.name}</div>
                {!isMobile && <div style={{ fontSize: '0.8rem', color: '#7a7770', marginTop: '0.2rem' }}>{a.email}{a.age ? ' · ' + a.age + ' år' : ''}</div>}
                {/* Det lange atlet-ID er skjult på mobil — det bruges kun til scripts på desktop */}
                {!isMobile && <div
                  onClick={() => { navigator.clipboard?.writeText(a.id); showFlash('Atlet-ID kopieret') }}
                  title="Klik for at kopiere — bruges som athleteId i cowork-scripts"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#4a4844', marginTop: '0.3rem', cursor: 'pointer', wordBreak: 'break-all' }}
                >
                  <span>ID: {a.id}</span>
                  <span style={{ color: '#7a7770' }}>⧉</span>
                </div>}
                {(() => {
                  const ls = formatLastSeen(profilesLastSeen[a.user_id])
                  if (!ls) return null
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ls.dotColor, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.07em', color: ls.dotColor }}>{ls.text}</span>
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={s.badge(a.status)}>{statusLabels[a.status]}</span>
                <button style={s.btnDanger} onClick={() => setShowDeleteModal(true)}>Fjern</button>
              </div>
            </div>

            {/* Sektions-navigation: de sektioner man bruger dagligt står som
                tydelige TEKST-faner; resten ligger i en "Mere"-menu. Erstatter den
                gamle ikon-kun-bar, hvor man ikke kunne se hvad hver knap var. */}
            {(() => {
              const navItems = [{ key: 'hub', label: 'Hjem' }, ...HUB_SECTIONS]
              const EMOJI = { hub: '🏠', oversigt: '📊', kost: '🍽️', program: '🏋️', log: '📓', analyse: '📈', opvarmning: '🔥', stævne: '🏆', noter: '🗒️', beskeder: '💬' }
              const PRIMARY = ['hub', 'program', 'log', 'beskeder']
              const primary = PRIMARY.map(k => navItems.find(n => n.key === k)).filter(Boolean)
              const more = navItems.filter(n => !PRIMARY.includes(n.key))
              const activeInMore = more.some(n => n.key === activeTab)
              const activeMoreLabel = more.find(n => n.key === activeTab)?.label
              const go = (key) => { setActiveTab(key); setEditing(null); setNavMenuOpen(false) }
              const tabBtn = (active) => ({
                position: 'relative', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
                fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: isMobile ? '0.6rem 0.7rem' : '0.65rem 1.1rem', cursor: 'pointer',
                color: active ? '#c8923a' : '#7a7770', background: 'none', border: 'none',
                borderBottom: active ? '2px solid #c8923a' : '2px solid transparent',
                marginBottom: '-1px', whiteSpace: 'nowrap',
              })
              return (
                <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    {primary.map(n => {
                      const active = activeTab === n.key
                      return (
                        <button
                          key={n.key}
                          onClick={() => go(n.key)}
                          style={tabBtn(active)}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#b8b4a8' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#7a7770' }}
                        >
                          <span style={{ marginRight: '0.35rem' }}>{EMOJI[n.key]}</span>{n.label}
                          {n.key === 'beskeder' && unreadCounts[a.id] > 0 && (
                            <span style={{ position: 'absolute', top: '0.15rem', right: '0.05rem', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.45rem', minWidth: '0.85rem', height: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, padding: '0 0.15rem' }}>{unreadCounts[a.id]}</span>
                          )}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setNavMenuOpen(o => !o)}
                      style={{ ...tabBtn(activeInMore), display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      onMouseEnter={e => { if (!activeInMore) e.currentTarget.style.color = '#b8b4a8' }}
                      onMouseLeave={e => { if (!activeInMore) e.currentTarget.style.color = '#7a7770' }}
                    >
                      {activeInMore ? <><span style={{ marginRight: '0.35rem' }}>{EMOJI[activeTab]}</span>{activeMoreLabel}</> : 'Mere'}
                      <span style={{ fontSize: '0.5rem', transform: navMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                    </button>
                  </div>

                  {navMenuOpen && (
                    <>
                      {/* usynligt lag: klik udenfor lukker menuen */}
                      <div onClick={() => setNavMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem', zIndex: 41, background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', minWidth: '11rem', padding: '0.3rem 0' }}>
                        {more.map(n => {
                          const active = activeTab === n.key
                          return (
                            <button
                              key={n.key}
                              onClick={() => go(n.key)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.6rem 1rem', cursor: 'pointer', background: active ? 'rgba(200,146,58,0.1)' : 'none', border: 'none', borderLeft: active ? '2px solid #c8923a' : '2px solid transparent', color: active ? '#c8923a' : '#b8b4a8' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#edeae2' }}
                              onMouseLeave={e => { e.currentTarget.style.color = active ? '#c8923a' : '#b8b4a8' }}
                            >
                              <span style={{ display: 'inline-block', width: '1.5rem' }}>{EMOJI[n.key]}</span>{n.label}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
    </>
  )
}

// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Sidebaren: logo, menupunkter, atletliste, "Se som atlet", Værktøjer.
// Samme navne som props som i Dashboard; linjerne står i et fragment (ingen DOM-ændring).
import { s, initials } from '../dashboardShared'
import { holidayInfo, ferieBadgeLabel } from './coachKonstanter'
import { signOutHard } from '../supabase'

export default function Sidebar({
  athletes, athleteWeekSummary, coachPriorityCount, exportBackup, exportingBackup, exportingTraening,
  exportTraeningsdata, goToMyProfile, hiddenAthleteIds, isMobile, lastBackup, onPreviewAthlete,
  openProfile, openVideoCoachV3, pickingMine, previewPickerOpen, selectedAthlete, setMyAthleteId,
  setPickingMine, setPreviewPickerOpen, setSelectedAthlete, setSidebarMoreOpen, setSidebarOpen, setView,
  sidebarMoreOpen, sidebarOpen, todayData, unreadCounts, view,
}) {
  return (
    <>
      {isMobile && sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 199 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside style={{
        ...s.sidebar,
        ...(isMobile ? {
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          zIndex: 200,
        } : {}),
      }}>
        <div style={{ ...s.sidebarLogo, cursor: 'pointer' }} onClick={() => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false) }}>
          <div style={s.wordmark}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
          <div style={s.sub}>Coach Portal</div>
        </div>
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {[
            { icon: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>, label: 'Forside', active: view === 'list', onClick: () => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />, label: 'Min træning', active: false, onClick: () => { setSidebarOpen(false); goToMyProfile() } },
            { icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>, label: 'Kalender', active: view === 'calendar', onClick: () => { setView('calendar'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, label: 'Coach Briefing', active: view === 'inbox', badge: coachPriorityCount, onClick: () => { setView('inbox'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>, label: 'Bibliotek', active: view === 'library', onClick: () => { setView('library'); setSelectedAthlete(null); setSidebarOpen(false) } },
          ].map(item => (
            <div
              key={item.label}
              onClick={item.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 1.25rem', cursor: 'pointer', borderLeft: item.active ? '2px solid #c8923a' : '2px solid transparent', background: item.active ? 'rgba(200,146,58,0.08)' : 'transparent', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: item.active ? '#c8923a' : '#b8b4a8' }}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = 'rgba(237,234,226,0.03)' }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{item.icon}</svg>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ background: '#c8923a', color: '#141410', fontSize: '0.46rem', fontWeight: 700, borderRadius: '999px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{item.badge}</span>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(237,234,226,0.06)', margin: '0.75rem 1.25rem' }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', padding: '0 1.25rem', marginBottom: '0.45rem' }}>Atleter</div>
          {athletes.filter(a => !hiddenAthleteIds.has(a.id)).map(ath => {
            const isActive = (view === 'profile' || view === 'list') && selectedAthlete?.id === ath.id
            const unread = unreadCounts[ath.id] || 0
            const ws = athleteWeekSummary[ath.id]
            const hol = holidayInfo(ath)
            const trainedToday = todayData.logs.some(l => l.athlete_id === ath.id)
            const ringColor = hol?.onHoliday ? 'rgba(91,155,181,0.6)' : unread > 0 ? 'rgba(200,146,58,0.7)' : trainedToday ? 'rgba(108,186,108,0.6)' : 'rgba(237,234,226,0.12)'
            return (
              <div
                key={ath.id}
                onClick={() => { openProfile(ath); setSidebarOpen(false) }}
                style={{ padding: '0.4rem 1.25rem', cursor: 'pointer', borderLeft: isActive ? '2px solid #c8923a' : '2px solid transparent', background: isActive ? 'rgba(200,146,58,0.08)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(237,234,226,0.03)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${ringColor}`, background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: isActive ? '#c8923a' : '#b8b4a8' }}>
                  {initials(ath.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.78rem', color: isActive ? '#c8923a' : '#d5d2c8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ath.name.split(' ')[0]}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#5f5c55', marginTop: '0.05rem', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hol?.onHoliday ? ferieBadgeLabel(hol) : ws ? `Uge ${ws.week_number}${ws.session_count > 0 ? '' : ' · tom'}` : 'Intet program'}
                  </div>
                </div>
                {unread > 0 && (
                  <span style={{ background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', fontWeight: 700, borderRadius: '999px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{unread}</span>
                )}
              </div>
            )
          })}
          {athletes.length === 0 && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', padding: '0.5rem 1.25rem' }}>Ingen atleter</div>
          )}
        </nav>
        <div style={s.sidebarFooter}>
          {onPreviewAthlete && !previewPickerOpen && (
            <button
              onClick={() => { setPickingMine(false); setPreviewPickerOpen(true) }}
              style={{ ...s.btnPrimary, width: '100%' }}
            >Se som atlet</button>
          )}
          {onPreviewAthlete && previewPickerOpen && (
            <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.3)', padding: '0.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>{pickingMine ? 'Vælg din egen profil (huskes)' : 'Vælg profil'}</div>
              {athletes.map(a => (
                <div
                  key={a.id}
                  onClick={() => { setPreviewPickerOpen(false); if (pickingMine) { localStorage.setItem('entropi_my_athlete_id', a.id); setMyAthleteId(a.id); setPickingMine(false) } onPreviewAthlete(a.id) }}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: '#b8b4a8', cursor: 'pointer', borderRadius: '1px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,234,226,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{a.name}</div>
              ))}
              <button onClick={() => { setPreviewPickerOpen(false); setPickingMine(false) }} style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', width: '100%' }}>Annuller</button>
            </div>
          )}
          {/* Værktøjer samlet bag ét punkt — eksport/backup/VideoCoach/log ud er
              sjældne handlinger og skal ikke fylde i det daglige. */}
          <button
            onClick={() => setSidebarMoreOpen(o => !o)}
            style={{ background: 'transparent', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.1rem 0.15rem', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: sidebarMoreOpen ? '#c8923a' : '#7a7770' }}
          >
            <span>Værktøjer</span>
            <span style={{ fontSize: '0.5rem', transform: sidebarMoreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>
          {sidebarMoreOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingTop: '0.3rem' }}>
              {(() => {
                // eslint-disable-next-line react-hooks/purity -- uændret fra før ordre 377; lint ser det først nu (se RAPPORT-377)
                const days = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 86400000) : null
                const stale = days == null || days >= 7
                const backupNote = days == null ? '⚠ aldrig' : days === 0 ? '✓ i dag' : stale ? `⚠ ${days}d` : `✓ ${days}d`
                const row = { background: 'transparent', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.1rem', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#7a7770', textAlign: 'left' }
                return (
                  <>
                    <button onClick={openVideoCoachV3} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#b8b4a8'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>VideoCoach</span><span>→</span>
                    </button>
                    <button onClick={exportTraeningsdata} disabled={exportingTraening} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#b8b4a8'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>{exportingTraening ? 'Henter…' : 'Træningsdata'}</span><span>↓</span>
                    </button>
                    <button onClick={exportBackup} disabled={exportingBackup} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#b8b4a8'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>{exportingBackup ? 'Henter…' : 'Sikkerhedskopi'}</span>
                      <span style={{ color: stale ? '#c8923a' : '#4a4844' }}>{backupNote}</span>
                    </button>
                    <button onClick={() => signOutHard()} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#e05555'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>Log ud</span><span>→</span>
                    </button>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

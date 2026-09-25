// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Mobilens bundnavigation og menu-ark.
// Samme navne som props som i Dashboard; linjerne står i et fragment (ingen DOM-ændring).
import { s } from '../dashboardShared'
import { signOutHard } from '../supabase'

export default function MobilNav({
  athletes, coachPriorityCount, exportBackup, exportingBackup, exportingTraening, exportTraeningsdata,
  goToMyProfile, isMobile, menuSheetOpen, onPreviewAthlete, openVideoCoachV3, pickingMine,
  selectedAthlete, setMenuSheetOpen, setMyAthleteId, setPickingMine, setSelectedAthlete, setSheetPreviewPick,
  setShowAddModal, setSidebarOpen, setView, sheetPreviewPick, view,
}) {
  return (
    <>
        {/* Mobil bundnavigation — erstatter hamburger-menuen som primær navigation.
            Samme mønster som atlet-appen: 4 faste punkter, guld = aktiv.
            "Menu" åbner sidebaren (atleter, eksport, VideoCoach, log ud). */}
        {isMobile && (
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            background: '#171713', borderTop: '1px solid rgba(237,234,226,0.09)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}>
            {[
              {
                key: 'list', label: 'Forside', active: view === 'list' && !selectedAthlete,
                onClick: () => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false); setMenuSheetOpen(false) },
                icon: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
              },
              {
                key: 'inbox', label: 'Coach Briefing', active: view === 'inbox',
                onClick: () => { setView('inbox'); setSelectedAthlete(null); setSidebarOpen(false); setMenuSheetOpen(false) },
                icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
              },
              {
                key: 'mine', label: 'Min træning', active: false,
                onClick: () => { setSidebarOpen(false); setMenuSheetOpen(false); goToMyProfile() },
                icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
              },
              {
                key: 'menu', label: 'Menu', active: menuSheetOpen,
                onClick: () => { setSheetPreviewPick(false); setMenuSheetOpen(o => !o) },
                icon: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
              },
            ].map(item => {
              const priorityCount = item.key === 'inbox' ? coachPriorityCount : 0
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '0.25rem', padding: '0.55rem 0 0.5rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: item.active ? '#c8923a' : '#7a7770',
                  }}
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.label}</span>
                  {priorityCount > 0 && (
                    <span style={{ position: 'absolute', top: '0.3rem', right: 'calc(50% - 1.15rem)', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.44rem', minWidth: '0.85rem', height: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 0.15rem', fontFamily: "'IBM Plex Mono', monospace" }}>{priorityCount}</span>
                  )}
                </button>
              )
            })}
          </nav>
        )}

        {/* Mobil menu-ark: sekundære handlinger i et bund-ark i stedet for
            desktop-sidebaren presset ind fra siden. */}
        {isMobile && menuSheetOpen && (
          <>
            <div onClick={() => setMenuSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 205 }} />
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 210, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.12)', borderRadius: '14px 14px 0 0', padding: '0.85rem 1rem calc(1.1rem + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ width: 36, height: 4, background: 'rgba(237,234,226,0.2)', borderRadius: 2, margin: '0 auto 0.8rem' }} />
              {sheetPreviewPick ? (
                <>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem' }}>Se som atlet</div>
                  <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                    {athletes.map(a2 => (
                      <div key={a2.id}
                        onClick={() => {
                          setMenuSheetOpen(false); setSheetPreviewPick(false)
                          if (pickingMine) { localStorage.setItem('entropi_my_athlete_id', a2.id); setMyAthleteId(a2.id); setPickingMine(false) }
                          onPreviewAthlete && onPreviewAthlete(a2.id)
                        }}
                        style={{ padding: '0.65rem 0.25rem', fontSize: '0.9rem', color: '#b8b4a8', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.05)' }}
                      >{a2.name}</div>
                    ))}
                  </div>
                  <button onClick={() => setSheetPreviewPick(false)} style={{ ...s.btnGhost, marginTop: '0.75rem', width: '100%' }}>← Tilbage</button>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'Kalender', onClick: () => { setMenuSheetOpen(false); setSelectedAthlete(null); setView('calendar') }, icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></> },
                      { label: 'Bibliotek', onClick: () => { setMenuSheetOpen(false); setSelectedAthlete(null); setView('library') }, icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></> },
                      { label: 'VideoCoach', onClick: () => { setMenuSheetOpen(false); openVideoCoachV3() }, icon: <><rect x="2" y="6" width="13" height="12" rx="2" /><path d="M15 10.5 22 7v10l-7-3.5" /></> },
                      { label: 'Se som atlet', onClick: () => setSheetPreviewPick(true), icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
                    ].map(m => (
                      <button key={m.label} onClick={m.onClick}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '0.8rem 0.5rem', background: '#16150f', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 8, cursor: 'pointer', color: '#b8b4a8' }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg>
                        <span style={{ fontSize: '0.72rem' }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column' }}>
                    <button onClick={() => { setMenuSheetOpen(false); setShowAddModal(true) }} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b8b4a8', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>+ Tilføj atlet</button>
                    <button onClick={exportTraeningsdata} disabled={exportingTraening} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>{exportingTraening ? '...' : '↓ Træningsdata'}</button>
                    <button onClick={exportBackup} disabled={exportingBackup} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>{exportingBackup ? '...' : '↓ Sikkerhedskopi'}</button>
                    <button onClick={() => signOutHard()} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>Log ud</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
    </>
  )
}

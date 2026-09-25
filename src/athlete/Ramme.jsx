// Atlet-visningens faste ramme: VideoCoach-iframen, RPE-guiden, fortryd-toasten,
// bekraeftelses-modalen og topbaren med kontomenuen — JSX'en flyttet uaendret
// ud af AthleteView.jsx (ordre 373). Ingen egen tilstand; alt kommer ind som
// props med samme navne som i AthleteView.
import { signOutHard } from '../supabase'
import { s, today } from '../athleteShared'
import { ATHLETE_VIDEOCOACH_URL } from './videoCoachBro'

function Ramme({
  accountMenuOpen, askConfirm, athleteVideoCoachFrameRef, athleteVideoCoachInstant, athleteVideoCoachOpen, backBtn, confirmDialog, handleRecheckRole,
  onExitPreview, onRecheckRole, openRpePicker, recheckingRole, restartOnboardingGuide, role, setAccountMenuOpen, setConfirmDialog,
  setOpenRpePicker, setShowRpeGuide, showRpeGuide, undoDelete, undoPending, undoToast,
}) {
  return (
    <>
      {role === 'athlete' && athleteVideoCoachOpen && (
        <div
          role="dialog"
          aria-label="VideoCoach"
          style={{ position: 'fixed', inset: 0, zIndex: 12000, background: '#0f0e0b' }}
        >
          <iframe
            ref={athleteVideoCoachFrameRef}
            src={athleteVideoCoachInstant ? `${ATHLETE_VIDEOCOACH_URL}&instant=1` : ATHLETE_VIDEOCOACH_URL}
            title="VideoCoach"
            allow="fullscreen"
            allowFullScreen
            style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#0f0e0b' }}
          />
        </div>
      )}
      {openRpePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpenRpePicker(null)} />
      )}
      {showRpeGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowRpeGuide(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: '480px', padding: '1.5rem 1.25rem 2rem', fontFamily: "'IBM Plex Mono', monospace" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: '#c8923a', textTransform: 'uppercase' }}>RPE-skala (RTS)</span>
              <button onClick={() => setShowRpeGuide(false)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
            </div>
            {[
              { rpe: '10',  label: 'Ingen gentagelser tilbage' },
              { rpe: '9.5', label: 'Muligvis 1 tilbage' },
              { rpe: '9',   label: '1 tilbage' },
              { rpe: '8.5', label: '1–2 tilbage' },
              { rpe: '8',   label: '2 tilbage' },
              { rpe: '7.5', label: '2–3 tilbage' },
              { rpe: '7',   label: '3 tilbage' },
              { rpe: '6.5', label: '3–4 tilbage' },
              { rpe: '6',   label: '4 tilbage' },
              { rpe: '5.5', label: '4–5 tilbage' },
            ].map(({ rpe, label }) => (
              <div key={rpe} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                <span style={{ fontSize: '0.82rem', color: '#c8923a', minWidth: '36px', textAlign: 'right' }}>{rpe}</span>
                <span style={{ fontSize: '0.72rem', color: '#edeae2', letterSpacing: '0.02em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Fortryd-toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: '1px solid rgba(237,234,226,0.18)',
          padding: '0.6rem 0.75rem 0.6rem 1.1rem', zIndex: 9999, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '0.9rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#b8b4a8', letterSpacing: '0.06em' }}>{undoToast.label}</span>
          <button onClick={undoDelete} disabled={undoPending} style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.3rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.45)', opacity: undoPending ? 0.6 : 1 }}>{undoPending ? '...' : 'Fortryd'}</button>
        </div>
      )}
      {/* Bekræftelses-modal */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', padding: '1.5rem', maxWidth: '360px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.95rem', color: '#edeae2', lineHeight: 1.5, marginBottom: '1.25rem' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDialog(null)}>Annuller</button>
              <button style={s.btnPrimary} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn && fn() }}>Bekræft</button>
            </div>
          </div>
        </div>
      )}
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.logo}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
          {backBtn}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>{today()}</div>
          {/* BUG (ORDRE 20): denne konto-menu fandtes slet ikke før — en atlet
              (eller en coach der ved en fejl var havnet her) havde ingen vej ud
              af appen uden at rydde browser-data manuelt. Log ud skal ALTID
              kunne nås; "Skift til coach-visning" dækker det Marc oplevede: en
              coach-konto der (fx pga. et cachet rolle-opslag, se App.jsx)
              stod fast i atlet-visningen uden at skulle logge helt ud og ind. */}
          {!onExitPreview && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setAccountMenuOpen(o => !o)}
                aria-label="Konto"
                style={{ background: 'transparent', border: 'none', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.1em', cursor: 'pointer', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >⋯</button>
              {accountMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.4rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 6, padding: '0.35rem', minWidth: '190px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {onRecheckRole && (
                    <button
                      onClick={() => { setAccountMenuOpen(false); handleRecheckRole() }}
                      disabled={recheckingRole}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#b8b4a8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.5rem', cursor: recheckingRole ? 'default' : 'pointer' }}
                    >{recheckingRole ? 'Tjekker…' : 'Skift til coach-visning'}</button>
                  )}
                  <button
                    onClick={() => { setAccountMenuOpen(false); restartOnboardingGuide() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#b8b4a8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.5rem', cursor: 'pointer' }}
                  >Se guiden igen</button>
                  <button
                    onClick={() => { setAccountMenuOpen(false); askConfirm('Log ud af Entropi? Du skal logge ind igen for at fortsætte.', () => signOutHard()) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#e05555', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 0.5rem', cursor: 'pointer' }}
                  >Log ud</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Ramme

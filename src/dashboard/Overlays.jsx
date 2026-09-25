// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// VideoCoach-iframen, toast, bekræft-modal og mobil-CSS.
// Samme navne som props som i Dashboard; linjerne står i et fragment (ingen DOM-ændring).
import { VIDEOCOACH_V3_URL } from './coachVideoHjaelp'
import { s } from '../dashboardShared'

export default function Overlays({
  confirmDialog, flash, isMobile, setConfirmDialog, videoCoachFrameRef, videoCoachOpen,
}) {
  return (
    <>
      {/* VideoCoach som iframe — coachen optager/gemmer for en valgt atlet (inkl.
          sig selv) uden at forlade portalen. Luk sker via VideoCoachs egen ✕,
          der poster :close til broen ovenfor. */}
      {videoCoachOpen && (
        <div role="dialog" aria-label="VideoCoach" style={{ position: 'fixed', inset: 0, zIndex: 12000, background: '#0f0e0b' }}>
          <iframe
            ref={videoCoachFrameRef}
            src={VIDEOCOACH_V3_URL}
            title="VideoCoach"
            allow="fullscreen"
            allowFullScreen
            style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#0f0e0b' }}
          />
        </div>
      )}
      {/* Toast */}
      {flash && (
        <div style={{
          position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', zIndex: 10000, maxWidth: '90vw',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
      {/* Bekræftelses-modal */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', padding: '1.5rem', maxWidth: '360px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.95rem', color: '#edeae2', lineHeight: 1.5, marginBottom: '1.25rem' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDialog(null)}>Annuller</button>
              <button style={confirmDialog.kind === 'primary'
                ? { ...s.btnPrimary }
                : { ...s.btnPrimary, background: '#e05555', borderColor: '#e05555', color: '#141410' }}
                onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn && fn() }}>{confirmDialog.confirmLabel || 'Bekræft'}</button>
            </div>
          </div>
        </div>
      )}
      {isMobile && (
        <style>{`
          button { min-height: 44px !important; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>
      )}
    </>
  )
}

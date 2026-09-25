// Toast-pladsen (PR-toast + almindelig besked), sticky i sidens flow — JSX'en
// flyttet uaendret ud af AthleteView.jsx (ordre 373). Hvornaar og hvor den
// vises, bestemmes stadig i AthleteView (toastSlot).

function ToastPlads({
  flash, prToast, prToastFading,
}) {
  return (
    <div data-toast-plads="" style={{ position: 'sticky', top: '52px', zIndex: 49, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0', pointerEvents: 'none' }}>
      {prToast && (
        <div style={{
          background: '#1c1c18', border: '1px solid rgba(200,146,58,0.55)',
          padding: '0.65rem 1.1rem', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem',
          color: '#c8923a', letterSpacing: '0.08em',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
          opacity: prToastFading ? 0 : 1, transition: 'opacity 0.6s ease',
        }}>
          {prToast.type === 'vægt' ? '🏆 Ny personlig rekord (vægt)' : prToast.type === 'rep' ? '🔥 Ny personlig rekord (reps)' : '⚡ Stærkeste sæt'} på {prToast.name}
        </div>
      )}
      {flash && (
        <div role="status" style={{
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
    </div>
  )
}

export default ToastPlads

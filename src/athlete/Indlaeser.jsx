// Indlaesnings-/fejlskaermen mens atletens data hentes — JSX'en flyttet
// uaendret ud af AthleteView.jsx (ordre 373). Betingelsen (loading) staar i AthleteView.
import { s } from '../athleteShared'

function Indlaeser({ backBtn, loadError }) {
  return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {loadError ? (
        <>
          <div style={{ color: '#7a7770' }}>Kunne ikke indlæse data.</div>
          {backBtn || <button style={s.btnGhost} onClick={() => window.location.reload()}>Prøv igen</button>}
        </>
      ) : 'Indlæser...'}
      {!loadError && backBtn}
    </div>
  )
}

export default Indlaeser

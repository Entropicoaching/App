// ORDRE 397 — én rolig linje under topbaren på alle faner, når der ikke er
// forbindelse (browseren melder offline), eller når Dagens pas vises fra
// øjebliksbilledet, fordi serveren ikke kunne nås ved åbning. Erstatter de
// røde "kunne ikke hentes"-toasts uden net (se onReadError i AthleteView).
// Online og med friske data vises intet. Se docs/OFFLINE-PAS.md.
import { useEffect, useState } from 'react'
import { seemsOffline } from '../offlineSession'

// Browserens online/offline plus 'entropi:forbindelse' (et kald til serveren
// fejlede/lykkedes, se offlineSession.js).
function useBrowserOnline() {
  const [online, setOnline] = useState(() => !seemsOffline())
  useEffect(() => {
    const update = () => setOnline(!seemsOffline())
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('entropi:forbindelse', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('entropi:forbindelse', update)
    }
  }, [])
  return online
}

function IngenForbindelse({ offlineSnapshotAt }) {
  const online = useBrowserOnline()
  if (online && !offlineSnapshotAt) return null
  const tid = offlineSnapshotAt
    ? new Date(offlineSnapshotAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div
      role="status"
      data-ingen-forbindelse={online ? 'oejebliksbillede' : 'offline'}
      style={{
        maxWidth: 680, margin: '0 auto', padding: '0.55rem 1rem', boxSizing: 'border-box',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.03em', lineHeight: 1.5,
        color: '#a8a49a', borderBottom: '1px solid rgba(237,234,226,0.07)',
      }}
    >
      {online ? 'Forbindelsen er svag.' : 'Ingen forbindelse.'} Dagens pas og dine sæt virker; resten opdateres, når du har net.
      {tid && <span style={{ color: '#7a7770' }}> Program fra kl. {tid}.</span>}
    </div>
  )
}

export default IngenForbindelse

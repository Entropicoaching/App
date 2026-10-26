import { useEffect, useState } from 'react'
import { s } from '../dashboardShared'

export default function WeekDeletionNotice({ entries, onUndo }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!entries.length) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [entries.length])
  if (!entries.length) return null
  return (
    <div aria-label="Uger til sletning" style={{ position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)', width: 'min(90vw, 480px)', zIndex: 10000 }}>
      {entries.map(entry => {
        const seconds = Math.max(0, Math.min(10, Math.ceil((entry.expiresAt - now) / 1000)))
        return (
          <div key={entry.weekId} style={{ background: '#1c1c18', color: '#edeae2', border: '1px solid #c8923a', padding: '0.8rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div role="status">Uge {entry.weekNumber} fjernet{entry.athleteName ? ` for ${entry.athleteName}` : ''}.</div>
              <small aria-hidden="true">{entry.deleting || !seconds ? 'Sletter...' : `Fortryd inden ${seconds} sekunder`}</small>
            </div>
            <button style={s.btnGhost} disabled={entry.deleting || !seconds} aria-label={`Fortryd sletning af uge ${entry.weekNumber}`} onClick={() => onUndo(entry.weekId)}>Fortryd</button>
          </div>
        )
      })}
    </div>
  )
}

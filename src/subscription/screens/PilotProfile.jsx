import { useState } from 'react'
import { color, s } from '../theme.js'
import { Button, Card, Label, Meta } from '../ui.jsx'

export default function PilotProfile({ profile, sessions, pendingCount, onResetCache, onLogout }) {
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <div style={s.page}>
      <Label>Pilotprofil</Label><h1 style={s.h1}>{profile.name}</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>Testdata gemmes i Entropis separate shadow-miljø.</p>
      <Card><Label tone="muted">Adgang</Label>
        {[
          ['Niveau', profile.entitlement === 'member' ? 'Medlem' : 'Gratis'],
          ['Program', profile.programName],
          ['Gennemførte pas', `${sessions.filter(item => item.completedAt).length}`],
          ['Afventer synk', `${pendingCount}`],
        ].map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: `1px solid ${color.line}` }}><Meta>{label}</Meta><span style={{ fontSize: '0.9rem', color: color.text }}>{value}</span></div>)}
      </Card>
      <Button disabled={pendingCount > 0} variant="ghost" onClick={() => (confirmReset ? onResetCache() : setConfirmReset(true))}>{confirmReset ? 'Tryk igen for at rydde cache' : 'Ryd lokal cache'}</Button>
      <Meta style={{ margin: '0.6rem 0 1rem', color: color.dim, textAlign: 'center' }}>
        {pendingCount > 0 ? 'Cache kan først ryddes, når alle pas er synkroniseret.' : 'Træningsdata i shadow slettes ikke. Login-sessionen bevares.'}
      </Meta>
      <Button variant="ghost" onClick={onLogout}>Log ud</Button>
    </div>
  )
}

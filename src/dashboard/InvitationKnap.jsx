// Ordre 1598: "Kopiér invitation" paa profilkortet, kun saa laenge atleten ikke er koblet (athletes.user_id tom).
import * as React from 'react'
import { s } from '../dashboardShared.js'
import { INGEN_MAIL_LINJE, invitationTekst, kopierInvitation } from './invitationTekst.mjs'

// Adressen bages ind fra public/CNAME ved build (vite define); uden den staar teksten uden link.
const APP_ADRESSE = typeof __APP_ADRESSE__ === 'string' ? __APP_ADRESSE__ : ''

export default function InvitationKnap({ a, appAdresse = APP_ADRESSE, clipboard = globalThis.navigator?.clipboard }) {
  const [svar, setSvar] = React.useState(null)
  if (!a || a.user_id) return null
  const tekst = invitationTekst({ email: a.email, appAdresse })
  if (!tekst) return <div style={{ color: '#7a7770', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: '1rem' }}>{INGEN_MAIL_LINJE}</div>
  return (
    <div style={{ marginBottom: '1rem' }}>
      <button type="button" style={{ ...s.btnGhost, minHeight: 44, minWidth: 44 }}
        onClick={async () => setSvar(await kopierInvitation(tekst, clipboard))}>Kopiér invitation</button>
      {svar && <div role={svar.ok ? 'status' : 'alert'} style={{ color: svar.ok ? '#b8b4a8' : '#e0a555', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '0.4rem' }}>{svar.besked}</div>}
    </div>
  )
}

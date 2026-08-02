// Profil: hvad brugeren valgte, hvilket program det gav, og hvilket
// entitlement-niveau demoen kører på.
//
// Niveauskifteren er et demoværktøj, ikke et adgangssystem og ikke et
// betalingsflow — der vises hverken pris eller købsknap.

import { useState } from 'react'
import { color, s } from '../theme'
import { Button, Card, Label, Meta } from '../ui'
import { getProgram, LEVELS, EQUIPMENT } from '../programs'
import { can, missingFeatureNote, TIERS, TIER_LABEL, TIER_NOTE } from '../entitlements'
import { explainSelection } from '../selectProgram'

export default function Profile({ profile, sessions, onSetEntitlement, onReset }) {
  // To tryk i stedet for en browser-dialog: sletning skal være bevidst, men
  // en confirm() blokerer hele siden og hører ikke hjemme på mobil.
  const [confirmReset, setConfirmReset] = useState(false)
  const program = getProgram(profile.programId)
  const level = LEVELS.find(l => l.id === profile.level)
  const equipment = EQUIPMENT.find(e => e.id === profile.equipment)
  const canLibrary = can(profile.entitlement, 'program.library')

  return (
    <div style={s.page}>
      <Label>Profil</Label>
      <h1 style={s.h1}>{profile.name}</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>
        Demo-profil. Alt ligger lokalt på denne enhed og sendes ingen steder hen.
      </p>

      <Card>
        <Label tone="muted">Dine valg</Label>
        {[
          ['Niveau', level ? level.label : profile.level],
          ['Dage om ugen', `${profile.daysPerWeek}`],
          ['Udstyr', equipment ? equipment.label : profile.equipment],
          ['Program', program.name],
          ['Gennemførte pas', `${sessions.filter(x => x.completedAt).length}`],
        ].map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: `1px solid ${color.line}`,
            }}
          >
            <Meta>{k}</Meta>
            <span style={{ fontSize: '0.9rem', color: color.text }}>{v}</span>
          </div>
        ))}
        <Meta style={{ marginTop: '0.75rem', color: color.dim }}>
          {explainSelection(profile)}
        </Meta>
      </Card>

      <Card>
        <Label tone="muted">Niveau i abonnementet</Label>
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {TIERS.map(tier => {
            const active = tier === profile.entitlement
            return (
              <button
                key={tier}
                onClick={() => onSetEntitlement(tier)}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  background: active ? color.accentSoft : 'transparent',
                  border: `1px solid ${active ? color.accentBorder : color.lineStrong}`,
                  color: active ? color.accent : color.muted,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.55rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: '0.4rem',
                }}
              >
                {TIER_LABEL[tier]}
              </button>
            )
          })}
        </div>
        <p style={{ ...s.body, fontSize: '0.85rem' }}>{TIER_NOTE[profile.entitlement]}</p>
        {!canLibrary && (
          <Meta style={{ marginTop: '0.6rem', color: color.dim }}>
            {missingFeatureNote('program.library')}
          </Meta>
        )}
        <Meta style={{ marginTop: '0.6rem', color: color.dim }}>
          Demoskifter. Ingen betaling, ingen server, ingen rigtig adgangskontrol.
        </Meta>
      </Card>

      <Card>
        <Label tone="muted">Programbibliotek</Label>
        <p style={{ ...s.body, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {canLibrary
            ? 'Du kan se alle programmer. Skift program kræver en ny profil i denne prototype.'
            : missingFeatureNote('program.library')}
        </p>
      </Card>

      <Button
        variant="ghost"
        onClick={() => (confirmReset ? onReset() : setConfirmReset(true))}
      >
        {confirmReset ? 'Tryk igen for at slette alt' : 'Nulstil demo-data'}
      </Button>
      {confirmReset && (
        <Meta style={{ marginTop: '0.6rem', color: color.dim, textAlign: 'center' }}>
          Sletter profil og hele træningsloggen på denne enhed.
        </Meta>
      )}
    </div>
  )
}

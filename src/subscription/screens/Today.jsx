// Dagens træning. Målet er ét tryk fra åbnet app til første sæt.

import { useState } from 'react'
import { color, font, s } from '../theme'
import { Button, Card, Label, Meta } from '../ui'
import { getProgram, getSession } from '../programs'
import { nextDayId, lastSetFor, completedSessions } from '../trainingLog'

export default function Today({ profile, sessions, draft, onStart, onResume }) {
  const program = getProgram(profile.programId)
  const suggestedId = nextDayId(program, sessions)
  const [dayId, setDayId] = useState(suggestedId)
  const day = getSession(program.id, dayId) || program.sessions[0]
  const done = completedSessions(sessions, 1000).length

  if (draft) {
    const draftDay = getSession(draft.programId, draft.dayId)
    const logged = draft.entries.reduce((n, e) => n + e.sets.length, 0)
    return (
      <div style={s.page}>
        <Label>Igangværende pas</Label>
        <h1 style={s.h1}>{draftDay ? draftDay.name : 'Træning'}</h1>
        <p style={{ ...s.body, marginBottom: '1.5rem' }}>
          Du har {logged} {logged === 1 ? 'sæt' : 'sæt'} logget i dette pas.
        </p>
        <Button onClick={onResume}>Fortsæt træning</Button>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <Label>{program.name}</Label>
      <h1 style={s.h1}>{day.name}</h1>
      <p style={{ ...s.body, marginBottom: '1.25rem' }}>
        {dayId === suggestedId
          ? `Pas nummer ${done + 1}. Næste i rotationen.`
          : 'Du har valgt et andet pas end det der står for tur.'}
      </p>

      <Button onClick={() => onStart(dayId)} style={{ marginBottom: '1.25rem' }}>
        Start træning
      </Button>

      {program.sessions.length > 1 && (
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem' }}>
          {program.sessions.map(session => {
            const active = session.id === dayId
            return (
              <button
                key={session.id}
                onClick={() => setDayId(session.id)}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  background: active ? color.accentSoft : 'transparent',
                  border: `1px solid ${active ? color.accentBorder : color.lineStrong}`,
                  color: active ? color.accent : color.muted,
                  fontFamily: font.mono,
                  fontSize: '0.55rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: '0.4rem',
                }}
              >
                {session.name.replace(program.name, '').trim() || session.name}
              </button>
            )
          })}
        </div>
      )}

      <Card>
        <Label tone="muted">Øvelser</Label>
        {day.exercises.map((ex, i) => {
          const last = lastSetFor(sessions, ex.id)
          return (
            <div
              key={ex.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                padding: '0.7rem 0',
                borderBottom: i < day.exercises.length - 1 ? `1px solid ${color.line}` : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: '0.95rem', color: color.text }}>{ex.name}</div>
                <Meta style={{ marginTop: '0.2rem' }}>
                  {ex.sets} × {ex.reps} · {ex.rest}s pause
                </Meta>
                {ex.note && (
                  <Meta style={{ marginTop: '0.15rem', color: color.dim }}>{ex.note}</Meta>
                )}
              </div>
              {last && (
                <Meta style={{ whiteSpace: 'nowrap', color: color.accent }}>
                  sidst {last.weightKg > 0 ? `${last.weightKg} kg` : 'kropsvægt'} × {last.reps}
                </Meta>
              )}
            </div>
          )
        })}
      </Card>

      <Card>
        <Label tone="muted">Progression</Label>
        <p style={{ ...s.body, fontSize: '0.85rem' }}>{program.progression}</p>
        <Meta style={{ marginTop: '0.75rem', color: color.dim }}>
          Reglen er fast. Appen ændrer ikke selv din vægt.
        </Meta>
      </Card>
    </div>
  )
}

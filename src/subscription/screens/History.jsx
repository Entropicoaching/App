// Historik og progression. Alt vises inden for samme bruger — der er ingen
// sammenligning på tværs af brugere, og der er ingen konklusioner: kun det
// brugeren selv har logget.

import { useState } from 'react'
import { color, font, s } from '../theme'
import { Card, Label, Meta } from '../ui'
import { getProgram, getSession, findExercise } from '../programs'
import {
  completedSessions,
  exerciseHistory,
  loggedExerciseIds,
  sessionTotals,
  formatDate,
} from '../trainingLog'
import { can, missingFeatureNote } from '../entitlements'

export default function History({ profile, sessions }) {
  const [exerciseId, setExerciseId] = useState(null)
  const done = completedSessions(sessions)
  const exerciseIds = loggedExerciseIds(sessions)
  const showProgression = can(profile.entitlement, 'history.progression')

  if (!done.length) {
    return (
      <div style={s.page}>
        <Label>Historik</Label>
        <h1 style={s.h1}>Ingen pas endnu.</h1>
        <p style={s.body}>
          Når du afslutter dit første pas, kan du se vægt, reps og RPE her.
        </p>
      </div>
    )
  }

  const selected = exerciseId ? findExercise(profile.programId, exerciseId) : null
  const history = exerciseId ? exerciseHistory(sessions, exerciseId) : []

  return (
    <div style={s.page}>
      <Label>Historik</Label>
      <h1 style={s.h1}>{done.length} gennemførte pas</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>
        Dine egne tal, nyeste først.
      </p>

      {showProgression && exerciseIds.length > 0 && (
        <>
          <Label tone="muted">Progression pr. øvelse</Label>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {exerciseIds.map(id => {
              const ex = findExercise(profile.programId, id)
              const active = id === exerciseId
              return (
                <button
                  key={id}
                  onClick={() => setExerciseId(active ? null : id)}
                  style={{
                    minHeight: '44px',
                    background: active ? color.accentSoft : color.panel,
                    border: `1px solid ${active ? color.accentBorder : color.lineStrong}`,
                    color: active ? color.accent : color.muted,
                    fontFamily: font.mono,
                    fontSize: '0.55rem',
                    letterSpacing: '0.06em',
                    padding: '0.4rem 0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  {ex ? ex.name : id}
                </button>
              )
            })}
          </div>

          {selected && (
            <Card>
              <Label tone="muted">{selected.name}</Label>
              {history.map(row => (
                <div
                  key={row.sessionId}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.75rem',
                    padding: '0.55rem 0',
                    borderBottom: `1px solid ${color.line}`,
                  }}
                >
                  <Meta style={{ width: '4rem', flexShrink: 0 }}>{formatDate(row.date)}</Meta>
                  <span style={{ fontFamily: font.display, fontSize: '1.1rem', color: color.text }}>
                    {row.best.weightKg > 0 ? `${row.best.weightKg} kg` : 'kropsvægt'} × {row.best.reps}
                  </span>
                  <Meta style={{ marginLeft: 'auto', color: color.accent }}>
                    RPE {row.best.rpe} · {row.sets.length} sæt
                  </Meta>
                </div>
              ))}
              <Meta style={{ marginTop: '0.75rem', color: color.dim }}>
                Bedste sæt pr. pas. Tallene er dine egne — intet gennemsnit, ingen vurdering.
              </Meta>
            </Card>
          )}
        </>
      )}

      {!showProgression && (
        <Card>
          <Label tone="muted">Progression pr. øvelse</Label>
          <p style={{ ...s.body, fontSize: '0.85rem' }}>
            {missingFeatureNote('history.progression')}
          </p>
        </Card>
      )}

      <Label tone="muted">Pas</Label>
      {done.map(session => {
        const program = getProgram(session.programId)
        const day = getSession(session.programId, session.dayId)
        const totals = sessionTotals(session)
        return (
          <Card key={session.id} style={{ marginBottom: '0.6rem', padding: '0.85rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.95rem', color: color.text }}>
                {day ? day.name : 'Pas'}
              </span>
              <Meta>{formatDate(session.completedAt)}</Meta>
            </div>
            <Meta style={{ marginTop: '0.35rem', color: color.dim }}>
              {program ? program.name : session.programId} · {totals.sets} sæt · {totals.volume} kg
            </Meta>
          </Card>
        )
      })}
    </div>
  )
}

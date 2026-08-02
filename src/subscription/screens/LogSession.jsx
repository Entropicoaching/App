// Logning af ét træningspas. Fuldskærm, én øvelse ad gangen.
//
// Friktion er den vigtigste måleenhed her: felterne er forudfyldt med det
// brugeren selv gjorde sidst, så et sæt kan gemmes med ét tryk.

import { useState } from 'react'
import { color, font, s } from '../theme'
import { Button, ChipRow, Label, Meta, Stepper } from '../ui'
import { getProgram, getSession } from '../programs'
import { lastSetFor, logSet, removeLastSet, setsFor, sessionTotals } from '../trainingLog'

const RPE_OPTIONS = [6, 7, 8, 8.5, 9, 9.5, 10]

function defaultReps(exercise) {
  const match = String(exercise.reps).match(/\d+/)
  return match ? Number(match[0]) : 8
}

// Udgangspunktet for felterne: først sidste sæt i DETTE pas, ellers sidste
// gang øvelsen blev lavet, ellers programmets repmål. Det er en gentagelse af
// hvad brugeren selv skrev — ikke et forslag fra appen.
function prefill(draft, sessions, exercise) {
  const inSession = setsFor(draft, exercise.id)
  const source = inSession.length
    ? inSession[inSession.length - 1]
    : lastSetFor(sessions, exercise.id)
  return source
    ? { weight: source.weightKg, reps: source.reps, rpe: source.rpe }
    : { weight: 0, reps: defaultReps(exercise), rpe: 8 }
}

export default function LogSession({ draft, sessions, onChange, onFinish, onCancel }) {
  const program = getProgram(draft.programId)
  const day = getSession(draft.programId, draft.dayId)
  const [index, setIndex] = useState(0)
  const exercise = day.exercises[index]

  const [inputs, setInputs] = useState(() => prefill(draft, sessions, exercise))
  const [inputsFor, setInputsFor] = useState(exercise.id)
  const { weight, reps, rpe } = inputs

  // Nulstil felterne når øvelsen skifter. Justering under render frem for en
  // effect: det holder felterne i sync uden et ekstra render med gamle tal, og
  // uden at de springer tilbage hver gang draft opdateres midt i et sæt.
  if (inputsFor !== exercise.id) {
    setInputsFor(exercise.id)
    setInputs(prefill(draft, sessions, exercise))
  }

  const setWeight = value => setInputs(prev => ({ ...prev, weight: value }))
  const setReps = value => setInputs(prev => ({ ...prev, reps: value }))
  const setRpe = value => setInputs(prev => ({ ...prev, rpe: value }))

  const logged = setsFor(draft, exercise.id)
  const totals = sessionTotals(draft)
  const target = day.exercises.reduce((n, e) => n + e.sets, 0)
  const pct = target ? Math.min(100, Math.round((totals.sets / target) * 100)) : 0
  const isLast = index === day.exercises.length - 1
  const remaining = Math.max(0, target - totals.sets)

  const save = () => {
    onChange(logSet(draft, exercise.id, { reps, weightKg: weight, rpe, loggedAt: new Date().toISOString() }))
  }

  return (
    <div style={{ ...s.wrap, paddingBottom: '1rem' }}>
      <header style={s.topbar}>
        <Meta>
          {day.name} · {index + 1}/{day.exercises.length}
        </Meta>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: color.dim,
            fontFamily: font.mono,
            fontSize: '0.55rem',
            cursor: 'pointer',
            padding: '0.5rem',
          }}
        >
          ✕ Luk
        </button>
      </header>

      <div role="progressbar" aria-label="Fremdrift i pas" aria-valuemin={0} aria-valuemax={target} aria-valuenow={totals.sets} style={{ height: '2px', background: color.lineStrong }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color.accent, transition: 'width 0.3s' }} />
      </div>

      <div style={{ ...s.page, paddingTop: '1.25rem' }}>
        <Label>{program.name}</Label>
        <h1 style={{ ...s.h1, marginBottom: '0.25rem' }}>{exercise.name}</h1>
        <Meta style={{ marginBottom: '1.25rem' }}>
          Mål: {exercise.sets} × {exercise.reps} · {exercise.rest}s pause
          {exercise.note ? ` · ${exercise.note}` : ''}
        </Meta>
        <Meta aria-live="polite" style={{ marginTop: '-0.8rem', marginBottom: '1rem', color: color.accent }}>
          I dette pas: {totals.sets} af {target} sæt logget{remaining ? ` · ${remaining} tilbage` : ' · klar til at afslutte'}
        </Meta>

        <div
          style={{
            background: color.panel,
            border: `1px solid ${color.line}`,
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <Stepper label="Vægt" value={weight} unit="kg" step={2.5} max={500} onChange={setWeight} />
          <Stepper label="Reps" value={reps} unit="reps" step={1} min={1} max={100} onChange={setReps} />
          <ChipRow label="RPE" options={RPE_OPTIONS} value={rpe} onChange={setRpe} />
          <Button onClick={save}>
            Gem sæt {logged.length + 1} af {exercise.sets}
          </Button>
        </div>

        {logged.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Label tone="muted">Loggede sæt</Label>
            {logged.map((set, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderBottom: `1px solid ${color.line}`,
                }}
              >
                <Meta style={{ width: '2rem', color: color.dim }}>#{i + 1}</Meta>
                <span style={{ fontFamily: font.display, fontSize: '1.1rem', color: color.text }}>
                  {set.weightKg > 0 ? `${set.weightKg} kg` : 'kropsvægt'} × {set.reps}
                </span>
                <Meta style={{ marginLeft: 'auto', color: color.accent }}>RPE {set.rpe}</Meta>
              </div>
            ))}
            <button
              onClick={() => onChange(removeLastSet(draft, exercise.id))}
              style={{
                background: 'none',
                border: 'none',
                color: color.dim,
                fontFamily: font.mono,
                fontSize: '0.55rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: '0.6rem 0',
              }}
            >
              Fortryd sidste sæt
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {index > 0 && (
            <Button variant="ghost" onClick={() => setIndex(index - 1)}>
              Forrige
            </Button>
          )}
          {isLast ? (
            <Button variant="soft" onClick={onFinish}>
              Afslut pas · {totals.sets}/{target} sæt logget
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setIndex(index + 1)}>
              Næste øvelse
            </Button>
          )}
        </div>

        <Meta style={{ marginTop: '1rem', color: color.dim, textAlign: 'center' }}>
          {totals.sets} sæt · {totals.volume} kg samlet · gemmes automatisk
        </Meta>
      </div>
    </div>
  )
}

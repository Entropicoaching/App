// Onboarding: fire spørgsmål, ét pr. skærm, og derefter det program valgene
// peger på. Ingen konto, ingen mail, ingen betaling.

import { useState } from 'react'
import { color, font, s } from '../theme'
import { Button, Card, ChoiceList, Label, Meta } from '../ui'
import { LEVELS, EQUIPMENT, DAY_OPTIONS, getProgram } from '../programs'
import { selectProgram, explainSelection } from '../selectProgram'
import { newProfile } from '../storage'

const STEPS = ['Navn', 'Niveau', 'Dage', 'Udstyr', 'Program']

export default function Onboarding({ onCreate }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [level, setLevel] = useState('begynder')
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [equipment, setEquipment] = useState('dumbbells')

  const choices = { level, daysPerWeek, equipment }
  const { programId } = selectProgram(choices)
  const program = getProgram(programId)

  const next = () => setStep(v => Math.min(STEPS.length - 1, v + 1))
  const back = () => setStep(v => Math.max(0, v - 1))

  return (
    <div style={s.wrap}>
      <header style={{ ...s.topbar, justifyContent: 'center' }}>
        <span style={s.logo}>Entropi</span>
      </header>

      <div style={{ ...s.page, paddingTop: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.5rem' }}>
          {STEPS.map((label, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                height: '3px',
                background: i <= step ? color.accent : color.lineStrong,
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 style={s.h1}>Velkommen.</h1>
            <p style={{ ...s.body, marginBottom: '1.5rem' }}>
              Fire spørgsmål, så har du et fast program. Alt gemmes kun på denne enhed.
            </p>
            <Meta style={{ marginBottom: '0.4rem' }}>Hvad hedder du?</Meta>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Fornavn"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '52px',
                background: color.panel,
                border: `1px solid ${color.lineStrong}`,
                color: color.text,
                fontFamily: font.sans,
                fontSize: '1rem',
                fontWeight: 300,
                padding: '0.7rem 0.9rem',
                outline: 'none',
                marginBottom: '1.5rem',
              }}
            />
            <Button onClick={next} disabled={!name.trim()}>
              Fortsæt
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 style={s.h1}>Hvor lang tid har du trænet?</h1>
            <p style={{ ...s.body, marginBottom: '1.25rem' }}>
              Det afgør hvor tunge programmerne må være.
            </p>
            <ChoiceList
              options={LEVELS.map(l => ({ value: l.id, label: l.label, note: l.note }))}
              value={level}
              onChange={nextLevel => { setLevel(nextLevel); if (nextLevel === 'begynder' && daysPerWeek === 4) setDaysPerWeek(3) }}
            />
            <div style={{ marginTop: '1.5rem' }}>
              <Button onClick={next}>Fortsæt</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={s.h1}>Hvor mange dage om ugen?</h1>
            <p style={{ ...s.body, marginBottom: '1.25rem' }}>
              Vælg det du kan holde hver uge — ikke det du håber på.
            </p>
            <ChoiceList
              options={(level === 'begynder' ? DAY_OPTIONS.filter(d => d < 4) : DAY_OPTIONS).map(d => ({ value: d, label: `${d} dage om ugen` }))}
              value={daysPerWeek}
              onChange={setDaysPerWeek}
            />
            <div style={{ marginTop: '1.5rem' }}>
              <Button onClick={next}>Fortsæt</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 style={s.h1}>Hvad har du adgang til?</h1>
            <p style={{ ...s.body, marginBottom: '1.25rem' }}>
              Vælg det mindste du har til rådighed hver gang.
            </p>
            <ChoiceList
              options={EQUIPMENT.map(e => ({ value: e.id, label: e.label }))}
              value={equipment}
              onChange={setEquipment}
            />
            <div style={{ marginTop: '1.5rem' }}>
              <Button onClick={next}>Se mit program</Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Label>Dit program</Label>
            <h1 style={s.h1}>{program.name}</h1>
            <p style={{ ...s.body, marginBottom: '1.25rem' }}>{program.summary}</p>

            <Card>
              <Label tone="muted">Hvorfor dette program</Label>
              <p style={{ ...s.body, color: color.text, fontSize: '0.85rem' }}>
                {explainSelection(choices)}
              </p>
            </Card>

            <Card>
              <Label tone="muted">Ugens pas</Label>
              {program.sessions.map(session => (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: `1px solid ${color.line}`,
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: color.text }}>{session.name}</span>
                  <Meta>{session.exercises.length} øvelser</Meta>
                </div>
              ))}
            </Card>

            <Button
              onClick={() =>
                onCreate(newProfile({ name, level, daysPerWeek, equipment, programId }))
              }
            >
              Start her
            </Button>
          </>
        )}

        {step > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="ghost" onClick={back}>
              Tilbage
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

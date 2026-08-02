import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FIRST_PILOT_BASELINES, FIRST_PILOT_INPUT, createFirstPilotReview } from './pilotProgramReviewData.js'
import { color, s } from './theme.js'
import { Button, Card, Label, Meta, Stepper, TopBar } from './ui.jsx'

const pretty = {
  'low-bar': 'Low-bar squat',
  'high-bar': 'High-bar squat',
  sumo: 'Sumo dødløft',
  conventional: 'Konventionel dødløft',
}

function StatusPill({ children, tone = 'accent' }) {
  return <span style={{ display: 'inline-block', border: `1px solid ${tone === 'warn' ? 'rgba(237,234,226,0.18)' : color.accentBorder}`, color: tone === 'warn' ? color.muted : color.accent, background: tone === 'warn' ? 'transparent' : color.accentSoft, padding: '0.32rem 0.45rem', fontSize: '0.52rem', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{children}</span>
}

function MovementRow({ movement }) {
  const load = Number.isFinite(movement.startingLoadKg) ? `${movement.startingLoadKg} kg startbelastning` : 'Ingen automatisk startbelastning'
  return (
    <div style={{ padding: '0.85rem 0', borderTop: `1px solid ${color.line}` }}>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ fontWeight: 400, fontSize: '0.96rem' }}>{movement.exerciseName}</strong>
        <Meta>{movement.roleClass === 'main' ? 'Hovedløft' : 'Assistance'}</Meta>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.7rem', marginTop: '0.38rem', color: color.muted, fontSize: '0.8rem' }}>
        <span>{movement.prescription.sets} sæt</span>
        <span>{movement.prescription.reps} reps</span>
        <span>RPE {movement.prescription.targetRpe}</span>
      </div>
      <Meta style={{ marginTop: '0.42rem' }}>{load}</Meta>
    </div>
  )
}

export default function App() {
  const [baselines, setBaselines] = useState(FIRST_PILOT_BASELINES)
  const [localDecision, setLocalDecision] = useState('awaiting')
  const review = useMemo(() => createFirstPilotReview(baselines), [baselines])
  const { reviewPackage, program, validation } = review

  return (
    <div style={s.wrap}>
      <TopBar title="Entropi" right={<Meta>Lokalt review</Meta>} />
      <main style={s.page}>
        <Label>Første pilot · review v1</Label>
        <h1 style={s.h1}>2-dages styrkeløftfundament</h1>
        <p style={{ ...s.body, margin: '0 0 1.25rem' }}>En faglig reviewflade for Marc. Den læser kun den eksisterende programmotor og kan hverken tildele, gemme eller aktivere et program.</p>

        <Card style={{ borderColor: color.accentBorder }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            <StatusPill>Reviewklar</StatusPill>
            <StatusPill tone="warn">Ikke tildelt</StatusPill>
          </div>
          <Label>Programramme</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div><Meta>Mål</Meta><div style={{ marginTop: '0.18rem' }}>Styrkeløftfundament</div></div>
            <div><Meta>Frekvens</Meta><div style={{ marginTop: '0.18rem' }}>2 pas pr. uge</div></div>
            <div><Meta>Niveau</Meta><div style={{ marginTop: '0.18rem' }}>Øvet</div></div>
            <div><Meta>Udstyr</Meta><div style={{ marginTop: '0.18rem' }}>Gym</div></div>
          </div>
          <Meta style={{ marginTop: '0.85rem' }}>Template {reviewPackage?.decisionTrail?.template?.id} · v{reviewPackage?.decisionTrail?.template?.version}</Meta>
        </Card>

        <Card>
          <Label>Eksplicitte løftvalg</Label>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <StatusPill>{pretty[FIRST_PILOT_INPUT.squatStyle]}</StatusPill>
            <StatusPill>{pretty[FIRST_PILOT_INPUT.deadliftStyle]}</StatusPill>
          </div>
          <p style={{ ...s.body, fontSize: '0.82rem', margin: '0.85rem 0 0' }}>Varianterne kommer fra eksplicit atletinput. Motoren gætter ikke og bytter dem ikke ud.</p>
        </Card>

        <Card>
          <Label>Startbelastninger · eksplicit input</Label>
          <p style={{ ...s.body, fontSize: '0.82rem', margin: '0 0 1rem' }}>Kun synlige startværdier på hovedløft. Ingen 1RM-beregning, procentgæt eller assistancevægte.</p>
          {['squat', 'bench', 'deadlift'].map(id => (
            <Stepper key={id} label={id === 'squat' ? 'Squat' : id === 'bench' ? 'Bænkpres' : 'Dødløft'} value={baselines[id]} unit="kg" step={2.5} min={0} onChange={value => setBaselines(current => ({ ...current, [id]: value }))} />
          ))}
          {!validation.ok && <p style={{ color: '#d98973', fontSize: '0.8rem', margin: 0 }}>Alle tre hovedløft skal have en konkret arbejdsbelastning, før reviewet kan vises.</p>}
        </Card>

        {program && (
          <>
            <Label>Uge 1 · den konkrete ramme</Label>
            {program.sessions.map(session => (
              <Card key={session.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                  <h2 style={s.h2}>{session.label}</h2>
                  <Meta>{session.movements.length} øvelser</Meta>
                </div>
                {session.movements.map(movement => <MovementRow key={`${session.id}-${movement.role}`} movement={movement} />)}
              </Card>
            ))}
          </>
        )}

        <Card style={{ background: '#181814' }}>
          <Label>Hårde grænser for denne flade</Label>
          <ul style={{ ...s.body, paddingLeft: '1.1rem', margin: 0, fontSize: '0.82rem' }}>
            <li>Ingen automatisk progression eller ændring af uge 2.</li>
            <li>Ingen programtildeling, konto, entitlements eller shadow-skrivning.</li>
            <li>En senere tildeling kræver en immutabel, Marc-godkendt programversion og server-side assignment.</li>
          </ul>
        </Card>

        <Button onClick={() => setLocalDecision('approved-for-next-review')}>{localDecision === 'approved-for-next-review' ? 'Lokalt markeret til næste reviewtrin' : 'Markér fagligt godkendt lokalt'}</Button>
        <p style={{ ...s.body, textAlign: 'center', fontSize: '0.75rem', marginTop: '0.65rem' }}>Markeringen er kun i denne fane og forsvinder ved genindlæsning. Den aktiverer intet.</p>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)

import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { buildProgramScenarioMatrix, scenarioMatrixSummary, validateProgramScenarioMatrix } from './programScenarioMatrix.js'
import { color, s } from './theme.js'
import { Card, Label, Meta, TopBar } from './ui.jsx'

const pretty = {
  'general-strength': 'Generel styrke',
  'powerlifting-foundation': 'Styrkeløftfundament',
  begynder: 'Nybegynder', oevet: 'Øvet',
  gym: 'Full gym',
  'high-bar': 'High-bar', 'low-bar': 'Low-bar', conventional: 'Konventionel', sumo: 'Sumo',
  'not-sure': 'Uafklaret', empty: 'Ikke valgt',
  'review-ready': 'Reviewklar', 'manual-review': 'Stopper til manuelt review',
}

function value(value) { return pretty[value || 'empty'] || value }

function Filter({ label, value, options, onChange }) {
  return <label style={{ display: 'block', marginBottom: '0.7rem' }}>
    <Meta style={{ textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</Meta>
    <select value={value} onChange={event => onChange(event.target.value)} style={{ width: '100%', minHeight: '42px', background: color.bg, color: color.text, border: `1px solid ${color.lineStrong}`, padding: '0 0.55rem' }}>
      <option value="all">Alle</option>
      {options.map(option => <option key={option} value={option}>{value(option)}</option>)}
    </select>
  </label>
}

export default function App() {
  const scenarios = useMemo(() => buildProgramScenarioMatrix(), [])
  const validation = useMemo(() => validateProgramScenarioMatrix(scenarios), [scenarios])
  const summary = useMemo(() => scenarioMatrixSummary(scenarios), [scenarios])
  const [filters, setFilters] = useState({ goal: 'all', days: 'all', level: 'all', equipment: 'all', outcome: 'all' })
  const filtered = scenarios.filter(scenario =>
    (filters.goal === 'all' || scenario.input.goal === filters.goal) &&
    (filters.days === 'all' || String(scenario.input.daysPerWeek) === filters.days) &&
    (filters.level === 'all' || scenario.input.level === filters.level) &&
    (filters.equipment === 'all' || scenario.input.equipment === filters.equipment) &&
    (filters.outcome === 'all' || scenario.outcome === filters.outcome)
  )
  const visible = filtered.slice(0, 80)
  const set = key => next => setFilters(current => ({ ...current, [key]: next }))

  return <div style={s.wrap}>
    <TopBar title="Entropi" right={<Meta>Lokalt benchmark</Meta>} />
    <main style={{ ...s.page, maxWidth: '960px' }}>
      <Label>Programmotor · scenariematrix v{summary.version}</Label>
      <h1 style={s.h1}>Deterministisk før vi bygger videre.</h1>
      <p style={{ ...s.body, margin: '0 0 1.2rem' }}>Denne flade læser v1's full-gym templates og resolver. Den viser alle kombinationer, som piloten faktisk tilbyder, og de bevidste stop — fx 4 dage for nybegyndere eller uafklarede styrkeløftvarianter. Den tildeler, gemmer eller ændrer intet.</p>

      <Card style={{ borderColor: validation.ok ? color.accentBorder : '#d98973' }}>
        <Label>{validation.ok ? 'Benchmark består' : 'Benchmark fejler'}</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.8rem' }}>
          <div><Meta>Inputs testet</Meta><div style={{ marginTop: '0.25rem', fontSize: '1.35rem' }}>{summary.total}</div></div>
          <div><Meta>Reviewklare</Meta><div style={{ marginTop: '0.25rem', fontSize: '1.35rem', color: color.good }}>{summary.outcomes['review-ready'] || 0}</div></div>
          <div><Meta>Bevidste stop</Meta><div style={{ marginTop: '0.25rem', fontSize: '1.35rem', color: color.muted }}>{summary.outcomes['manual-review'] || 0}</div></div>
        </div>
        <p style={{ ...s.body, fontSize: '0.8rem', margin: '0.9rem 0 0' }}>Styrkeløftfundament bliver kun reviewklart med eksplicit squat- og dødløftvariant. “Uafklaret” giver aldrig et gæt.</p>
      </Card>

      <Card>
        <Label>Filtrér inputfladen</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
          <Filter label="Mål" value={filters.goal} options={['general-strength', 'powerlifting-foundation']} onChange={set('goal')} />
          <Filter label="Dage" value={filters.days} options={['2', '3', '4']} onChange={set('days')} />
          <Filter label="Niveau" value={filters.level} options={['begynder', 'oevet']} onChange={set('level')} />
          <Filter label="Udstyr" value={filters.equipment} options={['gym']} onChange={set('equipment')} />
          <Filter label="Resultat" value={filters.outcome} options={['review-ready', 'manual-review']} onChange={set('outcome')} />
        </div>
        <Meta>Viser {Math.min(visible.length, filtered.length)} af {filtered.length} scenarier{filtered.length > visible.length ? ' · afgrænset for læsbarhed' : ''}</Meta>
      </Card>

      {visible.map(scenario => <Card key={scenario.id} style={{ borderLeft: `3px solid ${scenario.outcome === 'review-ready' ? color.good : color.lineStrong}`, padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontWeight: 400 }}>{value(scenario.input.goal)} · {scenario.input.daysPerWeek} dage</strong>
          <Meta style={{ color: scenario.outcome === 'review-ready' ? color.good : color.muted }}>{value(scenario.outcome)}</Meta>
        </div>
        <p style={{ ...s.body, fontSize: '0.78rem', margin: '0.35rem 0 0' }}>{value(scenario.input.level)} · {value(scenario.input.equipment)} · squat: {value(scenario.input.squatStyle)} · dødløft: {value(scenario.input.deadliftStyle)}</p>
        {scenario.program ? <p style={{ ...s.body, fontSize: '0.78rem', margin: '0.4rem 0 0', color: color.text }}>→ {scenario.program.templateId}; squat: {scenario.program.squat?.exerciseId || '–'} ({scenario.program.squat?.selection || '–'}); dødløft: {scenario.program.deadlift?.exerciseId || '–'} ({scenario.program.deadlift?.selection || '–'})</p> : <p style={{ ...s.body, fontSize: '0.78rem', margin: '0.4rem 0 0' }}>→ Stop: {scenario.reason}</p>}
      </Card>)}
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)

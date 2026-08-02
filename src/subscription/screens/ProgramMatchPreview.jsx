import { useEffect, useState } from 'react'
import { DAY_OPTIONS, LEVELS } from '../programs.js'
import { clearProgramMatchDraft, loadProgramMatchDraft, saveProgramMatchDraft } from '../pilotCache.js'
import { explainTemplateSelection, PROGRAM_MATCH_INPUT_SCHEMA_VERSION, selectTemplate, validateTemplateInput } from '../templateMatcher.js'
import { resolveProgramDraft } from '../programResolver.js'
import { createProgramReviewPackage } from '../programReviewPackage.js'
import { Button, Card, ChoiceList, Label, Meta } from '../ui.jsx'
import { color, s } from '../theme.js'

const GOALS = [
  { value: 'general-strength', label: 'Bliv generelt stærkere' },
  { value: 'powerlifting-foundation', label: 'Byg et styrkeløftfundament' },
]

const SQUAT_STYLE_OPTIONS = [
  { value: 'high-bar', label: 'High-bar squat' },
  { value: 'low-bar', label: 'Low-bar squat' },
  { value: 'not-sure', label: 'Ved ikke endnu' },
]

const DEADLIFT_STYLE_OPTIONS = [
  { value: 'conventional', label: 'Konventionel dødløft' },
  { value: 'sumo', label: 'Sumo dødløft' },
  { value: 'not-sure', label: 'Ved ikke endnu' },
]

function initialDraft(userId, initialInput) {
  const saved = loadProgramMatchDraft(userId)
  // V1 er bevidst kun full gym. Et gammelt lokalt home-draft må derfor aldrig
  // genskabe en vej, som ikke kan afsluttes i den aktuelle pilot.
  if (saved?.schemaVersion === PROGRAM_MATCH_INPUT_SCHEMA_VERSION && validateTemplateInput(saved).valid) return { ...saved, equipment: 'gym' }
  if (initialInput?.schemaVersion === PROGRAM_MATCH_INPUT_SCHEMA_VERSION && validateTemplateInput(initialInput).valid) return { ...initialInput, equipment: 'gym' }
  return { schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION, goal: '', level: '', daysPerWeek: null, equipment: 'gym', squatStyle: '', deadliftStyle: '', updatedAt: null }
}

export default function ProgramMatchPreview({ userId, onBack, initialInput = null, onContinue = null, continueLabel = 'Fortsæt', onDraftChange = null }) {
  const [draft, setDraft] = useState(() => initialDraft(userId, initialInput))
  useEffect(() => { onDraftChange?.(draft) }, [draft, onDraftChange])
  const update = (field, value) => {
    const next = { ...draft, schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION, [field]: value, updatedAt: new Date().toISOString() }
    // Fire pas er en bevidst øvet-ramme i v1. Vi ændrer ikke stil- eller
    // målvalg her; kun en ikke-understøttet frekvens falder tilbage til tre.
    if (field === 'level' && value === 'begynder' && Number(next.daysPerWeek) === 4) next.daysPerWeek = 3
    setDraft(next)
    saveProgramMatchDraft(userId, next)
  }
  const coreComplete = Boolean(draft.goal && draft.level && draft.daysPerWeek && draft.equipment)
  const stylesComplete = Boolean(draft.squatStyle && draft.deadliftStyle)
  const complete = coreComplete && (draft.goal !== 'powerlifting-foundation' || stylesComplete)
  const selection = complete ? selectTemplate(draft) : null
  const resolution = complete ? resolveProgramDraft(draft) : null
  const reviewPackage = complete ? createProgramReviewPackage(draft) : null
  const styleLabel = (style, type) => ({
    'high-bar': 'High-bar squat',
    'low-bar': 'Low-bar squat',
    conventional: 'Konventionel dødløft',
    sumo: 'Sumo dødløft',
    'not-sure': 'Ved ikke endnu',
  }[style] || (type === 'squat' ? 'Standardvalg' : 'Standardvalg'))
  const reset = () => {
    clearProgramMatchDraft(userId)
    setDraft(initialDraft(userId, initialInput))
  }

  return (
    <div style={s.page}>
      <Label>Programforslag · preview</Label>
      <Meta style={{ marginBottom: '0.55rem', color: color.accent }}>Trin 2 af 4 · dine valg kan rettes, før programmet vises.</Meta>
      <h1 style={s.h1}>Find en ramme,<br />før vi fylder den ud.</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>Dette er kun et lokalt forslag. Det opretter ikke et program, ændrer ikke din konto og sender ikke dine valg til Entropi.</p>
      <Card><Meta style={{ marginBottom: '0.55rem' }}>Mål</Meta><ChoiceList options={GOALS} value={draft.goal} onChange={value => update('goal', value)} /></Card>
      <Card><Meta style={{ marginBottom: '0.55rem' }}>Erfaring</Meta><ChoiceList options={LEVELS.map(item => ({ value: item.id, label: item.label, note: item.note }))} value={draft.level} onChange={value => update('level', value)} /></Card>
      <Card><Meta style={{ marginBottom: '0.55rem' }}>Træningsdage</Meta><ChoiceList options={(draft.level === 'begynder' ? DAY_OPTIONS.filter(value => value < 4) : DAY_OPTIONS).map(value => ({ value, label: `${value} dage om ugen` }))} value={draft.daysPerWeek} onChange={value => update('daysPerWeek', value)} /><Meta style={{ marginTop: '0.55rem' }}>{draft.level === 'begynder' ? 'Fire ugentlige pas åbner i øvet-sporet; først bygger vi en rytme, der kan holdes.' : 'Fire pas fordeles som to underkrops- og to overkropspas.'}</Meta></Card>
      <Card><Meta style={{ marginBottom: '0.55rem' }}>Pilotramme</Meta><p style={{ ...s.body, color: color.text, margin: 0 }}>Full gym er valgt for denne v1. Hjemmetræning er ikke en skjult, halvfærdig mulighed i piloten.</p></Card>
      <Card><Meta style={{ marginBottom: '0.55rem' }}>Squat-variant</Meta><ChoiceList options={SQUAT_STYLE_OPTIONS} value={draft.squatStyle} onChange={value => update('squatStyle', value)} /><Meta style={{ marginTop: '0.55rem' }}>{draft.goal === 'powerlifting-foundation' ? 'Påkrævet for styrkeløftfundament.' : 'Valgfrit for generel styrke — et aktivt valg bruges i programudkastet.'}</Meta></Card>
      <Card><Meta style={{ marginBottom: '0.55rem' }}>Dødløft-variant</Meta><ChoiceList options={DEADLIFT_STYLE_OPTIONS} value={draft.deadliftStyle} onChange={value => update('deadliftStyle', value)} /><Meta style={{ marginTop: '0.55rem' }}>{draft.goal === 'powerlifting-foundation' ? 'Påkrævet for styrkeløftfundament.' : 'Valgfrit for generel styrke — et aktivt valg bruges i programudkastet.'}</Meta></Card>
      {selection && <Card style={{ borderColor: selection.outcome === 'matched' ? color.accentBorder : color.lineStrong }}>
        <Label>{selection.outcome === 'matched' ? 'Mulig programramme' : 'Ingen sikker ramme endnu'}</Label>
        <p style={{ ...s.body, color: color.text, margin: 0 }}>{explainTemplateSelection(draft)}</p>
        <Meta style={{ marginTop: '0.75rem' }}>Ingen tildeling er foretaget.</Meta>
      </Card>}
      {resolution?.outcome === 'manual-review' && <Card style={{ borderColor: color.lineStrong }}>
        <Label>Program kan ikke vises endnu</Label>
        <p style={{ ...s.body, color: color.text, margin: 0 }}>{resolution.reason === 'styrkeløftvariant-mangler' ? 'Styrkeløftfundament kræver et konkret valg af både squat- og dødløftvariant.' : 'De gemte valg passer ikke sikkert på en programramme. Vælg dem igen, før vi viser et program.'}</p>
      </Card>}
      {resolution?.outcome === 'review-ready' && <Card>
        <Label>Første programudkast</Label>
        <p style={{ ...s.body, margin: '0 0 0.8rem' }}>{resolution.policyLane.rationale}</p>
        <Meta style={{ marginBottom: '0.75rem' }}>Dine valg: {styleLabel(draft.squatStyle, 'squat')} · {styleLabel(draft.deadliftStyle, 'deadlift')}</Meta>
        {resolution.program.sessions.map(session => <div key={session.id} style={{ padding: '0.7rem 0', borderTop: `1px solid ${color.line}` }}>
          <Meta style={{ marginBottom: '0.35rem' }}>{session.label}</Meta>
          {session.movements.map(movement => <div key={`${session.id}-${movement.role}`} style={{ color: color.text, fontSize: '0.9rem', lineHeight: 1.55 }}>
            {movement.exerciseName} <span style={{ color: color.muted, fontSize: '0.76rem' }}>· {movement.selection === 'athlete-style-preference' ? 'valgt af dig' : 'standardvalg'}</span>
            <div style={{ color: color.muted, fontSize: '0.78rem' }}>{movement.prescription.sets} sæt × {movement.prescription.reps} · RPE {movement.prescription.targetRpe}</div>
          </div>)}
        </div>)}
        <Meta style={{ marginTop: '0.85rem' }}>Review-ID: {reviewPackage.reviewId} · Dette er en lokal, reviewklar version. Den bliver aldrig tildelt eller justeret automatisk før programversion og progresionsregler er godkendt.</Meta>
        {onContinue && <Button onClick={() => onContinue(reviewPackage)} style={{ marginTop: '0.85rem' }}>{continueLabel}</Button>}
      </Card>}
      <Button variant="ghost" onClick={reset}>Nulstil programvalg</Button>
      <Button variant="ghost" onClick={onBack} style={{ marginTop: '0.6rem' }}>Tilbage til pilot</Button>
    </div>
  )
}

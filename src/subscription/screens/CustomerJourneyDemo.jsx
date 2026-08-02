import { useEffect, useMemo, useState } from 'react'
import ProgramMatchPreview from './ProgramMatchPreview.jsx'
import { buildWeekTwoProposal, createCustomerProgram, createProgramReviewPackage, createWeekTwoView } from '../programReviewPackage.js'
import { BASELINE_LIFTS, emptyBaselineLoads, estimatedOneRepMaxFromPerformance, validateBaselineLoads, weekOnePercentageForMovement, weekOneStartingLoadFromOneRepMax } from '../baselineLoads.js'
import { summarizeCustomerWeek, validateCustomerSetLog } from '../customerSetLogging.js'
import { customerSetPresentationState, isCustomerSessionReady, nextUnconfirmedSetIndex } from '../customerJourneyState.js'
import { clearLocalCustomerJourney, loadLocalCustomerJourney, loadLocalCustomerJourneyForDemo, localDemoIdFromEmail, saveLocalCustomerJourney } from '../localCustomerJourney.js'
import { Button, Card, ChipRow, Label, Meta, Stepper } from '../ui.jsx'
import { color, font, s } from '../theme.js'

function EmailStart({ onContinue }) {
  const [email, setEmail] = useState('')
  return <div style={s.page}><Label>Entropi · medlemsdemo</Label><Meta style={{ marginBottom: '0.55rem', color: color.accent }}>Trin 1 af 4 · lokal pilot</Meta><h1 style={s.h1}>Start med<br />dit program.</h1><p style={{ ...s.body, marginBottom: '1.3rem' }}>Din e-mail bruges normalt til et sikkert login-link. I denne lokale demo sendes eller gemmes den ikke.</p><Meta style={{ marginBottom: '0.4rem' }}>E-mail</Meta><input value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="navn@eksempel.dk" style={{ width: '100%', boxSizing: 'border-box', minHeight: '52px', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.text, fontFamily: font.sans, fontSize: '1rem', padding: '0.7rem 0.9rem', marginBottom: '1rem' }} /><Button disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => onContinue(email)}>Fortsæt</Button></div>
}

function BaselineLoadsInput({ reviewPackage, onContinue, onBack }) {
  const [values, setValues] = useState(emptyBaselineLoads)
  const validation = validateBaselineLoads(values)
  const matchInput = reviewPackage.decisionTrail.matchInput
  const mainMovementFor = lift => reviewPackage.program.sessions.flatMap(session => session.movements).find(movement => movement.role === lift.role) || null
  const liftLabel = lift => {
    if (lift.id === 'squat' && matchInput.squatStyle && matchInput.squatStyle !== 'not-sure') return `${matchInput.squatStyle === 'low-bar' ? 'Low-bar' : 'High-bar'} squat`
    if (lift.id === 'deadlift' && matchInput.deadliftStyle && matchInput.deadliftStyle !== 'not-sure') return `${matchInput.deadliftStyle === 'sumo' ? 'Sumo' : 'Konventionel'} dødløft`
    return lift.label
  }
  const update = (id, field, raw) => {
    const cleaned = String(raw).replace(',', '.')
    if (cleaned === '' && field === 'weightKg') return setValues(current => ({ ...current, [id]: { ...current[id], weightKg: null } }))
    if (/^\d*\.?\d*$/.test(cleaned)) setValues(current => ({ ...current, [id]: { ...current[id], [field]: Number(cleaned) } }))
  }
  return <div style={s.page}>
    <Label>Program · tungeste sæt</Label><Meta style={{ marginBottom: '0.55rem', color: color.accent }}>Trin 3 af 4 · det her bruges kun til din synlige uge-1-start.</Meta><h1 style={s.h1}>Start med<br />det, du kan nu.</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>Skriv et nyligt, repræsentativt tungt sæt: vægt, reps og RPE. Et 1RM er blot 1 rep ved RPE 10. Appen udleder et e1RM og bruger det kun til en konservativ uge-1-startvægt.</p>
    {BASELINE_LIFTS.map(lift => <Card key={lift.id} style={{ marginBottom: '0.7rem' }}>
      <Meta>{liftLabel(lift)}</Meta>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', marginTop: '0.45rem' }}>
        <input aria-label={`${liftLabel(lift)} vægt i kg`} inputMode="decimal" placeholder="fx 200" value={values[lift.id]?.weightKg ?? ''} onChange={event => update(lift.id, 'weightKg', event.target.value)} style={{ width: '100%', minHeight: '52px', boxSizing: 'border-box', background: color.bg, border: `1px solid ${validation.errors[lift.id] ? color.lineStrong : color.accentBorder}`, color: color.text, fontFamily: font.display, fontSize: '1.55rem', padding: '0.35rem 0.65rem' }} />
        <Meta style={{ whiteSpace: 'nowrap' }}>kg</Meta>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginTop: '0.55rem' }}><label><Meta>Reps</Meta><input aria-label={`${liftLabel(lift)} reps`} inputMode="numeric" value={values[lift.id]?.reps ?? 1} onChange={event => update(lift.id, 'reps', event.target.value)} style={{ width: '100%', minHeight: '42px', marginTop: '0.25rem', boxSizing: 'border-box', background: color.bg, border: `1px solid ${color.lineStrong}`, color: color.text, fontFamily: font.sans, padding: '0.35rem 0.55rem' }} /></label><label><Meta>RPE</Meta><input aria-label={`${liftLabel(lift)} RPE`} inputMode="decimal" value={values[lift.id]?.rpe ?? 10} onChange={event => update(lift.id, 'rpe', event.target.value)} style={{ width: '100%', minHeight: '42px', marginTop: '0.25rem', boxSizing: 'border-box', background: color.bg, border: `1px solid ${color.lineStrong}`, color: color.text, fontFamily: font.sans, padding: '0.35rem 0.55rem' }} /></label></div>
      {validation.errors[lift.id] ? <Meta style={{ color: color.dim, marginTop: '0.45rem' }}>Mangler vægt, reps eller RPE.</Meta> : values[lift.id]?.weightKg ? <Meta style={{ color: color.accent, marginTop: '0.45rem' }}>e1RM ca. {estimatedOneRepMaxFromPerformance(values[lift.id])} kg · uge 1 starter på {weekOneStartingLoadFromOneRepMax(lift.id, estimatedOneRepMaxFromPerformance(values[lift.id]), mainMovementFor(lift)?.prescription)} kg ({Math.round(weekOnePercentageForMovement(lift.id, mainMovementFor(lift)?.prescription) * 1000) / 10} %).</Meta> : null}
    </Card>)}
    <Card style={{ borderColor: color.lineStrong }}><Meta>Det du ser bagefter</Meta><p style={{ ...s.body, color: color.text, margin: '0.35rem 0 0' }}>Dit tunge sæt omregnes gennemsigtigt til et e1RM. Det bliver kun brugt til en konservativ uge-1-startvægt på hovedløftene. Assistanceøvelser får ingen gættet vægt, og vægten kan justeres før hvert sæt.</p></Card>
    <Button disabled={!validation.ok} onClick={() => onContinue(validation.values)}>Se mit uge-1-program</Button>
    <Button variant="ghost" onClick={onBack} style={{ marginTop: '0.6rem' }}>Tilbage</Button>
  </div>
}

function plannedReps(movement) {
  if (Number.isInteger(movement.prescription.targetReps)) return movement.prescription.targetReps
  const range = String(movement.prescription.reps).match(/\d+/g)?.map(Number) || []
  return range.length > 1 ? Math.round((range[0] + range[range.length - 1]) / 2) : range[0] || 1
}
function plannedRpe(movement) { const values = String(movement.prescription.targetRpe).match(/\d+(?:\.\d+)?/g)?.map(Number) || []; return values.length ? Math.max(...values) : 7 }
function createSetRows(session, weekNumber = 1) {
  return session.movements.flatMap(movement => Array.from({ length: movement.prescription.sets }, (_, index) => ({
    weekNumber, sessionId: session.id, exerciseId: movement.exerciseId, exerciseName: movement.exerciseName, roleClass: movement.roleClass, setNumber: index + 1,
    planned: { weightKg: movement.weekTwoStartingLoadKg ?? movement.startingLoadKg ?? 0, reps: plannedReps(movement), rpe: plannedRpe(movement) },
    actual: { weightKg: movement.weekTwoStartingLoadKg ?? movement.startingLoadKg ?? 0, repsCompleted: plannedReps(movement), rpeActual: plannedRpe(movement), note: '', skipped: false },
  })))
}

function SessionCheckIn({ session, sessionNumber, sessionCount, weekNumber = 1, onComplete, initialDraft = null, onDraftChange = null }) {
  const restored = initialDraft?.sessionId === session.id && initialDraft?.weekNumber === weekNumber ? initialDraft : null
  const [rows, setRows] = useState(() => restored?.rows || createSetRows(session, weekNumber))
  const [confirmed, setConfirmed] = useState(() => restored?.confirmed || {})
  const [activeIndex, setActiveIndex] = useState(() => restored?.activeIndex ?? 0)
  useEffect(() => { onDraftChange?.({ weekNumber, sessionId: session.id, rows, confirmed, activeIndex }) }, [activeIndex, confirmed, onDraftChange, rows, session.id, weekNumber])
  const update = (index, field, value) => setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, actual: { ...row.actual, [field]: value } } : row))
  const toggleSkip = index => setRows(current => current.map((row, rowIndex) => rowIndex !== index ? row : { ...row, actual: row.actual.skipped ? { ...row.actual, skipped: false, weightKg: 0, repsCompleted: row.planned.reps, rpeActual: row.planned.rpe } : { weightKg: null, repsCompleted: null, rpeActual: null, note: row.actual.note, skipped: true } }))
  const sessionReady = isCustomerSessionReady(rows, confirmed, validateCustomerSetLog)
  const confirmSet = index => {
    setConfirmed(current => ({ ...current, [index]: true }))
    setActiveIndex(nextUnconfirmedSetIndex(rows.length, confirmed, index))
  }
  const complete = () => {
    const setLogs = rows.map(row => validateCustomerSetLog(row).value)
    const logs = session.movements.filter(movement => movement.roleClass === 'main').map(movement => {
      const last = setLogs.filter(row => row.exerciseId === movement.exerciseId && !row.actual.skipped).at(-1)
      return last ? { exerciseId: movement.exerciseId, loadKg: last.actual.weightKg, reps: last.actual.repsCompleted, rpe: last.actual.rpeActual } : null
    }).filter(Boolean)
    onDraftChange?.(null)
    onComplete({ sessionId: session.id, logs, setLogs })
  }
  return <div style={s.page}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.45rem' }}>
      <Meta>Uge {weekNumber} · pas {sessionNumber}</Meta><Meta>Pas {sessionNumber} af {sessionCount}</Meta>
    </div>
    <div aria-hidden="true" style={{ height: '3px', background: color.lineStrong, marginBottom: '1.1rem' }}><div style={{ height: '100%', width: `${(sessionNumber / sessionCount) * 100}%`, background: color.accent }} /></div>
    <Label>Uge {weekNumber} · pas {sessionNumber}</Label><Meta style={{ marginBottom: '0.55rem', color: color.accent }}>Trin 4 af 4 · bekræft ét sæt ad gangen.</Meta><h1 style={s.h1}>{session.label}</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>Du logger hvert sæt som i atletportalen: vægt, planlagte reps, RPE, en valgfri note eller “spring over”. Plan og faktisk udførelse holdes adskilt.</p>
    {session.movements.map(movement => {
      const movementRows = rows.map((row, index) => ({ row, index })).filter(item => item.row.exerciseId === movement.exerciseId)
      return <Card key={movement.exerciseId} style={{ marginBottom: '1rem', borderColor: color.lineStrong }}>
        <Label tone="muted">Øvelse</Label><h2 style={{ fontFamily: font.display, fontWeight: 400, fontSize: '1.45rem', lineHeight: 1.1, color: color.text, margin: '0.2rem 0' }}>{movement.exerciseName}</h2>
        <Meta style={{ marginBottom: '0.85rem' }}>{movement.prescription.sets} sæt × {movement.prescription.reps} · mål RPE {movement.prescription.targetRpe}</Meta>
        {Number.isFinite(movement.startingLoadKg) && <Meta style={{ color: color.accent, marginTop: '-0.55rem', marginBottom: '0.85rem' }}>Din startbelastning: {movement.startingLoadKg} kg</Meta>}
        {movementRows.map(({ row, index }) => { const presentation = customerSetPresentationState({ index, activeIndex, confirmed }); return <div key={`${row.exerciseId}-${row.setNumber}`} data-set-state={presentation} style={{ padding: '0.8rem 0', borderTop: `1px solid ${color.line}`, opacity: confirmed[index] ? 0.68 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}><Meta>Sæt {row.setNumber}</Meta>{confirmed[index] ? <Meta style={{ color: color.accent }}>Logget</Meta> : index === activeIndex ? <Meta style={{ color: color.accent }}>Klar nu</Meta> : null}</div>
          {confirmed[index] ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.35rem' }}><Meta>{row.actual.skipped ? 'Sprunget over' : `${row.actual.weightKg} kg × ${row.actual.repsCompleted} · RPE ${row.actual.rpeActual}`}</Meta><button onClick={() => { setConfirmed(current => ({ ...current, [index]: false })); setActiveIndex(index) }} style={{ background: 'none', border: 'none', padding: 0, color: color.muted, fontFamily: font.mono, fontSize: '0.58rem', cursor: 'pointer' }}>Ret</button></div> : index !== activeIndex ? <button onClick={() => setActiveIndex(index)} style={{ width: '100%', minHeight: '40px', marginTop: '0.5rem', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.muted, fontFamily: font.mono, fontSize: '0.58rem', letterSpacing: '0.08em', cursor: 'pointer' }}>Klargør sæt {row.setNumber}</button> : row.actual.skipped ? <div style={{ marginTop: '0.45rem' }}><Meta>Sprunget over{row.actual.note ? ` · ${row.actual.note}` : ''}</Meta><Button variant="soft" style={{ marginTop: '0.65rem' }} onClick={() => confirmSet(index)}>Bekræft spring over</Button><button onClick={() => toggleSkip(index)} style={{ display: 'block', margin: '0.55rem auto 0', background: 'none', border: 'none', padding: '0.3rem', color: color.muted, fontFamily: font.mono, fontSize: '0.58rem', cursor: 'pointer' }}>Fortryd</button></div> : <>
            <div style={{ marginTop: '0.7rem', padding: '0.8rem', background: color.bg, border: `1px solid ${color.line}` }}>
              <Meta style={{ marginBottom: '0.65rem' }}>Plan: {row.planned.weightKg} kg × {row.planned.reps} reps · mål RPE {row.planned.rpe}</Meta>
              <Stepper label="Vægt" value={row.actual.weightKg} unit="kg" step={2.5} max={500} onChange={value => update(index, 'weightKg', value)} />
              <Stepper label="Faktiske reps" value={row.actual.repsCompleted} unit="reps" step={1} min={1} max={30} onChange={value => update(index, 'repsCompleted', value)} />
              <ChipRow label="Faktisk RPE" options={[6, 7, 8, 9, 10]} value={row.actual.rpeActual} onChange={value => update(index, 'rpeActual', value)} />
              <input type="text" placeholder="Kort note (valgfri)" value={row.actual.note} onChange={event => update(index, 'note', event.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.text, fontFamily: font.sans, padding: '0.45rem 0.6rem' }} />
            </div>
            <div style={{ marginTop: '0.65rem' }}><Button onClick={() => confirmSet(index)}>Log sæt</Button><button onClick={() => toggleSkip(index)} style={{ display: 'block', margin: '0.65rem auto 0', background: 'none', border: 'none', padding: '0.3rem', color: color.dim, fontFamily: font.mono, fontSize: '0.58rem', cursor: 'pointer' }}>Spring over dette sæt</button></div>
          </>}
        </div> })}
      </Card>
    })}<Button disabled={!sessionReady} onClick={complete}>Afslut og gem pas</Button>
  </div>
}

function WeekTwo({ program, completed, setLogs, onStart }) {
  const proposal = useMemo(() => buildWeekTwoProposal(program, completed), [program, completed])
  const summary = useMemo(() => summarizeCustomerWeek(setLogs, 1), [setLogs])
  return <div style={s.page}><Label>Uge 2 · forslag</Label><h1 style={s.h1}>Planen svarer<br />på din uge 1.</h1><p style={{ ...s.body, marginBottom: '1rem' }}>Intet er ændret skjult. Forslaget bygger kun på komplette, sammenlignelige sæt og kræver dit aktive valg.</p><Card><Label tone="muted">Uge 1 registreret</Label><Meta>{summary.completedSets}/{summary.plannedSets} sæt · {summary.volumeKg} kg · gennemsnitlig RPE {summary.averageRpeActual ?? '—'}</Meta></Card><Card><Label tone="muted">Hvad næste uge bygger på</Label>{proposal.proposals.map(item => { const state = item.action === 'increase-load' ? { label: 'Foreslår stigning', color: color.accent } : item.evidenceStatus === 'insufficient-comparable-exposures' ? { label: 'Mere data kræves', color: color.muted } : { label: 'Behold planen', color: color.muted }; return <div key={item.exerciseId} style={{ padding: '0.8rem 0', borderBottom: `1px solid ${color.line}` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'baseline' }}><div style={{ color: color.text }}>{item.exerciseName}</div><Meta style={{ color: state.color }}>{state.label}</Meta></div><Meta style={{ marginTop: '0.3rem' }}>{item.action === 'increase-load' ? `${item.fromLoadKg} kg → ${item.toLoadKg} kg` : item.fromLoadKg === null ? 'Ingen belastningsændring foreslås endnu' : `Behold ${item.fromLoadKg} kg`}</Meta><Meta style={{ marginTop: '0.25rem', color: color.dim }}>{item.comparableExposureCount} sammenlignelige eksponering{item.comparableExposureCount === 1 ? '' : 'er'} · {item.reason}</Meta></div> })}</Card><Button onClick={() => onStart(proposal)}>Se uge 2 med dette forslag</Button><Button variant="ghost" onClick={() => onStart(null)} style={{ marginTop: '0.6rem' }}>Behold uge 1-planen</Button></div>
}

function WeekTwoReady({ program, choice, onStart }) {
  const firstSession = program.sessions[0]
  return <div style={s.page}>
    <Label>Uge 2 · klar</Label><h1 style={s.h1}>Dit næste pas<br />er klar.</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>{choice ? 'Du accepterede det synlige uge-2-forslag. Kun viste belastninger er ændret.' : 'Du beholdt uge-1-planen. Ingen belastninger er ændret.'}</p>
    <Card><Label tone="muted">Første pas i uge 2</Label>{firstSession.movements.map(movement => <div key={movement.exerciseId} style={{ padding: '0.6rem 0', borderBottom: `1px solid ${color.line}`, color: color.text }}>{movement.exerciseName}<Meta>{movement.prescription.sets} sæt × {movement.prescription.reps} · RPE {movement.prescription.targetRpe}{movement.weekTwoStartingLoadKg !== null ? ` · start ${movement.weekTwoStartingLoadKg} kg` : ''}</Meta></div>)}</Card>
    <Button onClick={onStart}>Start {firstSession.label}</Button>
    <Meta style={{ marginTop: '1rem' }}>Belastningerne kan stadig justeres af atleten, før hvert sæt logges.</Meta>
  </div>
}

function WeekTwoComplete() {
  return <div style={s.page}><Label>Uge 2 · registreret</Label><h1 style={s.h1}>Passet er<br />gemt lokalt.</h1><p style={s.body}>Demoen har nu gennemført onboarding, uge 1, et synligt uge-2-valg og det første pas i uge 2. Ingen data er sendt eller tildelt i denne lokale version.</p></div>
}

export default function CustomerJourneyDemo() {
  const [initial] = useState(() => loadLocalCustomerJourney())
  const [demoId, setDemoId] = useState(initial?.demoId || null)
  const [matchInput, setMatchInput] = useState(initial?.matchInput || null)
  const [baselineLoads, setBaselineLoads] = useState(initial?.baselineLoads || null)
  const [completed, setCompleted] = useState(initial?.completed || [])
  const [setLogs, setSetLogs] = useState(initial?.setLogs || [])
  const [weekTwoChoice, setWeekTwoChoice] = useState(initial?.weekTwoChoice || null)
  const [sessionDraft, setSessionDraft] = useState(initial?.sessionDraft || null)
  const [weekTwoCompleted, setWeekTwoCompleted] = useState(initial?.weekTwoCompleted || null)
  const [stage, setStage] = useState(initial?.stage || 'email')
  const reviewPackage = matchInput ? createProgramReviewPackage(matchInput) : null
  const program = reviewPackage?.outcome === 'review-ready' && baselineLoads ? createCustomerProgram(reviewPackage, baselineLoads) : null
  const weekTwoProposal = program ? buildWeekTwoProposal(program, completed) : null
  const weekTwoProgram = program ? createWeekTwoView(program, weekTwoChoice === 'accepted' ? weekTwoProposal : null) : null

  useEffect(() => {
    if (!demoId || stage === 'email') return
    saveLocalCustomerJourney({ schemaVersion: 1, demoId, stage, matchInput, baselineLoads, completed, setLogs, weekTwoChoice, sessionDraft, weekTwoCompleted })
  }, [baselineLoads, completed, demoId, matchInput, sessionDraft, setLogs, stage, weekTwoChoice, weekTwoCompleted])

  const startOrResumeDemo = email => {
    const nextDemoId = localDemoIdFromEmail(email)
    if (!nextDemoId) return
    const saved = loadLocalCustomerJourneyForDemo(nextDemoId)
    setDemoId(nextDemoId)
    if (!saved) { setMatchInput(null); setBaselineLoads(null); setCompleted([]); setSetLogs([]); setWeekTwoChoice(null); setSessionDraft(null); setWeekTwoCompleted(null); setStage('match'); return }
    setMatchInput(saved.matchInput); setBaselineLoads(saved.baselineLoads); setCompleted(saved.completed); setSetLogs(saved.setLogs); setWeekTwoChoice(saved.weekTwoChoice); setSessionDraft(saved.sessionDraft); setWeekTwoCompleted(saved.weekTwoCompleted || null); setStage(saved.stage)
  }
  // A return to the local start is a deliberate fresh-test action. Without
  // clearing this browser-only snapshot, reusing the same test e-mail could
  // reopen an old week-two state and make the first session look wrong.
  const backToLocalStart = () => { if (demoId) clearLocalCustomerJourney(demoId); setDemoId(null); setMatchInput(null); setBaselineLoads(null); setCompleted([]); setSetLogs([]); setWeekTwoChoice(null); setSessionDraft(null); setWeekTwoCompleted(null); setStage('email') }

  if (stage === 'email') return <EmailStart onContinue={startOrResumeDemo} />
  if (stage === 'match') return <ProgramMatchPreview userId={demoId} initialInput={matchInput} onBack={backToLocalStart} onDraftChange={value => setMatchInput(value)} onContinue={packageValue => { setMatchInput(packageValue.decisionTrail.matchInput); setStage('baseline') }} continueLabel="Angiv startbelastninger" />
  if (stage === 'baseline') return <BaselineLoadsInput reviewPackage={reviewPackage} onBack={() => setStage('match')} onContinue={value => { setBaselineLoads(value); setStage('week-one') }} />
  if (stage === 'week-one') { const next = program.sessions[completed.length]; if (next) return <SessionCheckIn key={`week-1-${next.id}`} session={next} sessionNumber={completed.length + 1} sessionCount={program.sessions.length} initialDraft={sessionDraft} onDraftChange={setSessionDraft} onComplete={entry => { setCompleted(current => [...current, entry]); setSetLogs(current => [...current, ...entry.setLogs]) }} />; return <WeekTwo program={program} completed={completed} setLogs={setLogs} onStart={choice => { setWeekTwoChoice(choice ? 'accepted' : 'kept'); setStage('week-two') }} /> }
  if (stage === 'week-two') return <WeekTwoReady program={weekTwoProgram} choice={weekTwoChoice === 'accepted'} onStart={() => setStage('week-two-session')} />
  if (stage === 'week-two-session') return <SessionCheckIn key={`week-2-${weekTwoProgram.sessions[0].id}`} session={weekTwoProgram.sessions[0]} sessionNumber={1} sessionCount={weekTwoProgram.sessions.length} weekNumber={2} initialDraft={sessionDraft} onDraftChange={setSessionDraft} onComplete={entry => { setWeekTwoCompleted(entry); setStage('week-two-complete') }} />
  if (stage === 'week-two-complete') return <WeekTwoComplete />
  return <div style={s.page}><Label>Uge 2 · klar</Label><h1 style={s.h1}>Dit næste pas<br />er klar.</h1><p style={{ ...s.body, marginBottom: '1rem' }}>{weekTwoChoice ? 'Du accepterede det synlige uge-2-forslag. Kun viste belastninger er ændret.' : 'Du beholdt uge-1-planen. Ingen belastninger er ændret.'}</p><Card><Label tone="muted">Første pas i uge 2</Label>{weekTwoProgram.sessions[0].movements.map(movement => <div key={movement.exerciseId} style={{ padding: '0.6rem 0', borderBottom: `1px solid ${color.line}`, color: color.text }}>{movement.exerciseName}<Meta>{movement.prescription.sets} sæt × {movement.prescription.reps} · RPE {movement.prescription.targetRpe}{movement.weekTwoStartingLoadKg !== null ? ` · start ${movement.weekTwoStartingLoadKg} kg` : ''}</Meta></div>)}</Card><Meta>Demoen viser nu hele kunderejsen lokalt. Ægte e-mail-login, medlemskab og tildeling kobles på shadow-miljøet i næste lag.</Meta></div>
}

// "Dagens pas"-kortet paa forsiden (egen tilstand: naeste-saet-visning,
// ret-saet, autofyld) — flyttet uaendret ud af AthleteView.jsx (ordre 373).
// Skrivefunktionerne kommer stadig ind som props fra AthleteView.
import { useState, useEffect, useRef } from 'react'
import { lastHeaviestSet } from '../nextSet'
import { loadShowNextSetPreview, saveShowNextSetPreview } from '../nextSetPreview'
import { parseRepsPrescription } from '../repsPrescription'
import { defaultSetWeight, defaultSetReps, stepWeight, stepReps, stepRepsInInputs, autoFillSetInput } from '../setLogDefaults'
import { s } from '../athleteShared'
import { parsePlannedRpe } from './ugeHjaelp'

// ORDRE 263 · commit 1 — "Dagens pas": øverst på forsiden, præcis det næste
// sæt (øvelse, vægt, reps, RPE), stort nok til at læses på armslængde, med
// log/spring over lige ved hånden (samme skrivefunktioner som Program-fanen
// — logInputs-nøglen er `${exerciseId}_${setNumber}`, delt på tværs af
// begge faner). Under det: resten af DENNE session i kort form. `pas` kommer
// fra findDagensPas (src/nextSet.js, ren funktion, se dens tests).
function DagensPasCard({ pas, exerciseHistory, exerciseLogs, logInputs, setLogInputs, onLogSet, skipSet, suggestNextWeight, onOpenSession, todayStr, checkinNudge, lastLoggedSet, onUndoLastSet, onUpdateLoggedSet, pendingSyncCount }) {
  const activeNext = pas && pas.status === 'open' ? pas.next : null

  // ORDRE 314 · blok 1 — Marcs dom: man kunne se det næste sæt, men ikke
  // hvilket sæt man var på. Løsning: kun det AKTUELLE sæt har fulde felter,
  // allerede klarede sæt (samme øvelse) er kompakte linjer, og "næste sæt" er
  // højst én dæmpet linje uden felter — og kan slås fra (se nextSetPreview.js).
  const [showNextPreview, setShowNextPreview] = useState(() => loadShowNextSetPreview())

  // ORDRE 320 · blok 1 — "ret" på et klaret sæt åbner det til redigering IN
  // PLACE (ingen sletning af log-rækken, se onUpdateLoggedSet). editingSet
  // holder BÅDE øvelse- og sætnummer (ikke kun sætnummer), så en gemt
  // redigerings-tilstand aldrig ved et uheld matcher et andet sætnummer på
  // en anden øvelse, hvis kortet skifter øvelse mens redigeringen står åben.
  const [editingSet, setEditingSet] = useState(null) // { exerciseId, setNumber } | null
  const [editInput, setEditInput] = useState({ weight: '', reps: '' })
  // ORDRE 339 · blok 1 (F3) — klarede sæt er kollapset til én linje som standard.
  const [showPriorSets, setShowPriorSets] = useState(false)
  const startEditingSet = (exerciseId, setNumber, log) => {
    setEditingSet({ exerciseId, setNumber })
    setEditInput({ weight: log.skipped ? '' : String(log.weight ?? ''), reps: log.skipped ? '' : String(log.reps_completed ?? '') })
  }

  // ORDRE 280 · commit 1 — når sættet ÅBNES (bliver "næste"), udfyldes vægt/
  // reps som en ægte værdi i input-state (ikke kun en visuel hint — ellers
  // ville et upåvirket "Godkendt"-tryk logge 0/tomt). Sidste gang på samme
  // øvelse vinder, ellers planens tal, ellers tomt (se setLogDefaults.js).
  // ORDRE 293 · F3: kører også igen når exerciseHistory er hentet (første
  // øvelse åbnes før historikken ankommer og fik ellers planens tal for
  // altid). autoFillSetInput rører aldrig et felt atleten selv har tastet/
  // trinnet (touchedRef) — kun et felt der stadig står som vores egen
  // forudfyldning byttes ud (autoFilledRef). Ikke logInputs i deps: ville
  // køre igen ved hver tastning.
  const autoFilledRef = useRef({})
  const touchedRef = useRef(new Set())
  useEffect(() => {
    if (!activeNext) return
    const { exercise: ex, setNumber } = activeNext
    const key = `${ex.id}_${setNumber}`
    const last = lastHeaviestSet(exerciseHistory, ex.name, todayStr)
    const repsPrescription = parseRepsPrescription(ex.reps)
    const repsIsEditable = repsPrescription.type !== 'fixed'
    const suggestion = ex.recommended_weight == null ? suggestNextWeight(ex.name, ex.intensity) : null
    const weightDefault = defaultSetWeight('', { lastWeight: last?.weight, recommendedWeight: ex.recommended_weight ?? suggestion?.weight })
    const repsDefaultValue = repsIsEditable
      ? defaultSetReps('', { lastReps: last?.reps, planReps: repsPrescription.type === 'range' ? repsPrescription.min : null })
      : ''
    const lastAuto = autoFilledRef.current[key]
    const touched = touchedRef.current.has(key)
    const decide = current => autoFillSetInput({ current, lastAuto, touched, weightDefault, repsDefault: repsDefaultValue })
    if (!decide(logInputs[key])) return
    autoFilledRef.current[key] = { weight: weightDefault, reps: repsDefaultValue }
    setLogInputs(p => { const next = decide(p[key]); return next ? { ...p, [key]: next } : p })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kør kun når sættet (øvelse+sætnummer) skifter eller historikken ankommer
  }, [activeNext?.exercise?.id, activeNext?.setNumber, exerciseHistory])

  if (!pas) return null

  // ORDRE 267 · commit 3 — rolig linje, ikke en mail/notifikation, ingen rød
  // farve: vises kun de sidste to dage af ugen, hvis ingen check-in er
  // logget den uge endnu (se shouldNudgeCheckin, src/checkinReminder.js).
  const nudge = checkinNudge && (
    <button
      type="button"
      onClick={checkinNudge.onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,234,226,0.08)', padding: '0 0 0.6rem', marginBottom: '0.85rem', cursor: 'pointer' }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#a9a69e' }}>
        Ugens check-in mangler stadig.
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.06em', color: '#c8923a', flexShrink: 0 }}>
        Log den →
      </span>
    </button>
  )

  if (pas.status !== 'open') {
    const up = pas.upcoming
    return (
      <div style={s.card}>
        {nudge}
        <div style={s.cardLabel}>Dagens pas</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '0.5rem' }}>
          {pas.status === 'done' ? 'Passet er færdigt. ✓' : 'Intet pas i dag.'}
        </div>
        {up ? (
          <button
            type="button"
            onClick={() => onOpenSession(up.session.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.13)', padding: '0.75rem', cursor: 'pointer' }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.3rem' }}>
              Næste: uge {up.week.week_number}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#edeae2' }}>{up.session.title}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginTop: '0.2rem' }}>
              {(up.session.exercises || []).map(e => e.name).join(' · ')}
            </div>
          </button>
        ) : (
          <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Der er ikke planlagt mere endnu.</div>
        )}
      </div>
    )
  }

  const { session, next } = pas
  if (!next) return null // alle sæt i "åbne" session logget i samme render — næste render finder den rigtige session
  const { exercise: ex, setNumber, totalSets } = next
  const key = `${ex.id}_${setNumber}`
  const input = logInputs[key] || { weight: '', note: '', rpe: '', reps: '' }
  const plannedRpe = parsePlannedRpe(ex.intensity)
  const repsPrescription = parseRepsPrescription(ex.reps)
  const repsIsEditable = repsPrescription.type !== 'fixed'
  const repsDefault = repsPrescription.type === 'range' ? String(repsPrescription.min) : ''
  const repsValue = input.reps || repsDefault
  const repsToLog = repsIsEditable ? repsValue : ex.reps
  const last = lastHeaviestSet(exerciseHistory, ex.name, todayStr)
  const suggestion = ex.recommended_weight == null ? suggestNextWeight(ex.name, ex.intensity) : null
  const sessionExercises = session.exercises || []
  const exIdx = sessionExercises.findIndex(e => e.id === ex.id)
  const nextExercise = exIdx >= 0 ? sessionExercises[exIdx + 1] || null : null
  const laterCount = exIdx >= 0 ? Math.max(0, sessionExercises.length - exIdx - 2) : 0
  const stepWeightBy = delta => { touchedRef.current.add(key); setLogInputs(p => ({ ...p, [key]: { ...(p[key] || input), weight: stepWeight(p[key]?.weight ?? input.weight, delta) } })) }
  const stepRepsBy = delta => { touchedRef.current.add(key); setLogInputs(p => stepRepsInInputs(p, key, input, repsValue, delta)) }

  // ORDRE 314 · blok 1 — sæt 1..setNumber-1 på DENNE øvelse er altid logget
  // (nextSetInSession finder det første ULOGGEDE sæt i rækkefølge, så der kan
  // ikke være huller foran "next"). Vises som kompakte linjer, ikke fulde felter.
  const priorSetNumbers = Array.from({ length: setNumber - 1 }, (_, i) => i + 1)
  const nextSetNumber = setNumber + 1
  // ORDRE 339 · blok 1 (F3) — klarede sæt foldet ud (tryk, eller et sæt står
  // åbent til redigering); ellers én linje, der også bærer "fortryd".
  const priorSetsOpen = showPriorSets || editingSet != null
  const undoInline = priorSetNumbers.length > 0 && !priorSetsOpen && lastLoggedSet && lastLoggedSet.exerciseId === ex.id
  const nextSetReps = repsIsEditable ? (last?.reps ?? (repsPrescription.type === 'range' ? repsPrescription.min : null)) : ex.reps
  const nextSetWeight = ex.recommended_weight ?? suggestion?.weight ?? last?.weight ?? null

  return (
    <div style={s.card}>
      {nudge}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={s.cardLabel}>Dagens pas</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#7a7770' }}>Sæt {setNumber}/{totalSets}</div>
      </div>

      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '0.25rem' }}>
        {ex.name}
      </div>
      {last && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
          Sidste gang: {last.weight}kg × {last.reps}{last.rpe ? ` @${last.rpe}` : ''}
        </div>
      )}
      {ex.recommended_weight != null ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', marginBottom: '0.5rem' }}>Anbefalet: {ex.recommended_weight}kg</div>
      ) : suggestion ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', marginBottom: '0.5rem' }}>
          Forslag: {suggestion.weight}kg <span style={{ color: '#7a7770' }}>(RPE {suggestion.fromRpe})</span>
        </div>
      ) : null}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.85rem' }}>
        {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
      </div>

      {/* ORDRE 314 · blok 1, rettet i ORDRE 320 · blok 1 — klarede sæt på DENNE
          øvelse: én kompakt linje pr. sæt (ikke fulde felter, det er
          forbeholdt det aktuelle sæt), med et "ret"-tryk der åbner sættet til
          redigering UDEN at slette log-rækken (se onUpdateLoggedSet/
          docs/KRITIK-314.md fund 1+3 — den gamle onUndoLastSet-genbrug slettede
          rækken, hvilket gjorde senere sæt "usynlige" for nextSetInSession). */}
      {/* ORDRE 339 · blok 1 (F3 fra KRITIK-330-326) — med tre loggede sæt
          skubbede "ret"-rækkerne (~50 px hver) chipsene og "Mere" under
          folden midt i et pas. Rækkerne er derfor kollapset til ÉN linje som
          standard ("n sæt klaret" + seneste sæt); et tryk folder dem ud. Står
          et sæt åbent til redigering, er listen altid foldet ud. */}
      {priorSetNumbers.length > 0 && !priorSetsOpen && (() => {
        const lastPrior = (exerciseLogs || []).find(l => l.exercise_id === ex.id && l.set_number === priorSetNumbers.length)
        return (
          <div data-klarede-saet="kollapset" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', color: '#7a7770' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              ✓ {priorSetNumbers.length} sæt klaret{lastPrior && !lastPrior.skipped ? ` · senest ${lastPrior.weight}kg × ${lastPrior.reps_completed}` : ''}
            </span>
            {/* "Fortryd sidste sæt" står i den kollapsede linje i stedet for
                som egen fuld-bredde-række (sparer ~50 px, F3); samme handling. */}
            {undoInline && (
              <button
                type="button"
                aria-label="↺ Fortryd sidste sæt"
                onClick={() => onUndoLastSet(lastLoggedSet.exerciseId, lastLoggedSet.setNumber)}
                style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', padding: '0 0.25rem', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0 }}
              >↺ fortryd</button>
            )}
            <button
              type="button"
              aria-expanded="false"
              aria-label={`Vis ${priorSetNumbers.length} klarede sæt`}
              onClick={() => setShowPriorSets(true)}
              style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontSize: '0.58rem', letterSpacing: '0.04em', padding: 0, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0 }}
            >vis / ret ▾</button>
          </div>
        )
      })()}
      {priorSetNumbers.length > 0 && priorSetsOpen && (
        <div data-klarede-saet="foldet-ud" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
          {priorSetNumbers.map(n => {
            const log = (exerciseLogs || []).find(l => l.exercise_id === ex.id && l.set_number === n)
            if (!log) return null
            const isEditingThis = editingSet && editingSet.exerciseId === ex.id && editingSet.setNumber === n
            if (isEditingThis) {
              return (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', marginBottom: '0.2rem', border: '1px solid rgba(200,146,58,0.25)', background: 'rgba(200,146,58,0.04)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#c8923a' }}>Retter sæt {n}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button" aria-label="2,5 kg mindre (ret)"
                      onClick={() => setEditInput(p => ({ ...p, weight: stepWeight(p.weight, -2.5) }))}
                      style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                    >−</button>
                    <input
                      aria-label={`Vægt, ret sæt ${n}`}
                      style={{ ...s.fieldInput, width: '80px', minWidth: '80px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0, textAlign: 'center' }}
                      type="text" inputMode="decimal" value={editInput.weight}
                      onChange={e => {
                        const v = e.target.value.replace(',', '.')
                        if (v === '' || /^\d*\.?\d*$/.test(v)) setEditInput(p => ({ ...p, weight: v }))
                      }}
                    />
                    <button
                      type="button" aria-label="2,5 kg mere (ret)"
                      onClick={() => setEditInput(p => ({ ...p, weight: stepWeight(p.weight, 2.5) }))}
                      style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                    >+</button>
                    {repsIsEditable && (
                      <>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9rem', color: '#c8923a' }}>×</span>
                        <button
                          type="button" aria-label="1 rep mindre (ret)"
                          onClick={() => setEditInput(p => ({ ...p, reps: stepReps(p.reps, -1) }))}
                          style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                        >−</button>
                        <input
                          aria-label={`Reps, ret sæt ${n}`}
                          style={{ ...s.fieldInput, width: '56px', minWidth: '56px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0, textAlign: 'center' }}
                          type="text" inputMode="numeric" value={editInput.reps}
                          onChange={e => {
                            const v = e.target.value
                            if (v === '' || /^\d*$/.test(v)) setEditInput(p => ({ ...p, reps: v }))
                          }}
                        />
                        <button
                          type="button" aria-label="1 rep mere (ret)"
                          onClick={() => setEditInput(p => ({ ...p, reps: stepReps(p.reps, 1) }))}
                          style={{ ...s.btnGhost, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '1rem', flexShrink: 0 }}
                        >+</button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      aria-label={`Godkendt, ret sæt ${n}`}
                      style={{ ...s.btnPrimary, flex: 1, minHeight: '44px', boxSizing: 'border-box' }}
                      onClick={async () => {
                        const ok = await onUpdateLoggedSet(ex.id, n, editInput)
                        if (ok) setEditingSet(null)
                      }}
                    >Godkendt</button>
                    <button
                      type="button"
                      aria-label={`Fortryd, ret sæt ${n}`}
                      style={{ ...s.btnGhost, minHeight: '44px', boxSizing: 'border-box' }}
                      onClick={() => setEditingSet(null)}
                    >Fortryd</button>
                  </div>
                </div>
              )
            }
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', color: '#7a7770' }}>
                <span>
                  Sæt {n}: {log.skipped ? 'Sprunget over' : `${log.weight}kg × ${log.reps_completed}${log.rpe_actual != null ? `, RPE ${log.rpe_actual}` : ''}`}
                </span>
                <button
                  type="button"
                  aria-label={`Ret sæt ${n}`}
                  disabled={editingSet != null}
                  onClick={() => startEditingSet(ex.id, n, log)}
                  style={{ background: 'none', border: 'none', color: '#4a4844', cursor: editingSet != null ? 'default' : 'pointer', opacity: editingSet != null ? 0.35 : 1, fontSize: '0.58rem', letterSpacing: '0.04em', padding: 0, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', flexShrink: 0 }}
                >ret</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ORDRE 314 · blok 1 (F4-rettelse) — vægt og reps/RPE står nu i to
          rækker i stedet for én flexWrap-række, der brækkede midt i
          reps-kontrollerne ved 360–390 px (se docs/KRITIK-288.md F4): fire
          44 px-trykflader + to felter kan ikke være på samme linje som RPE-
          mærkatet i en ~310 px kortflade uden at gå under 44 px, så hver
          feltgruppe holdes samlet på sin egen linje i stedet. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* ORDRE 280 · commit 1 — store plus/minus (2,5 kg / 1 rep) ved siden af
            felterne: en atlet med kridt på hænderne skal kunne justere uden at
            skulle ramme et lille tastatur. Feltet kan stadig tastes i (samme
            onChange som før), men skal ikke. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button" aria-label="2,5 kg mindre"
            onClick={() => stepWeightBy(-2.5)}
            style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
          >−</button>
          <input
            aria-label={`Vægt, sæt ${setNumber}`}
            style={{ ...s.fieldInput, width: '96px', minWidth: '96px', minHeight: '52px', boxSizing: 'border-box', flexShrink: 0, padding: '0.65rem 0.5rem', fontSize: '1.3rem', textAlign: 'center' }}
            type="text" inputMode="decimal" placeholder="kg" value={input.weight}
            onChange={e => {
              const v = e.target.value.replace(',', '.')
              if (v === '' || /^\d*\.?\d*$/.test(v)) { touchedRef.current.add(key); setLogInputs(p => ({ ...p, [key]: { ...p[key], weight: v } })) }
            }}
          />
          <button
            type="button" aria-label="2,5 kg mere"
            onClick={() => stepWeightBy(2.5)}
            style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
          >+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {repsIsEditable ? (
            <>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', color: '#c8923a' }}>×</span>
              <button
                type="button" aria-label="1 rep mindre"
                onClick={() => stepRepsBy(-1)}
                style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
              >−</button>
              <input
                aria-label={`Reps, sæt ${setNumber}`}
                style={{ ...s.fieldInput, width: '64px', minWidth: '64px', minHeight: '52px', boxSizing: 'border-box', flexShrink: 0, padding: '0.65rem 0.3rem', fontSize: '1.3rem', textAlign: 'center' }}
                type="text" inputMode="numeric" placeholder="reps" value={repsValue}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || /^\d*$/.test(v)) { touchedRef.current.add(key); setLogInputs(p => ({ ...p, [key]: { ...p[key], reps: v } })) }
                }}
              />
              <button
                type="button" aria-label="1 rep mere"
                onClick={() => stepRepsBy(1)}
                style={{ ...s.btnGhost, minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: 0, fontSize: '1.1rem', flexShrink: 0 }}
              >+</button>
            </>
          ) : (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', color: '#c8923a', whiteSpace: 'nowrap' }}>× {ex.reps || '—'}</span>
          )}
          {plannedRpe != null && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770', letterSpacing: '0.06em', border: '1px solid rgba(237,234,226,0.13)', padding: '0.3rem 0.5rem', minHeight: '52px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>RPE {input.rpe || plannedRpe}</span>
          )}
        </div>
      </div>
      {/* ORDRE 280 · commit 2 — "Godkendt" er den mest gentagne handling i hele
          appen (ét tryk pr. sæt, hele træningen), derfor flex:1 og 60px høj —
          rammes med en tommelfinger nederst i kortet, også med handsker.
          Ingen dialog, ingen bekræftelse: gemmer sættet som det står med det
          samme (samme optimistiske onLogSet som før, se logDagensPasSet). */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
        <button
          style={{ ...s.btnPrimary, flex: 1, minHeight: '60px', boxSizing: 'border-box', fontSize: '0.85rem' }}
          onClick={() => onLogSet(ex, setNumber, totalSets, repsToLog, plannedRpe)}
        >Godkendt</button>
        <button
          style={{ ...s.btnGhost, minHeight: '60px', boxSizing: 'border-box', fontSize: '0.6rem' }}
          onClick={() => skipSet(ex.id, setNumber, plannedRpe)}
        >Spring over</button>
      </div>
      {/* Fortryd — kun mens man ikke har forladt øvelsen: næste sæt i kortet
          skal stadig høre til den øvelse man lige loggede et sæt på. */}
      {lastLoggedSet && lastLoggedSet.exerciseId === ex.id && !undoInline && (
        <button
          type="button"
          onClick={() => onUndoLastSet(lastLoggedSet.exerciseId, lastLoggedSet.setNumber)}
          style={{ ...s.btnGhost, marginTop: '0.5rem', width: '100%', minHeight: '44px', boxSizing: 'border-box', fontSize: '0.56rem', color: '#7a7770' }}
        >↺ Fortryd sidste sæt</button>
      )}
      {pendingSyncCount > 0 && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#7a7770', marginTop: '0.5rem', textAlign: 'center' }}>
          ☁ {pendingSyncCount} {pendingSyncCount === 1 ? 'sæt' : 'sæt'} gemt lokalt — sendes når forbindelsen er tilbage
        </div>
      )}

      {/* ORDRE 314 · blok 1 — "næste sæt" er højst ÉN dæmpet linje, aldrig med
          felter (dem har kun det aktuelle sæt), og kan slås fra her (se
          nextSetPreview.js). Vises kun når der faktisk ER et næste sæt på
          DENNE øvelse. */}
      {nextSetNumber <= totalSets && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.6rem' }}>
          {showNextPreview ? (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', letterSpacing: '0.02em' }}>
              Næste: {nextSetReps || '—'} reps{nextSetWeight != null ? ` @ ${nextSetWeight} kg` : ''}
            </div>
          ) : <span />}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', flexShrink: 0, minHeight: '44px', boxSizing: 'border-box' }}>
            <input
              type="checkbox" checked={showNextPreview}
              onChange={e => { setShowNextPreview(e.target.checked); saveShowNextSetPreview(e.target.checked) }}
              style={{ accentColor: '#c8923a', width: '13px', height: '13px' }}
            />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>Vis næste sæt</span>
          </label>
        </div>
      )}

      {/* ORDRE 330 · blok 2 — forsiden skal være rolig: "Resten af passet"
          (en liste over alle øvrige øvelser) er skåret ned til ÉN linje om
          den næste øvelse efter denne. Hele passet ligger i Program-fanen. */}
      {nextExercise && (
        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(237,234,226,0.07)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#7a7770', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Næste øvelse: <span style={{ color: '#b8b4a8' }}>{nextExercise.name}</span>
          {[nextExercise.sets && ` · ${nextExercise.sets} sæt`, nextExercise.reps && ` × ${nextExercise.reps}`].filter(Boolean).join('')}
          {laterCount > 0 ? ` (+${laterCount})` : ''}
        </div>
      )}
    </div>
  )
}

export default DagensPasCard

import { exerciseSetView, exerciseViewGroups, exerciseViewRows } from '../exerciseSetView'
// "Dagens pas"-kortet paa forsiden (egen tilstand: naeste-saet-visning,
// ret-saet, autofyld) — flyttet uaendret ud af AthleteView.jsx (ordre 373).
// Skrivefunktionerne kommer stadig ind som props fra AthleteView.
import { useState, useEffect, useRef } from 'react'
import { lastHeaviestSet } from '../nextSet'
import { loadShowNextSetPreview, saveShowNextSetPreview } from '../nextSetPreview'
import { parseRepsPrescription } from '../repsPrescription'
import { fixedRepsEntry } from '../fixedRepsEntry'
import { defaultSetWeight, defaultSetReps, stepWeight, stepReps, stepRepsInInputs, autoFillSetInput } from '../setLogDefaults'
import { s } from '../athleteShared'
import { parsePlannedRpe } from './ugeHjaelp'
import { canAcceptSetTap } from './setTapGuard'
import { restSecondsForExercise } from '../restBetweenSets'
import { visTid, harSetPauseForklaring, markerPauseForklaring } from './pauseLinje'

// ORDRE 456 (A1 i docs/kritik-446): ugens seneste gennemførte sæt med vægt på
// samme øvelse (også et sæt, der venter i køen), det kortet viser som
// "senest". Bruges, når historikken fra serveren ikke er hentet (uden net).
function ugensSenesteSaet(exerciseLogs, exerciseId) {
  let bedst = null
  for (const l of exerciseLogs || []) {
    if (l.exercise_id !== exerciseId || l.skipped || !(Number(l.weight) > 0)) continue
    if (!bedst || l.set_number > bedst.set_number) bedst = l
  }
  return bedst ? { weight: Number(bedst.weight), reps: bedst.reps_completed } : null
}

// ORDRE 419 (I2): samme RPE-skala som Program-fanens vælger (ProgramTab.jsx).
const RPE_VALUES = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

// ORDRE 263 · commit 1 — "Dagens pas": øverst på forsiden, præcis det næste
// sæt (øvelse, vægt, reps, RPE), stort nok til at læses på armslængde, med
// log/spring over lige ved hånden (samme skrivefunktioner som Program-fanen
// — logInputs-nøglen er `${exerciseId}_${setNumber}`, delt på tværs af
// begge faner). Under det: resten af DENNE session i kort form. `pas` kommer
// fra findDagensPas (src/nextSet.js, ren funktion, se dens tests).
function DagensPasCard({ onStartPause, pauseAktiv, pas, exerciseHistory, exerciseLogs, logInputs, setLogInputs, onLogSet, skipSet, suggestNextWeight, onOpenSession, todayStr, checkinNudge, lastLoggedSet, onUndoLastSet, onUpdateLoggedSet, pendingSyncCount, pendingSyncKeys = [], parkedSets = [], finishedSession = null, onRateSession, rekordFejring = null, onVarmOp = null }) {
  const activeNext = pas && pas.status === 'open' ? pas.next : null
  const lastSetTapRef = useRef(-Infinity)
  // ORDRE 1459: forklaringen vises kun, til pausen har kørt én gang.
  const [pauseForklaret, setPauseForklaret] = useState(() => harSetPauseForklaring())
  useEffect(() => { if (pauseAktiv) { markerPauseForklaring(); setPauseForklaret(true) } }, [pauseAktiv])
  function acceptSetTap() {
    const now = performance.now()
    if (!canAcceptSetTap(lastSetTapRef.current, now)) return false
    lastSetTapRef.current = now
    return true
  }

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
  // ORDRE 422: holder øvelsens id i stedet for true/false, så listen foldes
  // sammen af sig selv, når kortet går videre til en ny øvelse eller et nyt pas.
  const [showPriorSetsFor, setShowPriorSetsFor] = useState(null)
  // ORDRE 419 (I2): RPE-vælgeren og notefeltet på kortet. Nøglen er sættets
  // logInputs-nøgle, så de lukker af sig selv, når kortet går videre.
  const [rpeOpenFor, setRpeOpenFor] = useState(null)
  const [noteOpenFor, setNoteOpenFor] = useState(null)
  // ORDRE 419 (I3): pas atleten har vurderet eller sprunget over her på kortet.
  const [ratedHere, setRatedHere] = useState(() => new Set())
  const [ratingBusy, setRatingBusy] = useState(false)
  // ORDRE 456 (A1): Godkendt med tomt vægtfelt på en vægtøvelse spørger først
  // (nøglen på det sæt, der er spurgt om); næste tryk gemmer 0 kg.
  const [nulKgSpurgt, setNulKgSpurgt] = useState(null)
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
  const ugensVaegt = activeNext ? ugensSenesteSaet(exerciseLogs, activeNext.exercise.id)?.weight ?? null : null
  useEffect(() => {
    if (!activeNext) return
    const { exercise: ex, setNumber } = activeNext
    const key = `${ex.id}_${setNumber}`
    // ORDRE 456 (A1): uden historik (ikke hentet uden net) vægten fra ugens seneste sæt.
    const last = lastHeaviestSet(exerciseHistory, ex.name, todayStr) || ugensSenesteSaet(exerciseLogs, ex.id)
    const repsPrescription = parseRepsPrescription(ex.reps)
    const repsIsEditable = repsPrescription.type !== 'fixed' || fixedRepsEntry(ex.reps) !== null
    const suggestion = ex.recommended_weight == null ? suggestNextWeight(ex.name, ex.intensity) : null
    // ORDRE 419 (I1): coachens anbefalede vægt først, så sidste gang, så appens forslag.
    const weightDefault = defaultSetWeight('', { coachWeight: ex.recommended_weight, lastWeight: last?.weight, recommendedWeight: suggestion?.weight })
    const repsDefaultValue = repsIsEditable
      ? (fixedRepsEntry(ex.reps) ?? defaultSetReps('', { lastReps: last?.reps, planReps: repsPrescription.type === 'range' ? repsPrescription.min : null }))
      : ''
    const lastAuto = autoFilledRef.current[key]
    const touched = touchedRef.current.has(key)
    const decide = current => autoFillSetInput({ current, lastAuto, touched, weightDefault, repsDefault: repsDefaultValue })
    if (!decide(logInputs[key])) return
    autoFilledRef.current[key] = { weight: weightDefault, reps: repsDefaultValue }
    setLogInputs(p => { const next = decide(p[key]); return next ? { ...p, [key]: next } : p })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kør kun når sættet (øvelse+sætnummer) skifter, historikken ankommer eller ugens seneste vægt på øvelsen bliver kendt (A1)
  }, [activeNext?.exercise?.id, activeNext?.setNumber, exerciseHistory, ugensVaegt])

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

  // ORDRE 419 (I3): passet slutter ikke længere uden at spørge. Når sidste sæt
  // i et pas er logget herfra (finishedSession, se HjemTab), står én linje
  // øverst: 1-5 eller "spring over". Et tryk gemmer athlete_rating samme vej som
  // Program-fanens "Træningsfeedback" (saveFeedback); kommentaren bliver dér.
  const rateSession = finishedSession && !ratedHere.has(finishedSession.id) ? finishedSession : null
  const rateLine = rateSession && onRateSession && (
    <div data-vurder-pas={rateSession.id} style={{ borderBottom: '1px solid rgba(237,234,226,0.08)', padding: '0 0 0.6rem', marginBottom: '0.85rem' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: '#b8b4a8', marginBottom: '0.4rem' }}>
        {rateSession.title || 'Passet'} er klaret. Hvordan gik det?
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            aria-label={`Passet gik: ${n} af 5`}
            disabled={ratingBusy}
            onClick={async () => {
              setRatingBusy(true)
              const ok = await onRateSession(rateSession.id, n)
              setRatingBusy(false)
              if (ok !== false) setRatedHere(p => new Set([...p, rateSession.id]))
            }}
            style={{ ...s.btnGhost, width: '44px', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '0.95rem', flexShrink: 0, opacity: ratingBusy ? 0.5 : 1 }}
          >{n}</button>
        ))}
        <button
          type="button"
          onClick={() => setRatedHere(p => new Set([...p, rateSession.id]))}
          style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em', marginLeft: 'auto', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', padding: '0 0.25rem' }}
        >spring over</button>
      </div>
    </div>
  )

  // ORDRE 439 · blok 1: en kort, rolig fejring på sættet, der lige blev
  // logget (sat og ryddet i saetSkrivning.js: 5 s, eller fortryd).
  const rekordLinje = rekordFejring && (
    <div data-rekord-fejring={rekordFejring.key} role="status" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.03em', lineHeight: 1.45, color: '#c8923a', background: 'rgba(200,146,58,0.07)', borderLeft: '2px solid #c8923a', padding: '0.5rem 0.65rem', marginBottom: '0.75rem' }}>
      <span aria-hidden="true">🏆 </span>{rekordFejring.tekst}
    </div>
  )

  // ORDRE 397: ventende og parkerede sæt vises både mens passet er åbent og
  // når det er færdigt (det sidste sæt kan sagtens være logget uden net).
  const ventendeSaet = (
    <>
      {[
        // ORDRE 397: coachen har slettet øvelsen, mens sættet ventede på net.
        // ORDRE 406 (O6): serveren har afvist sættet flere runder i træk.
        // Tallene står her, så atleten kan give dem videre; intet slettes.
        { sets: parkedSets.filter(p => p.reason === '23503'), why: 'fordi coachen har ændret øvelsen' },
        { sets: parkedSets.filter(p => p.reason !== '23503'), why: 'efter flere forsøg' },
      ].filter(g => g.sets.length > 0).map(g => (
        <div key={g.why} data-parkerede-saet={g.sets.length} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#c8923a', marginTop: '0.5rem', textAlign: 'center' }}>
          {g.sets.length} sæt kunne ikke sendes, {g.why}. Skriv tallene til din coach:{' '}
          {g.sets.map(p => `${p.exerciseName || 'øvelse'} sæt ${p.setNumber}: ${p.payload?.weight ?? 0} kg × ${p.payload?.reps_completed ?? 0}`).join(' · ')}
        </div>
      ))}
      {pendingSyncCount > 0 && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#7a7770', marginTop: '0.5rem', textAlign: 'center' }}>
          ☁ {pendingSyncCount} {pendingSyncCount === 1 ? 'sæt' : 'sæt'} gemt lokalt — sendes når forbindelsen er tilbage
        </div>
      )}
    </>
  )

  if (pas.status !== 'open') {
    const up = pas.upcoming
    return (
      <div style={s.card}>
        {nudge}
        {rateLine}
        <div style={s.cardLabel}>Dagens pas</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '0.5rem' }}>
          {pas.status === 'done' ? 'Passet er færdigt. ✓' : 'Intet pas i dag.'}
        </div>
        {rekordLinje}
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
              {exerciseViewGroups(up.session.exercises).map(e => e.name).join(' · ')}
            </div>
          </button>
        ) : (
          <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Der er ikke planlagt mere endnu.</div>
        )}
        {ventendeSaet}
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
  const repsIsEditable = repsPrescription.type !== 'fixed' || fixedRepsEntry(ex.reps) !== null
  const repsDefault = fixedRepsEntry(ex.reps) ?? (repsPrescription.type === 'range' ? String(repsPrescription.min) : '')
  const repsValue = input.reps || repsDefault
  const repsToLog = repsIsEditable ? repsValue : ex.reps
  const last = lastHeaviestSet(exerciseHistory, ex.name, todayStr)
  const suggestion = ex.recommended_weight == null ? suggestNextWeight(ex.name, ex.intensity) : null
  // ORDRE 456 (A1): en vægtøvelse = coachen, historikken, ugens sæt eller
  // appens forslag kender en vægt. Kropsvægtøvelser (Planke, Pull-ups) spørges ikke.
  const vaegtOevelse = Number(ex.recommended_weight) > 0 || Number(last?.weight) > 0 || !!ugensSenesteSaet(exerciseLogs, ex.id) || Number(suggestion?.weight) > 0
  const spoergNulKg = vaegtOevelse && !(parseFloat(input.weight) > 0)
  const view = exerciseSetView(ex.name)
  const viewRow = exerciseViewRows(session.exercises).find(row => row.ex.id === ex.id)
  const sessionExercises = exerciseViewGroups(session.exercises)
  const exIdx = sessionExercises.findIndex(group => group.rows.some(row => row.ex.id === ex.id))
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
  const priorSetsOpen = showPriorSetsFor === ex.id || editingSet != null
  const undoInline = priorSetNumbers.length > 0 && !priorSetsOpen && lastLoggedSet && lastLoggedSet.exerciseId === ex.id
  const nextSetReps = fixedRepsEntry(ex.reps) ?? (repsIsEditable ? (last?.reps ?? (repsPrescription.type === 'range' ? repsPrescription.min : null)) : ex.reps)
  const nextSetWeight = ex.recommended_weight ?? suggestion?.weight ?? last?.weight ?? null

  return (
    <div style={s.card}>
      {nudge}
      {rateLine}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={s.cardLabel}>Dagens pas</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#7a7770' }}>{view.label !== 'Sæt' && `${view.label} ${setNumber} · `}Sæt {(viewRow?.offset || 0) + setNumber}/{viewRow?.totalSets || totalSets}</div>
      </div>

      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '0.25rem' }}>
        {view.name}
      </div>
      {last && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
          Sidste gang: {last.weight} kg × {last.reps}{last.rpe ? ` @${last.rpe}` : ''}
        </div>
      )}
      {ex.recommended_weight != null ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', marginBottom: '0.5rem' }}>Anbefalet: {ex.recommended_weight} kg</div>
      ) : suggestion ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', marginBottom: '0.5rem' }}>
          Forslag: {suggestion.weight} kg <span style={{ color: '#7a7770' }}>(RPE {suggestion.fromRpe})</span>
        </div>
      ) : null}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.85rem' }}>
        {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}${/^[\d\s\-–]+$/.test(String(ex.reps)) ? ' reps' : ''}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
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
      {rekordLinje}
      {priorSetNumbers.length > 0 && !priorSetsOpen && (() => {
        const lastPrior = (exerciseLogs || []).find(l => l.exercise_id === ex.id && l.set_number === priorSetNumbers.length)
        return (
          <div data-klarede-saet="kollapset" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.64rem', color: '#7a7770' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              ✓ {priorSetNumbers.length} sæt klaret{lastPrior && !lastPrior.skipped ? ` · senest ${lastPrior.weight} kg × ${lastPrior.reps_completed}` : ''}
              {/* ORDRE 397: sæt fra denne øvelse der venter på net. */}
              {(() => {
                const waiting = priorSetNumbers.filter(n => pendingSyncKeys.includes(`${ex.id}_${n}`)).length
                return waiting > 0 ? <>{' '}<span data-venter-paa-net={waiting} style={{ color: '#c8923a', whiteSpace: 'nowrap' }}>· ☁ {waiting} sendes når du har net</span></> : null
              })()}
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
              onClick={() => setShowPriorSetsFor(ex.id)}
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
                  {/* ORDRE 422: vægt og reps på hver sin linje (ingen flexWrap), så
                      rækken ikke brækker midt i reps-kontrollerne ved 390 px —
                      samme rettelse som ORDRE 314 gav selve kortet. */}
                  <div data-ret-raekke="vaegt" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                  </div>
                  {repsIsEditable && (
                    <div data-ret-raekke="reps" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                    </div>
                  )}
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
                <span style={{ textAlign: 'left' }}>
                  {view.label} {n}: {log.skipped ? 'Sprunget over' : `${log.weight} kg × ${log.reps_completed}${log.rpe_actual != null ? `, RPE ${log.rpe_actual}` : ''}`}
                  {pendingSyncKeys.includes(`${ex.id}_${n}`) && (
                    <>{' '}<span data-venter-paa-net="1" style={{ color: '#c8923a', whiteSpace: 'nowrap' }}>· ☁ sendes når du har net</span></>
                  )}
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
          {/* ORDRE 419 (I2): "+ note" står i vægtrækken, som har plads til den
              ved 360 px; i reps-rækken brækkede den linjen (rolig-forside). */}
          <button
            type="button"
            aria-label={`Note, sæt ${setNumber}`}
            aria-expanded={noteOpenFor === key || !!input.note}
            onClick={() => setNoteOpenFor(noteOpenFor === key ? null : key)}
            style={{ background: 'none', border: 'none', color: input.note ? '#c8923a' : '#7a7770', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', marginLeft: 'auto', minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', padding: '0 0.25rem', flexShrink: 0 }}
          >{input.note ? '✎ note' : '+ note'}</button>
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
          {/* ORDRE 419 (I2): boksen lignede en knap, men var død, og den
              planlagte RPE blev gemt som den faktiske. Nu en knap, der åbner
              vælgeren nedenfor; uden valg gemmes den planlagte som før. */}
          <button
            type="button"
            aria-label={`RPE, sæt ${setNumber}: ${input.rpe || plannedRpe || 'ikke valgt'}`}
            aria-expanded={rpeOpenFor === key}
            onClick={() => setRpeOpenFor(rpeOpenFor === key ? null : key)}
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: input.rpe ? '#c8923a' : '#7a7770', letterSpacing: '0.06em', background: input.rpe ? 'rgba(200,146,58,0.15)' : 'transparent', border: `1px solid ${input.rpe ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.13)'}`, padding: '0.3rem 0.5rem', minWidth: '44px', minHeight: '52px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
          >RPE {input.rpe || plannedRpe || '–'} ▾</button>
        </div>
        {rpeOpenFor === key && (
          <div role="group" aria-label={`Vælg RPE, sæt ${setNumber}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem' }}>
            {RPE_VALUES.map(v => {
              const valgt = parseFloat(input.rpe || plannedRpe) === v
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`RPE ${v}`}
                  aria-pressed={valgt}
                  onClick={() => {
                    setLogInputs(p => ({ ...p, [key]: { ...(p[key] || input), rpe: String(v) } }))
                    setRpeOpenFor(null)
                  }}
                  style={{ ...s.btnGhost, minHeight: '44px', boxSizing: 'border-box', padding: 0, fontSize: '0.8rem', color: valgt ? '#c8923a' : '#edeae2', borderColor: valgt ? 'rgba(200,146,58,0.6)' : undefined, background: valgt ? 'rgba(200,146,58,0.15)' : undefined }}
                >{String(v).replace('.', ',')}</button>
              )
            })}
          </div>
        )}
        {(noteOpenFor === key || !!input.note) && (
          <input
            aria-label={`Note til sæt ${setNumber}`}
            autoFocus={noteOpenFor === key}
            type="text"
            placeholder="Note til coachen, fx ryg stram"
            maxLength={200}
            value={input.note || ''}
            onChange={e => { const v = e.target.value; setLogInputs(p => ({ ...p, [key]: { ...(p[key] || input), note: v } })) }}
            style={{ ...s.fieldInput, minHeight: '44px', boxSizing: 'border-box', fontSize: '0.8rem', fontStyle: 'italic' }}
          />
        )}
      </div>
      {/* ORDRE 280 · commit 2 — "Godkendt" er den mest gentagne handling i hele
          appen (ét tryk pr. sæt, hele træningen), derfor flex:1 og 60px høj —
          rammes med en tommelfinger nederst i kortet, også med handsker.
          Ingen dialog, ingen bekræftelse: gemmer sættet som det står med det
          samme (samme optimistiske onLogSet som før, se logDagensPasSet). */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
        <button
          style={{ ...s.btnPrimary, flex: 1, minHeight: '60px', boxSizing: 'border-box', fontSize: '0.85rem' }}
          onClick={() => {
            if (spoergNulKg && nulKgSpurgt !== key) { setNulKgSpurgt(key); return }
            if (!acceptSetTap()) return
            setNulKgSpurgt(null)
            onLogSet(ex, setNumber, totalSets, repsToLog, plannedRpe)
          }}
        >Godkendt</button>
        <button
          style={{ ...s.btnGhost, minHeight: '60px', boxSizing: 'border-box', fontSize: '0.6rem' }}
          onClick={() => { if (acceptSetTap()) skipSet(ex.id, setNumber, plannedRpe) }}
        >Spring over</button>
      </div>
      {/* ORDRE 1459 — pausetimeren skal kunne findes FOER foerste sæt er godkendt:
          én lille linje med pausens længde; et tryk starter den og åbner
          pop-up'en (samme som efter Godkendt). Første gang står der hvornår
          pausen ellers starter. Skjult mens en pause allerede kører (så er
          den synlige linje nederst vejen ind). */}
      {onStartPause && !pauseAktiv && (
        <button
          type="button"
          data-testid="pause-start-linje"
          onClick={() => onStartPause(ex)}
          style={{ display: 'block', width: '100%', minHeight: '44px', boxSizing: 'border-box', background: 'none', border: 'none', padding: '0.3rem 0', marginTop: '0.2rem', cursor: 'pointer', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770', lineHeight: 1.5 }}
        >
          <span style={{ color: '#c8923a' }}>Pause {visTid(restSecondsForExercise(ex))}</span> · tryk for at starte
          {!pauseForklaret && <span style={{ display: 'block', fontSize: '0.54rem', color: '#4a4844' }}>Pausen starter også af sig selv, når du godkender et sæt.</span>}
        </button>
      )}
      {spoergNulKg && nulKgSpurgt === key && (
        <div data-nul-kg={key} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.03em', lineHeight: 1.45, color: '#c8923a', marginTop: '0.5rem' }}>
          Vægtfeltet er tomt. Skriv vægten, eller tryk Godkendt igen for at gemme sættet uden vægt (0 kg).
        </div>
      )}
      {/* Fortryd — kun mens man ikke har forladt øvelsen: næste sæt i kortet
          skal stadig høre til den øvelse man lige loggede et sæt på. */}
      {lastLoggedSet && lastLoggedSet.exerciseId === ex.id && !undoInline && (
        <button
          type="button"
          onClick={() => onUndoLastSet(lastLoggedSet.exerciseId, lastLoggedSet.setNumber)}
          style={{ ...s.btnGhost, marginTop: '0.5rem', width: '100%', minHeight: '44px', boxSizing: 'border-box', fontSize: '0.56rem', color: '#7a7770' }}
        >↺ Fortryd sidste sæt</button>
      )}
      {ventendeSaet}

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
          {[nextExercise.totalSets && ` · ${nextExercise.totalSets} sæt`, nextExercise.rows.length === 1 && nextExercise.rows[0].ex.reps && ` × ${nextExercise.rows[0].ex.reps}`].filter(Boolean).join('')}
          {laterCount > 0 ? ` (+${laterCount})` : ''}
        </div>
      )}

      {/* Ordre 1446: opvarmningen laa tre fane-skift væk fra passet. Et enkelt
          link, kun før det første sæt, og ingen ny chip på forsiden (ordre 330). */}
      {onVarmOp && activeNext && (viewRow?.offset || 0) + setNumber === 1 && (
        <button
          type="button" data-testid="varm-op-link" onClick={onVarmOp}
          style={{ display: 'block', width: '100%', minHeight: '44px', marginTop: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.06em', color: '#c8923a' }}
        >Varm op først →</button>
      )}
    </div>
  )
}

export default DagensPasCard

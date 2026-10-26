import { useState, useRef } from 'react'
import { supabase } from '../supabase'
import { s } from '../dashboardShared'
import { DEFAULT_COACH_PLAN_COPY, createCopyDraft, sessionDate, validateCopyDraft, sendCopyDraft } from './coachPlanCopy.mjs'

export default function CoachPlanCopy({ enabled = DEFAULT_COACH_PLAN_COPY, weeks, athleteId, openWeekId, onSent }) {
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const busy = useRef(false)
  const sent = useRef(false)
  const reviewRequired = useRef(false)
  if (enabled !== true) return null
  const source = weeks.find(week => week.id === openWeekId) || [...weeks].sort((a, b) => b.week_number - a.week_number)[0]
  const change = (field, value) => { if (!busy.current) setDraft(current => ({ ...current, [field]: value })) }
  const editSession = (index, field, value) => {
    if (!busy.current) setDraft(current => ({ ...current, sessions: current.sessions.map((session, n) => n === index ? { ...session, [field]: value } : session) }))
  }
  const editExercise = (index, exIndex, field, value) => {
    if (!busy.current) setDraft(current => ({ ...current, sessions: current.sessions.map((session, n) => n === index
      ? { ...session, exercises: session.exercises.map((exercise, e) => e === exIndex ? { ...exercise, [field]: value } : exercise) } : session) }))
  }
  const problem = draft ? validateCopyDraft(draft, weeks, athleteId) : null
  return <section aria-label="Kopiér til næste uge" style={{ marginBottom: '1.5rem' }}>
    {!draft && <button style={s.btnGhost} disabled={blocked || !source || !athleteId} onClick={() => {
      if (reviewRequired.current) return
      try { setDraft(createCopyDraft(source, athleteId)); sent.current = false; setError('') }
      catch (failure) { setError(failure.message) }
    }}>Kopiér til næste uge</button>}
    {error && <p role="alert">{error}</p>}
    {draft && <fieldset disabled={sending} style={{ minWidth: 0 }}>
      <legend>Kladde til næste uge</legend>
      <p role="status">Kopieret fra uge {source?.id === draft.source_week_id ? source.week_number : draft.week_number - 1}. Intet er sendt. Ret kladden før afsendelse.</p>
      <label>Ugenummer<input type="number" min="1" value={draft.week_number} onChange={e => change('week_number', e.target.value)} /></label>
      <label>Startdato<input type="date" value={draft.start_date} onChange={e => change('start_date', e.target.value)} /></label>
      <label>Blok<input value={draft.block_name || ''} onChange={e => change('block_name', e.target.value)} /></label>
      <label>Blokbeskrivelse<textarea value={draft.block_description || ''} onChange={e => change('block_description', e.target.value)} /></label>
      <label>Note til ugen<textarea value={draft.coach_note || ''} onChange={e => change('coach_note', e.target.value)} /></label>
      {draft.sessions.map((session, index) => <div key={index}>
        <h3>Pas {index + 1}</h3>
        <label>Navn på pas<input value={session.title || ''} onChange={e => editSession(index, 'title', e.target.value)} /></label>
        <label>Ugedag<select value={session.weekday ?? ''} onChange={e => editSession(index, 'weekday', e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Uden fast dag</option>
          {['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'].map((day, n) => <option key={day} value={n}>{day}</option>)}
        </select></label>
        <p>{sessionDate(draft, session) || 'Ingen fast dato'}</p>
        {session.exercises.map((exercise, exIndex) => <div key={exIndex}>
          {['name', 'sets', 'reps', 'intensity', 'note', 'recommended_weight'].map((field, n) => <label key={field}>
            {['Øvelse', 'Sæt', 'Gentagelser', 'Intensitet', 'Øvelsesnote', 'Vægt'][n]}
            <input value={exercise[field] ?? ''} onChange={e => editExercise(index, exIndex, field, e.target.value === '' ? null : e.target.value)} />
          </label>)}
        </div>)}
        <button style={s.btnGhost} onClick={() => { if (!busy.current) change('sessions', draft.sessions.filter((_, n) => n !== index)) }}>Fjern pas {index + 1}</button>
      </div>)}
      {problem && <p role="alert">{problem}</p>}
      <button style={s.btnPrimary} disabled={blocked || sending || !!problem} aria-busy={sending} onClick={async () => {
        if (reviewRequired.current || blocked || busy.current || sent.current || enabled !== true || problem) return
        busy.current = true; setSending(true); setError('')
        let id
        try { id = await sendCopyDraft(supabase, draft, weeks, athleteId) }
        catch (failure) { setError(failure.message); if (failure.needsReview) { reviewRequired.current = true; setBlocked(true) } return }
        finally { busy.current = false; setSending(false) }
        sent.current = true
        setDraft(null)
        onSent(id)
      }}>{sending ? 'Sender...' : 'Send til atleten'}</button>
      <button style={s.btnGhost} disabled={sending} onClick={() => { if (!busy.current) { setDraft(null); setError('') } }}>Annuller kladde</button>
    </fieldset>}
  </section>
}

// APP-S1 UI candidate. INERT during producer verification; React is not executed.
import { useState } from 'react'
import { CHECKLIST, NOTICE, checklistState, finalizeDraft, meetPlan, timeLabel } from './staevnedagPlan.mjs'

function LiftPlan({ lift }) {
  const [start, setStart] = useState('')
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const rows = saved ?? lift.sets
  const editing = draft !== null
  function save() {
    const result = finalizeDraft(draft, lift.opener)
    if (!result.ok) { setError(result.error); return }
    setSaved(result.sets)
    setDraft(null)
    setError('')
  }
  return <fieldset>
    <legend>{lift.label}: åbner {lift.opener ?? 'mangler'} kg</legend>
    {lift.sets.length === 0 ? <p>Angiv en åbner over 20 kg og højst 1000 kg for at få et forslag.</p> : <>
      <label>Forventet åbner, lokal tid <input type="time" value={start} onChange={event => setStart(event.target.value)} /></label>
      <p>Forslag: 20 kg stang, afrunding til 2,5 kg og op til fem sæt 25, 18, 12, 8 og 4 minutter før åbneren. Ret med coachen, når tidsplanen ændres.</p>
      <ol>{rows.map((row, index) => <li key={index}>{row.weight} kg × {row.reps} ({row.pct}), {timeLabel(start, row.minutesBefore)}</li>)}</ol>
      {rows.length === 0 && <p>Alle sæt er fjernet lokalt.</p>}
      {editing ? <>
        {draft.map((row, index) => <div key={index}>
          {['weight', 'reps', 'minutesBefore'].map((field, j) => <label key={field}>
            {['Vægt i kg', 'Reps', 'Minutter før åbner'][j]}, sæt {index + 1}
            <input type="number" min={field === 'weight' ? 20 : 1} step={field === 'weight' ? 2.5 : 1}
              value={row[field]} onChange={event => {
                const value = event.target.value
                setDraft(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
              }} />
          </label>)}
          <button type="button" onClick={() => setDraft(prev => prev.filter((_, i) => i !== index))}>Fjern sæt {index + 1}</button>
        </div>)}
        <button type="button" onClick={() => setDraft(prev => [...prev, { weight: 20, reps: 1, minutesBefore: 1 }])}>Tilføj sæt</button>
        <button type="button" onClick={save}>Gem lokalt</button>
        <button type="button" onClick={() => { setDraft(null); setError('') }}>Annuller</button>
        {error && <p role="alert">{error}</p>}
      </> : <>
        <button type="button" onClick={() => setDraft(rows.map(row => ({ ...row })))}>Rediger med coach</button>
        <button type="button" onClick={() => setSaved(null)}>Gendan forslag</button>
      </>}
    </>}
  </fieldset>
}

export default function MeetDayPlanner({ meetAttempts, meetType }) {
  const [checked, setChecked] = useState({})
  return <section aria-label="Tjekliste og opvarmningsforslag">
    <h2>Før stævnet</h2>
    <p>{NOTICE}</p>
    {CHECKLIST.map(item => <label key={item.id} style={{ display: 'block' }}>
      <input type="checkbox" checked={checked[item.id] === true}
        onChange={event => { const value = event.target.checked; setChecked(prev => checklistState(prev, item.id, value)) }} />{item.label}
    </label>)}
    {meetPlan(meetAttempts, meetType).map(lift => <LiftPlan key={`${lift.key}:${lift.opener}`} lift={lift} />)}
  </section>
}

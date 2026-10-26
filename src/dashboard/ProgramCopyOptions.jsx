import { useState } from 'react'
import { s } from '../dashboardShared'
import { copyBlockName, skippedProgressions } from './programCopy.js'

export default function ProgramCopyOptions({ request, weeks, busy, onCopy, onCancel }) {
  const [progression, setProgression] = useState(request.kind === 'block' ? 'none' : 'weight')
  const skipped = skippedProgressions(request.weeks, progression)
  const firstNumber = Math.max(0, ...weeks.map(w => w.week_number)) + 1
  const block = request.kind === 'block'
  return (
    <form aria-label={block ? 'Kopiér blok' : 'Kopiér med progression'} onSubmit={async e => {
      e.preventDefault()
      if (await onCopy(request.weeks[0].id, progression)) onCancel()
    }} style={{ background: '#1c1c18', border: '1px solid #c8923a', padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', color: '#edeae2', fontSize: '1rem' }}>{block ? 'Kopiér blok' : `Kopiér uge ${request.weeks[0].week_number} med progression`}</h3>
      <p style={{ color: '#b8b4a8', fontSize: '0.85rem' }}>
        {block ? `${request.weeks.length} uger fra uge ${firstNumber}. Ny blok: ${copyBlockName(request.weeks[0].block_name, weeks)}.` : `Kopien bliver uge ${firstNumber}.`}
        {' '}Alle pas og øvelser følger med. Du kan rette alt bagefter.
      </p>
      <label style={{ display: 'block', color: '#edeae2', marginBottom: '0.75rem' }}>
        Progression
        <select autoFocus style={{ ...s.fieldInput, marginTop: '0.4rem' }} value={progression} disabled={busy} onChange={e => setProgression(e.target.value)}>
          {block && <option value="none">Ingen progression</option>}
          <option value="weight">+2,5 kg</option>
          <option value="reps">+1 rep</option>
        </select>
      </label>
      {progression !== 'none' && <p style={{ color: '#b8b4a8', fontSize: '0.85rem' }}>Gælder squat, bænkpres og dødløft, også sumo. Assistanceøvelser bevares.</p>}
      {skipped.length > 0 && <p role="status" style={{ color: '#c8923a', fontSize: '0.85rem' }}>
        Ret selv {skipped.length} hovedøvelser: {progression === 'weight' ? 'vægten mangler eller er ugyldig' : 'reps er ikke et tal eller interval'}. De kopieres uden progression.
      </p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button type="button" style={s.btnGhost} disabled={busy} onClick={onCancel}>Annuller</button>
        <button type="submit" style={s.btnPrimary} disabled={busy} aria-busy={busy}>{busy ? 'Kopierer...' : block ? 'Kopiér blok' : 'Kopiér uge'}</button>
      </div>
    </form>
  )
}

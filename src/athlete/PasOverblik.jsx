import { useState } from 'react'
import { pasOverblik } from './pasOverblikModel.mjs'
import './PasOverblikStyles.css'

// Kun læsevisning: det aktive logkort og dets inputnøgle forbliver uændrede.
// Parent giver key=session.id, så et nyt pas starter lukket uden gammelt valg.
export default function PasOverblik({ session, logs, activeId }) {
  const [selectedId, setSelectedId] = useState(null)
  const model = pasOverblik(session, logs, activeId, selectedId)
  if (!model.rows.length) return null
  return (
    <details className="pas-overblik">
      <summary>{model.summary}</summary>
      <div className="pas-overblik-body">
        <ol className="pas-overblik-list" aria-label="Øvelser i dagens pas">
          {model.rows.map(row => (
            <li key={row.exercise.id}>
              <button type="button" className="pas-overblik-row"
                aria-current={row.current ? 'step' : undefined}
                aria-pressed={model.selected?.exercise.id === row.exercise.id}
                onClick={() => setSelectedId(row.exercise.id)}>
                <span>{row.index + 1}. {row.exercise.name}</span>
                <span className="pas-overblik-meta">
                  {row.done}/{row.total} sæt klaret
                  {row.current ? ' · Aktuel' : row.exercise.id === model.nextId ? ' · Næste' : ''}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="pas-overblik-preview" aria-live="polite" aria-atomic="true">
          <div className="pas-overblik-name">{model.selected.exercise.name}</div>
          <div>{[model.selected.exercise.sets && `${model.selected.exercise.sets} sæt`, model.selected.exercise.reps && `× ${model.selected.exercise.reps}`, model.selected.exercise.intensity].filter(Boolean).join(' · ')}</div>
          <ul className="pas-overblik-sets">
            {model.selected.sets.map(set => <li key={set.number}>Sæt {set.number}: {set.status}</li>)}
          </ul>
          <div>Kun overblik · det igangværende sæt står nedenfor.</div>
          {!model.selected.current && (
            <button type="button" className="pas-overblik-return" onClick={() => setSelectedId(activeId)}>Vis aktuel øvelse</button>
          )}
        </div>
        <div className="pas-overblik-help">Klaret omfatter også sæt sprunget over.</div>
      </div>
    </details>
  )
}

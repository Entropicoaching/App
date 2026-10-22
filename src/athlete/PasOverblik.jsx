import { useEffect, useId, useRef } from 'react'
import { pasOverblik } from './pasOverblikModel.mjs'
import { bindPasOverblik } from './pasOverblikDialog.mjs'
import './PasOverblikStyles.css'

// Kun læsevisning. Ingen callbacks til logning eller ændring af aktivt sæt.
export default function PasOverblik({ session, logs, activeId }) {
  const trigger = useRef(null)
  const dialog = useRef(null)
  const handle = useRef(null)
  const close = useRef(null)
  const titleId = useId()
  const model = pasOverblik(session, logs, activeId)
  const hasRows = model.rows.length > 0
  useEffect(() => {
    if (!hasRows) return
    return bindPasOverblik({ trigger: trigger.current, dialog: dialog.current,
      handle: handle.current, close: close.current })
  }, [hasRows])
  if (!hasRows) return null
  return (
    <div className="pas-overblik">
      <button ref={trigger} type="button" className="pas-overblik-trigger"
        aria-haspopup="dialog" aria-expanded="false">Se hele passet</button>
      <dialog ref={dialog} className="pas-overblik-sheet" aria-labelledby={titleId}>
        <header ref={handle} className="pas-overblik-header">
          <h2 id={titleId}>Dagens pas</h2>
          <button ref={close} type="button" autoFocus aria-label="Luk overblik">Luk</button>
        </header>
        <div className="pas-overblik-progress">
          <div className="pas-overblik-ring" role="progressbar" aria-label="Afsluttede sæt"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.percent}
            aria-valuetext={`${model.percent} %, ${model.done} af ${model.total} sæt afsluttet`}
            style={{ '--progress': `${model.percent}%` }}>
            <span>{model.percent}%</span>
          </div>
          <span>{model.done}/{model.total} sæt afsluttet</span>
        </div>
        <ol className="pas-overblik-list" aria-label="Øvelser i dagens pas">
          {model.rows.map(row => (
            <li key={row.exercise.id} aria-current={row.current ? 'step' : undefined}>
              <div className="pas-overblik-name">{row.exercise.name}</div>
              <div className="pas-overblik-meta">{[row.exercise.reps && `× ${row.exercise.reps}`, row.exercise.intensity].filter(Boolean).join(' · ')}</div>
              <ul className="pas-overblik-sets">
                {row.sets.map(set => <li key={set.number} data-status={set.status}>
                  <span aria-hidden="true">{set.status === 'Færdigt' ? '✓ ' : set.status === 'Sprunget over' ? '↷ ' : '○ '}</span>
                  Sæt {set.number}<span className="pas-overblik-sr">: {set.status}</span>
                  {set.status === 'Sprunget over' && <span> · sprunget over</span>}
                </li>)}
              </ul>
            </li>
          ))}
        </ol>
      </dialog>
    </div>
  )
}

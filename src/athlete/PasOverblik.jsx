import { useEffect, useId, useRef } from 'react'
import { pasOverblik } from './pasOverblikModel.mjs'
import { bindPasOverblik } from './pasOverblikDialog.mjs'
import './PasOverblikStyles.css'

const STATUS_TEGN = { 'Færdigt': '✓', 'Sprunget over': '↷', 'Planlagt': '' }

// Kun læsevisning. Ingen callbacks til logning eller ændring af aktivt sæt.
// APP-OV4: samme idé (én knap, bundark, ring med procent, liste over sæt), men
// knappens indhold kan gives af kortet (`children(model)`), så "Næste øvelse"-
// linjen og knappen er ét og samme tryk nederst i loggen. Uden children står
// den rolige standardknap "Se hele passet" (fx når passet er færdigt).
export default function PasOverblik({ session, logs, activeId, children, triggerLabel, fallback = null }) {
  const trigger = useRef(null)
  const dialog = useRef(null)
  const handle = useRef(null)
  const close = useRef(null)
  const titleId = useId()
  const dialogId = useId()
  const model = pasOverblik(session, logs, activeId)
  const hasRows = model.rows.length > 0
  useEffect(() => {
    if (!hasRows) return
    return bindPasOverblik({ trigger: trigger.current, dialog: dialog.current,
      handle: handle.current, close: close.current })
  }, [hasRows])
  if (!hasRows) return fallback
  const custom = typeof children === 'function'
  return (
    <div className={custom ? 'pas-overblik pas-overblik--linje' : 'pas-overblik'}>
      <button ref={trigger} type="button" className={custom ? 'pas-overblik-trigger pas-overblik-trigger--linje' : 'pas-overblik-trigger'}
        aria-haspopup="dialog" aria-expanded="false" aria-controls={dialogId}
        aria-label={triggerLabel ? triggerLabel(model) : undefined}>
        {custom ? children(model) : (
          <>
            <span className="pas-overblik-mini" aria-hidden="true" style={{ '--progress': `${model.percent}%` }} />
            <span>Se hele passet</span>
            <span className="pas-overblik-trigger-tal">{model.done}/{model.total}</span>
          </>
        )}
      </button>
      <dialog ref={dialog} id={dialogId} className="pas-overblik-sheet" aria-labelledby={titleId}>
        <header ref={handle} className="pas-overblik-header">
          <span className="pas-overblik-greb" aria-hidden="true" />
          <h2 id={titleId}>Dagens pas</h2>
          <button ref={close} type="button" autoFocus aria-label="Luk overblik">Luk</button>
        </header>
        <div className="pas-overblik-progress">
          <div className="pas-overblik-ring" role="progressbar" aria-label="Afsluttede sæt"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.percent}
            aria-valuetext={`${model.percent} %, ${model.done} af ${model.total} sæt afsluttet`}
            style={{ '--progress': `${model.percent}%` }}>
            <span><strong>{model.percent}</strong><small>%</small></span>
          </div>
          <div className="pas-overblik-status">
            <div className="pas-overblik-status-tal">{model.done} af {model.total} sæt</div>
            <div className="pas-overblik-status-tekst">afsluttet i dag</div>
          </div>
        </div>
        <ol className="pas-overblik-list" aria-label="Øvelser i dagens pas">
          {model.rows.map(row => (
            <li key={row.exercise.id} aria-current={row.current ? 'step' : undefined}
              data-faerdig={row.total > 0 && row.done === row.total ? 'ja' : undefined}>
              <div className="pas-overblik-row-head">
                <div className="pas-overblik-name">{row.exercise.name}</div>
                <div className="pas-overblik-count">{row.done}/{row.total}</div>
              </div>
              <div className="pas-overblik-meta">{[row.exercise.reps && `× ${row.exercise.reps}`, row.exercise.intensity].filter(Boolean).join(' · ')}</div>
              <ul className="pas-overblik-sets">
                {row.sets.map(set => <li key={set.number} data-status={set.status}>
                  <span aria-hidden="true" className="pas-overblik-set-tegn">{STATUS_TEGN[set.status]}</span>
                  <span>Sæt {set.number}</span><span className="pas-overblik-sr">: {set.status}</span>
                </li>)}
              </ul>
            </li>
          ))}
        </ol>
        {model.rows.some(row => row.sets.some(set => set.status === 'Sprunget over')) && (
          <p className="pas-overblik-legend">↷ betyder sprunget over</p>
        )}
      </dialog>
    </div>
  )
}

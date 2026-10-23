import { useEffect, useId, useRef } from 'react'
import { pasOverblik } from './pasOverblikModel.mjs'
import { bindPasOverblik } from './pasOverblikDialog.mjs'
import { bundStil, bundVariant, naesteKort, naesteSaet, ordinationTekst } from './dagensPasLayout.mjs'
import './PasOverblikStyles.css'

const STATUS_TEGN = { 'Færdigt': '✓', 'Sprunget over': '↷', 'Planlagt': '' }

// APP-OV5: bunden af loggen som et lille kort i loggens stil. Kun præsentation;
// alt synligt kommer fra naesteKort, så knappens navn (triggerLabel) rummer det.
// A: ét kort, stor ring med procent og næste øvelse ved siden af.
// B: to fliser, ringen med "Hele passet" og næste øvelse med sætstreger.
function NaesteBund({ naeste, model, variant }) {
  const k = naesteKort(naeste, model)
  const b = bundStil(variant, k.procent)
  const ring = (
    <span style={b.ring} aria-hidden="true" data-testid="bund-ring">
      <span style={b.ringHul}><span style={b.ringTal}>{k.procent}</span><span style={b.ringEnhed}>%</span></span>
    </span>
  )
  const oevelse = (
    <span data-testid="naeste-oevelse" style={b.oevelse}>
      {k.etiket && <span style={b.etiket}>{k.etiket}</span>}
      <span style={b.navn}>{k.navn}</span>
      {(k.ordination || k.efter) && (
        <span style={b.ordinationRaekke}>
          {k.ordination && <span style={b.ordination}>{k.ordination}</span>}
          {k.efter && <span style={b.efter}>{k.efter}</span>}
        </span>
      )}
    </span>
  )
  if (b.variant === 'B') return (
    <span style={b.fliser} data-bund-variant="B">
      <span style={b.ringFlise}>{ring}<span style={b.handling}>{k.handling} ›</span></span>
      <span style={b.oevelseFlise}>
        {oevelse}
        {k.streger.length > 0 && <span style={b.streger} aria-hidden="true">{k.streger.map((_, i) => <span key={i} style={b.streg} />)}</span>}
      </span>
    </span>
  )
  return (
    <span style={b.kort} data-bund-variant="A">
      {ring}
      {oevelse}
      <span style={b.handling}>{k.handling} ›</span>
    </span>
  )
}

// Kun læsevisning. Ingen callbacks til logning eller ændring af aktivt sæt.
// APP-OV4: samme idé (én knap, bundark, ring med procent, liste over sæt), men
// knappens indhold kan gives af kortet (`children(model)`), så "Næste øvelse"-
// linjen og knappen er ét og samme tryk nederst i loggen. Uden children står
// den rolige standardknap "Se hele passet" (fx når passet er færdigt).
// APP-OV5: med `naeste` (også null ved sidste øvelse) tegner overblikket selv
// bunden (NaesteBund). `variant` (A eller B, som loggen) vælger bundens og
// arkets udseende; uden variant er det A.
export default function PasOverblik({ session, logs, activeId, children, triggerLabel, fallback = null, naeste, variant }) {
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
  if (!hasRows) return fallback
  const bund = naeste !== undefined
  const custom = bund || typeof children === 'function'
  const v = bundVariant(variant)
  const naesteSet = naesteSaet(model)
  return (
    <div className={`${custom ? 'pas-overblik pas-overblik--linje' : 'pas-overblik'} pas-overblik--${v}`} data-variant={v}>
      <button ref={trigger} type="button" className={custom ? 'pas-overblik-trigger pas-overblik-trigger--linje' : 'pas-overblik-trigger'}
        aria-haspopup="dialog" aria-expanded="false"
        aria-label={triggerLabel ? triggerLabel(model) : undefined}>
        {bund ? <NaesteBund naeste={naeste} model={model} variant={v} /> : custom ? children(model) : (
          <>
            <span className="pas-overblik-mini" aria-hidden="true" style={{ '--progress': `${model.percent}%` }} />
            <span>Se hele passet</span>
            <span className="pas-overblik-trigger-tal">{model.done}/{model.total}</span>
          </>
        )}
      </button>
      <dialog ref={dialog} className="pas-overblik-sheet" aria-labelledby={titleId}>
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
            <div className="pas-overblik-status-etiket">Afsluttet i dag</div>
            <div className="pas-overblik-status-tal">{model.done} af {model.total} sæt</div>
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
              <div className="pas-overblik-meta">{ordinationTekst(row.exercise)}</div>
              <ul className="pas-overblik-sets">
                {row.sets.map(set => <li key={set.number} data-status={set.status}
                  data-naeste={naesteSet && naesteSet.index === row.index && naesteSet.number === set.number ? 'ja' : undefined}>
                  <span aria-hidden="true" className="pas-overblik-set-tegn">{STATUS_TEGN[set.status]}</span>
                  <span>Sæt {set.number}</span><span className="pas-overblik-sr">: {set.status}</span>
                </li>)}
              </ul>
            </li>
          ))}
        </ol>
        {model.rows.some(row => row.sets.some(set => set.status === 'Sprunget over')) && (
          <p className="pas-overblik-legend">{v === 'A' ? 'Stiplet streg betyder sprunget over' : '↷ betyder sprunget over'}</p>
        )}
      </dialog>
    </div>
  )
}

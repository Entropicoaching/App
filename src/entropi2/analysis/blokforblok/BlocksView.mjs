import * as React from 'react'

// Hooks hentes via navnerummet: Analysis' lukkede prøveharness erstatter 'react'
// med en fixture, der kun har createElement. Komponenten monteres kun med U3-flaget.
const h = React.createElement
import { calendarDay } from '../../../calendarDate.js'
import { readBlocks } from './readBlocks.mjs'
import { readAthleteU3Shared } from '../../u3/readAthleteU3.mjs'
import { blocksModel } from './blocksModel.mjs'
import { formatNumber, signed } from '../../u3/format.mjs'
import { Bars, FocusBox } from '../../u3/charts.mjs'

const NOT_ENOUGH = 'ikke nok data'
const cell = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }
const head = { ...cell, position: 'sticky', left: 0, background: '#1c1c18', textAlign: 'left', fontWeight: 400, zIndex: 1 }
const arrow = change => change > 0 ? ` ↑${formatNumber(change)}` : change < 0 ? ` ↓${formatNumber(-change)}` : ' →0'

const small = { fontSize: 13, color: '#c1beb5' }
const blockName = b => b.current ? 'Nu' : b.name
export const blocksCard = { padding: 16, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18', textAlign: 'left', minWidth: 0 }

// U3b: ét fokuspunkt ud fra den nyeste blok med tal mod blokken før.
// Et løft, der står stille eller falder, går forud for den største fremgang.
export function blocksFocus(model, source = 'coach') {
  if (model?.status !== 'ready' || model.single) return null
  const withNumbers = model.blocks.filter(b => b.enough && !b.light)
  const latest = withNumbers.at(-1)
  if (!latest) return null
  const changes = model.liftsShown.map(lift => ({ lift, change: latest.changes?.[lift.key] }))
    .filter(c => typeof c.change === 'number').map(c => ({ ...c, change: Math.round(c.change) }))
  if (!changes.length) return null
  const prev = model.blocks[model.blocks.indexOf(latest) - 1]
  const against = prev ? `mod ${blockName(prev)}` : 'mod blokken før'
  const worst = changes.reduce((a, b) => b.change < a.change ? b : a)
  if (worst.change <= 0) return { key: 'stall', value: worst.change === 0 ? `${worst.lift.label} står stille` : `${worst.lift.label} ${signed(worst.change, 0)} kg`,
    text: `${against}. ${source === 'athlete' ? 'Tal med din coach om næste blok.' : 'Overvej en ændring i næste blok.'}` }
  const best = changes.reduce((a, b) => b.change > a.change ? b : a)
  return { key: 'gain', value: `${best.lift.label} ${signed(best.change, 0)} kg`, text: `${against}. Fortsæt i samme spor.` }
}

// Ét lille søjlediagram pr. hovedløft, én søjle pr. blok (ældste til venstre).
function liftBars(model) {
  return model.liftsShown.map(lift => {
    const values = model.blocks.map(b => b.enough && !b.light && typeof b.lifts[lift.key] === 'number' ? b.lifts[lift.key] : null)
    const last = values.filter(v => v !== null).at(-1)
    return h('div', { key: lift.key, 'data-u3-block-lift': lift.key,
      style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', alignItems: 'center', gap: 12, paddingBlock: 8, borderTop: '1px solid #2f2f29' } },
    h('div', { style: { minWidth: 0 } }, h('span', { style: { ...small, display: 'block' } }, `${lift.label} e1RM`),
      h('strong', { style: { fontSize: 18 } }, last === undefined ? NOT_ENOUGH : `${formatNumber(Math.round(last))} kg`)),
    h(Bars, { values, zeroBased: false, label: `${lift.label}: bedste e1RM pr. blok, ${model.blocks.map(blockName).join(', ')}` }) ?? h('span', { style: small }, NOT_ENOUGH))
  })
}

// Grafer først, alle tal i en lukket tabel. Manglende tal står som "ikke nok data", aldrig 0.
export function BlocksTable({ model, source = 'coach' }) {
  if (!model) return null
  if (model.status === 'ambiguous') return h('p', { role: 'status', 'data-u3-blocks-ambiguous': true }, model.message)
  if (model.status !== 'ready' || !model.blocks.length) return h('p', { role: 'status' }, 'Der er endnu ingen blokke med data.')
  const blocks = model.blocks
  const value = (block, render) => !block.enough ? NOT_ENOUGH : render(block) ?? NOT_ENOUGH
  const rows = [
    ...model.liftsShown.map(lift => [lift.label, block => block.light ? 'let blok' : value(block, b => {
      const v = b.lifts[lift.key]
      if (typeof v !== 'number') return null
      return `${formatNumber(Math.round(v))}${model.single || b.changes[lift.key] === null ? '' : arrow(Math.round(b.changes[lift.key]))}`
    })]),
    ['Pas', block => value(block, b => b.sessionShare === null ? null : `${formatNumber(Math.round(b.sessionShare * 100))} %`)],
    ['Sæt/uge', block => value(block, b => b.setsPerWeek === null ? null : formatNumber(Math.round(b.setsPerWeek)))],
    ['Vægt', block => value(block, b => b.weight === null ? null : `${formatNumber(b.weight, 1)} kg`)],
    ['Readiness', block => value(block, b => b.readiness === null ? null : formatNumber(Math.round(b.readiness)))],
  ]
  return h('div', { 'data-u3-blocks': true, style: blocksCard },
    h(FocusBox, { focus: blocksFocus(model, source) }),
    !model.single && h('p', { style: { ...small, margin: '0 0 4px', textAlign: 'right' } }, blocks.map(blockName).join(' · ')),
    ...liftBars(model),
    h('details', { 'data-u3-blocks-numbers': true },
      h('summary', { style: { minHeight: 44, cursor: 'pointer', display: 'flex', alignItems: 'center' } }, 'Se alle tal'),
      h('div', { style: { overflowX: 'auto', maxWidth: '100%' } },
        h('table', { style: { borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '100%' } },
          h('thead', null, h('tr', null, h('th', { style: head, scope: 'col' }, ''),
            ...blocks.map((b, i) => h('th', { key: i, scope: 'col', style: { ...cell, fontWeight: 600 } }, blockName(b))))),
          h('tbody', null, ...rows.map(([label, render]) => h('tr', { key: label },
            h('th', { scope: 'row', style: head }, label),
            ...blocks.map((b, i) => h('td', { key: i, style: cell }, render(b)))))))),
      h('p', { style: { ...small, lineHeight: 1.5 } },
        `${blocks.map(b => `${blockName(b)}: ${b.light ? 'let blok, ' : ''}${b.completedWeeks} ${b.completedWeeks === 1 ? 'uge' : 'uger'}`).join(' · ')}.`)))
}

const ready = part => part?.state === 'ready'
export function blocksFromRead(data, now) {
  if (!data) return null
  if (!ready(data.weeks)) return { status: 'unknown', blocks: [] }
  return blocksModel({ weeks: data.weeks.rows, logs: ready(data.logs) ? data.logs.rows : null,
    weights: ready(data.weights) ? data.weights.rows : null, readiness: ready(data.readiness) ? data.readiness.rows : null,
    today: data.day, now })
}

// Fold, der først læser L3, når den åbnes. Atleten genbruger ugerne fra L4.
export default function BlocksView({ client, athleteId, now, source = 'coach', foldProps = {}, summaryStyle }) {
  const today = calendarDay(now ?? new Date())
  const [open, setOpen] = React.useState(false)
  const [data, setData] = React.useState(null)
  React.useEffect(() => {
    if (!open || !client || !athleteId || !today) return undefined
    let live = true
    setData(null)
    const load = source === 'athlete'
      ? readAthleteU3Shared(client, athleteId, today).then(l4 => readBlocks(client, athleteId, today, { weeks: l4.weeks }))
      : readBlocks(client, athleteId, today)
    load.then(result => { if (live) setData(result) }, () => { if (live) setData({ day: today, weeks: { state: 'unknown' } }) })
    return () => { live = false }
  }, [open, client, athleteId, today, source])
  const model = data && data.day === today ? blocksFromRead(data, now ?? new Date()) : null
  return h('details', { ...foldProps, 'data-u3-blocks-fold': source,
    onToggle: event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open) } },
    h('summary', { style: summaryStyle ?? { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Blok for blok'),
    h('p', { style: { ...small, lineHeight: 1.5, textAlign: 'left' } }, 'Styrke og træning blok mod blok.'),
    open && (!model ? h('p', { role: 'status', style: { textAlign: 'left' } }, 'Henter blokke…')
      : model.status === 'unknown' ? h('p', { role: 'status' }, 'Blokkene kunne ikke hentes.')
        : h(BlocksTable, { model, source })))
}

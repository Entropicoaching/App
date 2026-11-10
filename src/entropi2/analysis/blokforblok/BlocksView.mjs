import * as React from 'react'

// Hooks hentes via navnerummet: Analysis' lukkede prøveharness erstatter 'react'
// med en fixture, der kun har createElement. Komponenten monteres kun med U3-flaget.
const h = React.createElement
import { calendarDay } from '../../../calendarDate.js'
import { readBlocks } from './readBlocks.mjs'
import { readAthleteU3Shared } from '../../u3/readAthleteU3.mjs'
import { blocksModel } from './blocksModel.mjs'
import { formatNumber } from '../../u3/format.mjs'

const NOT_ENOUGH = 'ikke nok data'
const cell = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }
const head = { ...cell, position: 'sticky', left: 0, background: '#1c1c18', textAlign: 'left', fontWeight: 400, zIndex: 1 }
const arrow = change => change > 0 ? ` ↑${formatNumber(change)}` : change < 0 ? ` ↓${formatNumber(-change)}` : ' →0'

// Ren tabel. Manglende tal står som "ikke nok data", aldrig 0. Første kolonne er låst.
export function BlocksTable({ model }) {
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
  return h('div', { 'data-u3-blocks': true, style: { overflowX: 'auto', maxWidth: '100%', textAlign: 'left' } },
    h('table', { style: { borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '100%' } },
      h('thead', null, h('tr', null, h('th', { style: head, scope: 'col' }, ''),
        ...blocks.map((b, i) => h('th', { key: i, scope: 'col', style: { ...cell, fontWeight: 600 } }, b.current ? 'Nu' : b.name)))),
      h('tbody', null, ...rows.map(([label, render]) => h('tr', { key: label },
        h('th', { scope: 'row', style: head }, label),
        ...blocks.map((b, i) => h('td', { key: i, style: cell }, render(b))))))),
    h('p', { style: { lineHeight: 1.6, opacity: 0.8, textAlign: 'left' } },
      `${blocks.map(b => `${b.current ? 'Nu' : b.name}: ${b.light ? 'let blok, ' : ''}${b.completedWeeks} ${b.completedWeeks === 1 ? 'afsluttet uge' : 'afsluttede uger'}`).join(' · ')}. e1RM er bedste tunge sæt i blokken. Vægt er snittet af blokkens sidste 7 dage.`))
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
    h('p', { style: { lineHeight: 1.6, opacity: 0.8, textAlign: 'left' } }, 'Bedste e1RM, pas, sæt, vægt og readiness for de seneste op til 4 programblokke.'),
    open && (!model ? h('p', { role: 'status', style: { textAlign: 'left' } }, 'Henter blokke…')
      : model.status === 'unknown' ? h('p', { role: 'status' }, 'Blokkene kunne ikke hentes.')
        : h(BlocksTable, { model })))
}

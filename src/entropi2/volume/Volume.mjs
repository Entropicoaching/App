import { createElement as h } from 'react'
import { volumeModel, formatSets, weekLabel } from './volumeModel.mjs'

const text = { lineHeight: 1.6, color: '#d2cfc6' }
const cell = { padding: '12px 6px', borderBottom: '1px solid #414139', verticalAlign: 'top', overflowWrap: 'anywhere' }

// Integration explicitly opts in; importing or rendering OFF has no side effects.
export default function Volume(props = {}) {
  if (props.entropi2 !== true) return null
  const model = volumeModel(props)
  return h('section', { 'aria-label': 'Din volumen', 'data-entropi2-volume': true,
    style: { width: '100%', maxWidth: 480, minWidth: 0, boxSizing: 'border-box', padding: 16,
      color: '#edeae2', background: '#141410', overflowWrap: 'anywhere', fontFamily: "'IBM Plex Sans', Arial, sans-serif", fontSize: 16 } },
  h('h1', { style: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, margin: '0 0 12px' } }, 'Din volumen'),
  model.state !== 'ready'
    ? h('p', { role: model.state === 'error' ? 'alert' : 'status', style: text }, model.message)
    : h('div', null,
      h('p', { style: text }, 'Sæt pr. muskelgruppe'),
      h('p', { style: text }, `Denne uge: ${weekLabel(model.current.uge)}. Sidste uge: ${weekLabel(model.previous.uge)}.`),
      h('p', { style: text }, 'Denne uge er stadig i gang.'),
      model.empty && h('p', { role: 'status', style: text }, 'Du har ikke gennemført sæt i disse to uger endnu. Når du logger, vises din volumen her.'),
      model.rows.length > 0 && h('table', { style: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 16 } },
        h('caption', { style: { textAlign: 'left', padding: '8px 0', ...text } }, 'Gennemførte sæt · vægtet'),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', style: { ...cell, width: '44%', textAlign: 'left' } }, 'Muskelgruppe'),
          h('th', { scope: 'col', style: { ...cell, width: '28%', textAlign: 'right' } }, 'Denne uge'),
          h('th', { scope: 'col', style: { ...cell, width: '28%', textAlign: 'right' } }, 'Sidste uge'))),
        h('tbody', null, ...model.rows.map(row => h('tr', { key: row.key },
          h('th', { scope: 'row', style: { ...cell, fontWeight: 400, textAlign: 'left' } }, row.label),
          h('td', { style: { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 } }, formatSets(row.current)),
          h('td', { style: { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#d2cfc6' } }, formatSets(row.previous)))))),
      ...[[model.current, 'denne uge'], [model.previous, 'sidste uge']].filter(([week]) => week.ukendteSaet > 0).map(([week, label]) =>
        h('p', { key: week.uge, style: { ...text, color: '#e0bb7a' } }, `${week.ukendteSaet} sæt ${label} er ikke knyttet til en muskelgruppe og tælles derfor ikke med i tabellen.`)),
      h('details', null,
        h('summary', { style: { minHeight: 44, padding: '12px 0', boxSizing: 'border-box', cursor: 'pointer', lineHeight: 1.5 } }, 'Sådan tælles det'),
        h('p', { style: text }, 'Kun gennemførte sæt tælles. Ugerne går fra mandag til søndag. Et sæt tæller som 1 for en primær muskelgruppe og 0,5 for en medvirkende gruppe. Samme sæt kan bidrage til flere grupper.'),
        h('p', { style: text }, 'Beregnet ud fra standard-øvelseskort. Tallene viser træningsmængde, ikke vægt eller belastning. 0 betyder ingen registrerede sæt for gruppen i den uge.'))))
}

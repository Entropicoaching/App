import { createElement as h } from 'react'

// Read the same projected meals as the cards, without deriving intake or times.
// The caller keys this native disclosure to the approved athlete/day/revision.
export default function MealDayOverview({ meals, readOnly = false, uncertain = false }) {
  if (!meals?.length) return null
  const statuses = meals.map(meal => readOnly ? 'Planlagt · kun læsning'
    : meal.eaten ? 'Spist' : meal.blocked || uncertain ? 'Registrering uafklaret' : 'Ikke registreret')
  const count = status => statuses.filter(value => value === status).length
  const progress = readOnly
    ? `${meals.length} ${meals.length === 1 ? 'planlagt måltid' : 'planlagte måltider'} · kun læsning`
    : `Registreringer · Spist: ${count('Spist')} · Ikke registreret: ${count('Ikke registreret')} · Registrering uafklaret: ${count('Registrering uafklaret')}`
  return h('div', { style: { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } },
    h('details', { style: { minWidth: 0, marginTop: 16, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, boxSizing: 'border-box', paddingBlock: 12,
      cursor: 'pointer', font: 'inherit', whiteSpace: 'normal' } }, 'Dagens måltider i overblik'),
    h('ol', { style: { minWidth: 0, paddingInlineStart: 24 } },
      ...meals.map((meal, index) => h('li', { key: meal.id, style: { minWidth: 0, marginBlock: 8 } },
        h('span', { style: { whiteSpace: 'pre-wrap' } }, meal.name),
        ' · ', h('span', null, statuses[index]))))),
    h('p', { role: 'status', style: { marginBlock: 8, whiteSpace: 'normal' } }, progress))
}

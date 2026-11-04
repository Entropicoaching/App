import { createElement as h } from 'react'
import { exerciseHistory, historyNumber as n, historyEstimate as estimate } from './exerciseHistory.mjs'

function Curve({ points }) {
  const min = Math.min(...points.map(p => p.e1rm)), max = Math.max(...points.map(p => p.e1rm))
  const start = Date.parse(points[0].day), end = Date.parse(points.at(-1).day)
  const coordinates = points.map(p => ({ ...p,
    x: end === start ? 160 : 36 + (Date.parse(p.day) - start) / (end - start) * 248,
    y: max === min ? 70 : 108 - (p.e1rm - min) / (max - min) * 76 }))
  return h('figure', { style: { margin: 0 } },
    h('figcaption', null, 'Estimeret 1RM (kg) – bedste sæt pr. vist dag'),
    h('svg', { viewBox: '0 0 320 150', role: 'img',
      'aria-label': `Estimeret 1RM: ${points.map(p => `${p.date}: ${estimate(p.e1rm)} kg`).join('; ')}`,
      style: { display: 'block', width: '100%', maxWidth: 520, height: 'auto', color: '#f5f5ee' } },
    h('line', { x1: 36, y1: 112, x2: 284, y2: 112, stroke: 'currentColor' }),
    h('text', { x: 4, y: 24, fill: 'currentColor', fontSize: 12 }, `${estimate(max)} kg`),
    min !== max ? h('text', { x: 4, y: 106, fill: 'currentColor', fontSize: 12 }, `${estimate(min)} kg`) : null,
    points.length > 1 ? h('polyline', { points: coordinates.map(p => `${p.x},${p.y}`).join(' '),
      fill: 'none', stroke: '#d7e4aa', strokeWidth: 2 }) : null,
    ...coordinates.map(p => h('circle', { key: p.day, cx: p.x, cy: p.y, r: 4, fill: '#d7e4aa' })),
    h('text', { x: 36, y: 138, fill: 'currentColor', fontSize: 11 }, points[0].day),
    points.length > 1 ? h('text', { x: 284, y: 138, textAnchor: 'end', fill: 'currentColor', fontSize: 11 }, points.at(-1).day) : null),
    points.length === 1 ? h('p', null, 'Én træningsdag endnu. Kurven kræver mindst to dage.') : null)
}

// Standalone content for a future Sidst panel. No route, dialog, fetch or writes.
// enabled must be exactly true. Caller handles opening/closing and identity reset.
export default function ExerciseHistoryView(props = {}) {
  if (props.enabled !== true) return null
  const model = exerciseHistory(props)
  return h('section', { 'aria-label': 'Øvelseshistorik', 'data-e2-exercise-history': '',
    style: { minWidth: 0, maxWidth: '100%', padding: 16, borderRadius: 12,
      color: '#f5f5ee', background: '#1c1c18', overflowWrap: 'anywhere', boxSizing: 'border-box' } },
    h('h2', null, 'Øvelseshistorik'),
    h('p', null, typeof props.exerciseName === 'string' ? props.exerciseName : 'Øvelse'),
    model.status === 'error' ? h('p', { role: 'alert' }, model.message) :
    model.status === 'empty' ? h('p', null, 'Ingen bekræftede tunge sæt at vise for denne øvelse endnu.') :
    h('div', { style: { display: 'grid', gap: 16 } },
      h('div', null, h('h3', null, 'Seneste tunge sæt'),
        h('ol', { style: { margin: 0, paddingLeft: 24 } }, ...model.sets.map((s, i) =>
          h('li', { key: i, style: { paddingBlock: 6, lineHeight: 1.5 } },
            h('time', { dateTime: s.day }, s.date), ' · ',
            `${n(s.weight)} kg × ${s.reps} @ ${s.rpe == null ? 'RPE ikke angivet' : `RPE ${n(s.rpe)}`}`)))),
      h(Curve, { points: model.curve }),
      h('details', null, h('summary', { style: { minHeight: 44, paddingBlock: 10, boxSizing: 'border-box', cursor: 'pointer' } }, 'Om historikken'),
        h('p', null, 'Op til otte seneste bekræftede sæt, nyeste først. Tunge sæt har 1–8 reps; lette sæt og deload er udeladt. Kun denne øvelses id vises.'),
        h('p', null, 'Estimeret 1RM beregnes med Epley: kg × (1 + reps / 30). Det er et skøn, ikke et testet maksimum. Afstanden mellem datoer følger kalenderen.'))),
    model.omitted > 0 ? h('p', null, 'Sæt med ugyldige eller fremtidige værdier er udeladt.') : null)
}

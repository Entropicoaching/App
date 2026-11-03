import { createElement as h } from 'react'
import { weeklyReportModel } from './weeklyReportModel.mjs'

export default function WeeklyReport({ today, ...props }) {
  const model = weeklyReportModel(props, today)
  if (!model.ready || !model.rows.length) return null
  return h('section', { 'aria-label': 'Ugerapport pr. atlet' },
    h('h2', null, 'Ugerapport'),
    h('p', null, 'Træning: aktuel programuge til i dag. Et pas tælles én gang, når mindst ét sæt er logget uden at være sprunget over. Kost: seneste 7 dage til og med i dag.'),
    h('ul', { style: { listStyle: 'none', padding: 0 } }, ...model.rows.map(({ athlete, training: t, nutrition: n }) =>
      h('li', { key: athlete.id, 'data-coach-weekly-report': athlete.id, style: { marginBlock: 16 } },
        h('h3', null, athlete.name),
        h('p', null, t.start ? `Programuge fra ${t.start}` : 'Programuge: ukendt'),
        h('p', null, `Pas logget: ${t.completed ?? 'ukendt'} af ${t.planned ?? 'ukendt'} planlagte`),
        h('p', null, t.rpe === null ? 'Seneste pas · RPE-snit: ukendt' :
          `Seneste pas · RPE-snit: ${t.rpe.toFixed(1).replace('.', ',')} (${t.rpeCount} sæt med RPE)`),
        h('p', null, `Kostdage logget: ${n ? `${n.logged}/7` : 'ukendt'}`),
        h('p', null, !n ? 'Proteinmål nået: ukendt' : n.reached === null ? 'Proteinmål: ikke angivet' :
          `Proteinmål nået: ${n.reached} af ${n.logged} loggede dage`)))))
}

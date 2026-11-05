import { antalOrd } from '../antalOrd.mjs'
import { createElement as h } from 'react'
import { weeklyReportModel, hasWeeklyReportData } from './weeklyReportModel.mjs'

const displayDate = day => day.split('-').reverse().join('.')

export default function WeeklyReport({ today, ...props }) {
  const model = weeklyReportModel(props, today)
  const rows = model.rows.filter(hasWeeklyReportData)
  if (!model.ready || !rows.length) return null
  return h('section', { 'aria-label': 'Ugerapport pr. atlet' },
    h('h2', null, 'Ugerapport'),
    h('p', null, 'Træning: aktuel programuge til i dag. Et pas tælles én gang, når mindst ét sæt er logget uden at være sprunget over. Kost: seneste 7 dage til og med i dag.'),
    h('ul', { style: { listStyle: 'none', padding: 0 } }, ...rows.map(({ athlete, training: t, nutrition: n }) =>
      h('li', { key: athlete.id, 'data-coach-weekly-report': athlete.id, style: { marginBlock: 16 } },
        h('h3', null, athlete.name),
        t.start && h('p', null, 'Programuge fra ', h('time', { dateTime: t.start }, displayDate(t.start))),
        t.completed !== null ? h('p', null, t.planned !== null
          ? `Pas logget: ${t.completed} af ${t.planned} ${antalOrd(t.planned, 'planlagt', 'planlagte')}` : `Pas logget: ${t.completed}`) :
          t.planned !== null && h('p', null, `Pas planlagt: ${t.planned}`),
        t.rpe !== null && h('p', null,
          `Seneste pas · RPE-snit: ${t.rpe.toFixed(1).replace('.', ',')} (${t.rpeCount} sæt med RPE)`),
        n && h('p', null, `Kostdage logget: ${n.logged}/7`),
        n && n.reached !== null && h('p', null,
          `Proteinmål nået: ${n.reached} af ${n.logged} ${antalOrd(n.logged, 'logget dag', 'loggede dage')}`)))))
}

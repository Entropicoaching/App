import { createElement as h } from 'react'
import { weekPlanModel } from './weekPlanModel.mjs'
import { weekPlanStyles as s } from './weekPlanStyles.mjs'

// Opt-in, read-only and deliberately unwired. Caller owns week selection/clock.
export default function WeekPlan(props = {}) {
  if (props.enabled !== true) return null
  const model = weekPlanModel(props)
  return h('section', { lang: 'da', style: s.section, 'aria-label': 'Ugens plan', 'data-entropi2-week-plan': '' },
    h('h2', { style: s.heading }, 'Ugens plan'),
    model.state !== 'ready' ? h('p', { style: s.message, role: 'status' },
      model.state === 'empty' ? 'Ingen pas planlagt i denne uge.' : 'Ugens plan er ikke tilgængelig endnu.') :
      h('ul', { style: s.list }, ...model.rows.map(row =>
        h('li', { key: row.key, style: s.row },
          row.date ? h('time', { dateTime: row.date, style: s.day }, row.day) : h('span', { style: s.day }, row.day),
          h('span', { style: s.name, title: row.title }, row.title),
          h('span', { style: row.status === 'done' ? s.done : s.status,
            'aria-label': row.detail ? `${row.label} · ${row.detail}` : undefined,
            title: row.detail ?? undefined }, row.label)))))
}

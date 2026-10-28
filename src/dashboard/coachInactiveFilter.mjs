import { createElement as h, useState, useEffect } from 'react'
import { inactiveTraining } from './coachInactive.mjs'
const style = { minHeight: 44, padding: '0.5rem', border: '1px solid #575044', background: '#1c1c18', color: '#edeae2', cursor: 'pointer', font: 'inherit', overflowWrap: 'anywhere' }
export function CoachInactiveFilter({ enabled, athletes, source, loading, hasError, today, openProfile, children }) {
  const [filtered, setFiltered] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (enabled !== true || !source || today !== undefined) return
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [enabled, !!source, today])
  // Template messages can enable the parent independently of activity reads.
  if (enabled !== true || !source) return children
  const model = inactiveTraining({ enabled, athletes, source, loading, hasError, today: today ?? now })
  return h('div', { 'data-coach-inactive': true },
    h('div', { role: 'group', 'aria-label': 'Filtrer dagslisten', style: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' } },
      h('button', { type: 'button', style, 'aria-pressed': !filtered, onClick: () => setFiltered(false) }, 'Alle handlinger'),
      h('button', { type: 'button', style, 'aria-pressed': filtered, onClick: () => setFiltered(true) }, 'Ikke trænet i 3 dage')),
    !filtered ? children : h('div', null,
      h('p', null, 'Viser indlæste data. Nye pas vises efter genindlæsning.'),
      h('p', { role: 'status' }, `${model.rows.length} atleter med mindst 3 kalenderdage siden sidste loggede pas. ${model.noSessions} uden registrerede pas. ${model.unknown} med ukendt historik.`),
      !model.rows.length && h('p', null, 'Ingen atleter med bekræftet fravær på mindst 3 dage.'),
      h('ul', { style: { listStyle: 'none', padding: 0 } }, ...model.rows.map(row => h('li', { key: row.athlete.id },
        h('button', { type: 'button', style: { ...style, width: '100%', textAlign: 'left' }, onClick: () => openProfile(row.athlete, 'log', 'list') },
          `${row.athlete.name}: ${row.days} dage siden sidste pas (${row.lastDay})`))))))
}

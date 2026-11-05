import { createElement as h } from 'react'

const control = { minHeight: 44, maxWidth: '100%', boxSizing: 'border-box' }
export default function ProgramTemplatesView({ weeks, libraryState = 'idle', sourceId, name, library, draft, error, message, onSource, onName, onCreate, onUse, onSave }) {
  const ready = libraryState === 'ready'
  return h('section', { 'aria-label': 'Programskabeloner' },
    h('p', null, 'Lokale skabeloner for denne atlet i denne browser. Gemmer kun udkast; atletens ugeplan ændres ikke.'),
    weeks.length === 0 ? h('p', { role: 'status' }, 'Ingen uger at oprette en skabelon fra.') : h('div', null,
      h('label', null, 'Kildeuge ', h('select', { value: sourceId, style: control, onChange: e => onSource(e.target.value) },
        h('option', { value: '' }, 'Vælg uge'), ...weeks.map(w => h('option', { key: w.id, value: String(w.id) }, `Uge ${w.week_number}`)))),
      h('label', { style: { display: 'block' } }, 'Skabelonnavn ', h('input', { value: name, maxLength: 120, style: control, onChange: e => onName(e.target.value) })),
      h('button', { type: 'button', style: control, disabled: !ready || !sourceId || !name.trim() || library.length >= 25, onClick: onCreate }, 'Gem som skabelon')),
    !ready ? libraryState !== 'error' && h('p', { role: 'status' }, 'Henter skabeloner…') : library.length === 0 ? h('p', { role: 'status' }, 'Ingen gemte skabeloner.') : h('ul', null,
      ...library.map((template, i) => h('li', { key: i }, template.name, ' ',
        h('button', { type: 'button', style: control, onClick: () => onUse(template) }, 'Brug som udkast')))),
    ready && draft && h('section', { 'aria-label': 'Programudkast' }, h('h3', null, draft.name),
      h('p', null, 'Forhåndsvisning. Ingen datoer, vægte eller atletdata er kopieret.'),
      ...draft.weeks.map(week => h('div', { key: week.weekNumber }, h('h4', null, `Uge ${week.weekNumber}`),
        ...week.sessions.map((session, i) => h('div', { key: i }, h('p', null, `${session.name} · ${['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'][session.dayOfWeek - 1]}`),
          h('ul', null, ...session.exercises.map((exercise, j) => h('li', { key: j }, `${exercise.name}: `,
            exercise.sets.map(set => `${set.reps} ${set.reps === 1 ? 'gentagelse' : 'gentagelser'}${set.rpe === null ? '' : ` · mål-RPE ${String(set.rpe).replace('.', ',')}`}`).join(', ')))))))),
      h('button', { type: 'button', style: control, onClick: onSave }, 'Gem programudkast lokalt')),
    error && h('p', { role: 'alert' }, error),
    message && h('p', { role: 'status' }, message))
}

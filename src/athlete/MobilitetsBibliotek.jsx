import { createElement as h, useState } from 'react'
import { FOCUS_LIFTS } from './mobilityFocus.mjs'
import { mobilityLibrary, exercisePicture, MARC_TEXT } from './mobilityLibrary.mjs'

const button = { minHeight: 48, padding: '12px 14px', border: '1px solid #736043', borderRadius: 8, background: '#24231d', color: '#edeae2', font: 'inherit', textAlign: 'left', cursor: 'pointer', whiteSpace: 'normal', overflowWrap: 'anywhere' }
export default function MobilitetsBibliotek({ library, onExit }) {
  const [lift, setLift] = useState('Squat')
  const groups = mobilityLibrary(lift, library)
  return h('section', { 'aria-label': 'Øvelsesbibliotek til hovedløft', style: { width: '100%', minWidth: 0, color: '#edeae2', lineHeight: 1.6, overflowWrap: 'anywhere' } },
    h('button', { type: 'button', style: button, onClick: onExit }, 'Tilbage til mit fokus'),
    h('h1', null, 'Øvelsesbibliotek'),
    h('div', { role: 'group', 'aria-label': 'Vælg hovedløft', style: { display: 'grid', gap: 8 } },
      ...FOCUS_LIFTS.map(name => h('button', { key: name, type: 'button', 'aria-pressed': name === lift, onClick: () => setLift(name), style: { ...button, borderColor: name === lift ? '#e0ae5c' : '#736043' } }, name))),
    h('h2', null, lift),
    groups.length ? groups.map(group => h('section', { key: group.title, 'aria-label': group.title },
      h('h3', null, group.title),
      h('p', null, MARC_TEXT),
      ...group.exercises.map(exercise => h('article', { key: exercise.id, style: { padding: 16, marginBottom: 12, border: '1px solid #736043', borderRadius: 8, minWidth: 0 } },
        h('h4', null, exercise.name),
        h('figure', { style: { margin: 0 } }, exercisePicture(h, exercise), h('figcaption', null, 'Skematisk billede')),
        h('p', null, exercise.explanation),
        h('p', null, exercise.label)))))
      : h('p', { role: 'status' }, 'Ingen øvelser til dette løft i biblioteket.'))
}

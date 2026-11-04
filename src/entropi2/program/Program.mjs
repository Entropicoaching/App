import { createElement as h } from 'react'
import { programModel } from './programModel.mjs'

const card = { padding: 16, margin: '0 0 16px', border: '1px solid #777267', borderRadius: 12, background: '#1c1c18' }
const muted = { color: '#c4c0b5', margin: '8px 0', lineHeight: 1.6 }

// Assembly supplies only currentWeek and its existing loading/error state.
// Explicit OFF returns before reading any program props. No new data reader.
export default function Program(props = {}) {
  if (props.enabled !== true) return null
  const model = props.loading || props.programError ? null : programModel(props.currentWeek)
  const message = props.loading ? 'Indlæser dit program…'
    : props.programError ? 'Programmet kunne ikke vises. Prøv igen fra den eksisterende programfane.'
      : model.kind === 'missing' ? 'Du har ikke et program endnu. Din coach giver dig besked, når det er klar.'
        : model.kind === 'incomplete' ? 'Ugens pas er ikke tilgængelige endnu.'
          : model.kind === 'empty' ? 'Ingen pas planlagt i denne uge.' : null
  return h('section', { 'data-entropi2-program': '', 'aria-label': 'Ugens program',
    style: { boxSizing: 'border-box', width: '100%', minWidth: 0, maxWidth: 760, margin: '0 auto', padding: 16,
      color: '#edeae2', background: '#141410', overflowWrap: 'anywhere', lineHeight: 1.5 } },
    h('h1', { style: { fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: '0 0 16px' } }, 'Dit program'),
    message ? h('p', { role: props.programError ? 'alert' : 'status', style: muted }, message)
      : h('div', null,
        h('p', { style: muted }, model.label),
        model.block && h('p', { style: muted }, model.block),
        model.note && h('p', { style: muted }, `Fra din coach: ${model.note}`),
        ...model.sessions.map((session, index) => h('article', { key: index, style: card },
          h('p', { style: { ...muted, marginTop: 0 } }, session.day),
          h('h2', { style: { fontSize: '1.2rem', margin: '8px 0 16px' } }, session.title),
          session.kind === 'incomplete' ? h('p', { style: muted }, 'Øvelserne er ikke tilgængelige endnu.')
            : session.kind === 'rest' ? h('p', { style: muted }, 'Ingen øvelser planlagt i dette pas.')
              : h('ol', { style: { margin: 0, paddingInlineStart: 24 } },
                ...session.exercises.map((ex, exIndex) => h('li', { key: exIndex, style: { padding: '8px 0' } },
                  h('h3', { style: { fontSize: '1rem', margin: '0 0 4px' } }, ex.name),
                  h('p', { style: muted }, [ex.sets, ex.reps && `Gentagelser / tid: ${ex.reps}`].filter(Boolean).join(' · ')),
                  h('p', { style: muted }, `Mål: ${[ex.intensity, ex.weight].filter(Boolean).join(' · ') || 'Ikke angivet'}`),
                  ex.note && h('p', { style: muted }, `Coach: ${ex.note}`))))))))
}

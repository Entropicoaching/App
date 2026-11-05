import { createElement as h, useId, useState } from 'react'
import { COMMENT_LIMIT, clearDraft, draftKey, emptyDraft, loadDraft, saveDraft, validDraft } from './weeklyDraft.mjs'

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: 20, boxSizing: 'border-box',
    background: '#1c1c18', color: '#edeae2', fontFamily: "'IBM Plex Sans', Arial, sans-serif", overflowWrap: 'anywhere' },
  title: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28 },
  field: { display: 'grid', gap: 8, marginBottom: 20 },
  input: { minHeight: 48, width: '100%', boxSizing: 'border-box', padding: 12,
    font: 'inherit', color: '#edeae2', background: '#262621', border: '1px solid #929083', borderRadius: 8 },
  button: { minHeight: 48, minWidth: 48, padding: '12px 20px', font: 'inherit',
    border: '1px solid #929083', borderRadius: 8, cursor: 'pointer' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  text: { lineHeight: 1.5 },
}
const scoreFields = [
  ['energy', 'Energi', 1, 5, '1 = meget lav energi · 5 = meget høj energi'],
  ['stress', 'Stress', 1, 5, '1 = meget lidt stress · 5 = meget høj stress'],
  ['pain', 'Smerte', 0, 10, '0 = ingen smerte · 10 = værst tænkelige smerte'],
]

// The host must explicitly enable and supply an authorized athlete id and the
// Monday of the selected week. No flag, identity, clock or backend is read here.
export default function WeeklyCheckIn({ enabled = false, athleteId, weekStart, storage, showHeading = true } = {}) {
  if (enabled !== true) return null
  const key = draftKey(athleteId, weekStart)
  if (!key) return h('p', { role: 'status' }, 'Vælg en atlet og en gyldig uge for at åbne check-in.')
  // A changed athlete/week remounts the inner form, preventing draft leakage.
  return h(ScopedDraft, { key, draftStorageKey: key, weekStart, storage, showHeading })
}

function ScopedDraft({ draftStorageKey, weekStart, storage, showHeading }) {
  const id = useId()
  const [state, setState] = useState(() => ({ ...loadDraft(draftStorageKey, storage), storage }))
  // React retries this render with the new adapter before committing children.
  if (state.storage !== storage) {
    setState({ ...loadDraft(draftStorageKey, storage), storage })
    return null
  }
  const { draft, status } = state
  const update = (field, value) => {
    const next = { ...draft, [field]: value }
    const saved = validDraft(next) && saveDraft(draftStorageKey, next, storage)
    setState({ draft: next, status: saved ? 'saved' : validDraft(next) ? 'unavailable' : 'invalid', storage })
  }
  const submit = event => {
    event.preventDefault()
    const saved = validDraft(draft) && saveDraft(draftStorageKey, draft, storage)
    setState({ ...state, status: saved ? 'saved' : validDraft(draft) ? 'unavailable' : 'invalid' })
  }
  const clear = () => {
    if (clearDraft(draftStorageKey, storage)) setState({ draft: emptyDraft(), status: 'cleared', storage })
    else setState({ ...state, status: 'clear-failed' })
  }
  const label = (name, title, hint, input) => h('div', { key: name, style: styles.field },
    h('label', { htmlFor: `${id}-${name}` }, title),
    h('small', { id: `${id}-${name}-hint`, style: styles.text }, hint), input)
  const inputProps = name => ({ id: `${id}-${name}`, name, value: draft[name], style: styles.input,
    'aria-describedby': `${id}-${name}-hint`, onChange: event => update(name, event.target.value) })
  const message = status === 'saved' ? 'Kladde gemt på denne enhed. Intet er sendt til din coach.'
    : status === 'unavailable' ? 'Kladden kunne ikke læses eller gemmes på enheden. Dine ændringer bliver kun her, mens formularen er åben. Prøv Gem kladde igen.'
      : status === 'invalid' ? 'Tjek felternes intervaller. Ændringerne er ikke gemt.'
        : status === 'clear-failed' ? 'Kladden kunne ikke slettes fra enheden. Dine svar er bevaret. Prøv igen.'
          : status === 'cleared' ? 'Kladden er slettet fra denne enhed.' : 'Ingen kladde gemt endnu.'
  return h('section', { style: styles.page,
    'aria-labelledby': showHeading ? `${id}-title` : undefined,
    'aria-label': showHeading ? undefined : 'Ugentligt check-in' },
    showHeading && h('h2', { id: `${id}-title`, style: styles.title }, 'Ugentligt check-in'),
    h('p', { style: styles.text }, `Ugen fra ${weekStart.split('-').reverse().join('.')}. Tænk på ugen som helhed.`),
    h('p', { style: styles.text }, 'Alle felter er valgfrie. Svar gemmes automatisk som kladde på denne enhed. De deles ikke med din coach. På en delt enhed kan andre have adgang til kladden.'),
    h('form', { onSubmit: submit },
      label('sleep', 'Søvn (timer pr. nat)', 'Dit gennemsnit for ugen · 0–24 timer i halve timer.',
        h('input', { ...inputProps('sleep'), type: 'number', min: 0, max: 24, step: 0.5, inputMode: 'decimal' })),
      ...scoreFields.map(([name, title, min, max, hint]) => label(name, title, hint,
        h('select', inputProps(name), h('option', { value: '' }, 'Ikke besvaret'),
          ...Array.from({ length: max - min + 1 }, (_, index) => {
            const value = String(min + index)
            return h('option', { key: value, value }, value)
          })))),
      label('comment', 'Kommentar', `Valgfrit · højst ${COMMENT_LIMIT} tegn.`,
        h('textarea', { ...inputProps('comment'), maxLength: COMMENT_LIMIT, rows: 4 })),
      h('p', { role: 'status', 'aria-live': 'polite', style: styles.text }, message),
      h('div', { style: styles.actions },
        h('button', { type: 'submit', style: styles.button }, 'Gem kladde'),
        h('button', { type: 'button', style: styles.button, onClick: clear }, 'Slet kladde'))))
}

import { readHomework } from '../mobilityHomework.mjs'

export function compactHomeworkEnabled(homework, compact) {
  return homework === true && compact === true
}

// Read the existing athlete-scoped assignment. Never write or derive warmup steps.
export function renderHomeworkEntry(h, { enabled = false, athleteId, storage, onOpen }) {
  if (enabled !== true) return null
  const result = readHomework(athleteId, storage)
  const count = result?.value?.exerciseIds.length || 0
  if (!count && !result.error) return null
  const label = !result.error ? `Hjemmeøvelser fra din coach (${count})` : 'Hjemmeøvelser fra din coach'
  return h('button', { type: 'button', onClick: onOpen, 'aria-label': label,
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      boxSizing: 'border-box', width: '100%', minWidth: 0, height: 56, minHeight: 56,
      margin: '0 0 12px', padding: '0 12px', border: '1px solid #736043', borderRadius: 8,
      background: '#1c1c18', color: '#edeae2', font: 'inherit', fontSize: 12, lineHeight: '16px', cursor: 'pointer' } },
    h('span', { style: { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, label),
    h('span', { 'aria-hidden': true }, '→'))
}

export function renderHomeworkHome(h, { compact = false, tab, enkelOn, route, enabled, athleteId, storage, onOpen, Home }) {
  if (tab !== 'hjem' || (enkelOn && !['traening', 'alle'].includes(route))) return null
  if (compact === true) return renderHomeworkEntry(h, { enabled, athleteId, storage, onOpen })
  return h(Home, { key: athleteId, enabled, athleteId, ...(storage === undefined ? {} : { storage }) })
}

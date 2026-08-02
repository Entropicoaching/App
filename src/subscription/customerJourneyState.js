// Pure UI-state helpers for the local customer journey. Keeping these rules
// outside React makes the set hierarchy testable without treating the browser
// demo as a source of truth for training data.

export function customerSetPresentationState({ index, activeIndex, confirmed }) {
  if (confirmed?.[index]) return 'logged'
  if (index === activeIndex) return 'active'
  return 'upcoming'
}

// After logging a set, return to the earliest unfinished set. This makes an
// athlete opening a later set first recoverable instead of hiding earlier work.
export function nextUnconfirmedSetIndex(totalSets, confirmed, completedIndex) {
  for (let index = 0; index < totalSets; index += 1) {
    if (index !== completedIndex && !confirmed?.[index]) return index
  }
  return null
}

export function isCustomerSessionReady(rows, confirmed, validate) {
  if (!Array.isArray(rows) || typeof validate !== 'function') return false
  return rows.every((row, index) => confirmed?.[index] && validate(row).ok)
}

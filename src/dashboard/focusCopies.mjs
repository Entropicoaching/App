// Keyboard and focus behavior only. No storage, network or program updates.
export function activateOnKey(event) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) event.currentTarget.click()
}

export function searchKeys(event, setOpen, pending) {
  if (event.key === 'Escape') {
    pending.current = false
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.querySelector('input')?.focus()
    setOpen(false)
  } else if (event.key === 'ArrowDown' && event.target.tagName === 'INPUT') {
    event.preventDefault()
    pending.current = true
    setOpen(true)
    const first = event.currentTarget.querySelector('[role="button"]')
    if (first) {
      pending.current = false
      first.focus()
    }
  }
}

export function leaveSearch(event, setOpen) {
  if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
}

export function selectSearchOption(event, select) {
  // Focus a surviving input before the focused option is removed.
  event.currentTarget.closest('[data-exercise-search]')?.querySelector('input')?.focus()
  select()
}

export function focusSearchList(node, pending) {
  if (!node || !pending.current) return
  pending.current = false
  const input = node.closest('[data-exercise-search]')?.querySelector('input')
  if (input && node.ownerDocument.activeElement === input) {
    node.querySelector('[role="button"]')?.focus()
  }
}

export function cancelRecommended(setEditing, pending, id) {
  pending.current = id
  setEditing(null)
}

export function restoreRecommendedFocus(node, pending, id) {
  if (!node || pending.current !== id) return
  pending.current = null
  node.focus()
}

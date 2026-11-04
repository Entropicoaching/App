import { exerciseHistoryContent } from './exerciseHistoryContent.mjs'

const svgTags = new Set(['svg', 'line', 'text', 'polyline', 'circle'])
export function sessionHistoryProps(p, ex, now) {
  return { enabled: true, athleteId: p.athleteId, exerciseId: ex.id, exerciseName: ex.name,
    logs: p.exerciseLogs, now, pendingSyncKeys: p.pendingSyncKeys, parkedSets: p.parkedSets,
    error: p.exerciseLogsError, loading: p.exerciseLogsLoading }
}
// The same content factory as ExerciseHistoryView, rendered into this fold only.
export function historyElement(doc, tag, attrs, ...children) {
  const node = svgTags.has(tag) ? doc.createElementNS('http://www.w3.org/2000/svg', tag) : doc.createElement(tag)
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'key') continue
    if (key === 'style') Object.assign(node.style, value)
    else node.setAttribute(({ dateTime: 'datetime', fontSize: 'font-size', strokeWidth: 'stroke-width', textAnchor: 'text-anchor' })[key] || key, value)
  }
  // Unitless React styles need explicit CSS lengths in the native renderer.
  for (const [key, value] of Object.entries(attrs?.style || {}))
    if (typeof value === 'number' && value !== 0 && key !== 'lineHeight') node.style[key] = `${value}px`
  for (const child of children.flat()) {
    if (child == null || child === false) continue
    node.append(typeof child === 'string' || typeof child === 'number' ? doc.createTextNode(String(child)) : child)
  }
  return node
}

export function mountExerciseHistory(root, { detail, previous, read, active, open = false, aboutOpen = false }) {
  const doc = root.ownerDocument, fold = doc.createElement('details'), summary = doc.createElement('summary')
  fold.setAttribute('data-detail', detail)
  fold.setAttribute('data-exercise-history-fold', '')
  summary.textContent = previous || 'Sidst'
  summary.setAttribute('class', 'muted')
  if (previous) summary.setAttribute('data-last-set', read().exerciseId)
  fold.append(summary); root.append(fold)
  let content = null, dead = false
  function toggle() {
    if (dead || !root.contains(fold)) return
    content?.remove(); content = null
    if (!fold.open || !active()) return
    content = exerciseHistoryContent((...args) => historyElement(doc, ...args), read())
    const about = content.querySelector('details')
    if (about) { about.setAttribute('data-detail', `${detail}-about`); about.open = aboutOpen }
    fold.append(content)
  }
  fold.addEventListener('toggle', toggle)
  fold.open = open; toggle()
  return () => { dead = true; fold.removeEventListener('toggle', toggle); fold.remove() }
}

// Escape dismisses the innermost session layer and returns focus to its trigger.
export function closeExerciseHistory(body, focused) {
  const folds = [...body.querySelectorAll('[data-exercise-history-fold]')].filter(n => {
    if (!n.open) return false
    for (let parent = n.parentElement; parent && parent !== body; parent = parent.parentElement)
      if (parent.hidden || (parent.tagName?.toLowerCase() === 'details' && !parent.open)) return false
    return true
  })
  const fold = folds.find(n => n.contains(focused)) || folds.at(-1)
  if (!fold) return false
  fold.open = false
  fold.querySelector('summary')?.focus()
  return true
}

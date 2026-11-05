import { exerciseHistoryContent } from './exerciseHistoryContent.mjs'
import { exerciseHistory } from './exerciseHistory.mjs'

const svgTags = new Set(['svg', 'line', 'text', 'polyline', 'circle'])
export function sessionHistoryProps(p, ex, now) {
  return { enabled: true, athleteId: p.athleteId, exerciseId: ex.id, exerciseName: ex.name,
    logs: p.exerciseLogs, now, pendingSyncKeys: p.pendingSyncKeys, parkedSets: p.parkedSets,
    error: p.exerciseLogsError, loading: p.exerciseLogsLoading, onRetry: p.onRetryExerciseLogs }
}
// The same content factory as ExerciseHistoryView, rendered into this fold only.
export function historyElement(doc, tag, attrs, ...children) {
  const node = svgTags.has(tag) ? doc.createElementNS('http://www.w3.org/2000/svg', tag) : doc.createElement(tag)
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'key') continue
    if (key === 'onClick' && typeof value === 'function') node.addEventListener('click', value)
    else if (key === 'style') Object.assign(node.style, value)
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
  // No empty optional fold; errors/loading remain reachable and replace stale data.
  if (['off', 'empty'].includes(exerciseHistory(read()).status)) return () => {}
  const doc = root.ownerDocument, fold = doc.createElement('details'), summary = doc.createElement('summary')
  fold.setAttribute('data-detail', detail)
  fold.setAttribute('data-exercise-history-fold', '')
  summary.textContent = previous || 'Sidst'
  summary.setAttribute('class', 'muted')
  if (previous) summary.setAttribute('data-last-set', read().exerciseId)
  fold.append(summary); root.append(fold)
  let content = null, dead = false, pending = false, retryFailed = false, renderId = 0
  let failedLogs, failedError
  const live = () => !dead && root.contains(fold) && fold.open && active()
  async function retry() {
    if (!live() || pending) return
    const props = read()
    if (props.loading === true || typeof props.onRetry !== 'function') return
    pending = true; retryFailed = false
    toggle()
    const loadingFocus = content?.querySelector('[role="status"]')
    loadingFocus?.setAttribute('tabindex', '-1'); loadingFocus?.focus?.()
    try { retryFailed = (await props.onRetry()) === false }
    catch { retryFailed = true }
    finally {
      pending = false
      if (retryFailed) { const latest = read(); failedLogs = latest.logs; failedError = latest.error }
      if (live()) {
        const restoreFocus = doc.activeElement === loadingFocus
        toggle()
        // Keep keyboard focus local unless the athlete moved elsewhere meanwhile.
        if (restoreFocus) {
          const target = content?.querySelector('button') || content?.querySelector('h2') || root
          target.setAttribute('tabindex', '-1'); target.focus?.()
        }
      }
    }
  }
  function toggle() {
    if (dead || !root.contains(fold)) return
    const version = ++renderId
    content?.remove(); content = null
    if (!fold.open || !active()) return
    const props = read()
    if (retryFailed && !pending && (props.logs !== failedLogs || (failedError && !props.error))) retryFailed = false
    content = exerciseHistoryContent((...args) => historyElement(doc, ...args), {
      ...props, error: retryFailed || props.error, loading: pending || props.loading,
      onRetry: typeof props.onRetry === 'function' ? () => { if (version === renderId) return retry() } : undefined,
    })
    if (!content) { fold.remove(); return }
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

export function remainingRest(pause, now = Date.now()) {
  if (!Number.isFinite(pause?.startedAt) || !Number.isFinite(pause?.durationSeconds)) return 0
  return Math.max(0, Math.ceil(pause.durationSeconds - Math.max(0, now - pause.startedAt) / 1000))
}
export function watchRest(pause, update, clock = globalThis) {
  let id = null
  const tick = () => {
    const left = remainingRest(pause, clock.Date.now()); update(left)
    if (!left && id != null) { clock.clearInterval(id); id = null }
  }
  tick()
  if (remainingRest(pause, clock.Date.now()) > 0) id = clock.setInterval(tick, 250)
  return () => { if (id != null) clock.clearInterval(id); id = null }
}
export function bindDialog({ dialog, handle, close, trigger, dismiss, document }) {
  let start = null
  const hide = () => { if (dialog.open) dialog.close() }
  const cancel = event => { event.preventDefault(); hide() }
  const down = e => {
    start = null
    if (e.isPrimary && e.pointerType === 'touch') {
      start = { id: e.pointerId, x: e.clientX, y: e.clientY }
      handle.setPointerCapture(e.pointerId)
    }
  }
  const reset = () => { start = null }
  const up = e => {
    if (!start || start.id !== e.pointerId) return
    const dx = Math.abs(e.clientX - start.x), dy = e.clientY - start.y
    reset(); if (dy >= 60 && dy > dx) hide()
  }
  const keys = e => {
    if (e.key !== 'Tab') return
    const nodes = [...dialog.querySelectorAll('button, input, textarea, select, summary, [tabindex="0"]')].filter(n => {
      if (n.disabled || n.hidden) return false
      let child = n, parent = n.parentElement
      while (parent && parent !== dialog) {
        if (parent.hidden || (parent.tagName?.toLowerCase() === 'details' && !parent.open && child.tagName?.toLowerCase() !== 'summary')) return false
        child = parent; parent = parent.parentElement
      }
      return true
    })
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }
  const events = [[dialog, 'cancel', cancel], [dialog, 'close', dismiss], [dialog, 'keydown', keys],
    [close, 'click', hide], [handle, 'pointerdown', down], [handle, 'pointerup', up],
    [handle, 'pointercancel', reset], [handle, 'lostpointercapture', reset]]
  for (const [node, name, fn] of events) node.addEventListener(name, fn)
  dialog.showModal(); close.focus()
  return () => {
    for (const [node, name, fn] of events) node.removeEventListener(name, fn)
    hide(); if (trigger.isConnected) trigger.focus()
  }
}

// Native dialog supplies modal focus containment. Only its handle accepts swipes.
export function bindTrainingDialog({ dialog, handle, close, trigger, dismiss }) {
  let start = null
  const hide = () => dialog.close()
  const cancel = event => { event.preventDefault(); hide() }
  const down = event => {
    start = null
    if (event.isPrimary && event.pointerType === 'touch') {
      start = { id: event.pointerId, x: event.clientX, y: event.clientY }
      handle.setPointerCapture(event.pointerId)
    }
  }
  const reset = () => { start = null }
  const up = event => {
    if (!start || start.id !== event.pointerId) return
    const dx = Math.abs(event.clientX - start.x), dy = event.clientY - start.y
    reset()
    if (dy >= 60 && dy > dx) hide()
  }
  const listeners = [[dialog, 'cancel', cancel], [dialog, 'close', dismiss],
    [close, 'click', hide], [handle, 'pointerdown', down], [handle, 'pointerup', up],
    [handle, 'pointercancel', reset], [handle, 'lostpointercapture', reset]]
  for (const [node, type, fn] of listeners) node.addEventListener(type, fn)
  dialog.showModal()
  close.focus()
  return () => {
    for (const [node, type, fn] of listeners) node.removeEventListener(type, fn)
    if (dialog.open) dialog.close()
    if (trigger.isConnected) trigger.focus()
  }
}

export function remainingTrainingRest(pause, now = Date.now()) {
  if (!pause || !Number.isFinite(pause.startedAt) || !Number.isFinite(pause.durationSeconds)) return 0
  return Math.max(0, Math.ceil(pause.durationSeconds - (now - pause.startedAt) / 1000))
}

// Own timers only. The existing athlete rest-pause/storage lifecycle remains intact.
export function watchTrainingRest(pause, update, clock = globalThis) {
  const tick = () => {
    const left = remainingTrainingRest(pause, clock.Date.now())
    update(left)
    if (!left && id !== null) { clock.clearInterval(id); id = null }
  }
  let id = null
  tick()
  if (remainingTrainingRest(pause, clock.Date.now()) > 0) id = clock.setInterval(tick, 250)
  return () => { if (id !== null) clock.clearInterval(id); id = null }
}

// DOM-adapter: native dialog sørger for modal fokus/inert baggrund og Escape.
// Ingen storage, globale listeners eller logprops. Testbar med små DOM-fakes.
export function bindPasOverblik({ trigger, dialog, handle, close }) {
  let start = null
  const reset = () => { start = null }
  const onClose = () => {
    reset()
    trigger.setAttribute('aria-expanded', 'false')
    trigger.focus()
  }
  const hide = () => { if (dialog.open) dialog.close() }
  const show = () => {
    if (!dialog.open) dialog.showModal()
    trigger.setAttribute('aria-expanded', 'true')
  }
  const backdrop = event => {
    const box = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom)) hide()
  }
  const down = event => {
    if (event.isPrimary && event.pointerType === 'touch' && event.target === handle) {
      start = { id: event.pointerId, x: event.clientX, y: event.clientY }
      handle.setPointerCapture(event.pointerId)
    }
  }
  const up = event => {
    if (!start || event.pointerId !== start.id) return
    const dy = event.clientY - start.y
    const dx = Math.abs(event.clientX - start.x)
    reset()
    if (dy >= 60 && dy > dx) hide()
  }
  const listeners = [[trigger, 'click', show], [close, 'click', hide],
    [dialog, 'click', backdrop], [dialog, 'close', onClose],
    [handle, 'pointerdown', down], [handle, 'pointerup', up],
    [handle, 'pointercancel', reset], [handle, 'lostpointercapture', reset]]
  for (const [node, type, fn] of listeners) node.addEventListener(type, fn)
  return () => {
    hide()
    for (const [node, type, fn] of listeners) node.removeEventListener(type, fn)
    trigger.setAttribute('aria-expanded', 'false')
  }
}

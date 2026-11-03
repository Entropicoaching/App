// Uses native buttons and a labelled textarea; no modal or keyboard focus trap.
export function ownQuickRepliesView({ node, button, controller, input }) {
  const root = node('div'), list = node('div'), editor = node('div'), status = node('p')
  root.setAttribute('aria-label', 'Egne hurtigsvar')
  status.setAttribute('role', 'status')
  Object.assign(root.style, { minWidth: '0', maxWidth: '100%' })
  Object.assign(list.style, { display: 'grid', gap: '8px', minWidth: '0' })
  const text = node('textarea')
  text.maxLength = 240; text.setAttribute('aria-label', 'Tekst til eget hurtigsvar')
  Object.assign(text.style, { width: '100%', minWidth: '0' })
  const count = node('p')
  const updateCount = () => { count.textContent = `${text.value.length}/240 tegn` }
  text.value = ''; text.addEventListener('input', updateCount)
  let rows = [], editing = null, locked = true, active = false, disposed = false
  const allowed = () => !disposed && active && !locked
  const notice = result => {
    status.textContent = result.persisted ? 'Gemt lokalt.' : 'Kun gemt i denne samtale. Lokal lagring er ikke tilgængelig.'
  }
  const closeEditor = () => { editor.hidden = true; text.value = ''; editing = null }
  const focusAdd = () => (add.disabled ? load : add).focus?.()
  const cancel = () => { closeEditor(); focusAdd() }
  const render = () => {
    list.replaceChildren(...rows.map((value, index) => {
      const row = node('div')
      Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '8px', minWidth: '0' })
      const use = button(value, () => {
        if (!allowed()) return
        try { if (controller.draft(value) !== false) input.focus?.() }
        catch (e) { status.textContent = e.message }
      })
      Object.assign(use.style, { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: '0', textAlign: 'left' })
      const edit = button('Redigér', () => {
        if (!allowed()) return
        editing = index; text.value = value; updateCount(); editor.hidden = false; text.focus?.()
      })
      const remove = button('Slet', () => {
        if (!allowed()) return
        try {
          const result = controller.ownQuickReplies('remove', index)
          rows = result.rows; closeEditor(); render(); focusAdd(); notice(result)
        } catch (e) { status.textContent = e.message }
      })
      edit.setAttribute('aria-label', `Redigér hurtigsvar ${index + 1}`)
      remove.setAttribute('aria-label', `Slet hurtigsvar ${index + 1}`)
      for (const control of [use, edit, remove]) control.disabled = locked
      row.append(use, edit, remove); return row
    }))
    add.disabled = locked || rows.length >= 12
  }
  const save = button('Gem hurtigsvar', () => {
    if (!allowed()) return
    try {
      const result = controller.ownQuickReplies('save', editing, text.value)
      rows = result.rows; closeEditor(); render(); focusAdd(); notice(result)
    } catch (e) { status.textContent = e.message }
  })
  const abort = button('Annullér', cancel)
  const add = button('Nyt hurtigsvar', () => {
    if (!allowed()) return
    editing = null; text.value = ''; updateCount(); editor.hidden = false; text.focus?.()
  })
  text.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel() }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault(); if (allowed()) save.click?.()
    }
  })
  editor.hidden = true; editor.append(text, count, save, abort)
  const load = button('Mine hurtigsvar', () => {
    if (!allowed()) return
    try {
      rows = controller.ownQuickReplies(); render(); list.hidden = false; add.hidden = false
      status.textContent = `${rows.length}/12 egne hurtigsvar. Vælg et svar, ret teksten og tryk Send.`
    } catch (e) { status.textContent = e.message }
  })
  list.hidden = true; add.hidden = true
  root.append(load, status, list, add, editor)
  return {
    root,
    update(state) {
      active = state.role === 'coach' && typeof controller.ownQuickReplies === 'function' && !state.error
      locked = Boolean(state.busy || state.operation?.status === 'error')
      root.hidden = !active
      for (const control of [load, add, text, save, abort]) control.disabled = !active || locked
      add.disabled ||= rows.length >= 12
      // Preserve the editor and its focus during draft/busy updates.
      for (const row of list.children) for (const control of row.children) control.disabled = !active || locked
    },
    dispose() { disposed = true; rows = []; text.value = '' },
  }
}

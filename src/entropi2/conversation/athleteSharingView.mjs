export function athleteSharingView({ node, button, controller }) {
  const root = node('details'), summary = node('summary', 'Del et sæt fra passet')
  root.open = false
  Object.assign(summary.style, { minHeight: '44px', cursor: 'pointer' })
  const set = node('input'); set.type = 'text'; set.maxLength = 160
  set.setAttribute('aria-label', 'Sæt fra passet')
  set.setAttribute('placeholder', 'Øvelse, sæt, kg og gentagelser')
  const note = node('textarea'); note.maxLength = 240
  note.setAttribute('aria-label', 'Kort note til coachen')
  note.setAttribute('placeholder', 'Hvordan føltes sættet?')
  for (const field of [set, note]) Object.assign(field.style, { width: '100%', marginBottom: '8px' })
  let locked = true, disposed = false, submitted = null
  const updateSend = () => { send.disabled = locked || !set.value.trim() || !note.value.trim() }
  const send = button('Send sæt til coach', async () => {
    if (disposed || send.disabled) return
    const sentSet = set.value, sentNote = note.value
    const attempt = controller.shareSet(sentSet, sentNote)
    const operation = controller.snapshot().operation
    if (operation?.status === 'pending') submitted = { id: operation.row.id, set: sentSet, note: sentNote }
    await attempt
  })
  set.addEventListener('input', updateSend); note.addEventListener('input', updateSend)
  root.append(summary, node('p', 'Beskriv sættet, og tilføj en kort note. Det sendes som en besked til coachen.'),
    set, note, send, node('p', 'Vil du dele video fra passet? Tryk Send video og tilføj din note i videovinduet.'))
  return {
    root,
    update(state) {
      root.hidden = state.available === false
      if (state.available === false) { set.value = ''; note.value = ''; submitted = null }
      // Also clear the original fields after a confirmed retry, never on failure.
      if (submitted && state.operation?.status === 'sent' && state.operation.row.id === submitted.id) {
        if (set.value === submitted.set) set.value = ''
        if (note.value === submitted.note) note.value = ''
        submitted = null
      }
      locked = state.role !== 'athlete' || !state.loaded || state.loading || state.busy || Boolean(state.error)
        || state.operation?.status === 'error' || Boolean(state.draft.trim())
      set.disabled = note.disabled = Boolean(state.busy || state.operation?.status === 'error')
      updateSend()
      send.title = state.draft.trim() ? 'Send eller tøm din besked først. Din tekst er bevaret.' : ''
    },
    dispose() { disposed = true; set.value = ''; note.value = '' },
  }
}

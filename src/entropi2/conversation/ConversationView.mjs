import { feedbackText } from './conversationModel.mjs'

// Explicit expansion is the view acknowledgement. No mount/load/scroll read effects.
export function mountConversation(root, controller, { enabled = false } = {}) {
  if (enabled !== true) return () => {}
  const doc = root.ownerDocument, expanded = new Set()
  let disposed = false, templateError = '', templates = []
  const node = (tag, text) => { const el = doc.createElement(tag); if (text) el.textContent = text; return el }
  const button = (text, fn) => {
    const b = node('button', text); b.type = 'button'; b.style.minHeight = '44px'
    b.addEventListener('click', fn); return b
  }
  const title = node('h1', 'Samtale'), status = node('p'), list = node('ol'), compose = node('section')
  status.setAttribute('role', 'status'); compose.setAttribute('aria-label', 'Skriv en besked')
  const input = node('textarea'); input.value = ''; input.maxLength = 10000
  input.setAttribute('aria-label', 'Din besked'); input.style.width = '100%'; input.style.boxSizing = 'border-box'
  input.addEventListener('input', () => controller.draft(input.value))
  const send = button('Send', () => controller.send()), retry = button('Prøv afsendelse igen', () => controller.retry())
  const reload = button('Opdatér samtalen', () => controller.refresh())
  const upload = button('Send video', () => controller.upload())
  const quick = node('div'), quickStatus = node('p')
  const loadQuick = button('Hent hurtige svar', () => {
    try { templates = controller.templates(); templateError = '' }
    catch (e) { templates = []; templateError = e.message }
    quick.replaceChildren(...templates.map(row => button(row.name, () => controller.draft(row.text))))
    quickStatus.textContent = templateError || (templates.length ? 'Vælg et svar og tryk Send.' : 'Ingen gemte hurtige svar.')
  })
  const videoSelect = node('select'); videoSelect.setAttribute('aria-label', 'Video til tidsfeedback')
  videoSelect.value = ''
  const seconds = node('input'); seconds.type = 'number'; seconds.min = 0; seconds.max = 7199.99; seconds.step = '0.01'; seconds.value = ''
  seconds.setAttribute('aria-label', 'Tidspunkt i sekunder')
  const timed = button('Send tidsfeedback', () => controller.send({ analysisId: videoSelect.value,
    seconds: seconds.value.trim() ? Number(seconds.value) : NaN }))
  const coach = node('section'); coach.setAttribute('aria-label', 'Coachens svar')
  coach.append(loadQuick, quickStatus, quick, videoSelect, seconds, timed)
  compose.append(input, send, retry, upload, coach)
  Object.assign(root.style, { background: '#141410', color: '#edeae2', padding: '20px',
    maxWidth: '480px', boxSizing: 'border-box', overflowWrap: 'anywhere' })
  root.replaceChildren(title, status, reload, list, compose)
  const unsubscribe = controller.subscribe(state => {
    if (disposed) return
    title.textContent = state.role === 'coach' ? 'Samtale med atleten' : 'Din coach'
    const unread = state.thread.filter(item => state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach).length
    status.textContent = state.error || (state.loading ? 'Henter samtalen…' : `${unread} ulæste`)
    status.setAttribute('role', state.error ? 'alert' : 'status')
    input.value = state.draft
    const locked = state.busy || state.operation?.status === 'error'
    input.disabled = Boolean(locked); send.disabled = Boolean(locked || !state.draft.trim())
    retry.hidden = state.operation?.status !== 'error'; retry.disabled = state.busy
    upload.hidden = state.role !== 'athlete'; coach.hidden = state.role !== 'coach'
    loadQuick.disabled = Boolean(locked); timed.disabled = Boolean(locked || !state.draft.trim())
    const selected = videoSelect.value
    videoSelect.replaceChildren(node('option', 'Vælg video'))
    videoSelect.children[0].value = ''
    for (const item of state.thread.filter(item => item.kind === 'video')) {
      const option = node('option', `${item.value.lift || 'Video'} · ${item.value.id}`); option.value = item.value.id; videoSelect.append(option)
    }
    videoSelect.value = selected
    list.replaceChildren(...state.thread.map(item => {
      const li = node('li'), row = item.value
      li.dataset.key = item.key; li.style.whiteSpace = 'pre-wrap'; li.style.marginBottom = '20px'
      const unread = state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach
      const label = `${item.kind === 'video' ? 'Video' : row.sender_role === 'coach' ? 'Coach' : 'Atlet'} · ${item.at || 'Dato ukendt'}${unread ? ' · Ulæst' : ''}`
      const toggle = button(label, async () => {
        if (disposed) return
        expanded.add(item.key)
        // Content is attached before any read write is attempted.
        content.hidden = false; toggle.setAttribute('aria-expanded', 'true')
        await controller.seen(item.key)
      })
      toggle.setAttribute('aria-expanded', String(expanded.has(item.key)))
      const content = node('div', item.kind === 'video' ? feedbackText(row) : row.content)
      content.hidden = !expanded.has(item.key)
      if (item.kind === 'video') content.append(button(state.role === 'coach' ? 'Åbn videoreview' : 'Åbn videofeedback', () => controller.open(item.key)))
      li.append(toggle, content); return li
    }))
    if (state.operation && state.operation.status !== 'sent') {
      const pending = node('li', `${state.operation.row.content}\n${state.operation.status === 'error' ? 'Ikke bekræftet. Prøv igen med samme besked.' : 'Sender…'}`)
      pending.dataset.pending = state.operation.row.id; list.append(pending)
    }
  })
  return () => { disposed = true; unsubscribe(); controller.dispose(); root.replaceChildren() }
}

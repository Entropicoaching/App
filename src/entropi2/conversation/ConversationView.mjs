import { feedbackText, videoLabel } from './conversationModel.mjs'
import { ownQuickRepliesView } from './ownQuickRepliesView.mjs'

const copenhagen = new Intl.DateTimeFormat('da-DK', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const danishDate = new Intl.DateTimeFormat('da-DK', {
  timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short',
})
const dateParts = date => Object.fromEntries(copenhagen.formatToParts(date).map(p => [p.type, p.value]))
const calendarDay = parts => Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))

export function formatConversationTime(value, now = new Date()) {
  // Require an explicit wire timezone; never interpret a timestamp in the device timezone.
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return 'tidspunkt mangler'
  const [, year, month, day, hour, minute, second = '0', zone] = match
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > days
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))
    return 'tidspunkt mangler'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'tidspunkt mangler'
  const parts = dateParts(date), today = dateParts(now)
  // Compare Copenhagen calendar dates, not 24-hour durations across DST changes.
  const difference = calendarDay(today) - calendarDay(parts)
  const prefix = difference === 0 ? 'i dag' : difference === 86400000 ? 'i går' : danishDate.format(date)
  return `${prefix} ${parts.hour}:${parts.minute}`
}

// Explicit expansion is the view acknowledgement. No mount/load/scroll read effects.
export function mountConversation(root, controller, { enabled = false } = {}) {
  if (enabled !== true) return () => {}
  const doc = root.ownerDocument, expanded = new Set()
  let disposed = false, templateError = '', templates = [], composition = '', clearedTimedId = null
  const node = (tag, text) => { const el = doc.createElement(tag); if (text) el.textContent = text
    if (['button', 'select', 'textarea', 'input'].includes(tag)) Object.assign(el.style, {
      minHeight: '44px', maxWidth: '100%', boxSizing: 'border-box', border: '1px solid #59564c',
      borderRadius: '10px', padding: '12px 16px', background: '#1c1c18', color: '#edeae2',
      font: 'inherit',
    })
    return el }
  const button = (text, fn) => {
    const b = node('button', text); b.type = 'button'; b.style.minHeight = '44px'
    b.addEventListener('click', fn); return b
  }
  const title = node('h1', 'Samtale'), status = node('p'), list = node('ol'), compose = node('section')
  status.setAttribute('role', 'status'); compose.setAttribute('aria-label', 'Skriv en besked')
  Object.assign(list.style, { textAlign: 'left', paddingInlineStart: '32px', listStylePosition: 'outside' })
  const input = node('textarea'); input.value = ''; input.maxLength = 10000
  input.setAttribute('aria-label', 'Din besked'); input.style.width = '100%'; input.style.boxSizing = 'border-box'
  input.addEventListener('input', () => controller.draft(input.value))
  const send = button('Send', () => controller.send()), retry = button('Prøv afsendelse igen', () => controller.retry())
  Object.assign(send.style, { background: '#d8b16b', color: '#141410' })
  const reload = button('Opdatér samtalen', () => controller.refresh())
  const upload = button('Send video', () => controller.upload())
  const quick = node('div'), quickStatus = node('p')
  Object.assign(quick.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' })
  const renderQuick = () => quick.replaceChildren(...templates.map(row => button(row.name, () => {
    if (disposed) return
    try {
      if (controller.selectTemplate) {
        if (!controller.selectTemplate(row.name)) return
        templates = controller.templates()
        renderQuick()
      } else controller.draft(row.text)
      input.focus?.()
    } catch (e) { quickStatus.textContent = e.message }
  })))
  const loadQuick = button('Hent hurtige svar', () => {
    try { templates = controller.templates(); templateError = '' }
    catch (e) { templates = []; templateError = e.message }
    renderQuick()
    quickStatus.textContent = templateError || (templates.length ? 'Vælg et svar, ret teksten og tryk Send. Mest brugte vises først.' : 'Ingen gemte hurtige svar.')
  })
  const videoSelect = node('select'); videoSelect.setAttribute('aria-label', 'Video til tidsfeedback')
  videoSelect.value = ''
  const seconds = node('input'); seconds.type = 'number'; seconds.min = 0; seconds.max = 7199.99; seconds.step = '0.01'; seconds.value = ''
  seconds.setAttribute('aria-label', 'Tidspunkt i sekunder')
  const timed = button('Send tidsfeedback', () => controller.send({ analysisId: videoSelect.value,
    seconds: seconds.value.trim() ? Number(seconds.value) : NaN }))
  Object.assign(timed.style, { background: '#d8b16b', color: '#141410' })
  const coach = node('section'); coach.setAttribute('aria-label', 'Coachens svar')
  const ownReplies = ownQuickRepliesView({ node, button, controller, input })
  const timeFeedback = node('div')
  Object.assign(timeFeedback.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' })
  timeFeedback.append(videoSelect, seconds, timed)
  coach.append(loadQuick, quickStatus, quick, ownReplies.root, timeFeedback)
  compose.append(input, send)
  Object.assign(root.style, { background: '#141410', color: '#edeae2', padding: '20px',
    fontFamily: "'IBM Plex Sans', Arial, sans-serif", lineHeight: '1.5', colorScheme: 'dark',
    maxWidth: '480px', textAlign: 'left', boxSizing: 'border-box', overflowWrap: 'anywhere' })
  let firstUnread = null
  const jump = button('Spring til første ulæste', () => {
    if (disposed || !firstUnread) return
    firstUnread.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    firstUnread.focus?.()
  })
  jump.hidden = true
  root.replaceChildren(title, status, jump, reload, list, compose)
  const unsubscribe = controller.subscribe(state => {
    if (disposed) return
    ownReplies.update(state)
    title.textContent = state.role === 'coach' ? 'Samtale med atleten' : 'Din coach'
    const unread = state.thread.filter(item => state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach).length
    status.textContent = state.error || (state.loading ? 'Henter samtalen…' : `${unread} ulæste`)
    status.setAttribute('role', state.error ? 'alert' : 'status')
    input.value = state.draft
    const locked = state.busy || state.operation?.status === 'error'
    input.disabled = Boolean(locked); send.disabled = Boolean(locked || !state.draft.trim())
    retry.hidden = state.operation?.status !== 'error'; retry.disabled = state.busy
    upload.hidden = state.role !== 'athlete'; coach.hidden = state.role !== 'coach'
    // Attach privileged tools and retry only when applicable; do not rely on CSS hiding.
    const nextComposition = `${state.role}:${retry.hidden}`
    if (composition !== nextComposition) {
      composition = nextComposition
      compose.replaceChildren(input, send, ...(retry.hidden ? [] : [retry]),
        ...(state.role === 'athlete' ? [upload] : []), ...(state.role === 'coach' ? [coach] : []))
    }
    loadQuick.disabled = Boolean(locked); timed.disabled = Boolean(locked || !state.draft.trim())
    if (state.operation?.status === 'sent' && state.operation.row.category === 'teknik'
      && state.operation.row.id !== clearedTimedId) {
      clearedTimedId = state.operation.row.id
      videoSelect.value = ''; seconds.value = ''
    }
    for (const primary of [send, timed]) Object.assign(primary.style, {
      opacity: primary.disabled ? '0.45' : '1', cursor: primary.disabled ? 'not-allowed' : 'pointer',
    })
    const selected = videoSelect.value
    videoSelect.replaceChildren(node('option', 'Vælg video'))
    videoSelect.children[0].value = ''
    for (const item of state.thread.filter(item => item.kind === 'video')) {
      const option = node('option', videoLabel(item.value)); option.value = item.value.id; videoSelect.append(option)
    }
    videoSelect.value = selected
    const isUnread = item => Boolean(state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach)
    // Stable partition: preserve the original timeline inside each group.
    const ordered = [...state.thread.filter(isUnread), ...state.thread.filter(item => !isUnread(item))]
    firstUnread = null
    jump.hidden = unread === 0; jump.disabled = unread === 0
    jump.textContent = `${unread} ulæste · Spring til første ulæste`
    list.replaceChildren(...ordered.map(item => {
      const li = node('li'), row = item.value
      li.dataset.key = item.key; li.style.whiteSpace = 'pre-wrap'; li.style.marginBottom = '20px'
      const unread = state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach
      const label = `${item.kind === 'video' ? 'Video' : row.sender_role === 'coach' ? 'Coach' : 'Atlet'} · ${formatConversationTime(item.at)}${unread ? ' · Ulæst' : ''}`
      const toggle = button(label, async () => {
        if (disposed) return
        expanded.add(item.key)
        // Content is attached before any read write is attempted.
        content.hidden = false; preview.hidden = true; toggle.setAttribute('aria-expanded', 'true')
        await controller.seen(item.key)
      })
      if (isUnread(item) && !firstUnread) firstUnread = toggle
      toggle.style.textAlign = 'left'
      toggle.setAttribute('aria-expanded', String(expanded.has(item.key)))
      const content = node('div', item.kind === 'video' ? feedbackText(row) : row.content)
      content.hidden = !expanded.has(item.key)
      if (item.kind === 'video') content.append(button(state.role === 'coach' ? 'Åbn videoreview' : 'Åbn videofeedback', () => controller.open(item.key)))
      const text = item.kind === 'video' ? feedbackText(row) : row.content
      const characters = Array.from(text)
      const preview = node('p', characters.slice(0, 120).join('') + (characters.length > 120 ? '…' : ''))
      preview.hidden = expanded.has(item.key)
      li.append(toggle, content, preview); return li
    }))
    if (state.operation && state.operation.status !== 'sent') {
      const pending = node('li', `${state.operation.row.content}\n${state.operation.status === 'error' ? 'Ikke bekræftet. Prøv igen med samme besked.' : 'Sender…'}`)
      pending.dataset.pending = state.operation.row.id; list.append(pending)
    }
  })
  return () => { disposed = true; ownReplies.dispose(); unsubscribe(); controller.dispose(); root.replaceChildren() }
}

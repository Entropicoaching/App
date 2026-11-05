import { feedbackText, videoLabel, conversationDate, messageText } from './conversationModel.mjs'
import { weeklyConversationSummary } from './uge/weeklyConversationSummary.mjs'
import { conversationWeek } from './conversationWeek.mjs'
import { ownQuickRepliesView } from './ownQuickRepliesView.mjs'
import { athleteQuestion, athleteAnswers } from './athleteConversation.mjs'
import { athleteSharingView } from './athleteSharingView.mjs'

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
  const date = conversationDate(value)
  if (!date) return ''
  const parts = dateParts(date), today = dateParts(now)
  // Compare Copenhagen calendar dates, not 24-hour durations across DST changes.
  const difference = calendarDay(today) - calendarDay(parts)
  const prefix = difference === 0 ? 'i dag' : difference === 86400000 ? 'i går' : danishDate.format(date)
  return `${prefix} ${parts.hour}:${parts.minute}`
}

// Explicit expansion is the view acknowledgement. No mount/load/scroll read effects.
export function mountConversation(root, controller, { enabled = false, now = () => new Date() } = {}) {
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
  status.style.marginBottom = '12px'
  // Keep list semantics without spending the message width on timeline numbers.
  list.setAttribute('role', 'list')
  Object.assign(list.style, { textAlign: 'left', paddingInlineStart: '0', listStyle: 'none' })
  const input = node('textarea'); input.value = ''; input.maxLength = 10000
  let latestState, letterBusy = false, letterRetry = false
  const letterStatus = node('p'); letterStatus.setAttribute('role', 'status')
  const letter = button('Lav udkast til ugebrev', async () => {
    if (disposed || letter.disabled || !latestState || latestState.draft.trim()) return
    const athleteId = latestState.athleteId
    letterBusy = true; letter.disabled = true
    letter.textContent = 'Henter ugebrev …'
    letterStatus.setAttribute('role', 'status'); letterStatus.textContent = 'Henter ugebrev og ugens grundlag …'
    try {
      const model = await controller.weeklyLetter()
      if (disposed) return
      const state = controller.snapshot()
      if (state.role !== 'coach' || state.athleteId !== athleteId || state.error || !state.loaded
        || state.loading || state.busy || state.operation?.status === 'error')
        throw Error('Samtalen er ændret. Opdatér og prøv igen.')
      if (state.draft.trim()) {
        letterStatus.textContent = 'Din tekst er bevaret. Tøm beskedfeltet, før du laver et nyt udkast.'
      } else if (model.state === 'ready') {
        if (controller.draft(model.text) === false) throw Error('Beskedfeltet er låst.')
        letterStatus.textContent = `${model.from} – ${model.asOf}. Udkastet bygger kun på registreret søvn, energi, stress og ømhed. Øvrige data er ukendte. Redigér teksten, og tryk selv Send.`
        input.focus?.()
      } else if (model.state === 'empty') {
        letterStatus.textContent = 'Der er endnu ikke et sikkert grundlag for et ugebrev. Ingen kendte registreringer af søvn, energi, stress eller ømhed i de seneste 7 dage.'
      } else throw Error('Udkastet kunne ikke dannes.')
      letterRetry = false
    } catch {
      if (!disposed) {
        letterRetry = true
        letterStatus.setAttribute('role', 'alert')
        letterStatus.textContent = 'Udkastet kunne ikke dannes. Din tekst er bevaret. Prøv ugebrev igen.'
      }
    } finally {
      letterBusy = false
      if (!disposed) updateLetter(latestState)
    }
  })
  const letterTools = node('div')
  letterTools.append(letter, letterStatus)
  const updateLetter = state => {
    letter.textContent = letterBusy ? 'Henter ugebrev …' : letterRetry ? 'Prøv ugebrev igen' : 'Lav udkast til ugebrev'
    letter.disabled = Boolean(letterBusy || state.busy || state.loading || !state.loaded || state.error
      || state.operation?.status === 'error' || state.draft.trim())
    letter.title = state.draft.trim() ? 'Tøm beskedfeltet først. Din tekst bliver ikke overskrevet.' : ''
  }
  input.setAttribute('aria-label', 'Din besked'); input.style.width = '100%'; input.style.boxSizing = 'border-box'
  input.setAttribute('placeholder', 'Skriv en besked')
  // Marc 3. nov.: knapperne under beskedfeltet staar med luft imellem, ikke klistret sammen.
  const actions = node('div')
  Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' })
  input.addEventListener('input', () => controller.draft(input.value))
  const send = button('Send', () => controller.send()), retry = button('Prøv afsendelse igen', () => controller.retry())
  Object.assign(send.style, { background: '#d8b16b', color: '#141410' })
  const reload = button('Hent igen', () => controller.refresh())
  const upload = button('Send video', () => controller.upload())
  upload.title = 'Åbn videodeling fra passet og tilføj en kort note.'
  const sharing = typeof controller.shareSet === 'function' ? athleteSharingView({ node, button, controller }) : null
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
    const reduceMotion = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
    firstUnread.scrollIntoView?.({ block: 'start', behavior: reduceMotion ? 'instant' : 'smooth' })
    firstUnread.focus?.({ preventScroll: true })
  })
  jump.hidden = true
  const week = node('div'), weekLine = node('p'), weekDetails = node('details')
  week.setAttribute('aria-label', 'Ugens samtale')
  const weekToggle = node('summary', 'Ugens detaljer'), weekCounts = node('p')
  weekToggle.style.minHeight = '44px'; weekToggle.style.cursor = 'pointer'
  weekDetails.open = false
  weekDetails.append(weekToggle, weekCounts)
  week.append(weekLine, weekDetails)
  root.replaceChildren(title, week, status, jump, reload, list, compose)
  const unsubscribe = controller.subscribe(state => {
    if (disposed) return
    latestState = state
    updateLetter(state)
    ownReplies.update(state)
    sharing?.update(state)
    // Only the coach's complete, scoped snapshot may produce week counters.
    week.hidden = true
    weekDetails.hidden = true
    weekCounts.textContent = ''
    weekLine.textContent = ''
    if (state.role === 'coach' && state.loaded && !state.loading && !state.error) {
      try {
        const counts = weeklyConversationSummary({ enabled: true, athleteId: state.athleteId,
          ...conversationWeek(now()),
          messages: state.thread.filter(item => item.kind === 'message').map(item => item.value),
          analyses: state.thread.filter(item => item.kind === 'video').map(item => item.value),
        })
        week.hidden = false
        weekLine.textContent = `Denne uge · ${counts.totalMessages} beskeder · ${counts.unansweredMessages} ubesvarede · ${counts.videoFeedback} video-feedback`
        weekDetails.hidden = counts.totalMessages === 0 && counts.videoFeedback === 0
        if (!weekDetails.hidden)
          weekCounts.textContent = `${counts.athleteMessages} fra atleten · ${counts.coachMessages} fra coachen. Ubesvarede er atletbeskeder uden en senere coachbesked i ugen. Video-feedback tælles efter delingstidspunktet.`
      } catch { /* No trustworthy weekly basis: keep the optional summary hidden. */ }
    }
    if (weekDetails.hidden) weekDetails.open = false
    title.textContent = state.role === 'coach' ? 'Samtale med atleten' : 'Din coach'
    const unread = state.thread.filter(item => state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach).length
    // Marc 3. nov. (keep it simple): antallet ulaeste staar paa spring-knappen; statuslinjen siger kun det, der mangler.
    status.textContent = state.error || (state.loading || !state.loaded ? 'Henter samtalen…' : state.thread.length ? '' : state.role === 'coach' ? 'Ingen beskeder endnu.' : 'Ingen beskeder endnu. Skriv til din coach herunder.')
    reload.textContent = state.loading ? 'Henter…' : 'Hent igen'
    status.hidden = !status.textContent
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
      actions.replaceChildren(send, ...(retry.hidden ? [] : [retry]), ...(state.role === 'athlete' ? [upload] : []))
      compose.replaceChildren(...(state.role === 'coach' && controller.weeklyLetter ? [letterTools] : []),
        input, actions, ...(state.role === 'coach' ? [coach] : sharing ? [sharing.root] : []))
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
    const question = state.role === 'athlete' && state.loaded && !state.loading && !state.error
      && typeof controller.answerQuestion === 'function' ? athleteQuestion(state.thread) : null
    // Stable partition: preserve the original timeline inside each group.
    const ordered = [...state.thread.filter(isUnread), ...state.thread.filter(item => !isUnread(item))]
    firstUnread = null
    jump.hidden = unread === 0; jump.disabled = unread === 0
    jump.textContent = `${unread} ulæste · Spring til første ulæste`
    // A read acknowledgement can reorder the list. Restore only the toggle
    // that owns focus at this update, never steal focus back after an async read.
    const focusedKey = Array.from(list.children).find(li => li.children[0] === doc.activeElement)?.dataset.key
    let focusedToggle = null
    list.replaceChildren(...ordered.map(item => {
      const li = node('li'), row = item.value
      li.dataset.key = item.key; li.style.whiteSpace = 'pre-wrap'; li.style.marginBottom = '20px'
      const unread = state.role === 'athlete' ? item.unreadAthlete : item.unreadCoach
      if (state.role === 'athlete') {
        li.dataset.unread = String(Boolean(unread))
        Object.assign(li.style, { borderInlineStart: `3px solid ${unread ? '#d8b16b' : 'transparent'}`,
          paddingInlineStart: '8px' })
      }
      const label = [item.kind === 'video' ? 'Video' : row.sender_role === 'coach' ? 'Coach' : 'Atlet',
        formatConversationTime(item.at), unread ? 'Ulæst' : ''].filter(Boolean).join(' · ')
      const toggle = button(label, async () => {
        if (disposed) return
        expanded.add(item.key)
        // Content is attached before any read write is attempted.
        content.hidden = false; preview.hidden = true; toggle.setAttribute('aria-expanded', 'true')
        await controller.seen(item.key)
      })
      if (item.key === focusedKey) focusedToggle = toggle
      if (isUnread(item) && !firstUnread) firstUnread = toggle
      // Metadata remains a full-width, keyboard-focusable 44px opening target.
      Object.assign(toggle.style, { textAlign: 'left', width: '100%', minWidth: '0',
        border: '0', borderRadius: '0', padding: '8px 0', background: 'transparent',
        color: '#b6b2a8', fontSize: '0.875rem', lineHeight: '1.5', whiteSpace: 'normal', cursor: 'pointer' })
      toggle.setAttribute('aria-expanded', String(expanded.has(item.key)))
      const text = item.kind === 'video' ? feedbackText(row) : messageText(row)
      const content = node('div', text)
      content.hidden = !expanded.has(item.key)
      if (item.kind === 'video') content.append(button(state.role === 'coach' ? 'Åbn videoreview' : 'Åbn videofeedback', () => controller.open(item.key)))
      const characters = Array.from(text)
      const preview = node('p', characters.slice(0, 120).join('') + (characters.length > 120 ? '…' : ''))
      preview.hidden = expanded.has(item.key)
      li.append(toggle, content, preview)
      if (question?.key === item.key) {
        const replies = node('div')
        replies.setAttribute('aria-label', 'Hurtige svar til coachens spørgsmål')
        Object.assign(replies.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' })
        replies.append(node('p', state.draft.trim()
          ? 'Din besked er bevaret. Send eller tøm den for at bruge hurtigsvar.' : 'Send svar med ét tryk:'))
        for (const answer of athleteAnswers(question)) {
          const reply = button(answer, async () => {
            if (disposed || reply.disabled) return
            await controller.answerQuestion(item.key, answer)
            if (!disposed) input.focus?.()
          })
          reply.disabled = Boolean(locked || state.draft.trim())
          replies.append(reply)
        }
        li.append(replies)
      }
      return li
    }))
    if (state.operation && state.operation.status !== 'sent') {
      const pending = node('li', `${messageText(state.operation.row)}\n${state.operation.status === 'error' ? 'Ikke bekræftet. Prøv igen med samme besked.' : 'Sender…'}`)
      pending.dataset.pending = state.operation.row.id; list.append(pending)
    }
    focusedToggle?.focus?.({ preventScroll: true })
  })
  return () => { disposed = true; sharing?.dispose(); ownReplies.dispose(); unsubscribe(); controller.dispose(); root.replaceChildren() }
}

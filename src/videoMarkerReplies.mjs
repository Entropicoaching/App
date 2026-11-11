// u8d: lukket prøve-loader tillader ingen ny import; samme regel som danskTal.decimaler.
const decimaler = (value, digits = 1) => value.toFixed(digits).replace('.', ',')
import { messageText } from './entropi2/conversation/conversationModel.mjs'
// VC-SVAR1 uses ordinary technique messages. No schema or media persistence.
export const DEFAULT_MARKER_REPLIES = false
export const MARKER_REPLY_FLAG = 'vc-svar1'
export function markerRepliesEnabled(storage) {
  try { return (storage === undefined ? globalThis.localStorage : storage)?.getItem(MARKER_REPLY_FLAG) === '1' } catch { return false }
}
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value)
const valid = value => value && id(value.athleteId) && id(value.analysisId) && id(value.markerId) &&
  typeof value.start === 'number' && Number.isFinite(value.start) && value.start >= 0 && value.start < 7200
const prefix = 'Svar til videomarkering'
const separator = '\n\n[VC-SVAR1:'
export function markerReplyContent(scope, marker, text) {
  const ref = { athleteId: scope?.athleteId, analysisId: scope?.analysisId, markerId: marker?.id, start: marker?.start }
  if (!valid(ref) || typeof text !== 'string' || !text.trim() || text.trim().length > 600) throw Error('Skriv et svar på 1 til 600 tegn.')
  return `${prefix} (${ref.start.toFixed(2)} s)\n${text.trim()}${separator}${JSON.stringify(ref)}]`
}
export function parseMarkerReply(message) {
  if (message?.sender_role !== 'athlete' || message.category !== 'teknik' || typeof message.content !== 'string') return null
  const index = message.content.lastIndexOf(separator)
  if (index < 0 || !message.content.endsWith(']')) return null
  try {
    const ref = JSON.parse(message.content.slice(index + separator.length, -1))
    if (!valid(ref) || message.athlete_id !== ref.athleteId) return null
    const head = `${prefix} (${ref.start.toFixed(2)} s)\n`
    const body = message.content.slice(0, index)
    if (!body.startsWith(head)) return null
    const reply = body.slice(head.length)
    if (!reply.trim() || reply.length > 600) return null
    return { athleteId: ref.athleteId, analysisId: ref.analysisId, markerId: ref.markerId, start: ref.start, reply }
  } catch { return null }
}
export function repliesForMarker(messages, scope, markerId) {
  if (!Array.isArray(messages)) return []
  return messages.map(parseMarkerReply).filter(reply => reply && reply.athleteId === scope.athleteId &&
    reply.analysisId === scope.analysisId && reply.markerId === markerId)
}
export function markerReplyPreview(message) {
  const reply = markerRepliesEnabled() && parseMarkerReply(message)
  return reply ? `${prefix} ved ${decimaler(reply.start, 2)} s: ${reply.reply}` : messageText(message)
}
export function createMarkerReplySender({ athleteId, analysisId, insert }) {
  let busy = false
  return async (marker, text) => {
    if (!markerRepliesEnabled() || busy) return false
    const content = markerReplyContent({ athleteId, analysisId }, marker, text)
    busy = true
    try {
      const result = await insert({ athlete_id: athleteId, sender_role: 'athlete', category: 'teknik', content })
      if (!result || result.error) throw Error('Beskeden blev ikke sendt. Din tekst er bevaret. Prøv igen.')
      return true
    } finally { busy = false }
  }
}
// One explicit marker selection, separate drafts and no sending on selection or playback.
export function mountMarkerReplyForm(root, scope, markers, send) {
  const doc = root.ownerDocument, drafts = new Map()
  let selected = markers[0]?.id, busy = false, disposed = false
  const el = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n }
  const label = el('label', 'Svar til markering '), select = el('select')
  select.setAttribute('aria-label', 'Vælg markering til dit svar')
  for (const marker of markers) { const n = el('option', `${decimaler(marker.start, 2)} s: ${marker.text || 'Tegning'}`); n.value = marker.id; select.append(n) }
  select.value = selected; label.append(select)
  const inputLabel = el('label', 'Dit svar eller spørgsmål '), input = el('textarea')
  input.maxLength = 600; input.setAttribute('aria-label', 'Dit svar til markeringen'); input.value = ''; inputLabel.append(input)
  const button = el('button', 'Send svar til markering'); button.type = 'button'; button.style.minHeight = '44px'
  const status = el('p'); status.setAttribute('role', 'status')
  Object.assign(root.style, { display: 'grid', gap: '0.5rem', overflowWrap: 'anywhere' })
  Object.assign(select.style, { width: '100%', minHeight: '44px' }); input.style.width = '100%'; input.style.boxSizing = 'border-box'
  const change = () => { drafts.set(selected, input.value); selected = select.value; input.value = drafts.get(selected) || ''; status.textContent = '' }
  const click = async () => {
    if (disposed || busy || !markerRepliesEnabled()) return
    const marker = markers.find(m => m.id === selected)
    try { markerReplyContent(scope, marker, input.value) } catch (error) { status.textContent = error.message; return }
    const text = input.value
    busy = true; select.disabled = input.disabled = button.disabled = true; status.textContent = 'Sender svar…'
    try {
      if (await send(marker, text) !== true) throw Error('Svaret blev ikke sendt. Prøv igen.')
      if (!disposed) { input.value = ''; drafts.delete(selected); status.textContent = 'Svar sendt til din coach.' }
    } catch { if (!disposed) status.textContent = 'Svaret blev ikke sendt. Din tekst er bevaret. Prøv igen.' }
    finally { busy = false; if (!disposed) select.disabled = input.disabled = button.disabled = false }
  }
  select.addEventListener('change', change); button.addEventListener('click', click)
  root.replaceChildren(label, inputLabel, button, status)
  return () => { disposed = true; select.removeEventListener('change', change); button.removeEventListener('click', click); root.replaceChildren() }
}

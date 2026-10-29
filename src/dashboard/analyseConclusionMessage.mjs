import { createElement as h, useState, useRef } from 'react'
import { analyseConclusion, approvedConclusionReviews } from './analyseConclusion.mjs'

export const DEFAULT_ANALYSE_CONCLUSION_MESSAGE = false
export function analyseConclusionMessageEnabled(search = '') {
  const values = new URLSearchParams(search).getAll('analyseConclusionMessage')
  return values.length === 1 && values[0] === '1'
}

export function conclusionNextAction(props) {
  if (!props.athleteId || props.loading || props.error) return ''
  const row = approvedConclusionReviews(props)[0]
  const value = row?.athlete_feedback?.next_set
  const first = Array.isArray(value) ? value[0] : value
  const text = typeof first === 'string' ? first : first?.text
  if (typeof text !== 'string') return ''
  return text.trim().split(/\r?\n/)[0].match(/^.*?[.!?](?=\s|$)/u)?.[0] || text.trim().split(/\r?\n/)[0]
}

const button = { minHeight: 44, padding: '0.6rem', margin: '4px 8px 4px 0' }
const field = { display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box', font: 'inherit' }

export default function AnalyseConclusionMessage(props) {
  if (props.enabled !== true || !props.coachId || !props.athleteId || props.loading || props.error || typeof props.sendMessage !== 'function') return null
  const conclusion = analyseConclusion(props)
  const action = conclusionNextAction(props)
  // Source changes invalidate drafts; reopening never restores an old recipient's text.
  return h(MessageEditor, { ...props, conclusion, action, key: JSON.stringify([props.coachId, props.athleteId, props.liftFilter, conclusion, action]) })
}

function MessageEditor({ coachId, athleteId, athleteName, conclusion, action, sendMessage }) {
  const [open, setOpen] = useState(false)
  const [headline, setHeadline] = useState(conclusion)
  const [next, setNext] = useState(action)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const lock = useRef(false)
  const content = `${headline.trim()}\n\nNæste handling: ${next.trim()}`
  const valid = Boolean(headline.trim() && next.trim() && content.length <= 10000)
  async function send() {
    if (!open || lock.current || !valid) return
    lock.current = true; setSending(true); setStatus('')
    try {
      const sent = await sendMessage({ coachId, athleteId, text: content })
      if (sent !== true) throw Error('Ikke sendt')
      setOpen(false); setStatus('Beskeden er sendt.')
    } catch {
      setStatus('Beskeden blev ikke sendt. Din tekst er bevaret. Prøv igen.')
      lock.current = false
    } finally { setSending(false) }
  }
  return h('section', { 'aria-label': 'Send analysens konklusion', style: { minWidth: 0, overflowWrap: 'anywhere' } },
    !open && h('button', { type: 'button', style: button, onClick: () => { lock.current = false; setHeadline(conclusion); setNext(action); setStatus(''); setOpen(true) } }, 'Klargør besked til atleten'),
    open && h('div', null,
      h('p', null, `Modtager: ${athleteName || athleteId}. Ret teksten og tryk Send. Intet sendes automatisk.`),
      h('label', null, 'Konklusionssætning', h('textarea', { 'aria-label': 'Konklusionssætning', rows: 4, maxLength: 10000, style: field, value: headline, disabled: sending, onChange: e => setHeadline(e.target.value) })),
      h('label', null, 'Næste handling', h('textarea', { 'aria-label': 'Næste handling', rows: 3, maxLength: 10000, style: field, value: next, disabled: sending, onChange: e => setNext(e.target.value) })),
      !action && h('p', null, 'Tilføj én næste handling, før du sender.'),
      content.length > 10000 && h('p', { role: 'alert' }, 'Forkort beskeden til højst 10000 tegn.'),
      h('button', { type: 'button', style: button, disabled: sending || !valid, onClick: send }, sending ? 'Sender...' : 'Send'),
      h('button', { type: 'button', style: button, disabled: sending, onClick: () => { if (lock.current) return; setOpen(false); setHeadline(conclusion); setNext(action); setStatus('') } }, 'Annuller')),
    status && h('p', { role: 'status' }, status))
}

import { createElement as h } from 'react'

// No reads or writes here: retry delegates to the host's existing guarded read.
export default function WeightReadStatus({ state, latestDate, retry } = {}) {
  if (state === 'ready') return latestDate ? h('p', { 'data-analysis-weight-date': true,
    style: { lineHeight: 1.6 } }, `Vægtdata: seneste vejning ${latestDate.split('-').reverse().join('.')}.`) : null
  if (state !== 'loading' && state !== 'error') return null
  const message = state === 'error' ? 'Din vægt kunne ikke hentes. Tidligere vægttal vises ikke.'
    : 'Henter vægtdata…'
  let pending = false
  const onClick = async event => {
    if (pending) return
    pending = true
    const button = event?.currentTarget
    if (button) button.disabled = true
    try { await retry() } catch { /* The existing error remains visible; retry stays possible. */ }
    finally { pending = false; if (button) button.disabled = false }
  }
  return h('section', { 'data-analysis-weight-status': true, 'aria-label': 'Vægtdata',
    'aria-busy': state === 'loading', style: { marginBottom: 16 } },
    h('p', { role: state === 'error' ? 'alert' : 'status', style: { lineHeight: 1.6 } }, message),
    state !== 'loading' && typeof retry === 'function' && h('button', { type: 'button',
      onClick, style: { minHeight: 44, padding: '0.5rem 1rem', color: '#171815',
        background: '#d8b16b', border: 0, borderRadius: 4 } }, 'Hent igen'))
}

import { createElement as h, Fragment } from 'react'

function closeMore(event) {
  const details = event.currentTarget.closest('details')
  if (!details) return
  details.open = false
  details.querySelector('summary')?.focus()
}

// Native summary supplies Enter/Space activation and exposes expanded state.
// Keep children and their handlers intact, including when the flag is off.
export function CoachMenuMore({ enabled = false, children }) {
  if (enabled !== true) return h(Fragment, null, children)
  const style = { minHeight: 44, padding: '0.65rem', cursor: 'pointer',
    color: '#edeae2', background: '#1c1c18', border: '1px solid #59564c', font: 'inherit' }
  return h('details', { onKeyDown: event => {
    if (event.key === 'Escape') { event.preventDefault(); closeMore(event) }
  } },
  h('summary', { style }, 'Mere'),
  children,
  h('button', { type: 'button', style, onClick: closeMore }, 'Tilbage til menuen'))
}

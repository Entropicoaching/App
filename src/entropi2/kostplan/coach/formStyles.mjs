import { s } from '../../../dashboardShared.js'

// Reuse the coach portal's style variables; keep native select affordances.
const target = { minHeight: 44, width: '100%', maxWidth: '100%', minWidth: 0,
  boxSizing: 'border-box', font: 'inherit' }
export const control = { ...s.fieldInput, ...target, borderRadius: 6,
  colorScheme: 'dark', outline: undefined }
export const button = { ...s.btnGhost, ...target, width: 'auto', padding: '10px 16px',
  borderRadius: 8, background: s.card.background, color: s.wrap.color,
  whiteSpace: 'normal', overflowWrap: 'anywhere' }
export const primaryButton = { ...button, background: s.btnPrimary.background,
  color: s.btnPrimary.color, border: `1px solid ${s.btnPrimary.background}` }

// Mounted inside enabled views only; selectors cannot affect other portal tabs.
export const formCss = `
:is(.e2-coach-plan, .e2-portal-plan) :is(input, select, button, summary):focus-visible {
  outline: 3px solid ${s.btnPrimary.background};
  outline-offset: 3px;
}
:is(.e2-coach-plan, .e2-portal-plan) :is(input, select, button):disabled {
  opacity: .65;
  cursor: not-allowed;
}
:is(.e2-coach-plan, .e2-portal-plan) button:enabled:hover {
  border-color: ${s.btnPrimary.background};
  text-decoration: underline;
}
`

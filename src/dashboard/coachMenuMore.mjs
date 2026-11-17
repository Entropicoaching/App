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

// Ordre 1547 (Marc 16. nov. kl. 21:15: "gør evt så man selv kan vælge om man vil have hvid eller mørk tema").
// Coachens menu får samme valg som atletens Mig > Skærm (src/tema/temaValg.mjs): samme nøgle, mærke og knapper.
// Uden hooks og nye imports, fordi menuen også tegnes i lukkede prøveharnesser; uden en browser tegnes intet.
export const COACH_TEMA_NOEGLE = 'entropi:tema'
const TEMAFARVE = { lys: '#f7f2e9', moerk: '#1e1912' }
const temaKnap = aktiv => ({ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
  fontWeight: aktiv ? 700 : 500, border: 'none', color: aktiv ? 'var(--e-bg)' : 'var(--e-tekst)', background: aktiv ? 'var(--e-amber)' : 'transparent' })
export function saetCoachTema(tema, doc = globalThis.document, storage = globalThis.localStorage) {
  const valgt = tema === 'lys' ? 'lys' : 'moerk'
  try { storage?.setItem(COACH_TEMA_NOEGLE, valgt) } catch { /* privat tilstand: gælder kun nu */ }
  if (valgt === 'lys') doc.documentElement.setAttribute('data-tema', 'lys')
  else doc.documentElement.removeAttribute('data-tema')
  doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', TEMAFARVE[valgt])
  return valgt
}
export function CoachTemaValg({ style, doc = globalThis.document } = {}) {
  if (!doc?.documentElement) return null
  const tema = doc.documentElement.getAttribute('data-tema') === 'lys' ? 'lys' : 'moerk'
  const vaelg = (event, vaerdi) => {
    const valgt = saetCoachTema(vaerdi, doc)
    // Knapperne opdateres her; næste tegning læser det samme fra data-tema.
    for (const knap of event.currentTarget.parentElement?.querySelectorAll('[data-tema-knap]') ?? []) {
      const aktiv = knap.getAttribute('data-tema-knap') === valgt
      knap.setAttribute('aria-pressed', String(aktiv))
      Object.assign(knap.style, temaKnap(aktiv))
    }
  }
  const valg = (vaerdi, tekst) => h('button', { type: 'button', key: vaerdi, 'aria-pressed': tema === vaerdi, 'data-tema-knap': vaerdi,
    onClick: event => vaelg(event, vaerdi), style: temaKnap(tema === vaerdi) }, tekst)
  return h('div', { role: 'group', 'aria-label': 'Skærm', 'data-tema-valg': '', style: { marginTop: 12, ...style } },
    h('p', { style: { margin: '0 0 6px', fontSize: 13, color: 'var(--e-tekst2)' } }, 'Skærm'),
    h('div', { style: { display: 'flex', gap: 4, padding: 4, borderRadius: 8, border: '1px solid var(--e-kant)', background: 'var(--e-flade2)' } },
      valg('moerk', 'Mørk'), valg('lys', 'Lys')))
}

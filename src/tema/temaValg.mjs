// Ordre 1542a (Marc 16. nov. kl. 20:45): "farverne er reverserede med lys og mørk, så det er mere natte tema".
// Mørk varm skærm er standard; lys skærm er et valg under Mig, som huskes på telefonen.
// index.html sætter data-tema før første tegning, så skærmen ikke blinker.
import { createElement as h, useState } from 'react'

export const TEMA_NOEGLE = 'entropi:tema'
const TEMAFARVE = { lys: '#f7f2e9', moerk: '#1e1912' }

export function laesTema(storage = globalThis.localStorage) {
  try { return storage?.getItem(TEMA_NOEGLE) === 'lys' ? 'lys' : 'moerk' } catch { return 'moerk' }
}

export function saetTema(tema, { storage = globalThis.localStorage, doc = globalThis.document } = {}) {
  const valgt = tema === 'lys' ? 'lys' : 'moerk'
  try { storage?.setItem(TEMA_NOEGLE, valgt) } catch { /* privat tilstand: gælder kun nu */ }
  if (doc?.documentElement) {
    if (valgt === 'lys') doc.documentElement.setAttribute('data-tema', 'lys')
    else doc.documentElement.removeAttribute('data-tema')
    doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', TEMAFARVE[valgt])
  }
  return valgt
}

const knap = (aktiv) => ({ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
  fontWeight: aktiv ? 700 : 500, border: 'none', color: aktiv ? 'var(--e-bg)' : 'var(--e-tekst)', background: aktiv ? 'var(--e-amber)' : 'transparent' })

export function TemaValg({ style } = {}) {
  const [tema, setTema] = useState(() => laesTema())
  const valg = (vaerdi, tekst) => h('button', { type: 'button', key: vaerdi, 'aria-pressed': tema === vaerdi, 'data-tema-knap': vaerdi,
    onClick: () => setTema(saetTema(vaerdi)), style: knap(tema === vaerdi) }, tekst)
  return h('div', { role: 'group', 'aria-label': 'Skærm', 'data-tema-valg': '', style: { marginTop: 12, ...style } },
    h('p', { style: { margin: '0 0 6px', fontSize: 13, color: 'var(--e-tekst2)' } }, 'Skærm'),
    h('div', { style: { display: 'flex', gap: 4, padding: 4, borderRadius: 8, border: '1px solid var(--e-kant)', background: 'var(--e-flade2)' } },
      valg('moerk', 'Mørk'), valg('lys', 'Lys')))
}

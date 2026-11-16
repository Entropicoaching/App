// Ordre 1541: lys skærm er standard; mørk skærm er et valg, som huskes på telefonen.
// index.html sætter data-tema før første tegning, så skærmen ikke blinker.
import { createElement as h, useState } from 'react'

export const TEMA_NOEGLE = 'entropi:tema'
const TEMAFARVE = { lys: '#f7f2e9', moerk: '#141410' }

export function laesTema(storage = globalThis.localStorage) {
  try { return storage?.getItem(TEMA_NOEGLE) === 'moerk' ? 'moerk' : 'lys' } catch { return 'lys' }
}

export function saetTema(tema, { storage = globalThis.localStorage, doc = globalThis.document } = {}) {
  const valgt = tema === 'moerk' ? 'moerk' : 'lys'
  try { if (valgt === 'moerk') storage?.setItem(TEMA_NOEGLE, 'moerk'); else storage?.removeItem(TEMA_NOEGLE) } catch { /* privat tilstand: gælder kun nu */ }
  if (doc?.documentElement) {
    if (valgt === 'moerk') doc.documentElement.setAttribute('data-tema', 'moerk')
    else doc.documentElement.removeAttribute('data-tema')
    doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', TEMAFARVE[valgt])
  }
  return valgt
}

export function TemaValg({ style } = {}) {
  const [tema, setTema] = useState(() => laesTema())
  const moerk = tema === 'moerk'
  return h('button', { type: 'button', 'aria-pressed': moerk, 'data-tema-valg': '', onClick: () => setTema(saetTema(moerk ? 'lys' : 'moerk')),
    style: { minHeight: 44, width: '100%', boxSizing: 'border-box', padding: '0 14px', marginTop: 12, borderRadius: 8, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 15, textAlign: 'left', color: 'var(--e-tekst)', background: 'transparent', border: '1px solid var(--e-kant)', ...style } },
  moerk ? 'Mørk skærm: til (tryk for lys)' : 'Mørk skærm: fra (tryk for mørk)')
}

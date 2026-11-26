// Ordre 1542a (Marc 16. nov. kl. 20:45): "farverne er reverserede med lys og mørk, så det er mere natte tema".
// Mørk varm skærm er standard; lys skærm er et valg under Mig, som huskes på telefonen.
// index.html sætter data-tema før første tegning, så skærmen ikke blinker.
import { createElement as h, useState } from 'react'

export const TEMA_NOEGLE = 'entropi:tema'
const TEMAFARVE = { lys: '#f7f2e9', moerk: '#1e1912' }

// Gemt valg: 'system' | 'lys' | 'moerk'. Intet gemt valg betyder mørk (standarden er uændret).
export function laesValg(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(TEMA_NOEGLE)
    return v === 'lys' || v === 'system' ? v : 'moerk'
  } catch { return 'moerk' }
}

// Det tema der faktisk vises: 'system' følger telefonens lyse/mørke indstilling.
export function laesTema(storage = globalThis.localStorage, matchMedia = globalThis.matchMedia) {
  const valg = laesValg(storage)
  if (valg !== 'system') return valg
  try { return matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'lys' : 'moerk' } catch { return 'moerk' }
}

export function saetTema(tema, { storage = globalThis.localStorage, doc = globalThis.document, matchMedia = globalThis.matchMedia } = {}) {
  const valg = tema === 'lys' || tema === 'system' ? tema : 'moerk'
  try { storage?.setItem(TEMA_NOEGLE, valg) } catch { /* privat tilstand: gælder kun nu */ }
  let vist = valg
  if (valg === 'system') {
    try { vist = matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'lys' : 'moerk' } catch { vist = 'moerk' }
  }
  if (doc?.documentElement) {
    if (vist === 'lys') doc.documentElement.setAttribute('data-tema', 'lys')
    else doc.documentElement.removeAttribute('data-tema')
    doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', TEMAFARVE[vist])
  }
  return valg
}

const knap = (aktiv) => ({ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
  fontWeight: aktiv ? 700 : 500, border: 'none', color: aktiv ? 'var(--e-bg)' : 'var(--e-tekst)', background: aktiv ? 'var(--e-amber)' : 'transparent' })

export function TemaValg({ style } = {}) {
  const [tema, setTema] = useState(() => laesValg())
  const knapFor = (vaerdi, tekst) => h('button', { type: 'button', key: vaerdi, 'aria-pressed': tema === vaerdi, 'data-tema-knap': vaerdi,
    onClick: () => setTema(saetTema(vaerdi)), style: knap(tema === vaerdi) }, tekst)
  return h('div', { role: 'group', 'aria-label': 'Tema', 'data-tema-valg': '', style: { marginTop: 12, ...style } },
    h('p', { style: { margin: '0 0 6px', fontSize: 13, color: 'var(--e-tekst2)' } }, 'Tema'),
    h('div', { style: { display: 'flex', gap: 4, padding: 4, borderRadius: 8, border: '1px solid var(--e-kant)', background: 'var(--e-flade2)' } },
      knapFor('system', 'System'), knapFor('moerk', 'Mørkt'), knapFor('lys', 'Lyst')))
}

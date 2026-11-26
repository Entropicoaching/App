import test from 'node:test'
import assert from 'node:assert/strict'
import { varmTemaKode, skalTemaes } from './varmTema.mjs'
import { laesTema, laesValg, saetTema, TEMA_NOEGLE } from './temaValg.mjs'

test('faste mørke farver bliver til temavariabler', () => {
  const ud = varmTemaKode(`const s = { background: '#141410', color: '#EDEAE2', border: '1px solid rgba(237,234,226,0.07)' }`, '/src/x.jsx')
  assert.match(ud, /background: 'var\(--e-bg\)'/)
  assert.match(ud, /color: 'var\(--e-tekst\)'/)
  assert.match(ud, /rgba\(var\(--e-tekst-rgb\), calc\(0\.07 \* var\(--e-alfa\)\)\)/)
})

test('ukendte farver og SVG-attributter bliver stående', () => {
  assert.equal(varmTemaKode(`x = '#123456'`, '/src/x.jsx'), `x = '#123456'`)
  assert.equal(varmTemaKode(`<path fill="#edeae2" />`, '/src/x.jsx'), `<path fill="#edeae2" />`)
})

test('sjældne farver falder tilbage til den gamle hex i mørk tilstand', () => {
  assert.match(varmTemaKode(`c = '#31291c'`, '/src/x.jsx'), /var\(--e-h31291c, #31291c\)/)
})

test('alfa efter en farvevariabel giver gyldig CSS', () => {
  const ud = varmTemaKode('b = `1px solid ${item.color}44`; c = color + \'33\'', '/src/x.jsx')
  assert.match(ud, /__eAlfa\(item\.color, '44'\)/)
  assert.match(ud, /__eAlfa\(color, '33'\)/)
  const __eAlfa = new Function(ud.slice(ud.indexOf('function __eAlfa')) + '; return __eAlfa')()
  assert.equal(__eAlfa('#c8923a', '33'), '#c8923a33')
  assert.equal(__eAlfa('var(--e-amber)', '33'), 'color-mix(in srgb, var(--e-amber) 20%, transparent)')
  assert.equal(__eAlfa(7, '00'), '700')
})

test('kun appens egne filer temaes', () => {
  assert.equal(skalTemaes('C:/r/src/athlete/BundNav.jsx'), true)
  assert.equal(skalTemaes('C:/r/src/athlete/bundNav.test.mjs'), false)
  assert.equal(skalTemaes('C:/r/src/tema/tema.css'), false)
  assert.equal(skalTemaes('C:/r/node_modules/react/index.js'), false)
  assert.equal(skalTemaes('C:/r/src/videoCompression2.mjs'), false)
})

test('mørk er standard (1542a); lys huskes og kan slås fra igen', () => {
  const data = new Map()
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }
  const attrs = {}
  const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v }, removeAttribute: k => { delete attrs[k] } }, querySelector: () => null }
  assert.equal(laesTema(storage), 'moerk')
  data.set(TEMA_NOEGLE, 'moerk'); assert.equal(laesTema(storage), 'moerk', 'valget fra 1541 giver stadig mørk')
  saetTema('lys', { storage, doc })
  assert.equal(data.get(TEMA_NOEGLE), 'lys'); assert.equal(attrs['data-tema'], 'lys'); assert.equal(laesTema(storage), 'lys')
  saetTema('moerk', { storage, doc })
  assert.equal(laesTema(storage), 'moerk'); assert.equal(attrs['data-tema'], undefined)
  assert.equal(laesTema({ getItem: () => { throw new Error('privat') } }), 'moerk')
})

test('tema.css: mørk varm bund som standard, lys kun med data-tema="lys"', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('./tema.css', import.meta.url), 'utf8')
  const rod = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
  assert.match(rod, /--e-bg: #1e1912;/)
  assert.match(rod, /color-scheme: dark;/)
  assert.match(css, /:root\[data-tema="lys"\] \{\s+--e-bg: #f7f2e9;/)
  assert.doesNotMatch(css, /data-tema="moerk"/)
})

test('System / Mørkt / Lyst: valget gemmes lokalt, system følger telefonen, standard er mørk (2412)', () => {
  const data = new Map()
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }
  const attrs = {}
  const meta = { content: '' }
  const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v }, removeAttribute: k => { delete attrs[k] } },
    querySelector: () => ({ setAttribute: (_k, v) => { meta.content = v } }) }
  const lysTelefon = () => ({ matches: true }), moerkTelefon = () => ({ matches: false })
  assert.equal(laesValg(storage), 'moerk', 'intet gemt valg giver mørk som i dag')
  assert.equal(saetTema('system', { storage, doc, matchMedia: lysTelefon }), 'system')
  assert.equal(data.get(TEMA_NOEGLE), 'system'); assert.equal(attrs['data-tema'], 'lys'); assert.equal(meta.content, '#f7f2e9')
  assert.equal(laesValg(storage), 'system'); assert.equal(laesTema(storage, lysTelefon), 'lys'); assert.equal(laesTema(storage, moerkTelefon), 'moerk')
  saetTema('system', { storage, doc, matchMedia: moerkTelefon })
  assert.equal(attrs['data-tema'], undefined); assert.equal(meta.content, '#1e1912')
  saetTema('lys', { storage, doc, matchMedia: moerkTelefon })
  assert.equal(laesTema(storage, moerkTelefon), 'lys', 'fast lyst ignorerer telefonen')
  assert.equal(saetTema('noget-andet', { storage, doc }), 'moerk')
  assert.equal(laesValg({ getItem: () => { throw new Error('privat') } }), 'moerk')
  assert.equal(saetTema('lys', { storage: { setItem: () => { throw new Error('fuld') } }, doc }), 'lys', 'gemning i try/catch')
})

test('index.html: system løses før første tegning', async () => {
  const { readFile } = await import('node:fs/promises')
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8')
  assert.match(html, /v==="system"[^;]*prefers-color-scheme: light/)
  assert.ok(html.indexOf('v==="system"') < html.indexOf('<script type="module"'))
})

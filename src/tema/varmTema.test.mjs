import test from 'node:test'
import assert from 'node:assert/strict'
import { varmTemaKode, skalTemaes } from './varmTema.mjs'
import { laesTema, saetTema, TEMA_NOEGLE } from './temaValg.mjs'

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

test('lys er standard; mørk huskes og kan slås fra', () => {
  const data = new Map()
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }
  const attrs = {}
  const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v }, removeAttribute: k => { delete attrs[k] } }, querySelector: () => null }
  assert.equal(laesTema(storage), 'lys')
  saetTema('moerk', { storage, doc })
  assert.equal(data.get(TEMA_NOEGLE), 'moerk'); assert.equal(attrs['data-tema'], 'moerk'); assert.equal(laesTema(storage), 'moerk')
  saetTema('lys', { storage, doc })
  assert.equal(laesTema(storage), 'lys'); assert.equal(attrs['data-tema'], undefined)
})

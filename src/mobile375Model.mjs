import { readFileSync, existsSync } from 'node:fs'
const root = new URL('./', import.meta.url)
export function source(name, path = name) {
  const flat = new URL(name, root)
  return readFileSync(existsSync(flat) ? flat : new URL(path.startsWith('scripts/') ? '../' + path : path.replace(/^src\//, ''), root), 'utf8')
}
// Deliberately small CSS contract evaluator, not a browser layout engine.
export function rules(css, width) {
  const media = /^\s*\/\*[\s\S]*?\*\/\s*@media\s*\(max-width:\s*(\d+)px\)\s*\{([\s\S]*)\}\s*$/.exec(css)
  if (!media) throw new Error('Expected one narrow media query and no unscoped rules')
  if (width > Number(media[1])) return []
  return [...media[2].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(), declarations: Object.fromEntries(body.split(';').filter(s => s.trim()).map(s => {
      const at = s.indexOf(':'); if (at < 0) throw new Error('Invalid declaration')
      return [s.slice(0, at).trim(), s.slice(at + 1).trim()]
    })),
  }))
}
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
export function style(css, width, selector, inline = {}) {
  const result = { ...inline }
  for (const rule of rules(css, width).filter(rule => rule.selector === selector)) {
    for (const [name, value] of Object.entries(rule.declarations)) {
      const prop = camel(name), important = /\s*!important$/.test(value)
      if (!(prop in inline) || important) result[prop] = value.replace(/\s*!important$/, '')
    }
  }
  return result
}
export function assertContract(assert, css) {
  const root = style(css, 375, '[data-app-375]', { overflowX: 'hidden' })
  assert.equal(root.width, '100%'); assert.equal(root.maxWidth, '100vw')
  assert.equal(root.minWidth, '0'); assert.equal(root.boxSizing, 'border-box')
  assert.equal(root.overflowWrap, 'anywhere'); assert.equal(root.overflowX, 'visible')
  const page = style(css, 375, '[data-app-375] [data-app-375-page]')
  assert.equal(page.width, '100%'); assert.equal(page.boxSizing, 'border-box'); assert.equal(page.minWidth, '0')
  assert.equal(style(css, 375, '[data-app-375="coach"] > main', { width: 'calc(100% - 220px)', overflowX: 'hidden' }).width, '100%')
  assert.equal(style(css, 375, '[data-app-375="coach"] > main', { overflowX: 'hidden' }).overflowX, 'visible')
  assert.equal(style(css, 375, '[data-app-375] [data-app-375-grid]', { gridTemplateColumns: '1fr 1fr' }).gridTemplateColumns, 'repeat(2, minmax(0, 1fr))')
  assert.equal(style(css, 375, '[data-app-375] [data-coach-week] span', { whiteSpace: 'nowrap' }).whiteSpace, 'normal')
  assert.equal(style(css, 375, '[data-app-375] [data-coach-week] button').boxSizing, 'border-box')
  assert.equal(rules(css, 376).length, 0)
  for (const rule of rules(css, 375)) {
    assert.ok(rule.selector.startsWith('[data-app-375]') || rule.selector.startsWith('[data-app-375="coach"]') || rule.selector === '[data-friday-preview]')
    assert.ok(!Object.entries(rule.declarations).some(([k,v]) => /overflow|display|visibility/.test(k) && /hidden|clip|none/.test(v)))
  }
}

// Rename accessible copy in memory to prove the actual screen's accent is independent.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { contrastFixture } from './programContrastFixture.mjs'
const renderer = new URL('./programBlockOverview.mjs', import.meta.url).href
registerHooks({ load(url, context, next) {
  if (url !== renderer) return next(url, context)
  return { format: 'module', shortCircuit: true, source: readFileSync(new URL(url), 'utf8')
    .replaceAll("'aria-label': 'Din aktuelle blok'", "'aria-label': 'Programoversigt'") }
} })
install()
const { default: Program } = await import('./ProgramTab.jsx')

test('ready and failed overview roots keep their accent when the accessible label changes', () => {
  for (const programError of [false, true]) {
    const tree = mount(Program, contrastFixture({ programError })).render()
    const marked = nodes(tree, n => n.props['data-program-block-overview'] === true)
    assert.equal(marked.length, 1)
    const root = marked[0]
    assert.equal(root.props['aria-label'], 'Programoversigt')
    assert.equal(root.props.style.borderInlineStart, '4px solid #c8923a')
    assert.match(text(root), programError ? /kunne ikke hentes/ : /Uge 2 af 3/)
    assert.equal(nodes(root, n => n !== root && n.props.style?.borderInlineStart).length, 0)
  }
})

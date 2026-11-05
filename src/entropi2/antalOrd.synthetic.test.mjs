import test from 'node:test'
import { register } from 'node:module'

// This exercises the actual stateless product modules with synthetic elements.
// It does not replace the separate, mandatory real React SSR tests.
register('./analysis/reactElementLoader.mjs', import.meta.url)
const { createElement: h } = await import('./analysis/reactElementFixture.mjs')
const { verifyMineData, verifyDevelopment, verifySleep, verifyUpload } = await import('./antalTekstCases.mjs')
function render(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(render).join(' ')
  if (typeof node !== 'object') return String(node)
  return typeof node.type === 'function' ? render(node.type(node.props)) : render(node.props.children)
}
test('synthetic elements: actual MineData zero/one/many and ratio words', () => verifyMineData(h, render))
test('synthetic elements: actual development single observed week and OFF', () => verifyDevelopment(h, render))
test('synthetic elements: actual daily/weekly sleep values and OFF', () => verifySleep(h, render))
test('synthetic elements: actual upload labels and range/unknown preservation', () => verifyUpload(h, render))

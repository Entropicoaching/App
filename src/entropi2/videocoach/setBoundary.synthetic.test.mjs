import test from 'node:test'
import assert from 'node:assert/strict'
import { renderUpload } from './view.mjs'
import { createUploadController } from './uploadController.mjs'
import { pausedSet, sourceFor } from './setBoundaryFixture.mjs'
import { verifyBoundaryViews } from './setBoundaryViewCases.mjs'

// Deliberately synthetic DOM/element host. No React substitute is exported or
// installed; the separate .react.test.mjs runs these states with actual React.
function h(tagName, props, ...children) {
  return { tagName, props: props || {}, children: children.flat(Infinity).filter(n => n != null && n !== false),
    get textContent() { return this.children.map(text).join(' ') },
    dispatch(event, data = {}) { return this.props[event]?.(data) } }
}
const text = n => n == null || typeof n === 'boolean' ? '' : typeof n === 'object' ? n.textContent : String(n)
function nodes(n) { return typeof n !== 'object' || !n ? [] : [n, ...n.children.flatMap(nodes)] }
const find = (tree, predicate) => nodes(tree).find(predicate)
const button = (tree, label) => find(tree, n => n.tagName === 'button' && n.textContent === label)
function controller() {
  const c = createUploadController({ enabled: true, options: [{ key: 'synthetic', exercise_name: 'Syntetisk løft', set_number: 1 }] })
  c.choose('synthetic'); c.next()
  return c
}
const view = c => renderUpload(h, { controller: c, state: c.snapshot() })

test('synthetic DOM: actual views show ready, empty, incomplete, too-long, manual, error and OFF states', () => {
  verifyBoundaryViews(h, text)
})
test('synthetic DOM: empty automatic analysis blocks Continue until an actual manual slider event', () => {
  const c = controller(); c.select(sourceFor({ lift: 'bench', samples: [] }))
  let tree = view(c)
  assert.equal(button(tree, 'Fortsæt').props.disabled, true)
  const slider = find(tree, n => n.props['aria-label'] === 'Flyt dit valgte løft')
  let prevented = false
  slider.dispatch('onKeyDown', { key: 'Home', preventDefault() { prevented = true } })
  tree = view(c)
  assert.equal(prevented, true); assert.equal(button(tree, 'Fortsæt').props.disabled, false)
  assert.match(tree.textContent, /valgt intervallet manuelt/)
  button(tree, 'Fortsæt').dispatch('onClick')
  assert.equal(c.snapshot().step, 3)
})
test('synthetic DOM: ready set provides exact buffered window to preview and timeline', () => {
  const c = controller(); c.select(sourceFor(pausedSet(), 30))
  let preview
  const tree = renderUpload(h, { controller: c, state: c.snapshot(), renderPreview(data) { preview = data; return h('div', null, 'Syntetisk forhåndsvisning') } })
  assert.deepEqual(preview.window, c.snapshot().window)
  const slider = find(tree, n => n.props.role === 'slider')
  assert.equal(slider.props['aria-valuenow'], c.snapshot().window.start)
  assert.equal(button(tree, 'Fortsæt').props.disabled, false)
  assert.ok(find(tree, n => n.props.role === 'status' && /Hele sættet/.test(n.textContent)))
})
test('synthetic DOM: invalid new signal displays an alert and keeps the last valid preview', () => {
  const c = controller(); c.select(sourceFor(pausedSet()))
  const before = c.snapshot().window
  c.select(sourceFor({ lift: 'bench', samples: [{ time: 0, position: 2, atRest: true }] }))
  const tree = view(c)
  assert.match(find(tree, n => n.props.role === 'alert').textContent, /Bevægelsesdata/)
  assert.deepEqual(c.snapshot().window, before)
})
test('synthetic DOM: legacy metadata-only source keeps the manual tail-window explanation', () => {
  const c = controller(); c.select({ id: 'synthetic', label: 'Syntetisk', duration: 30 })
  assert.match(view(c).textContent, /Vi starter med slutningen/)
})

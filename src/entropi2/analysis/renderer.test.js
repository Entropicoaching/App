import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, Element, renderTree } from './testDom.mjs'

test('renderer: frozen host element descriptions preserve nested text and events', () => {
  const calls = []
  const onClick = event => { calls.push(event); return 'routed' }
  const event = { type: 'click' }
  const props = Object.freeze({ type: 'button', onClick,
    children: Object.freeze(['Open <img>', [null, false, 3]]) })
  const input = Object.freeze({ type: 'button', props })
  const dom = renderTree(input)
  assert.ok(dom instanceof Element)
  assert.equal(dom.textContent, 'Open <img>3')
  assert.equal(dom.getAttribute('type'), 'button')
  assert.equal(dom.getAttribute('children'), null)
  assert.equal(dom.querySelectorAll('img').length, 0)
  assert.equal(dom.listeners.click, onClick)
  assert.equal(dom.dispatchEvent(event), 'routed')
  assert.deepEqual(calls, [event])
  assert.equal(input.props, props)
})

test('renderer: one child, absent children and synthetic nodes are explicit', () => {
  const child = Object.freeze({ type: 'h2', props: Object.freeze({ children: 'Question' }) })
  const dom = renderTree({ type: 'section', props: { children: child } })
  assert.equal(dom.querySelectorAll('h2')[0].textContent, 'Question')
  assert.equal(renderTree({ type: 'section', props: {} }).textContent, '')
  const synthetic = createElement('p', {}, 'ready')
  assert.equal(renderTree(synthetic), synthetic)
  for (const empty of [null, undefined, false, true]) assert.equal(renderTree(empty), null)
})

test('renderer: navigation errors propagate from host descriptions', () => {
  const error = new Error('navigation failed')
  const dom = renderTree({ type: 'button', props: { onClick() { throw error } } })
  assert.throws(() => dom.dispatchEvent({ type: 'click' }), e => e === error)
})

test('renderer: unsupported component descriptions fail instead of fabricating DOM', () => {
  for (const input of [{}, { type() {}, props: {} }, { type: 'p' }])
    assert.throws(() => renderTree(input), /Expected a host React element/)
})

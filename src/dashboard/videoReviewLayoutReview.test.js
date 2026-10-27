import test from 'node:test'
import assert from 'node:assert/strict'
import { readVideoReviewFlag, renderVideoReviewLayout, videoReviewConclusion } from './videoReviewLayout.mjs'

const fragment = Symbol('fragment')
const h = (tag, props, ...children) => ({ tag, props: props || {}, children })

test('Modproeve: storage-getter kaster, flag forbliver fra uden at skrive', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('denied') } })
  try { assert.equal(readVideoReviewFlag(), false) }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('Modproeve: langt fokus og HTML-lignende tekst bevares som tekst, ingen HTML-injektion', () => {
  const focus = '<img src=x onerror=alert(1)>\n' + 'Lang tekst '.repeat(200)
  const conclusion = videoReviewConclusion({ status: 'draft', focus, quality: { canShare: true } })
  assert.equal(conclusion.focus, focus.trim())
  const tree = renderVideoReviewLayout(h, fragment, { conclusion }, true)
  const paragraph = tree.children[0].children[2]
  assert.equal(paragraph.children[1], focus.trim())
  assert.equal(paragraph.props.dangerouslySetInnerHTML, undefined)
  assert.equal(videoReviewConclusion({ status: 'draft', focus: {} }).focus, 'Intet fokus angivet i feedbacken.')
})

test('Modproeve: begge layouts genbruger samme editor, callbacks og maalegrundlag', () => {
  let edits = 0, closes = 0
  const editor = h('textarea', { onChange: () => edits++ })
  const action = h('button', { onClick: () => closes++ })
  const measurement = h('svg', {})
  const parts = { feedback: editor, actions: action, measurement, conclusion: videoReviewConclusion({ status: 'shared', focus: 'Ro i bunden' }) }
  const before = renderVideoReviewLayout(h, fragment, parts, false)
  const after = renderVideoReviewLayout(h, fragment, parts, true)
  assert.equal(before.children[4], after.children[2])
  assert.equal(before.children[5], after.children[3])
  assert.equal(after.children[4].children[1], measurement)
  assert.equal(edits + closes, 0)
  after.children[2].props.onChange()
  after.children[3].props.onClick()
  assert.equal(edits, 1); assert.equal(closes, 1)
})

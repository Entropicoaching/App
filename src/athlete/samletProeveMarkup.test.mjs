import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCleanMarkup, assertNoWriteButtons, nodeText, markupTree } from './samletProeveMarkup.mjs'

test('release text gate rejects literal, split and entity-encoded corruption', () => {
  for (const text of ['ukendt', 'UKENDT', 'undefined', 'NaN', '[object Object]', 'u<span>n</span>defined', '&#78;aN']) {
    assert.throws(() => assertCleanMarkup(`<main>${text}</main>`))
  }
  assertCleanMarkup('<main><p>Ingen data endnu.</p></main>')
})

test('fold gate requires content after the summary and checks nested folds', () => {
  for (const body of ['', ' ', '<div></div>', '<!-- pending -->']) {
    assert.throws(() => assertCleanMarkup(`<details><summary>Mere</summary>${body}</details>`))
  }
  assert.throws(() => assertCleanMarkup('<details><summary>Ydre</summary><details><summary>Indre</summary></details></details>'))
  assertCleanMarkup('<details><summary>Mere</summary><p>Ingen registreringer endnu.</p></details>')
  assertCleanMarkup('<details><summary>Indtast</summary><input type="number"/></details>')
})

test('preview gate rejects writes even inside disabled fieldsets', () => {
  for (const label of ['Gem', 'Log sæt', 'Send besked', 'Registrér', 'Spring resten over', 'Film et sæt', 'Start dagens pas', 'Start næste pas']) {
    assert.throws(() => assertNoWriteButtons(`<fieldset disabled=""><button disabled="">${label}</button></fieldset>`))
  }
  assertNoWriteButtons('<button>Se mit program</button><button>Tilbage</button>')
  assert.throws(() => assertNoWriteButtons('<input type="submit" value="Gem"/>'))
})

test('parser handles React comments, escaped text, quoted > and void elements', () => {
  const tree = markupTree('<section title="a > b"><p>Test<!-- --> &amp; &#xE6;</p><input/><br/></section>')
  assert.equal(nodeText(tree), 'Test & æ')
  assert.throws(() => markupTree('<section><p>x</section>'))
})

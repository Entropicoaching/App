// App npm test: actual React/ReactDOM, with only JSX syntax and services adapted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { programQolFixture } from './programQolFixture.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => renderToStaticMarkup(createElement(Program, programQolFixture(extra)))

test('React: next action leads; historical weeks occur once in a closed fold; logger stays outside', () => {
  const html = render({ progOpenSession: 'session-1-0' })
  assert.match(html, /^<button[^>]*data-program-next=""/)
  assert.match(html, /Næste pas · Pas 1-0/)
  const history = /<details\b[^>]*data-program-history="true"[^>]*>.*?<\/details>/.exec(html)?.[0]
  assert.ok(history)
  assert.doesNotMatch(history, /\bopen(?:=|\s|>)/)
  assert.match(history, /Vis tidligere uger/)
  assert.doesNotMatch(history, /<input|Vægt, sæt/)
  assert.match(html, /aria-label="Vægt, sæt 1"/)
  assert.equal((html.match(/<strong>Uge 0/g) || []).length, 1)
  assert.match(html, /background:#1c1c18/)
})

test('React: exact completion and skips advance next action; errors and strict OFF omit it', () => {
  for (const skipped of [false, true]) {
    const html = render({ exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, skipped }] })
    assert.match(html, /Næste pas · Pas 1-1/)
    assert.match(html, skipped ? /Afsluttet · sæt sprunget over/ : /Gennemført ✓/)
  }
  for (const extra of [{ programError: true }, ...[false, null, 0, 1, 'true'].map(entropi2 => ({ entropi2 }))]) {
    const html = render(extra)
    assert.doesNotMatch(html, /data-program-next/)
    if (!extra.programError) assert.doesNotMatch(html, /data-program-history/)
  }
})

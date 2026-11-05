// Runs in the app's npm test with real React/ReactDOM and the existing JSX-only loader.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { contrastFixture, contrastRatio } from './programContrastFixture.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = props => renderToStaticMarkup(createElement(Program, props))

function spanColour(html, content) {
  const span = [...html.matchAll(/<span\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/span>/g)]
    .find(match => content.test(match[2]))
  assert.ok(span, `expected span ${content}`)
  const colour = /(?:^|;)color:(#[0-9a-f]{6})(?:;|$)/.exec(span[1])
  assert.ok(colour)
  return colour[1]
}

test('real React renders AA date and planned/historical captions against the program card', () => {
  for (const viewingWeekIdx of [0, 2]) {
    const html = render(contrastFixture({ viewingWeekIdx }))
    assert.match(html, /background:#1c1c18/)
    for (const colour of [spanColour(html, /^2\. nov.*22\. nov/),
      spanColour(html, viewingWeekIdx === 0 ? /^Historisk · uge 1/ : /^Planlagt · uge 3/)]) {
      assert.equal(colour, '#c4c0b5')
      assert.ok(contrastRatio(colour, '#1c1c18') >= 4.5)
    }
  }
})

test('real React preserves overview children and the marked accent in ready and error states', () => {
  for (const programError of [false, true]) {
    const html = render(contrastFixture({ programError }))
    const root = /<section\b[^>]*data-program-block-overview="true"[^>]*>/.exec(html)
    assert.ok(root)
    assert.match(root[0], /aria-label="Din aktuelle blok"/)
    assert.match(root[0], /border-inline-start:4px solid #c8923a/)
    assert.equal((html.match(/data-program-block-overview=/g) || []).length, 1)
    assert.match(html, programError ? /Dit blokoverblik kunne ikke hentes/ : /Uge 2 af 3/)
    if (programError) assert.match(html, /Prøv igen/)
    else assert.match(html, /Blokkens uger og planlagte sæt/)
  }
})

test('real React strict OFF retains the legacy text colours with either block overview flag', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    for (const programBlokOversigt of [false, true]) {
      for (const viewingWeekIdx of [0, 2]) {
        const html = render(contrastFixture({ entropi2, programBlokOversigt, viewingWeekIdx }))
        assert.equal(spanColour(html, /^2\. nov.*22\. nov/), '#7a7770')
        assert.equal(spanColour(html, /^(Planlagt|Historisk) · uge/), '#7a7770')
        assert.doesNotMatch(html, /data-program-block-overview/)
      }
    }
  }
})

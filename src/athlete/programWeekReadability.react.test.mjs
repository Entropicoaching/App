// App npm test discovers this file. Real React is required; no fallback or skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { programQolFixture } from './programQolFixture.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => renderToStaticMarkup(createElement(Program, programQolFixture(extra)))

test('React: week buttons and context have readable type, wrapping and 44px targets', () => {
  for (const viewingWeekIdx of [0, 1, 2]) {
    const html = render({ viewingWeekIdx, fmtWeekRange: () => 'Syntetisk datoperiode' })
    for (const label of ['← Forrige uge', 'Næste uge →', ...(viewingWeekIdx === 1 ? [] : ['↩ Tilbage til denne uge'])]) {
      const tag = [...html.matchAll(/<button\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/button>/g)].find(m => m[2] === label)
      assert.ok(tag, label)
      for (const rule of ['font-size:1rem', 'line-height:1.5', 'letter-spacing:normal', 'text-transform:none',
        'white-space:normal', 'overflow-wrap:anywhere', 'min-height:44px', 'min-width:44px']) assert.ok(tag[1].split(';').includes(rule), rule)
    }
    const heading = [...html.matchAll(/<div\b[^>]*style="([^"]*)"[^>]*>Uge (\d+) · Syntetisk datoperiode/g)]
      .find(m => Number(m[2]) === viewingWeekIdx)
    assert.ok(heading)
    assert.match(heading[1], /font-size:1rem/)
    assert.match(html, /\[data-program-week-navigation\] button:focus-visible/)
    assert.match(html, /Næste pas/)
    assert.match(html, viewingWeekIdx === 0 ? /historisk/ : viewingWeekIdx === 2 ? /planlagt/ : /Du er her/)
  }
})

test('React: strict OFF keeps legacy week typography and no new scope', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const html = render({ entropi2, viewingWeekIdx: 0 })
    assert.doesNotMatch(html, /data-program-week-navigation/)
    const next = [...html.matchAll(/<button\b[^>]*style="([^"]*)"[^>]*>Næste uge →<\/button>/g)][0]
    assert.ok(next)
    assert.match(next[1], /font-size:0\.58rem/)
    assert.match(next[1], /text-transform:uppercase/)
  }
})

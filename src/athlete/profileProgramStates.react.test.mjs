// Required real React/ReactDOM checks. No fallback, skip or fake renderer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfilePage } from '../entropi2/profile/ProfilePage.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => renderToStaticMarkup(h(Program, programQolFixture({ allWeeks: [], currentWeek: null, ...extra })))

test('real React: owned profile has an explicit surface, light headings, goals and folded export', () => {
  for (const data of [{}, { name: 'Testatlet', kcal_target: 2200 }]) {
    const html = renderToStaticMarkup(h(ProfilePage, { enabled: true, ownerId: 'fixture-user',
      athlete: { id: 'fixture-athlete', user_id: 'fixture-user', ...data }, onClose() {},
      client: { from() { assert.fail('render must not access data') } } }))
    assert.match(html, /data-entropi2-profile=""[^>]*style="[^"]*background:#141410/)
    assert.match(html, /<h1[^>]*style="[^"]*color:#edeae2[^>]*>Mig<\/h1>/)
    assert.match(html, /Mine mål og stævne/)
    assert.match(html, /<details[^>]*>.*Eksportér mine data/)
    assert.doesNotMatch(html, /<details[^>]* open/)
  }
  assert.equal(renderToStaticMarkup(h(ProfilePage, { enabled: false })), '')
})

test('real React: empty and failure have distinct visible semantics and only the error offers retry', () => {
  const empty = render()
  assert.match(empty, /data-program-empty-state="" role="status"/)
  assert.match(empty, /<h2[^>]*>Dit program er på vej\.<\/h2>/)
  assert.match(empty, />Entropi\.<\/div>/)
  assert.match(empty, />Din coach sætter det op inden din næste træning\.<\/p>/)
  assert.doesNotMatch(empty, /<button|<details|Du har ikke et program endnu|kunne ikke hentes/)
  const error = render({ programError: true, fetchProgram() { assert.fail('render must not retry') } })
  assert.match(error, /data-program-empty-state="" role="alert"/)
  assert.match(error, /<button type="button"[^>]*>Prøv igen<\/button>/)
  assert.doesNotMatch(error, /Entropi\.|Dit program er på vej|inden din næste træning/)
  for (const html of [empty, error]) {
    assert.match(html, /font-size:16px;line-height:1.6;letter-spacing:normal/)
    assert.match(html, /overflow-wrap:anywhere/)
  }
})

test('real React: strict OFF retains the legacy state and populated weeks keep their logger', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const html = render({ entropi2 })
    assert.doesNotMatch(html, /data-program-empty-state/)
    assert.match(html, /Dit program er på vej/)
  }
  const html = renderToStaticMarkup(h(Program, programQolFixture({ progOpenSession: 'session-1-0' })))
  assert.doesNotMatch(html, /data-program-empty-state/)
  assert.match(html, />Log<\/button>/)
})

function inlineStyle(tag) {
  assert.ok(tag, 'expected rendered element')
  const style = /style="([^"]*)"/.exec(tag)
  assert.ok(style, 'expected inline style')
  // React escapes quotes in font-family as &#x27; whose ';' must not split declarations.
  const css = style[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  return Object.fromEntries(css.split(';').filter(Boolean).map(value => {
    const separator = value.indexOf(':')
    return [value.slice(0, separator), value.slice(separator + 1)]
  }))
}

test('real React: retry overrides inherited ghost typography with 16 px sentence case and a 48 px target', () => {
  const error = render({ programError: true })
  const tag = /<button\b[^>]*>Prøv igen<\/button>/.exec(error)?.[0]
  const style = inlineStyle(tag)
  assert.equal(style['font-size'], '16px')
  assert.match(style['font-family'], /IBM Plex Sans/)
  assert.equal(style['line-height'], '1.5')
  assert.equal(style['letter-spacing'], 'normal')
  assert.equal(style['text-transform'], 'none')
  assert.equal(style['min-height'], '48px')
  assert.equal(style['min-width'], '44px')
  assert.equal(style['white-space'], 'normal')
  assert.equal(style['overflow-wrap'], 'anywhere')
  assert.equal(style.color, '#c4c0b5')
})

test('real React: both state cards use 20 px padding, 16 px radius and the existing scoped focus rule', () => {
  for (const programError of [false, true]) {
    const html = render({ programError })
    const tag = /<section\b[^>]*data-program-empty-state=""[^>]*>/.exec(html)?.[0]
    const style = inlineStyle(tag)
    assert.equal(style.padding, '20px')
    assert.equal(style['border-radius'], '16px')
    assert.equal(style['box-sizing'], 'border-box')
    assert.equal(style['min-width'], '0')
    assert.equal(style['overflow-wrap'], 'anywhere')
    assert.equal(style.background, '#1c1c18')
    assert.match(tag, /data-program-accessible=""/)
    assert.match(html, /\[data-program-accessible\] :is\(input, textarea, select, button\):focus-visible/)
    assert.match(html, /outline: 3px solid #c8923a !important/)
  }
})

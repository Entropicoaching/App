// Mandatory real React regression for npm test. No fallback or silent skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Profile from '../entropi2/profile/Profile.mjs'
import { contrastRatio } from './programContrastFixture.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'

installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = props => renderToStaticMarkup(h(Program, programQolFixture(props)))

test('real React F4: profile headings carry an explicit AA colour', () => {
  const html = renderToStaticMarkup(h(Profile, { enabled: true, athlete: { name: 'Testatlet', kcal_target: 2200 } }))
  const headings = [...html.matchAll(/<h[12]\b[^>]*style="([^"]*)"/g)]
  assert.equal(headings.length, 2)
  for (const [, style] of headings) {
    const colour = /(?:^|;)color:(#[a-f0-9]{6})(?:;|$)/.exec(style)?.[1]
    assert.ok(colour)
    for (const background of ['#141410', '#1c1c18']) assert.ok(contrastRatio(colour, background) >= 4.5)
  }
  assert.equal(renderToStaticMarkup(h(Profile, { enabled: false })), '')
})

test('real React F4/F6: return, retry and RPE help buttons preserve text with accessible styles', () => {
  for (const [props, label] of [
    [{ viewingWeekIdx: 0 }, '↩ Tilbage til denne uge'],
    [{ allWeeks: [], currentWeek: null, programError: true }, 'Prøv igen'],
    [{ progOpenSession: 'session-1-0' }, 'ℹ'],
  ]) {
    const html = render(props)
    const button = [...html.matchAll(/<button\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/button>/g)]
      .find(match => match[2] === label)
    assert.ok(button, label)
    // R1-E2-VIS-PROFIL1: the E2 retry may be taller (48 px); every button keeps at least 44 px.
    assert.ok(Number(/(?:^|;)min-height:(\d+)px(?:;|$)/.exec(button[1])?.[1]) >= 44, label)
    assert.match(button[1], /(?:^|;)min-width:44px(?:;|$)/)
    assert.doesNotMatch(html, /(?:^|;)color:#(?:4a4844|7a7770)(?:;|&quot;|")/)
    for (const background of ['#141410', '#1c1c18', '#181816', '#292216'])
      assert.ok(contrastRatio('#c4c0b5', background) >= 4.5)
  }
})

test('real React strict OFF keeps the return action original dimensions and colours', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const html = render({ entropi2, viewingWeekIdx: 0 })
    const button = [...html.matchAll(/<button\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/button>/g)]
      .find(match => match[2] === '↩ Tilbage til denne uge')
    assert.ok(button)
    assert.doesNotMatch(button[1], /min-(?:height|width):44px/)
    assert.match(html, /color:#7a7770/)
  }
})

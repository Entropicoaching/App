// Discovered by npm test. Requires real React/ReactDOM; never falls back or skips.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { contrastRatio } from './programContrastFixture.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = props => renderToStaticMarkup(createElement(Program, props))

test('React colours: empty/error cards retain their neutral surface and accessibility contracts', () => {
  for (const programError of [false, true]) {
    const html = render(programQolFixture({ allWeeks: [], currentWeek: null, programError,
      fetchProgram() { assert.fail('render must not retry') } }))
    const tag = /<section\b[^>]*data-program-empty-state=""[^>]*>/.exec(html)?.[0]
    assert.ok(tag)
    assert.match(tag, new RegExp(`role="${programError ? 'alert' : 'status'}"`))
    assert.match(tag, /data-program-accessible=""/)
    const style = /style="([^"]*)"/.exec(tag)[1]
    for (const declaration of ['background:#1c1c18', 'padding:20px', 'border-radius:16px',
      'box-sizing:border-box', 'min-width:0', 'overflow-wrap:anywhere', 'color:#edeae2']) {
      assert.ok(style.split(';').includes(declaration), declaration)
    }
    assert.match(html, /outline: 3px solid #c8923a !important/)
    assert.doesNotMatch(html, /data-program-session-tone|data-program-week-tone|background:#202b3b/)
    assert.match(html, programError ? /Dit program kunne ikke hentes/ : /Dit program er på vej/)
    if (programError) assert.match(html, /<button type="button"[^>]*min-height:48px[^>]*>Prøv igen<\/button>/)
    else assert.doesNotMatch(html, /<button/)
  }
  const planned = render(programQolFixture({ viewingWeekIdx: 2 }))
  assert.match(planned, /data-program-session-tone="plan"/)
  assert.match(planned, /data-program-week-navigation="true"[^>]*background:#202b3b/)
})

test('React colours: current, completed and skipped passes retain text, aria and contrast', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-09T12:00:00Z') })
  for (const [exerciseLogs, tone, label, color, background] of [
    [[], 'today', 'I dag', '#edc17b', '#302719'],
    [[{ exercise_id: 'ex-1-0', set_number: 1 }], 'done', 'Gennemført ✓', '#b9d5a0', '#243020'],
    [[{ exercise_id: 'ex-1-0', set_number: 1, skipped: true }], 'skipped', 'Afsluttet · sæt sprunget over', '#d7bce7', '#302437'],
  ]) {
    const html = render(programQolFixture({ exerciseLogs }))
    assert.match(html, new RegExp(`data-program-session-tone="${tone}"`))
    const card = new RegExp(`<div\\b[^>]*data-program-session-tone="${tone}"[^>]*><div\\b[^>]*style="([^"]*)"`).exec(html)
    assert.ok(card, 'the actual session card must be present')
    assert.ok(card[1].split(';').includes(`background:${background}`))
    const tag = [...html.matchAll(/<span\b[^>]*style="([^"]*)"[^>]*>([^<]*)<\/span>/g)].find(m => m[2] === label)
    assert.ok(tag, label)
    assert.ok(tag[1].includes(`color:${color}`))
    assert.ok(contrastRatio(color, background) >= 4.5)
    assert.match(html, /aria-expanded="false"/)
    assert.match(html, /min-height:44px/)
    assert.match(html, /button:focus-visible/)
  }
})

test('React colours: week rows keep current/selected semantics and readable palette', () => {
  const html = render(programQolFixture({ viewingWeekIdx: 0 }))
  const rows = [...html.matchAll(/<button\b[^>]*data-program-week-tone="[^"]*"[^>]*>/g)]
  assert.equal(rows.length, 3)
  assert.equal(rows.filter(m => /aria-current="step"/.test(m[0])).length, 1)
  assert.equal(rows.filter(m => /aria-pressed="true"/.test(m[0])).length, 1)
  for (const [tag] of rows) {
    const style = /style="([^"]*)"/.exec(tag)[1]
    assert.ok(contrastRatio(/(?:^|;)color:(#[a-f0-9]{6})/.exec(style)[1], /(?:^|;)background:(#[a-f0-9]{6})/.exec(style)[1]) >= 4.5)
    assert.match(style, /min-height:44px/)
    assert.match(style, /overflow-wrap:anywhere/)
  }
})

test('React colours: literal intensity text stays escaped; unknown states never claim completion', () => {
  const props = programQolFixture({ progOpenSession: 'session-1-0' })
  props.allWeeks[1].sessions[0].exercises[0].intensity = '<script>fixture</script> · RPE 8'
  const html = render(props)
  assert.match(html, /&lt;script&gt;fixture&lt;\/script&gt; · RPE 8/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /background:#2b2538/)
  for (const extra of [{ programError: true }, { entropi2: false }]) {
    const result = render(programQolFixture({ ...extra, exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1 }] }))
    assert.doesNotMatch(result, /data-program-session-tone="done"|data-program-session-tone="skipped"/)
    if (extra.entropi2 === false) assert.doesNotMatch(result, /data-program-week-tone|data-program-session-tone|background:#2b2538/)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { s } from '../athleteShared.js'
import { homeStyles } from './home/homeStyles.mjs'
import { profileStyles } from './profile/profileStyles.mjs'
import { sessionStyle } from './session/sessionStyle.mjs'
import { entropi2Enabled } from './flag.mjs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const digest = value => createHash('sha256').update(value).digest('hex')
const css = read('./entropi2.css')
const marker = '/* E2-VIS-RAMME2:'
const delta = css.slice(css.indexOf(marker))
const rules = [...delta.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body: body.trim() }))
const rule = selector => {
  const matches = rules.filter(row => row.selector === selector)
  assert.equal(matches.length, 1, selector)
  return matches[0].body
}
const frame = '[data-entropi2-athlete] [data-entropi2-page]'
const embedded = `${frame} :is([data-entropi2-home], [data-entropi2-analysis], [data-e2-mobility], section[aria-label="Beskeder og video"])`

test('frame: the host marker is E2-gated; OFF and preview guards remain exact', () => {
  const host = read('../AthleteView.jsx')
  const addition = "        {...(e2Atlet ? { 'data-entropi2-page': '' } : {})}\n"
  assert.equal(host.split(addition).length, 2)
  assert.equal(host.split('data-entropi2-page').length, 2, 'Only one page marker')
  assert.ok(host.includes('const e2 = entropi2Enabled(entropi2) === true\n'))
  for (const value of [false, null, 0, 1, 'true', {}]) assert.equal(entropi2Enabled(value), false)
  const gate = "e2 && (role === 'athlete' || role === 'coach') && !!athlete?.id"
  assert.ok(host.includes(`const e2Atlet = ${gate}\n`))
  assert.ok(host.includes(`<PageContent {...(forenklinger === true ? { 'data-app-375-page': '' } : {})}\n${addition}` +
    "        {...(e2ReadOnly ? { disabled: true, 'aria-label': 'Atletvisning uden skrivninger' } : {})}\n"))
  assert.ok(host.includes("  const e2ReadOnly = e2 && !!athlete?.id && !e2EgenCoach &&\n" +
    "    (role === 'coach' || role === 'athlete' && (!!coachAthleteId || !!onExitPreview))\n"))
  assert.match(host, /const PageContent = e2ReadOnly \? 'fieldset' : 'div'/)
  assert.match(host, /e2ReadOnly \? \{ \.\.\.s\.page, border: 0, margin: 0, minWidth: 0 \} : s\.page/)
  // Exercise the exact guarded expression without freezing unrelated host code.
  const marked = new Function('e2', 'role', 'athlete', `return ${gate}`)
  for (const role of ['athlete', 'coach', 'visitor', undefined]) {
    for (const athlete of [null, {}, { id: 'synthetic-frame' }]) {
      assert.equal(marked(false, role, athlete), false, 'OFF never gets the marker')
      assert.equal(marked(true, role, athlete), ['athlete', 'coach'].includes(role) && !!athlete?.id)
    }
  }
})

test('frame: one 20px mobile gutter includes Mobility and keeps navigation clearance and card padding', () => {
  assert.match(rule(frame), /padding-inline: 20px !important;/)
  assert.match(rule(frame), /overflow-wrap: anywhere;/)
  assert.equal(rule(embedded), 'padding-inline: 0 !important;')
  assert.equal(s.page.padding, '1.5rem 1rem 6rem')
  assert.equal(homeStyles.card.padding, 20)
  assert.equal(profileStyles.card.padding, 20)
  assert.equal(390 - 2 - 2 * 20, 348, 'content before card padding, including root borders')
  assert.equal(390 - 2 - 2 * 20 - 2 - 2 * homeStyles.card.padding, 306)
  assert.equal(rule(`${frame} [data-entropi2-kost] .e2-nutrition main`), 'padding-inline: 0;')
  assert.match(rule(`${frame} [data-entropi2-kost] .e2-nutrition`), /border-inline: 0 !important;/)
  assert.equal(rule('[data-entropi2-athlete] [data-entropi2-profile]'), 'padding-inline: 20px !important;')
})

test('frame: Program, Mobility, Messages and coach preview keep their wide layout constraints', () => {
  assert.equal(s.page.maxWidth, '680px')
  // No host sizing or margin override, including a 480px cap or width:100% on a fieldset.
  assert.doesNotMatch(rule(frame), /(?:^|;)\s*(?:width|max-width|box-sizing|margin(?:-[\w-]+)?):/)
  assert.doesNotMatch(delta, /(?:^|[;{])\s*(?:width|max-width|margin(?:-[\w-]+)?):/)
  for (const viewport of [390, 521, 768, 1024]) {
    const available = viewport - 2
    const hostWidth = Math.min(available, 680 + 2 * 20)
    if (viewport > 520) assert.ok(hostWidth > 480, `host at ${viewport}px`)
  }
  assert.match(read('./mobility/mobility-screen.mjs'), /maxWidth: '640px'/)
  assert.match(read('./conversation/ConversationView.mjs'), /maxWidth: '480px'/)
  assert.doesNotMatch(delta, /padding-block|padding-bottom|padding-top|height:|overflow-x:|display:/)
  assert.match(sessionStyle, /\.e2-session \.frame \{[^}]*padding:0 20px 32px/)
})

test('frame: reading alignment is scoped to Home, nutrition and profile, with centered nutrition actions', () => {
  assert.equal(rule('[data-entropi2-athlete] :is([data-entropi2-home], [data-entropi2-kost], [data-entropi2-profile])'), 'text-align: left;')
  assert.ok(rules.every(row => row.selector.startsWith('[data-entropi2-athlete] ')))
  assert.equal(rules.length, 6)
  assert.doesNotMatch(delta, /(?:#root|button|input|summary|\.cta|data-entropi2-coach)[^{]*\{/)
  assert.match(read('./nutrition/nutrition.css'), /\.e2-nutrition \.cta\{[^}]*text-align:center/)
})

test('frame: existing colors, focus, reduced motion, dialog and tap targets are untouched', () => {
  assert.equal(digest(css.slice(0, css.indexOf(marker)).replace(/\n$/, '')), '91f4d6fae3af0fc0066ca217a5f32cde68286aecaa51e7584ea83c949427825b')
  assert.doesNotMatch(delta, /(?:color|background|outline|animation|transition|min-height|font-size):/)
  assert.ok(homeStyles.primary.minHeight >= 44)
  assert.ok(homeStyles.secondary.minHeight >= 44)
  assert.ok(profileStyles.button.minHeight >= 44)
})

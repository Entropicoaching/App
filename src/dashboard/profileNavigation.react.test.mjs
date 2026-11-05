import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { installCoachTabsFixture, baseProps } from './coachTabsFixture.mjs'
installCoachTabsFixture({ realReact: true })
const { default: Profile } = await import('./ProfilHoved.jsx')
const { HUB_SECTIONS } = await import('./hubSektioner.jsx')

test('real React: every active secondary tab stays named; More state and readable targets are scoped to ON', () => {
  for (const isMobile of [false, true]) for (const coachRyd of [false, true]) for (const navMenuOpen of [false, true]) {
    for (const { key, label } of HUB_SECTIONS.filter(n => !['program', 'log', 'beskeder'].includes(n.key))) {
      const p = baseProps({ coachRyd, isMobile, navMenuOpen, activeTab: key, setNavMenuOpen() {} })
      const html = render(h(Profile, p))
      const trigger = html.match(/<button[^>]*aria-expanded="(?:true|false)"[^>]*>(.*?)<\/button>/s)
      assert.ok(trigger, key)
      assert.ok(trigger[1].includes(label.replace('&', '&amp;')), key)
      assert.match(trigger[0], new RegExp(`aria-expanded="${navMenuOpen}"`))
      assert.match(trigger[0], /font-size:14px/); assert.match(trigger[0], /min-height:44px/)
      if (navMenuOpen) assert.match(html, /aria-current="page"/)
      const off = render(h(Profile, { ...p, coachTabCleanup: false }))
      assert.doesNotMatch(off, /aria-expanded=/)
      if (coachRyd) assert.match(off, />Mere<span/)
    }
  }
})

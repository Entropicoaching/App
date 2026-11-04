import test from 'node:test'
import assert from 'node:assert/strict'
import { nodes, text, marked, fixtureProps } from './bundNavHarness.mjs'

export function navigationCases(BundNav) {
  const render = extra => BundNav(fixtureProps(extra))
  const nav = tree => marked(tree, 'data-entropi2-bundnav')
  const legacy = tree => marked(tree, 'data-entropi2-legacy-bundnav')
  const buttons = tree => nodes(tree).filter(n => n.type === 'button')
  const byLabel = (tree, label) => buttons(tree).find(n => text(n) === label)

  test('Entropi 2: five primary destinations in Danish, remaining routes under closed Mere', () => {
    const root = render({ athlete: { competition_date: '2026-12-01' } })
    const bar = nav(root)
    assert.equal(bar.props['aria-label'], 'Hovednavigation')
    const children = [bar.props.children].flat(Infinity).filter(n => n && typeof n === 'object')
    assert.deepEqual(children.map(n => n.type), ['button', 'button', 'button', 'button', 'button', 'details'])
    assert.deepEqual(children.slice(0, 5).map(text), ['Hjem', 'Program', 'Fremgang', 'Kost', 'Beskeder'])
    const details = children[5]
    assert.ok(!details.props.open)
    assert.equal(text(nodes(details).find(n => n.type === 'summary')), 'Mere')
    assert.deepEqual(buttons(details).map(text), ['Volumen', 'Mobilitet', 'Stævne'])
    assert.deepEqual(buttons(legacy(root)).map(text), ['Hjem', 'Program', 'Volumen', 'Fremgang', 'Kost', 'Mobilitet', 'Beskeder', 'Stævne'])
  })

  test('every primary and folded button preserves the exact existing route callback', () => {
    const destinations = []
    const bar = nav(render({ hasMeetPlan: true, setTab: key => destinations.push(key) }))
    let focused = 0
    const details = { open: true, querySelector: selector => {
      assert.equal(selector, 'summary'); return { focus() { focused++ } }
    } }
    for (const button of buttons(bar)) {
      button.props.onClick({ currentTarget: { closest: selector => {
        assert.equal(selector, 'details'); return details
      } } })
    }
    assert.deepEqual(destinations, ['hjem', 'program', 'fremgang', 'kost', 'beskeder', 'volumen', 'mobilisering', 'stævnedag'])
    assert.equal(details.open, false)
    assert.equal(focused, 3)
  })

  test('cost permission and meet relevance apply equally to both presentations', () => {
    for (const visKost of [false, true]) for (const competition_date of [undefined, '2026-12-01'])
      for (const hasMeetPlan of [false, true]) {
        const root = render({ visKost, athlete: { competition_date }, hasMeetPlan })
        for (const bar of [nav(root), legacy(root)]) {
          assert.equal(Boolean(byLabel(bar, 'Kost')), visKost)
          assert.equal(Boolean(byLabel(bar, 'Stævne')), Boolean(competition_date || hasMeetPlan))
          assert.ok(byLabel(bar, 'Volumen'))
          assert.ok(byLabel(bar, 'Mobilitet'))
        }
      }
    assert.equal(Boolean(byLabel(nav(render({ athlete: null })), 'Stævne')), false)
  })

  test('one current destination, with visible top marker and active Mere for folded pages', () => {
    for (const [key, label] of [['hjem','Hjem'], ['program','Program'], ['fremgang','Fremgang'],
      ['kost','Kost'], ['beskeder','Beskeder'], ['volumen','Volumen'],
      ['mobilisering','Mobilitet'], ['stævnedag','Stævne']]) {
      const bar = nav(render({ tab: key, hasMeetPlan: true }))
      const current = nodes(bar).filter(n => n.props['aria-current'] === 'page')
      assert.equal(current.length, 1)
      assert.equal(text(current[0]), label)
      assert.equal(current[0].props.style.fontWeight, 700)
      assert.notEqual(current[0].props.style.boxShadow, 'none')
      const summary = nodes(bar).find(n => n.type === 'summary')
      const folded = ['volumen', 'mobilisering', 'stævnedag'].includes(key)
      assert.equal(summary.props.style.fontWeight, folded ? 700 : 400)
      assert.equal(summary.props['aria-label'], folded ? `Mere, aktiv fane: ${label}` : undefined)
    }
    assert.equal(nodes(nav(render({ tab: 'unknown' }))).filter(n => n.props['aria-current']).length, 0)
  })

  test('unread dot and accessible message label include unseen video feedback without inventing counts', () => {
    for (const [unreadMsgCount, sharedVideoAnalyses, unread] of [
      [0, [], false], [2, [], true], [0, [{ athlete_seen_at: null }], true],
      [0, [{ athlete_seen_at: '2026-11-04' }], false], [3, [{ athlete_seen_at: null }], true],
    ]) {
      const bar = nav(render({ unreadMsgCount, sharedVideoAnalyses }))
      const message = byLabel(bar, 'Beskeder')
      assert.equal(nodes(bar).filter(n => Object.hasOwn(n.props, 'data-entropi2-unread')).length, unread ? 1 : 0)
      assert.equal(message.props['aria-label'], unread ? 'Beskeder, ulæst indhold' : undefined)
      assert.equal(nodes(message).find(n => n.type === 'span').props['aria-hidden'], 'true')
    }
  })

  test('all Entropi 2 controls fit 320px and declare touch targets at least 44px', () => {
    const bar = nav(render({ hasMeetPlan: true }))
    const controls = nodes(bar).filter(n => ['button', 'summary'].includes(n.type))
    assert.equal(controls.length, 9)
    for (const control of controls) {
      assert.ok(control.props.style.minHeight >= 44)
      assert.ok(control.props.style.minWidth >= 44)
      assert.ok(nodes(control).some(n => n.type === 'svg'))
      if (control.type === 'button') assert.equal(control.props.type, 'button')
    }
    const topLevel = [bar.props.children].flat(Infinity).filter(n => n && typeof n === 'object')
    assert.ok(topLevel.reduce((sum, n) => sum + n.props.style.minWidth, 0) <= 320)
    assert.equal(bar.props.style.paddingBottom, 'env(safe-area-inset-bottom, 0px)')
    const popup = nodes(bar).find(n => n.props.style?.overflowY === 'auto')
    assert.ok(popup.props.style.maxHeight)
  })

  test('Escape closes native Mere and restores summary focus; other keys remain native', () => {
    const details = nodes(nav(render())).find(n => n.type === 'details')
    let focused = 0, prevented = 0, stopped = 0
    const host = { open: true, querySelector: () => ({ focus() { focused++ } }) }
    const event = key => ({ key, currentTarget: host, preventDefault() { prevented++ }, stopPropagation() { stopped++ } })
    details.props.onKeyDown(event('Enter'))
    assert.equal(host.open, true)
    details.props.onKeyDown(event('Escape'))
    assert.equal(host.open, false)
    assert.equal(focused, 1)
    assert.equal(prevented, 1)
    assert.equal(stopped, 1)
    details.props.onKeyDown(event('Escape'))
    assert.equal(focused, 1)
  })

  test('Mere stays open between its controls and closes when focus leaves the menu', () => {
    const details = nodes(nav(render())).find(n => n.type === 'details')
    const inside = {}, outside = {}
    const host = { open: true, contains: target => target === inside }
    details.props.onBlur({ currentTarget: host, relatedTarget: inside })
    assert.equal(host.open, true)
    details.props.onBlur({ currentTarget: host, relatedTarget: outside })
    assert.equal(host.open, false)
    host.open = true
    details.props.onBlur({ currentTarget: host, relatedTarget: null })
    assert.equal(host.open, false)
  })

  test('OFF keeps the legacy menu; only the existing athlete marker enables Entropi 2 styles', () => {
    const root = render()
    const css = text(nodes(root).find(n => n.type === 'style'))
    assert.match(css, /\[data-entropi2-bundnav\]\s*\{\s*display: none;/)
    assert.match(css, /\[data-entropi2-athlete\] \[data-entropi2-bundnav\]\s*\{\s*display: flex;/)
    assert.match(css, /\[data-entropi2-athlete\] \[data-entropi2-legacy-bundnav\]\s*\{\s*display: none !important;/)
    assert.match(css, /:focus-visible/)
    assert.equal(legacy(root).props.style.display, 'flex')
    assert.equal(nav(root).props.style.display, undefined)
  })
}

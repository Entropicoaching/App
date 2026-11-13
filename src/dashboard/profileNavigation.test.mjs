// Actual JSX through the existing synthetic loader; no browser, backend or real React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { installCoachTabsFixture, baseProps, nodes, expand, text } from './coachTabsFixture.mjs'
installCoachTabsFixture()
const { default: Profile } = await import('./ProfilHoved.jsx')
const { HUB_SECTIONS } = await import('./hubSektioner.jsx')
const tree = props => expand(Profile(baseProps({ setNavMenuOpen() {}, ...props })))
const trigger = t => nodes(t).find(n => n.type === 'button' && Object.hasOwn(n.props, 'aria-expanded'))
const findButton = (t, label) => nodes(t).find(n => n.type === 'button' && text(n.children).trim().endsWith(label))

test('ON tabs and More choices retain every section, selection and readable touch targets in both layouts', () => {
  for (const isMobile of [false, true]) for (const coachRyd of [false, true]) {
    for (const activeTab of ['hub', ...HUB_SECTIONS.map(n => n.key)]) {
      const calls = []
      const t = tree({ isMobile, coachRyd, activeTab, navMenuOpen: true,
        setActiveTab: key => calls.push(['tab', key]), setEditing: value => calls.push(['edit', value]),
        setNavMenuOpen: value => calls.push(['menu', value]) })
      const more = trigger(t)
      assert.equal(more.props['aria-expanded'], true)
      assert.ok(more.props.style.minHeight >= 44); assert.equal(more.props.style.fontSize, 14)
      const label = HUB_SECTIONS.find(n => n.key === activeTab)?.label ?? 'Hjem'
      if (!['program', 'log', 'beskeder', ...(!coachRyd ? ['hub'] : [])].includes(activeTab)) assert.match(text(more.children), new RegExp(label))
      more.props.ref.current = { focus() { calls.push(['focus']) } }
      for (const section of [{ key: 'hub', label: 'Hjem' }, ...HUB_SECTIONS]) {
        const primaryLabel = coachRyd ? { program: 'Plan', log: 'Log', beskeder: 'Svar' }[section.key] : null
        const b = findButton(t, primaryLabel ?? section.label)
        assert.ok(b, section.key); assert.equal(typeof b.props.onClick, 'function')
        assert.ok(b.props.style.minHeight >= 44, section.key)
        if (!primaryLabel) {
          assert.equal(b.props.style.fontSize, 14)
          assert.equal(b.props.style.textTransform, 'none')
          assert.equal(b.props['aria-current'], section.key === activeTab ? 'page' : undefined)
        }
        calls.length = 0; b.props.onClick()
        assert.deepEqual(calls.slice(0, 3), [['tab', section.key], ['edit', null], ['menu', false]])
      }
      const panel = nodes(t).find(n => n.props?.style?.zIndex === 41)
      assert.match(panel.props.style.maxWidth, /100vw/)
      assert.equal(panel.props.style.minWidth, 0)
    }
  }
})

test('Escape closes only an open ON menu and returns focus; selecting a secondary tab also returns focus', () => {
  for (const coachRyd of [false, true]) {
    const calls = [], t = tree({ coachRyd, activeTab: 'kost', navMenuOpen: true,
      setNavMenuOpen: value => calls.push(value) })
    const more = trigger(t); more.props.ref.current = { focus() { calls.push('focus') } }
    const handler = nodes(t).find(n => n.props.onKeyDown).props.onKeyDown
    handler({ key: 'Tab' }); assert.deepEqual(calls, [])
    handler({ key: 'Escape', preventDefault() { calls.push('prevent') }, stopPropagation() { calls.push('stop') } })
    assert.deepEqual(calls, ['prevent', 'stop', false, 'focus'])
    calls.length = 0; findButton(t, 'Kost & mål').props.onClick()
    assert.deepEqual(calls, [false, 'focus'])
    const closed = tree({ coachRyd, navMenuOpen: false, setNavMenuOpen: value => calls.push(value) })
    assert.equal(trigger(closed).props['aria-expanded'], false)
    calls.length = 0
    nodes(closed).find(n => n.props.onKeyDown).props.onKeyDown({ key: 'Escape' })
    assert.deepEqual(calls, [])
    trigger(closed).props.onClick(); assert.equal(calls.length, 1); assert.equal(calls[0](false), true)
  }
})

test('explicit OFF keeps the legacy labels, sizes, attributes and callbacks', () => {
  for (const coachRyd of [false, true]) for (const isMobile of [false, true]) {
    const t = tree({ coachTabCleanup: false, coachRyd, isMobile, activeTab: 'kost', navMenuOpen: true })
    assert.equal(trigger(t), undefined)
    assert.equal(nodes(t).some(n => n.props.onKeyDown), false)
    const menuItem = nodes(t).find(n => n.type === 'button' && n.props.style?.borderLeft)
    assert.equal(menuItem.props.style.fontSize, '0.7rem')
    assert.equal(menuItem.props.style.textTransform, 'uppercase')
    assert.equal(menuItem.props.style.minHeight, undefined)
    if (coachRyd) assert.ok(nodes(t).find(n => n.type === 'button' && /^Mere/.test(text(n.children).trim())))
  }
})

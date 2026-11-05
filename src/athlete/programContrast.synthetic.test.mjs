import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { contrastFixture, contrastRatio } from './programContrastFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const render = props => mount(Program, props).render()
const date = tree => nodes(tree, n => n.type === 'span' && /^2\. nov.*22\. nov/.test(text(n)))[0]
const caption = tree => nodes(tree, n => n.type === 'span' && /^(Planlagt|Historisk) · uge/.test(text(n)))[0]
const marker = tree => nodes(tree, n => n.props['data-program-block-overview'] === true)

test('actual Program date and both noncurrent captions meet AA on their card surface', () => {
  assert.ok(contrastRatio('#7a7770', '#1c1c18') < 4.5, 'old colour fails this surface')
  for (const entropi2 of [undefined, true]) {
    for (const viewingWeekIdx of [0, 2]) {
      const tree = render(contrastFixture({ entropi2, viewingWeekIdx }))
      const dateNode = date(tree), captionNode = caption(tree)
      assert.ok(dateNode)
      assert.ok(captionNode)
      const cards = nodes(tree, n => n.props.style?.background === '#1c1c18' && nodes(n, x => x === dateNode).length)
      assert.equal(cards.length, 1)
      for (const node of [dateNode, captionNode]) {
        assert.equal(node.props.style.color, '#c4c0b5')
        assert.ok(contrastRatio(node.props.style.color, cards[0].props.style.background) >= 4.5)
      }
      assert.match(text(captionNode), viewingWeekIdx === 0 ? /Historisk · uge 1/ : /Planlagt · uge 3/)
    }
  }
})

test('strict OFF gates retain legacy colours and no appearance marker, including legacy overview ON', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    for (const programBlokOversigt of [false, true]) {
      for (const viewingWeekIdx of [0, 2]) {
        const tree = render(contrastFixture({ entropi2, programBlokOversigt, viewingWeekIdx }))
        assert.equal(date(tree).props.style.color, '#7a7770')
        assert.equal(caption(tree).props.style.color, '#7a7770')
        assert.equal(marker(tree).length, 0)
      }
    }
  }
})

test('overview marker owns only the accented root and preserves ready/error children and retry', () => {
  for (const programError of [false, true]) {
    const calls = []
    const props = contrastFixture({ programError, fetchProgram: id => calls.push(id) })
    const before = JSON.stringify(props.allWeeks)
    const tree = render(props), marked = marker(tree)
    assert.equal(marked.length, 1)
    assert.equal(marked[0].type, 'section')
    assert.equal(marked[0].props.style.borderInlineStart, '4px solid #c8923a')
    assert.equal(marked[0].props.style.background, '#1c1c18')
    assert.equal(marked[0].props['aria-label'], 'Din aktuelle blok')
    if (programError) {
      assert.match(text(marked[0]), /kunne ikke hentes/)
      nodes(marked[0], n => n.type === 'button')[0].props.onClick()
      assert.deepEqual(calls, ['contrast-fixture'])
    } else {
      assert.match(text(marked[0]), /Basis.*Uge 2 af 3/)
      assert.equal(nodes(marked[0], n => n.type === 'details').length, 2)
      assert.equal(nodes(marked[0], n => n.type === 'button').length, 3)
      assert.deepEqual(calls, [])
    }
    assert.equal(JSON.stringify(props.allWeeks), before)
  }
})

// Test-only inspection of React SSR HTML; no DOM, browser or external package.
import assert from 'node:assert/strict'

export const textContent = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '')
  .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[n])
  .replace(/\s+/g, ' ').trim()

export function markupTree(html) {
  const root = { tag: '#root', children: [] }, stack = [root]
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const tokens = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*\/?>|([^<]+)/gi
  for (const match of html.matchAll(tokens)) {
    if (match[0].startsWith('<!--')) continue
    if (match[2]) { stack.at(-1).children.push(match[2]); continue }
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      assert.equal(stack.at(-1).tag, tag, `Mismatched SSR closing tag: ${tag}`)
      stack.pop()
    } else {
      const node = { tag, attributes: match[0], children: [] }
      stack.at(-1).children.push(node)
      if (!voids.has(tag) && !match[0].endsWith('/>')) stack.push(node)
    }
  }
  assert.equal(stack.length, 1, 'Unclosed SSR element')
  return root
}

export const elements = tree => typeof tree === 'string' ? [] : [tree, ...tree.children.flatMap(elements)]
const blocks = new Set(['p', 'div', 'section', 'main', 'header', 'footer', 'h1', 'h2', 'h3', 'li', 'ul', 'ol', 'summary', 'details', 'dt', 'dd', 'tr', 'td', 'th', 'br'])
const rawText = node => typeof node === 'string' ? node :
  (blocks.has(node.tag) ? '\n' : '') + node.children.map(rawText).join('') + (blocks.has(node.tag) ? '\n' : '')
export const nodeText = node => textContent(rawText(node))

export function assertCleanMarkup(html) {
  assert.ok(html.length, 'AthleteView returned no HTML')
  const tree = markupTree(html)
  assert.doesNotMatch(nodeText(tree), /ukendt|undefined|NaN|\[object Object\]/i)
  for (const detail of elements(tree).filter(node => node.tag === 'details')) {
    const summary = detail.children.find(node => node.tag === 'summary')
    assert.ok(summary && nodeText(summary), 'Fold needs a nonempty summary')
    const body = detail.children.filter(node => node !== summary)
    assert.ok(body.some(node => nodeText(node) || typeof node !== 'string' &&
      elements(node).some(child => ['input', 'select', 'textarea', 'img', 'svg', 'table'].includes(child.tag))),
    `Empty fold: ${nodeText(summary)}`)
  }
  return tree
}

// Disabled write controls still count: the order says no write buttons in preview.
export function assertNoWriteButtons(html) {
  const writes = /(?:\b(?:gem|log|send|registr[eé]r|upload|slet|fortryd|spring|udfyld|bekræft|godkend)\b|film et sæt|del ugen|start (?:dagens|næste) pas)/i
  for (const node of elements(markupTree(html))) {
    if (node.tag === 'button' || node.tag === 'input' && /\btype=["'](?:submit|button)["']/.test(node.attributes)) {
      assert.doesNotMatch(nodeText(node) || node.attributes.match(/\bvalue="([^"]*)"/)?.[1] || '', writes,
        `Preview exposes a write button: ${nodeText(node)}`)
    }
  }
}

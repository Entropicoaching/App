// Minimal synthetic DOM adapter for the production createElement renderer.
export function element(tagName, attributes, ...children) {
  const node = { tagName, attributes: attributes || {}, childNodes: children.flat(Infinity).filter(x => x != null),
    click() { if (this.tagName !== 'button') throw Error('Not a button'); this.attributes.onClick?.() },
    get textContent() { return this.childNodes.map(x => typeof x === 'object' ? x.textContent : String(x)).join(' ') },
    queryAll(tag) { return this.childNodes.filter(x => typeof x === 'object').flatMap(x =>
      [...(x.tagName === tag ? [x] : []), ...x.queryAll(tag)]) } }
  return node
}

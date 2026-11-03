// Deliberately small, synthetic DOM; no browser or layout claims.
export class Element {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.attributes = {};
    this.listeners = new Map();
    this.textContent = '';
    this.hidden = false;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  click() {
    if (this.disabled) return;
    for (const listener of this.listeners.get('click') ?? []) listener({ target: this });
  }
  focus() { this.ownerDocument.activeElement = this; }
}
export function syntheticDocument() {
  return { activeElement: null, createElement(tag) { return new Element(tag, this); } };
}
export function descendants(root, tag) {
  return root.children.flatMap(child => [
    ...(child.tagName === tag ? [child] : []), ...descendants(child, tag),
  ]);
}
export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    writes: [],
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); this.writes.push([key, value]); },
  };
}

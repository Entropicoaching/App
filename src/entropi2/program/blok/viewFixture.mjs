// Synthetic host-element descriptions only; no ReactDOM, hooks or layout simulation.
export function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity) }
}

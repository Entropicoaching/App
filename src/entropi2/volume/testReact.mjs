// Element descriptions only; deliberately no React runtime or browser claims.
export function createElement(type, props, ...children) {
  return { type, props: { ...props, children: children.flat(Infinity).filter(c => c !== null && c !== undefined && typeof c !== 'boolean') } }
}

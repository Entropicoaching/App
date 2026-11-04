// Synthetic fixture for React's public host-element shape. This is not React
// and does not validate reconciliation, hooks, ReactDOM or browser layout.
export function createElement(type, config, ...children) {
  const { key = null, ...props } = config || {}
  if (children.length === 1) props.children = children[0]
  else if (children.length > 1) props.children = children
  return Object.freeze({ type, key, props: Object.freeze(props) })
}

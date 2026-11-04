// Synthetic host tree and HTML fixture: no React reconciler or browser layout.
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children } })
let id = 0
export const useId = () => `synthetic-${++id}`
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[c])
export function renderToStaticMarkup(node, selected) {
  if (node == null || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(child => renderToStaticMarkup(child, selected)).join('')
  if (typeof node !== 'object') return escape(node)
  if (typeof node.type === 'function') return renderToStaticMarkup(node.type(node.props), selected)
  const { children, style, ...props } = node.props
  const attrs = Object.entries(props).flatMap(([name, value]) => {
    if (name === 'key' || name.startsWith('on') || value == null || value === false || (node.type === 'select' && name === 'value')) return []
    const key = { htmlFor: 'for', className: 'class', readOnly: 'readOnly' }[name] || name
    return [` ${key}="${value === true && !name.startsWith('aria-') ? '' : escape(value)}"`]
  }).join('')
  const option = node.type === 'option' && props.value === selected ? ' selected=""' : ''
  const start = `<${node.type}${attrs}${option}>`
  if (node.type === 'input') return start
  return `${start}${renderToStaticMarkup(children, node.type === 'select' ? props.value : selected)}</${node.type}>`
}

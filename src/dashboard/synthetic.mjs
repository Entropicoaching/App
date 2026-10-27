// Minimal synthetic element tree. No browser or real React dependency.
export function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity).filter(c => c !== false && c != null) }
}
export const state = { responses: [], calls: [] }
export const withRetry = fn => fn()
export const supabase = {
  from(table) {
    const call = { table, steps: [] }
    state.calls.push(call)
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve, reject) => {
        const response = state.responses.shift()
        if (response instanceof Error) return Promise.reject(response).then(resolve, reject)
        if (!response) return Promise.reject(Error('No synthetic response')).then(resolve, reject)
        return Promise.resolve(response).then(resolve, reject)
      }
      return (...args) => { call.steps.push([key, ...args]); return query }
    } })
    return query
  },
}
export function elements(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === type ? [tree] : []), ...tree.children.flatMap(child => elements(child, type))]
}
export function textContent(tree) {
  if (tree == null) return ''
  return typeof tree === 'object' ? tree.children.map(textContent).join(' ') : String(tree)
}

// The template editor is never expanded by the legacy daylist tests.
export function useState() { throw Error('Unexpected legacy hook') }
export function useRef() { throw Error('Unexpected legacy hook') }
